import { describe, it, expect, beforeEach } from 'vitest';
import * as ops from '../src/lib/ops.js';
import { store } from '../src/lib/store.js';
import { parseRich, stripRich, applyFormat, safeUrl } from '../src/lib/richtext.js';
import { newQuiz, newQuestion, toDocs, fromDocs, validate, allQuestions, ownerLabel, nameFromEmail } from '../src/lib/quizModel.js';
import { gradeQuiz, applyMovement, topRows } from '../src/lib/scoring.js';
import { buildWrittenExport, parseWrittenUpload } from '../src/lib/written.js';

const admin = { uid: 'u_admin', email: 'saiteja.janumpally@databeat.io', name: 'Sai Teja' };
const creator = { uid: 'u_creator', email: 'creator@databeat.io', name: 'Charan' };

describe('rich text', () => {
  it('parses bold, italic, links and bullets without producing HTML', () => {
    const b = parseRich('Is this **bold** or *italic*? See [docs](https://example.com/a).\n- one\n- two');
    expect(b[0].type).toBe('line'); expect(b[1].type).toBe('ul'); expect(b[1].items.length).toBe(2);
    const kinds = b[0].c.map((n) => n.t); expect(kinds).toContain('b'); expect(kinds).toContain('i'); expect(kinds).toContain('a');
  });
  it('leaves ordinary text alone, including lone asterisks', () => {
    expect(stripRich('5 * 3 = 15 and *')).toBe('5 * 3 = 15 and *');
    expect(stripRich('Plain question?')).toBe('Plain question?');
  });
  it('only allows http and https links', () => {
    const n = parseRich('[x](javascript:alert(1)) [y](https://ok.com)')[0].c;
    expect(n.filter((x) => x.t === 'a').map((x) => x.href)).toEqual(['https://ok.com']);
    expect(safeUrl('javascript:alert(1)')).toBeNull(); expect(safeUrl('https://a.com/x')).toBe('https://a.com/x');
  });
  it('strips markers for exports', () => {
    expect(stripRich('**A** and *b*\n- x\n- y')).toBe('A and b\n• x\n• y');
    expect(stripRich('[docs](https://e.com)')).toBe('docs (https://e.com)');
  });
  it('wraps the selected text for the toolbar buttons', () => {
    expect(applyFormat('hello world', 6, 11, 'bold').value).toBe('hello **world**');
    expect(applyFormat('hello world', 0, 5, 'italic').value).toBe('*hello* world');
    expect(applyFormat('a\nb', 0, 3, 'bullet').value).toBe('- a\n- b');
    expect(applyFormat('see here', 4, 8, 'link', 'https://x.com').value).toBe('see [here](https://x.com)');
  });
  it('supports underline and strikethrough, parsed and wrapped the same way as bold/italic', () => {
    expect(applyFormat('hello world', 6, 11, 'underline').value).toBe('hello ++world++');
    expect(applyFormat('hello world', 6, 11, 'strike').value).toBe('hello ~~world~~');
    const kinds = parseRich('This is ++underlined++ and ~~struck~~.')[0].c.map((n) => n.t);
    expect(kinds).toContain('u'); expect(kinds).toContain('s');
    expect(stripRich('++underlined++ and ~~struck~~')).toBe('underlined and struck');
  });
  it('clear formatting strips markers from just the selected text', () => {
    const value = '**bold** plain *italic*';
    const r = applyFormat(value, 0, 8, 'clear'); // selects "**bold**"
    expect(r.value).toBe('bold plain *italic*');
  });
});

describe('quiz model: required questions, optional sections, owner names', () => {
  it('a new quiz starts empty with no sections, and uses the admin defaults', () => {
    const a = newQuiz({ opens: 1, closes: 2, keyAt: 3 }, 'c@databeat.io', { autoSubmit: false, allowReviewRequests: false }, 'Charan');
    expect(a.sections.length).toBe(1); expect(a.sections[0].flat).toBe(true); expect(a.sections[0].questions).toEqual([]);
    expect(a.autoSubmit).toBe(false); expect(a.allowReviewRequests).toBe(false); expect(a.ownerName).toBe('Charan');
    expect(newQuiz({}, 'c@d.io', { autoSubmit: true }).autoSubmit).toBe(true);
  });
  it('validates a flat quiz without asking for a section title', () => {
    const a = newQuiz({ opens: 1000, closes: 2000, keyAt: 3000 }, 'c@databeat.io'); a.title = 'T';
    expect(validate(a)).toContain('Add at least one question.');
    a.sections[0].questions = [{ ...newQuestion('mcq', 'm1'), text: 'Q?', options: ['a', 'b'], correct: 0 }];
    expect(validate(a)).toEqual([]);
    a.sections[0].questions[0].text = ''; expect(validate(a)[0]).toBe('Question 1: add the question text.');
  });
  it('keeps the flat flag, required flag and owner name through save and load', () => {
    const a = newQuiz({ opens: 1000, closes: 2000, keyAt: 3000 }, 'c@databeat.io', {}, 'Charan'); a.title = 'T';
    a.sections[0].questions = [{ ...newQuestion('tf', 't1'), text: 'True?', required: true }];
    const { quiz, key } = toDocs(a); expect(quiz.sections[0].flat).toBe(true); expect(quiz.sections[0].questions[0].required).toBe(true);
    const back = fromDocs('z', quiz, key); expect(back.sections[0].flat).toBe(true); expect(back.sections[0].questions[0].required).toBe(true); expect(back.ownerName).toBe('Charan');
    expect(allQuestions(quiz)[0].sectionTitle).toBe('');
  });
  it('shows a readable creator name, even for quizzes saved before names existed', () => {
    expect(ownerLabel({ ownerName: 'Charan', ownerEmail: 'x@y.io' })).toBe('Charan');
    expect(ownerLabel({ ownerEmail: 'saiteja.janumpally@databeat.io' })).toBe('Saiteja Janumpally');
    expect(nameFromEmail('creator@databeat.io')).toBe('Creator');
  });
  it('old quizzes without the new fields still load', () => {
    const old = { title: 'Old', opens: 1, closes: 2, keyAt: 3, ownerEmail: 'o@d.io', editors: [], sections: [{ id: 's1', title: 'MC', questions: [{ id: 'q1', type: 'tf', text: 'x', ask: '', points: 1 }] }] };
    const back = fromDocs('z', old, { answers: { q1: { correct: true, explanation: '' } } });
    expect(back.sections[0].flat).toBe(false); expect(back.sections[0].questions[0].required).toBe(false); expect(validate({ ...back, title: 'Old' })).toEqual([]);
  });
});

