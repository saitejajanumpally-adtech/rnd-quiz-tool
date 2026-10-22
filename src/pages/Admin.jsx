import React, { useState } from 'react';
import { useApp } from '../ctx.jsx';
import * as ops from '../lib/ops.js';
import { parseCsv, toObjects, download } from '../lib/csv.js';
import { fmtDateTime } from '../lib/time.js';
import { STAGES, DEFAULT_THRESHOLDS } from '../lib/stages.js';
import { MASCOTS, Mascot } from '../components/mascots.jsx';
import { buildUsersCsv, usersSummary } from '../lib/usersExport.js';
import { Spinner, ErrorBox, useAsync, Chip, Seg, Switch } from '../components/ui.jsx';

export function RolesPage() {
  const { role, user, toast, ask } = useApp(); const isAdmin = role === 'admin';
  const [email, setEmail] = useState(''); const [newRole, setNewRole] = useState('lead'); const [plan, setPlan] = useState(null); const [q, setQ] = useState('');
  const { loading, data, error, reload } = useAsync(() => ops.listRoles(), []);
  const allowed = isAdmin ? ['lead', 'creator', 'admin'] : ['lead'];
  const can = (r) => isAdmin || r === 'lead';
  const add = async () => {
    const e = email.trim().toLowerCase(); if (!/^[^@\s]+@databeat\.io$/.test(e)) { toast('Enter a @databeat.io email address.', 'err'); return; }
    try { await ops.setRole(e, newRole, user); setEmail(''); toast(`${e} is now a ${ops.ROLE_LABEL[newRole]}.`); reload(); } catch (er) { toast('The database refused that change. ' + (er.message || ''), 'err'); }
  };
  const change = async (r, to) => { try { await ops.setRole(r.email, to, user); toast('Role updated.'); reload(); } catch (er) { toast('The database refused that change.', 'err'); } };
  const remove = async (r) => { if (!(await ask({ title: 'Remove access?', body: `${r.email} will go back to being a Participant. Their quiz history is kept.`, ok: 'Remove access', danger: true }))) return; if (r.role === 'admin' && data.filter((x) => x.role === 'admin').length <= 1 && !isBootstrap(r.email)) { toast('Keep at least one admin.', 'err'); return; } await change(r, 'participant'); };
  const isBootstrap = (e) => false; // the bootstrap admin is not in this list, so it can never be removed here
  const onFile = async (f) => { if (!f) return; const rows = toObjects(parseCsv(await f.text())); setPlan({ name: f.name, ...ops.planBulkRoles(rows, role) }); };
  const apply = async () => { try { await ops.applyBulkRoles(plan.ok, user); toast(`${plan.ok.length} people updated.`); setPlan(null); reload(); } catch (e) { toast('The database refused that upload.', 'err'); } };
  const rows = (data || []).filter((r) => r.email.includes(q.toLowerCase()));
  return (
    <div className="pan mt" style={{ maxWidth: 920, margin: '28px auto 0' }}>
      <div className="h2" style={{ marginBottom: 4 }}>{isAdmin ? 'Roles (everyone)' : 'Roles (leads and participants)'}</div>
      <div className="fg2 mb">Anyone who signs in with a databeat.io account is a Participant, so you only list people who need more access.{!isAdmin && ' Creators can manage Leads. Only admins can grant Creator or Admin access.'}</div>
      <div className="card">
        <div className="row center"><input className="input" style={{ flex: '1 1 260px' }} aria-label="Email" placeholder="name@databeat.io" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><select className="select" style={{ width: 150 }} aria-label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>{allowed.map((r) => <option key={r} value={r}>{ops.ROLE_LABEL[r]}</option>)}</select><button className="btn p" onClick={add}>Add</button></div>
        <div className="row between center" style={{ border: '1px dashed var(--border2)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div><div>Upload a CSV for bulk access</div><div className="muted small" style={{ marginTop: 2 }}>Two columns: email, role. Problems are listed before anything is saved.</div></div>
          <div className="row"><button className="btn sm" onClick={() => download('roles-template.csv', 'email,role\nname@databeat.io,lead\n')}>Download template</button><label className="btn sm s" style={{ cursor: 'pointer' }}>Choose file<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { onFile(e.target.files[0]); e.target.value = ''; }} /></label></div>
        </div>
        {plan && <div className="box2" style={{ marginTop: 12, whiteSpace: 'normal' }}><b style={{ fontWeight: 500 }}>{plan.name}</b>: {plan.ok.length} valid rows.{plan.errors.slice(0, 10).map((e, i) => <div key={i} style={{ color: 'var(--danger)' }}>{e}</div>)}{plan.errors.length > 10 && <div className="muted">…and {plan.errors.length - 10} more.</div>}<div className="row" style={{ marginTop: 8 }}><button className="btn sm p" disabled={plan.errors.length > 0 || !plan.ok.length} onClick={apply}>{plan.errors.length ? 'Fix the file to continue' : `Apply ${plan.ok.length} changes`}</button><button className="btn sm" onClick={() => setPlan(null)}>Discard</button></div></div>}
      </div>
      <div className="card mt"><div className="row between center mb"><div className="lab">People with extra access</div><input className="input" style={{ width: 220 }} aria-label="Search people" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {error && <ErrorBox error={error} />}{loading ? <Spinner /> : <div className="scroll"><table className="tbl"><thead><tr><th>Email</th><th>Role</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead><tbody>
          {rows.length === 0 && <tr><td colSpan="3" className="muted">No one yet. Everyone else is a Participant.</td></tr>}
          {rows.map((r) => <tr key={r.email}><td>{r.email}</td><td><Chip tone={r.role === 'admin' ? 'warn' : r.role === 'creator' ? 'info' : 'teal'}>{ops.ROLE_LABEL[r.role]}</Chip></td><td style={{ textAlign: 'right' }}>{can(r.role) ? <span className="row" style={{ justifyContent: 'flex-end' }}><select className="select" style={{ width: 130, padding: '5px 8px' }} aria-label={`Role for ${r.email}`} value={r.role} onChange={(e) => change(r, e.target.value)}>{allowed.map((x) => <option key={x} value={x}>{ops.ROLE_LABEL[x]}</option>)}</select><button className="btn sm danger" onClick={() => remove(r)}>Remove access</button></span> : <span className="muted small">Admin only</span>}</td></tr>)}
        </tbody></table></div>}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const { settings, user, reload, toast, index } = useApp(); const [tab, setTab] = useState('settings');
  const [th, setTh] = useState(settings.thresholds.map(String)); const [deflt, setDeflt] = useState(settings.defaultMascots || ['robot']); const [editTh, setEditTh] = useState(false); const [busy, setBusy] = useState(false);
  const save = async (patch, msg = 'Saved.') => { try { await ops.saveSettings(patch, user); await reload(); toast(msg); } catch (e) { toast('The database refused that change.', 'err'); } };
  const log = useAsync(() => (tab === 'log' ? ops.loadChangeLog(120) : []), [tab]);
  const out = useAsync(() => (tab === 'int' ? ops.loadOutbox() : []), [tab]);
  const users = useAsync(() => (tab === 'settings' ? ops.usersExportData(index) : null), [tab]);
  const [fq, setFq] = useState('');
  const tabs = [['settings', 'Settings and users'], ['mascots', 'Mascot defaults'], ['int', 'Integrations and scoring'], ['log', 'Change log']];
  const saveTh = () => { const n = th.map(Number); if (n.some(Number.isNaN) || n[0] !== 0 || n.some((v, i) => i && v <= n[i - 1])) { toast('Thresholds must start at 0 and rise at each stage.', 'err'); return; } save({ thresholds: n }); setEditTh(false); };
  const qd = settings.newQuizDefaults || {}; const em = settings.emails || {};
  const exportUsers = async () => {
    setBusy(true);
    try { const d = await ops.usersExportData(index); const day = new Date().toISOString().slice(0, 10); download(`users-${day}.csv`, buildUsersCsv(d.users, d.responses, Date.now())); await ops.log(user, 'Exported users CSV', `${d.users.length} people`); toast('Users CSV downloaded.'); }
    catch (e) { toast('Couldn\'t export the users. ' + (e.message || ''), 'err'); } setBusy(false);
  };
  const Row = ({ title, sub, children }) => <div className="row between center" style={{ padding: '14px 0', borderTop: '1px solid var(--border)', gap: 20, flexWrap: 'nowrap' }}><div style={{ minWidth: 0 }}><div style={{ fontWeight: 500 }}>{title}</div><div className="muted small" style={{ marginTop: 2 }}>{sub}</div></div><div style={{ flex: 'none' }}>{children}</div></div>;
  const Group = ({ title, note, children }) => <div className="card" style={{ padding: 22 }}><div className="lab" style={{ color: 'var(--accent)', marginBottom: 4 }}>{title}</div>{note && <div className="muted small" style={{ marginBottom: 2 }}>{note}</div>}{children}</div>;
  const Sw = ({ on, onChange, label }) => <button className="switch" role="switch" aria-checked={on} aria-label={label} style={{ width: 'auto', border: 0, padding: 0 }} onClick={() => onChange(!on)}><span className={'track' + (on ? ' on' : '')} /></button>;
  const sum = users.data ? usersSummary(users.data.users) : null;
  const Tot = ({ l, v, c }) => <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}><span className="fg2">{l}</span><span className="mono" style={{ fontSize: 18, color: c || 'var(--fg)' }}>{v}</span></div>;
  return (
    <div className="row mt" style={{ gap: 28 }}>
      <div className="col" style={{ flex: '0 0 230px', gap: 6 }}><div className="lab" style={{ margin: '0 0 6px 8px' }}>Admin</div>{tabs.map(([k, l]) => <button key={k} className="sec" style={{ flex: 'none', ...(tab === k ? { background: 'var(--mint-soft)', borderColor: 'var(--primary)' } : { background: 'transparent', borderColor: 'transparent' }) }} onClick={() => setTab(k)}>{l}</button>)}<a className="btn sm" style={{ marginTop: 10 }} href="#/roles">Roles and access</a></div>
      <div style={{ flex: '1 1 560px', minWidth: 0 }} className="pan" key={tab}>
        {tab === 'settings' && <div><div className="h2" style={{ marginBottom: 4 }}>Admin settings</div><div className="fg2 mb">Short and simple. A change takes effect straight away unless it says “new quizzes”.</div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="col" style={{ flex: '999 1 440px', minWidth: 0, gap: 14 }}>
              <Group title="Leaderboard and results">
                <Row title="Full leaderboard" sub="Who can open it. Everyone always sees the Top 10."><Seg value={settings.leaderboardVisibility} options={[['staff', 'Admins and creators'], ['leads', 'Leads and above'], ['everyone', 'Everyone']]} onChange={(v) => save({ leaderboardVisibility: v })} /></Row>
                <Row title="Show rank movement" sub="Arrows against the previous round."><Sw on={settings.showMovement !== false} label="Show rank movement" onChange={(v) => save({ showMovement: v })} /></Row>
              </Group>
              <Group title="Quiz defaults" note="Used when someone creates a new quiz. Existing quizzes keep their own settings.">
                <Row title="Auto-submit at close" sub="Saved answers count as submitted when the quiz closes."><Sw on={!!qd.autoSubmit} label="Auto-submit default" onChange={(v) => save({ newQuizDefaults: { ...qd, autoSubmit: v } })} /></Row>
                <Row title="Review requests" sub="Participants can ask for a written score to be re-checked."><Sw on={!!qd.allowReviewRequests} label="Review requests default" onChange={(v) => save({ newQuizDefaults: { ...qd, allowReviewRequests: v } })} /></Row>
              </Group>
              <Group title="Notifications" note="Saved now. The emails start going out once the email helper (Apps Script) is set up, in the notifications update.">
                <Row title="Closing-day reminder email" sub="One email on the last day, only to people who haven’t submitted."><Sw on={em.closingReminder !== false} label="Closing-day reminder email" onChange={(v) => save({ emails: { ...em, closingReminder: v } })} /></Row>
                <Row title="Answer-released email" sub="One email when answers and results are released."><Sw on={em.releaseNotice !== false} label="Answer-released email" onChange={(v) => save({ emails: { ...em, releaseNotice: v } })} /></Row>
              </Group>
              <Group title="Scoring">
                <Row title="Funnel levels" sub="Points needed for each stage."><span className="row center" style={{ gap: 12 }}><span className="mono fg2">{settings.thresholds.join(' · ')}</span><button className="btn sm s" onClick={() => setEditTh(!editTh)}>{editTh ? 'Close' : 'Edit'}</button></span></Row>
                {editTh && <div style={{ paddingBottom: 6 }}>{STAGES.map((st, i) => <div key={st} className="row center" style={{ padding: '8px 0', flexWrap: 'nowrap' }}><span style={{ flex: 1 }}>{st}</span><span className="muted small">from</span><input className="input" style={{ width: 100 }} aria-label={`Points needed for ${st}`} disabled={i === 0} inputMode="decimal" value={th[i]} onChange={(e) => setTh(th.map((x, j) => (j === i ? e.target.value : x)))} /><span className="muted small">points</span></div>)}
                  <div className="row" style={{ marginTop: 10 }}><button className="btn sm p" onClick={saveTh}>Save thresholds</button><button className="btn sm" onClick={() => { setTh(DEFAULT_THRESHOLDS.map(String)); save({ thresholds: DEFAULT_THRESHOLDS }, 'Reset to the defaults.'); }}>Reset to defaults</button></div></div>}
              </Group>
              <Group title="Team"><Row title="Who can grant Admin" sub="Fixed. Only admins can add other admins."><Chip>Admins only</Chip></Row></Group>
            </div>
            <div className="col" style={{ flex: '1 1 300px', minWidth: 280, gap: 14 }}>
              <div className="card" style={{ padding: 22 }}><div className="lab" style={{ color: 'var(--accent)' }}>Users</div><div className="muted small" style={{ margin: '4px 0 10px' }}>Everyone who has signed in, including people who removed their profile.</div>
                {users.loading ? <Spinner /> : users.error ? <ErrorBox error={users.error} /> : sum && <><Tot l="Total unique sign-ins" v={sum.total} /><Tot l="Active" v={sum.active} c="var(--success)" /><Tot l="Deleted (history kept)" v={sum.deleted} c="var(--warn)" /><Tot l="Signed in within the last 30 days" v={sum.recent30} /></>}
                <button className="btn p" style={{ width: '100%', marginTop: 16 }} disabled={busy || users.loading} onClick={exportUsers}>{busy ? 'Preparing…' : 'Export Users CSV'}</button>
                <div className="muted small" style={{ marginTop: 12 }}>Columns: name, email, status, first sign-in, last sign-in, deleted time, quizzes taken. Times are in IST. The totals are repeated at the top of the file.</div></div>
              <div className="card"><div className="lab">Every change is logged</div><div className="fg2 small" style={{ marginTop: 8 }}>Changes to these settings and each export are recorded in the change log, with who and when.</div></div>
            </div>
          </div></div>}
        <div className="card" style={tab === 'settings' ? { display: 'none' } : undefined}>
        {tab === 'mascots' && <><div className="h3" style={{ marginBottom: 4 }}>Mascot defaults</div><div className="fg2 mb">Used for everyone who hasn't picked their own. Choose several to rotate.</div>
          {MASCOTS.map((m) => { const on = deflt.includes(m.id); return <button key={m.id} className={'opt' + (on ? ' sel' : '')} aria-pressed={on} style={{ padding: '8px 14px' }} onClick={() => setDeflt(on ? deflt.filter((x) => x !== m.id) : [...deflt, m.id])}><Mascot id={m.id} pose="wave" size={56} still /><span className="t" style={{ color: 'var(--fg)' }}>{m.name}</span><i style={{ color: 'var(--muted)' }}>{on ? 'SELECTED' : 'OFF'}</i></button>; })}
          <button className="btn p" style={{ marginTop: 8 }} disabled={!deflt.length} onClick={() => save({ defaultMascots: deflt })}>Save defaults</button></>}
        {tab === 'int' && <><div className="h3" style={{ marginBottom: 4 }}>Integrations and scoring</div>
          <div className="fg2" style={{ marginBottom: 8 }}>The Google Apps Script helper posts to Google Chat, creates email drafts, and copies responses to Google Sheets. Without it, every one of these steps still works by copying the message or downloading a file.</div>
          <Switch on={!!(settings.integrations && settings.integrations.gas)} onChange={(v) => save({ integrations: { ...(settings.integrations || {}), gas: v } }, v ? 'Helper turned on. Make sure the script is set up.' : 'Helper turned off.')} title="Apps Script helper is set up" sub="Turn this on only after finishing the setup guide, so jobs don't wait with nobody to run them." />
          <div className="lab" style={{ margin: '18px 0 8px' }}>Scoring written answers</div><div className="fg2">Export, score in Claude, upload. No API key is stored anywhere.</div>
          {settings.integrations && settings.integrations.gas && <><div className="lab" style={{ margin: '18px 0 8px' }}>Recent helper jobs</div>{out.loading ? <Spinner /> : (out.data || []).length === 0 ? <div className="muted">No jobs yet.</div> : out.data.map((j) => <div key={j.id} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}><span>{j.type}<span className="muted small"> · {j.by}</span>{j.error && <div className="small" style={{ color: 'var(--danger)' }}>{j.error}</div>}</span><span className="row center"><Chip tone={j.status === 'done' ? 'ok' : j.status === 'error' ? 'bad' : 'warn'}>{j.status}</Chip><span className="muted small">{fmtDateTime(j.at)}</span></span></div>)}</>}</>}
        {tab === 'log' && <><div className="row between center mb"><div><div className="h3">Change log</div><div className="fg2">Every override, role change, release and setting change.</div></div><input className="input" style={{ width: 220 }} aria-label="Filter the log" placeholder="Filter" value={fq} onChange={(e) => setFq(e.target.value)} /></div>
          {log.loading ? <Spinner /> : <div className="scroll"><table className="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>{(log.data || []).filter((l) => (l.action + l.detail + l.by).toLowerCase().includes(fq.toLowerCase())).map((l) => <tr key={l.id}><td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.at)}</td><td>{l.by}</td><td>{l.action}<div className="muted small">{l.detail}</div></td></tr>)}</tbody></table></div>}</>}
        </div>
      </div>
    </div>
  );
}
