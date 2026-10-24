import React, { useState } from 'react';
import { useApp } from '../ctx.jsx';
import { summarize } from '../lib/stages.js';
import { ROLE_LABEL } from '../lib/ops.js';
import { MASCOTS, Mascot } from '../components/mascots.jsx';
import { Journey, Tile, Seg, Switch } from '../components/ui.jsx';
import { fmtShort } from '../lib/time.js';

function RemoveDialog({ onCancel, onConfirm, busy }) {
  const Li = ({ ok, children }) => <div className="row center" style={{ gap: 10, padding: '4px 0', alignItems: 'flex-start' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--warn)', flex: 'none', marginTop: 7 }} /><span className="fg2" style={{ minWidth: 0 }}>{children}</span></div>;
  return (
    <div className="modal-bg" onClick={onCancel}><div className="modal" role="dialog" aria-modal="true" aria-label="Remove your profile?" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
      <div className="h3" style={{ fontSize: 22, marginBottom: 6 }}>Remove your profile?</div>
      <div className="lab" style={{ color: 'var(--success)', margin: '14px 0 2px' }}>What stays</div>
      <Li ok>Your answers, scores and results from past quizzes</Li><Li ok>Your place in earlier leaderboards</Li>
      <div className="lab" style={{ color: 'var(--warn)', margin: '12px 0 2px' }}>What changes</div>
      <Li>You’re signed out and can’t answer quizzes until you sign in again</Li><Li>Your name appears greyed, with “Profile removed”, on leaderboards</Li>
      <div className="muted small" style={{ marginTop: 12 }}>Sign in again with the same Google account any time and everything reconnects.</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}><button className="btn" onClick={onCancel}>Cancel</button><button className="btn danger" disabled={busy} onClick={onConfirm}>Remove my profile</button></div>
    </div></div>
  );
}