describe('scoring: required answers and rank movement', () => {
  const quiz = { sections: [{ id: 's1', title: 'A', flat: false, questions: [{ id: 'q1', type: 'tf', points: 1, required: true }, { id: 'q2', type: 'tf', points: 1, required: false }] }] };
  const key = { answers: { q1: { correct: true }, q2: { correct: true } } };
  it('counts required questions left blank on each row', () => {
    const g = gradeQuiz({ quiz, key, responses: [{ uid: 'a', submitted: true, answers: { q2: true } }, { uid: 'b', submitted: true, answers: { q1: true, q2: true } }], autoSubmit: false });
    expect(g.rows.find((r) => r.uid === 'a').missingRequired).toBe(1); expect(g.rows.find((r) => r.uid === 'b').missingRequired).toBe(0);
  });
  it('gives a flat quiz a readable section title', () => {
    const flatQuiz = { sections: [{ id: 's1', title: '', flat: true, questions: quiz.sections[0].questions }] };
    expect(gradeQuiz({ quiz: flatQuiz, key, responses: [{ uid: 'a', submitted: true, answers: { q1: true } }] }).rows[0].sections[0].title).toBe('All questions');
  });
  it('computes places moved against the previous round', () => {
    const rows = [{ uid: 'a', rank: 1, total: 9 }, { uid: 'b', rank: 2, total: 8 }, { uid: 'c', rank: 3, total: 7 }, { uid: 'd', rank: 3, total: 7 }];
    const prev = { rows: [{ uid: 'a', rank: 4, total: 5 }, { uid: 'b', rank: 2, total: 8 }, { uid: 'c', rank: 1, total: 9 }] };
    const m = applyMovement(rows, prev);
    expect(rows.map((r) => r.move)).toEqual([3, 0, -2, null]); expect(m).toEqual({ prevCount: 3, comparable: 3 });
    expect(topRows(rows)[0]).toMatchObject({ uid: 'a', move: 3, prevRank: 4 });
  });
  it('shows nothing to compare when there is no previous round', () => {
    const rows = [{ uid: 'a', rank: 1, total: 9 }]; const m = applyMovement(rows, null);
    expect(rows[0].move).toBeNull(); expect(m.prevCount).toBe(0);
  });
});

