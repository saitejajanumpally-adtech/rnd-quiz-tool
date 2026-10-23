import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, waitForPendingWrites,
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, limit as qlimit, getDocs, writeBatch, getCountFromServer
} from 'firebase/firestore';
import { CONFIG } from '../config.js';

const clean = (o) => JSON.parse(JSON.stringify(o));

// Queues writes locally (IndexedDB) so a dropped connection doesn't lose them: they sync automatically once back online.
// Falls back to the plain, memory-only client if persistence can't be enabled (e.g. some private-browsing modes).
function openFirestore(app) {
  try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { return getFirestore(app); }
}

export function createFirebase(cfg) {
  const app = initializeApp(cfg);
  const fbAuth = getAuth(app);
  const fs = openFirestore(app);
  const ref = (path) => doc(fs, path);
  const q = (coll, opts = {}) => {
    const parts = (opts.where || []).map(([f, op, v]) => where(f, op, v));
    if (opts.limit) parts.push(qlimit(opts.limit));
    return query(collection(fs, coll), ...parts);
  };
  return {
    kind: 'firebase',
    auth: {
      onChange(cb) {
        return onAuthStateChanged(fbAuth, async (u) => {
          if (!u) return cb(null);
          const email = (u.email || '').toLowerCase();
          if (!u.emailVerified || !email.endsWith('@' + CONFIG.domain)) {
            await signOut(fbAuth);
            return cb(null, `Sign in with your @${CONFIG.domain} account. ${email || 'That account'} isn't allowed here.`);
          }
          cb({ uid: u.uid, email, name: u.displayName || email.split('@')[0], photo: u.photoURL || '' });
        });
      },
      async signIn() {
        const p = new GoogleAuthProvider();
        p.setCustomParameters({ hd: CONFIG.domain, prompt: 'select_account' });
        await signInWithPopup(fbAuth, p);
      },
      signOut: () => signOut(fbAuth)
    },
    async get(path) { const s = await getDoc(ref(path)); return s.exists() ? s.data() : null; },
    async set(path, data, merge = false) { await setDoc(ref(path), clean(data), { merge }); },
    async update(path, data) { await updateDoc(ref(path), clean(data)); },
    async del(path) { await deleteDoc(ref(path)); },
    async list(coll, opts) { const s = await getDocs(q(coll, opts)); return s.docs.map((d) => ({ id: d.id, ...d.data() })); },
    async count(coll, opts) { const s = await getCountFromServer(q(coll, opts)); return s.data().count; },
    // Resolves once every write queued so far (including ones from a dropped connection) is acknowledged by the server.
    waitForSync: () => waitForPendingWrites(fs),
    async batch(ops) {
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(fs);
        ops.slice(i, i + 400).forEach((o) => {
          if (o.type === 'del') b.delete(ref(o.path));
          else if (o.type === 'update') b.update(ref(o.path), clean(o.data));
          else b.set(ref(o.path), clean(o.data), { merge: !!o.merge });
        });
        await b.commit();
      }
    }
  };
}
