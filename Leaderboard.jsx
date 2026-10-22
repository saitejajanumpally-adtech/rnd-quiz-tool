import React, { useState } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { isStaff } from '../lib/ops.js';
import { fmtRange } from '../lib/time.js';
import { Spinner, ErrorBox, useAsync } from '../components/ui.jsx';
import { Bolt } from '../components/mascots.jsx';

export default function Leaderboard({ id }) {
  const { user, role, index, settings } = useApp();
  const released = Object.values(index).filter((i) => i.released).sort((a, b) => b.opens - a.opens);
  const qid = id || (released[0] && released[0].id); const item = index[qid];
  const vis = settings.leaderboardVisibility; const canFull = isStaff(role) || (vis !== 'staff' && role === 'lead') || vis === 'everyone';
  const [text, setText] = useState(''); const [page, setPage] = useState(0);
  const { loading, data, error } = useAsync(async () => {
    if (!qid) return null;
    const [pub, mine, full] = await Promise.all([store.get('resultsPublic/' + qid), store.get(`myResults/${qid}_${user.uid}`).catch(() => null), canFull ? store.get('resultsFull/' + qid).catch(() => null) : null]);
    return { pub, mine, full };
  }, [qid, canFull]);
  if (!released.length) return <div className="card mt" style={{ textAlign: 'center' }}><div className="h3" style={{ marginBottom: 6 }}>No results yet</div><div className="fg2 mb">The leaderboard appears after a quiz is released.</div><Bolt moment="empty" level="all" card={false} size={56} /></div>;
  if (error) return <div className="mt"><ErrorBox error={error} /></div>;
  if (loading || !data) return <Spinner />;
  const { pub, mine, full } = data; const top = (pub && pub.top) || [];
  const rows = full ? full.rows.filter((r) => (r.name + r.email).toLowerCase().includes(text.toLowerCase())) : [];
  const per = 25; const pages = Math.max(1, Math.ceil(rows.length / per));
  return (
    <div className="pan mt">
      <div className="row between center mb"><div><div className="h2">Leaderboard</div><div className="fg2" style={{ marginTop: 2 }}>{item.title} · {fmtRange(item.opens, item.closes)}</div></div>
        <select className="select" style={{ width: 280 }} aria-label="Choose a quiz" value={qid} onChange={(e) => { location.hash = '#/leaderboard/' + e.target.value; }}>{released.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></div>
      <div className="row">
        <div className="card teal pad" style={{ flex: '1 1 320px' }}>
          <div className="lab" style={{ color: 'var(--warn)', marginBottom: 12 }}>Your result</div>
          {mine ? <><div className="mono" style={{ fontSize: 64, fontWeight: 500, lineHeight: 1 }}>{mine.total}<span style={{ fontSize: 22, color: 'var(--muted)' }}> / {mine.max}</span></div>
            <p className="fg2" style={{ margin: '12px 0 16px' }}>Rank {mine.rank} of {mine.count} who submitted. The average was {pub ? pub.avg : '–'}.</p>
            {mine.sections.map((s) => <div key={s.title} style={{ marginBottom: 10 }}><div className="row between small fg2" style={{ marginBottom: 4 }}><span>{s.title}</span><span className="mono">{s.score} / {s.max}</span></div><div className="bar"><i style={{ width: (s.max ? (s.score / s.max) * 100 : 0) + '%', background: s.score >= s.max ? 'var(--success)' : 'var(--warn)' }} /></div></div>)}
            <a className="btn p" style={{ marginTop: 12 }} href={'#/library/' + qid}>Open answer key</a></> : <><p className="fg2 mb">You didn't take this round, so there's no score to show.</p><a className="btn p" href={'#/library/' + qid}>Open answer key</a></>}
        </div>
        <div className="card" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <div className="lab" style={{ marginBottom: 16 }}>Top 10 · visible to everyone</div>
          {top.length === 0 ? <div className="muted">No results to show.</div> : <>
            <div className="row" style={{ justifyContent: 'center', alignItems: 'flex-end', gap: 14, height: 190, marginBottom: 18 }}>
              {[top[1], top[0], top[2]].map((p, i) => p && <div key={i} style={{ width: 150, textAlign: 'center' }}><div style={{ fontSize: 13, marginBottom: 6, color: i === 1 ? 'var(--warn)' : 'var(--fg2)' }}>{p.name}</div><div style={{ height: [100, 150, 76][i], background: i === 1 ? 'rgba(45,169,162,.25)' : 'var(--bg3)', border: '1px solid ' + (i === 1 ? 'var(--primary)' : 'var(--border2)'), borderRadius: '10px 10px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'rise 900ms ease-out' }}><b className="mono" style={{ fontSize: i === 1 ? 34 : 26, fontWeight: 500 }}>{p.rank}</b><span className="mono fg2">{p.total}</span></div></div>)}
            </div>
            {top.slice(3).map((p, i) => <div key={i} className="row center" style={{ gap: 14, padding: '9px 6px', borderTop: '1px solid var(--border)' }}><span className="mono muted" style={{ width: 24 }}>{p.rank}</span><span style={{ width: 150 }}>{p.name}</span><div className="bar" style={{ flex: 1 }}><i style={{ width: (pub.max ? (p.total / pub.max) * 100 : 0) + '%' }} /></div><span className="mono" style={{ width: 44, textAlign: 'right' }}>{p.total}</span></div>)}</>}
        </div>
      </div>
      {canFull && (
        <div className="card mt" style={{ borderStyle: 'dashed' }}>
          <div className="row between center mb"><div><div className="lab">Leads and above · full leaderboard</div><div className="muted small" style={{ marginTop: 4 }}>Scores by section. Written answers of individuals are not shown here.</div></div><input className="input" style={{ width: 240 }} aria-label="Search by name or email" placeholder="Search by name or email" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} /></div>
          {!full ? <div className="muted">The full leaderboard isn't available for this quiz.</div> : <div className="scroll"><table className="tbl"><thead><tr><th>Rank</th><th>Name</th>{(rows[0] ? rows[0].sections : []).map((s) => <th key={s.title} className="num">{s.title}</th>)}<th className="num">Total</th></tr></thead>
            <tbody>{rows.slice(page * per, page * per + per).map((r) => <tr key={r.uid}><td className="mono muted">{r.rank}</td><td>{r.name}{r.auto && <span className="chip warn" style={{ marginLeft: 8 }}>Auto-submitted</span>}</td>{r.sections.map((s) => <td key={s.title} className="num">{s.score}</td>)}<td className="num" style={{ color: 'var(--accent)' }}>{r.total}</td></tr>)}</tbody></table></div>}
          <div className="row between center" style={{ marginTop: 12 }}><span className="muted small">Showing {rows.length ? page * per + 1 : 0} to {Math.min(rows.length, page * per + per)} of {rows.length}</span><div className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div></div>
        </div>)}
    </div>
  );
}
