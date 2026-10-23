import { DEMO, CONFIG } from '../config.js';

let backend = null;
const ready = (async () => {
  backend = DEMO ? (await import('./memory.js')).createMemory() : (await import('./firebase.js')).createFirebase(CONFIG.firebase);
  return backend;
})();

// All screens talk to the database only through this object.
export const store = {
  ready,
  get kind() { return backend ? backend.kind : 'loading'; },
  get auth() { return backend.auth; },
  get: async (p) => (await ready).get(p),
  set: async (p, d, merge) => (await ready).set(p, d, merge),
  update: async (p, d) => (await ready).update(p, d),
  del: async (p) => (await ready).del(p),
  list: async (c, o) => (await ready).list(c, o),
  count: async (c, o) => (await ready).count(c, o),
  batch: async (ops) => (await ready).batch(ops),
  waitForSync: async () => { const b = await ready; return b.waitForSync ? b.waitForSync() : undefined; },
  reset: async () => { const b = await ready; if (b.reset) b.reset(); }
};
export const rid = (quizId, uid) => `${quizId}_${uid}`;
