// DEMO backend: the same interface as Firebase, kept in the browser's local storage.
import { buildDemo } from './demoData.js';
import { PERSONAS } from './demoData.js';

const KEY = 'arena-demo-v3'; const WHO = 'arena-demo-persona';
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function setDeep(obj, dotted, value) {
  const parts = dotted.split('.'); let o = obj;
  parts.slice(0, -1).forEach((p) => { if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}; o = o[p]; });
  o[parts[parts.length - 1]] = value;
}
function mergeDeep(a, b) {
  const out = { ...a };
  Object.entries(b).forEach(([k, v]) => { out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? mergeDeep(out[k], v) : clone(v); });
  return out;
}

export function createMemory() {
  let data; const listeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full: keep working in memory */ } };
  const load = () => { try { const s = localStorage.getItem(KEY); data = s ? JSON.parse(s) : null; } catch (e) { data = null; } if (!data) { data = buildDemo(Date.now()); save(); } };
  load();
  const current = () => { const id = localStorage.getItem(WHO); const p = PERSONAS.find((x) => x.uid === id); return p ? { uid: p.uid, email: p.email, name: p.name, photo: '' } : null; };
  const emit = () => listeners.forEach((cb) => cb(current()));
  return {
    kind: 'demo', personas: PERSONAS,
    auth: {
      onChange(cb) { listeners.add(cb); setTimeout(() => cb(current()), 0); return () => listeners.delete(cb); },
      async signIn(personaUid) { localStorage.setItem(WHO, personaUid || 'u_participant'); emit(); },
      async signOut() { localStorage.removeItem(WHO); emit(); }
    },
    async get(path) { return clone(data[path]) ?? null; },
    async set(path, d, merge) { data[path] = merge && data[path] ? mergeDeep(data[path], d) : clone(d); save(); },
    async update(path, d) {
      if (!data[path]) throw new Error('No document at ' + path);
      Object.entries(d).forEach(([k, v]) => { if (k.includes('.')) setDeep(data[path], k, clone(v)); else data[path][k] = clone(v); });
      save();
    },
    async del(path) { delete data[path]; save(); },
    async list(coll, opts = {}) {
      let rows = Object.keys(data).filter((k) => k.startsWith(coll + '/') && k.split('/').length === 2).map((k) => ({ id: k.split('/')[1], ...clone(data[k]) }));
      (opts.where || []).forEach(([f, op, v]) => { rows = rows.filter((r) => (op === '==' ? r[f] === v : true)); });
      return opts.limit ? rows.slice(0, opts.limit) : rows;
    },
    async count(coll, opts) { return (await this.list(coll, opts)).length; },
    async batch(ops) { ops.forEach((o) => { if (o.type === 'del') delete data[o.path]; else if (o.type === 'update') Object.entries(o.data).forEach(([k, v]) => (k.includes('.') ? setDeep(data[o.path], k, clone(v)) : (data[o.path][k] = clone(v)))); else data[o.path] = o.merge && data[o.path] ? mergeDeep(data[o.path], o.data) : clone(o.data); }); save(); },
    // Demo writes land straight in localStorage, so there is nothing to wait on.
    waitForSync: async () => undefined,
    reset() { data = buildDemo(Date.now()); save(); }
  };
}
