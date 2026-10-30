import React from 'react';
import { Rich } from './Rich.jsx';
import { stripRich } from '../lib/richtext.js';
const KEYS = 'ABCDEFGH';
export const wordCount = (s) => (String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0);

// One question as the participant sees it while answering.
export function QuestionInput({ q, value, onChange, disabled }) {
  const set = (v) => !disabled && onChange(v);
  switch (q.type) {
    case 'mcq': case 'picture':
      return <div>{q.type === 'picture' && q.image && <img src={q.image} alt="Question picture" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, marginBottom: 14, border: '1px solid var(--border2)' }} />}
        {q.options.map((o, i) => <button key={i} className={'opt' + (value === i ? ' sel' : '')} aria-pressed={value === i} disabled={disabled} onClick={() => set(value === i ? undefined : i)}><b>{KEYS[i]}</b><span className="t"><Rich text={o} inline /></span></button>)}</div>;
    case 'tf':
      return <div className="row">{[[true, 'True'], [false, 'False']].map(([v, l]) => <button key={l} className={'opt' + (value === v ? ' sel' : '')} style={{ flex: '1 1 160px', justifyContent: 'center' }} aria-pressed={value === v} disabled={disabled} onClick={() => set(value === v ? undefined : v)}>{l}</button>)}</div>;
    case 'multi': {
      const sel = Array.isArray(value) ? value : [];
      return <div><div className="small muted" style={{ marginBottom: 8 }}>Select all that apply.</div>{q.options.map((o, i) => { const on = sel.includes(i); return <button key={i} className={'opt' + (on ? ' sel' : '')} aria-pressed={on} disabled={disabled} onClick={() => set(on ? sel.filter((x) => x !== i) : [...sel, i].sort((a, b) => a - b))}><b>{on ? '✓' : KEYS[i]}</b><span className="t"><Rich text={o} inline /></span></button>; })}</div>;
    }
    case 'order': {
      const order = Array.isArray(value) ? value : q.options.map((_, i) => i);
      const move = (pos, d) => { const n = [...order]; const t = pos + d; if (t < 0 || t >= n.length) return; [n[pos], n[t]] = [n[t], n[pos]]; set(n); };
      return <div><div className="small muted" style={{ marginBottom: 8 }}>Use the arrows to put the items in the right order, first at the top.{!Array.isArray(value) && ' Move at least one item to record an answer.'}</div>
        {order.map((idx, pos) => <div key={idx} className={'opt' + (Array.isArray(value) ? ' sel' : '')}><b>{pos + 1}</b><span className="t"><Rich text={q.options[idx]} inline /></span><button className="btn sm" aria-label={`Move ${stripRich(q.options[idx])} up`} disabled={disabled || pos === 0} onClick={() => move(pos, -1)}>↑</button><button className="btn sm" aria-label={`Move ${stripRich(q.options[idx])} down`} disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)}>↓</button></div>)}</div>;
    }
    case 'match': {
      const v = value && typeof value === 'object' ? value : {};
      return <div className="pairs"><div className="small muted">Match each item on the left with the right option.</div>{q.left.map((l, i) => <div className="p" key={i}><span><Rich text={l} inline /></span><select className="select" style={{ flex: '1 1 220px' }} aria-label={`Match for ${stripRich(l)}`} disabled={disabled} value={v[String(i)] === undefined ? '' : v[String(i)]} onChange={(e) => { const n = { ...v }; if (e.target.value === '') delete n[String(i)]; else n[String(i)] = Number(e.target.value); set(n); }}><option value="">Choose…</option>{q.right.map((r, j) => <option key={j} value={j}>{stripRich(r)}</option>)}</select></div>)}</div>;
    }
    case 'rating': {
      const lo = q.scale.min, hi = q.scale.max; const nums = []; for (let n = lo; n <= hi; n++) nums.push(n);
      return <div><div className="rate">{nums.map((n) => <button key={n} className={value === n ? 'sel' : ''} aria-pressed={value === n} disabled={disabled} onClick={() => set(value === n ? undefined : n)}>{n}</button>)}</div><div className="row between small muted" style={{ marginTop: 6 }}><span>{q.scale.minLabel}</span><span>{q.scale.maxLabel}</span></div></div>;
    }
    case 'text':
      return <div><textarea className="textarea" disabled={disabled} aria-label="Your answer" placeholder="Type your answer here" value={value || ''} onChange={(e) => set(e.target.value)} /><div className="small muted" style={{ marginTop: 6 }}>{wordCount(value)} words · a few clear sentences is enough</div></div>;
    default: return null;
  }
}

