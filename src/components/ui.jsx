import React, { useState, useEffect } from 'react';
import { parts, pad2 } from '../lib/time.js';
import { STAGES, stageFor } from '../lib/stages.js';

export const Spinner = () => <div className="spin" role="status" aria-label="Loading" />;
export function Countdown({ to, now }) {
  const p = parts(to - now);
  const B = ({ v, l }) => <div className="box"><b>{pad2(v)}</b><span>{l}</span></div>;
  return <div className="boxes" role="timer" aria-label="Countdown"><B v={p.d} l="DAYS" /><span className="colon">:</span><B v={p.h} l="HRS" /><span className="colon">:</span><B v={p.m} l="MIN" /></div>;
}
export const Chip = ({ tone = '', children }) => <span className={'chip ' + tone}>{children}</span>;
export const Switch = ({ on, onChange, title, sub }) => (
  <button className="switch" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
    <span className="t"><b>{title}</b>{sub && <span>{sub}</span>}</span><span className={'track' + (on ? ' on' : '')} />
  </button>
);
export function Seg({ value, options, onChange }) {
  return <div className="seg" role="group">{options.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Tile({ label, value, unit }) {
  return <div className="tile"><div className="lab">{label}</div><div className="v">{value}{unit && <small> {unit}</small>}</div></div>;
}
export function Funnel({ points, thresholds, compact }) {
  const st = stageFor(points, thresholds); const sw = 104, gap = 8, cy = 70; const hs = [50, 44, 38, 32, 26, 20];
  return (
    <div className="card">
      <div className="row between center" style={{ marginBottom: 6 }}><span className="lab">Your progress</span><span style={{ fontSize: 13, color: 'var(--warn)' }}>Stage: {st.name}</span></div>
      <svg className="funnel" width="100%" viewBox="0 0 552 130" role="img" aria-label={`Ad request funnel. You are at ${st.name}.`}>
        {STAGES.map((n, i) => {
          const x = i * (sw + gap); const done = i < st.index; const cur = i === st.index;
          return <g key={n}><polygon className={cur ? 'slot' : ''} points={`${x},${cy - hs[i]} ${x + sw},${cy - hs[i + 1]} ${x + sw},${cy + hs[i + 1]} ${x},${cy + hs[i]}`} fill={done ? '#2DA9A2' : cur ? '#E0A04B' : '#1F3845'} /><text x={x + sw / 2} y={cy + 4} textAnchor="middle" fontSize="11" fill={done || cur ? '#07221F' : '#8A9CA5'}>{n}</text></g>;
        })}
        <text x={st.index * (sw + gap) + sw / 2} y="14" textAnchor="middle" fontSize="10" letterSpacing="2" fill="#E0A04B">YOU ARE HERE</text>
        <polygon points={`${st.index * (sw + gap) + sw / 2 - 5},22 ${st.index * (sw + gap) + sw / 2 + 5},22 ${st.index * (sw + gap) + sw / 2},30`} fill="#E0A04B" />
      </svg>
      <div className="bar warn" style={{ marginTop: 6 }}><i style={{ width: Math.round(st.pct * 100) + '%' }} /></div>
      <div className="fg2 small" style={{ marginTop: 8, lineHeight: 1.5 }}>{st.nextName ? `${st.toNext % 1 ? st.toNext.toFixed(1) : st.toNext} points to ${st.nextName}. Every round moves you further down the ad request funnel.` : 'You reached the end of the funnel. Conversion.'}</div>
    </div>
  );
}
export function Saved({ state }) {
  if (state === 'saving') return <span className="saved busy">Saving…</span>;
  if (state === 'error') return <span className="saved err" role="alert">Couldn't save. Retrying, keep this tab open.</span>;
  if (state === 'saved') return <span className="saved ok"><span className="live-dot" />Saved just now</span>;
  return <span className="saved busy">Answers save as you go</span>;
}
export function useDebounced(fn, ms) {
  const ref = React.useRef({ t: null, fn }); ref.current.fn = fn;
  return React.useCallback((...a) => { clearTimeout(ref.current.t); ref.current.t = setTimeout(() => ref.current.fn(...a), ms); }, [ms]);
}
export function useAsync(fn, deps) {
  const [s, setS] = useState({ loading: true, data: null, error: null });
  const [n, setN] = useState(0);
  useEffect(() => { let on = true; setS((x) => ({ ...x, loading: true, error: null })); Promise.resolve().then(fn).then((d) => on && setS({ loading: false, data: d, error: null }), (e) => on && setS({ loading: false, data: null, error: e })); return () => { on = false; }; }, [...deps, n]); // eslint-disable-line
  return { ...s, reload: () => setN((x) => x + 1) };
}
export const ErrorBox = ({ error }) => <div className="card warn" role="alert"><div className="h3" style={{ marginBottom: 6 }}>Something went wrong</div><div className="fg2">{friendly(error)}</div></div>;
export function friendly(e) {
  const m = String((e && (e.code || e.message)) || e || '');
  if (/permission-denied|insufficient/i.test(m)) return 'The database refused this action. Your role may not allow it, or the quiz has closed. If this is unexpected, an admin should check the security rules.';
  if (/unavailable|network|offline/i.test(m)) return 'Can\'t reach the database. Check your connection and try again.';
  return m || 'Unknown error.';
}
