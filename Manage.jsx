import React, { useEffect, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { quizStatus, STATUS_LABEL } from '../lib/quizModel.js';
import * as ops from '../lib/ops.js';
import { parseWrittenUpload, buildPrompt } from '../lib/written.js';
import { download } from '../lib/csv.js';
import { fmtDateTime, fmtRange, toInputValue, fromInputValue } from '../lib/time.js';
import { Spinner, ErrorBox, useAsync, Chip, Tile, Seg } from '../components/ui.jsx';

const TONE = { draft: '', scheduled: 'info', live: 'ok', closed: 'warn', released: 'ok' };
const copy = async (t, toast) => { try { await navigator.clipboard.writeText(t); toast('Copied.'); } catch (e) { toast('Copy failed. Select the text and copy it by hand.', 'err'); } };

export function ManageList() {
  const { role, user, index, now, toast, ask, reload } = useApp();
  const items = Object.values(index).sort((a, b) => b.opens - a.opens);
  const rel = items.filter((i) => i.released);
  const avgSub = rel.length ? Math.round(rel.reduce((a, i) => a + (i.submittedCount || 0), 0) / rel.length) : 0;
  const avgScore = rel.length ? (rel.reduce((a, i) => a + (i.avgScore || 0), 0) / rel.length).toFixed(1) : '–';
  const reqs = useAsync(() => (role === 'admin' ? ops.listAccessRequests() : []), [role, items.length]);
  const decide = async (r, grant) => { try { await ops.resolveAccess(r, grant, index, user); toast(grant ? 'Access granted.' : 'Request declined.'); await reload(); reqs.reload(); } catch (e) { toast('Couldn\'t update that request.', 'err'); } };
  return (
    <div className="pan mt">
      <div className="row between center mb"><div className="h2">Manage quizzes</div><a className="btn p" href="#/edit/new">New quiz</a></div>
      <div className="row mb"><Tile label="Quizzes conducted" value={rel.length} /><Tile label="Average submissions" value={rel.length ? avgSub : '–'} /><Tile label="Average score" value={avgScore} unit={rel.length ? '/ 10' : ''} /></div>
      {role === 'admin' && reqs.data && reqs.data.length > 0 && <div className="card warn mb"><div className="lab" style={{ color: 'var(--warn)', marginBottom: 8 }}>Edit access requests</div>{reqs.data.map((r) => <div key={r.id} className="row between center" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}><span>{r.email} wants to edit <b style={{ fontWeight: 500 }}>{r.title}</b></span><span className="row"><button className="btn sm p" onClick={() => decide(r, true)}>Grant</button><button className="btn sm" onClick={() => decide(r, false)}>Decline</button></span></div>)}</div>}
      <div className="card"><div className="scroll"><table className="tbl"><thead><tr><th>Quiz</th><th>Status</th><th>Dates</th><th className="num">Submitted</th><th /></tr></thead><tbody>
        {items.length === 0 && <tr><td colSpan="5" className="muted">No quizzes yet. Create the first one.</td></tr>}
        {items.map((i) => { const st = quizStatus(i, now); const can = ops.canEditQuiz(role, user.email, i); return (
          <tr key={i.id}><td><a href={'#/manage/' + i.id} style={{ color: 'var(--fg)', fontWeight: 500 }}>{i.title || 'Untitled'}</a><div className="muted small">{can ? 'You can edit' : 'View only'} · owner {i.ownerEmail}</div></td><td><Chip tone={TONE[st]}>{STATUS_LABEL[st]}</Chip></td><td className="fg2">{i.opens ? fmtRange(i.opens, i.closes) : '–'}</td><td className="num">{i.released ? i.submittedCount : '–'}</td><td style={{ textAlign: 'right' }}><a className="btn sm s" href={'#/manage/' + i.id}>{st === 'closed' ? 'Release checklist' : 'Open'}</a></td></tr>); })}
      </tbody></table></div></div>
    </div>
  );
}