// Read-only view of a question with the correct answer marked and, optionally, the person's own answer.
export function QuestionKey({ q, k, mine, showMine }) {
  const tagFor = (isRight, isMine) => (showMine && isMine && isRight ? 'YOUR ANSWER · CORRECT' : showMine && isMine ? 'YOUR ANSWER' : isRight ? 'CORRECT ANSWER' : '');
  const clsFor = (isRight, isMine) => 'opt ' + (showMine && isMine && !isRight ? 'wrong' : isRight ? 'right' : (showMine && isMine ? 'sel' : ''));
  const row = (i, text, isRight, isMine) => <div key={i} className={clsFor(isRight, isMine)}><b>{KEYS[i]}</b><span className="t"><Rich text={text} inline /></span><i>{tagFor(isRight, isMine)}</i></div>;
  if (!k) return null;
  switch (q.type) {
    case 'mcq': case 'picture': return <>{q.type === 'picture' && q.image && <img src={q.image} alt="Question picture" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 12, marginBottom: 12 }} />}{q.options.map((o, i) => row(i, o, i === k.correct, mine === i))}</>;
    case 'multi': { const m = Array.isArray(mine) ? mine : []; return q.options.map((o, i) => row(i, o, (k.correct || []).includes(i), m.includes(i))); }
    case 'tf': return <>{[[true, 'True'], [false, 'False']].map(([v, l], i) => <div key={l} className={clsFor(v === k.correct, mine === v)}><span className="t">{l}</span><i>{tagFor(v === k.correct, mine === v)}</i></div>)}</>;
    case 'order': { const mineOrder = Array.isArray(mine) ? mine : null; return <><div className="lab" style={{ margin: '4px 0 8px' }}>Correct order</div>{(k.correct || []).map((pub, pos) => <div key={pos} className="opt right"><b>{pos + 1}</b><span className="t"><Rich text={q.options[pub]} inline /></span></div>)}{showMine && <><div className="lab" style={{ margin: '12px 0 8px' }}>Your order</div>{mineOrder ? mineOrder.map((pub, pos) => <div key={pos} className={'opt ' + (pub === (k.correct || [])[pos] ? 'right' : 'wrong')}><b>{pos + 1}</b><span className="t"><Rich text={q.options[pub]} inline /></span></div>) : <div className="box2">No answer recorded.</div>}</>}</>; }
    case 'match': { const m = mine && typeof mine === 'object' ? mine : {}; return <div className="pairs">{q.left.map((l, i) => { const right = (k.correct || {})[String(i)]; const got = m[String(i)]; const ok = got === right; return <div className="p" key={i}><span><Rich text={l} inline /></span><span className={showMine && got !== undefined ? (ok ? 'opt right' : 'opt wrong') : 'opt right'} style={{ margin: 0 }}><span className="t"><Rich text={q.right[right]} inline /></span>{showMine && got !== undefined && !ok && <i>YOU CHOSE {stripRich(q.right[got])}</i>}</span></div>; })}</div>; }
    case 'rating': return <div className="box2">{showMine && mine !== undefined ? `You chose ${mine} on a scale of ${q.scale.min} to ${q.scale.max}.` : 'This question was a poll and is not scored.'}</div>;
    case 'text': return <><div className="lab" style={{ marginBottom: 4 }}>What a strong answer covers</div>{k.strong ? <div className="box2" style={{ borderColor: 'color-mix(in srgb, var(--success) 50%, transparent)' }}><Rich text={k.strong} /></div> : <div className="box2" style={{ color: 'var(--muted)' }}>No model answer was added for this question.</div>}</>;
    default: return null;
  }
}
