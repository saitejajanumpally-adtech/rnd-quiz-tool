import React, { useMemo } from 'react';
import { useApp } from '../ctx.jsx';

const ART = {
  robot: '<rect x="14" y="20" width="56" height="48" rx="14" fill="#2DA9A2"/><rect x="38" y="8" width="8" height="14" rx="3" fill="#5FC9C0"/><circle cx="42" cy="8" r="5" fill="#E0A04B"/><g class="eye"><ellipse cx="32" cy="42" rx="6" ry="7" fill="#07221F"/><ellipse cx="52" cy="42" rx="6" ry="7" fill="#07221F"/></g><circle cx="34" cy="40" r="2" fill="#E8EBEC"/><circle cx="54" cy="40" r="2" fill="#E8EBEC"/><path d="M33 56 Q42 63 51 56" stroke="#07221F" stroke-width="3" fill="none" stroke-linecap="round"/>',
  owl: '<path d="M16 22 L28 30 L16 38Z" fill="#1F3845"/><path d="M68 22 L56 30 L68 38Z" fill="#1F3845"/><ellipse cx="42" cy="46" rx="26" ry="28" fill="#2DA9A2"/><ellipse cx="42" cy="58" rx="15" ry="16" fill="#B8C5CC"/><circle cx="31" cy="38" r="10" fill="#E8EBEC"/><circle cx="53" cy="38" r="10" fill="#E8EBEC"/><g class="eye"><circle cx="31" cy="39" r="5" fill="#07221F"/><circle cx="53" cy="39" r="5" fill="#07221F"/></g><path d="M38 47 L46 47 L42 55Z" fill="#E0A04B"/>',
  fox: '<path d="M12 14 L32 28 L14 42Z" fill="#E2745A"/><path d="M72 14 L52 28 L70 42Z" fill="#E2745A"/><path d="M12 36 Q42 12 72 36 Q74 62 42 74 Q10 62 12 36Z" fill="#E2745A"/><path d="M18 48 Q42 40 66 48 Q58 70 42 74 Q26 70 18 48Z" fill="#E8EBEC"/><g class="eye"><ellipse cx="30" cy="44" rx="4" ry="5" fill="#07221F"/><ellipse cx="54" cy="44" rx="4" ry="5" fill="#07221F"/></g><circle cx="42" cy="62" r="4" fill="#07221F"/>',
  octo: '<path d="M16 50 Q10 74 22 72 Q26 64 28 56Z" fill="#6FB7E0"/><path d="M68 50 Q74 74 62 72 Q58 64 56 56Z" fill="#6FB7E0"/><path d="M30 58 Q28 78 38 74 Q40 68 40 60Z" fill="#6FB7E0"/><path d="M54 58 Q56 78 46 74 Q44 68 44 60Z" fill="#6FB7E0"/><circle cx="42" cy="36" r="26" fill="#6FB7E0"/><circle cx="32" cy="38" r="6" fill="#E8EBEC"/><circle cx="52" cy="38" r="6" fill="#E8EBEC"/><g class="eye"><circle cx="33" cy="39" r="3" fill="#07221F"/><circle cx="53" cy="39" r="3" fill="#07221F"/></g><path d="M35 50 Q42 56 49 50" stroke="#07221F" stroke-width="3" fill="none" stroke-linecap="round"/>',
  cat: '<path d="M14 12 L34 26 L14 40Z" fill="#E0A04B"/><path d="M70 12 L50 26 L70 40Z" fill="#E0A04B"/><ellipse cx="42" cy="46" rx="30" ry="26" fill="#E0A04B"/><g class="eye"><ellipse cx="30" cy="44" rx="4" ry="5" fill="#07221F"/><ellipse cx="54" cy="44" rx="4" ry="5" fill="#07221F"/></g><path d="M38 54 L46 54 L42 59Z" fill="#E2745A"/><path d="M42 59 Q38 64 34 62 M42 59 Q46 64 50 62" stroke="#07221F" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 52 L26 54 M12 60 L26 58 M72 52 L58 54 M72 60 L58 58" stroke="#07221F" stroke-width="1.6" stroke-linecap="round"/>',
  panda: '<circle cx="18" cy="20" r="9" fill="#0E1B22" stroke="#2B4452"/><circle cx="66" cy="20" r="9" fill="#0E1B22" stroke="#2B4452"/><ellipse cx="42" cy="46" rx="30" ry="26" fill="#E8EBEC"/><ellipse cx="29" cy="42" rx="8" ry="10" fill="#0E1B22"/><ellipse cx="55" cy="42" rx="8" ry="10" fill="#0E1B22"/><g class="eye"><circle cx="30" cy="43" r="3" fill="#E8EBEC"/><circle cx="54" cy="43" r="3" fill="#E8EBEC"/></g><ellipse cx="42" cy="54" rx="5" ry="3.5" fill="#0E1B22"/><path d="M37 60 Q42 65 47 60" stroke="#0E1B22" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
};
export const MASCOTS = [
  { id: 'robot', name: 'Bolt the robot', short: 'Bolt', tags: ['Beep.', 'Systems ready.'] },
  { id: 'owl', name: 'Hoot the owl', short: 'Hoot', tags: ['Hoot.', 'Wise move.'] },
  { id: 'fox', name: 'Pip the fox', short: 'Pip', tags: ['Psst.', 'Sharp.'] },
  { id: 'octo', name: 'Octo the octopus', short: 'Octo', tags: ['Eight arms ready.', 'Splash.'] },
  { id: 'cat', name: 'Meow the cat', short: 'Meow', tags: ['Meow.', 'Purr.'] },
  { id: 'panda', name: 'Bao the panda', short: 'Bao', tags: ['Easy does it.', 'Steady.'] }
];
export function Mascot({ id = 'robot', size = 84, still }) {
  return <svg className={still ? '' : 'mascot'} width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={(MASCOTS.find((m) => m.id === id) || MASCOTS[0]).name} dangerouslySetInnerHTML={{ __html: ART[id] || ART.robot }} />;
}

