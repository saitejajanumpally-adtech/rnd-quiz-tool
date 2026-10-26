import React, { useEffect, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { quizStatus, STATUS_LABEL, ownerLabel } from '../lib/quizModel.js';
import * as ops from '../lib/ops.js';
import { parseWrittenUpload, SCORING_COLUMNS, CLAUDE_MESSAGE } from '../lib/written.js';
import { buildImportTemplate, parseImportUpload } from '../lib/importAnswers.js';
import { Bolt } from '../components/mascots.jsx';
import { download } from '../lib/csv.js';
import { fmtDateTime, fmtRange, toInputValue, fromInputValue, rangeStart } from '../lib/time.js';
import { Spinner, ErrorBox, useAsync, Chip, Tile, Seg } from '../components/ui.jsx';

// Shown on a quiz's Manage page to its owner/admins: pending requests from other creators asking for edit access.
function AccessRequests({ id, item, user, toast }) {
  const { data, loading, reload } = useAsync(() => ops.listAccessRequests(), [id]);
  const mine = (data || []).filter((r) => r.quizId === id);
  const resolve = async (r, grant) => {
    try { await ops.resolveAccess(r, grant, { [id]: item }, user); toast(grant ? `Granted ${r.email} edit access.` : 'Request declined.'); reload(); }
    catch (e) { toast('That didn\'t work. ' + (e.message || ''), 'err'); }
  };
  if (loading || mine.length === 0) return null;
  return (
    <div className="mt" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div className="lab" style={{ marginBottom: 8 }}>Pending edit access requests</div>
      {mine.map((r) => <div key={r.id} className="row between center" style={{ padding: '6px 0' }}><span>{r.email}</span><span className="row" style={{ gap: 8 }}><button className="btn sm s" onClick={() => resolve(r, true)}>Grant</button><button className="btn sm" onClick={() => resolve(r, false)}>Decline</button></span></div>)}
    </div>
  );
}

const TONE = { draft: '', scheduled: 'info', live: 'ok', closed: 'warn', released: 'ok' };
const copy = async (t, toast) => { try { await navigator.clipboard.writeText(t); toast('Copied.'); } catch (e) { toast('Copy failed. Select the text and copy it by hand.', 'err'); } };

const DATE_RANGES = [['all', 'All time'], ['quarter', 'This quarter'], ['m6', 'Last 6 months'], ['m12', 'Last 12 months']];
export function ManageList() {
  const { role, user, index, now, toast, ask, reload } = useApp(); const isAdmin = role === 'admin';
  const [tab, setTab] = useState('active'); const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('all'); const [range, setRange] = useState('all'); const [who, setWho] = useState('');
  const allItems = Object.values(index).sort((a, b) => b.opens - a.opens);
  const from = range === 'all' ? 0 : rangeStart(range, now);
  const items = allItems.filter((i) => (status === 'all' || quizStatus(i, now) === status) && i.opens >= from && ownerLabel(i).toLowerCase().includes(who.toLowerCase()));
  const rel = allItems.filter((i) => i.released);
  const avgSub = rel.length ? Math.round(rel.reduce((a, i) => a + (i.submittedCount || 0), 0) / rel.length) : 0;
  const avgScore = rel.length ? (rel.reduce((a, i) => a + (i.avgScore || 0), 0) / rel.length).toFixed(1) : '–';
  const arch = useAsync(() => (isAdmin ? ops.loadArchivedIndex() : {}), [isAdmin, allItems.length]);
  const archived = Object.values(arch.data || {}).sort((a, b) => b.opens - a.opens).filter((i) => i.opens >= from && ownerLabel(i).toLowerCase().includes(who.toLowerCase()));
  const act = async (i, name, fn, okMsg) => { setBusy(i.id + name); try { await fn(); await reload(); arch.reload(); toast(okMsg); } catch (e) { toast('That didn\'t work. ' + (e.message || ''), 'err'); } setBusy(''); };
  const archive = async (i) => { if (await ask({ title: 'Archive this quiz?', body: 'It leaves the Quiz library and the leaderboards, and stops counting towards everyone\'s points, streaks and averages. Only admins can still see it, and you can restore it any time. Nothing is deleted.', ok: 'Archive quiz' })) act(i, 'a', () => ops.setArchived(i.id, true, user, i.title), 'Quiz archived.'); };
  const restore = (i) => act(i, 'r', () => ops.setArchived(i.id, false, user, i.title), 'Quiz restored.');
  const del = async (i) => {
    const typed = await ask({ title: 'Delete this quiz?', body: `This permanently deletes "${i.title}" and every response, score and leaderboard entry for it — it disappears from each participant's own history too. This can't be undone. Archive it instead if you want to keep that history.\n\nType the quiz's exact name to confirm.`, input: { label: 'Quiz name', placeholder: i.title, required: true }, ok: 'Delete quiz', danger: true });
    if (typed === null) return;
    if (typed.trim() !== i.title.trim()) { toast('That didn\'t match the quiz name exactly. Nothing was deleted.', 'err'); return; }
    act(i, 'd', () => ops.deleteQuiz(i.id, user, i.title), 'Quiz deleted.');
  };
  return (
    <div className="pan mt">
      <div className="row between center mb"><div className="h2">Manage quizzes</div><a className="btn p" href="#/edit/new">New quiz</a></div>
      <div className="row mb"><Tile label="Quizzes conducted" value={rel.length} /><Tile label="Average submissions" value={rel.length ? avgSub : '–'} /><Tile label="Average score" value={avgScore} unit={rel.length ? '/ 10' : ''} /></div>
      {isAdmin && <div className="subtabs"><button className={'btn sm ' + (tab === 'active' ? 's' : '')} aria-pressed={tab === 'active'} onClick={() => setTab('active')}>Active · {allItems.length}</button><button className={'btn sm ' + (tab === 'archived' ? 's' : '')} aria-pressed={tab === 'archived'} onClick={() => setTab('archived')}>Archived · {Object.keys(arch.data || {}).length} <span className="muted" style={{ fontSize: 11 }}>(admins only)</span></button></div>}
      {allItems.length > 8 && <div className="row center mb" style={{ gap: 20, flexWrap: 'wrap', marginTop: 10 }}>
        {tab === 'active' && <div><div className="lab" style={{ marginBottom: 6 }}>Status</div><Seg value={status} options={[['all', 'All'], ['draft', 'Draft'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['closed', 'Closed'], ['released', 'Released']]} onChange={setStatus} /></div>}
        <div><div className="lab" style={{ marginBottom: 6 }}>Opened</div><Seg value={range} options={DATE_RANGES} onChange={setRange} /></div>
        <div className="field" style={{ minWidth: 200 }}><label>Created by</label><input className="input" placeholder="Search by name or email" aria-label="Filter by creator" value={who} onChange={(e) => setWho(e.target.value)} /></div>
      </div>}
      {tab === 'active' && <div className="card"><div className="scroll"><table className="tbl"><thead><tr><th>Quiz</th><th>Status</th><th>Created by</th><th>Dates</th><th className="num">Submitted</th><th /></tr></thead><tbody>
        {items.length === 0 && allItems.length === 0 && <tr><td colSpan="6"><div className="row center" style={{ gap: 16 }}><Bolt moment="noQuizzes" card={false} size={96} /><span className="muted">No quizzes yet. Create the first one.</span></div></td></tr>}
        {items.length === 0 && allItems.length > 0 && <tr><td colSpan="6" className="muted">No quizzes match these filters.</td></tr>}
        {items.map((i) => { const st = quizStatus(i, now); return (
          <tr key={i.id}><td><a href={'#/manage/' + i.id} style={{ color: 'var(--fg)', fontWeight: 500 }}>{i.title || 'Untitled'}</a></td><td><Chip tone={TONE[st]}>{STATUS_LABEL[st]}</Chip></td><td className="fg2">{ownerLabel(i)}</td><td className="fg2">{i.opens ? fmtRange(i.opens, i.closes) : '–'}</td><td className="num">{i.released ? i.submittedCount : '–'}</td>
            <td style={{ textAlign: 'right' }}><span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><a className="btn sm s" href={'#/manage/' + i.id}>{st === 'closed' ? 'Release checklist' : 'Open'}</a>{isAdmin && <button className="btn sm" disabled={!!busy} onClick={() => archive(i)}>Archive</button>}{isAdmin && <button className="btn sm danger" disabled={!!busy} onClick={() => del(i)}>Delete</button>}</span></td></tr>); })}
      </tbody></table></div></div>}
      {tab === 'archived' && isAdmin && <div className="card"><div className="row between center mb"><div className="lab">Archived quizzes · admins only</div><Chip>Hidden from everyone else</Chip></div><div className="scroll"><table className="tbl"><thead><tr><th>Quiz</th><th>Created by</th><th>Archived on</th><th className="num">Submitted</th><th /></tr></thead><tbody>
        {arch.loading && <tr><td colSpan="5"><Spinner /></td></tr>}
        {!arch.loading && archived.length === 0 && Object.keys(arch.data || {}).length === 0 && <tr><td colSpan="5" className="muted">Nothing archived. Archive a quiz from the Active tab to hide it everywhere.</td></tr>}
        {!arch.loading && archived.length === 0 && Object.keys(arch.data || {}).length > 0 && <tr><td colSpan="5" className="muted">No archived quizzes match these filters.</td></tr>}
        {archived.map((i) => <tr key={i.id}><td className="fg2">{i.title}</td><td className="muted">{ownerLabel(i)}</td><td className="muted">{i.archivedAt ? fmtDateTime(i.archivedAt) : '–'}</td><td className="num muted">{i.released ? i.submittedCount : '–'}</td><td style={{ textAlign: 'right' }}><span className="row" style={{ justifyContent: 'flex-end', gap: 8 }}><button className="btn sm s" disabled={!!busy} onClick={() => restore(i)}>Restore</button><button className="btn sm danger" disabled={!!busy} onClick={() => del(i)}>Delete</button></span></td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}

// Export, score in Claude, upload. One self-contained file, with the rubric inside and plain-language checks.
function WrittenScoring({ id, item, run, busy }) {
  const { toast, user } = useApp(); const [up, setUp] = useState(null); const [cols, setCols] = useState(false);
  const slug = item.title.replace(/[^\w]+/g, '-');
  const doExport = () => run('export', async () => { const ex = await ops.exportWrittenFor(id); download(`${slug}-written-answers.csv`, ex.csv); return ex.count; }, (n) => `Downloaded ${n} written answers. The instructions and rubric are inside the file.`);
  const check = async (file, opts) => { const text = opts && opts.text ? opts.text : await file.text(); const ex = await ops.exportWrittenFor(id); setUp({ ...parseWrittenUpload(text, ex.keys, opts), total: ex.count, name: (file && file.name) || (opts && opts.name), text, keys: ex.keys }); };
  return (
    <div style={{ marginTop: 8 }}>
      <div className="row"><button className="btn sm s" disabled={!!busy} onClick={doExport}>Export for scoring</button><button className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(CLAUDE_MESSAGE); toast('Copied. Paste it into Claude with the file.'); } catch (e) { toast('Copy failed. Select the text and copy it by hand.', 'err'); } }}>Copy message for Claude</button><label className="btn sm s" style={{ cursor: 'pointer' }}>Upload scored CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { check(e.target.files[0]); e.target.value = ''; }} /></label><button className="btn sm" onClick={() => setCols(!cols)}>{cols ? 'Hide' : 'What each column means'}</button></div>
      <div className="muted small" style={{ marginTop: 6 }}>1. Export the file. 2. Give it to Claude with the message, and ask for the same file back with the score, feedback and flag columns filled in. 3. Upload it here. Nothing else needs to change.</div>
      {cols && <div className="box2" style={{ marginTop: 10, whiteSpace: 'normal' }}><div className="scroll"><table className="tbl"><thead><tr><th>Column</th><th>Who fills it</th><th>Needed?</th><th>What it is</th></tr></thead><tbody>{SCORING_COLUMNS.map((c) => <tr key={c.name}><td className="mono" style={{ color: 'var(--accent)' }}>{c.name}</td><td><Chip tone={c.who === 'You' ? 'teal' : ''}>{c.who}</Chip></td><td className="small fg2">{c.need}</td><td className="small fg2">{c.what}</td></tr>)}</tbody></table></div></div>}
      {up && <div className="box2" style={{ marginTop: 10, whiteSpace: 'normal' }}><b style={{ fontWeight: 500 }}>{up.name}</b>: {up.ok.length} of {up.total} scores are ready{up.flagged ? `, ${up.flagged} flagged` : ''}.
        {up.missing.length > 0 && <div style={{ color: 'var(--warn)' }}>{up.missing.length} answers have no score yet. The release stays blocked until each one has a score (use Change score to give a 0).</div>}
        {up.errors.slice(0, 8).map((e, i) => <div key={i} style={{ color: 'var(--danger)' }}>{e}</div>)}{up.errors.length > 8 && <div className="muted">…and {up.errors.length - 8} more problems.</div>}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm p" disabled={!up.ok.length || up.errors.length > 0} onClick={() => run('save', async () => { await ops.saveWrittenScores(id, up.ok, user, item.title); await ops.calculate(id, user); setUp(null); }, 'Scores saved and totals recalculated.')}>{up.errors.length ? 'Fix the file to continue' : 'Save scores'}</button>
          {up.stepIssues > 0 && <button className="btn sm s" onClick={() => check(null, { roundHalf: true, text: up.text, name: up.name })}>Round {up.stepIssues} {up.stepIssues === 1 ? 'score' : 'scores'} to the nearest 0.5</button>}
          <button className="btn sm" onClick={() => setUp(null)}>Discard</button></div></div>}
    </div>
  );
}

// Shared by WrittenReview and the Review requests card: prompts for a new score + a reason, saves it.
// Returns true on success so a caller doing something else afterward (like closing a request) knows to proceed.
async function changeWrittenScore({ id, row, item, user, toast, ask, silent }) {
  const s = await ask({ title: 'Change this score', body: `${row.name} · maximum ${row.max} points. Scores go in steps of 0.5.`, input: { label: 'New score', initial: row.score === null ? '' : String(row.score), required: true }, ok: 'Next' }); if (s === null) return false;
  const n = Number(s); if (Number.isNaN(n) || n < 0 || n > row.max || Math.abs(n * 2 - Math.round(n * 2)) > 1e-9) { toast(`Enter a number from 0 to ${row.max} in steps of 0.5.`, 'err'); return false; }
  const reason = await ask({ title: 'Why are you changing it?', body: 'The reason is saved in the change log.', input: { label: 'Reason', multiline: true, required: true }, ok: 'Save score' }); if (!reason) return false;
  try { await ops.overrideWritten(id, row, n, row.feedback, reason, user, item.title); if (!silent) toast('Score saved. Recalculate to update totals.'); return true; }
  catch (e) { toast('Couldn\'t save that score.', 'err'); return false; }
}

// Shown on a quiz's Manage page: participants' requests to have a written-answer score re-checked.
// "Change score" opens their actual answer and saves a new score (the same action available from
// Review flagged answers); "Mark done" alone is for requests where the existing score stands.
function ReviewRequests({ id, item, user, toast, ask, can }) {
  const { data, loading, reload } = useAsync(() => ops.listReviewRequests(id), [id]);
  const open = (data || []).filter((r) => r.status === 'open');
  const changeScore = async (r) => {
    try {
      const rows = await ops.loadWrittenReview(id);
      const row = rows.find((x) => x.uid === r.uid && x.qid === r.qid);
      if (!row) { toast('Couldn\'t find that answer anymore — it may belong to a question that was changed.', 'err'); return; }
      const ok = await changeWrittenScore({ id, row, item, user, toast, ask, silent: true });
      if (ok) { await ops.resolveReview(r, 'done', user); toast('Score updated and the request closed.'); reload(); }
    } catch (e) { toast('That didn\'t work. ' + (e.message || ''), 'err'); }
  };
  const markDone = async (r) => { await ops.resolveReview(r, 'done', user); toast('Request closed.'); reload(); };
  return (
    <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Review requests{open.length > 0 ? ` · ${open.length} open` : ''}</div>
      {loading ? <Spinner /> : (data || []).length === 0 ? <div className="muted">No requests yet.</div> : data.map((r) => <div key={r.id} className="box2" style={{ whiteSpace: 'normal' }}>
        <div className="row between"><b style={{ fontWeight: 500 }}>{r.email} · {r.qid}</b><span className="row center" style={{ gap: 8 }}><Chip tone={r.status === 'open' ? 'warn' : 'ok'}>{r.status}</Chip>
          {r.status === 'open' && can && <button className="btn sm s" onClick={() => changeScore(r)}>Change score</button>}
          {r.status === 'open' && can && <button className="btn sm" onClick={() => markDone(r)}>Mark done, no change</button>}
        </span></div>
        <div className="fg2" style={{ marginTop: 6 }}>{r.note}</div>
      </div>)}
    </div>
  );
}

// Admin-only: backfill a quiz that happened before it was run in this tool (or outside it). Writes real
// responses so Calculate scores, written scoring and release all work exactly as for a live quiz.
function ImportAnswers({ id, item, quiz, user, toast, run }) {
  const [up, setUp] = useState(null);
  const pend = useAsync(() => ops.listPendingImports(id), [id]);
  if (!quiz) return null;
  const onFile = async (f) => {
    if (!f) return;
    const { rows, errors } = parseImportUpload(await f.text(), quiz);
    setUp({ rows, errors, name: f.name });
  };
  const doImport = () => run('import', () => ops.importPastResponses(id, up.rows, user, item.title), (r) => {
    setUp(null); pend.reload();
    return `Imported ${r.imported} ${r.imported === 1 ? 'participant' : 'participants'} now.${r.pending.length ? ` ${r.pending.length} haven't signed into the tool yet — their answers are held and will apply automatically the moment they do (checked every 5 minutes): ${r.pending.join(', ')}.` : ''}`;
  });
  return (
    <div className="card mt"><div className="h3" style={{ marginBottom: 4 }}>Import participant answers</div>
      <div className="fg2" style={{ marginBottom: 8 }}>For a quiz that happened before it was run in this tool. Download the template, fill in what each person actually answered, then upload it — scores, the leaderboard and everyone's own history all work exactly as if they'd taken it live. Anyone who hasn't signed into the tool yet is held as a pending import and applies itself automatically the moment they do — no need to re-upload.</div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm s" onClick={() => download(`${item.title.replace(/[^\w]+/g, '-')}-import-template.csv`, buildImportTemplate(quiz))}>Download template</button>
        <label className="btn sm" style={{ cursor: 'pointer' }}>Upload filled-in file<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} /></label>
      </div>
      {up && <div className="box2" style={{ marginTop: 10, whiteSpace: 'normal' }}>
        <b style={{ fontWeight: 500 }}>{up.name}</b>: {up.rows.length} {up.rows.length === 1 ? 'row is' : 'rows are'} ready to import.{up.errors.length ? ` ${up.errors.length} ${up.errors.length === 1 ? 'row has a problem' : 'rows have a problem'} and were left out — fix and re-upload just those.` : ''}
        {up.errors.slice(0, 10).map((e, i) => <div key={i} style={{ color: 'var(--danger)' }}>{e}</div>)}
        {up.errors.length > 10 && <div className="muted">…and {up.errors.length - 10} more.</div>}
        <div className="row" style={{ marginTop: 8 }}><button className="btn sm p" disabled={!up.rows.length} onClick={doImport}>Import {up.rows.length || ''} {up.rows.length === 1 ? 'participant' : 'participants'}</button><button className="btn sm" onClick={() => setUp(null)}>Discard</button></div>
      </div>}
      {!pend.loading && (pend.data || []).length > 0 && <div className="muted small" style={{ marginTop: 10 }}>Still waiting for a sign-in: {pend.data.map((p) => p.email).join(', ')}.</div>}
    </div>
  );
}

function WrittenReview({ id, item, quiz }) {
  const { user, toast, ask } = useApp(); const [f, setF] = useState('flag'); const [page, setPage] = useState(0);
  const { loading, data, error, reload } = useAsync(() => ops.loadWrittenReview(id), [id]);
  if (error) return <ErrorBox error={error} />; if (loading || !data) return <Spinner />;
  const rows = data.filter((r) => f === 'all' || (f === 'flag' && (r.flag || r.score === null)) || (f === 'over' && r.overridden));
  const per = 10;
  const override = async (r) => { const ok = await changeWrittenScore({ id, row: r, item, user, toast, ask }); if (ok) reload(); };
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
  const [busy, setBusy] = useState(''); const [counts, setCounts] = useState(null); const [open, setOpen] = useState('');
  const justPublished = (() => { try { return sessionStorage.getItem('arena-published') === id; } catch (e) { return false; } })();
  useEffect(() => { if (justPublished) { try { sessionStorage.removeItem('arena-published'); } catch (e) { /* ignore */ } } }, []); // eslint-disable-line
  const [closesIn, setClosesIn] = useState(item ? toInputValue(item.closes) : '');
  const st = item ? quizStatus(item, now) : 'none'; const can = item ? ops.canEditQuiz(role, user.email, item) : false;
  const log = useAsync(() => ops.loadChangeLog(60), [id]);
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

  return (
    <div className="pan mt">
      <a href="#/manage" className="fg2">← Manage quizzes</a>
      <div className="row between center" style={{ margin: '12px 0 18px' }}>
        <div><div className="h2">{item.title}</div><div className="fg2" style={{ marginTop: 2 }}>{item.opens ? fmtRange(item.opens, item.closes) : ''} · Created by {ownerLabel(item)}</div></div>
        <div className="row center"><Chip tone={TONE[st]}>{STATUS_LABEL[st]}</Chip>{can && <a className="btn sm s" href={'#/edit/' + id}>Edit</a>}{st === 'live' && <a className="btn sm" href={'#/quiz/' + id}>Preview as participant</a>}{item.released && <a className="btn sm" href={'#/library/' + id}>View answer key</a>}</div>
      </div>
      {justPublished && <div className="mb"><Bolt moment="published" vars={{ title: item.title }} /></div>}

      {(st === 'live' || st === 'closed') && <div className="card mt"><div className="lab" style={{ marginBottom: 10 }}>{st === 'live' ? 'Live' : 'Closed'}</div>
        <div className="row"><Tile label="Submitted" value={counts ? counts.submitted : '–'} /><Tile label="Started" value={counts ? counts.started : '–'} /></div>
        {can && st === 'live' && <div className="row center" style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="cl">Closes (IST)</label><input id="cl" className="input" type="datetime-local" value={closesIn} onChange={(e) => setClosesIn(e.target.value)} /></div>
          <button className="btn sm s" style={{ marginTop: 18 }} onClick={() => { const ms = fromInputValue(closesIn); if (!ms || ms <= now) { toast('Pick a time in the future.', 'err'); return; } run('close', () => ops.setCloses(id, ms, user, item.title), 'Close time updated.'); }}>Change close time</button>
          <button className="btn sm danger" style={{ marginTop: 18 }} onClick={async () => { if (await ask({ title: 'Close the quiz now?', body: 'Participants can no longer answer or submit. This can\'t be undone.', ok: 'Close now', danger: true })) run('closenow', () => ops.setCloses(id, now - 1000, user, item.title), 'Quiz closed.'); }}>Close now</button>
        </div>}
        {st === 'live' && <div className="row" style={{ marginTop: 14 }}><button className="btn sm" onClick={() => copy(`Reminder: ${item.title} closes ${fmtDateTime(item.closes)}. Take it here: ${vars.link}`, toast)}>Copy reminder for Chat</button>{gas && <button className="btn sm" onClick={() => run('rem', () => ops.queueOutbox('chat', { text: `Reminder: ${item.title} closes ${fmtDateTime(item.closes)}. Take it here: ${vars.link}` }, user), 'Reminder queued for Google Chat.')}>Send reminder to Chat</button>}</div>}
      </div>}

      {(st === 'closed' || st === 'released') && role === 'admin' && <ImportAnswers id={id} item={item} quiz={quizDoc.data} user={user} toast={toast} run={run} />}

      {(st === 'closed' || st === 'released') && can && <div className={'card mt ' + (st === 'closed' ? 'warn' : '')}>
        <div className="h3" style={{ marginBottom: 4 }}>Release checklist</div><div className="fg2" style={{ marginBottom: 8 }}>Everything must be done before results and the answer key reach participants.</div>
        {cl.steps.map((s) => <div key={s.id} className={'check' + (s.done ? ' done' : '')}><span className="box3">{s.done ? '✓' : ''}</span><div style={{ flex: 1 }}><div>{s.label}</div><div className="muted small">{{ closed: `Closed ${fmtDateTime(item.closes)}`, calc: o.calcAt ? `Last calculated ${fmtDateTime(o.calcAt)}${item.submittedCount ? ` · ${item.submittedCount} participants` : ''}` : 'Scores multiple choice and analytical answers, and counts auto-submitted answers', written: o.writtenAt ? 'Every written answer has a score' : 'Export written answers, score them in Claude, upload the CSV. This ticks when every written answer has a score.', reviewed: 'Look at flagged answers and change scores if needed', backup: o.backupAt ? `Backed up ${fmtDateTime(o.backupAt)}` : 'Download a copy of every response', announce: 'Review the Chat message and email draft' }[s.id]}</div>
          {s.id === 'calc' && st === 'closed' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm s" disabled={!!busy} onClick={() => run('calc', () => ops.calculate(id, user), (r) => `Scored ${r.count} participants${r.auto ? `, ${r.auto} auto-submitted` : ''}${r.unscored ? `. ${r.unscored} written answers still need scores` : ''}.`)}>{busy === 'calc' ? 'Calculating…' : o.calcAt ? 'Recalculate' : 'Calculate scores'}</button></div>}
          {s.id === 'written' && st === 'closed' && <WrittenScoring id={id} item={item} run={run} busy={busy} />}
          {s.id === 'reviewed' && st === 'closed' && <div style={{ marginTop: 8 }}><div className="row"><button className="btn sm s" onClick={() => setOpen(open === 'rev' ? '' : 'rev')}>{open === 'rev' ? 'Hide answers' : 'Review answers'}</button><button className="btn sm" onClick={() => run('rd', () => ops.markOp(id, 'reviewedAt', user, 'Marked review done'), 'Review marked as done.')}>{o.reviewedAt ? 'Marked done' : 'Mark review done'}</button></div>{open === 'rev' && <WrittenReview id={id} item={item} quiz={null} />}</div>}
          {s.id === 'backup' && st === 'closed' && <div className="row" style={{ marginTop: 8 }}><button className="btn sm s" onClick={() => run('bk', async () => { download(`${item.title.replace(/[^\w]+/g, '-')}-responses.csv`, await ops.backupCsv(id)); await ops.markOp(id, 'backupAt', user, 'Downloaded response backup'); }, 'Backup downloaded.')}>Download backup CSV</button>{gas && <button className="btn sm s" onClick={() => run('sh', async () => { await ops.queueOutbox('sheetBackup', { quizId: id, title: item.title }, user); await ops.markOp(id, 'backupAt', user, 'Queued Google Sheets backup'); }, 'Backup queued — it will land in your Drive backup folder shortly.')}>Backup to Drive</button>}</div>}
          {s.id === 'backup' && st === 'closed' && !gas && <div className="muted small" style={{ marginTop: 6 }}>Turn on the Apps Script helper (Admin settings → Integrations) to also back up straight to a Drive folder.</div>}
          {s.id === 'announce' && st === 'closed' && <div style={{ marginTop: 8 }}><div className="box2" style={{ whiteSpace: 'pre-wrap' }}>{msg}</div><div className="row"><button className="btn sm" onClick={() => copy(msg, toast)}>Copy Chat message</button><a className="btn sm" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`}>Open email draft in Gmail</a><button className="btn sm s" onClick={() => run('an', () => ops.markOp(id, 'announceAt', user, 'Marked announcement ready'), 'Announcement marked ready.')}>{o.announceAt ? 'Marked ready' : 'Mark ready'}</button></div></div>}
        </div></div>)}
        {st === 'closed' && cl.ready && <div style={{ marginTop: 14 }}><Bolt moment="checklistDone" /></div>}
        {st === 'released' && item.releasedAt && now - item.releasedAt < 3 * 86400000 && <div style={{ marginTop: 14 }}><Bolt moment="released" /></div>}
        {st === 'closed' && <div className="row between center" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}><div className="fg2 small" style={{ maxWidth: 520 }}>Releasing opens each person's score and the answer key. {gas ? 'The release message is queued to Google Chat and email draft.' : 'Copy the release message from the last step.'}</div>
          <div className="row"><button className="btn p" disabled={!cl.ready || !!busy} onClick={async () => { if (await ask({ title: 'Release results?', body: 'Participants will see their scores and the answer key.', ok: 'Release' })) run('rel', async () => { await ops.release(id, user, item.title, false); if (gas) { await ops.queueOutbox('chat', { text: ops.buildMessage(quizDoc.data.releaseMsg, { ...item }) }, user); await ops.queueOutbox('emailDraft', { subject: 'Results are out: ' + item.title, body: ops.buildMessage(quizDoc.data.releaseMsg, { ...item }) }, user); } }, 'Results released.'); }}>{cl.ready ? 'Release to participants' : `${cl.steps.filter((s) => !s.done).length} steps left`}</button>
            {role === 'admin' && !cl.ready && <button className="btn danger" onClick={async () => { if (await ask({ title: 'Release without finishing the checklist?', body: 'Scores may be incomplete. This is recorded in the change log.', ok: 'Release anyway', danger: true })) run('rel', () => ops.release(id, user, item.title, true), 'Results released.'); }}>Release anyway</button>}</div></div>}
        {st === 'released' && <div className="row" style={{ marginTop: 14 }}><button className="btn sm s" onClick={() => run('csv', async () => { download(`${item.title.replace(/[^\w]+/g, '-')}-results.csv`, await ops.resultsCsv(id)); }, 'Results CSV downloaded.')}>Export results CSV</button><a className="btn sm" href={'#/leaderboard/' + id}>Open leaderboard</a>{role === 'admin' && <button className="btn sm" onClick={() => setOpen(open === 'rev' ? '' : 'rev')}>{open === 'rev' ? 'Hide written answers' : 'Review written answers'}</button>}</div>}
        {st === 'released' && open === 'rev' && <WrittenReview id={id} item={item} quiz={null} />}
      </div>}

      {(st === 'scheduled' || st === 'live') && can && <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Announcement</div><div className="box2" style={{ whiteSpace: 'pre-wrap' }}>{msg}</div><div className="row"><button className="btn sm" onClick={() => copy(msg, toast)}>Copy Chat message</button><a className="btn sm" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`}>Open email draft in Gmail</a>{gas && <button className="btn sm s" onClick={() => run('ann', async () => { await ops.queueOutbox('chat', { text: msg }, user); await ops.queueOutbox('emailDraft', { subject, body: msg }, user); await ops.markOp(id, 'announceAt', user, 'Queued announcement'); }, 'Announcement queued for Chat and an email draft.')}>Send to Chat and email</button>}</div></div>}

      {item.allowReviewRequests && <ReviewRequests id={id} item={item} user={user} toast={toast} ask={ask} can={can} />}

      <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Who can edit</div>
        <div className="fg2">Admins and {ownerLabel(item)} (the owner) can edit this quiz.{can && item.editors && item.editors.length > 0 ? ' Also shared with:' : ''}</div>
        {can && item.editors && item.editors.length > 0 && <div className="row" style={{ marginTop: 10, gap: 8 }}>{item.editors.map((e) => <span key={e} className="chip teal" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{e}<button aria-label={`Remove ${e}'s access`} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={async () => { try { await ops.setEditors(id, item.editors.filter((x) => x !== e), user, item.title); toast('Access removed.'); reload(); } catch (err) { toast('That didn\'t work.', 'err'); } }}>×</button></span>)}</div>}
        {can && <AccessRequests id={id} item={item} user={user} toast={toast} />}
        <div className="muted small mt">Everyone else can only see this quiz in Manage quizzes, not edit it — they can ask for access from its Edit page.</div>
      </div>

      <div className="card mt"><div className="h3" style={{ marginBottom: 8 }}>Recent changes</div>{log.loading ? <Spinner /> : (log.data || []).filter((l) => l.detail.includes(item.title)).slice(0, 8).map((l) => <div key={l.id} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}><span>{l.action}<span className="muted small"> · {l.by}</span><div className="muted small">{l.detail}</div></span><span className="muted small">{fmtDateTime(l.at)}</span></div>)}{!log.loading && !(log.data || []).some((l) => l.detail.includes(item.title)) && <div className="muted">Nothing logged for this quiz yet.</div>}</div>

      {role === 'admin' && <div className="card mt warn"><div className="lab" style={{ color: 'var(--warn)', marginBottom: 8 }}>Admin only</div><div className="fg2 mb">Archiving hides this quiz from the Quiz library and leaderboards and removes it from everyone's points, streaks and averages. You can restore it later. Nothing is deleted.</div>
        <div className="row"><button className="btn sm" disabled={!!busy} onClick={async () => { if (await ask({ title: 'Archive this quiz?', body: 'It leaves the Quiz library and leaderboards, and stops counting towards points, streaks and averages. Only admins can still see it, and you can restore it any time.', ok: 'Archive quiz' })) run('arch', async () => { await ops.setArchived(id, true, user, item.title); location.hash = '#/manage'; }, 'Quiz archived.'); }}>Archive quiz</button>
          <button className="btn sm danger" disabled={!!busy} onClick={async () => {
            const typed = await ask({ title: 'Delete this quiz?', body: `This permanently deletes "${item.title}" and every response, score and leaderboard entry for it — it disappears from each participant's own history too. This can't be undone. Archive it instead if you want to keep that history.\n\nType the quiz's exact name to confirm.`, input: { label: 'Quiz name', placeholder: item.title, required: true }, ok: 'Delete quiz', danger: true });
            if (typed === null) return;
            if (typed.trim() !== item.title.trim()) { toast('That didn\'t match the quiz name exactly. Nothing was deleted.', 'err'); return; }
            run('del', async () => { await ops.deleteQuiz(id, user, item.title); location.hash = '#/manage'; }, 'Quiz deleted.');
          }}>Delete quiz</button></div></div>}
    </div>
  );
}
