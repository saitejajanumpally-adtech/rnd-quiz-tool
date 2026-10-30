import React, { useEffect, useRef, useState } from 'react';
import { Provider, useApp, go } from './ctx.jsx';
import { store } from './lib/store.js';
import { quizStatus } from './lib/quizModel.js';
import { isStaff, ROLE_LABEL } from './lib/ops.js';
import { CONFIG } from './config.js';
import { Spinner, Icon } from './components/ui.jsx';
import { getThemePref, setThemePref } from './lib/theme.js';
import Tour from './components/Tour.jsx';
import { Bolt, MascotPic } from './components/mascots.jsx';
import Arena from './pages/Arena.jsx';
import QuizPage from './pages/QuizPage.jsx';
import { Library, LibraryDetail } from './pages/Library.jsx';
import Leaderboard, { FullLeaderboard } from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import { ManageList, ManageQuiz } from './pages/Manage.jsx';
import Editor from './pages/Editor.jsx';
import { RolesPage, AdminSettings } from './pages/Admin.jsx';

// The R&D logo mark, shown in the header and on the sign-in screen. Square badge, scales with `size`.
function BrandMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="110" fill="#FFFFFF" />
      <svg x="28" y="166" width="456" height="160" viewBox="0 0 1200 420">
        <defs>
          <linearGradient id="brandMark" x1="0" y1="0" x2="1" y2=".35" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#5EEAD4" /><stop offset=".32" stopColor="#22D3EE" /><stop offset=".66" stopColor="#3B82F6" /><stop offset="1" stopColor="#885CF6" />
          </linearGradient>
          <linearGradient id="trendMark" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#885CF6" /></linearGradient>
        </defs>
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M105 310 V95 H235 C325 95 328 225 235 225 H105 M235 225 L328 310" fill="none" stroke="url(#brandMark)" strokeWidth="21" />
          <path d="M850 95 H972 C1110 95 1110 310 972 310 H850 Z" fill="none" stroke="url(#brandMark)" strokeWidth="21" />
          <path d="M382 206 C429 82 490 85 536 202 S636 325 681 202 S770 83 816 202" fill="none" stroke="url(#brandMark)" strokeWidth="14" />
          <path d="M382 295 C505 270 630 126 810 74" fill="none" stroke="url(#trendMark)" strokeWidth="11" />
          <path d="M150 176 L191 145 L232 179 L277 147 M150 176 L217 201 L277 147" fill="none" stroke="url(#trendMark)" strokeWidth="4" opacity=".8" />
          <g fill="#85E9F4"><circle cx="105" cy="95" r="13" /><circle cx="328" cy="310" r="13" /><circle cx="320" cy="177" r="12" /><circle cx="850" cy="95" r="13" /><circle cx="1065" cy="204" r="13" /><circle cx="150" cy="176" r="8" /><circle cx="191" cy="145" r="8" /><circle cx="232" cy="179" r="8" /><circle cx="277" cy="147" r="8" /><circle cx="217" cy="201" r="6" /></g>
          <path d="M906 272 L906 247 L934 247 L934 272 M945 272 L945 222 L973 222 L973 272 M984 272 L984 190 L1012 190 L1012 272" fill="#318AF3" opacity=".72" />
          <path d="M893 225 Q956 221 1017 150" fill="none" stroke="#85E9F4" strokeWidth="7" />
          <path d="M1000 150 L1021 143 L1019 166" fill="none" stroke="#85E9F4" strokeWidth="7" />
        </g>
      </svg>
    </svg>
  );
}

