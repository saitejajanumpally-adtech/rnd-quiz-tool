// Everything the app does with the database lives here, so screens stay simple and this can be tested.
import { store, rid } from './store.js';
import { CONFIG } from '../config.js';
import { toDocs, fromDocs, indexItem, allQuestions, hasWritten, fillTemplate } from './quizModel.js';
import { gradeQuiz, hasAnyAnswer } from './scoring.js';
import { buildWrittenExport } from './written.js';
import { toCsv } from './csv.js';
import { fmtDateTime } from './time.js';
import { DEFAULT_THRESHOLDS } from './stages.js';

export const DEFAULT_SETTINGS = { leaderboardVisibility: 'leads', thresholds: DEFAULT_THRESHOLDS, defaultMascots: ['robot'], integrations: { gas: false }, retention: 'forever', highlightDays: 5 };
export const ROLES = ['participant', 'lead', 'creator', 'admin'];
export const ROLE_LABEL = { participant: 'Participant', lead: 'Lead', creator: 'Creator', admin: 'Admin' };
export const isStaff = (role) => role === 'admin' || role === 'creator';
export const isLeadPlus = (role) => role !== 'participant';
export const canEditQuiz = (role, email, item) => role === 'admin' || (role === 'creator' && !!item && (item.ownerEmail === email || (item.editors || []).includes(email)));
const lc = (s) => String(s || '').trim().toLowerCase();

export async function getRole(user) {
  if (lc(user.email) === lc(CONFIG.bootstrapAdmin)) return 'admin';
  const r = await store.get('roles/' + lc(user.email));
  return r && ROLES.includes(r.role) ? r.role : 'participant';
}
export async function ensureUser(user) { await store.set('users/' + user.uid, { name: user.name, email: user.email, lastSeen: Date.now() }, true); }
export async function loadSettings() { const s = await store.get('settings/app'); return { ...DEFAULT_SETTINGS, ...(s || {}) }; }
export async function saveSettings(patch, user) { await store.set('settings/app', patch, true); await log(user, 'Changed settings', Object.keys(patch).join(', ')); }
export async function loadIndex() { const d = await store.get('quizIndex/main'); return (d && d.items) || {}; }
export async function patchIndex(id, patch) {
  const upd = {}; Object.entries(patch).forEach(([k, v]) => { upd[`items.${id}.${k}`] = v; });
  try { await store.update('quizIndex/main', upd); } catch (e) { await store.set('quizIndex/main', { items: { [id]: Object.fromEntries(Object.entries(patch).filter(([k]) => !k.includes('.'))) } }, true); }
}
export async function log(user, action, detail = '') {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await store.set('changeLog/' + id, { at: Date.now(), by: user.email, action, detail: String(detail).slice(0, 500) });
}
export async function loadChangeLog(max = 100) { const rows = await store.list('changeLog'); return rows.sort((a, b) => b.at - a.at).slice(0, max); }

// ---------------- taking a quiz
export async function loadQuiz(id) { return store.get('quizzes/' + id); }
export async function loadMyResponse(id, uid) { return store.get('responses/' + rid(id, uid)); }
export async function saveAnswer(user, quizId, qid, value, exists) {
  const path = 'responses/' + rid(quizId, user.uid); const now = Date.now();
  if (!exists) { await store.set(path, { quizId, uid: user.uid, email: user.email, name: user.name, answers: { [qid]: value }, submitted: false, startedAt: now, updatedAt: now }); return; }
  await store.update(path, { [`answers.${qid}`]: value, updatedAt: now });
}
export async function submitResponse(user, quizId) {
  const now = Date.now();
  await store.update('responses/' + rid(quizId, user.uid), { submitted: true, submittedAt: now, updatedAt: now });
}
export async function liveCounts(quizId) {
  const [submitted, started] = await Promise.all([store.count('responses', { where: [['quizId', '==', quizId], ['submitted', '==', true]] }), store.count('responses', { where: [['quizId', '==', quizId]] })]);
  return { submitted, started };
}

