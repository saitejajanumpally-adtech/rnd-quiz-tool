import { describe, it, expect, beforeEach } from 'vitest';
import * as ops from '../src/lib/ops.js';
import { store } from '../src/lib/store.js';
import { buildUsersCsv, usersSummary, istStamp } from '../src/lib/usersExport.js';
import { newQuiz, newQuestion } from '../src/lib/quizModel.js';
import { summarize } from '../src/lib/stages.js';

const admin = { uid: 'u_admin', email: 'saiteja.janumpally@databeat.io', name: 'Sai Teja' };
const creator = { uid: 'u_creator', email: 'creator@databeat.io', name: 'Charan' };
const p1 = { uid: 'p1', email: 'p1@databeat.io', name: 'P One' };
const DAY = 86400000;

describe('sign-in tracking', () => {
  beforeEach(async () => { await store.ready; await store.reset(); });
  it('first sign-in sets firstSeen and Active status', async () => {
    await ops.ensureUser(p1);
    const u = await store.get('users/p1');
    expect(u.firstSeen).toBeGreaterThan(0); expect(u.deleted).toBe(false); expect(u.deletedAt).toBeNull();
  });
  it('later sign-ins keep the original firstSeen', async () => {
    await ops.ensureUser(p1); const first = (await store.get('users/p1')).firstSeen;
    await new Promise((r) => setTimeout(r, 5));
    await ops.ensureUser(p1);
    const u = await store.get('users/p1');
    expect(u.firstSeen).toBe(first); expect(u.lastSeen).toBeGreaterThan(first);
  });
  it('removing a profile keeps the record and marks it Deleted', async () => {
    await ops.ensureUser(p1); await ops.removeMyProfile(p1);
    const u = await store.get('users/p1');
    expect(u.deleted).toBe(true); expect(u.deletedAt).toBeGreaterThan(0); expect(u.name).toBe('P One');
  });
  it('signing in again after removal makes the profile Active again', async () => {
    await ops.ensureUser(p1); await ops.removeMyProfile(p1); await ops.ensureUser(p1);
    const u = await store.get('users/p1');
    expect(u.deleted).toBe(false); expect(u.deletedAt).toBeNull();
  });
});

describe('quiz archive and delete', () => {
  beforeEach(async () => { await store.ready; await store.reset(); });
  async function makeQuiz(id, { released = false, responded = false } = {}) {
    const now = Date.now();
    const a = newQuiz({ opens: now - 1000, closes: now + 5000, keyAt: now + 9000 }, creator.email);
    a.id = id; a.title = 'Quiz ' + id;
    a.sections = [{ id: 's1', title: 'All', timerMin: 0, questions: [{ ...newQuestion('mcq', 'm1'), text: 'M?', options: ['a', 'b'], correct: 1 }] }];
    await ops.saveQuiz(a, creator, { publish: true });
    if (released) await ops.release(id, admin, a.title, false);
    if (responded) await store.set(`responses/${id}_p1`, { quizId: id, uid: 'p1', submitted: true, answers: {} });
    return a;
  }
  it('archiving moves the quiz out of the Library list into the admin-only list, and restore puts it back', async () => {
    await makeQuiz('qa');
    await ops.setArchived('qa', true, admin, 'Quiz qa');
    expect((await store.get('quizzes/qa')).archived).toBe(true);
    expect((await store.get('quizKeys/qa')).archived).toBe(true);
    expect((await ops.loadIndex()).qa).toBeUndefined();            // gone from what participants read
    expect((await ops.loadArchivedIndex()).qa.title).toBe('Quiz qa'); // kept for admins
    await ops.setArchived('qa', false, admin, 'Quiz qa');
    expect((await store.get('quizzes/qa')).archived).toBe(false);
    const back = (await ops.loadIndex()).qa;
    expect(back.title).toBe('Quiz qa'); expect(back.archived).toBeUndefined();
    expect((await ops.loadArchivedIndex()).qa).toBeUndefined();
  });
  it('archiving keeps the other quizzes in the Library list', async () => {
    await makeQuiz('q1'); await makeQuiz('q2');
    await ops.setArchived('q1', true, admin, 'Quiz q1');
    const idx = await ops.loadIndex();
    expect(idx.q1).toBeUndefined(); expect(idx.q2.title).toBe('Quiz q2');
    expect(Object.keys(idx)).toContain('z_oct1'); // existing quizzes are untouched
  });
  it('an archived quiz cannot be edited until it is restored', async () => {
    const a = await makeQuiz('qe');
    await ops.setArchived('qe', true, admin, 'Quiz qe');
    await expect(ops.saveQuiz(a, admin, {})).rejects.toThrow(/Restore it before editing/);
    expect((await store.get('quizzes/qe')).archived).toBe(true);
  });
  it('restoring or archiving a quiz that is not in the right list gives a clear error', async () => {
    await expect(ops.setArchived('nope', true, admin, 'x')).rejects.toThrow(/not in the Library list/);
    await expect(ops.setArchived('nope', false, admin, 'x')).rejects.toThrow(/not in the Archived list/);
  });
  it('admin can delete an unreleased quiz with no responses', async () => {
    await makeQuiz('qd');
    await ops.deleteQuiz('qd', admin, 'Quiz qd');
    expect(await store.get('quizzes/qd')).toBeNull();
    expect((await ops.loadIndex()).qd).toBeUndefined();
  });
  it('admin can delete a released quiz with responses too, cascading to every response, result and history entry', async () => {
    await makeQuiz('qr', { released: true, responded: true });
    await store.set('myResults/qr_p1', { uid: 'p1', quizId: 'qr', total: 2, max: 2 });
    await store.set('resultsPublic/qr', { top: [], max: 2 });
    await store.set('resultsFull/qr', { rows: [] });
    await store.set('stats/p1', { history: { qr: { score: 2, max: 2, opens: Date.now(), title: 'Quiz qr' }, other: { score: 1, max: 2 } } }, true);
    await ops.deleteQuiz('qr', admin, 'Quiz qr');
    expect(await store.get('quizzes/qr')).toBeNull();
    expect(await store.get('quizKeys/qr')).toBeNull();
    expect(await store.get('responses/qr_p1')).toBeNull();
    expect(await store.get('myResults/qr_p1')).toBeNull();
    expect(await store.get('resultsPublic/qr')).toBeNull();
    expect(await store.get('resultsFull/qr')).toBeNull();
    expect((await ops.loadIndex()).qr).toBeUndefined();
    const stats = await store.get('stats/p1');
    expect('qr' in stats.history).toBe(false); // gone from their personal history and, so, the leaderboard
    expect('other' in stats.history).toBe(true); // an unrelated round's history is untouched
  });
  it('deleting an archived quiz removes it from the archived list too, and frees up its name', async () => {
    await makeQuiz('qarch', { responded: true });
    await ops.setArchived('qarch', true, admin, 'Quiz qarch');
    await ops.deleteQuiz('qarch', admin, 'Quiz qarch');
    expect((await ops.loadArchivedIndex()).qarch).toBeUndefined();
    expect(await store.get('responses/qarch_p1')).toBeNull();
    // the freed-up name no longer blocks a new quiz from publishing under it (see quizModel.validate's otherTitles check)
    const otherTitles = Object.values(await ops.loadIndex()).map((i) => ({ id: i.id, title: i.title }));
    expect(otherTitles.some((t) => t.title === 'Quiz qarch')).toBe(false);
  });
});

