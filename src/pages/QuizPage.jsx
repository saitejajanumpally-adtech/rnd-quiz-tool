import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { store } from '../lib/store.js';
import { loadQuiz, loadMyResponse, saveAnswer, submitResponse } from '../lib/ops.js';
import { quizStatus, allQuestions } from '../lib/quizModel.js';
import { isAnswered } from '../lib/scoring.js';
import { summarize } from '../lib/stages.js';
import { fmtDateTime } from '../lib/time.js';
import { QuestionInput } from '../components/inputs.jsx';
import { Rich } from '../components/Rich.jsx';
import { Spinner, Saved, SAVE_COPY, ErrorBox, Confetti, Icon, IconCircle } from '../components/ui.jsx';
import { Bolt, Mascot, MascotPic, useMascot, poseFor, lineFor, showsMoment } from '../components/mascots.jsx';

// Shown right after someone confirms the submit: a short celebration, then Continue leads to "You're in".
function FinishMoment({ item, first, answered, total, minutes, streak, variant, onContinue }) {
  const m = useMascot(); const moment = variant.moment; const on = showsMoment(moment, m.mode);
  const seed = React.useMemo(() => Math.floor(Math.random() * 1000), []);
  const line = lineFor(moment, { first, n: streak }, m, seed);
  const Step = ({ done, label, sub }) => <div className="row" style={{ flexWrap: 'nowrap', gap: 10, alignItems: 'flex-start', flex: '1 1 0', minWidth: 120 }}><IconCircle size={30} bg={done ? 'var(--accent)' : 'var(--bg1)'} bd={done ? 'var(--accent)' : 'var(--border2)'}>{done ? <Icon name="check" size={16} color="#07221F" /> : <Icon name="clock" size={15} color="#B8C5CC" />}</IconCircle><div><div style={{ fontSize: 13, fontWeight: 500, color: done ? 'var(--fg)' : 'var(--fg2)' }}>{label}</div><div className="muted small">{sub}</div></div></div>;
  return (
    <div className="pan mt"><div className="fin" role="region" aria-label="Round complete">
      {on && <><div className="glow" /><Confetti w={1100} h={520} n={40} seed={11} keep={[380, 1100, 60, 500]} /></>}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: on ? 'repeat(auto-fit,minmax(280px,1fr))' : '1fr', gap: 20, alignItems: 'center' }}>
        {on && <div style={{ display: 'flex', justifyContent: 'center' }}><Mascot id={m.id} pose={poseFor(moment)} size={360} /></div>}
        <div>
          <div className="lab" style={{ color: 'var(--accent)' }}>{item.title.replace('R&D Quiz · ', '')} · Complete</div>
          <h1 className="h1" style={{ fontSize: 44, margin: '10px 0 0' }}>Round complete, {first}.</h1>
          {on && <div style={{ marginTop: 16, maxWidth: 460, background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}><div className="lab" style={{ marginBottom: 4 }}>{m.short} says</div><div style={{ fontSize: 17 }}>{line}</div></div>}
          <div className="row" style={{ marginTop: 18, maxWidth: 500, gap: 10 }}>
            <div className="tile" style={{ flex: '1 1 110px', padding: 12 }}><div className="lab">Answered</div><div className="v" style={{ fontSize: 26 }}>{answered}<small> / {total}</small></div></div>
            <div className="tile" style={{ flex: '1 1 110px', padding: 12 }}><div className="lab">Start to submit</div><div className="v" style={{ fontSize: 26 }}>{minutes}<small> min</small></div></div>
            <div className="tile" style={{ flex: '1 1 110px', padding: 12 }}><div className="lab" style={{ color: 'var(--accent)' }}>Streak</div><div className="v" style={{ fontSize: 26 }}>{streak}<small> {streak === 1 ? 'round*' : 'rounds*'}</small></div></div>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>*Counts once the quiz closes.</div>
          <div className="row" style={{ marginTop: 20, maxWidth: 540, gap: 10, alignItems: 'flex-start' }}>
            <Step done label="Answers locked" sub="Now" /><Step label="Quiz closes" sub={fmtDateTime(item.closes)} /><Step label="Results" sub={item.keyAt ? 'Planned ' + fmtDateTime(item.keyAt) : 'After the quiz closes'} />
          </div>
          <div style={{ marginTop: 22 }}><button className="btn p" autoFocus onClick={onContinue}>Continue →</button></div>
        </div>
      </div>
    </div></div>
  );
}

