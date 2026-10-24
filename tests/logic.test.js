import { describe, it, expect } from 'vitest';
import { fromIst, istParts, suggestSchedule, nextTuesdayAfter, rangeStart, fmtRange, fmtDateTime, toInputValue, fromInputValue, DAY } from '../src/lib/time.js';
import { stageFor, summarize, DEFAULT_THRESHOLDS } from '../src/lib/stages.js';
import { parseCsv, toCsv, toObjects } from '../src/lib/csv.js';
import { newQuiz, newQuestion, toDocs, fromDocs, validate, questionErrors, quizStatus, fillTemplate, maxScore, permutation } from '../src/lib/quizModel.js';
import { scoreAuto, gradeQuiz, isAnswered } from '../src/lib/scoring.js';
import { buildWrittenExport, parseWrittenUpload } from '../src/lib/written.js';

describe('time', () => {
  it('suggests the next second Tuesday with Thursday close and Saturday key', () => {
    const last = fromIst(2026, 9, 20, 10, 0); // Tue 20 Oct 2026
    const now = fromIst(2026, 9, 22, 12, 0);
    const s = suggestSchedule({ a: { opens: last } }, now);
    expect(istParts(s.opens)).toMatchObject({ y: 2026, m: 10, d: 3, wd: 2, h: 10 });
    expect(istParts(s.closes)).toMatchObject({ d: 5, wd: 4, h: 23, min: 59 });
    expect(istParts(s.keyAt)).toMatchObject({ d: 7, wd: 6, h: 1 });
  });
  it('falls back to next Tuesday when nothing exists', () => {
    const now = fromIst(2026, 9, 22, 12, 0); // Thursday
    expect(istParts(nextTuesdayAfter(now))).toMatchObject({ d: 27, wd: 2 });
  });
  it('calendar quarter and 6 month starts', () => {
    const now = fromIst(2026, 9, 22, 12, 0);
    expect(rangeStart('quarter', now)).toBe(fromIst(2026, 9, 1));
    expect(istParts(rangeStart('m6', now))).toMatchObject({ y: 2026, m: 3, d: 22 });
    expect(rangeStart('all', now)).toBe(0);
  });
  it('formats ranges and round-trips input values', () => {
    expect(fmtRange(fromIst(2026, 9, 20, 10), fromIst(2026, 9, 22, 23, 59))).toBe('Oct 20 to 22');
    expect(fmtRange(fromIst(2026, 5, 30, 10), fromIst(2026, 6, 2, 23, 59))).toBe('Jun 30 to Jul 2');
    const ms = fromIst(2026, 10, 3, 10, 0);
    expect(fromInputValue(toInputValue(ms))).toBe(ms);
    expect(fmtDateTime(ms)).toBe('Tue 3 Nov, 10:00 AM IST');
  });
});

describe('stages', () => {
  it('maps points to funnel stages', () => {
    expect(stageFor(0).name).toBe('Ad request');
    expect(stageFor(20).name).toBe('Bid');
    expect(stageFor(49.5).name).toBe('Bid');
    expect(stageFor(50).name).toBe('Win');
    expect(stageFor(60).toNext).toBe(40);
    expect(stageFor(500).name).toBe('Conversion');
    expect(stageFor(500).pct).toBe(1);
  });
  it('computes streak, average and rounds', () => {
    const h = { a: { score: 7 }, b: { score: 8 }, d: { score: 6 } };
    const s = summarize(h, ['a', 'b', 'c', 'd']);
    expect(s).toMatchObject({ rounds: 3, points: 21, streak: 1 });
    expect(summarize(h, ['a', 'b', 'd']).streak).toBe(3);
    expect(summarize({}, []).avg).toBe(0);
  });
});

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [['a', 'b,c', 'd"e', 'line1\nline2']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it('parses header objects', () => { expect(toObjects(parseCsv('Email,Role\nx@y.io,Lead\n'))).toEqual([{ email: 'x@y.io', role: 'Lead' }]); });
});

