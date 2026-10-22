import { allQuestions } from './quizModel.js';
import { parseCsv, toCsv, toObjects } from './csv.js';
import { isAnswered } from './scoring.js';

// CSV of written answers for scoring outside the tool (for example in Claude)
export function buildWrittenExport(quiz, responses, autoSubmit) {
  const qs = allQuestions(quiz).filter((q) => q.type === 'text');
  const rows = [['key', 'email', 'question_id', 'question', 'max_points', 'answer']];
  const keys = {};
  responses.forEach((r) => {
    if (!(r.submitted || autoSubmit)) return;
    qs.forEach((q) => {
      const a = (r.answers || {})[q.id];
      if (!isAnswered(a)) return;
      const k = `${r.uid}~${q.id}`; keys[k] = { uid: r.uid, qid: q.id, max: Number(q.points) || 0 };
      rows.push([k, r.email, q.id, q.text + (q.ask ? ' ' + q.ask : ''), q.points, a]);
    });
  });
  return { csv: toCsv(rows), keys, count: rows.length - 1 };
}

export function buildPrompt(quiz, key, quizTitle) {
  const qs = allQuestions(quiz).filter((q) => q.type === 'text');
  const parts = qs.map((q) => `QUESTION ${q.id}\n${q.text}\n${q.ask || ''}\nMaximum points: ${q.points}\nRubric: ${((key.answers || {})[q.id] || {}).rubric || ''}\nA strong answer covers: ${((key.answers || {})[q.id] || {}).strong || ''}`);
  return `You are scoring written answers for the quiz "${quizTitle}".\n\nI will give you a CSV with columns: key, email, question_id, question, max_points, answer.\nScore every row against the rubric for its question_id. Scores go in steps of 0.5, from 0 up to max_points.\nScore the quality of the reasoning, not whether the person agrees with any view.\n\n${parts.join('\n\n---\n\n')}\n\nReturn ONLY a CSV with the header: key,score,feedback,flag\n- one row for every input row, keeping the key unchanged\n- feedback: one or two kind, specific sentences written to the participant\n- flag: "yes" when the answer is borderline, off-topic, or you are unsure; otherwise leave empty\nDo not add any other text.`;
}

// validates an uploaded scoring CSV against the exported keys
export function parseWrittenUpload(text, keys) {
  const rows = toObjects(parseCsv(text));
  const errors = []; const ok = []; const seen = new Set();
  if (!rows.length) return { ok, errors: ['The file is empty or has no header row. Expected: key,score,feedback,flag'], missing: Object.keys(keys), flagged: 0 };
  if (!('key' in rows[0]) || !('score' in rows[0])) return { ok, errors: ['The header must include key and score. Expected: key,score,feedback,flag'], missing: Object.keys(keys), flagged: 0 };
  let flagged = 0;
  rows.forEach((r, i) => {
    const line = i + 2; const meta = keys[r.key];
    if (!meta) { errors.push(`Line ${line}: key "${r.key}" is not in the export.`); return; }
    if (seen.has(r.key)) { errors.push(`Line ${line}: key "${r.key}" appears twice.`); return; }
    seen.add(r.key);
    const s = Number(r.score);
    if (r.score === '' || Number.isNaN(s)) { errors.push(`Line ${line}: score "${r.score}" is not a number.`); return; }
    if (s < 0 || s > meta.max) { errors.push(`Line ${line}: score ${s} is outside 0 to ${meta.max}.`); return; }
    if (Math.abs(s * 2 - Math.round(s * 2)) > 1e-9) { errors.push(`Line ${line}: score ${s} is not in steps of 0.5.`); return; }
    const flag = /^(y|yes|true|1)$/i.test(r.flag || ''); if (flag) flagged++;
    ok.push({ uid: meta.uid, qid: meta.qid, score: s, feedback: (r.feedback || '').slice(0, 600), flag });
  });
  const missing = Object.keys(keys).filter((k) => !seen.has(k));
  return { ok, errors, missing, flagged };
}