describe('written scoring file', () => {
  const quiz = { sections: [{ id: 's1', title: 'O', questions: [{ id: 't1', type: 'text', text: 'Is **70%** healthy?', ask: 'Explain.', points: 2 }] }] };
  const key = { answers: { t1: { rubric: 'Score 0 to 2.', strong: 'Names concentration risk.' } } };
  const ex = buildWrittenExport(quiz, [{ uid: 'a', submitted: true, answers: { t1: 'No, because of risk, and more.' } }], false, key);
  it('puts the instructions, rubric and an empty score column in the export', () => {
    expect(ex.csv).toMatch(/^# SCORING INSTRUCTIONS/); expect(ex.csv).toContain('key,question_id,question,max_points,rubric,strong_answer,answer,score,feedback,flag');
    expect(ex.csv).toContain('Score 0 to 2.'); expect(ex.csv).toContain('Is 70% healthy? Explain.'); expect(ex.csv).not.toMatch(/@/); // no email addresses are sent out
    expect(ex.count).toBe(1);
  });
  it('reads the exported file back after only the last three columns are filled in', () => {
    const filled = ex.csv.replace(/,,,\r?\n?$/, ',1.5,"Clear, and specific.",yes\r\n').replace(/"No, because of risk, and more.",,,/, '"No, because of risk, and more.",1.5,"Clear, and specific.",yes');
    const up = parseWrittenUpload(filled, ex.keys); expect(up.errors).toEqual([]); expect(up.ok[0]).toMatchObject({ uid: 'a', qid: 't1', score: 1.5, flag: true, feedback: 'Clear, and specific.' });
  });
  it('accepts columns in a different order', () => {
    expect(parseWrittenUpload('score,key,feedback\n1,a~t1,ok\n', ex.keys).ok.length).toBe(1);
  });
  it('explains a row that a comma split, in plain words', () => {
    const e = parseWrittenUpload('key,score,feedback,flag\na~t1,1,Good, but short,no\n', ex.keys).errors[0];
    expect(e).toMatch(/Line 2: this row has 5 columns but the header has 4/); expect(e).toMatch(/double quotes/);
  });
  it('explains the half-point rule and can round for you', () => {
    const r = parseWrittenUpload('key,score\na~t1,0.75\n', ex.keys); expect(r.errors[0]).toMatch(/isn’t in steps of 0.5. Use 0.5 or 1/); expect(r.stepIssues).toBe(1);
    const r2 = parseWrittenUpload('key,score\na~t1,0.75\n', ex.keys, { roundHalf: true }); expect(r2.errors).toEqual([]); expect(r2.ok[0].score).toBe(1);
  });
  it('flags a missing key, a duplicate and a blank score', () => {
    expect(parseWrittenUpload('key,score\nzz,1\n', ex.keys).errors[0]).toMatch(/doesn’t match any answer/);
    expect(parseWrittenUpload('key,score\na~t1,1\na~t1,1\n', ex.keys).errors[0]).toMatch(/appears twice/);
    expect(parseWrittenUpload('key,score\na~t1,\n', ex.keys).errors[0]).toMatch(/isn’t a number/);
    expect(parseWrittenUpload('', ex.keys).errors[0]).toMatch(/empty/);
  });
});

describe('data layer: movement at scoring time, removed profiles, users export data', () => {
  beforeEach(async () => { await store.ready; await store.reset(); });
  it('stores movement against the previous round when scores are calculated', async () => {
    const now = Date.now(); const idx = await ops.loadIndex(); const prevId = 'z_oct1';
    const prevRows = (await store.get('resultsFull/' + prevId)).rows;
    const a = newQuiz({ opens: now - 1000, closes: now + 5000, keyAt: now + 9000 }, creator.email, {}, 'Charan'); a.id = 'z_next'; a.title = 'Next';
    a.sections = [{ id: 's1', title: 'All', questions: [{ ...newQuestion('mcq', 'm1'), text: 'M?', options: ['a', 'b'], correct: 1 }] }];
    expect(Object.keys(idx)).toContain(prevId);
    await ops.saveQuiz(a, creator, { publish: true });
    const people = prevRows.slice(0, 3);
    await Promise.all(people.map((p, i) => store.set(`responses/z_next_${p.uid}`, { quizId: 'z_next', uid: p.uid, name: p.name, email: p.email, answers: { m1: i === 0 ? 0 : 1 }, submitted: true })));
    await store.update('quizzes/z_next', { opens: now - 999999, closes: now - 1 }); await ops.patchIndex('z_next', { opens: now + 1, closes: now + 2 });
    const r = await ops.calculate('z_next', admin);
    expect(r.count).toBe(3);
    const pub = await store.get('resultsPublic/z_next'); expect(pub.prevCount).toBeGreaterThan(0);
    const full = await store.get('resultsFull/z_next'); const first = full.rows.find((x) => x.uid === people[1].uid);
    const before = prevRows.find((x) => x.uid === people[1].uid);
    expect(first.prevRank).toBe(before.rank); expect(first.move).toBe(before.rank - first.rank);
    const mine = await store.get(`myResults/z_next_${people[1].uid}`); expect(mine.prevRank).toBe(before.rank); expect(mine.prevCount).toBe(prevRows.length);
  });
  it('marks a removed profile in a small public list, and clears it on sign-in', async () => {
    const p = { uid: 'pp', email: 'pp@databeat.io', name: 'PP' };
    await ops.ensureUser(p); expect((await ops.loadRemoved()).has('pp')).toBe(false);
    await ops.removeMyProfile(p); expect((await ops.loadRemoved()).has('pp')).toBe(true);
    expect((await store.get('users/pp')).deleted).toBe(true);
    await ops.ensureUser(p); expect((await ops.loadRemoved()).has('pp')).toBe(false); expect((await store.get('users/pp')).deleted).toBe(false);
  });
  it('counts quizzes taken from the released results', async () => {
    const d = await ops.usersExportData(await ops.loadIndex());
    expect(d.users.length).toBeGreaterThan(20); expect(d.responses.length).toBeGreaterThan(20);
  });
  it('loads settings with the new defaults filled in', async () => {
    await store.set('settings/app', { leaderboardVisibility: 'everyone' });
    const s = await ops.loadSettings(); expect(s.showMovement).toBe(true); expect(s.newQuizDefaults).toEqual({ autoSubmit: false, allowReviewRequests: false }); expect(s.emails.closingReminder).toBe(true);
  });
});
