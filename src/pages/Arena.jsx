import React, { useEffect, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { quizStatus } from '../lib/quizModel.js';
import { summarize, stageFor } from '../lib/stages.js';
import { loadMyResponse, liveCounts, isStaff, checklist } from '../lib/ops.js';
import { store } from '../lib/store.js';
import { isAnswered, hasAnyAnswer } from '../lib/scoring.js';
import { fmtDate, fmtDateTime, fmtTime, DAY } from '../lib/time.js';
import { Mascot, useMascot, poseFor, lineFor, showsMoment, scoreMoment } from '../components/mascots.jsx';
import { Countdown, Journey, Score, Icon, IconCircle } from '../components/ui.jsx';

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
  const { user, role, index, stats, settings, now, prefs } = useApp(); const m = useMascot();
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
  const sum = summarize(stats.history, closedIds, Object.keys(index));
  const avgMax = Object.values(stats.history).length ? Object.values(stats.history).reduce((a, h) => a + (h.max || 10), 0) / Object.values(stats.history).length : 10;
  const answered = resp ? Object.values(resp.answers || {}).filter(isAnswered).length : 0;
  const notify = { opens: true, closing: true, key: true, ...(prefs.notify || {}) };
  const first = (user.name || '').split(' ')[0] || 'there';
  const lastReleased = Object.values(index).filter((i) => i.released).sort((a, b) => b.opens - a.opens)[0];

  let sub = cur.stage;
  if (cur.stage === 'live') sub = resp === undefined ? 'loading' : !resp ? 'live' : resp.submitted ? 'submitted' : 'progress';
  if (cur.stage === 'closed') sub = resp === undefined ? 'loading' : resp && resp.submitted ? 'closedSubmitted' : resp && item.autoSubmit && hasAnyAnswer(resp.answers) ? 'closedAuto' : 'closedMissed';
  // the mascot's moment: a new funnel stage or a streak milestone beats an ordinary result
  let releasedMoment = 'missed'; let mvars = {};
  if (res) {
    const before = stageFor(sum.points - res.total, settings.thresholds); const nowStage = stageFor(sum.points, settings.thresholds);
    if (nowStage.index > before.index) { releasedMoment = 'stageUp'; mvars = { stage: nowStage.name }; }
    else if (sum.streak > 0 && sum.streak % 5 === 0) { releasedMoment = 'streak'; mvars = { n: sum.streak }; }
    else releasedMoment = (res.move || 0) > 0 ? 'resultHigh' : res.move === 0 ? 'resultMid' : res.move < 0 ? 'resultLow' : scoreMoment(res.total, res.max);
  }
  const moment = { upcoming: 'upcoming', none: 'none', live: 'live', progress: 'progress', submitted: 'submitted', loading: 'welcome', closedSubmitted: 'closed', closedAuto: 'autoSubmitted', closedMissed: 'missed', released: releasedMoment }[sub] || 'welcome';
  const mvarsAll = { done: answered, left: Math.max(0, item ? item.qCount - answered : 0), ...mvars };
  const seed = React.useMemo(() => Math.floor(Math.random() * 1000), [moment]);
  const mascotOn = showsMoment(moment, m.mode);
  const line = lineFor(moment, { first, ...mvarsAll }, m, seed);

  return (
    <div className="pan">
      {notify.closing && cur.stage === 'live' && sub !== 'submitted' && item.closes - now < DAY && <div className="banner warn" role="status"><span>This quiz closes {fmtDateTime(item.closes)}. {item.autoSubmit ? 'Saved answers are submitted for you at close.' : 'Unsubmitted answers will not count.'}</span><a className="btn sm s" href={'#/quiz/' + item.id}>{sub === 'live' ? 'Start quiz' : 'Continue quiz'}</a></div>}
      {notify.key && cur.stage === 'released' && res && <div className="banner ok" role="status"><span>The answer key for {item.title} is ready.</span><a className="btn sm s" href={'#/library/' + item.id}>Open answer key</a></div>}
      <div style={{ margin: '28px 0 22px' }}><div className="lab">Your learning arena</div><h1 className="h1" style={{ margin: '8px 0 6px' }}>Welcome back, {first}</h1><div className="fg2" style={{ fontSize: 18 }}>Small rounds. Steady progress.</div></div>
      <div className="card teal pad" style={{ display: 'grid', gridTemplateColumns: mascotOn ? 'repeat(auto-fit,minmax(300px,1fr))' : '1fr', gap: 28, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          {sub === 'loading' && <div className="muted">Loading…</div>}
          {sub === 'upcoming' && <><Eyebrow dot="var(--muted)">No quiz live right now</Eyebrow><h1 className="h1">Next round opens<br />{fmtDate(item.opens)}.</h1><p className="sub mb">Opens {fmtTime(item.opens)} IST, closes {fmtDateTime(item.closes)}. Rounds repeat every second Tuesday.</p><Countdown to={item.opens} now={now} />{cur.last && <LastLinks last={cur.last} />}{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · upcoming</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{item.title} is scheduled and ready.</p><a className="btn sm" href={'#/manage/' + item.id}>Open in Manage quizzes</a></div>}</>}
          {sub === 'none' && <><Eyebrow dot="var(--muted)">No quiz live right now</Eyebrow><h1 className="h1">Next round is<br />on its way.</h1><p className="sub mb">The date isn't set yet. It will be announced in Google Chat and by email.</p>{cur.last && <LastLinks last={cur.last} />}{isStaff(role) && <div className="strip"><p className="fg2" style={{ marginBottom: 12 }}>No upcoming quiz is published.</p><a className="btn sm p" href="#/edit/new">Create the next quiz</a></div>}</>}
          {sub === 'live' && <><Eyebrow dot="var(--success)" live>Open now · closes {fmtDateTime(item.closes)}</Eyebrow><h1 className="h1">{item.headline || 'A new round is live. Show what you know.'}</h1><p className="sub mb">{item.title}. {item.qCount} questions, about {Math.max(5, item.qCount * 2)} minutes.</p><Countdown to={item.closes} now={now} /><div className="row center"><a className="btn p cta" href={'#/quiz/' + item.id} style={{ fontSize: 16, padding: '15px 30px' }}>Start quiz</a><span className="muted small">Answers save as you go. Submitting locks them.</span></div></>}
          {sub === 'progress' && <><Eyebrow dot="var(--success)" live>In progress · closes {fmtDateTime(item.closes)}</Eyebrow><h1 className="h1">Pick up where<br />you left off.</h1><p className="sub mb">{answered} of {item.qCount} answered. Your answers are saved. Edit freely until you submit; submitting locks them.</p><div className="bar mb" style={{ maxWidth: 420 }}><i style={{ width: Math.round((answered / Math.max(1, item.qCount)) * 100) + '%' }} /></div><a className="btn p cta" href={'#/quiz/' + item.id} style={{ fontSize: 16, padding: '15px 30px' }}>Continue quiz</a></>}
          {sub === 'submitted' && <><Eyebrow dot="var(--success)">{item.title.replace('R&D Quiz · ', '')} · Submitted</Eyebrow><h1 className="h1" style={{ fontSize: 42 }}>You’re in. Nicely done.</h1><p className="sub" style={{ margin: '10px 0 0' }}>Your answers are locked. Results and the answer key will be available after the quiz closes on {fmtDate(item.closes)}.</p><Tracker /><div className="row center" style={{ gap: 22, marginTop: 22 }}><a className="btn p" href="#/library">Explore past quizzes →</a>{lastReleased && <a href={'#/leaderboard/' + lastReleased.id}>View previous leaderboard ↗</a>}</div></>}
          {(sub === 'closedSubmitted' || sub === 'closedAuto' || sub === 'closedMissed') && <><Eyebrow dot="var(--warn)">Quiz closed</Eyebrow><h1 className="h1">Scores are<br />on the way.</h1><p className="sub mb">{sub === 'closedAuto' ? 'The quiz closed and your saved answers were submitted for you.' : sub === 'closedMissed' ? 'You didn\'t take this round.' : 'You submitted this round.'} Results and the answer key will be released soon, and you\'ll get a message in Chat and by email.</p>{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · closed</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{counts ? `${counts.submitted} submitted, ${counts.started} started. ` : ''}Release checklist: {checklist(item, now).steps.filter((s) => s.done).length} of {checklist(item, now).steps.length} steps done.</p><a className="btn sm s" href={'#/manage/' + item.id}>Open release checklist</a></div>}</>}
          {sub === 'released' && <><Eyebrow dot="var(--success)">Results are out</Eyebrow><h1 className="h1">{item.title.replace('R&D Quiz · ', '')} results<br />are in.</h1>{res ? <div className="row center" style={{ margin: '4px 0 22px' }}><span className="mono" style={{ fontSize: 56, fontWeight: 500 }}>{res.total}</span><span className="muted">/ {res.max}</span><span className="fg2" style={{ marginLeft: 10 }}>Rank {res.rank} of {res.count}</span></div> : resp === undefined || res === undefined ? <p className="sub mb">Loading your result…</p> : <p className="sub mb">You didn't take this round. The answer key is still there to learn from.</p>}<div className="row"><a className="btn p" href={'#/library/' + item.id}>Open answer key</a><a className="btn s" href={'#/leaderboard/' + item.id}>See leaderboard</a></div>{cur.next && <p className="muted small mt">Next round opens {fmtDateTime(cur.next.opens)}.</p>}{isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · released</div><p className="fg2" style={{ margin: '8px 0 12px' }}>Released {fmtDateTime(item.releasedAt)}.</p><a className="btn sm" href={'#/manage/' + item.id}>View in Manage quizzes</a></div>}</>}
          {(sub === 'live' || sub === 'progress' || sub === 'submitted') && isStaff(role) && <div className="strip"><div className="lab" style={{ color: 'var(--warn)' }}>Admin · live</div><p className="fg2" style={{ margin: '8px 0 12px' }}>{counts ? `${counts.submitted} submitted, ${counts.started} started.` : 'Counting…'} Participant counts are visible to admins and creators only.</p><a className="btn sm s" href={'#/manage/' + item.id}>Reminders and deadline in Manage quizzes</a></div>}
        </div>
        {mascotOn && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', borderLeft: '1px solid var(--border)', padding: '6px 0 6px 24px' }}><Mascot id={m.id} pose={poseFor(moment)} size={250} /><div className="fg2" style={{ fontSize: 15, maxWidth: 280 }}>{line}</div></div>}
      </div>
      <div className="row mt" style={{ gap: 16 }}>
        <div style={{ flex: '1 1 0', minWidth: 180, display: 'flex' }}><Score icon="flame" color="#E0A04B" label="Current streak" value={sum.streak} unit="rounds" /></div>
        <div style={{ flex: '1 1 0', minWidth: 180, display: 'flex' }}><Score icon="target" color="#5FC9C0" label="Average score" value={sum.rounds ? sum.avg.toFixed(1) : '–'} unit={sum.rounds ? '/ ' + Math.round(avgMax) : ''} /></div>
        <div style={{ flex: '1 1 0', minWidth: 180, display: 'flex' }}><Score icon="check" color="#5FC9C0" label="Rounds completed" value={sum.rounds} /></div>
      </div>
      <div className="mt"><Journey points={sum.points} thresholds={settings.thresholds} /></div>
    </div>
  );
}
function Tracker() {
  const Step = ({ done, label }) => <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: '1 1 0', minWidth: 64 }}><IconCircle size={36} bg={done ? 'var(--accent)' : 'var(--bg1)'} bd={done ? 'var(--accent)' : 'var(--border2)'}>{done ? <Icon name="check" size={18} color="#07221F" /> : <Icon name="clock" size={18} color="#B8C5CC" />}</IconCircle><span className="small" style={{ textAlign: 'center', color: done ? 'var(--fg)' : 'var(--fg2)' }}>{label}</span></div>;
  const line = (dashed) => <div style={{ flex: '0 1 40px', minWidth: 10, marginTop: 17, borderTop: '2px ' + (dashed ? 'dashed var(--border2)' : 'solid var(--accent)') }} />;
  return <div className="row" style={{ gap: 0, alignItems: 'flex-start', marginTop: 22, maxWidth: 520 }} aria-label="Progress: quiz open, answers submitted, results released"><Step done label="Quiz open" />{line(false)}<Step done label="Answers submitted" />{line(true)}<Step label="Results released" /></div>;
}
function Eyebrow({ dot, live, children }) { return <div className="row center" style={{ gap: 8, marginBottom: 16 }}>{live ? <span className="live-dot" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />}<span className="eyebrow" style={live ? { color: 'var(--warn)' } : {}}>{children}</span></div>; }
function LastLinks({ last }) { return <div className="row" style={{ marginTop: 6 }}><a className="btn p" href={'#/leaderboard/' + last.id}>See last round's results</a><a className="btn s" href={'#/library/' + last.id}>Open answer key</a></div>; }
