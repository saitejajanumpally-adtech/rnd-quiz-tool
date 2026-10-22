import { allQuestions } from './quizModel.js';
import { parseCsv, toCsv } from './csv.js';
import { isAnswered } from './scoring.js';
import { stripRich } from './richtext.js';

// What each column in the scoring file is for. Shown in the app and written into the file.
export const SCORING_COLUMNS = [
  { name: 'key', who: 'Do not change', need: 'Required', what: 'Identifies the person and the question. If it changes, the row can’t be matched.' },
  { name: 'question_id', who: 'Do not change', need: 'Read only', what: 'The question’s id.' },
  { name: 'question', who: 'Do not change', need: 'Read only', what: 'The question text.' },
  { name: 'max_points', who: 'Do not change', need: 'Read only', what: 'The most this answer can score.' },
  { name: 'rubric', who: 'Do not change', need: 'Read only', what: 'The scoring rubric you wrote for this question.' },
  { name: 'strong_answer', who: 'Do not change', need: 'Read only', what: 'What a strong answer covers, if you wrote it.' },
  { name: 'answer', who: 'Do not change', need: 'Read only', what: 'What the participant wrote.' },
  { name: 'score', who: 'You', need: 'Required', what: 'From 0 up to max_points, in steps of 0.5.' },
  { name: 'feedback', who: 'You', need: 'Optional', what: 'Shown to the participant with their score. One or two kind, specific sentences.' },
  { name: 'flag', who: 'You', need: 'Optional', what: 'Type yes to mark an answer for a second look before release.' }
];
const HEADER = SCORING_COLUMNS.map((c) => c.name);
const INSTRUCTIONS = [
  '# SCORING INSTRUCTIONS',
  '# 1. For every row, score the "answer" against the "rubric" in the same row. Score the quality of the reasoning, not whether the person agrees with any view.',
  '# 2. Fill in only the score, feedback and flag columns. Do not change, add or remove any other column or row.',
  '# 3. score: from 0 up to max_points, in steps of 0.5. feedback: one or two kind, specific sentences written to the participant. flag: yes when the answer is borderline, off-topic or you are unsure.',
  '# 4. Keep the header row and the CSV format. Wrap any text that contains commas in double quotes.'
];
export const CLAUDE_MESSAGE = 'Here is a CSV of written quiz answers. Follow the instructions in the comment lines at the top and the rubric on each row. Return the complete CSV with the score, feedback and flag columns filled in. Keep every other column exactly as it is, and use scores in steps of 0.5.';

// CSV of written answers for scoring outside the tool (for example in Claude). One self-contained file: rubric included.
export function buildWrittenExport(quiz, responses, autoSubmit, key = {}) {
  const qs = allQuestions(quiz).filter((q) => q.type === 'text');
  const rows = [HEADER]; const keys = {};
  responses.forEach((r) => {
    if (!(r.submitted || autoSubmit)) return;
    qs.forEach((q) => {
      const a = (r.answers || {})[q.id];
      if (!isAnswered(a)) return;
      const k = `${r.uid}~${q.id}`; keys[k] = { uid: r.uid, qid: q.id, max: Number(q.points) || 0 };
      const kk = ((key && key.answers) || {})[q.id] || {};
      rows.push([k, q.id, stripRich(q.text + (q.ask ? ' ' + q.ask : '')), q.points, kk.rubric || '', stripRich(kk.strong || ''), a, '', '', '']);
    });
  });
  return { csv: INSTRUCTIONS.join('\r\n') + '\r\n' + toCsv(rows), keys, count: rows.length - 1 };
}

// Kept for the "Copy instructions" button.
export const buildPrompt = () => CLAUDE_MESSAGE;

const half = (n) => Math.round(n * 2) / 2;
// Validates an uploaded scoring file against the export. Plain-language problems, with line numbers.
export function parseWrittenUpload(text, keys, opts = {}) {
  const clean = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/); while (clean.length && /^\s*#/.test(clean[0])) clean.shift();
  const grid = parseCsv(clean.join('\n'));
  const errors = []; const ok = []; const seen = new Set(); let stepIssues = 0; let flagged = 0; const all = Object.keys(keys);
  if (!grid.length) return { ok, errors: ['The file is empty. Use the file you exported and fill in the score, feedback and flag columns.'], missing: all, flagged: 0, stepIssues: 0 };
  const head = grid[0].map((h) => String(h).trim().toLowerCase()); const col = (n) => head.indexOf(n);
  if (col('key') < 0 || col('score') < 0) return { ok, errors: [`The header row needs at least the columns key and score. This file has: ${head.filter(Boolean).join(', ') || 'no header'}. Use the exported file and only fill in the last three columns.`], missing: all, flagged: 0, stepIssues: 0 };
  grid.slice(1).forEach((cells, i) => {
    const line = i + 2; const get = (n) => (col(n) >= 0 ? String(cells[col(n)] ?? '').trim() : '');
    if (cells.length > head.length && cells.slice(head.length).some((c) => String(c).trim())) { errors.push(`Line ${line}: this row has ${cells.length} columns but the header has ${head.length}. A comma inside the feedback probably split it. Wrap text that contains commas in double quotes, then upload again.`); return; }
    const k = get('key'); const meta = keys[k];
    if (!meta) { errors.push(cells.some((c) => keys[String(c).trim()]) ? `Line ${line}: the columns look shifted, so the key isn’t where it should be. Wrap text that contains commas in double quotes, then upload again.` : `Line ${line}: this row doesn’t match any answer in the export. Keep the key column exactly as exported.`); return; }
    if (seen.has(k)) { errors.push(`Line ${line}: this answer appears twice. Keep one row for each.`); return; }
    seen.add(k);
    const raw = get('score'); let s = Number(raw);
    if (raw === '' || Number.isNaN(s)) { errors.push(`Line ${line}: the score “${raw}” isn’t a number. Use a number such as 1 or 1.5.`); return; }
    if (s < 0) { errors.push(`Line ${line}: the score ${s} is below 0.`); return; }
    if (s > meta.max) { errors.push(`Line ${line}: the score ${s} is above the maximum of ${meta.max} for this question.`); return; }
    if (Math.abs(s * 2 - Math.round(s * 2)) > 1e-9) {
      if (opts.roundHalf) s = Math.min(meta.max, half(s));
      else { stepIssues++; errors.push(`Line ${line}: the score ${s} isn’t in steps of 0.5. Use ${Math.floor(s * 2) / 2} or ${Math.ceil(s * 2) / 2}.`); return; }
    }
    const flag = /^(y|yes|true|1)$/i.test(get('flag')); if (flag) flagged++;
    ok.push({ uid: meta.uid, qid: meta.qid, score: s, feedback: get('feedback').slice(0, 600), flag });
  });
  return { ok, errors, missing: all.filter((k) => !seen.has(k)), flagged, stepIssues };
}
