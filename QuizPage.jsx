import React, { useEffect, useRef, useState } from 'react';
import { useApp, go } from '../ctx.jsx';
import { loadQuiz, loadMyResponse, saveAnswer, submitResponse } from '../lib/ops.js';
import { quizStatus, allQuestions } from '../lib/quizModel.js';
import { isAnswered } from '../lib/scoring.js';
import { fmtDateTime } from '../lib/time.js';
import { QuestionInput } from '../components/inputs.jsx';
import { Spinner, Saved, ErrorBox, Funnel } from '../components/ui.jsx';
import { Bolt } from '../components/mascots.jsx';

export default function QuizPage({ id }) {
  const { user, index, now, toast, ask } = useApp(); const item = index[id];
  const [quiz, setQuiz] = useState(null); const [answers, setAnswers] = useState({}); const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState(null); const [si, setSi] = useState(0); const [save, setSave] = useState('idle'); const [justDone, setJustDone] = useState(false);
  const exists = useRef(false); const chain = useRef(Promise.resolve()); const timers = useRef({}); const [secStart, setSecStart] = useState({});

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [q, r] = await Promise.all([loadQuiz(id), loadMyResponse(id, user.uid)]);
        if (!on) return; setQuiz(q); if (r) { exists.current = true; setAnswers(r.answers || {}); setSubmitted(!!r.submitted); }
      } catch (e) { if (on) setErr(e); }
    })();
    return () => { on = false; };
  }, [id, user.uid]);

  const status = item ? quizStatus(item, now) : 'none';
  const pending = useRef({});
  const run = (qid) => {
    clearTimeout(timers.current[qid]);
    if (!(qid in pending.current)) return;
    const value = pending.current[qid]; delete pending.current[qid];
    chain.current = chain.current.then(async () => {
      try { await saveAnswer(user, id, qid, value, exists.current); exists.current = true; setSave(Object.keys(pending.current).length ? 'saving' : 'saved'); }
      catch (e) { setSave('error'); if (!(qid in pending.current)) pending.current[qid] = value; timers.current[qid] = setTimeout(() => run(qid), 4000); }
    });
  };
  const persist = (qid, value, delay) => { pending.current[qid] = value; clearTimeout(timers.current[qid]); setSave('saving'); timers.current[qid] = setTimeout(() => run(qid), delay); };
  const change = (q, v) => { setAnswers((a) => ({ ...a, [q.id]: v })); persist(q.id, v, q.type === 'text' ? 800 : 250); };
  const flush = async () => { Object.keys(pending.current).forEach(run); await chain.current; if (Object.keys(pending.current).length) throw new Error('Some answers could not be saved. Check your connection and try again.'); };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
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
  if (status === 'scheduled') return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>This quiz hasn't opened yet</div><div className="fg2">It opens {fmtDateTime(item.opens)}. <a href="#/">Back to the Arena</a></div></div>;
  if (status !== 'live' && !submitted) return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>This quiz is closed</div><div className="fg2">It closed {fmtDateTime(item.closes)}.{item.autoSubmit && Object.keys(answers).length ? ' Your saved answers will be submitted automatically.' : ''} <a href="#/">Back to the Arena</a></div></div>;
  if (submitted) return (
    <div className="pan mt"><div className="row">
      <div className="card teal pad" style={{ flex: '999 1 520px' }}><div className="eyebrow">Submitted</div><h1 className="h1" style={{ margin: '12px 0' }}>You're in.<br />Answers are locked.</h1><p className="sub mb">Thanks for taking part. Results and the answer key arrive after the quiz closes on {fmtDateTime(item.closes)}.</p><a className="btn p" href="#/">Back to the Arena</a></div>
      <div className="col" style={{ flex: '1 1 300px' }}><Bolt moment="submitted" /></div>
    </div></div>
  );

  const secs = quiz.sections; const sec = secs[Math.min(si, secs.length - 1)]; const qs = allQuestions(quiz);
  const secDone = (s) => s.questions.every((q) => isAnswered(answers[q.id]));
  const total = qs.length; const done = qs.filter((q) => isAnswered(answers[q.id])).length; const review = inReview;
  const next = () => { if (si < secs.length) { setSi(si + 1); setJustDone(true); } };

  const doSubmit = async () => {
    const unanswered = total - done;
    const ok = await ask({ title: 'Submit your answers?', body: `Once you submit, you can't change your answers.${unanswered ? `\n\n${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered and will score 0.` : ''}`, ok: 'Submit quiz' });
    if (!ok) return;
    try { await flush(); await submitResponse(user, id); setSubmitted(true); toast('Submitted. Answers are locked.'); }
    catch (e) { toast('Couldn\'t submit. ' + (e.message || ''), 'err'); }
  };

  return (
    <div className="mt" style={{ maxWidth: 900, margin: '28px auto 0' }}>
      <div className="row between center mb"><a href="#/" className="fg2">← Leave quiz</a><div className="h3" style={{ fontSize: 16 }}>{item.title}</div><Saved state={save} /></div>
      <div className="sections">
        {secs.map((s, i) => <button key={s.id} className={'sec' + (i === si ? ' on' : '') + (secDone(s) && i !== si ? ' done' : '')} onClick={() => setSi(i)}><span className="lab" style={{ color: i === si ? 'var(--accent)' : secDone(s) ? 'var(--success)' : 'var(--muted)' }}>Section {i + 1}{secDone(s) && i !== si ? ' · done' : ''}</span><b>{s.title}</b></button>)}
        <button className={'sec' + (review ? ' on' : '')} onClick={() => setSi(secs.length)}><span className="lab" style={{ color: review ? 'var(--accent)' : 'var(--muted)' }}>Finish</span><b>Review and submit</b></button>
      </div>
      {justDone && si > 0 && !review && <div className="mb"><Bolt moment="sectionDone" card={false} size={48} /></div>}
      {si === 0 && !review && <div className="mb"><Bolt moment="live" card={false} size={48} /></div>}
      {!review && sec && (<div className="pan" key={si}>
        <div className="row between center" style={{ marginBottom: 6 }}><div><div className="h2" style={{ fontSize: 22 }}>{sec.title}</div>{sec.intro && <div className="muted" style={{ marginTop: 2 }}>{sec.intro}</div>}</div><div className="row center" style={{ gap: 10 }}>{left !== null && <span className="chip warn" role="timer">{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} left</span>}<span className="chip">{sec.questions.filter((q) => isAnswered(answers[q.id])).length} of {sec.questions.length} answered</span></div></div>
        <div className="bar mb"><i style={{ width: (sec.questions.filter((q) => isAnswered(answers[q.id])).length / sec.questions.length) * 100 + '%' }} /></div>
        {sec.questions.map((q, n) => (
          <div className="q" key={q.id}>
            <div style={{ marginBottom: 12 }}><span className="eyebrow" style={{ color: 'var(--info)' }}>Question {qs.findIndex((x) => x.id === q.id) + 1}</span>{q.points > 0 && <span className="eyebrow" style={{ color: 'var(--warn)', marginLeft: 12 }}>{q.type === 'text' ? 'Up to ' : ''}{q.points} points</span>}</div>
            <div className="qt">{q.text}</div>{q.ask && <div className="qa">{q.ask}</div>}{!q.ask && <div style={{ height: 12 }} />}
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => change(q, v)} />
          </div>
        ))}
        <div className="row between center"><button className="btn" disabled={si === 0} onClick={() => setSi(si - 1)}>Previous section</button><button className="btn p" onClick={next}>{si === secs.length - 1 ? 'Review and submit' : `Next section: ${secs[si + 1].title}`}</button></div>
      </div>)}
      {review && (<div className="pan">
        <div className="card teal pad"><div className="eyebrow">Ready to submit</div><div className="h2" style={{ margin: '8px 0 14px' }}>{done} of {total} questions answered</div>
          {secs.map((s, i) => { const n = s.questions.filter((q) => isAnswered(answers[q.id])).length; return <div key={s.id} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}><span>{s.title}</span><span className={'chip ' + (n === s.questions.length ? 'ok' : 'warn')}>{n} of {s.questions.length}</span></div>; })}
          <p className="fg2" style={{ margin: '16px 0' }}>{item.autoSubmit ? 'If you forget, your saved answers are submitted for you when the quiz closes. Submitting yourself locks your answers now.' : 'Unsubmitted answers will not count. Submitting locks your answers.'} Closes {fmtDateTime(item.closes)}.</p>
          <div className="row"><button className="btn" onClick={() => setSi(secs.length - 1)}>Back to questions</button><button className="btn p cta" onClick={doSubmit}>Submit quiz</button></div>
        </div></div>)}
      <div className="card" style={{ marginTop: 20, borderStyle: 'dashed', color: 'var(--muted)' }}>Switching tabs is safe. Every answer is saved the moment you give it, and you can change answers until you submit.</div>
    </div>
  );
}
