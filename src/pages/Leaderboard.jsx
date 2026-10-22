import React, { useState } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { isStaff, loadRemoved } from '../lib/ops.js';
import { fmtRange } from '../lib/time.js';
import { Spinner, ErrorBox, useAsync, MoveChip, Ring, Icon } from '../components/ui.jsx';
import { Bolt, Mascot, MascotPic, useMascot, scoreMoment } from '../components/mascots.jsx';

const MEDAL = { 1: '#E0A04B', 2: '#B8C5CC', 3: '#C98A5B' };
const fmtN = (n) => (Math.round(n * 2) / 2).toString();
const canSeeFull = (role, settings) => isStaff(role) || (settings.leaderboardVisibility !== 'staff' && role === 'lead') || settings.leaderboardVisibility === 'everyone';

function QuizPicker({ released, qid, suffix }) {
  return <select className="select" style={{ width: 280 }} aria-label="Choose a quiz" value={qid} onChange={(e) => { location.hash = '#/leaderboard/' + e.target.value + (suffix || ''); }}>{released.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select>;
}
const Empty = () => <div className="card mt" style={{ textAlign: 'center' }}><div className="h3" style={{ marginBottom: 6 }}>No results yet</div><div className="fg2 mb">The leaderboard appears after a quiz is released.</div><Bolt moment="empty" level="all" card={false} size={96} /></div>;

export default function Leaderboard({ id }) {
  const { user, role, index, settings, stats } = useApp(); const m = useMascot();
  const released = Object.values(index).filter((i) => i.released).sort((a, b) => b.opens - a.opens);
  const qid = id || (released[0] && released[0].id); const item = index[qid];
  const canFull = canSeeFull(role, settings); const showMove = settings.showMovement !== false;
  const { loading, data, error } = useAsync(async () => {
    if (!qid) return null;
    const [pub, mine, removed] = await Promise.all([store.get('resultsPublic/' + qid), store.get(`myResults/${qid}_${user.uid}`).catch(() => null), loadRemoved()]);
    return { pub, mine, removed };
  }, [qid]);
  if (!released.length) return <Empty />;
  if (error) return <div className="mt"><ErrorBox error={error} /></div>;
  if (loading || !data) return <Spinner />;
  const { pub, mine, removed } = data; const top = (pub && pub.top) || []; const max = (pub && pub.max) || (mine && mine.max) || 10;
  const hasPrev = showMove && !!(pub && pub.prevCount > 0);
  const inTop = top.some((t) => (t.uid ? t.uid === user.uid : t.name === user.name)); // quizzes scored before this version have no ids in the Top 10
  const earlier = Object.entries(stats.history).filter(([k, h]) => k !== qid && index[k] && (!item || h.opens < item.opens)); // only earlier rounds count for a personal best
  const ratio = mine && mine.max ? mine.total / mine.max : 0;
  const personalBest = !!mine && earlier.length > 0 && earlier.every(([, h]) => ratio > (h.max ? h.score / h.max : 0));
  const first = (user.name || '').split(' ')[0] || 'there';
  let moment = 'resultFirst'; let headline = 'Your round';
  if (mine) {
    if ((mine.move || 0) > 0 || personalBest) { moment = 'resultHigh'; headline = `Nice climb, ${first}`; }
    else if (mine.move === 0) { moment = 'resultMid'; headline = `Holding steady, ${first}`; }
    else if (mine.move < 0) { moment = 'resultLow'; headline = `A tough one, ${first}`; }
    else if (earlier.length === 0) { moment = 'resultFirst'; headline = `You’re on the board, ${first}`; }
    else { moment = scoreMoment(mine.total, mine.max); headline = `Your round, ${first}`; }
  }
  const podium = [top[1], top[0], top[2]]; const heights = [30, 0, 30];
  const rowFor = (p, you) => (
    <div key={p.uid || p.rank + p.name} className={'lrow' + (you ? ' me' : '') + (removed.has(p.uid) ? ' gone' : '')}>
      <span className="mono">{p.rank}</span>
      <span className="nm" style={{ fontSize: 15, fontWeight: 500 }}>{p.name}{you && <span className="chip info" style={{ marginLeft: 8 }}>You</span>}{removed.has(p.uid) && <span className="chip removed">Profile removed</span>}</span>
      <div className="bar barcell"><i style={{ width: (max ? (p.total / max) * 100 : 0) + '%' }} /></div>
      <span style={{ textAlign: 'right' }}><span className="mono">{fmtN(p.total)}</span><span className="muted small"> / {max}</span></span>
      <span style={{ textAlign: 'right' }}>{hasPrev && <MoveChip move={p.move} hasPrev={hasPrev} />}</span>
    </div>);
  return (
    <div className="pan mt">
      <div className="row between center" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div className="row center" style={{ flexWrap: 'nowrap', gap: 20 }}>
          <div><div className="lab">The results are in</div><h1 className="h1" style={{ margin: '6px 0' }}>Leaderboard</h1><div className="fg2" style={{ fontSize: 17 }}>A little competition. A lot of learning.</div></div>
          {m.mode !== 'off' && <div style={{ margin: '-8px 0 -18px' }}><Mascot id={m.id} pose="celebrate" size={190} /></div>}
        </div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}><QuizPicker released={released} qid={qid} /><span className="muted small">{item ? fmtRange(item.opens, item.closes) : ''}{pub ? ` · ${pub.count} participants` : ''}</span></div>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ flex: '999 1 560px', minWidth: 0, gap: 18 }}>
          {top.length > 0 && <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 14 }}>
            {podium.map((p, i) => p && <div key={p.uid || i} className={'pod' + (i === 1 ? ' first' : '')} style={{ marginTop: heights[i] }}>
              <div style={{ display: 'flex' }}><span className="medal" style={{ background: MEDAL[p.rank] || 'var(--bg3)', color: MEDAL[p.rank] ? '#1A1205' : 'var(--fg)' }}>{p.rank}</span></div>
              <div style={{ fontSize: 19, fontWeight: 500, marginTop: 4 }} className={removed.has(p.uid) ? 'gone-name' : ''}>{p.name}</div>
              <div style={{ marginTop: 8 }}><span className="mono" style={{ fontSize: 34, fontWeight: 500 }}>{fmtN(p.total)}</span><span className="muted"> / {max}</span></div>
              <div style={{ marginTop: 10, minHeight: 24 }}>{hasPrev && <MoveChip move={p.move} hasPrev={hasPrev} />}{(p.uid ? p.uid === user.uid : p.name === user.name) && <span className="chip info" style={{ marginLeft: 6 }}>You</span>}{removed.has(p.uid) && <span className="chip removed">Profile removed</span>}</div>
            </div>)}
          </div>}
          <div className="card" style={{ padding: 22 }}>
            <div className="row between center" style={{ marginBottom: 4 }}>
              <div className="row center"><span className="h3">This round</span><span className="chip info">Top 10</span></div>
              {canFull && <div className="row center" style={{ gap: 10 }}><span className="chip">Leads and above</span><a className="btn sm s" href={`#/leaderboard/${qid}/full`}>View full leaderboard →</a></div>}
            </div>
            {hasPrev && <div className="muted small" style={{ marginBottom: 6 }}>Change is compared with the previous round.</div>}
            {top.length === 0 ? <div className="muted">No results to show.</div> : <>
              <div className="lrow" style={{ borderTop: 0, padding: '8px 0' }}><span className="lab">Rank</span><span className="lab">Player</span><span className="lab barcell" /><span className="lab" style={{ textAlign: 'right' }}>Score</span><span className="lab" style={{ textAlign: 'right' }}>{hasPrev ? 'Change' : ''}</span></div>
              {top.slice(3).map((p) => rowFor(p, p.uid ? p.uid === user.uid : p.name === user.name))}
              {mine && !inTop && <><div style={{ borderTop: '2px dashed var(--border2)', margin: '10px 0' }} />{rowFor({ rank: mine.rank, uid: user.uid, name: user.name, total: mine.total, move: mine.move }, true)}</>}
              {top.length <= 3 && !mine && <div className="muted small" style={{ marginTop: 8 }}>The rest of the Top 10 appears here.</div>}
            </>}
            <div className="muted small" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>Tied scores share a rank. Everyone sees the Top 10 and their own row.{canFull ? '' : ' Only leads and above can open the full leaderboard.'}</div>
          </div>
        </div>
        <div className="col" style={{ flex: '1 1 360px', minWidth: 320 }}>
          <div className="card teal" style={{ padding: 24 }}>
            <div className="row between center"><span className="lab" style={{ color: 'var(--accent)' }}>Your round</span>{personalBest && <span className="chip teal">Personal best</span>}</div>
            {mine ? <>
              <div className="h2" style={{ margin: '8px 0 14px' }}>{headline}</div>
              <div className="row center" style={{ flexWrap: 'nowrap', gap: 18 }}><Ring value={fmtN(mine.total)} max={mine.max} />
                <div>{mine.prevTotal != null && showMove ? <><div>{mine.total > mine.prevTotal ? 'Up' : mine.total < mine.prevTotal ? 'Down' : 'Same as'} {mine.total === mine.prevTotal ? '' : 'from '}{fmtN(mine.prevTotal)} last round</div>{mine.total !== mine.prevTotal && <div className="small" style={{ color: mine.total > mine.prevTotal ? 'var(--success)' : 'var(--warn)', marginTop: 4 }}>{mine.total > mine.prevTotal ? '+' : ''}{fmtN(mine.total - mine.prevTotal)} points</div>}</> : <div className="fg2">{pub ? `The average was ${pub.avg}.` : ''}</div>}</div></div>
              <div className="row" style={{ marginTop: 18, gap: 10 }}>
                <div className="tile" style={{ flex: '1 1 90px', padding: 12 }}><div className="lab">Rank</div><div className="v" style={{ fontSize: 22 }}>#{mine.rank}<small> / {mine.count}</small></div></div>
                <div className="tile" style={{ flex: '1 1 90px', padding: 12 }}><div className="lab">Average</div><div className="v" style={{ fontSize: 22 }}>{pub ? pub.avg : '–'}</div></div>
                {hasPrev && mine.move != null && <div className="tile" style={{ flex: '1 1 90px', padding: 12 }}><div className="lab">Change</div><div className="v" style={{ fontSize: 22, color: mine.move > 0 ? 'var(--success)' : mine.move < 0 ? 'var(--warn)' : 'var(--fg)' }}>{mine.move > 0 ? '↑ ' : mine.move < 0 ? '↓ ' : '– '}{Math.abs(mine.move)}<small> {Math.abs(mine.move) === 1 ? 'place' : 'places'}</small></div></div>}
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, margin: '20px 0 10px', paddingTop: 16, borderTop: '1px solid var(--border)' }}>Score breakdown</div>
              {mine.sections.map((s) => <div key={s.title} style={{ marginBottom: 10 }}><div className="row between small fg2" style={{ marginBottom: 4 }}><span>{s.title}</span><span className="mono">{fmtN(s.score)} / {s.max}</span></div><div className="bar"><i style={{ width: (s.max ? (s.score / s.max) * 100 : 0) + '%', background: s.score >= s.max ? 'var(--success)' : 'var(--accent)' }} /></div></div>)}
              <a className="btn p" style={{ width: '100%', marginTop: 12 }} href={'#/library/' + qid}>Review answers →</a>
            </> : <><div className="h2" style={{ margin: '8px 0 10px' }}>No score this round</div><p className="fg2 mb">You didn’t take this round, so there’s no score to show.</p><a className="btn p" href={'#/library/' + qid}>Open answer key</a></>}
          </div>
          {mine && <Bolt moment={moment} />}
          <div style={{ textAlign: 'center' }}><RankingInfo /></div>
        </div>
      </div>
    </div>
  );
}
function RankingInfo() {
  const { ask } = useApp();
  return <button className="link" style={{ background: 'none', border: 0, color: 'var(--accent)' }} onClick={() => ask({ title: 'How rankings work', body: 'Scores add up every question’s points. Written answers are scored against the quiz’s rubric.\n\nPeople with the same score share a rank, so the next rank is skipped.\n\nChange compares your rank with the previous round. It only shows when you took both rounds, and ranks can shift when more or fewer people take part.', ok: 'Got it' })}>How rankings work ↗</button>;
}

