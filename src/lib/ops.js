// Everything the app does with the database lives here, so screens stay simple and this can be tested.
import { store, rid, DELETE_FIELD } from './store.js';
import { CONFIG } from '../config.js';
import { toDocs, fromDocs, indexItem, allQuestions, hasWritten, fillTemplate } from './quizModel.js';
import { gradeQuiz, hasAnyAnswer, applyMovement, topRows } from './scoring.js';
import { buildWrittenExport } from './written.js';
import { toCsv } from './csv.js';
import { fmtDateTime } from './time.js';
import { DEFAULT_THRESHOLDS } from './stages.js';

export const DEFAULT_SETTINGS = { leaderboardVisibility: 'leads', showMovement: true, newQuizDefaults: { autoSubmit: false, allowReviewRequests: false }, emails: { closingReminder: true, releaseNotice: true }, thresholds: DEFAULT_THRESHOLDS, defaultMascots: ['robot'], integrations: { gas: false }, retention: 'forever', highlightDays: 5 };
export const ROLES = ['participant', 'lead', 'creator', 'admin'];
export const ROLE_LABEL = { participant: 'Participant', lead: 'Lead', creator: 'Creator', admin: 'Admin' };
export const isStaff = (role) => role === 'admin' || role === 'creator';
export const isLeadPlus = (role) => role !== 'participant';
// Every creator can SEE every quiz, but can only EDIT one they own or were given access to (quiz.editors).
// Admins can edit anything. Only admins archive, restore or delete.
export const canEditQuiz = (role, email, quiz) => role === 'admin' || (role === 'creator' && !!quiz && (quiz.ownerEmail === email || (quiz.editors || []).includes(email)));
const lc = (s) => String(s || '').trim().toLowerCase();

export async function getRole(user) {
  if (lc(user.email) === lc(CONFIG.bootstrapAdmin)) return 'admin';
  const r = await store.get('roles/' + lc(user.email));
  return r && ROLES.includes(r.role) ? r.role : 'participant';
}
// Each sign-in updates the record. The first sign-in date is kept, and signing in again brings a removed profile back to Active.
export async function ensureUser(user) {
  const now = Date.now(); const prev = await store.get('users/' + user.uid);
  const base = { name: user.name, email: user.email, lastSeen: now, deleted: false, deletedAt: null };
  await store.set('users/' + user.uid, prev ? base : { ...base, firstSeen: now }, true);
  if (prev && prev.deleted) { try { await store.del('profileStatus/' + user.uid); } catch (e) { /* the marker is only cosmetic */ } }
  // Finishes any backfill import that was waiting on this person to have an account. On the live site this
  // is a best-effort nicety (the rules only let an admin write an imported response, so this quietly no-ops
  // there) — the Apps Script helper is what actually finishes it, within 5 minutes, either way.
  try { await applyPendingImports(user); } catch (e) { /* the Apps Script helper will pick this up instead */ }
}
// Finishes any pending import(s) left for this person's email (see importPastResponses). Returns how many.
export async function applyPendingImports(user) {
  const pend = await store.list('pendingImports', { where: [['email', '==', user.email]] });
  if (!pend.length) return 0;
  const now = Date.now(); const batchOps = [];
  pend.forEach((p) => {
    batchOps.push({ type: 'set', path: `responses/${p.quizId}_${user.uid}`, data: { quizId: p.quizId, uid: user.uid, email: p.email, name: user.name || p.email, answers: p.answers || {}, submitted: true, submittedAt: now, imported: true, importedBy: p.importedBy || '', importedAt: p.importedAt || now } });
    batchOps.push({ type: 'del', path: `pendingImports/${p.id}` });
  });
  await store.batch(batchOps);
  return pend.length;
}
// "Remove my profile" removes only the sign-in profile. Scores and history stay, shown as "Profile removed".
// profileStatus/<uid> is a tiny public marker so leaderboards can grey the name without reading anyone's profile.
export async function removeMyProfile(user) {
  // The marker goes first, so if anything fails the profile is left exactly as it was.
  await store.set('profileStatus/' + user.uid, { removed: true, at: Date.now() });
  try { await store.update('users/' + user.uid, { deleted: true, deletedAt: Date.now() }); }
  catch (e) { try { await store.del('profileStatus/' + user.uid); } catch (e2) { /* best effort */ } throw e; }
}
export async function loadRemoved() { try { return new Set((await store.list('profileStatus')).map((r) => r.id)); } catch (e) { return new Set(); } }
export async function listUsers() { return store.list('users'); }
// Users plus a count of quizzes each person took, read from the released results (one read per quiz, not per person).
export async function usersExportData(index) {
  const users = await store.list('users'); const took = [];
  await Promise.all(Object.values(index).filter((i) => i.released).map(async (i) => { const f = await store.get('resultsFull/' + i.id).catch(() => null); ((f && f.rows) || []).forEach((r) => took.push({ uid: r.uid, submitted: true })); }));
  return { users, responses: took };
}

