// OPTIONAL. Not part of the normal build or tests. To run it on your own computer (needs Java 11+ and internet):
//   npm install --no-save @firebase/rules-unit-testing firebase-tools
//   npx firebase emulators:exec --only firestore --project rnd-quiz-tool "npx vitest run --config /dev/null tests/rules"
// Most people can use the Rules Playground in the Firebase Console instead (see PLAYGROUND-CHECKS.md).
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, setLogLevel } from 'firebase/firestore';

setLogLevel('error');
const ADMIN = 'saiteja.janumpally@databeat.io';
const who = (email, uid) => ({ email, uid, verified: true });
const people = {
  admin: who(ADMIN, 'uAdmin'), creator: who('creator@databeat.io', 'uCreator'), creator2: who('creator2@databeat.io', 'uCreator2'),
  lead: who('lead@databeat.io', 'uLead'), gone: who('gone@databeat.io', 'uGone'), p1: who('p1@databeat.io', 'uP1'), p2: who('p2@databeat.io', 'uP2'),
  outsider: who('someone@gmail.com', 'uOut')
};
let env;
const as = (k) => env.authenticatedContext(people[k].uid, { email: people[k].email, email_verified: people[k].verified });
const anon = () => env.unauthenticatedContext();
const seed = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const now = Date.now();

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'rnd-quiz-tool', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'roles/creator@databeat.io'), { role: 'creator' });
    await setDoc(doc(db, 'roles/creator2@databeat.io'), { role: 'creator' });
    await setDoc(doc(db, 'roles/lead@databeat.io'), { role: 'lead' });
    // a released quiz, an unreleased quiz, and an archived released quiz
    await setDoc(doc(db, 'quizzes/rel'), { published: true, opens: now - 1000, closes: now + 5000, ownerEmail: 'creator@databeat.io', editors: [] });
    await setDoc(doc(db, 'quizKeys/rel'), { released: true, answers: {} });
    await setDoc(doc(db, 'quizzes/draft'), { published: false, opens: now + 9000, closes: now + 99999, ownerEmail: 'creator@databeat.io', editors: [] });
    await setDoc(doc(db, 'quizKeys/draft'), { released: false, answers: {} });
    await setDoc(doc(db, 'quizzes/old'), { published: true, archived: true, opens: now - 9000, closes: now - 8000, ownerEmail: 'creator@databeat.io', editors: [] });
    await setDoc(doc(db, 'quizKeys/old'), { released: true, archived: true, answers: {} });
    await setDoc(doc(db, 'resultsPublic/old'), { rows: [] });
    await setDoc(doc(db, 'quizIndex/main'), { items: { rel: { title: 'Released one' } } });
    await setDoc(doc(db, 'quizIndex/archived'), { items: { old: { title: 'Archived one' } } });
    await setDoc(doc(db, 'resultsFull/old'), { rows: [] });
    await setDoc(doc(db, 'users/uGone'), { name: 'Gone', email: 'gone@databeat.io', lastSeen: now, firstSeen: now, deleted: true, deletedAt: now });
    await setDoc(doc(db, 'users/uP1'), { name: 'P One', email: 'p1@databeat.io', lastSeen: now, firstSeen: now, deleted: false, deletedAt: null });
    await setDoc(doc(db, 'users/uP2'), { name: 'P Two', email: 'p2@databeat.io', lastSeen: now, firstSeen: now, deleted: false, deletedAt: null });
  });
});

describe('sign-in gate', () => {
  it('non-databeat accounts can read nothing', async () => {
    await assertFails(getDoc(doc(as('outsider').firestore(), 'quizIndex/main')));
  });
  it('signed-out users can read nothing', async () => {
    await assertFails(getDoc(doc(anon().firestore(), 'quizIndex/main')));
  });
});

describe('Users export (admin only)', () => {
  it('admin can list every user record', async () => {
    await assertSucceeds(getDocs(collection(as('admin').firestore(), 'users')));
  });
  it('creators, leads and participants cannot list users', async () => {
    await assertFails(getDocs(collection(as('creator').firestore(), 'users')));
    await assertFails(getDocs(collection(as('lead').firestore(), 'users')));
    await assertFails(getDocs(collection(as('p1').firestore(), 'users')));
  });
  it('a participant can read only their own record', async () => {
    await assertSucceeds(getDoc(doc(as('p1').firestore(), 'users/uP1')));
    await assertFails(getDoc(doc(as('p1').firestore(), 'users/uP2')));
  });
});