function SubmitDialog({ unanswered, closes, onCancel, onSubmit, busy }) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Submit your answers?" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="row center" style={{ gap: 20 }}>
          <MascotPic moment="review" size={130} />
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div className="h3" style={{ fontSize: 22, marginBottom: 8 }}>Submit your answers?</div>
            <div className="fg2" style={{ fontSize: 16, lineHeight: 1.5 }}>Once you submit, you can't change your answers.</div>
            <div className="muted small" style={{ marginTop: 10 }}>{unanswered ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will score 0. ` : 'All questions are answered. '}The quiz closes {fmtDateTime(closes)}.</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}><button className="btn" onClick={onCancel}>Cancel</button><button className="btn p" disabled={busy} onClick={onSubmit}>Submit quiz</button></div>
      </div>
    </div>
  );
}

export default function QuizPage({ id }) {
  const { user, index, now, toast, stats } = useApp(); const item = index[id];
  const [quiz, setQuiz] = useState(null); const [answers, setAnswers] = useState({}); const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState(null); const [si, setSi] = useState(0);
  const [save, setSave] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle'));
  const [justDone, setJustDone] = useState(false);
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [finish, setFinish] = useState(null);
  const exists = useRef(false); const chain = useRef(Promise.resolve()); const timers = useRef({}); const [secStart, setSecStart] = useState({}); const startedAt = useRef(0);
  const pending = useRef({});
  const localKey = 'arena-pending-' + id + '-' + user.uid;
  const savePendingToLocal = () => { try { const n = Object.keys(pending.current).length; if (n) localStorage.setItem(localKey, JSON.stringify(pending.current)); else localStorage.removeItem(localKey); } catch (e) { /* storage full or unavailable: the in-memory retry still covers this tab */ } };

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [q, r] = await Promise.all([loadQuiz(id), loadMyResponse(id, user.uid)]);
        if (!on) return; setQuiz(q); if (r) { exists.current = true; startedAt.current = r.startedAt || 0; setAnswers(r.answers || {}); setSubmitted(!!r.submitted); }
        // Resume anything left over from a closed tab or crash before it finished saving.
        try {
          const raw = localStorage.getItem(localKey); const restored = raw ? JSON.parse(raw) : null; const keys = restored ? Object.keys(restored) : [];
          if (keys.length) { setAnswers((a) => ({ ...a, ...restored })); Object.assign(pending.current, restored); toast(`Picked up ${keys.length} answer${keys.length === 1 ? '' : 's'} that hadn't finished saving last time.`); keys.forEach((qid) => run(qid)); }
        } catch (e) { /* ignore a corrupted local backup */ }
      } catch (e) { if (on) setErr(e); }
    })();
    return () => { on = false; };
  }, [id, user.uid]);

  const status = item ? quizStatus(item, now) : 'none';
  const run = (qid) => {
    clearTimeout(timers.current[qid]);
    if (!(qid in pending.current)) return;
    const value = pending.current[qid]; delete pending.current[qid]; savePendingToLocal();
    chain.current = chain.current.then(async () => {
      try {
        await saveAnswer(user, id, qid, value, exists.current); if (!exists.current) startedAt.current = startedAt.current || Date.now(); exists.current = true;
        await store.waitForSync();
        setSave(Object.keys(pending.current).length ? (navigator.onLine ? 'saving' : 'offline') : 'saved');
      } catch (e) {
        if (/permission-denied/i.test((e && e.code) || '')) { setSave('blocked'); return; } // won't succeed by retrying; don't loop forever
        setSave(navigator.onLine ? 'error' : 'offline');
        if (!(qid in pending.current)) { pending.current[qid] = value; savePendingToLocal(); }
        timers.current[qid] = setTimeout(() => run(qid), 4000);
      }
    });
  };
  const persist = (qid, value, delay) => { pending.current[qid] = value; savePendingToLocal(); clearTimeout(timers.current[qid]); setSave(navigator.onLine ? 'saving' : 'offline'); timers.current[qid] = setTimeout(() => run(qid), delay); };
  const change = (q, v) => { setAnswers((a) => ({ ...a, [q.id]: v })); persist(q.id, v, q.type === 'text' ? 800 : 250); };
  const flush = async () => { Object.keys(pending.current).forEach(run); await chain.current; if (Object.keys(pending.current).length) throw new Error('Some answers could not be saved. Check your connection and try again.'); };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  // Retry the moment the connection returns, instead of waiting for the next 4s timer tick.
  useEffect(() => {
    const goOnline = () => { Object.keys(pending.current).forEach((qid) => run(qid)); setSave((s) => (Object.keys(pending.current).length ? 'saving' : (s === 'offline' ? 'saved' : s))); };
    const goOffline = () => setSave((s) => (Object.keys(pending.current).length || s === 'saving' ? 'offline' : s));
    window.addEventListener('online', goOnline); window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []); // eslint-disable-line
  const [, setTick] = useState(0);

  const curSec = quiz ? quiz.sections[Math.min(si, quiz.sections.length - 1)] : null;
  const inReview = quiz ? si >= quiz.sections.length : false;
  useEffect(() => { if (curSec && curSec.timerMin && !inReview && secStart[si] === undefined) setSecStart((p) => ({ ...p, [si]: Date.now() })); }, [si, quiz]); // eslint-disable-line
  useEffect(() => { if (!(curSec && curSec.timerMin)) return undefined; const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, [si, quiz]); // eslint-disable-line
  const left = curSec && curSec.timerMin && !inReview && secStart[si] !== undefined ? Math.max(0, secStart[si] + curSec.timerMin * 60000 - Date.now()) : null;
  useEffect(() => { if (left === 0 && quiz && si < quiz.sections.length) { toast('Section time is up. Moving on.'); setSi(si + 1); } }, [left]); // eslint-disable-line

  if (item && status === 'scheduled') return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>This quiz hasn't opened yet</div><div className="fg2">It opens {fmtDateTime(item.opens)}. <a href="#/">Back to the Arena</a></div></div>;
  if (err) return <div className="mt"><ErrorBox error={err} /></div>;
  if (!item || !quiz) return item === undefined && Object.keys(index).length ? <div className="card mt"><div className="h3">That quiz doesn't exist</div><a href="#/">Back to the Arena</a></div> : <Spinner />;
  if (status !== 'live' && !submitted) return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>This quiz is closed</div><div className="fg2">It closed {fmtDateTime(item.closes)}.{item.autoSubmit && Object.keys(answers).length ? ' Your saved answers will be submitted automatically.' : ''} <a href="#/">Back to the Arena</a></div></div>;
  if (submitted && finish) return <FinishMoment item={item} {...finish} onContinue={() => setFinish(null)} />;
  if (submitted) return (
    <div className="pan mt"><div className="row">
      <div className="card teal pad" style={{ flex: '999 1 520px' }}><div className="eyebrow">Submitted</div><h1 className="h1" style={{ margin: '12px 0' }}>You're in.<br />Answers are locked.</h1><p className="sub mb">Thanks for taking part. Results and the answer key arrive after the quiz closes on {fmtDateTime(item.closes)}.</p><a className="btn p" href="#/">Back to the Arena</a></div>
      <div className="col" style={{ flex: '1 1 300px' }}><Bolt moment="submitted" force /></div>
    </div></div>
  );

  const secs = quiz.sections; const flat = secs.length === 1 && !!secs[0].flat; const sec = secs[Math.min(si, secs.length - 1)]; const qs = allQuestions(quiz);
  const secDone = (s) => s.questions.every((q) => isAnswered(answers[q.id]));
  const total = qs.length; const done = qs.filter((q) => isAnswered(answers[q.id])).length; const review = inReview;
  const missingReq = qs.filter((q) => q.required && !isAnswered(answers[q.id]));
  const notSynced = save !== 'saved' && save !== 'idle';
  const next = () => { if (si < secs.length) { setSi(si + 1); setJustDone(true); } };
  const goTo = (q) => { setSi(q.sectionIndex); setTimeout(() => { const el = document.getElementById('q-' + q.id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); };

  const doSubmit = async () => {
    if (missingReq.length) { toast('Answer every required question first.', 'err'); setConfirm(false); return; }
    if (notSynced) { toast('Wait for your answers to finish saving before submitting.', 'err'); setConfirm(false); return; }
    setBusy(true);
    try {
      await flush(); await submitResponse(user, id); const t = Date.now();
      const closedIds = Object.values(index).filter((i) => i.published && t >= i.closes).sort((a, b) => a.opens - b.opens).map((i) => i.id);
      const sum = summarize(stats.history, closedIds, Object.keys(index)); const streak = sum.streak + 1;
      const late = item.closes - t < 10 * 60000; const firstEver = Object.keys(stats.history).filter((k) => index[k]).length === 0;
      const moment = late ? 'finishedLate' : firstEver ? 'finishedFirst' : streak >= 3 ? 'finishedStreak' : 'finished';
      setFinish({ first: (user.name || '').split(' ')[0] || 'there', answered: done, total, minutes: Math.max(1, Math.round((t - (startedAt.current || t)) / 60000)), streak, variant: { moment } });
      setConfirm(false); setSubmitted(true);
    } catch (e) { toast('Couldn\'t submit. ' + (e.message || ''), 'err'); setConfirm(false); }
    setBusy(false);
  };

  return (
    <div className="mt" style={{ maxWidth: 900, margin: '28px auto 0' }}>
      <div className="row between center mb"><a href="#/" className="fg2">← Leave quiz</a><div className="h3" style={{ fontSize: 16 }}>{item.title}</div><Saved state={save} /></div>
      {(save === 'error' || save === 'offline' || save === 'blocked') && <div className="mb"><Bolt moment="error" card={false} size={72} /></div>}
      <div className="sections">
        {!flat && secs.map((s, i) => <button key={s.id} className={'sec' + (i === si ? ' on' : '') + (secDone(s) && i !== si ? ' done' : '')} onClick={() => setSi(i)}><span className="lab" style={{ color: i === si ? 'var(--accent)' : secDone(s) ? 'var(--success)' : 'var(--muted)' }}>Section {i + 1}{secDone(s) && i !== si ? ' · done' : ''}</span><b>{s.title}</b></button>)}
        {flat && <button className={'sec' + (!review ? ' on' : '')} onClick={() => setSi(0)}><span className="lab" style={{ color: !review ? 'var(--accent)' : 'var(--muted)' }}>Questions</span><b>{total} questions</b></button>}
        <button className={'sec' + (review ? ' on' : '')} onClick={() => setSi(secs.length)}><span className="lab" style={{ color: review ? 'var(--accent)' : 'var(--muted)' }}>Finish</span><b>Review and submit</b></button>
      </div>
      {justDone && si > 0 && !review && !flat && <div className="mb"><Bolt moment="sectionDone" card={false} size={72} /></div>}
      {si === 0 && !review && <div className="mb"><Bolt moment="sectionStart" vars={{ n: 1, total: secs.length, title: flat ? 'the questions' : sec.title }} card={false} size={72} /></div>}
      {!review && sec && (<div className="pan" key={si}>
        <div className="row between center" style={{ marginBottom: 6 }}><div><div className="h2" style={{ fontSize: 22 }}>{flat ? 'Questions' : sec.title}</div>{sec.intro && <div className="muted" style={{ marginTop: 2 }}>{sec.intro}</div>}</div><div className="row center" style={{ gap: 10 }}>{left !== null && <span className="chip warn" role="timer">{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} left</span>}<span className="chip">{sec.questions.filter((q) => isAnswered(answers[q.id])).length} of {sec.questions.length} answered</span></div></div>
        <div className="bar mb"><i style={{ width: (sec.questions.length ? (sec.questions.filter((q) => isAnswered(answers[q.id])).length / sec.questions.length) * 100 : 0) + '%' }} /></div>
        {sec.questions.map((q) => (
          <div className="q" key={q.id} id={'q-' + q.id}>
            <div style={{ marginBottom: 12 }}><span className="eyebrow" style={{ color: 'var(--info)' }}>Question {qs.findIndex((x) => x.id === q.id) + 1}</span>{q.points > 0 && <span className="eyebrow" style={{ color: 'var(--warn)', marginLeft: 12 }}>{q.type === 'text' ? 'Up to ' : ''}{q.points} points</span>}{q.required && <span className="req">Required</span>}</div>
            <div className="qt"><Rich text={q.text} /></div>{q.ask && <div className="qa"><Rich text={q.ask} /></div>}{!q.ask && <div style={{ height: 12 }} />}
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => change(q, v)} />
          </div>
        ))}
        <div className="row between center"><button className="btn" disabled={si === 0} onClick={() => setSi(si - 1)}>{flat ? 'Previous' : 'Previous section'}</button><button className="btn p" onClick={next}>{si === secs.length - 1 ? 'Review and submit' : `Next section: ${secs[si + 1].title}`}</button></div>
      </div>)}
      {review && (<div className="pan">
        <div className="card teal pad"><div className="eyebrow">Ready to submit</div><div className="h2" style={{ margin: '8px 0 14px' }}>{done} of {total} questions answered</div>
          {!flat && secs.map((s) => { const n = s.questions.filter((q) => isAnswered(answers[q.id])).length; return <div key={s.id} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}><span>{s.title}</span><span className={'chip ' + (n === s.questions.length ? 'ok' : 'warn')}>{n} of {s.questions.length}</span></div>; })}
          {missingReq.length > 0 && <div style={{ margin: '14px 0', padding: 14, background: 'var(--bg1)', border: '1px solid rgba(224,160,75,.5)', borderRadius: 12 }}>
            <div className="row center" style={{ gap: 14 }}><MascotPic moment="requiredLeft" size={84} /><div style={{ minWidth: 0 }}><div className="lab" style={{ color: 'var(--warn)' }}>Answer these to submit</div><div className="fg2 small" style={{ marginTop: 2 }}>{missingReq.length} required {missingReq.length === 1 ? 'answer' : 'answers'} left.</div></div></div>
            {missingReq.map((q) => <div key={q.id} className="row between center" style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}><span>Question {qs.findIndex((x) => x.id === q.id) + 1}{q.sectionTitle ? ' · ' + q.sectionTitle : ''}</span><button className="btn sm s" onClick={() => goTo(q)}>Go to question →</button></div>)}
          </div>}
          {missingReq.length === 0 && !notSynced && <div className="mb" style={{ marginTop: 6 }}><Bolt moment="review" card={false} size={84} /></div>}
          {notSynced && <div className="banner warn" role="alert"><span>{SAVE_COPY[save] || SAVE_COPY.saving}</span></div>}
          <p className="fg2" style={{ margin: '16px 0' }}>{item.autoSubmit ? 'If you forget, your saved answers are submitted for you when the quiz closes. Submitting yourself locks your answers now.' : 'Unsubmitted answers will not count. Submitting locks your answers.'} Closes {fmtDateTime(item.closes)}.{missingReq.length > 0 && item.autoSubmit ? ' Required questions left blank score 0.' : ''}</p>
          <div className="row"><button className="btn" onClick={() => setSi(secs.length - 1)}>Back to questions</button><button className={'btn p' + (missingReq.length || notSynced ? '' : ' cta')} disabled={missingReq.length > 0 || notSynced} onClick={() => setConfirm(true)}>Submit quiz</button></div>
          {missingReq.length > 0 && <div className="muted small" style={{ marginTop: 10 }}>Submit turns on once every required question has an answer.</div>}
          {missingReq.length === 0 && notSynced && <div className="muted small" style={{ marginTop: 10 }}>Submit turns on once every answer is confirmed saved.</div>}
        </div></div>)}
      {confirm && <SubmitDialog unanswered={total - done} closes={item.closes} busy={busy} onCancel={() => setConfirm(false)} onSubmit={doSubmit} />}
    </div>
  );
}