describe('Users CSV export', () => {
  const now = Date.UTC(2026, 9, 23, 12, 0);
  const users = [
    { id: 'a', name: 'Ann', email: 'a@databeat.io', firstSeen: now - 40 * DAY, lastSeen: now - 1 * DAY, deleted: false },
    { id: 'b', name: 'Ben', email: 'b@databeat.io', firstSeen: now - 60 * DAY, lastSeen: now - 50 * DAY, deleted: true, deletedAt: now - 10 * DAY },
    { id: 'c', name: 'Cy', email: 'c@databeat.io', firstSeen: now - 5 * DAY, lastSeen: now - 2 * DAY }, // legacy record, no deleted field
  ];
  const responses = [{ uid: 'a', submitted: true }, { uid: 'a', submitted: true }, { uid: 'a', submitted: false }, { uid: 'b', submitted: true }];

  it('totals count unique sign-ins, active, deleted and last-30-day sign-ins', () => {
    const csv = buildUsersCsv(users, responses, now);
    expect(csv).toContain('Total unique sign-ins,3');
    expect(csv).toContain('Active,2');
    expect(csv).toContain('Deleted (profile removed; history kept),1');
    expect(csv).toContain('Signed in within the last 30 days,2');
  });
  it('shows every user with status, timestamps and submitted quiz count', () => {
    const csv = buildUsersCsv(users, responses, now);
    expect(csv).toMatch(/Ben,b@databeat\.io,Deleted,/);
    expect(csv).toMatch(/Ann,a@databeat\.io,Active,/);
    expect(csv).toMatch(/Ann[^\n]*,2\r?\n?$|Ann[^\n]*,2\r\n/);
    expect(csv).toContain('name,email,status,first_sign_in_ist,last_sign_in_ist,deleted_at_ist,quizzes_taken');
  });
  it('legacy records without a deleted field count as Active', () => {
    expect(buildUsersCsv(users, responses, now)).toMatch(/Cy,c@databeat\.io,Active/);
  });
  it('writes timestamps in IST, not UTC', () => {
    // 12:00 UTC on 23 Oct is 17:30 IST
    expect(istStamp(Date.UTC(2026, 9, 23, 12, 0))).toBe('2026-10-23 17:30');
    expect(istStamp(0)).toBe('');
  });
  it('summary counts match the export', () => {
    expect(usersSummary(users, now)).toEqual({ total: 3, active: 2, deleted: 1, recent30: 2 });
  });
});

describe('archived quizzes are left out of points, rounds, average and streak', () => {
  const history = { a: { score: 6, max: 10 }, b: { score: 8, max: 10 }, test: { score: 10, max: 10 } };
  it('without a live list, everything counts (old behavior)', () => {
    const s = summarize(history, ['a', 'b', 'test']);
    expect(s.points).toBe(24); expect(s.rounds).toBe(3);
  });
  it('with a live list, an archived test quiz does not count', () => {
    const s = summarize(history, ['a', 'b'], ['a', 'b']);
    expect(s.points).toBe(14); expect(s.rounds).toBe(2); expect(s.avg).toBe(7); expect(s.streak).toBe(2);
  });
  it('an archived quiz in the middle does not break or add to the streak', () => {
    const s = summarize(history, ['a', 'b'], ['a', 'b']);
    expect(s.streak).toBe(2);
    const s2 = summarize({ a: { score: 5 } }, ['a', 'b'], ['a', 'b']); // missed the latest live quiz
    expect(s2.streak).toBe(0);
  });
});