describe('profile removal', () => {
  it('a person can mark their own profile deleted', async () => {
    await assertSucceeds(updateDoc(doc(as('p1').firestore(), 'users/uP1'), { deleted: true, deletedAt: now }));
  });
  it('a person cannot mark someone else deleted', async () => {
    await assertFails(updateDoc(doc(as('p1').firestore(), 'users/uP2'), { deleted: true, deletedAt: now }));
  });
  it('a person cannot delete their user record outright', async () => {
    await assertFails(deleteDoc(doc(as('p1').firestore(), 'users/uP1')));
  });
  it('a person cannot change the first sign-in date', async () => {
    await assertFails(updateDoc(doc(as('p1').firestore(), 'users/uP1'), { firstSeen: 1 }));
  });
  it('a removed profile can sign in again and become Active', async () => {
    await seed(async (db) => updateDoc(doc(db, 'users/uP1'), { deleted: true, deletedAt: now }));
    await assertSucceeds(updateDoc(doc(as('p1').firestore(), 'users/uP1'), { deleted: false, deletedAt: null, lastSeen: now + 1 }));
  });
});

describe('first sign-in', () => {
  it('a new person can create their record, with or without the new fields', async () => {
    await assertSucceeds(setDoc(doc(as('lead').firestore(), 'users/uLead'), { name: 'L', email: 'lead@databeat.io', lastSeen: now }));
  });
  it('a new person cannot create a record that is already marked deleted', async () => {
    await assertFails(setDoc(doc(as('lead').firestore(), 'users/uLead'), { name: 'L', email: 'lead@databeat.io', lastSeen: now, deleted: true }));
  });
});

describe('quiz delete (admin only, unreleased only)', () => {
  it('admin can delete an unreleased quiz', async () => {
    await assertSucceeds(deleteDoc(doc(as('admin').firestore(), 'quizzes/draft')));
  });
  it('creators cannot delete, even their own unreleased quiz', async () => {
    await assertFails(deleteDoc(doc(as('creator').firestore(), 'quizzes/draft')));
  });
  it('nobody can delete a released quiz, admin included', async () => {
    await assertFails(deleteDoc(doc(as('admin').firestore(), 'quizzes/rel')));
  });
});

describe('creator access', () => {
  it('any creator can edit any quiz, not only their own', async () => {
    await assertSucceeds(updateDoc(doc(as('creator2').firestore(), 'quizzes/draft'), { title: 'Changed by another creator' }));
  });
  it('creators cannot change the archive status', async () => {
    await assertFails(updateDoc(doc(as('creator').firestore(), 'quizzes/rel'), { archived: true }));
  });
  it('leads cannot edit quizzes', async () => {
    await assertFails(updateDoc(doc(as('lead').firestore(), 'quizzes/draft'), { title: 'x' }));
  });
});

describe('archive', () => {
  it('admin can archive a released quiz', async () => {
    await assertSucceeds(updateDoc(doc(as('admin').firestore(), 'quizKeys/rel'), { archived: true }));
  });
  it('the archived list is readable and writable by admins only', async () => {
    await assertSucceeds(getDoc(doc(as('admin').firestore(), 'quizIndex/archived')));
    await assertFails(getDoc(doc(as('creator').firestore(), 'quizIndex/archived')));
    await assertFails(getDoc(doc(as('p1').firestore(), 'quizIndex/archived')));
    await assertFails(setDoc(doc(as('creator').firestore(), 'quizIndex/archived'), { items: {} }));
    await assertSucceeds(setDoc(doc(as('admin').firestore(), 'quizIndex/archived'), { items: {} }));
  });
  it('everyone signed in can still read the normal Library list', async () => {
    await assertSucceeds(getDoc(doc(as('p1').firestore(), 'quizIndex/main')));
  });
  it('archived quizzes, keys and results are hidden from participants and creators', async () => {
    for (const k of ['p1', 'creator']) {
      await assertFails(getDoc(doc(as(k).firestore(), 'quizzes/old')));
      await assertFails(getDoc(doc(as(k).firestore(), 'quizKeys/old')));
      await assertFails(getDoc(doc(as(k).firestore(), 'resultsPublic/old')));
      await assertFails(getDoc(doc(as(k).firestore(), 'resultsFull/old')));
    }
  });
  it('admins still see archived quizzes and results', async () => {
    await assertSucceeds(getDoc(doc(as('admin').firestore(), 'quizzes/old')));
    await assertSucceeds(getDoc(doc(as('admin').firestore(), 'resultsPublic/old')));
  });
  it('creators cannot change archive status', async () => {
    await assertFails(updateDoc(doc(as('creator').firestore(), 'quizzes/rel'), { archived: true }));
  });
  it('the quiz list is admin-only', async () => {
    await assertFails(getDocs(collection(as('creator').firestore(), 'quizzes')));
    await assertSucceeds(getDocs(collection(as('admin').firestore(), 'quizzes')));
  });
});