function sampleAuthoring() {
  const a = newQuiz({ opens: 1000, closes: 2000, keyAt: 3000 }, 'c@databeat.io');
  a.id = 'zq'; a.title = 'Sample';
  const mk = (type, patch) => ({ ...newQuestion(type, 'q_' + type), text: type + ' question', ...patch });
  a.sections = [
    { id: 's1', title: 'Choice', questions: [mk('mcq', { options: ['A', 'B', 'C'], correct: 1 }), mk('multi', { options: ['A', 'B', 'C', 'D'], correct: [0, 2], points: 2 }), mk('tf', { correct: false }), mk('picture', { options: ['x', 'y'], correct: 0, image: 'data:image/png;base64,AA' })] },
    { id: 's2', title: 'Other', questions: [mk('text', { rubric: 'r', strong: 's' }), mk('order', { options: ['first', 'second', 'third', 'fourth'] }), mk('match', { pairs: [{ l: 'SSP', r: 'sell' }, { l: 'DSP', r: 'buy' }, { l: 'DMP', r: 'data' }] }), mk('rating')] }
  ];
  return a;
}

describe('quiz model', () => {
  it('validates and flags problems', () => {
    expect(validate(sampleAuthoring())).toEqual([]);
    const bad = sampleAuthoring(); bad.title = ''; bad.sections[0].questions[0].options[0] = '';
    expect(validate(bad).length).toBe(2);
    const t = sampleAuthoring(); t.closes = 500; expect(validate(t)[0]).toMatch(/after the open/);
  });
  it('a new MCQ/picture question has no correct answer preselected, and questionErrors catches it', () => {
    expect(newQuestion('mcq').correct).toBe(null);
    expect(newQuestion('picture').correct).toBe(null);
    expect(newQuestion('multi').correct).toEqual([]);
    const q = { ...newQuestion('mcq'), text: 'Q?', options: ['A', 'B'] };
    expect(questionErrors(q)).toContain('mark the correct answer.');
    expect(questionErrors({ ...q, correct: 0 })).not.toContain('mark the correct answer.');
  });
  it('flags duplicate option text, case- and whitespace-insensitively', () => {
    const q = { ...newQuestion('mcq'), text: 'Q?', correct: 0, options: ['Same', ' same ', 'Different'] };
    expect(questionErrors(q)).toContain('remove the duplicate option text.');
    expect(questionErrors({ ...q, options: ['A', 'B', 'C'] })).not.toContain('remove the duplicate option text.');
  });
  it('blocks publishing under a title another quiz already uses, case- and whitespace-insensitively, but allows it while otherTitles is not supplied (drafting)', () => {
    const a = sampleAuthoring(); a.title = ' Sample ';
    const others = [{ id: 'other-id', title: 'sample' }];
    expect(validate(a)).toEqual([]); // no otherTitles passed: unaffected, matches today's draft-time behavior
    expect(validate(a, others)).toContain('Another quiz already uses this name. Choose a different one.');
    expect(validate(a, [{ id: a.id, title: 'Sample' }])).toEqual([]); // matching itself doesn't count
    expect(validate(a, [{ id: 'other-id', title: 'Something else' }])).toEqual([]);
  });
  it('a new quiz has no personal time limit by default, and it round-trips through toDocs/fromDocs', () => {
    const a = sampleAuthoring(); expect(a.timeLimitMin).toBe(0);
    a.timeLimitMin = 30; const { quiz, key } = toDocs(a); expect(quiz.timeLimitMin).toBe(30);
    const back = fromDocs(a.id, quiz, key); expect(back.timeLimitMin).toBe(30);
    const none = fromDocs(a.id, { ...quiz, timeLimitMin: 0 }, key); expect(none.timeLimitMin).toBe(0);
  });
  it('removing the correct option clears the answer instead of silently falling back to another option', () => {
    // mirrors Editor.jsx's optsWithCorrect removeOption logic
    const removeOption = (q, i) => { const shift = (x) => (x > i ? x - 1 : x); return q.correct == null || q.correct === i ? null : shift(q.correct); };
    expect(removeOption({ correct: 1 }, 1)).toBe(null);
    expect(removeOption({ correct: 2 }, 0)).toBe(1);
  });
  it('round-trips a question with no correct answer set without defaulting it to option 1', () => {
    const a = sampleAuthoring(); a.sections[0].questions[0].correct = null;
    const { quiz, key } = toDocs(a); const back = fromDocs(a.id, quiz, key);
    expect(back.sections[0].questions[0].correct).toBe(null);
  });
  it('round-trips authoring -> docs -> authoring, hiding answers from the public doc', () => {
    const a = sampleAuthoring(); const { quiz, key } = toDocs(a);
    expect(JSON.stringify(quiz)).not.toMatch(/"correct"|rubric|strong|explanation/);
    const back = fromDocs('zq', quiz, key);
    expect(back.sections[1].questions[1].options).toEqual(['first', 'second', 'third', 'fourth']);
    expect(back.sections[1].questions[2].pairs).toEqual(a.sections[1].questions[2].pairs);
    expect(back.sections[0].questions[1].correct).toEqual([0, 2]);
    expect(maxScore(quiz)).toBe(14);
  });
  it('shuffles order items and keeps the same shuffle on every save', () => {
    const p1 = permutation(6, 'x:y'); expect(permutation(6, 'x:y')).toEqual(p1);
    expect(p1.every((v, i) => v === i)).toBe(false);
  });
  it('derives status and fills templates', () => {
    const it = { published: true, opens: 10, closes: 20 };
    expect(quizStatus(it, 5)).toBe('scheduled'); expect(quizStatus(it, 15)).toBe('live'); expect(quizStatus(it, 25)).toBe('closed');
    expect(quizStatus({ ...it, released: true }, 25)).toBe('released'); expect(quizStatus({ published: false }, 5)).toBe('draft');
    expect(fillTemplate('Hi {a} {b}', { a: 'x' })).toBe('Hi x {b}');
  });
});

