import React, { useEffect, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { quizStatus } from '../lib/quizModel.js';
import { summarize } from '../lib/stages.js';
import { loadMyResponse, liveCounts, isStaff, checklist } from '../lib/ops.js';
import { store } from '../lib/store.js';
import { isAnswered, hasAnyAnswer } from '../lib/scoring.js';
import { fmtDate, fmtDateTime, fmtTime, DAY } from '../lib/time.js';
import { Bolt, scoreMoment } from '../components/mascots.jsx';
import { Countdown, Funnel, Tile } from '../components/ui.jsx';

export function pickCurrent(index, now, settings) {
  const items = Object.values(index).filter((i) => i.published);
  const by = (st) => items.filter((i) => quizStatus(i, now) === st);
  const live = by('live').sort((a, b) => b.opens - a.opens)[0]; if (live) return { stage: 'live', item: live };
  const closed = by('closed').sort((a, b) => b.closes - a.closes)[0]; if (closed) return { stage: 'closed', item: closed };
  const released = by('released').sort((a, b) => b.opens - a.opens)[0];
  const upcoming = by('scheduled').sort((a, b) => a.opens - b.opens)[0];
  if (released && now - (released.releasedAt || 0) < (settings.highlightDays || 5) * DAY) return { stage: 'released', item: released, next: upcoming };
  if (upcoming) return { stage: 'upcoming', item: upcoming, last: released };
  return { stage: 'none', last: released };
}

export default function Arena() {
  const { user, role, index, stats, settings, now, prefs } = useApp();
  const cur = pickCurrent(index, now, settings); const item = cur.item;
  const [resp, setResp] = useState(undefined); const [res, setRes] = useState(undefined); const [counts, setCounts] = useState(null);
  useEffect(() => {
    let on = true; setResp(undefined); setRes(undefined); setCounts(null);
    (async () => {
      try {
        if (item && (cur.stage === 'live' || cur.stage === 'closed' || cur.stage === 'released')) { const r = await loadMyResponse(item.id, user.uid); if (on) setResp(r || null); }
        if (item && cur.stage === 'released') { const r = await store.get(`myResults/${item.id}_${user.uid}`); if (on) setRes(r || null); }
        if (item && isStaff(role) && (cur.stage === 'live' || cur.stage === 'closed')) { const c = await liveCounts(item.id); if (on) setCounts(c); }
      } catch (e) { if (on) { setResp(null); setRes(null); } }
    })();
    return () => { on = false; };
  }, [cur.stage, item && item.id, user.uid, role]); // eslint-disable-line

  const closedIds = Object.values(index).filter((i) => i.published && now >= i.closes).sort((a, b) => a.opens - b.opens).map((i) => i.id);
  const sum = summarize(stats.history, closedIds);
  const avgMax = Object.values(stats.history).length ? Object.values(stats.history).reduce((a, h) => a + (h.max || 10), 0) / Object.values(stats.history).length : 10;
  const answered = resp ? Object.values(resp.answers || {}).filter(isAnswered).length : 0;
  const notify = { opens: true, closing: true, key: true, ...(prefs.notify || {}) };

  let sub = cur.stage;
  if (cur.stage === 'live') sub = resp === undefined ? 'loading' : !resp ? 'live' : resp.submitted ? 'submitted' : 'progress';
  if (cur.stage === 'closed') sub = resp === undefined ? 'loading' : resp && resp.submitted ? 'closedSubmitted' : resp && item.autoSubmit && hasAnyAnswer(resp.answers) ? 'closedAuto' : 'closedMissed';
  const bolt = {
    upcoming: ['upcoming'], none: ['none'], live: ['live'], progress: ['progress', { done: answered, left: Math.max(0, item ? item.qCount - answered : 0) }], submitted: ['submitted'], loading: ['welcome'],
    closedSubmitted: ['closed'], closedAuto: ['autoSubmitted'], closedMissed: ['closed'],
    released: res ? [scoreMoment(res.total, res.max)] : ['missed']
  }[sub] || ['welcome'];

  return (
    <div className="pan">
      {notify.closing && cur.stage === 'live' && sub !== 'submitted' && item.closes - now < DAY && <div className="banner warn" role="status"><span>This quiz closes {fmtDateTime(item.closes)}. {item.autoSubmit ? 'Saved answers are submitted for you at close.' : 'Unsubmitted answers will not count.'}</span><a className="btn sm s" href={'#/quiz/' + item.id}>{sub === 'live' ? 'Start quiz' : 'Continue quiz'}</a></div>}
      {notify.key && cur.stage === 'released' && res && <div className="banner ok" role="status"><span>The answer key for {item.title} is ready.</span><a className="btn sm s" href={'#/library/' + item.id}>Open answer key</a></div>}
      <div className="row mt">
        <div style={{ flex: '999 1 640px', minWidth: 0 }}>
          <div className="card teal pad">
            {sub === 'loading' && <div className="muted">Loading…</div>}
            {sub === 'upcoming' && <><Eyebrow dot="var(--muted)">No quiz live right now</Eyebrow><h1 className="h1">Next round opens<br />{fmtDate(item.opens)}.</h1><p className="sub mb">Opens {fmtTime(item.opens)} IST, closes {fmtDateTime(item.closes)}. Rounds repeat every second Tuesday.</p><Countdown to={item.opens} now={now} />{cur.last && <LastLinks last={cur.last} />}{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · upcoming</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{item.title} is scheduled and ready.</p><a className="btn sm" href={'#/manage/' + item.id}>Open in Manage quizzes</a></div>}</>}
            {sub === 'none' && <><Eyebrow dot="var(--muted)">No quiz live right now</Eyebrow><h1 className="h1">Next round is<br />on its way.</h1><p className="sub mb">The date isn't set yet. It will be announced in Google Chat and by email.</p>{cur.last && <LastLinks last={cur.last} />}{isStaff(role) && <div className="strip"><p className="fg2" style={{ marginBottom: 12 }}>No upcoming quiz is published.</p><a className="btn sm p" href="#/edit/new">Create the next quiz</a></div>}</>}
            {sub === 'live' && <><Eyebrow dot="var(--success)" live>Open now · closes {fmtDateTime(item.closes)}</Eyebrow><h1 className="h1">{item.headline || 'A new round is live. Show what you know.'}</h1><p className="sub mb">{item.title}. {item.qCount} questions, about {Math.max(5, item.qCount * 2)} minutes.</p><Countdown to={item.closes} now={now} /><div className="row center"><a className="btn p cta" href={'#/quiz/' + item.id} style={{ fontSize: 16, padding: '15px 30px' }}>Start quiz</a><span className="muted small">Answers save as you go. Submitting locks them.</span></div></>}
            {sub === 'progress' && <><Eyebrow dot="var(--success)" live>In progress · closes {fmtDateTime(item.closes)}</Eyebrow><h1 className="h1">Pick up where<br />you left off.</h1><p className="sub mb">{answered} of {item.qCount} answered. Your answers are saved. Edit freely until you submit; submitting locks them.</p><div className="bar mb" style={{ maxWidth: 420 }}><i style={{ width: Math.round((answered / Math.max(1, item.qCount)) * 100) + '%' }} /></div><a className="btn p cta" href={'#/quiz/' + item.id} style={{ fontSize: 16, padding: '15px 30px' }}>Continue quiz</a></>}
            {sub === 'submitted' && <><Eyebrow dot="var(--success)">Submitted</Eyebrow><h1 className="h1">You're in.<br />Answers are locked.</h1><p className="sub mb">Thanks for taking part. Results and the answer key arrive after the quiz closes on {fmtDate(item.closes)}.</p><span className="chip ok">Streak +1 once the quiz closes</span></>}
            {(sub === 'closedSubmitted' || sub === 'closedAuto' || sub === 'closedMissed') && <><Eyebrow dot="var(--warn)">Quiz closed</Eyebrow><h1 className="h1">Scores are<br />on the way.</h1><p className="sub mb">{sub === 'closedAuto' ? 'The quiz closed and your saved answers were submitted for you.' : sub === 'closedMissed' ? 'You didn\'t take this round.' : 'You submitted this round.'} Results and the answer key will be released soon, and you\'ll get a message in Chat and by email.</p>{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · closed</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{counts ? `${counts.submitted} submitted, ${counts.started} started. ` : ''}Release checklist: {checklist(item, now).steps.filter((s) => s.done).length} of {checklist(item, now).steps.length} steps done.</p><a className="btn sm s" href={'#/manage/' + item.id}>Open release checklist</a></div>}</>}
            {sub === 'released' && <><Eyebrow dot="var(--success)">Results are out</Eyebrow><h1 className="h1">{item.title.replace('R&D Quiz · ', '')} results<br />are in.</h1>{res ? <div className="row center" style={{ margin: '4px 0 22px' }}><span className="mono" style={{ fontSize: 56, fontWeight: 500 }}>{res.total}</span><span className="muted">/ {res.max}</span><span className="fg2" style={{ marginLeft: 10 }}>Rank {res.rank} of {res.count}</span></div> : resp === undefined || res === undefined ? <p className="sub mb">Loading your result…</p> : <p className="sub mb">You didn't take this round. The answer key is still there to learn from.</p>}<div className="row"><a className="btn p" href={'#/library/' + item.id}>Open answer key</a><a className="btn s" href={'#/leaderboard/' + item.id}>See leaderboard</a></div>{cur.next && <p className="muted small mt">Next round opens {fmtDateTime(cur.next.opens)}.</p>}{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · released</div><p className="fg2" style={{ margin: '8px 0 12px' }}>Released {fmtDateTime(item.releasedAt)}.</p><a className="btn sm" href={'#/manage/' + item.id}>View in Manage quizzes</a></div>}</>}
            {(sub === 'live' || sub === 'progress' || sub === 'submitted') && isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · live</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{counts ? `${counts.submitted} submitted, ${counts.started} started.` : 'Counting…'} Participant counts are visible to admins and creators only.</p><a className="btn sm s" href={'#/manage/' + item.id}>Reminders and deadline in Manage quizzes</a></div>}
          </div>
          <div className="row mt">
            <Tile label="Streak" value={sum.streak} unit="rounds" /><Tile label="Average score" value={sum.rounds ? sum.avg.toFixed(1) : '–'} unit={sum.rounds ? '/ ' + Math.round(avgMax) : ''} /><Tile label="Rounds taken" value={sum.rounds} />
          </div>
        </div>
        <div className="col" style={{ flex: '1 1 320px', minWidth: 300 }}>
          <Bolt moment={bolt[0]} vars={bolt[1] || {}} />
          <Funnel points={sum.points} thresholds={settings.thresholds} />
        </div>
      </div>
    </div>
  );
}
function Eyebrow({ dot, live, children }) { return <div className="row center" style={{ gap: 8, marginBottom: 16 }}>{live ? <span className="live-dot" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />}<span className="eyebrow" style={live ? { color: 'var(--warn)' } : {}}>{children}</span></div>; }
function LastLinks({ last }) { return <div className="row" style={{ marginTop: 6 }}><a className="btn p" href={'#/leaderboard/' + last.id}>See last round's results</a><a className="btn s" href={'#/library/' + last.id}>Open answer key</a></div>; }
