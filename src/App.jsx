import React, { useEffect, useRef, useState } from 'react';
import { Provider, useApp, go } from './ctx.jsx';
import { store } from './lib/store.js';
import { quizStatus } from './lib/quizModel.js';
import { isStaff, ROLE_LABEL } from './lib/ops.js';
import { CONFIG } from './config.js';
import { Spinner } from './components/ui.jsx';
import Arena from './pages/Arena.jsx';
import QuizPage from './pages/QuizPage.jsx';
import { Library, LibraryDetail } from './pages/Library.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import { ManageList, ManageQuiz } from './pages/Manage.jsx';
import Editor from './pages/Editor.jsx';
import { RolesPage, AdminSettings } from './pages/Admin.jsx';

function SignIn() {
  const { authError } = useApp(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const personas = store.kind === 'demo' ? (store.personas || null) : null;
  const [list, setList] = useState([]);
  useEffect(() => { store.ready.then((b) => b.personas && setList(b.personas)); }, []);
  const google = async () => { setBusy(true); setErr(''); try { await store.auth.signIn(); } catch (e) { setErr(e.code === 'auth/popup-closed-by-user' ? '' : 'Sign-in failed. ' + (e.message || '')); } setBusy(false); };
  return (
    <div className="signin"><div className="card teal pad">
      <div className="mark" style={{ margin: '0 auto 16px', width: 48, height: 48, fontSize: 20 }}>M</div>
      <div className="h2" style={{ marginBottom: 6 }}>{CONFIG.appName}</div>
      <p className="fg2" style={{ marginBottom: 22 }}>Sign in with your @{CONFIG.domain} account to take the quiz and see results.</p>
      {list.length > 0 ? (<>
        <div className="demo" style={{ borderRadius: 10, border: '1px solid rgba(224,160,75,.4)', marginBottom: 6 }}>Demo mode with sample data. Pick a role to try.</div>
        {list.map((p) => <button key={p.uid} className="persona" onClick={() => store.auth.signIn(p.uid)}><b style={{ fontWeight: 500 }}>{p.name}</b><div className="small muted">{p.email}</div></button>)}
      </>) : <button className="btn p cta" disabled={busy} onClick={google}>{busy ? 'Opening Google…' : 'Sign in with Google'}</button>}
      {(authError || err) && <div role="alert" className="small" style={{ color: 'var(--danger)', marginTop: 16 }}>{authError || err}</div>}
    </div></div>
  );
}

function NavLink({ to, children, dot }) {
  const { path } = useApp(); const on = to === '/' ? path === '/' : path.startsWith(to);
  return <a href={'#' + to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{children}{dot && <span className="dot" aria-label="New" />}</a>;
}
function Shell({ children }) {
  const { user, role, index, now, path, signOut, settings, demo } = useApp(); const [open, setOpen] = useState(false); const ref = useRef(null);
  const latest = Object.values(index).filter((i) => i.released).sort((a, b) => b.releasedAt - a.releasedAt)[0];
  const [seen, setSeen] = useState(() => localStorage.getItem('arena-seen-release') || '');
  useEffect(() => { if (latest && (path.startsWith('/library') || path.startsWith('/leaderboard'))) { localStorage.setItem('arena-seen-release', latest.id); setSeen(latest.id); } }, [path, latest && latest.id]); // eslint-disable-line
  useEffect(() => { const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  useEffect(() => setOpen(false), [path]);
  const fresh = latest && latest.id !== seen && now - latest.releasedAt < (settings.highlightDays || 5) * 86400000;
  return (
    <>
      {demo && <div className="demo">Demo mode: sample data, saved only in this browser. <button onClick={async () => { await store.reset(); location.reload(); }}>Reset demo data</button><button onClick={() => signOut()}>Switch role</button></div>}
      <div className="page">
        <header className="topbar">
          <a href="#/" className="brand"><span className="mark">M</span>{CONFIG.appName}</a>
          <nav className="nav" aria-label="Main">
            <NavLink to="/">Arena</NavLink><NavLink to="/library" dot={fresh}>Quiz library</NavLink><NavLink to="/leaderboard" dot={fresh}>Leaderboard</NavLink>
            {isStaff(role) && <NavLink to="/manage">Manage quizzes</NavLink>}
          </nav>
          <div className="who" ref={ref}>
            <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><span className="avatar">{(user.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span><span className="fg2">Menu</span></button>
            {open && (
              <div className="menu" role="menu">
                <div className="head"><span className="avatar">{(user.name || '?')[0]}</span><div><div>{user.name}</div><div className="small muted">{ROLE_LABEL[role]} · {user.email}</div></div></div>
                <a role="menuitem" href="#/profile">Profile and progress</a>
                {isStaff(role) && <a role="menuitem" href="#/roles">{role === 'admin' ? 'Roles (everyone)' : 'Roles (leads and participants)'}</a>}
                {role === 'admin' && <a role="menuitem" href="#/admin">Admin settings</a>}
                <button role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
    </>
  );
}
const Denied = () => <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>You don't have access to this page</div><div className="fg2">Ask an admin if you need it. <a href="#/">Back to the Arena</a></div></div>;

function Router() {
  const { path, role } = useApp(); const [, a, b] = path.split('/');
  const staff = isStaff(role);
  switch (a || '') {
    case '': return <Arena />;
    case 'quiz': return <QuizPage id={b} key={b} />;
    case 'library': return b ? <LibraryDetail id={b} key={b} /> : <Library />;
    case 'leaderboard': return <Leaderboard id={b} key={b} />;
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
