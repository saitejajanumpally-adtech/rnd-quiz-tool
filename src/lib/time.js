// All dates are stored as milliseconds and shown in India Standard Time (UTC+5:30, no daylight saving).
export const IST_OFFSET = 330 * 60000;
export const DAY = 86400000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const istParts = (ms) => {
  const d = new Date(ms + IST_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
};
export const fromIst = (y, m, d, h = 0, min = 0) => Date.UTC(y, m, d, h, min) - IST_OFFSET;
export const monthName = (ms) => MONTHS[istParts(ms).m];
export const yearOf = (ms) => istParts(ms).y;

export function fmtDate(ms) { const p = istParts(ms); return `${DOW[p.wd]} ${p.d} ${MON[p.m]}`; }
export function fmtTime(ms) {
  const p = istParts(ms); const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${String(p.min).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`;
}
export const fmtDateTime = (ms) => `${fmtDate(ms)}, ${fmtTime(ms)} IST`;
export function fmtShort(ms) { const p = istParts(ms); return `${MON[p.m]} ${p.d}`; }
export function fmtRange(a, b) {
  const pa = istParts(a), pb = istParts(b);
  return pa.m === pb.m ? `${MON[pa.m]} ${pa.d} to ${pb.d}` : `${MON[pa.m]} ${pa.d} to ${MON[pb.m]} ${pb.d}`;
}
// value for <input type="datetime-local"> in IST, and back
export function toInputValue(ms) {
  const p = istParts(ms);
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}
export function fromInputValue(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
  return m ? fromIst(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}
export function parts(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export const pad2 = (n) => String(n).padStart(2, '0');

// ---- schedule defaults: every second Tuesday 10:00, closes Thursday 11:59 PM, key Saturday 1:00 AM
export function nextTuesdayAfter(now) {
  const p = istParts(now);
  for (let i = 0; i < 8; i++) {
    const ms = fromIst(p.y, p.m, p.d + i, 10, 0);
    if (istParts(ms).wd === 2 && ms > now) return ms;
  }
  return now;
}
export function suggestSchedule(items, now) {
  const lasts = Object.values(items || {}).filter((q) => q.opens).map((q) => q.opens);
  let opens = lasts.length ? Math.max(...lasts) + 14 * DAY : nextTuesdayAfter(now);
  while (opens <= now) opens += 14 * DAY;
  const p = istParts(opens);
  return { opens, closes: fromIst(p.y, p.m, p.d + 2, 23, 59), keyAt: fromIst(p.y, p.m, p.d + 4, 1, 0) };
}

// ---- library date filters (calendar quarters)
export function rangeStart(key, now) {
  const p = istParts(now);
  if (key === 'quarter') return fromIst(p.y, Math.floor(p.m / 3) * 3, 1);
  if (key === 'm6') return fromIst(p.y, p.m - 6, p.d);
  if (key === 'm12') return fromIst(p.y, p.m - 12, p.d);
  return 0;
}
export function quarterLabel(now) {
  const p = istParts(now); const q = Math.floor(p.m / 3) * 3;
  return `${MON[q]} to ${MON[q + 2]} ${p.y}`;
}
