/**
 * R&D Quiz Arena - Google Apps Script helper
 *
 * What it does: every 5 minutes it looks for jobs the Arena left in the "outbox" and does them for you:
 *   chat        posts a message to your Google Chat space
 *   emailDraft  creates a draft email in YOUR Gmail (it never sends anything)
 *   sheetBackup copies a quiz's responses into a new Google Sheet
 *
 * It runs as the person who installs it, so install it with the Google account that owns the Firebase project.
 * Follow SETUP-GUIDE.md, part 5. This script has NOT been tested against your project yet: run the
 * "testEverything" function first (see the guide) and fix anything it reports before turning the helper on in the Arena.
 *
 * Script properties to set (Project settings > Script properties):
 *   FIREBASE_PROJECT_ID   your Firebase project id, for example rnd-quiz-arena
 *   CHAT_WEBHOOK_URL      the incoming webhook URL of your Google Chat space (optional)
 *   EMAIL_TO              who email drafts are addressed to, for example a team list address (optional)
 *   SHEET_FOLDER_ID       fallback Google Drive folder for backup sheets, only used if the app's own
 *                         "Backup folder" (Admin -> Integrations) is left empty (optional)
 */

function props_() { return PropertiesService.getScriptProperties(); }
function projectId_() {
  var id = props_().getProperty('FIREBASE_PROJECT_ID');
  if (!id) throw new Error('Set the FIREBASE_PROJECT_ID script property first.');
  return id;
}
function base_() { return 'https://firestore.googleapis.com/v1/projects/' + projectId_() + '/databases/(default)/documents'; }
function fetch_(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': projectId_() }, opts.headers || {});
  opts.muteHttpExceptions = true;
  var res = UrlFetchApp.fetch(url, opts);
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('Firestore said ' + code + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText() || '{}');
}

// ---- Firestore value conversion
function fromFs_(v) {
  if (v === undefined || v === null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs_);
  if ('mapValue' in v) return fieldsToObj_(v.mapValue.fields || {});
  return null;
}
function fieldsToObj_(f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = fromFs_(f[k]); }); return o; }
function toFs_(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  return { stringValue: String(x) };
}
function query_(collection, filters, limit) {
  var where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters: filters } };
  var body = { structuredQuery: { from: [{ collectionId: collection }], where: where, limit: limit || 500 } };
  var rows = fetch_(base_() + ':runQuery', { method: 'post', contentType: 'application/json', payload: JSON.stringify(body) });
  return rows.filter(function (r) { return r.document; }).map(function (r) {
    var o = fieldsToObj_(r.document.fields || {});
    o._path = r.document.name; o._id = r.document.name.split('/').pop();
    return o;
  });
}
function eq_(field, value) { return { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toFs_(value) } }; }
function getDoc_(path) { var d = fetch_(base_() + '/' + path); return fieldsToObj_(d.fields || {}); }
function patch_(docName, fields) {
  var mask = Object.keys(fields).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  var payload = { fields: {} }; Object.keys(fields).forEach(function (k) { payload.fields[k] = toFs_(fields[k]); });
  fetch_('https://firestore.googleapis.com/v1/' + docName + '?' + mask, { method: 'patch', contentType: 'application/json', payload: JSON.stringify(payload) });
}

// ---- the jobs
function doChat_(p) {
  var url = props_().getProperty('CHAT_WEBHOOK_URL');
  if (!url) throw new Error('Set the CHAT_WEBHOOK_URL script property to post to Google Chat.');
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify({ text: p.text }), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('Google Chat said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
}
function doEmailDraft_(p) {
  GmailApp.createDraft(props_().getProperty('EMAIL_TO') || '', p.subject, p.body);
}
function doSheetBackup_(p) {
  var quiz = getDoc_('quizzes/' + p.quizId);
  var questions = [];
  (quiz.sections || []).forEach(function (s) { (s.questions || []).forEach(function (q) { questions.push(q); }); });
  var rows = query_('responses', [eq_('quizId', p.quizId)], 1000);
  var header = ['email', 'name', 'submitted', 'auto_submitted', 'submitted_at'].concat(questions.map(function (q) { return q.id + ': ' + String(q.text).slice(0, 40); }));
  var out = [header];
  rows.forEach(function (r) {
    var a = r.answers || {};
    out.push([r.email, r.name, r.submitted ? 'yes' : 'no', r.auto ? 'yes' : 'no', r.submittedAt ? new Date(r.submittedAt).toISOString() : ''].concat(questions.map(function (q) {
      var v = a[q.id]; return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
    })));
  });
  var ss = SpreadsheetApp.create((p.title || p.quizId) + ' - responses backup');
  ss.getActiveSheet().getRange(1, 1, out.length, header.length).setValues(out);
  var folder = backupFolderId_();
  if (folder) DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folder));
  return ss.getUrl();
}
// The folder an admin picked in the app (Admin -> Integrations -> Backup folder) wins; the script
// property is only a fallback for before that setting existed, or if it's left blank.
function backupFolderId_() {
  var settings = {};
  try { settings = getDoc_('settings/app'); } catch (e) { settings = {}; }
  var fromApp = settings.integrations && settings.integrations.sheetFolderId;
  return fromApp || props_().getProperty('SHEET_FOLDER_ID');
}

function handle_(job) {
  var p = job.payload || {};
  if (job.type === 'chat') return doChat_(p);
  if (job.type === 'emailDraft') return doEmailDraft_(p);
  if (job.type === 'sheetBackup') return doSheetBackup_(p);
  throw new Error('Unknown job type: ' + job.type);
}

// Runs every 5 minutes (see installTrigger).
function processOutbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    query_('outbox', [eq_('status', 'pending')], 20).forEach(function (job) {
      try {
        var result = handle_(job);
        patch_(job._path, { status: 'done', doneAt: Date.now(), result: result ? String(result) : '' });
      } catch (e) {
        patch_(job._path, { status: 'error', error: String(e).slice(0, 300) });
      }
    });
  } finally { lock.releaseLock(); }
}

// ---- one-time setup helpers
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'processOutbox') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processOutbox').timeBased().everyMinutes(5).create();
  Logger.log('Done. The helper will check the outbox every 5 minutes.');
}
// Run this once after installing. It checks each connection and tells you what to fix.
function testEverything() {
  var report = [];
  function step(name, fn) { try { var r = fn(); report.push('OK    ' + name + (r ? ' (' + r + ')' : '')); } catch (e) { report.push('FIX   ' + name + ': ' + e.message); } }
  step('Can read the Arena database', function () { return query_('outbox', [eq_('status', 'pending')], 1).length + ' pending jobs'; });
  step('Google Chat webhook', function () { if (!props_().getProperty('CHAT_WEBHOOK_URL')) return 'skipped, no webhook set'; doChat_({ text: 'Test message from the R&D Quiz Arena helper. You can ignore this.' }); return 'test message posted'; });
  step('Gmail drafts', function () { doEmailDraft_({ subject: 'Test draft from the R&D Quiz Arena helper', body: 'You can delete this draft.' }); return 'draft created in your Gmail'; });
  step('Google Sheets and Drive', function () { var ss = SpreadsheetApp.create('Arena helper test - safe to delete'); return ss.getUrl(); });
  Logger.log(report.join('\n'));
}