describe('scoring', () => {
  const a = sampleAuthoring(); const { quiz, key } = toDocs(a); const q = (id) => quiz.sections.flatMap((s) => s.questions).find((x) => x.id === id);
  const k = (id) => key.answers[id];
  it('scores each auto type', () => {
    expect(scoreAuto(q('q_mcq'), k('q_mcq'), 1)).toBe(2); expect(scoreAuto(q('q_mcq'), k('q_mcq'), 0)).toBe(0);
    expect(scoreAuto(q('q_tf'), k('q_tf'), false)).toBe(2);
    expect(scoreAuto(q('q_multi'), k('q_multi'), [0, 2])).toBe(2);
    expect(scoreAuto(q('q_multi'), k('q_multi'), [0])).toBe(1);
    expect(scoreAuto(q('q_multi'), k('q_multi'), [0, 1])).toBe(1); // no negative marking by default: the wrong pick just isn't credited, it doesn't cost anything
    expect(scoreAuto(q('q_order'), k('q_order'), k('q_order').correct)).toBe(2);
    expect(scoreAuto(q('q_order'), k('q_order'), [0, 1, 2, 3])).toBe(k('q_order').correct.every((v, i) => v === i) ? 2 : 0);
    const m = k('q_match').correct;
    expect(scoreAuto(q('q_match'), k('q_match'), { ...m })).toBe(2);
    expect(scoreAuto(q('q_match'), k('q_match'), { '0': m['0'], '1': (m['1'] + 1) % 3, '2': (m['2'] + 1) % 3 })).toBe(0.5);
    expect(scoreAuto(q('q_picture'), k('q_picture'), 0)).toBe(2);
    expect(scoreAuto(q('q_mcq'), k('q_mcq'), undefined)).toBe(0);
  });
  it('only deducts points for a wrong answer when a creator turns negative marking on', () => {
    const mcqKey = { ...k('q_mcq'), negativeMarking: true, penalty: 0.5 };
    expect(scoreAuto(q('q_mcq'), mcqKey, 1)).toBe(2); // still full credit when right
    expect(scoreAuto(q('q_mcq'), mcqKey, 0)).toBe(0); // floored at 0, not -0.5, so one wrong answer can't drag the total down
    expect(scoreAuto(q('q_mcq'), k('q_mcq'), 0)).toBe(0); // off by default: same wrong answer costs nothing without it
    const multiKey = { ...k('q_multi'), negativeMarking: true, penalty: 0.5 };
    expect(scoreAuto(q('q_multi'), multiKey, [0, 1])).toBe(0.5); // 1 right (1pt) minus 1 wrong (0.5pt) = 0.5
    expect(scoreAuto(q('q_multi'), multiKey, [1])).toBe(0); // only the wrong option picked, floored at 0
  });
  const resp = (uid, answers, submitted = true) => ({ uid, name: uid, email: uid + '@databeat.io', answers, submitted });
  const good = { q_mcq: 1, q_multi: [0, 2], q_tf: false, q_picture: 0, q_text: 'long answer' };
  it('grades, ranks with ties, and respects submit and auto-submit rules', () => {
    const responses = [resp('a', good), resp('b', { ...good, q_mcq: 0 }), resp('c', { ...good, q_mcq: 0 }), resp('d', { q_mcq: 1 }, false), resp('e', {}, false)];
    const written = { q_text: { a: { score: 1.5, feedback: 'ok' }, b: { score: 1, feedback: '' } } };
    let g = gradeQuiz({ quiz, key, responses, written, autoSubmit: false });
    expect(g.rows.map((r) => r.uid)).toEqual(['a', 'b', 'c']);
    expect(g.rows[0].total).toBe(8 + 1.5); expect(g.rows[0].rank).toBe(1);
    expect(g.rows.find((r) => r.uid === 'b').total).toBe(6 + 1); expect(g.rows.find((r) => r.uid === 'c').total).toBe(6);
    expect(g.unscoredWritten).toBe(1);
    g = gradeQuiz({ quiz, key, responses, written, autoSubmit: true });
    expect(g.rows.map((r) => r.uid)).toContain('d'); expect(g.rows.map((r) => r.uid)).not.toContain('e');
    expect(g.rows.find((r) => r.uid === 'd').auto).toBe(true);
    const tie = gradeQuiz({ quiz, key, responses: [resp('x', good), resp('y', good), resp('z', { q_tf: false })], written: {}, autoSubmit: false });
    expect(tie.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(tie.pub.top.length).toBe(3); expect(isAnswered(0)).toBe(true); expect(isAnswered('  ')).toBe(false);
  });
  it('exports written answers and validates the scoring upload', () => {
    const responses = [resp('a', good), resp('b', { q_mcq: 1 })];
    const ex = buildWrittenExport(quiz, responses, false);
    expect(ex.count).toBe(1); expect(Object.keys(ex.keys)).toEqual(['a~q_text']);
    expect(parseWrittenUpload('key,score,feedback,flag\na~q_text,1.5,Good,yes\n', ex.keys)).toMatchObject({ errors: [], flagged: 1, missing: [] });
    expect(parseWrittenUpload('key,score,feedback,flag\na~q_text,3,Good,\n', ex.keys).errors[0]).toMatch(/above the maximum of 2/);
    expect(parseWrittenUpload('key,score,feedback,flag\na~q_text,1.3,,\n', ex.keys).errors[0]).toMatch(/steps of 0.5/);
    expect(parseWrittenUpload('key,score,feedback,flag\nzz~q,1,,\n', ex.keys).errors[0]).toMatch(/doesn’t match any answer/);
    expect(parseWrittenUpload('nope\n1', ex.keys).errors[0]).toMatch(/header row/);
    expect(parseWrittenUpload('key,score\n', ex.keys).missing).toEqual(['a~q_text']);
  });
});
