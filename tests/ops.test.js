import { describe, it, expect, beforeEach } from 'vitest';
import * as ops from '../src/lib/ops.js';
import { store } from '../src/lib/store.js';
import { newQuiz, newQuestion, quizStatus, validate } from '../src/lib/quizModel.js';
import { buildWrittenExport, parseWrittenUpload } from '../src/lib/written.js';

const admin = { uid: 'u_admin', email: 'saiteja.janumpally@databeat.io', name: 'Sai Teja' };
const creator = { uid: 'u_creator', email: 'creator@databeat.io', name: 'Charan' };
const p1 = { uid: 'p1', email: 'p1@databeat.io', name: 'P One' }; const p2 = { uid: 'p2', email: 'p2@databeat.io', name: 'P Two' }; const p3 = { uid: 'p3', email: 'p3@databeat.io', name: 'P Three' };

describe('end to end quiz lifecycle on the demo backend', () => {
  beforeEach(async () => { await store.ready; await store.reset(); });
  it('roles', async () => {
    expect(await ops.getRole(admin)).toBe('admin'); expect(await ops.getRole(creator)).toBe('creator');
    expect(await ops.getRole(p1)).toBe('participant');
    await ops.setRole('New.Lead@databeat.io', 'lead', admin); expect(await ops.getRole({ email: 'new.lead@databeat.io' })).toBe('lead');
    await ops.setRole('new.lead@databeat.io', 'participant', admin); expect(await ops.getRole({ email: 'new.lead@databeat.io' })).toBe('participant');
    expect(ops.canEditQuiz('creator', creator.email, { ownerEmail: 'x', editors: [creator.email] })).toBe(true);
    expect(ops.canEditQuiz('creator', creator.email, { ownerEmail: 'x', editors: [] })).toBe(true); // every creator can edit every quiz
    expect(ops.canEditQuiz('participant', p1.email, { ownerEmail: 'x', editors: [] })).toBe(false);
    expect(ops.canEditQuiz('lead', p1.email, { ownerEmail: 'x', editors: [] })).toBe(false);
    const plan = ops.planBulkRoles([{ email: 'a@databeat.io', role: 'lead' }, { email: 'b@gmail.com', role: 'lead' }, { email: 'c@databeat.io', role: 'boss' }, { email: 'a@databeat.io', role: 'lead' }], 'admin');
    expect(plan.ok.length).toBe(1); expect(plan.errors.length).toBe(3);
    expect(ops.planBulkRoles([{ email: 'a@databeat.io', role: 'admin' }], 'creator').errors[0]).toMatch(/creators can only/);
  });
  it('create, take, auto-submit, score, review, release', async () => {
    const now = Date.now();
    const a = newQuiz({ opens: now - 1000, closes: now + 5000, keyAt: now + 9000 }, creator.email);
    a.title = 'Lifecycle'; a.autoSubmit = true; a.allowReviewRequests = true;
    a.sections = [{ id: 's1', title: 'All', timerMin: 0, questions: [{ ...newQuestion('mcq', 'm1'), text: 'M?', options: ['a', 'b'], correct: 1 }, { ...newQuestion('text', 't1'), text: 'T?', rubric: 'r' }] }];
    expect(validate(a)).toEqual([]);
    await ops.saveQuiz(a, creator, { publish: true });
    let idx = await ops.loadIndex(); expect(quizStatus(idx[a.id], now)).toBe('live'); expect(idx[a.id].hasWritten).toBe(true);
    // p1 submits, p2 only saves one answer (auto-submit on), p3 never starts
    await ops.saveAnswer(p1, a.id, 'm1', 1, false); await ops.saveAnswer(p1, a.id, 't1', 'My view', true); await ops.submitResponse(p1, a.id);
    await ops.saveAnswer(p2, a.id, 'm1', 1, false);
    expect(await ops.liveCounts(a.id)).toEqual({ submitted: 1, started: 2 });
    // close and calculate
    await ops.setCloses(a.id, now - 1, creator, a.title);
    const r = await ops.calculate(a.id, creator);
    expect(r).toMatchObject({ count: 2, auto: 1, unscored: 1 });
    const p2resp = await ops.loadMyResponse(a.id, 'p2'); expect(p2resp.submitted).toBe(true); expect(p2resp.auto).toBe(true);
    // written export, upload and recalc
    const ex = await ops.exportWrittenFor(a.id); expect(ex.count).toBe(1);
    const up = parseWrittenUpload('key,score,feedback,flag\np1~t1,1.5,Nice,yes\n', ex.keys); expect(up.errors).toEqual([]);
    await ops.saveWrittenScores(a.id, up.ok, creator, a.title);
    await ops.calculate(a.id, creator);
    expect((await store.get('myResults/' + a.id + '_p1')).total).toBe(3.5);
    const review = await ops.loadWrittenReview(a.id); expect(review[0].flag).toBe(true);
    await ops.overrideWritten(a.id, review[0], 2, 'Great', 'Rubric rereading', creator, a.title);
    await ops.calculate(a.id, creator); expect((await store.get('myResults/' + a.id + '_p1')).total).toBe(4);
    // checklist gates release
    idx = await ops.loadIndex(); let c = ops.checklist(idx[a.id], now); expect(c.ready).toBe(false);
    await ops.markOp(a.id, 'reviewedAt', creator); await ops.markOp(a.id, 'backupAt', creator); await ops.markOp(a.id, 'announceAt', creator);
    idx = await ops.loadIndex(); c = ops.checklist(idx[a.id], now); expect(c.ready).toBe(true);
    await ops.release(a.id, creator, a.title, false);
    idx = await ops.loadIndex(); expect(quizStatus(idx[a.id], now)).toBe('released'); expect((await store.get('quizKeys/' + a.id)).released).toBe(true);
    const stats = await store.get('stats/p1'); expect(stats.history[a.id].score).toBe(4);
    expect((await ops.loadChangeLog()).length).toBeGreaterThan(5);
    expect((await ops.resultsCsv(a.id)).split('\r\n').length).toBe(3);
  });
  it('without auto-submit, unsubmitted work is ignored', async () => {
    const now = Date.now(); const a = newQuiz({ opens: now - 1000, closes: now + 5000, keyAt: now + 9000 }, creator.email);
    a.title = 'NoAuto'; a.sections = [{ id: 's1', title: 'All', questions: [{ ...newQuestion('mcq', 'm1'), text: 'M?', options: ['a', 'b'], correct: 1 }] }];
    await ops.saveQuiz(a, creator, { publish: true });
    await ops.saveAnswer(p1, a.id, 'm1', 1, false); await ops.submitResponse(p1, a.id); await ops.saveAnswer(p2, a.id, 'm1', 1, false);
    await ops.setCloses(a.id, now - 1, creator, a.title);
    expect(await ops.calculate(a.id, creator)).toMatchObject({ count: 1, auto: 0 });
  });
});
