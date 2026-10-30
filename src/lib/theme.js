// Theme preference: 'dark' | 'light' | 'system'. Stored once and applied before React mounts so there's
// no flash of the wrong theme on load.
const KEY = 'arena-theme';

export function getThemePref() {
  const v = localStorage.getItem(KEY);
  return v === 'dark' || v === 'light' ? v : 'system';
}

// 'system' means: don't set data-theme at all, so the :root defaults (dark) and the
// prefers-color-scheme:light override in styles.css decide, and the page follows the OS live.
export function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'dark' || pref === 'light') root.setAttribute('data-theme', pref);
  else root.removeAttribute('data-theme');
}

export function setThemePref(pref) {
  if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

applyTheme(getThemePref());