// ---------------- authoring
export async function loadAuthoring(id) {
  const [q, k] = await Promise.all([store.get('quizzes/' + id), store.get('quizKeys/' + id)]);
  return q ? fromDocs(id, q, k) : null;
}
export async function saveQuiz(a, user, { publish = false } = {}) {
  const { quiz, key } = toDocs(a);
  const existingKey = await store.get('quizKeys/' + a.id).catch(() => null);
  const existing = await store.get('quizzes/' + a.id).catch(() => null);
  const published = publish || !!(existing && existing.published);
  await store.set('quizzes/' + a.id, { ...quiz, published });
  await store.set('quizKeys/' + a.id, { ...key, released: !!(existingKey && existingKey.released) });
  const idx = (await loadIndex())[a.id] || {};
  const item = indexItem(a.id, quiz, { published, released: !!idx.released, releasedAt: idx.releasedAt || 0, ops: idx.ops || {}, submittedCount: idx.submittedCount || 0, avgScore: idx.avgScore || 0 });
  await store.set('quizIndex/main', { items: { [a.id]: item } }, true);
  await log(user, publish && !(existing && existing.published) ? 'Published quiz' : 'Saved quiz', a.title);
  return item;
}
export async function deleteDraft(id, user, title) {
  await store.del('quizzes/' + id); await store.del('quizKeys/' + id);
  const items = await loadIndex(); delete items[id]; await store.set('quizIndex/main', { items }, false);
  await log(user, 'Deleted draft', title);
}
export async function setCloses(id, ms, user, title) {
  await store.update('quizzes/' + id, { closes: ms }); await patchIndex(id, { closes: ms });
  await log(user, 'Changed close time', `${title}: ${fmtDateTime(ms)}`);
}
export async function setEditors(id, editors, user, title) {
  await store.update('quizzes/' + id, { editors }); await patchIndex(id, { editors }); await log(user, 'Changed editors', `${title}: ${editors.join(', ') || 'none'}`);
}

