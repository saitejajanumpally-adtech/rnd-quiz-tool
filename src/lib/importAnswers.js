// CSV import of participant answers for a quiz that happened before it was run in this tool (or outside
// it entirely) — so a quarter's leaderboard, points and streaks stay consistent once it's backfilled.
// Supports the question types a one-off answer sheet is actually likely to have: mcq, multi, tf, picture
// and text. order and match aren't supported yet (their options are shuffled per publish, which makes a
// plain-text answer sheet ambiguous) — flagged clearly rather than silently guessed at.
import { allQuestions } from './quizModel.js';
import { parseCsv, toCsv } from './csv.js';
import { stripRich } from './richtext.js';

const UNSUPPORTED = new Set(['order', 'match', 'rating']);
const norm = (s) => String(s || '').trim().toLowerCase();

function hint(q) {
  if (q.type === 'tf') return 'Type true or false.';
  if (q.type === 'text') return 'Type what they wrote. Score it afterwards from the Release checklist, same as any written answer.';
  if (q.type === 'mcq' || q.type === 'picture') return `Type one option exactly: ${q.options.join(' | ')}`;
  if (q.type === 'multi') return `Type one or more options separated by ; — ${q.options.join(' | ')}`;
  return 'Not supported yet for import. Leave this column blank (it will score 0).';
}

// One self-contained file: a row of instructions per question, then the header, ready to fill in.
export function buildImportTemplate(quiz) {
  const qs = allQuestions(quiz).filter((q) => q.type !== 'rating');
  const instructions = [
    '# IMPORT INSTRUCTIONS',
    '# 1. One row per participant. Use the @databeat.io email they sign into the tool with — they must have signed in at least once already.',
    '# 2. Fill in every question column with what that person actually answered. Leave a cell blank if they skipped it.',
    '# 3. Do not change the header row. Keep the CSV format; wrap any text that contains commas in double quotes.',
    ...qs.map((q) => `# ${q.id}: ${hint(q)}`)
  ];
  const header = ['email', ...qs.map((q) => `${q.id}: ${stripRich(q.text).slice(0, 60)}`)];
  return instructions.join('\r\n') + '\r\n' + toCsv([header]);
}

function parseCell(q, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { ok: true, value: undefined }; // left blank: unanswered
  if (UNSUPPORTED.has(q.type)) return { ok: false, error: `${q.id} isn't supported for import yet. Leave it blank.` };
  if (q.type === 'tf') {
    if (/^(true|t|yes|y|1)$/i.test(v)) return { ok: true, value: true };
    if (/^(false|f|no|n|0)$/i.test(v)) return { ok: true, value: false };
    return { ok: false, error: `"${v}" isn't true or false for ${q.id}.` };
  }
  if (q.type === 'text') return { ok: true, value: v.slice(0, 4000) };
  if (q.type === 'mcq' || q.type === 'picture') {
    const i = q.options.findIndex((o) => norm(o) === norm(v));
    if (i < 0) return { ok: false, error: `"${v}" doesn't match any option for ${q.id}. Options: ${q.options.join(' | ')}` };
    return { ok: true, value: i };
  }
  if (q.type === 'multi') {
    const picks = v.split(';').map((s) => s.trim()).filter(Boolean);
    const idx = [];
    for (const p of picks) {
      const i = q.options.findIndex((o) => norm(o) === norm(p));
      if (i < 0) return { ok: false, error: `"${p}" doesn't match any option for ${q.id}. Options: ${q.options.join(' | ')}` };
      if (!idx.includes(i)) idx.push(i);
    }
    return { ok: true, value: idx.sort((a, b) => a - b) };
  }
  return { ok: false, error: `${q.id}'s question type isn't recognised.` };
}

// Validates an uploaded answer sheet against the quiz. Plain-language problems, with line numbers.
export function parseImportUpload(text, quiz) {
  const qs = allQuestions(quiz).filter((q) => q.type !== 'rating');
  const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
  const clean = String(text || '').replace(/^﻿/, '').split(/\r?\n/); while (clean.length && /^\s*#/.test(clean[0])) clean.shift();
  const grid = parseCsv(clean.join('\n'));
  if (!grid.length) return { rows: [], errors: ['The file is empty. Use the downloaded template and fill in a row per participant.'] };
  const head = grid[0].map((h) => String(h).trim());
  if (norm(head[0]) !== 'email') return { rows: [], errors: [`The first column must be "email". This file has: ${head[0] || '(nothing)'}.`] };
  const cols = head.slice(1).map((h) => String(h).split(':')[0].trim());
  const unknown = cols.filter((id) => !byId[id]);
  if (unknown.length) return { rows: [], errors: [`These columns don't match a question in this quiz: ${unknown.join(', ')}. Use the downloaded template instead of editing headers.`] };
  const errors = []; const rows = []; const seen = new Set();
  grid.slice(1).forEach((cells, i) => {
    const line = i + 2; const email = norm(cells[0]);
    if (!email) return; // a blank trailing row
    if (!email.includes('@')) { errors.push(`Line ${line}: "${cells[0]}" isn't an email address.`); return; }
    if (seen.has(email)) { errors.push(`Line ${line}: ${email} appears more than once.`); return; }
    seen.add(email);
    const answers = {}; let rowOk = true;
    cols.forEach((id, ci) => {
      const r = parseCell(byId[id], cells[ci + 1]);
      if (!r.ok) { errors.push(`Line ${line}, ${id}: ${r.error}`); rowOk = false; }
      else if (r.value !== undefined) answers[id] = r.value;
    });
    if (rowOk) rows.push({ email, answers });
  });
  return { rows, errors };
}