// Several lines per moment so they do not repeat. Messages never include anyone else's score.
const LINES = {
  welcome: ['Good to see you, {first}.', 'Welcome back, {first}. Ready for another round?', 'Hi {first}. Let\'s see what you know today.'],
  upcoming: ['No quiz today. Fancy a look at last round\'s answer key?', 'The next round is coming. A quick revision never hurts.', 'Quiet day. Browse the Quiz library while you wait.'],
  none: ['The next round hasn\'t been announced yet. I\'ll shout when it is.', 'Nothing scheduled right now. Check back soon.'],
  live: ['Round is open, {first}. Submit it to keep your streak alive.', 'Fresh questions are waiting. About 8 minutes should do it.', 'Take your time, then submit when you\'re happy.'],
  progress: ['{done} down, {left} to go. You\'ve got this.', 'Nice progress. Your answers are saved as you go.'],
  sectionDone: ['Section done. On to the next one.', 'Good. Keep that momentum going.'],
  submitted: ['Locked in. Now we wait for the results.', 'Submitted. Answers are final, and your streak is safe.'],
  autoSubmitted: ['The quiz closed and your saved answers were submitted for you.', 'Time\'s up. Your saved answers counted.'],
  closed: ['Quiz closed. Scores are being counted.', 'Closed. Results and the answer key will be out soon.'],
  missed: ['You missed this round. The answer key will still teach you something.', 'Not this time. There\'s always the next round.'],
  resultHigh: ['Strong round. Check the answer key for the one you missed.', 'That\'s a great score. Keep it up.'],
  resultMid: ['Solid round. The answer key has a few quick wins.', 'Good effort. Read the explanations to climb faster.'],
  resultLow: ['A tough one. The answer key explains each question, and the next round is a fresh start.', 'Every round moves you down the funnel. Read the explanations and go again.'],
  answerKey: ['Take your time with the explanations.', 'Tricky ones are worth reading twice.'],
  empty: ['Nothing here yet. It will fill up after your first round.', 'No quizzes match. Try a longer date range.'],
  error: ['Couldn\'t save that. Retrying, keep this tab open.', 'Something went wrong. Check your connection and try again.']
};
export const scoreMoment = (total, max) => (max ? (total / max >= 0.8 ? 'resultHigh' : total / max >= 0.5 ? 'resultMid' : 'resultLow') : 'resultMid');

function chosenIds(prefs, settings) {
  const ids = (prefs.mascots && prefs.mascots.length ? prefs.mascots : settings.defaultMascots || ['robot']).filter((i) => ART[i]);
  return ids.length ? ids : ['robot'];
}
function visitNumber() {
  try {
    if (sessionStorage.getItem('arena-visit-counted')) return Number(sessionStorage.getItem('arena-visit-n') || 0);
    const n = Number(localStorage.getItem('arena-visits') || 0) + 1; localStorage.setItem('arena-visits', String(n));
    sessionStorage.setItem('arena-visit-counted', '1'); sessionStorage.setItem('arena-visit-n', String(n)); return n;
  } catch (e) { return 0; }
}
export function useMascot() {
  const { prefs, settings } = useApp();
  return useMemo(() => {
    const ids = chosenIds(prefs, settings); const id = ids[visitNumber() % ids.length];
    return { id, mode: prefs.mascotMode || 'moments', ...MASCOTS.find((m) => m.id === id) };
  }, [prefs, settings]);
}
export function lineFor(moment, vars, m, seed = 0) {
  const bank = LINES[moment] || LINES.welcome; const base = bank[(seed + (vars.n || 0)) % bank.length];
  const tag = (seed % 3 === 0) ? m.tags[seed % m.tags.length] + ' ' : '';
  return tag + base.replace(/\{(\w+)\}/g, (x, k) => (vars[k] !== undefined ? vars[k] : x));
}
// A mascot message. level 'all' means it only shows when the person chose "on every screen".
export function Bolt({ moment, vars = {}, size = 84, level = 'moments', card = true }) {
  const { user } = useApp(); const m = useMascot();
  const seed = useMemo(() => Math.floor(Math.random() * 1000), [moment]);
  if (m.mode === 'off' || (level === 'all' && m.mode !== 'all')) return null;
  const first = (user && user.name ? user.name.split(' ')[0] : 'there');
  const text = lineFor(moment, { first, ...vars }, m, seed);
  const body = (
    <div className="bolt">
      <Mascot id={m.id} size={size} />
      <div><div className="lab" style={{ marginBottom: 6 }}>{m.short} says</div><div style={{ fontSize: 15, lineHeight: 1.4 }}>{text}</div></div>
    </div>
  );
  return card ? <div className="card">{body}</div> : body;
}