// ---------------- scoring and release
async function loadWritten(id, quiz) {
  const out = {};
  await Promise.all(allQuestions(quiz).filter((q) => q.type === 'text').map(async (q) => { const d = await store.get(`writtenScores/${id}_${q.id}`); out[q.id] = (d && d.scores) || {}; }));
  return out;
}
export async function calculate(id, user) {
  const [quiz, key] = await Promise.all([store.get('quizzes/' + id), store.get('quizKeys/' + id)]);
  const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  const written = await loadWritten(id, quiz);
  const g = gradeQuiz({ quiz, key, responses, written, autoSubmit: !!quiz.autoSubmit });
  const ops = [];
  const byUid = Object.fromEntries(responses.map((r) => [r.uid, r]));
  g.rows.forEach((r) => {
    ops.push({ type: 'set', path: `myResults/${id}_${r.uid}`, data: { uid: r.uid, quizId: id, total: r.total, max: r.max, rank: r.rank, count: g.rows.length, sections: r.sections, questions: r.questions, auto: r.auto } });
    ops.push({ type: 'set', merge: true, path: 'stats/' + r.uid, data: { history: { [id]: { score: r.total, max: r.max, opens: quiz.opens, title: quiz.title } } } });
    const resp = byUid[r.uid];
    if (resp && !resp.submitted && r.auto) ops.push({ type: 'update', path: `responses/${id}_${r.uid}`, data: { submitted: true, auto: true, submittedAt: quiz.closes, updatedAt: Date.now() } });
  });
  ops.push({ type: 'set', path: 'resultsPublic/' + id, data: { ...g.pub, computedAt: Date.now() } });
  ops.push({ type: 'set', path: 'resultsFull/' + id, data: { rows: g.rows.map((r) => ({ rank: r.rank, uid: r.uid, name: r.name, email: r.email, total: r.total, auto: r.auto, sections: r.sections })) } });
  await store.batch(ops);
  await patchIndex(id, { 'ops.calcAt': Date.now(), 'ops.writtenAt': g.unscoredWritten === 0 ? Date.now() : 0, submittedCount: g.rows.length, avgScore: g.pub.avg });
  await log(user, 'Calculated scores', `${quiz.title}: ${g.rows.length} participants, ${g.unscoredWritten} written answers still unscored`);
  return { count: g.rows.length, unscored: g.unscoredWritten, auto: g.rows.filter((r) => r.auto).length, avg: g.pub.avg };
}
export async function exportWrittenFor(id) {
  const quiz = await store.get('quizzes/' + id);
  const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  return { quiz, ...buildWrittenExport(quiz, responses, !!quiz.autoSubmit) };
}
export async function saveWrittenScores(id, rows, user, title) {
  const byQ = {}; const now = Date.now();
  rows.forEach((r) => { (byQ[r.qid] = byQ[r.qid] || {})[r.uid] = { score: r.score, feedback: r.feedback, flag: r.flag, at: now }; });
  await Promise.all(Object.entries(byQ).map(([qid, scores]) => store.set(`writtenScores/${id}_${qid}`, { scores }, true)));
  await log(user, 'Uploaded written scores', `${title}: ${rows.length} scores`);
}
export async function loadWrittenReview(id) {
  const [quiz, responses] = await Promise.all([store.get('quizzes/' + id), store.list('responses', { where: [['quizId', '==', id]] })]);
  const written = await loadWritten(id, quiz); const rows = [];
  allQuestions(quiz).filter((q) => q.type === 'text').forEach((q) => responses.forEach((r) => {
    const a = (r.answers || {})[q.id]; if (!a) return; const w = (written[q.id] || {})[r.uid];
    rows.push({ qid: q.id, qtext: q.text, max: q.points, uid: r.uid, name: r.name, email: r.email, answer: a, score: w ? w.score : null, feedback: w ? w.feedback : '', flag: !!(w && w.flag), overridden: !!(w && w.overridden) });
  }));
  return rows;
}
export async function overrideWritten(id, row, score, feedback, reason, user, title) {
  await store.set(`writtenScores/${id}_${row.qid}`, { scores: { [row.uid]: { score, feedback, flag: false, overridden: true, reason, by: user.email, at: Date.now(), previous: row.score } } }, true);
  await log(user, 'Overrode a written score', `${title} · ${row.email} · ${row.qid}: ${row.score ?? 'none'} to ${score}. Reason: ${reason}`);
}
export function checklist(item, now) {
  const o = item.ops || {};
  const closed = now >= item.closes;
  const steps = [
    { id: 'closed', label: 'Quiz closed', done: closed },
    { id: 'calc', label: 'Calculate scores', done: !!o.calcAt },
    ...(item.hasWritten ? [{ id: 'written', label: 'Score written answers', done: !!o.writtenAt }, { id: 'reviewed', label: 'Review flagged answers', done: !!o.reviewedAt }] : []),
    { id: 'backup', label: 'Back up responses', done: !!o.backupAt },
    { id: 'announce', label: 'Announcement ready', done: !!o.announceAt }
  ];
  return { steps, ready: steps.every((s) => s.done) };
}
export async function release(id, user, title, forced) {
  await store.update('quizKeys/' + id, { released: true });
  await patchIndex(id, { released: true, releasedAt: Date.now() });
  await log(user, forced ? 'Released results (checklist skipped)' : 'Released results', title);
}
export async function markOp(id, op, user, label) { await patchIndex(id, { ['ops.' + op]: Date.now() }); if (label) await log(user, label, id); }

// ---------------- exports
export async function resultsCsv(id) {
  const [quiz, full] = await Promise.all([store.get('quizzes/' + id), store.get('resultsFull/' + id)]);
  const rows = (full && full.rows) || []; const secs = quiz.sections.map((s) => s.title);
  return toCsv([['rank', 'name', 'email', 'total', ...secs, 'auto_submitted'], ...rows.map((r) => [r.rank, r.name, r.email, r.total, ...r.sections.map((s) => s.score), r.auto ? 'yes' : 'no'])]);
}
export async function backupCsv(id) {
  const quiz = await store.get('quizzes/' + id); const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  const qs = allQuestions(quiz);
  return toCsv([['email', 'name', 'submitted', 'auto_submitted', 'submitted_at', ...qs.map((q) => q.id + ': ' + q.text.slice(0, 40))], ...responses.map((r) => [r.email, r.name, r.submitted ? 'yes' : 'no', r.auto ? 'yes' : 'no', r.submittedAt ? new Date(r.submittedAt).toISOString() : '', ...qs.map((q) => { const a = (r.answers || {})[q.id]; return a === undefined ? '' : typeof a === 'object' ? JSON.stringify(a) : a; })])]);
}

