import React, { useState, useMemo } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { allQuestions } from '../lib/quizModel.js';
import { rangeStart, quarterLabel, fmtRange } from '../lib/time.js';
import { isStaff, myReviewRequests, requestReview } from '../lib/ops.js';
import { QuestionKey } from '../components/inputs.jsx';
import { Spinner, ErrorBox, useAsync, Seg, Chip } from '../components/ui.jsx';
import { Bolt } from '../components/mascots.jsx';
import { Rich } from '../components/Rich.jsx';

const RANGES = [['quarter', 'This quarter'], ['m6', 'Last 6 months'], ['m12', 'Last 12 months'], ['all', 'All time']];
export function Library() {
  const { index, stats, now, role } = useApp();
  const [range, setRange] = useState('quarter'); const [show, setShow] = useState('all'); const [text, setText] = useState('');
  const from = rangeStart(range, now);
  const items = useMemo(() => Object.values(index).filter((i) => i.released && (i.showInLibrary !== false || isStaff(role)) && i.opens >= from)
    .filter((i) => show === 'all' || (show === 'taken') === !!stats.history[i.id]).filter((i) => i.title.toLowerCase().includes(text.toLowerCase())).sort((a, b) => b.opens - a.opens), [index, stats, range, show, text, role, now]); // eslint-disable-line
  return (
    <div className="pan mt">
      <div className="row between center mb"><div><div className="h2">Quiz library</div><div className="fg2" style={{ marginTop: 2 }}>Every released quiz with its questions and correct answers, whether you took it or not.</div></div><input className="input" style={{ width: 240 }} placeholder="Search quizzes" aria-label="Search quizzes" value={text} onChange={(e) => setText(e.target.value)} /></div>
      <div className="row" style={{ gap: 28 }}>
        <div><div className="lab" style={{ marginBottom: 8 }}>Date range</div><Seg value={range} options={RANGES} onChange={setRange} /></div>
        <div><div className="lab" style={{ marginBottom: 8 }}>Show</div><Seg value={show} options={[['all', 'All'], ['taken', 'Taken'], ['not', 'Not taken']]} onChange={setShow} /></div>
      </div>
      <div className="muted small" style={{ margin: '14px 0 16px' }}>{items.length} {items.length === 1 ? 'quiz' : 'quizzes'} · {range === 'quarter' ? `This quarter (${quarterLabel(now)})` : RANGES.find((r) => r[0] === range)[1]}</div>
      {items.length === 0 && <div className="card" style={{ textAlign: 'center' }}><div className="fg2" style={{ marginBottom: 12 }}>No quizzes in this range. Try a longer range.</div><Bolt moment="empty" card={false} size={110} /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
        {items.map((i) => { const h = stats.history[i.id]; return (
          <a key={i.id} href={'#/library/' + i.id} className="card" style={{ color: 'var(--fg)', textDecoration: 'none', padding: 18 }}>
            <div className="row between"><b style={{ fontWeight: 500 }}>{i.title}</b><span style={{ color: 'var(--accent)' }}>→</span></div>
            <div className="muted small" style={{ margin: '6px 0 10px' }}>{fmtRange(i.opens, i.closes)}</div>
            <div className="row center"><Chip tone={h ? 'ok' : ''}>{h ? `Taken · ${h.score} / ${h.max}` : 'Not taken'}</Chip>{i.showInLibrary === false && <Chip tone="warn">Hidden from library</Chip>}</div>
          </a>); })}
      </div>
    </div>
  );
}

export function LibraryDetail({ id }) {
  const { user, role, index, toast, ask } = useApp(); const item = index[id];
  const [mine, setMine] = useState(true); const [filter, setFilter] = useState('all'); const [asked, setAsked] = useState([]);
  const { loading, data, error } = useAsync(async () => {
    const [quiz, key, res, resp, reqs] = await Promise.all([store.get('quizzes/' + id), store.get('quizKeys/' + id), store.get(`myResults/${id}_${user.uid}`).catch(() => null), store.get(`responses/${id}_${user.uid}`).catch(() => null), myReviewRequests(user, id).catch(() => [])]);
    setAsked(reqs); return { quiz, key, res, resp };
  }, [id]);
  if (error) return <div className="mt"><ErrorBox error={error} /></div>;
  if (loading || !data) return <Spinner />;
  const { quiz, key, res, resp } = data;
  if (!quiz || !key || (!key.released && !isStaff(role))) return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>The answer key isn't released yet</div><div className="fg2">It will appear here once the quiz is released. <a href="#/library">Back to the library</a></div></div>;
  const took = !!res; const showMine = took && mine; const qs = allQuestions(quiz);
  const pill = (q) => { if (!showMine || q.type === 'rating') return null; const r = res.questions[q.id]; if (!r) return null; if (r.pending) return <span className="chip warn">Awaiting score</span>; const full = r.score >= r.max; return <span className={'chip ' + (full ? 'ok' : r.score === 0 ? 'bad' : 'warn')}>{full ? 'Correct' : r.score === 0 ? (q.type === 'text' ? 'No credit' : 'Incorrect') : 'Partly'} · {r.score} / {r.max}</span>; };
  const needsLook = (q) => showMine && res.questions[q.id] && res.questions[q.id].max > 0 && res.questions[q.id].score < res.questions[q.id].max;
  const shown = qs.filter((q) => filter === 'all' || needsLook(q));
  const full = took ? qs.filter((q) => res.questions[q.id] && res.questions[q.id].max > 0 && res.questions[q.id].score >= res.questions[q.id].max).length : 0;
  const askReview = async (q) => {
    const note = await ask({ title: 'Request a review', body: 'A creator or admin will take another look at this score.', input: { label: 'What should the reviewer look at?', multiline: true, required: true }, ok: 'Send request' });
    if (!note) return; try { await requestReview(user, id, q.id, note, quiz.title); setAsked((a) => [...a, q.id]); toast('Review requested.'); } catch (e) { toast('Couldn\'t send that request.', 'err'); }
  };
  return (
    <div className="mt" style={{ maxWidth: 900, margin: '24px auto 0' }}>
      <a href="#/library" className="fg2">← Quiz library</a>
      <div className="row between center" style={{ margin: '14px 0 18px' }}>
        <div><div className="h2">{quiz.title}</div><div className="fg2" style={{ marginTop: 2 }}>{item ? fmtRange(item.opens, item.closes) : ''} · {took ? (mine ? `You took this quiz · Score ${res.total} / ${res.max}` : 'You took this quiz') : 'You didn\'t take this quiz'}</div></div>
        {took && <button className="switch" style={{ width: 'auto', border: 0, padding: 0 }} role="switch" aria-checked={mine} onClick={() => setMine(!mine)}><span>Show my answers</span><span className={'track' + (mine ? ' on' : '')} /></button>}
      </div>
      {!key.released && <div className="banner warn"><span>Preview for admins and creators. Participants can't see this until it's released.</span></div>}
      {took && !mine && <div className="banner" role="note"><span>Your answers, feedback and written scores are hidden. Turn on “Show my answers” to review them. The correct answers stay visible.</span></div>}
      {took && mine && <div className="row mb" style={{ marginTop: 16 }}><div className="tile"><div className="lab">Your score</div><div className="v">{res.total}<small> / {res.max}</small></div></div><div className="tile"><div className="lab">Fully correct</div><div className="v" style={{ color: 'var(--success)' }}>{full}<small> of {qs.filter((q) => q.points > 0).length}</small></div></div><div className="tile"><div className="lab">Worth another look</div><div className="v" style={{ color: 'var(--warn)' }}>{qs.filter(needsLook).length}</div></div></div>}
      {took && mine && <div className="seg mb"><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All questions</button><button className={filter === 'look' ? 'on' : ''} onClick={() => setFilter('look')}>Worth another look</button></div>}
      <div className="mb"><Bolt moment="answerKey" card={false} size={84} /></div>
      {shown.map((q) => {
        const k = (key.answers || {})[q.id]; const r = showMine ? res.questions[q.id] : null; const num = qs.findIndex((x) => x.id === q.id) + 1;
        return (
          <div className="q" key={q.id} style={{ borderColor: 'var(--border)' }}>
            <div className="row between center" style={{ marginBottom: 12 }}><span className="eyebrow">Question {num}{q.sectionTitle ? ' · ' + q.sectionTitle : ''}</span>{pill(q)}</div>
            <div className="qt"><Rich text={q.text} /></div>{q.ask && <div className="qa"><Rich text={q.ask} /></div>}{!q.ask && <div style={{ height: 12 }} />}
            <QuestionKey q={q} k={k} mine={resp ? (resp.answers || {})[q.id] : undefined} showMine={showMine} />
            {q.type !== 'text' && k && k.explanation && <div className="why"><span className="muted">Why: </span><Rich text={k.explanation} /></div>}
            {q.type === 'text' && showMine && <>
              <div className="lab" style={{ margin: '8px 0 4px' }}>Your answer</div><div className="box2">{(resp && (resp.answers || {})[q.id]) || 'No answer recorded.'}</div>
              {r && r.feedback && <><div className="lab" style={{ marginBottom: 4 }}>Feedback on your answer</div><div className="box2" style={{ borderColor: 'color-mix(in srgb, var(--warn) 50%, transparent)' }}>{r.feedback}</div></>}
              {item && item.allowReviewRequests && (asked.includes(q.id) ? <span className="chip teal">Review requested</span> : <button className="btn sm" onClick={() => askReview(q)}>Request review</button>)}
            </>}
          </div>);
      })}
    </div>
  );
}