describe('a removed profile cannot answer quizzes', () => {
  const newResponse = (k, uid) => doc(as(k).firestore(), `responses/rel_${uid}`);
  const body = (p) => ({ quizId: 'rel', uid: p.uid, email: p.email, name: 'x', answers: {}, submitted: false, startedAt: now, updatedAt: now });
  it('an active participant can start a response on an open quiz', async () => {
    await assertSucceeds(setDoc(newResponse('p1', 'uP1'), body(people.p1)));
  });
  it('a removed profile cannot start a response', async () => {
    await assertFails(setDoc(newResponse('gone', 'uGone'), body(people.gone)));
  });
  it('a removed profile cannot change an existing response', async () => {
    await seed(async (db) => setDoc(doc(db, 'responses/rel_uGone'), body(people.gone)));
    await assertFails(updateDoc(newResponse('gone', 'uGone'), { answers: { q1: 1 }, updatedAt: now + 1 }));
  });
  it('admins can still read a removed profile\'s history', async () => {
    await seed(async (db) => setDoc(doc(db, 'responses/rel_uGone'), body(people.gone)));
    await assertSucceeds(getDoc(doc(as('admin').firestore(), 'responses/rel_uGone')));
  });
});

describe('results are unchanged for released, non-archived quizzes', () => {
  it('participants can read a released, non-archived result', async () => {
    await seed(async (db) => setDoc(doc(db, 'resultsPublic/rel'), { rows: [] }));
    await assertSucceeds(getDoc(doc(as('p1').firestore(), 'resultsPublic/rel')));
  });
});

describe('raw answers of archived quizzes are admin-only', () => {
  const resp = (quiz, uid) => ({ quizId: quiz, uid, email: uid + '@databeat.io', name: 'x', answers: {}, submitted: true, startedAt: now, updatedAt: now });
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'responses/rel_uP1'), resp('rel', 'uP1'));
      await setDoc(doc(db, 'responses/old_uP1'), resp('old', 'uP1'));
    });
  });
  it('creators can read raw answers of an active quiz', async () => {
    await assertSucceeds(getDoc(doc(as('creator').firestore(), 'responses/rel_uP1')));
    await assertSucceeds(getDocs(query(collection(as('creator').firestore(), 'responses'), where('quizId', '==', 'rel'))));
  });
  it('creators cannot read raw answers of an archived quiz', async () => {
    await assertFails(getDoc(doc(as('creator').firestore(), 'responses/old_uP1')));
    await assertFails(getDocs(query(collection(as('creator').firestore(), 'responses'), where('quizId', '==', 'old'))));
  });
  it('admins can read raw answers of an archived quiz', async () => {
    await assertSucceeds(getDoc(doc(as('admin').firestore(), 'responses/old_uP1')));
    await assertSucceeds(getDocs(query(collection(as('admin').firestore(), 'responses'), where('quizId', '==', 'old'))));
  });
  it('a person can still read their own answers', async () => {
    await assertSucceeds(getDoc(doc(as('p1').firestore(), 'responses/rel_uP1')));
  });
});

describe('profileStatus marker', () => {
  it('any signed-in person can read it, outsiders and signed-out visitors cannot', async () => {
    await seed(async (db) => setDoc(doc(db, 'profileStatus/uP2'), { removed: true, at: now }));
    await assertSucceeds(getDoc(doc(as('p1').firestore(), 'profileStatus/uP2')));
    await assertFails(getDoc(doc(as('outsider').firestore(), 'profileStatus/uP2')));
    await assertFails(getDoc(doc(anon().firestore(), 'profileStatus/uP2')));
  });
  it('a person can add and remove only their own marker', async () => {
    await assertSucceeds(setDoc(doc(as('p1').firestore(), 'profileStatus/uP1'), { removed: true, at: now }));
    await assertFails(setDoc(doc(as('p1').firestore(), 'profileStatus/uP2'), { removed: true, at: now }));
    await seed(async (db) => setDoc(doc(db, 'profileStatus/uP1'), { removed: true, at: now }));
    await assertSucceeds(deleteDoc(doc(as('p1').firestore(), 'profileStatus/uP1')));
    await seed(async (db) => setDoc(doc(db, 'profileStatus/uP2'), { removed: true, at: now }));
    await assertFails(deleteDoc(doc(as('p1').firestore(), 'profileStatus/uP2')));
  });
  it('the marker can only say removed, with a time', async () => {
    await assertFails(setDoc(doc(as('p1').firestore(), 'profileStatus/uP1'), { removed: true, at: now, note: 'x' }));
    await assertFails(setDoc(doc(as('p1').firestore(), 'profileStatus/uP1'), { removed: false, at: now }));
  });
});