function WrittenReview({ id, item, quiz }) {
  const { user, toast, ask } = useApp(); const [f, setF] = useState('flag'); const [page, setPage] = useState(0);
  const { loading, data, error, reload } = useAsync(() => ops.loadWrittenReview(id), [id]);
  if (error) return <ErrorBox error={error} />; if (loading || !data) return <Spinner />;
  const rows = data.filter((r) => f === 'all' || (f === 'flag' && (r.flag || r.score === null)) || (f === 'over' && r.overridden));
  const per = 10;
  const override = async (r) => {
    const s = await ask({ title: 'Change this score', body: `${r.name} · maximum ${r.max} points. Scores go in steps of 0.5.`, input: { label: 'New score', initial: r.score === null ? '' : String(r.score), required: true }, ok: 'Next' }); if (s === null) return;
    const n = Number(s); if (Number.isNaN(n) || n < 0 || n > r.max || Math.abs(n * 2 - Math.round(n * 2)) > 1e-9) { toast(`Enter a number from 0 to ${r.max} in steps of 0.5.`, 'err'); return; }
    const reason = await ask({ title: 'Why are you changing it?', body: 'The reason is saved in the change log.', input: { label: 'Reason', multiline: true, required: true }, ok: 'Save score' }); if (!reason) return;
    try { await ops.overrideWritten(id, r, n, r.feedback, reason, user, item.title); toast('Score saved. Recalculate to update totals.'); reload(); } catch (e) { toast('Couldn\'t save that score.', 'err'); }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row between center mb"><Seg value={f} options={[['flag', 'Flagged or unscored'], ['over', 'Overridden'], ['all', 'All']]} onChange={(v) => { setF(v); setPage(0); }} /><span className="muted small">{rows.length} answers</span></div>
      {rows.slice(page * per, page * per + per).map((r) => <div key={r.uid + r.qid} className="box2" style={{ whiteSpace: 'normal' }}><div className="row between"><b style={{ fontWeight: 500 }}>{r.name}</b><span className="row center" style={{ gap: 8 }}>{r.flag && <Chip tone="warn">Flagged</Chip>}{r.overridden && <Chip tone="info">Overridden</Chip>}<Chip tone={r.score === null ? 'bad' : 'teal'}>{r.score === null ? 'Not scored' : `${r.score} / ${r.max}`}</Chip><button className="btn sm" onClick={() => override(r)}>Change score</button></span></div><div className="muted small" style={{ margin: '4px 0' }}>{r.qtext.slice(0, 110)}</div><div style={{ whiteSpace: 'pre-wrap' }}>{r.answer}</div>{r.feedback && <div className="muted small" style={{ marginTop: 6 }}>Feedback: {r.feedback}</div>}</div>)}
      {rows.length === 0 && <div className="muted">Nothing to review here.</div>}
      {rows.length > per && <div className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={(page + 1) * per >= rows.length} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}

export function ManageQuiz({ id }) {
  const { role, user, index, now, settings, toast, ask, reload } = useApp(); const item = index[id];
  const [busy, setBusy] = useState(''); const [counts, setCounts] = useState(null); const [upload, setUpload] = useState(null); const [open, setOpen] = useState('');
  const [closesIn, setClosesIn] = useState(item ? toInputValue(item.closes) : '');
  const st = item ? quizStatus(item, now) : 'none'; const can = item ? ops.canEditQuiz(role, user.email, item) : false;
  const log = useAsync(() => ops.loadChangeLog(60), [id]); const reviews = useAsync(() => (item && item.allowReviewRequests ? ops.listReviewRequests(id) : []), [id, item && item.allowReviewRequests]);
  const quizDoc = useAsync(() => store.get('quizzes/' + id), [id]);
  useEffect(() => { if (item && (st === 'live' || st === 'closed')) ops.liveCounts(id).then(setCounts).catch(() => {}); }, [id, st]); // eslint-disable-line
  if (!item) return Object.keys(index).length ? <div className="card mt"><div className="h3">That quiz doesn't exist</div><a href="#/manage">Back to Manage quizzes</a></div> : <Spinner />;
  const cl = ops.checklist(item, now); const o = item.ops || {};
  const run = async (name, fn, okMsg) => { setBusy(name); try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); await reload(); } catch (e) { toast('That didn\'t work. ' + (e.message || ''), 'err'); } setBusy(''); };
  const vars = ops.msgVars(item);
  const announceTpl = st === 'closed' || st === 'released' ? 'releaseMsg' : 'announceMsg';
  const msg = quizDoc.data ? ops.buildMessage(quizDoc.data[announceTpl], item) : '';
  const subject = (st === 'closed' || st === 'released' ? 'Results are out: ' : 'Now open: ') + item.title;
  const gas = settings.integrations && settings.integrations.gas;

  const onUpload = async (file) => {
    if (!file) return; const text = await file.text(); const ex = await ops.exportWrittenFor(id);
    const parsed = parseWrittenUpload(text, ex.keys); setUpload({ ...parsed, total: ex.count, name: file.name });
  };
  const doExport = async () => run('export', async () => {
    const ex = await ops.exportWrittenFor(id); const key = await store.get('quizKeys/' + id);
    download(`${item.title.replace(/[^\w]+/g, '-')}-written-answers.csv`, ex.csv); download(`${item.title.replace(/[^\w]+/g, '-')}-scoring-prompt.txt`, buildPrompt(ex.quiz, key, item.title), 'text/plain'); return ex.count;
  }, (n) => `Downloaded ${n} written answers and the scoring prompt.`);

  return (
    <div className="pan mt">
      <a href="#/manage" className="fg2">← Manage quizzes</a>
      <div className="row between center" style={{ margin: '12px 0 18px' }}>
        <div><div className="h2">{item.title}</div><div className="fg2" style={{ marginTop: 2 }}>{item.opens ? fmtRange(item.opens, item.closes) : ''} · owner {item.ownerEmail}</div></div>
        <div className="row center"><Chip tone={TONE[st]}>{STATUS_LABEL[st]}</Chip>{can && <a className="btn sm s" href={'#/edit/' + id}>Edit</a>}{st === 'live' && <a className="btn sm" href={'#/quiz/' + id}>Preview as participant</a>}{item.released && <a className="btn sm" href={'#/library/' + id}>View answer key</a>}</div>
      </div>
      {!can && <div className="banner warn"><span>You can view this quiz but not change it.</span>{role === 'creator' && <button className="btn sm s" onClick={() => run('req', () => ops.requestAccess(id, item.title, user), 'Request sent to the admins.')}>Request edit access</button>}</div>}

      {(st === 'live' || st === 'closed') && <div className="card mt"><div className="lab" style={{ marginBottom: 10 }}>{st === 'live' ? 'Live' : 'Closed'}</div>
        <div className="row"><Tile label="Submitted" value={counts ? counts.submitted : '–'} /><Tile label="Started" value={counts ? counts.started : '–'} /></div>
        {can && st === 'live' && <div className="row center" style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="cl">Closes (IST)</label><input id="cl" className="input" type="datetime-local" value={closesIn} onChange={(e) => setClosesIn(e.target.value)} /></div>
          <button className="btn sm s" style={{ marginTop: 18 }} onClick={() => { const ms = fromInputValue(closesIn); if (!ms || ms <= now) { toast('Pick a time in the future.', 'err'); return; } run('close', () => ops.setCloses(id, ms, user, item.title), 'Close time updated.'); }}>Change close time</button>
          <button className="btn sm danger" style={{ marginTop: 18 }} onClick={async () => { if (await ask({ title: 'Close the quiz now?', body: 'Participants can no longer answer or submit. This can\'t be undone.', ok: 'Close now', danger: true })) run('closenow', () => ops.setCloses(id, now - 1000, user, item.title), 'Quiz closed.'); }}>Close now</button>
        </div>}
        {st === 'live' && <div className="row" style={{ marginTop: 14 }}><button className="btn sm" onClick={() => copy(`Reminder: ${item.title} closes ${fmtDateTime(item.closes)}. Take it here: ${vars.link}`, toast)}>Copy reminder for Chat</button>{gas && <button className="btn sm" onClick={() => run('rem', () => ops.queueOutbox('chat', { text: `Reminder: ${item.title} closes ${fmtDateTime(item.closes)}. Take it here: ${vars.link}` }, user), 'Reminder queued for Google Chat.')}>Send reminder to Chat</button>}</div>}
      </div>}

      {(st === 'closed' || st === 'released') && can && <div className={'card mt ' + (st === 'closed' ? 'warn' : '')}>
        <div className="h3" style={{ marginBottom: 4 }}>Release checklist</div><div className="fg2" style={{ marginBottom: 8 }}>Everything must be done before results and the answer key reach participants.</div>
        {cl.steps.map((s) => <div key={s.id} className={'check' + (s.done ? ' done' : '')}><span className="box3">{s.done ? '✓' : ''}</span><div style={{ flex: 1 }}><div>{s.label}</div><div className="muted small">{{ closed: `Closed ${fmtDateTime(item.closes)}`, calc: o.calcAt ? `Last calculated ${fmtDateTime(o.calcAt)}${item.submittedCount ? ` · ${item.submittedCount} participants` : ''}` : 'Scores multiple choice and analytical answers, and counts auto-submitted answers', written: o.writtenAt ? 'Every written answer has a score' : 'Export written answers, score them in Claude, upload the CSV. This ticks when every written answer has a score.', reviewed: 'Look at flagged answers and change scores if needed', backup: o.backupAt ? `Backed up ${fmtDateTime(o.backupAt)}` : 'Download a copy of every response', announce: 'Review the Chat message and email draft' }[s.id]}</div>
          {s.id === 'calc' && st === 'closed' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm s" disabled={!!busy} onClick={() => run('calc', () => ops.calculate(id, user), (r) => `Scored ${r.count} participants${r.auto ? `, ${r.auto} auto-submitted` : ''}${r.unscored ? `. ${r.unscored} written answers still need scores` : ''}.`)}>{busy === 'calc' ? 'Calculating…' : o.calcAt ? 'Recalculate' : 'Calculate scores'}</button></div>}
          {s.id === 'written' && st === 'closed' && <div style={{ marginTop: 8 }}><div className="row"><button className="btn sm s" disabled={!!busy} onClick={doExport}>Export for scoring</button><label className="btn sm s" style={{ cursor: 'pointer' }}>Upload scored CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { onUpload(e.target.files[0]); e.target.value = ''; }} /></label></div>
            {upload && <div className="box2" style={{ marginTop: 10, whiteSpace: 'normal' }}><b style={{ fontWeight: 500 }}>{upload.name}</b>: {upload.ok.length} valid scores of {upload.total} answers{upload.flagged ? `, ${upload.flagged} flagged` : ''}.{upload.missing.length > 0 && <div style={{ color: 'var(--warn)' }}>{upload.missing.length} answers have no score yet. The release stays blocked until each one has a score (use Change score to give a 0).</div>}{upload.errors.slice(0, 8).map((e, i) => <div key={i} style={{ color: 'var(--danger)' }}>{e}</div>)}{upload.errors.length > 8 && <div className="muted">…and {upload.errors.length - 8} more problems.</div>}
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm p" disabled={!upload.ok.length || upload.errors.length > 0} onClick={() => run('save', async () => { await ops.saveWrittenScores(id, upload.ok, user, item.title); await ops.calculate(id, user); setUpload(null); }, 'Scores saved and totals recalculated.')}>{upload.errors.length ? 'Fix the file to continue' : 'Save scores'}</button><button className="btn sm" onClick={() => setUpload(null)}>Discard</button></div></div>}</div>}
          {s.id === 'reviewed' && st === 'closed' && <div style={{ marginTop: 8 }}><div className="row"><button className="btn sm s" onClick={() => setOpen(open === 'rev' ? '' : 'rev')}>{open === 'rev' ? 'Hide answers' : 'Review answers'}</button><button className="btn sm" onClick={() => run('rd', () => ops.markOp(id, 'reviewedAt', user, 'Marked review done'), 'Review marked as done.')}>{o.reviewedAt ? 'Marked done' : 'Mark review done'}</button></div>{open === 'rev' && <WrittenReview id={id} item={item} quiz={null} />}</div>}
          {s.id === 'backup' && st === 'closed' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm s" onClick={() => run('bk', async () => { download(`${item.title.replace(/[^\w]+/g, '-')}-responses.csv`, await ops.backupCsv(id)); await ops.markOp(id, 'backupAt', user, 'Downloaded response backup'); }, 'Backup downloaded.')}>Download backup CSV</button>{gas && <button className="btn sm" onClick={() => run('sh', async () => { await ops.queueOutbox('sheetBackup', { quizId: id, title: item.title }, user); await ops.markOp(id, 'backupAt', user, 'Queued Google Sheets backup'); }, 'Backup queued for Google Sheets.')}>Send to Google Sheet</button>}</div>}
          {s.id === 'announce' && st === 'closed' && <div style={{ marginTop: 8 }}><div className="box2" style={{ whiteSpace: 'pre-wrap' }}>{msg}</div><div className="row"><button className="btn sm" onClick={() => copy(msg, toast)}>Copy Chat message</button><a className="btn sm" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`}>Open email draft in Gmail</a><button className="btn sm s" onClick={() => run('an', () => ops.markOp(id, 'announceAt', user, 'Marked announcement ready'), 'Announcement marked ready.')}>{o.announceAt ? 'Marked ready' : 'Mark ready'}</button></div></div>}
        </div></div>)}
        {st === 'closed' && <div className="row between center" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}><div className="fg2 small" style={{ maxWidth: 520 }}>Releasing opens each person's score and the answer key. {gas ? 'The release message is queued to Google Chat and email draft.' : 'Copy the release message from the last step.'}</div>
          <div className="row"><button className="btn p" disabled={!cl.ready || !!busy} onClick={async () => { if (await ask({ title: 'Release results?', body: 'Participants will see their scores and the answer key.', ok: 'Release' })) run('rel', async () => { await ops.release(id, user, item.title, false); if (gas) { await ops.queueOutbox('chat', { text: ops.buildMessage(quizDoc.data.releaseMsg, { ...item }) }, user); await ops.queueOutbox('emailDraft', { subject: 'Results are out: ' + item.title, body: ops.buildMessage(quizDoc.data.releaseMsg, { ...item }) }, user); } }, 'Results released.'); }}>{cl.ready ? 'Release to participants' : `${cl.steps.filter((s) => !s.done).length} steps left`}</button>
            {role === 'admin' && !cl.ready && <button className="btn danger" onClick={async () => { if (await ask({ title: 'Release without finishing the checklist?', body: 'Scores may be incomplete. This is recorded in the change log.', ok: 'Release anyway', danger: true })) run('rel', () => ops.release(id, user, item.title, true), 'Results released.'); }}>Release anyway</button>}</div></div>}
        {st === 'released' && <div className="row" style={{ marginTop: 14 }}><button className="btn sm s" onClick={() => run('csv', async () => { download(`${item.title.replace(/[^\w]+/g, '-')}-results.csv`, await ops.resultsCsv(id)); }, 'Results CSV downloaded.')}>Export results CSV</button><a className="btn sm" href={'#/leaderboard/' + id}>Open leaderboard</a>{role === 'admin' && <button className="btn sm" onClick={() => setOpen(open === 'rev' ? '' : 'rev')}>{open === 'rev' ? 'Hide written answers' : 'Review written answers'}</button>}</div>}
        {st === 'released' && open === 'rev' && <WrittenReview id={id} item={item} quiz={null} />}
      </div>}

      {(st === 'scheduled' || st === 'live') && can && <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Announcement</div><div className="box2" style={{ whiteSpace: 'pre-wrap' }}>{msg}</div><div className="row"><button className="btn sm" onClick={() => copy(msg, toast)}>Copy Chat message</button><a className="btn sm" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`}>Open email draft in Gmail</a>{gas && <button className="btn sm s" onClick={() => run('ann', async () => { await ops.queueOutbox('chat', { text: msg }, user); await ops.queueOutbox('emailDraft', { subject, body: msg }, user); await ops.markOp(id, 'announceAt', user, 'Queued announcement'); }, 'Announcement queued for Chat and an email draft.')}>Send to Chat and email</button>}</div></div>}

      {item.allowReviewRequests && <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Review requests</div>{reviews.loading ? <Spinner /> : (reviews.data || []).length === 0 ? <div className="muted">No requests yet.</div> : reviews.data.map((r) => <div key={r.id} className="box2" style={{ whiteSpace: 'normal' }}><div className="row between"><b style={{ fontWeight: 500 }}>{r.email} · {r.qid}</b><span className="row center"><Chip tone={r.status === 'open' ? 'warn' : 'ok'}>{r.status}</Chip>{r.status === 'open' && can && <button className="btn sm" onClick={async () => { await ops.resolveReview(r, 'done', user); toast('Request closed.'); reviews.reload(); }}>Mark done</button>}</span></div><div className="fg2" style={{ marginTop: 6 }}>{r.note}</div></div>)}</div>}

      <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Who can edit</div><div className="fg2 mb">Owner: {item.ownerEmail}. Editors: {(item.editors || []).join(', ') || 'none'}.</div>
        {role === 'admin' && <div className="row"><button className="btn sm s" onClick={async () => { const e = await ask({ title: 'Add an editor', input: { label: 'Creator email', placeholder: 'name@databeat.io', required: true }, ok: 'Add editor' }); if (e) run('ed', () => ops.setEditors(id, Array.from(new Set([...(item.editors || []), e.trim().toLowerCase()])), user, item.title), 'Editor added.'); }}>Add editor</button>{(item.editors || []).map((e) => <button key={e} className="btn sm" onClick={() => run('ed', () => ops.setEditors(id, item.editors.filter((x) => x !== e), user, item.title), 'Editor removed.')}>Remove {e}</button>)}</div>}
      </div>

      <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Recent changes</div>{log.loading ? <Spinner /> : (log.data || []).filter((l) => l.detail.includes(item.title)).slice(0, 8).map((l) => <div key={l.id} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}><span>{l.action}<span className="muted small"> · {l.by}</span><div className="muted small">{l.detail}</div></span><span className="muted small">{fmtDateTime(l.at)}</span></div>)}{!log.loading && !(log.data || []).some((l) => l.detail.includes(item.title)) && <div className="muted">Nothing logged for this quiz yet.</div>}</div>

      {can && !item.published && <div className="card mt warn"><div className="fg2 mb">This quiz is a draft and hasn't been published.</div><button className="btn sm danger" onClick={async () => { if (await ask({ title: 'Delete this draft?', body: 'This can\'t be undone.', ok: 'Delete draft', danger: true })) { await ops.deleteDraft(id, user, item.title); await reload(); location.hash = '#/manage'; } }}>Delete draft</button></div>}
    </div>
  );
}