// ---------------- roles and access
export async function listRoles() { const rows = await store.list('roles'); return rows.map((r) => ({ email: r.id, role: r.role, addedBy: r.addedBy })).sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email)); }
export async function setRole(email, role, user) {
  const e = lc(email);
  if (role === 'participant') { await store.del('roles/' + e); await log(user, 'Removed access', `${e} is now a Participant`); return; }
  await store.set('roles/' + e, { role, addedBy: user.email, addedAt: Date.now() }); await log(user, 'Set role', `${e}: ${role}`);
}
export function planBulkRoles(rows, actorRole) {
  const ok = []; const errors = []; const seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2; const email = lc(r.email); const role = lc(r.role);
    if (!/^[^@\s]+@databeat\.io$/.test(email)) errors.push(`Line ${line}: "${r.email}" is not a @databeat.io email.`);
    else if (!ROLES.includes(role)) errors.push(`Line ${line}: role "${r.role}" must be participant, lead, creator or admin.`);
    else if (actorRole === 'creator' && !['lead', 'participant'].includes(role)) errors.push(`Line ${line}: creators can only set Lead or Participant.`);
    else if (seen.has(email)) errors.push(`Line ${line}: ${email} appears twice.`);
    else { seen.add(email); ok.push({ email, role }); }
  });
  return { ok, errors };
}
export async function applyBulkRoles(list, user) {
  const ops = list.map((r) => (r.role === 'participant' ? { type: 'del', path: 'roles/' + r.email } : { type: 'set', path: 'roles/' + r.email, data: { role: r.role, addedBy: user.email, addedAt: Date.now() } }));
  await store.batch(ops); await log(user, 'Bulk role upload', `${list.length} people`);
}
export async function requestAccess(quizId, title, user) { await store.set(`accessRequests/${quizId}_${user.uid}`, { quizId, title, email: user.email, uid: user.uid, status: 'pending', at: Date.now() }); }
export async function listAccessRequests() { return (await store.list('accessRequests')).filter((r) => r.status === 'pending'); }
export async function resolveAccess(req, grant, items, user) {
  if (grant) { const item = items[req.quizId]; const editors = Array.from(new Set([...(item.editors || []), req.email])); await setEditors(req.quizId, editors, user, item.title); }
  await store.update(`accessRequests/${req.id}`, { status: grant ? 'granted' : 'declined', by: user.email, resolvedAt: Date.now() });
  await log(user, grant ? 'Granted edit access' : 'Declined edit access', `${req.email} · ${req.title}`);
}
export async function requestReview(user, quizId, qid, note, title) {
  await store.set(`reviewRequests/${quizId}_${user.uid}_${qid}`, { quizId, uid: user.uid, email: user.email, qid, note: note.slice(0, 500), status: 'open', title, at: Date.now() });
}
export async function myReviewRequests(user, quizId) { return (await store.list('reviewRequests', { where: [['quizId', '==', quizId], ['uid', '==', user.uid]] })).map((r) => r.qid); }
export async function listReviewRequests(quizId) { return (await store.list('reviewRequests', { where: [['quizId', '==', quizId]] })).sort((a, b) => b.at - a.at); }
export async function resolveReview(req, status, user) { await store.update(`reviewRequests/${req.id}`, { status, by: user.email, resolvedAt: Date.now() }); await log(user, 'Closed a review request', `${req.email} · ${req.qid} · ${status}`); }

// ---------------- Chat and email messages
export function msgVars(item) {
  return { quiz_name: item.title, link: (typeof location !== 'undefined' ? location.origin + location.pathname : '') + '#/', open_time: fmtDateTime(item.opens), close_time: fmtDateTime(item.closes), key_time: item.keyAt ? fmtDateTime(item.keyAt) : 'to be announced' };
}
export const buildMessage = (tpl, item) => fillTemplate(tpl, msgVars(item));
export async function queueOutbox(type, payload, user) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await store.set('outbox/' + id, { type, payload, status: 'pending', by: user.email, at: Date.now() }); return id;
}
export async function loadOutbox() { return (await store.list('outbox')).sort((a, b) => b.at - a.at).slice(0, 20); }
