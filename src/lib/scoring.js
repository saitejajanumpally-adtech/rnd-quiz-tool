import { allQuestions } from './quizModel.js';
export const round05 = (x) => Math.round(x * 2) / 2;
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function isAnswered(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true; // numbers (including 0) and booleans
}
export const hasAnyAnswer = (answers) => !!answers && Object.values(answers).some(isAnswered);
export const answeredCount = (quiz, answers) => allQuestions(quiz).filter((q) => isAnswered((answers || {})[q.id])).length;

// score for auto-marked question types; returns a number
export function scoreAuto(q, k, ans) {
  const pts = Number(q.points) || 0;
  if (!k || !isAnswered(ans)) return 0;
  // Negative marking is opt-in per question (Editor, under Points) and off by default: a wrong answer
  // simply scores 0 unless the creator turned it on and set how many points a wrong answer costs.
  const penalty = k.negativeMarking ? Math.max(0, Number(k.penalty) || 0) : 0;
  switch (q.type) {
    case 'mcq': case 'picture': return clamp(ans === k.correct ? pts : -penalty, 0, pts);
    case 'tf': return clamp(ans === k.correct ? pts : -penalty, 0, pts);
    case 'multi': {
      const cor = k.correct || []; const sel = Array.isArray(ans) ? ans : [];
      const right = sel.filter((x) => cor.includes(x)).length; const wrong = sel.length - right;
      if (k.partial === false) return right === cor.length && wrong === 0 ? pts : 0;
      const creditPerRight = pts / (cor.length || 1);
      return round05(clamp(right * creditPerRight - wrong * penalty, 0, pts));
    }
    case 'order': { const c = k.correct || []; return Array.isArray(ans) && ans.length === c.length && ans.every((v, i) => v === c[i]) ? pts : 0; }
    case 'match': {
      const c = k.correct || {}; const keys = Object.keys(c); if (!keys.length) return 0;
      const hit = keys.filter((i) => Number(ans[i]) === c[i]).length;
      if (k.partial === false) return hit === keys.length ? pts : 0;
      return round05((hit / keys.length) * pts);
    }
    default: return 0;
  }
}

// The Top 10 everyone can see. Movement (move) is filled in by applyMovement.
export const topRows = (rows) => rows.filter((r) => r.rank <= 10).slice(0, 15).map((r) => ({ rank: r.rank, uid: r.uid, name: r.name, total: r.total, move: r.move === undefined ? null : r.move, prevRank: r.prevRank === undefined ? null : r.prevRank }));
// Compares this round's ranks with the previous round's rows. move > 0 means the person moved up that many places.
export function applyMovement(rows, prev) {
  const before = new Map(((prev && prev.rows) || []).map((r) => [r.uid, r]));
  rows.forEach((r) => { const p = before.get(r.uid); r.prevRank = p ? p.rank : null; r.prevTotal = p ? p.total : null; r.move = p ? p.rank - r.rank : null; });
  return { prevCount: before.size, comparable: rows.filter((r) => before.has(r.uid)).length };
}

// responses: [{uid,name,email,answers,submitted,auto?}]  written: { qid: { uid: {score,feedback} } }
export function gradeQuiz({ quiz, key, responses, written = {}, autoSubmit }) {
  const qs = allQuestions(quiz);
  const secMax = quiz.sections.map((s) => s.questions.reduce((a, q) => a + (Number(q.points) || 0), 0));
  const max = secMax.reduce((a, b) => a + b, 0);
  let unscoredWritten = 0;
  const rows = [];
  responses.forEach((r) => {
    const counts = r.submitted || (autoSubmit && hasAnyAnswer(r.answers));
    if (!counts) return;
    const secScore = quiz.sections.map(() => 0); const per = {};
    qs.forEach((q) => {
      let score = 0; let feedback = ''; let pending = false;
      if (q.type === 'text') {
        const w = (written[q.id] || {})[r.uid];
        if (w) { score = clamp(round05(Number(w.score) || 0), 0, Number(q.points) || 0); feedback = w.feedback || ''; }
        else if (isAnswered((r.answers || {})[q.id])) { pending = true; unscoredWritten++; }
      } else score = scoreAuto(q, ((key.answers || {})[q.id]), (r.answers || {})[q.id]);
      secScore[q.sectionIndex] += score;
      per[q.id] = { score, max: Number(q.points) || 0, feedback, pending };
    });
    const total = round05(secScore.reduce((a, b) => a + b, 0));
    const missingRequired = qs.filter((q) => q.required && !isAnswered((r.answers || {})[q.id])).length;
    rows.push({ uid: r.uid, name: r.name || r.email, email: r.email, total, max, auto: !!r.auto || !r.submitted, missingRequired, sections: quiz.sections.map((s, i) => ({ title: s.flat ? 'All questions' : s.title, score: round05(secScore[i]), max: secMax[i] })), questions: per });
  });
  rows.sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1; });
  const avg = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0;
  const pub = { count: rows.length, avg: Math.round(avg * 100) / 100, max, top: topRows(rows) };
  return { rows, pub, unscoredWritten };
}
