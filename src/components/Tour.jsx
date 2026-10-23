import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { Mascot } from './mascots.jsx';

// Six steps, each led by a different mascot. Steps with a target point at that part of the page.
const STEPS = [
  { id: 'robot', pose: 'wave', title: 'Welcome to R&D Quiz Arena', text: 'Take a one-minute tour of how it works, led by six guides.' },
  { id: 'owl', pose: 'ready', target: 'arena', title: 'Taking a quiz', text: 'Open a live round from the Arena. Answers save as you go, required questions come first, and submitting locks them.' },
  { id: 'fox', pose: 'celebrate', target: 'leaderboard', title: 'The leaderboard', text: 'Everyone sees the Top 10. Your own row, and how many places you moved since last round, are always shown.' },
  { id: 'octo', pose: 'thinking', target: 'library', title: 'Answer key', text: 'Past quizzes and their answers live in the Quiz library, whether you took them or not.' },
  { id: 'cat', pose: 'check', target: 'menu', title: 'Streaks and levels', text: 'Points move you down the ad request funnel. Find your progress under Menu, then Profile and progress.' },
  { id: 'panda', pose: 'wave', title: 'That’s the tour', text: 'Pick your favourite mascots in Profile. To see this tour again, open Menu and choose Take the tour.' }
];
const NAMES = { robot: 'Bolt', owl: 'Hoot', fox: 'Pip', octo: 'Octo', cat: 'Meow', panda: 'Bao' };

export default function Tour() {
  const { closeTour, savePrefs } = useApp(); const [i, setI] = useState(0); const [rect, setRect] = useState(null); const btn = useRef(null);
  const step = STEPS[i]; const last = i === STEPS.length - 1;
  const measure = () => { if (!step.target) { setRect(null); return; } const el = document.querySelector(`[data-tour="${step.target}"]`); if (!el) { setRect(null); return; } const r = el.getBoundingClientRect(); setRect({ left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }); };
  useLayoutEffect(() => { measure(); }, [i]); // eslint-disable-line
  useEffect(() => { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [i]); // eslint-disable-line
  useEffect(() => { if (btn.current) btn.current.focus(); }, [i]);
  const finish = async () => { try { await savePrefs({ tourDone: true }); } catch (e) { /* the tour can still close */ } closeTour(); };
  useEffect(() => { const f = (e) => { if (e.key === 'Escape') finish(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []); // eslint-disable-line
  const placed = rect && step.target;
  const cardStyle = placed ? { top: Math.min(rect.top + rect.height + 14, window.innerHeight - 280), left: Math.max(12, Math.min(rect.left + rect.width / 2 - 170, window.innerWidth - 352)) } : null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Welcome tour, step ${i + 1} of ${STEPS.length}`}>
      {placed ? <div className="tour-hl" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} /> : <div className="tour-bg" />}
      <div className="tour-dim" onClick={() => {}} />
      <div className={'tour-card' + (placed ? '' : ' center')} style={cardStyle || undefined}>
        {placed ? <div className="row center" style={{ flexWrap: 'nowrap', gap: 12 }}><Mascot id={step.id} pose={step.pose} size={88} /><div style={{ textAlign: 'left', minWidth: 0 }}><div className="lab" style={{ color: 'var(--accent)' }}>{NAMES[step.id]}</div><div style={{ fontSize: 17, fontWeight: 500, marginTop: 2 }}>{step.title}</div></div></div>
          : <><div style={{ display: 'flex', justifyContent: 'center' }}><Mascot id={step.id} pose={step.pose} size={i === 0 ? 170 : 150} /></div>{i > 0 && <div className="lab" style={{ color: 'var(--accent)', marginTop: 4 }}>{NAMES[step.id]} · Step {i + 1} of {STEPS.length}</div>}<div style={{ fontSize: 22, fontWeight: 500, margin: '6px 0 0', letterSpacing: '-.01em' }}>{step.title}</div></>}
        <p className="fg2" style={{ margin: '10px 0 14px', lineHeight: 1.5, textAlign: placed ? 'left' : 'center' }}>{step.text}</p>
        {i > 0 && <div className="dots mb" aria-hidden="true">{STEPS.map((s, k) => <i key={s.id} className={k === i ? 'on' : ''} />)}</div>}
        {i === 0 && <div className="row" style={{ justifyContent: 'center' }}><button ref={btn} className="btn p" onClick={() => setI(1)}>Start the tour</button><button className="btn" onClick={finish}>Skip for now</button></div>}
        {i > 0 && !last && <div className="row between center"><button className="link" onClick={finish} style={{ background: 'none', border: 0, color: 'var(--muted)' }}>Skip tour</button><span className="row"><button className="btn sm" onClick={() => setI(i - 1)}>Back</button><button ref={btn} className="btn sm p" onClick={() => setI(i + 1)}>Next</button></span></div>}
        {last && <div className="row" style={{ justifyContent: 'center' }}><button ref={btn} className="btn p" onClick={finish}>Finish</button><button className="btn" onClick={() => setI(0)}>Replay from the start</button></div>}
        {i === 0 && <p className="muted small" style={{ margin: '12px 0 0' }}>You can replay it any time from Menu.</p>}
      </div>
    </div>
  );
}