// Archive hides a quiz from everyone except admins. The quiz and its results are kept.
// Archived quizzes move out of the Library list (quizIndex/main) into an admin-only list (quizIndex/archived),
// so participants and creators can't see the title either. Restore moves it back.
export async function loadArchivedIndex() { const d = await store.get('quizIndex/archived'); return (d && d.items) || {}; }
export async function setArchived(id, on, user, title) {
  const main = await loadIndex(); const arch = await loadArchivedIndex().catch(() => ({}));
  if (on) {
    const item = main[id]; if (!item) throw new Error('That quiz is not in the Library list.');
    await store.update('quizzes/' + id, { archived: true }); await store.update('quizKeys/' + id, { archived: true });
    await store.set('quizIndex/archived', { items: { ...arch, [id]: { ...item, archived: true, archivedAt: Date.now() } } }, false);
    const rest = { ...main }; delete rest[id]; await store.set('quizIndex/main', { items: rest }, false);
  } else {
    const item = arch[id]; if (!item) throw new Error('That quiz is not in the Archived list.');
    const { archived, archivedAt, ...back } = item;
    await store.set('quizIndex/main', { items: { ...main, [id]: back } }, false);
    await store.update('quizzes/' + id, { archived: false }); await store.update('quizKeys/' + id, { archived: false });
    const rest = { ...arch }; delete rest[id]; await store.set('quizIndex/archived', { items: rest }, false);
  }
  await log(user, on ? 'Archived quiz' : 'Restored quiz', title);
}
// Admin-only. Unlike Archive, this is permanent and cascades: every response, result and leaderboard entry
// for this quiz is removed, and it disappears from each participant's own history — so a deleted quiz's
// name is free to reuse. Use Archive instead for anything whose history should actually be kept.
export async function deleteQuiz(id, user, title) {
  const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  const quiz = await store.get('quizzes/' + id).catch(() => null);
  const textQids = quiz ? allQuestions(quiz).filter((q) => q.type === 'text').map((q) => q.id) : [];
  const statsList = await Promise.all(responses.map((r) => store.get('stats/' + r.uid).catch(() => null)));
  const batchOps = [];
  responses.forEach((r, i) => {
    batchOps.push({ type: 'del', path: `responses/${id}_${r.uid}` });
    batchOps.push({ type: 'del', path: `myResults/${id}_${r.uid}` });
    if (statsList[i] && statsList[i].history && id in statsList[i].history) batchOps.push({ type: 'update', path: `stats/${r.uid}`, data: { [`history.${id}`]: DELETE_FIELD } });
  });
  textQids.forEach((qid) => batchOps.push({ type: 'del', path: `writtenScores/${id}_${qid}` }));
  batchOps.push({ type: 'del', path: `resultsPublic/${id}` }, { type: 'del', path: `resultsFull/${id}` }, { type: 'del', path: `quizzes/${id}` }, { type: 'del', path: `quizKeys/${id}` });
  await store.batch(batchOps);
  const main = await loadIndex(); const arch = await loadArchivedIndex().catch(() => ({}));
  if (id in main) { const rest = { ...main }; delete rest[id]; await store.set('quizIndex/main', { items: rest }, false); }
  if (id in arch) { const rest = { ...arch }; delete rest[id]; await store.set('quizIndex/archived', { items: rest }, false); }
  await log(user, 'Deleted quiz, including every response, result and history entry', `${title} (${responses.length} participants affected)`);
}
export async function loadSettings() {
  const s = (await store.get('settings/app')) || {};
  return { ...DEFAULT_SETTINGS, ...s, newQuizDefaults: { ...DEFAULT_SETTINGS.newQuizDefaults, ...(s.newQuizDefaults || {}) }, emails: { ...DEFAULT_SETTINGS.emails, ...(s.emails || {}) } };
}
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
// For quizzes with a personal time limit: creates an empty response the instant someone opens the quiz,
// so the clock starts from first open rather than from their first saved answer.
export async function startResponse(user, quizId, now) {
  const path = 'responses/' + rid(quizId, user.uid);
  await store.set(path, { quizId, uid: user.uid, email: user.email, name: user.name, answers: {}, submitted: false, startedAt: now, updatedAt: now });
}
export async function saveAnswer(user, quizId, qid, value, exists) {
  const path = 'responses/' + rid(quizId, user.uid); const now = Date.now();
  if (!exists) { await store.set(path, { quizId, uid: user.uid, email: user.email, name: user.name, answers: { [qid]: value }, submitted: false, startedAt: now, updatedAt: now }); return; }
  // A deselected answer (value === undefined) needs the delete sentinel: a plain undefined on a dotted
  // field path just gets dropped from the write, silently leaving the previous answer in place.
  await store.update(path, { [`answers.${qid}`]: value === undefined ? DELETE_FIELD : value, updatedAt: now });
}
export async function submitResponse(user, quizId, auto = false) {
  const now = Date.now();
  const path = 'responses/' + rid(quizId, user.uid);
  try { await store.update(path, { submitted: true, submittedAt: now, updatedAt: now, ...(auto ? { auto: true } : {}) }); }
  catch (e) {
    // The `auto` field needs a matching allowance in firestore.rules before a participant's own client
    // can set it (see SETUP-GUIDE.md). Until that's deployed, submit without the tag rather than fail
    // the whole submission — this makes the two deployments order-independent.
    if (auto && /permission-denied/i.test((e && e.code) || '')) { await store.update(path, { submitted: true, submittedAt: now, updatedAt: now }); return; }
    throw e;
  }
}
export async function liveCounts(quizId) {
  const [submitted, started] = await Promise.all([store.count('responses', { where: [['quizId', '==', quizId], ['submitted', '==', true]] }), store.count('responses', { where: [['quizId', '==', quizId]] })]);
  return { submitted, started };
}

