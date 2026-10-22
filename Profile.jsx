import React, { useState } from 'react';
import { useApp } from '../ctx.jsx';
import { summarize } from '../lib/stages.js';
import { ROLE_LABEL } from '../lib/ops.js';
import { MASCOTS, Mascot, Bolt } from '../components/mascots.jsx';
import { Funnel, Tile, Seg, Switch } from '../components/ui.jsx';
import { fmtShort } from '../lib/time.js';

export default function Profile() {
  const { user, role, index, stats, settings, prefs, savePrefs, now, signOut } = useApp(); const [tab, setTab] = useState('progress');
  const closedIds = Object.values(index).filter((i) => i.published && now >= i.closes).sort((a, b) => a.opens - b.opens).map((i) => i.id);
  const sum = summarize(stats.history, closedIds);
  const hist = Object.entries(stats.history).map(([id, h]) => ({ id, ...h })).sort((a, b) => a.opens - b.opens).slice(-8);
  const chosen = prefs.mascots && prefs.mascots.length ? prefs.mascots : settings.defaultMascots || ['robot'];
  const notify = { opens: true, closing: true, key: true, ...(prefs.notify || {}) };
  const toggleMascot = (id) => { const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; if (next.length) savePrefs({ mascots: next }); };
  const tabs = [['progress', 'My progress'], ['mascots', 'Mascots'], ['notify', 'Notifications'], ['account', 'Account']];
  return (
    <div className="row mt" style={{ gap: 28 }}>
      <div className="col" style={{ flex: '0 0 220px', gap: 6 }}>
        <div className="lab" style={{ margin: '0 0 6px 8px' }}>Profile</div>
        {tabs.map(([k, l]) => <button key={k} className="sec" style={{ flex: 'none', ...(tab === k ? { background: 'var(--mint-soft)', borderColor: 'var(--primary)' } : { background: 'transparent', borderColor: 'transparent' }) }} aria-current={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div style={{ flex: '1 1 560px', minWidth: 0 }} className="pan" key={tab}>
        {tab === 'progress' && <div className="col">
          <div className="card"><div className="h3" style={{ marginBottom: 4 }}>My progress</div><div className="fg2">Your journey down the ad request funnel, and how your scores have moved.</div></div>
          <Funnel points={sum.points} thresholds={settings.thresholds} />
          <div className="row"><Tile label="Streak" value={sum.streak} unit="rounds" /><Tile label="Average score" value={sum.rounds ? sum.avg.toFixed(1) : '–'} unit="/ 10" /><Tile label="Rounds taken" value={sum.rounds} /><Tile label="Total points" value={sum.points} /></div>
          <div className="card"><div className="lab" style={{ marginBottom: 12 }}>Score history</div>
            {hist.length === 0 ? <div className="muted">Your scores will appear here after your first round.</div> : <div className="vbars">{hist.map((h) => <div key={h.id}><span className="mono small fg2">{h.score}</span><i style={{ height: Math.max(8, (h.score / (h.max || 10)) * 110), background: h === hist[hist.length - 1] ? 'var(--warn)' : 'var(--primary)' }} /><span className="muted" style={{ fontSize: 10 }}>{fmtShort(h.opens)}</span></div>)}</div>}</div>
        </div>}
        {tab === 'mascots' && <div className="card"><div className="h3" style={{ marginBottom: 4 }}>Mascots</div><div className="fg2 mb">Pick one or more. With several, they take turns each visit.</div>
          {MASCOTS.map((m) => { const on = chosen.includes(m.id); return <button key={m.id} className={'opt' + (on ? ' sel' : '')} aria-pressed={on} onClick={() => toggleMascot(m.id)} style={{ padding: '8px 14px' }}><Mascot id={m.id} size={36} still /><span className="t" style={{ color: 'var(--fg)' }}>{m.name}</span><i style={{ color: 'var(--muted)' }}>{on ? 'SELECTED' : 'OFF'}</i></button>; })}
          <div className="box2" style={{ margin: '12px 0 18px' }}>Rotation: {chosen.length === 1 ? MASCOTS.find((m) => m.id === chosen[0]).short + ' every visit' : chosen.map((i) => MASCOTS.find((m) => m.id === i).short).join(', ') + ' take turns each visit'}</div>
          <div className="lab" style={{ marginBottom: 8 }}>Show mascots</div>
          <Seg value={prefs.mascotMode || 'moments'} options={[['moments', 'Key moments only (default)'], ['all', 'On every screen'], ['off', 'Off']]} onChange={(v) => savePrefs({ mascotMode: v })} />
          <div style={{ marginTop: 18 }}><Bolt moment="welcome" /></div></div>}
        {tab === 'notify' && <div className="card"><div className="h3" style={{ marginBottom: 4 }}>Notifications</div><div className="fg2" style={{ marginBottom: 8 }}>Notices shown at the top of the Arena. Round announcements are also posted to the whole team in Google Chat and email.</div>
          <Switch on={notify.opens} onChange={(v) => savePrefs({ notify: { ...notify, opens: v } })} title="Round opens" sub="Show a notice when a new round starts" />
          <Switch on={notify.closing} onChange={(v) => savePrefs({ notify: { ...notify, closing: v } })} title="Closing reminder" sub="A notice in the last 24 hours if you haven't submitted" />
          <Switch on={notify.key} onChange={(v) => savePrefs({ notify: { ...notify, key: v } })} title="Answer key ready" sub="Show a notice when your score and the answer key are released" /></div>}
        {tab === 'account' && <div className="card"><div className="h3" style={{ marginBottom: 14 }}>Account</div>
          {[['Signed in with Google', user.email], ['Role', ROLE_LABEL[role]], ['Rounds taken', sum.rounds]].map(([a, b]) => <div key={a} className="row between" style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}><span className="fg2">{a}</span><span>{b}</span></div>)}
          <p className="muted small" style={{ margin: '16px 0' }}>Your email identifies your scores. Roles are managed by admins and creators.</p><button className="btn" onClick={signOut}>Sign out</button></div>}
      </div>
    </div>
  );
}
