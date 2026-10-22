import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { store } from './lib/store.js';
import { DEMO } from './config.js';
import { getRole, ensureUser, loadSettings, loadIndex, DEFAULT_SETTINGS } from './lib/ops.js';
import { friendly } from './components/ui.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const go = (p) => { location.hash = '#' + p; };
function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => { setH(location.hash || '#/'); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h.replace(/^#/, '') || '/';
}

export function Provider({ children }) {
  const [phase, setPhase] = useState('loading');
  const [user, setUser] = useState(null); const [role, setRole] = useState('participant');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS); const [index, setIndex] = useState({});
  const [stats, setStats] = useState({ history: {} }); const [prefs, setPrefs] = useState({});
  const [authError, setAuthError] = useState(''); const [now, setNow] = useState(Date.now());
  const [toastMsg, setToastMsg] = useState(null); const [dlg, setDlg] = useState(null);
  const path = useHash();

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  const loadAll = useCallback(async (u) => {
    const [r, s, idx, st, ud] = await Promise.all([getRole(u), loadSettings(), loadIndex(), store.get('stats/' + u.uid), store.get('users/' + u.uid)]);
    setRole(r); setSettings(s); setIndex(idx); setStats(st || { history: {} }); setPrefs((ud && ud.prefs) || {});
  }, []);
  useEffect(() => {
    let off = () => {}; let dead = false;
    (async () => {
      await store.ready; if (dead) return;
      off = store.auth.onChange(async (u, err) => {
        if (err) setAuthError(err);
        if (!u) { setUser(null); setPhase('signin'); return; }
        try { setUser(u); setAuthError(''); await ensureUser(u); await loadAll(u); setPhase('ready'); }
        catch (e) { setAuthError(friendly(e)); setPhase('error'); }
      });
    })();
    return () => { dead = true; off(); };
  }, [loadAll]);

  // Keep the quiz list fresh without polling: refresh when the page changes or the tab comes back after a while.
  const refreshIndex = useCallback(async () => { try { setIndex(await loadIndex()); } catch (e) { /* keep what we have */ } }, []);
  useEffect(() => { if (phase === 'ready') refreshIndex(); }, [path, phase, refreshIndex]);
  useEffect(() => {
    let last = Date.now();
    const f = () => { if (document.visibilityState === 'visible' && Date.now() - last > 5 * 60000) { last = Date.now(); refreshIndex(); } };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [refreshIndex]);
  const reload = useCallback(() => (user ? loadAll(user) : Promise.resolve()), [user, loadAll]);
  const savePrefs = useCallback(async (patch) => { const next = { ...prefs, ...patch }; setPrefs(next); await store.set('users/' + user.uid, { prefs: next }, true); }, [prefs, user]);
  const toast = useCallback((text, kind = 'ok') => { setToastMsg({ text, kind }); setTimeout(() => setToastMsg(null), 4200); }, []);
  const ask = useCallback((opts) => new Promise((res) => setDlg({ ...opts, res })), []);
  const signOut = useCallback(async () => { await store.auth.signOut(); setPhase('signin'); }, []);

  const value = useMemo(() => ({ phase, user, role, settings, index, stats, prefs, now, path, reload, savePrefs, toast, ask, signOut, authError, demo: DEMO, setIndex }), [phase, user, role, settings, index, stats, prefs, now, path, reload, savePrefs, toast, ask, signOut, authError]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className={'toast ' + toastMsg.kind} role="status">{toastMsg.text}</div>}
      {dlg && <Dialog dlg={dlg} close={(v) => { dlg.res(v); setDlg(null); }} />}
    </Ctx.Provider>
  );
}

function Dialog({ dlg, close }) {
  const [text, setText] = useState(dlg.input && dlg.input.initial ? dlg.input.initial : '');
  const [err, setErr] = useState('');
  const ok = () => { if (dlg.input && dlg.input.required && !text.trim()) { setErr('Enter a value first.'); return; } close(dlg.input ? text : true); };
  return (
    <div className="modal-bg" onClick={() => close(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={dlg.title} onClick={(e) => e.stopPropagation()}>
        <div className="h3" style={{ marginBottom: 8 }}>{dlg.title}</div>
        {dlg.body && <div className="fg2" style={{ marginBottom: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{dlg.body}</div>}
        {dlg.input && (
          <div className="field" style={{ marginBottom: 14 }}>
            {dlg.input.label && <label>{dlg.input.label}</label>}
            {dlg.input.multiline ? <textarea className="textarea" autoFocus value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} /> : <input className="input" autoFocus value={text} placeholder={dlg.input.placeholder || ''} onChange={(e) => { setText(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && ok()} />}
            {err && <div className="small" style={{ color: 'var(--danger)', marginTop: 6 }}>{err}</div>}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={() => close(null)}>Cancel</button>
          <button className={'btn sm ' + (dlg.danger ? 'danger' : 'p')} onClick={ok}>{dlg.ok || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