// Backfills a quiz that happened before it was run in this tool (or outside it). `rows` is
// [{email, answers}] from parseImportUpload. Writes real responses so Calculate scores, written
// scoring and release all work exactly as they do for a quiz actually run live. Someone who hasn't
// signed into the tool yet has no account to attach a score to yet — their answers are held as a
// pending import instead, and applyPendingImports() (run on their first sign-in, and by the Apps
// Script helper every 5 minutes as a backstop) finishes the job automatically once they do.
export async function importPastResponses(id, rows, user, title) {
  const found = await Promise.all(rows.map((r) => store.list('users', { where: [['email', '==', r.email]] })));
  const pending = []; const batchOps = []; const now = Date.now();
  rows.forEach((r, i) => {
    const u = found[i][0];
    if (!u) { pending.push(r.email); batchOps.push({ type: 'set', path: `pendingImports/${id}_${r.email}`, data: { quizId: id, email: r.email, answers: r.answers, title, importedBy: user.email, importedAt: now } }); return; }
    batchOps.push({ type: 'set', path: `responses/${id}_${u.id}`, data: { quizId: id, uid: u.id, email: r.email, name: u.name || r.email, answers: r.answers, submitted: true, submittedAt: now, imported: true, importedBy: user.email, importedAt: now } });
  });
  if (batchOps.length) await store.batch(batchOps);
  const applied = rows.length - pending.length;
  await log(user, 'Imported past quiz answers', `${title}: ${applied} applied now, ${pending.length ? `${pending.length} waiting for sign-in` : 'none waiting'}`);
  return { imported: applied, pending };
}
export async function listPendingImports(quizId) { return store.list('pendingImports', { where: [['quizId', '==', quizId]] }); }

