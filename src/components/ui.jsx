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
    <span className="t"><b>{title}</b>{sub && <span>{sub}</span>}</span><span className="onoff">{on ? 'On' : 'Off'}</span><span className={'track' + (on ? ' on' : '')} aria-hidden="true" />
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
// Shared with the pre-submit warning banner, so the status line and the banner never disagree.
export const SAVE_COPY = {
  saving: 'Saving your answers…',
  saved: 'All answers saved.',
  offline: 'Connection lost. Your latest answers may not be saved. Please check your internet connection.',
  error: 'Unable to save your answers. Retrying…',
  blocked: "Your last answer couldn't be saved because this quiz is no longer open to changes. Reload the page before continuing.",
  idle: 'Answers save as you go'
};
export function Saved({ state }) {
  if (state === 'saving') return <span className="saved busy">{SAVE_COPY.saving}</span>;
  if (state === 'offline') return <span className="saved err" role="alert">{SAVE_COPY.offline}</span>;
  if (state === 'error') return <span className="saved err" role="alert">{SAVE_COPY.error}</span>;
  if (state === 'blocked') return <span className="saved err" role="alert">{SAVE_COPY.blocked}</span>;
  if (state === 'saved') return <span className="saved ok"><span className="live-dot" />{SAVE_COPY.saved}</span>;
  return <span className="saved busy">{SAVE_COPY.idle}</span>;
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

// ---- shared visuals for the new screens
const Svg = ({ children, size = 18, color = 'currentColor', sw = 2 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{children}</svg>;
export const Icon = ({ name, size, color }) => ({
  check: <Svg size={size} color={color}><path d="M5 12.5 10 17.5 19 7" /></Svg>,
  lock: <Svg size={size} color={color}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>,
  coin: <Svg size={size} color={color}><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></Svg>,
  flame: <Svg size={size} color={color}><path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.5 1 2 2 2-.5-3 0-6 1-8z" /></Svg>,
  target: <Svg size={size} color={color}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Svg>,
  clock: <Svg size={size} color={color}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  cal: <Svg size={size} color={color}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>,
  search: <Svg size={size} color={color}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Svg>,
  chev: <Svg size={size} color={color}><path d="M6 9l6 6 6-6" /></Svg>,
  link: <Svg size={size} color={color}><path d="M10 14a3.5 3.5 0 0 0 4.2.6l2.1-2.1a3.5 3.5 0 0 0-4.9-4.9l-1 1" /><path d="M14 10a3.5 3.5 0 0 0-4.2-.6L7.7 10.5a3.5 3.5 0 0 0 4.9 4.9l1-1" /></Svg>,
  trash: <Svg size={size} color={color}><path d="M5 7h14" /><path d="M10 11v6M14 11v6" /><path d="M6.5 7 7.3 20a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" /><path d="M9.5 7V4.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 1 1V7" /></Svg>,
  copy: <Svg size={size} color={color}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>,
  menu: <Svg size={size} color={color}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>,
  sun: <Svg size={size} color={color}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Svg>,
  moon: <Svg size={size} color={color}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>,
  monitor: <Svg size={size} color={color}><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8.5 20h7M12 16.5V20" /></Svg>,
  more: <Svg size={size} color={color}><circle cx="5" cy="12" r="1.4" fill={color} stroke="none" /><circle cx="12" cy="12" r="1.4" fill={color} stroke="none" /><circle cx="19" cy="12" r="1.4" fill={color} stroke="none" /></Svg>
}[name]);
export const IconCircle = ({ children, size = 44, bg = 'var(--bg1)', bd = 'var(--border2)' }) => <span style={{ width: size, height: size, borderRadius: '50%', background: bg, border: '1px solid ' + bd, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{children}</span>;
// A scorecard: icon on top, label and value centered.
export function Score({ icon, color, label, value, unit }) {
  return <div className="tile score">{icon && <IconCircle>{<Icon name={icon} size={22} color={color} />}</IconCircle>}<div className="lab">{label}</div><div className="v">{value}{unit && <small> {unit}</small>}</div></div>;
}
// Movement against the previous round. Nothing shows when there is no earlier round to compare with.
export function MoveChip({ move, hasPrev }) {
  if (move === null || move === undefined) return hasPrev ? <span className="chip info">New</span> : null;
  if (move > 0) return <span className="chip ok mv" aria-label={`Up ${move} places`}>↑ {move}</span>;
  if (move < 0) return <span className="chip warn mv" aria-label={`Down ${-move} places`}>↓ {-move}</span>;
  return <span className="chip mv" aria-label="Same place">–</span>;
}
export function Ring({ value, max, size = 130 }) {
  const r = 52; const c = 2 * Math.PI * r; const f = max ? Math.max(0, Math.min(1, value / max)) : 0;
  return <svg width={size} height={size} viewBox="0 0 130 130" role="img" aria-label={`Score ${value} out of ${max}`} style={{ flex: 'none' }}><circle cx="65" cy="65" r={r} fill="none" stroke="var(--bg)" strokeWidth="11" /><circle cx="65" cy="65" r={r} fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 65 65)" /><text x="65" y="70" textAnchor="middle" fontFamily="var(--mono)" fontSize="38" fontWeight="500" fill="var(--fg)">{value}</text><text x="65" y="92" textAnchor="middle" fontFamily="var(--mono)" fontSize="13" fill="var(--muted)">/ {max}</text></svg>;
}
// The funnel as stage cards, with a milestone bar. Wide enough that every stage name stays readable.
export function Journey({ points, thresholds }) {
  const st = stageFor(points, thresholds); const next = st.nextName ? thresholds[st.index + 1] : null;
  const pts = Math.round(points * 2) / 2; const toNext = st.nextName ? (Math.round((next - points) * 2) / 2) : 0;
  return (
    <div className="card" style={{ padding: 26 }}>
      <div className="row between center" style={{ marginBottom: 6 }}><div><div className="h3">Your learning journey</div><div className="fg2" style={{ marginTop: 2 }}>Every round moves you through the ad request funnel.</div></div><div className="row center" style={{ gap: 14 }}><span className="chip warn">Current stage: {st.name}</span><span className="fg2">{pts} total points</span></div></div>
      <div className="stages">
        {STAGES.map((n, i) => {
          const done = i < st.index; const cur = i === st.index;
          return <React.Fragment key={n}>
            {i > 0 && <span className="stage-link" aria-hidden="true" />}
            <div className="stage-wrap">
              <div className="stage-mark" aria-hidden={!cur}>{cur && <><span className="lab" style={{ color: 'var(--warn)', letterSpacing: '.18em' }}>You are here</span><svg width="14" height="9" viewBox="0 0 14 9" aria-hidden="true"><path d="M0 0H14L7 9Z" fill="var(--warn)" /></svg></>}</div>
              <div className={'stage' + (done ? ' done' : cur ? ' cur' : '')} aria-current={cur ? 'step' : undefined}>
                <IconCircle size={38} bg={done ? 'var(--accent)' : cur ? 'color-mix(in srgb, var(--warn) 16%, transparent)' : 'var(--bg3)'} bd={done ? 'var(--accent)' : cur ? 'var(--warn)' : 'var(--border)'}>{done ? <Icon name="check" size={18} color="#07221F" /> : cur ? <Icon name="coin" size={18} color="var(--warn)" /> : <Icon name="lock" size={17} color="var(--muted)" />}</IconCircle>
                <div><div style={{ fontWeight: 600, fontSize: 16 }}>{n}</div><div className="small" style={{ color: done ? 'var(--accent)' : cur ? 'var(--warn)' : 'var(--fg2)' }}>{thresholds[i]} pts</div></div>
              </div>
            </div>
          </React.Fragment>;
        })}
      </div>
      <div className="milestone">
        {st.nextName ? <><span style={{ fontWeight: 500 }}>Next milestone: {st.nextName}</span><div className="bar" style={{ flex: '1 1 160px' }}><i style={{ width: Math.round(Math.min(1, points / next) * 100) + '%', background: 'var(--accent)' }} /></div><span className="mono">{pts} / {next} pts</span><span className="fg2">{toNext} more points to reach {st.nextName}</span></> : <span className="fg2">You reached the end of the funnel. Conversion.</span>}
      </div>
    </div>
  );
}
// Gentle confetti for the finish moment. Purely decorative, and still when the person prefers reduced motion.
export function Confetti({ w = 1000, h = 480, n = 36, seed = 7, keep }) {
  let a = seed; const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cols = ['#5FC9C0', '#E0A04B', '#6FB7E0', '#E2745A', '#E8EBEC', '#2DA9A2']; const out = [];
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * (w - 16)); const y = Math.floor(r() * (h - 20));
    if (keep && x > keep[0] && x < keep[1] && y > keep[2] && y < keep[3]) continue;
    out.push(<span key={i} className="conf" style={{ left: x, top: y, width: [6, 8, 10][Math.floor(r() * 3)], height: [12, 14, 16][Math.floor(r() * 3)], background: cols[Math.floor(r() * cols.length)], opacity: [0.55, 0.7, 0.85][Math.floor(r() * 3)], transform: `rotate(${Math.floor(r() * 180)}deg)`, animationDelay: (i % 7) * 0.12 + 's' }} />);
  }
  return <div aria-hidden="true" className="confetti">{out}</div>;
}