// A separate page for leads and above. Movement is always against the previous round.
export function FullLeaderboard({ id }) {
  const { role, index, settings } = useApp();
  const released = Object.values(index).filter((i) => i.released).sort((a, b) => b.opens - a.opens);
  const qid = id || (released[0] && released[0].id); const item = index[qid];
  const [text, setText] = useState(''); const [page, setPage] = useState(0); const showMove = settings.showMovement !== false;
  const { loading, data, error } = useAsync(async () => (qid ? { full: await store.get('resultsFull/' + qid).catch(() => null), removed: await loadRemoved() } : null), [qid]);
  if (!canSeeFull(role, settings)) return <div className="card mt"><div className="row center"><MascotPic moment="noAccess" size={96} /><div><div className="h3" style={{ marginBottom: 6 }}>The full leaderboard isn’t available to you</div><div className="fg2">Leads and above can see it. <a href="#/leaderboard">Back to the Top 10</a></div></div></div></div>;
  if (!released.length) return <Empty />;
  if (error) return <div className="mt"><ErrorBox error={error} /></div>;
  if (loading || !data) return <Spinner />;
  const { full, removed } = data; const all = (full && full.rows) || []; const hasPrev = showMove && !!(full && full.prevCount > 0);
  const rows = all.filter((r) => (r.name + r.email).toLowerCase().includes(text.toLowerCase()));
  const per = 25; const pages = Math.max(1, Math.ceil(rows.length / per)); const cols = all[0] ? all[0].sections : [];
  const diff = hasPrev ? all.length - full.prevCount : 0;
  const maxTotal = all[0] ? all[0].sections.reduce((a, s) => a + s.max, 0) : 10;
  return (
    <div className="pan mt">
      <div className="fg2" style={{ marginBottom: 10 }}><a href={`#/leaderboard/${qid}`}>Leaderboard</a> / <span style={{ color: 'var(--fg)' }}>Full results</span></div>
      <div className="row between center" style={{ marginBottom: 16 }}>
        <div><div className="row center" style={{ gap: 14 }}><h1 className="h1" style={{ fontSize: 38 }}>Full leaderboard</h1><span className="chip teal" style={{ padding: '5px 12px', fontSize: 13 }}>Leads and above</span></div><div className="fg2" style={{ marginTop: 6, fontSize: 16 }}>Compare participation and section scores across rounds.</div></div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}><QuizPicker released={released} qid={qid} suffix="/full" /><span className="muted small">{item ? fmtRange(item.opens, item.closes) : ''}</span><a href={`#/leaderboard/${qid}`}>Back to top 10 ↑</a></div>
      </div>
      <div className="row mb">
        <div className="tile"><div className="lab" style={{ color: 'var(--accent)' }}>This round</div><div className="v">{all.length}<small> submissions</small></div>{hasPrev && diff !== 0 && <span className={'chip ' + (diff > 0 ? 'ok' : 'warn')}>{diff > 0 ? '+' : ''}{diff} vs last round</span>}</div>
        <div className="tile"><div className="lab">Previous round</div><div className="v">{hasPrev ? full.prevCount : '–'}<small> submissions</small></div></div>
        <div className="tile"><div className="lab">In both rounds</div><div className="v">{hasPrev ? full.comparable : '–'}<small> comparable participants</small></div></div>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <div className="row between center mb"><div><div className="row center" style={{ gap: 14 }}><span className="h3">Participant results</span><span className="muted">{all.length} participants</span></div><div className="muted small" style={{ marginTop: 4 }}>Section scores only · Written answers are not displayed.</div></div>
          <div className="row center" style={{ gap: 12 }}><input className="input" style={{ width: 260 }} aria-label="Search name or email" placeholder="Search name or email" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} />{hasPrev && <span className="chip teal">Compared with: previous round</span>}</div></div>
        {!full ? <div className="muted">The full leaderboard isn’t available for this quiz.</div> : <div className="scroll"><table className="tbl"><thead><tr><th>Rank</th><th>Participant</th><th className="num" style={{ color: 'var(--accent)' }}>Total / {maxTotal}</th>{cols.map((s) => <th key={s.title} className="num">{s.title} / {s.max}</th>)}{hasPrev && <th>Rank change</th>}</tr></thead>
          <tbody>{rows.slice(page * per, page * per + per).map((r) => <tr key={r.uid} className={removed.has(r.uid) ? 'gone' : ''}><td className="mono muted">{r.rank}</td><td className={removed.has(r.uid) ? 'gone-name' : ''}>{r.name}{r.auto && <span className="chip warn" style={{ marginLeft: 8 }}>Auto-submitted</span>}{r.missingRequired > 0 && <span className="chip bad" style={{ marginLeft: 8 }}>{r.missingRequired} required blank</span>}{removed.has(r.uid) && <span className="chip removed">Profile removed</span>}</td><td className="num" style={{ color: removed.has(r.uid) ? 'var(--muted)' : 'var(--accent)', fontWeight: 600, background: 'rgba(45,169,162,.08)' }}>{fmtN(r.total)}</td>{r.sections.map((s) => <td key={s.title} className="num">{fmtN(s.score)}</td>)}{hasPrev && <td><span className="row center" style={{ gap: 10, flexWrap: 'nowrap' }}><MoveChip move={r.move} hasPrev />{r.prevRank != null && <span className="muted small">was #{r.prevRank}</span>}</span></td>}</tr>)}</tbody></table></div>}
        <div className="row between center" style={{ marginTop: 14 }}><div><div className="small fg2">Showing {rows.length ? page * per + 1 : 0}–{Math.min(rows.length, page * per + per)} of {rows.length}</div><div className="muted small" style={{ marginTop: 2 }}>Ties share a rank. Rank movement can change when participation changes.</div></div>
          <div className="row"><button className="btn sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="chip teal" style={{ alignSelf: 'center' }}>{page + 1} of {pages}</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button></div></div>
      </div>
    </div>
  );
}