// ---------------- authoring
export async function loadAuthoring(id) {
  const [q, k] = await Promise.all([store.get('quizzes/' + id), store.get('quizKeys/' + id)]);
  return q ? fromDocs(id, q, k) : null;
}
export async function saveQuiz(a, user, { publish = false } = {}) {
  if (!a.ownerName && a.ownerEmail === user.email) a = { ...a, ownerName: user.name || '' };
  const { quiz, key } = toDocs(a);
  const existingKey = await store.get('quizKeys/' + a.id).catch(() => null);
  const existing = await store.get('quizzes/' + a.id).catch(() => null);
  if (existing && existing.archived) throw new Error('This quiz is archived. Restore it before editing.');
  const published = publish || !!(existing && existing.published);
  await store.set('quizzes/' + a.id, { ...quiz, published });
  await store.set('quizKeys/' + a.id, { ...key, released: !!(existingKey && existingKey.released) });
  const idx = (await loadIndex())[a.id] || {};
  const item = indexItem(a.id, quiz, { published, released: !!idx.released, releasedAt: idx.releasedAt || 0, ops: idx.ops || {}, submittedCount: idx.submittedCount || 0, avgScore: idx.avgScore || 0 });
  await store.set('quizIndex/main', { items: { [a.id]: item } }, true);
  await log(user, publish && !(existing && existing.published) ? 'Published quiz' : 'Saved quiz', a.title);
  return item;
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
// The latest earlier round that was scored and is still in the Library (archived quizzes are not).
async function previousRound(id, quiz) {
  const items = Object.values(await loadIndex()).filter((i) => i.id !== id && i.opens < quiz.opens && i.ops && i.ops.calcAt).sort((a, b) => b.opens - a.opens);
  for (const i of items) { const f = await store.get('resultsFull/' + i.id).catch(() => null); if (f && f.rows && f.rows.length) return { item: i, rows: f.rows }; }
  return null;
}
export async function calculate(id, user) {
  const [quiz, key] = await Promise.all([store.get('quizzes/' + id), store.get('quizKeys/' + id)]);
  const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  const written = await loadWritten(id, quiz);
  const g = gradeQuiz({ quiz, key, responses, written, autoSubmit: !!quiz.autoSubmit });
  const prev = await previousRound(id, quiz).catch(() => null);
  const mv = applyMovement(g.rows, prev); g.pub.top = topRows(g.rows); g.pub.prevCount = mv.prevCount; g.pub.comparable = mv.comparable;
  const ops = [];
  const byUid = Object.fromEntries(responses.map((r) => [r.uid, r]));
  g.rows.forEach((r) => {
    ops.push({ type: 'set', path: `myResults/${id}_${r.uid}`, data: { uid: r.uid, quizId: id, total: r.total, max: r.max, rank: r.rank, count: g.rows.length, sections: r.sections, questions: r.questions, auto: r.auto, prevRank: r.prevRank, prevTotal: r.prevTotal, prevCount: mv.prevCount, move: r.move, missingRequired: r.missingRequired } });
    ops.push({ type: 'set', merge: true, path: 'stats/' + r.uid, data: { history: { [id]: { score: r.total, max: r.max, opens: quiz.opens, title: quiz.title } } } });
    const resp = byUid[r.uid];
    if (resp && !resp.submitted && r.auto) ops.push({ type: 'update', path: `responses/${id}_${r.uid}`, data: { submitted: true, auto: true, submittedAt: quiz.closes, updatedAt: Date.now() } });
  });
  ops.push({ type: 'set', path: 'resultsPublic/' + id, data: { ...g.pub, computedAt: Date.now() } });
  ops.push({ type: 'set', path: 'resultsFull/' + id, data: { prevCount: mv.prevCount, comparable: mv.comparable, prevTitle: prev ? prev.item.title : '', rows: g.rows.map((r) => ({ rank: r.rank, uid: r.uid, name: r.name, email: r.email, total: r.total, auto: r.auto, missingRequired: r.missingRequired, prevRank: r.prevRank, move: r.move, sections: r.sections })) } });
  await store.batch(ops);
  await patchIndex(id, { 'ops.calcAt': Date.now(), 'ops.writtenAt': g.unscoredWritten === 0 ? Date.now() : 0, submittedCount: g.rows.length, avgScore: g.pub.avg });
  await log(user, 'Calculated scores', `${quiz.title}: ${g.rows.length} participants, ${g.unscoredWritten} written answers still unscored`);
  return { count: g.rows.length, unscored: g.unscoredWritten, auto: g.rows.filter((r) => r.auto).length, avg: g.pub.avg, missingRequired: g.rows.filter((r) => r.missingRequired).length };
}
export async function exportWrittenFor(id) {
  const quiz = await store.get('quizzes/' + id);
  const responses = await store.list('responses', { where: [['quizId', '==', id]] });
  const key = await store.get('quizKeys/' + id).catch(() => null);
  return { quiz, ...buildWrittenExport(quiz, responses, !!quiz.autoSubmit, key || {}) };
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