export default function Profile() {
  const { user, role, index, stats, settings, prefs, savePrefs, now, signOut, removeProfile, toast, openTour } = useApp(); const [tab, setTab] = useState('progress');
  const [removing, setRemoving] = useState(false); const [busy, setBusy] = useState(false);
  const closedIds = Object.values(index).filter((i) => i.published && now >= i.closes).sort((a, b) => a.opens - b.opens).map((i) => i.id);
  const sum = summarize(stats.history, closedIds, Object.keys(index));
  const hist = Object.entries(stats.history).filter(([id]) => index[id]).map(([id, h]) => ({ id, ...h })).sort((a, b) => a.opens - b.opens).slice(-8);
  const chosen = prefs.mascots && prefs.mascots.length ? prefs.mascots : settings.defaultMascots || ['robot'];
  const notify = { opens: true, closing: true, key: true, ...(prefs.notify || {}) };
  const toggleMascot = (id) => { const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; if (next.length) savePrefs({ mascots: next }); };
  const tabs = [['progress', 'My progress'], ['mascots', 'Mascots'], ['notify', 'Notifications'], ['account', 'Account']];
  const first = MASCOTS.find((m) => m.id === chosen[0]) || MASCOTS[0];
  const doRemove = async () => { setBusy(true); try { await removeProfile(); } catch (e) { toast('Couldn\'t remove your profile. ' + (e.message || ''), 'err'); setRemoving(false); } setBusy(false); };
  return (
    <div className="row mt" style={{ gap: 28 }}>
      <div className="col side-tabs" style={{ flex: '0 0 220px', gap: 6 }}>
        <div className="lab" style={{ margin: '0 0 6px 8px' }}>Profile</div>
        {tabs.map(([k, l]) => <button key={k} className="sec" style={{ flex: 'none', ...(tab === k ? { background: 'var(--mint-soft)', borderColor: 'var(--primary)' } : { background: 'transparent', borderColor: 'transparent' }) }} aria-current={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div style={{ flex: '1 1 560px', minWidth: 0 }} className="pan" key={tab}>
        {tab === 'progress' && <div className="col">
          <div className="card"><div className="h3" style={{ marginBottom: 4 }}>My progress</div><div className="fg2">Your journey down the ad request funnel, and how your scores have moved.</div></div>
          <Journey points={sum.points} thresholds={settings.thresholds} />
          <div className="row"><Tile label="Streak" value={sum.streak} unit="rounds" /><Tile label="Average score" value={sum.rounds ? sum.avg.toFixed(1) : '–'} unit="/ 10" /><Tile label="Rounds taken" value={sum.rounds} /><Tile label="Total points" value={sum.points} /></div>
          <div className="card"><div className="lab" style={{ marginBottom: 12 }}>Score history</div>
            {hist.length === 0 ? <div className="muted">Your scores will appear here after your first round.</div> : <div className="vbars">{hist.map((h) => <div key={h.id}><span className="mono small fg2">{h.score}</span><i style={{ height: Math.max(8, (h.score / (h.max || 10)) * 110), background: h === hist[hist.length - 1] ? 'var(--warn)' : 'var(--primary)' }} /><span className="muted" style={{ fontSize: 10 }}>{fmtShort(h.opens)}</span></div>)}</div>}</div>
        </div>}
        {tab === 'mascots' && <div className="col">
          <div className="card" style={{ padding: 26 }}>
            <div className="h2">Meet your quiz companions</div><div className="fg2" style={{ margin: '6px 0 18px' }}>Six personalities. One learning journey. Pick one or more. With several, they take turns each visit.</div>
            <div className="grid3">{MASCOTS.map((m) => { const on = chosen.includes(m.id); const isDefault = (settings.defaultMascots || ['robot']).includes(m.id); return (
              <button key={m.id} className={'pick' + (on ? ' sel' : '')} aria-pressed={on} onClick={() => toggleMascot(m.id)}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, width: '100%', minHeight: 26 }}>{isDefault && <span className="chip teal mono" style={{ fontSize: 11, letterSpacing: '.08em' }}>DEFAULT</span>}{on && <span className="chip ok">Selected</span>}</div>
                <div style={{ marginTop: -6 }}><Mascot id={m.id} pose="wave" size={190} still /></div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{m.short}</div><div className="muted">{m.kind}</div>
              </button>); })}</div>
            <div className="box2" style={{ margin: '16px 0 18px' }}>Rotation: {chosen.length === 1 ? first.short + ' every visit' : chosen.map((i) => MASCOTS.find((m) => m.id === i).short).join(', ') + ' take turns each visit'}</div>
            <div className="lab" style={{ marginBottom: 8 }}>Show mascots</div>
            <Seg value={prefs.mascotMode || 'all'} options={[['all', 'On every screen (default)'], ['moments', 'Key moments only'], ['off', 'Off']]} onChange={(v) => savePrefs({ mascotMode: v })} />
          </div>
          <div className="card"><div className="lab" style={{ color: 'var(--accent)' }}>Preview of {first.short}</div><div className="muted small" style={{ margin: '4px 0 8px' }}>{first.short} in a few moments</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>{[['celebrate', 'Moved up'], ['thinking', 'Reviewing'], ['oops', 'Couldn’t save'], ['sleepy', 'Between rounds']].map(([p, t]) => <div key={p} style={{ flex: '1 1 120px', textAlign: 'center' }}><Mascot id={first.id} pose={p} size={120} still /><div className="small fg2">{t}</div></div>)}</div></div>
        </div>}
        {tab === 'notify' && <div className="card"><div className="h3" style={{ marginBottom: 4 }}>Notifications</div><div className="fg2" style={{ marginBottom: 8 }}>Notices shown at the top of the Arena. Round announcements are also posted to the whole team in Google Chat and email.</div>
          <Switch on={notify.opens} onChange={(v) => savePrefs({ notify: { ...notify, opens: v } })} title="Round opens" sub="Show a notice when a new round starts" />
          <Switch on={notify.closing} onChange={(v) => savePrefs({ notify: { ...notify, closing: v } })} title="Closing reminder" sub="A notice in the last 24 hours if you haven't submitted" />
          <Switch on={notify.key} onChange={(v) => savePrefs({ notify: { ...notify, key: v } })} title="Answer key ready" sub="Show a notice when your score and the answer key are released" /></div>}
        {tab === 'account' && <div className="col">
          <div className="card"><div className="h3" style={{ marginBottom: 14 }}>Account</div>
            {[['Signed in with Google', user.email], ['Name', user.name], ['Role', ROLE_LABEL[role]], ['Rounds taken', sum.rounds]].map(([a, b]) => <div key={a} className="row between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}><span className="fg2">{a}</span><span>{b}</span></div>)}
            <p className="muted small" style={{ margin: '16px 0' }}>Your name comes from your Google account, so it can’t be changed here. Your email identifies your scores. Roles are managed by admins and creators.</p>
            <div className="row"><button className="btn" onClick={signOut}>Sign out</button><button className="btn" onClick={openTour}>Take the tour</button></div></div>
          <div className="card" style={{ borderColor: 'rgba(226,116,90,.35)' }}><div className="lab" style={{ color: 'var(--danger)' }}>Remove my profile</div><p className="fg2" style={{ margin: '8px 0 14px' }}>Remove your sign-in profile from this tool. Your quiz history, scores and results stay, and admins keep them.</p><button className="btn danger" onClick={() => setRemoving(true)}>Remove my profile</button></div>
        </div>}
      </div>
      {removing && <RemoveDialog busy={busy} onCancel={() => setRemoving(false)} onConfirm={doRemove} />}
    </div>
  );
}
