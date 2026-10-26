import { describe, it, expect, beforeEach } from 'vitest';
import * as ops from '../src/lib/ops.js';
import { store } from '../src/lib/store.js';
import { newQuiz, newQuestion, toDocs } from '../src/lib/quizModel.js';
import { buildImportTemplate, parseImportUpload } from '../src/lib/importAnswers.js';

const admin = { uid: 'u_admin', email: 'saiteja.janumpally@databeat.io', name: 'Sai Teja' };
const p1 = { uid: 'p1', email: 'p1@databeat.io', name: 'P One' };
const p2 = { uid: 'p2', email: 'p2@databeat.io', name: 'P Two' };

function pastQuiz() {
  const now = Date.now();
  const a = newQuiz({ opens: now - 10 * 86400000, closes: now - 9 * 86400000, keyAt: now - 8 * 86400000 }, admin.email);
  a.id = 'z_past'; a.title = 'Past round';
  a.sections = [{ id: 's1', title: '', flat: true, intro: '', timerMin: 0, questions: [
    { ...newQuestion('mcq', 'm1'), text: 'Pick one', options: ['Cats', 'Dogs'], correct: 0 },
    { ...newQuestion('multi', 'x1'), text: 'Pick some', options: ['A', 'B', 'C'], correct: [0, 1] },
    { ...newQuestion('tf', 't1'), text: 'True?', correct: true }
  ] }];
  return a;
}

describe('importing answers for a quiz that happened before the tool ran it', () => {
  beforeEach(async () => { await store.ready; await store.reset(); });
  it('builds a template and parses a correctly filled-in file back into the same answers', async () => {
    const a = pastQuiz(); const { quiz } = toDocs(a);
    const tpl = buildImportTemplate(quiz);
    expect(tpl).toContain('email');
    expect(tpl).toContain('m1: Pick one');
    const csv = 'email,m1: Pick one,x1: Pick some,t1: True?\np1@databeat.io,Cats,A;B,true\np2@databeat.io,Dogs,C,false';
    const { rows, errors } = parseImportUpload(csv, quiz);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { email: 'p1@databeat.io', answers: { m1: 0, x1: [0, 1], t1: true } },
      { email: 'p2@databeat.io', answers: { m1: 1, x1: [2], t1: false } }
    ]);
  });
  it('reports a clear, line-numbered error for an option that does not match, and still keeps the good rows', async () => {
    const a = pastQuiz(); const { quiz } = toDocs(a);
    const csv = 'email,m1: Pick one,x1: Pick some,t1: True?\np1@databeat.io,Cats,A;B,true\np2@databeat.io,Rabbits,C,false';
    const { rows, errors } = parseImportUpload(csv, quiz);
    expect(rows).toEqual([{ email: 'p1@databeat.io', answers: { m1: 0, x1: [0, 1], t1: true } }]);
    expect(errors[0]).toMatch(/Line 3, m1: "Rabbits" doesn't match/);
  });
  it('rejects a file whose columns were edited to something the quiz does not have', async () => {
    const a = pastQuiz(); const { quiz } = toDocs(a);
    const { errors } = parseImportUpload('email,made_up\np1@databeat.io,x', quiz);
    expect(errors[0]).toMatch(/don't match a question/);
  });
  it('writes real responses for people who have signed in, and holds the rest as pending', async () => {
    await ops.ensureUser(p1); // p2 has never signed in
    const a = pastQuiz();
    await ops.saveQuiz(a, admin, { publish: true });
    const r = await ops.importPastResponses('z_past', [
      { email: 'p1@databeat.io', answers: { m1: 0, x1: [0, 1], t1: true } },
      { email: 'p2@databeat.io', answers: { m1: 1, x1: [2], t1: false } }
    ], admin, 'Past round');
    expect(r.imported).toBe(1); expect(r.pending).toEqual(['p2@databeat.io']);
    const resp = await store.get('responses/z_past_p1');
    expect(resp.submitted).toBe(true); expect(resp.imported).toBe(true); expect(resp.importedBy).toBe(admin.email);
    expect(resp.answers).toEqual({ m1: 0, x1: [0, 1], t1: true });
    expect(await store.get('responses/z_past_p2')).toBeNull();
    expect((await ops.listPendingImports('z_past')).map((p) => p.email)).toEqual(['p2@databeat.io']);
  });
  it('finishes a pending import automatically the moment that person signs in', async () => {
    await ops.ensureUser(p1);
    const a = pastQuiz();
    await ops.saveQuiz(a, admin, { publish: true });
    await ops.importPastResponses('z_past', [{ email: 'p2@databeat.io', answers: { m1: 1, x1: [2], t1: false } }], admin, 'Past round');
    expect(await store.get('responses/z_past_p2')).toBeNull();
    await ops.ensureUser(p2); // their first ever sign-in
    const resp = await store.get('responses/z_past_p2');
    expect(resp.submitted).toBe(true); expect(resp.imported).toBe(true); expect(resp.answers).toEqual({ m1: 1, x1: [2], t1: false });
    expect(await ops.listPendingImports('z_past')).toEqual([]);
  });
  it('an imported response grades, releases and lands on the leaderboard exactly like a live one', async () => {
    await ops.ensureUser(p1); await ops.ensureUser(p2);
    const a = pastQuiz();
    await ops.saveQuiz(a, admin, { publish: true });
    await ops.importPastResponses('z_past', [
      { email: 'p1@databeat.io', answers: { m1: 0, x1: [0, 1], t1: true } }, // all correct
      { email: 'p2@databeat.io', answers: { m1: 1, x1: [2], t1: false } } // all wrong
    ], admin, 'Past round');
    const g = await ops.calculate('z_past', admin);
    expect(g.count).toBe(2);
    await ops.release('z_past', admin, 'Past round', false);
    const res1 = await store.get('myResults/z_past_p1'); expect(res1.total).toBe(res1.max);
    const stats1 = await store.get('stats/p1'); expect(stats1.history.z_past.score).toBe(res1.max);
    const pub = await store.get('resultsPublic/z_past'); expect(pub.top.length).toBe(2);
  });
});