function SignIn() {
  const { authError, bye } = useApp(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const personas = store.kind === 'demo' ? (store.personas || null) : null;
  const [list, setList] = useState([]);
  useEffect(() => { store.ready.then((b) => b.personas && setList(b.personas)); }, []);
  const google = async () => { setBusy(true); setErr(''); try { await store.auth.signIn(); } catch (e) { setErr(e.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed. ' + (e.message || '')); } setBusy(false); };
  return (
    <div className="signin"><div className="card teal pad">
      {bye && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Bolt moment="goodbye" card={false} size={96} /></div>}
      {bye === 'removed' && <p className="fg2" style={{ margin: '0 0 14px' }}>Your profile was removed. Your quiz history is kept. Sign in again any time and it reconnects.</p>}
      <div className="mark" style={{ margin: '0 auto 16px', width: 48, height: 48 }}><BrandMark size={48} /></div>
      <div className="h2" style={{ marginBottom: 6 }}>{CONFIG.appName}</div>
      <p className="fg2" style={{ marginBottom: 22 }}>Sign in with your @{CONFIG.domain} account to take the quiz and see results.</p>
      {list.length > 0 ? (<>
        <div className="demo" style={{ borderRadius: 10, border: '1px solid color-mix(in srgb, var(--warn) 40%, transparent)', marginBottom: 6 }}>Demo mode with sample data. Pick a role to try.</div>
        {list.map((p) => <button key={p.uid} className="persona" onClick={() => store.auth.signIn(p.uid)}><b style={{ fontWeight: 500 }}>{p.name}</b><div className="small muted">{p.role[0].toUpperCase() + p.role.slice(1)} · {p.email}</div></button>)}
      </>) : <button className="btn p cta" disabled={busy} onClick={google}>{busy ? 'Opening Google…' : 'Sign in with Google'}</button>}
      {(authError || err) && <div role="alert" className="small" style={{ color: 'var(--danger)', marginTop: 16 }}>{authError || err}</div>}
    </div></div>
  );
}

function ThemeSwitch() {
  const [pref, setPref] = useState(getThemePref());
  const pick = (p) => { setThemePref(p); setPref(p); };
  return (
    <div style={{ padding: '10px 10px 4px' }}>
      <div className="small muted" style={{ marginBottom: 6 }}>Appearance</div>
      <div className="seg">
        <button type="button" className={pref === 'system' ? 'on' : ''} onClick={() => pick('system')}>System</button>
        <button type="button" className={pref === 'light' ? 'on' : ''} onClick={() => pick('light')}>Light</button>
        <button type="button" className={pref === 'dark' ? 'on' : ''} onClick={() => pick('dark')}>Dark</button>
      </div>
    </div>
  );
}
function NavLink({ to, children, dot, tour }) {
  const { path } = useApp(); const on = to === '/' ? path === '/' : path.startsWith(to);
  return <a href={'#' + to} data-tour={tour} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{children}{dot && <span className="dot" aria-label="New" />}</a>;
}
function Shell({ children }) {
  const { user, role, index, now, path, signOut, settings, demo, prefs, tourOpen, openTour } = useApp(); const [open, setOpen] = useState(false); const [navOpen, setNavOpen] = useState(false); const ref = useRef(null); const navRef = useRef(null); const tourAuto = useRef(false);
  useEffect(() => { if (!prefs.tourDone && !tourAuto.current) { tourAuto.current = true; openTour(); } }, [prefs.tourDone]); // eslint-disable-line
  const latest = Object.values(index).filter((i) => i.released).sort((a, b) => b.releasedAt - a.releasedAt)[0];
  const [seen, setSeen] = useState(() => localStorage.getItem('arena-seen-release') || '');
  useEffect(() => { if (latest && (path.startsWith('/library') || path.startsWith('/leaderboard'))) { localStorage.setItem('arena-seen-release', latest.id); setSeen(latest.id); } }, [path, latest && latest.id]); // eslint-disable-line
  useEffect(() => { const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  useEffect(() => { setOpen(false); setNavOpen(false); }, [path]);
  const fresh = latest && latest.id !== seen && now - latest.releasedAt < (settings.highlightDays || 5) * 86400000;
  return (
    <>
      {demo && <div className="demo">Demo mode: sample data, saved only in this browser. <button onClick={async () => { await store.reset(); location.reload(); }}>Reset demo data</button><button onClick={() => signOut()}>Switch role</button></div>}
      <div className="page">
        <header className="topbar">
          <a href="#/" className="brand"><span className="mark"><BrandMark /></span><span>{CONFIG.appName}</span></a>
          <div ref={navRef}>
            <button type="button" className="nav-toggle" aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} aria-controls="main-nav" onClick={() => setNavOpen(!navOpen)}><Icon name="menu" size={18} /></button>
            <nav id="main-nav" className={'nav' + (navOpen ? ' open' : '')} aria-label="Main">
              <NavLink to="/" tour="arena">Arena</NavLink><NavLink to="/library" dot={fresh} tour="library">Quiz library</NavLink><NavLink to="/leaderboard" dot={fresh} tour="leaderboard">Leaderboard</NavLink>
              {isStaff(role) && <NavLink to="/manage">Manage quizzes</NavLink>}
            </nav>
          </div>
          <div className="who" ref={ref}>
            <button className="avatar-btn" data-tour="menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><span className="avatar">{(user.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span><span className="fg2 avatar-label">Menu</span></button>
            {open && (
              <div className="menu" role="menu">
                <div className="head"><span className="avatar">{(user.name || '?')[0]}</span><div><div>{user.name}</div><div className="small muted">{ROLE_LABEL[role]} · {user.email}</div></div></div>
                <a role="menuitem" href="#/profile">Profile and progress</a>
                <ThemeSwitch />
                <button role="menuitem" onClick={() => { setOpen(false); openTour(); }}>Take the tour</button>
                {isStaff(role) && <a role="menuitem" href="#/roles">{role === 'admin' ? 'Roles (everyone)' : 'Roles (leads and participants)'}</a>}
                {role === 'admin' && <a role="menuitem" href="#/admin">Admin settings</a>}
                <button role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
      {tourOpen && <Tour />}
    </>
  );
}
const Denied = () => <div className="card mt"><div className="row center"><MascotPic moment="noAccess" size={96} /><div><div className="h3" style={{ marginBottom: 6 }}>You don't have access to this page</div><div className="fg2">Ask an admin if you need it. <a href="#/">Back to the Arena</a></div></div></div></div>;

function Router() {
  const { path, role, settings } = useApp(); const [, a, b, c] = path.split('/');
  const staff = isStaff(role);
  switch (a || '') {
    case '': return <Arena />;
    case 'quiz': return <QuizPage id={b} key={b} />;
    case 'library': return b ? <LibraryDetail id={b} key={b} /> : <Library />;
    case 'leaderboard': return c === 'full' ? <FullLeaderboard id={b} key={b} /> : <Leaderboard id={b} key={b} />;
    case 'profile': return <Profile />;
    case 'manage': return staff ? (b ? <ManageQuiz id={b} key={b} /> : <ManageList />) : <Denied />;
    case 'edit': return staff ? <Editor id={b} key={b} /> : <Denied />;
    case 'roles': return staff ? <RolesPage /> : <Denied />;
    case 'admin': return role === 'admin' ? <AdminSettings /> : <Denied />;
    default: return <Denied />;
  }
}
function Main() {
  const { phase, authError } = useApp();
  if (phase === 'loading') return <Spinner />;
  if (phase === 'signin') return <SignIn />;
  if (phase === 'error') return <div className="signin"><div className="card warn"><div className="h3" style={{ marginBottom: 8 }}>Couldn't load the Arena</div><div className="fg2" style={{ marginBottom: 16 }}>{authError}</div><button className="btn p" onClick={() => location.reload()}>Try again</button></div></div>;
  return <Shell><Router /></Shell>;
}
export default function App() { return <Provider><Main /></Provider>; }
