// Admin "Export Users CSV". Pure function so it can be tested without the database.
import { toCsv } from './csv.js';
import { IST_OFFSET, DAY } from './time.js';

// Times are stored in UTC milliseconds and written in IST, so the file reads the way the team talks.
export const istStamp = (ms) => (ms ? new Date(ms + IST_OFFSET).toISOString().slice(0, 16).replace('T', ' ') : '');

export function buildUsersCsv(users, responses, now = Date.now()) {
  const takenBy = {};
  responses.forEach((r) => { if (r.submitted) takenBy[r.uid] = (takenBy[r.uid] || 0) + 1; });

  // Records saved before this version have no "deleted" field, so they count as active.
  const rows = users.map((u) => {
    const deleted = u.deleted === true;
    return {
      name: u.name || '',
      email: u.email || u.id || '',
      status: deleted ? 'Deleted' : 'Active',
      firstSignIn: u.firstSeen || u.lastSeen || 0,
      lastSignIn: u.lastSeen || 0,
      deletedAt: deleted ? (u.deletedAt || 0) : 0,
      quizzesTaken: takenBy[u.id] || 0
    };
  }).sort((a, b) => b.lastSignIn - a.lastSignIn);

  const active = rows.filter((r) => r.status === 'Active').length;
  const deleted = rows.length - active;
  const recent = rows.filter((r) => r.lastSignIn >= now - 30 * DAY).length;

  const summary = [
    ['Summary', ''],
    ['Total unique sign-ins', rows.length],
    ['Active', active],
    ['Deleted (profile removed; history kept)', deleted],
    ['Signed in within the last 30 days', recent],
    ['Generated (IST)', istStamp(now)],
    []
  ];
  const header = ['name', 'email', 'status', 'first_sign_in_ist', 'last_sign_in_ist', 'deleted_at_ist', 'quizzes_taken'];
  const body = rows.map((r) => [r.name, r.email, r.status, istStamp(r.firstSignIn), istStamp(r.lastSignIn), istStamp(r.deletedAt), r.quizzesTaken]);
  return toCsv([...summary, header, ...body]);
}

export const usersSummary = (users, now = Date.now()) => {
  const deleted = users.filter((u) => u.deleted === true).length;
  return { total: users.length, active: users.length - deleted, deleted, recent30: users.filter((u) => (u.lastSeen || 0) >= now - 30 * DAY).length };
};
