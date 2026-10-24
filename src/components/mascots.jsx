import React, { useMemo, useState } from 'react';
import { useApp } from '../ctx.jsx';
import { ART } from './mascotArt.js';

// The ids saved in people's profiles and in the admin settings stay as they were. Each one maps to a set of picture files.
const FILE = { robot: 'bolt', owl: 'hoot', fox: 'pip', octo: 'octo', cat: 'meow', panda: 'bao' };
export const MASCOTS = [
  { id: 'robot', name: 'Bolt the robot', short: 'Bolt', kind: 'The robot', tags: ['Beep.', 'Systems ready.'] },
  { id: 'owl', name: 'Hoot the owl', short: 'Hoot', kind: 'The owl', tags: ['Hoot.', 'Wise move.'] },
  { id: 'fox', name: 'Pip the fox', short: 'Pip', kind: 'The fox', tags: ['Psst.', 'Sharp.'] },
  { id: 'octo', name: 'Octo the octopus', short: 'Octo', kind: 'The octopus', tags: ['Eight arms ready.', 'Splash.'] },
  { id: 'cat', name: 'Meow the cat', short: 'Meow', kind: 'The cat', tags: ['Meow.', 'Purr.'] },
  { id: 'panda', name: 'Bao the panda', short: 'Bao', kind: 'The panda', tags: ['Easy does it.', 'Steady.'] }
];
export const POSES = ['wave', 'check', 'celebrate', 'steady', 'encouraging', 'ready', 'thinking', 'finished', 'sleepy', 'oops', 'searching', 'goodbye'];
const baseUrl = () => { try { return import.meta.env.BASE_URL || './'; } catch (e) { return './'; } };
export const mascotSrc = (id, pose) => `${baseUrl()}mascots/${FILE[id] || 'bolt'}-${pose}.webp`;
const RATIO = 512 / 551;

// One mascot picture. If the pose file is missing it falls back to the wave pose, then to the drawn mascot.
export function Mascot({ id = 'robot', pose = 'wave', size = 96, still }) {
  const [stage, setStage] = useState(0); const m = MASCOTS.find((x) => x.id === id) || MASCOTS[0];
  if (stage >= 2) return <svg className={still ? '' : 'mascot'} width={Math.min(size, 120)} height={Math.min(size, 120)} viewBox="0 0 84 84" role="img" aria-label={m.name} dangerouslySetInnerHTML={{ __html: ART[id] || ART.robot }} />;
  return <img key={id + pose + stage} className={still ? 'mimg' : 'mimg mascot'} src={mascotSrc(id, stage === 0 ? pose : 'wave')} alt={m.name} width={size} height={Math.round(size * RATIO)} loading="lazy" decoding="async" onError={() => setStage(stage + 1)} />;
}

// A moment decides the pose. Moments in ALL_ONLY show only for people who chose "On every screen".
const MOMENT = {
  welcome: 'wave', upcoming: 'sleepy', none: 'sleepy', live: 'ready', progress: 'ready', sectionStart: 'ready', sectionDone: 'check', review: 'thinking', requiredLeft: 'oops',
  finished: 'finished', finishedFirst: 'celebrate', finishedStreak: 'celebrate', finishedLate: 'oops', submitted: 'check', autoSubmitted: 'steady', closed: 'sleepy', missed: 'encouraging',
  resultHigh: 'celebrate', resultMid: 'steady', resultLow: 'encouraging', resultFirst: 'wave', stageUp: 'celebrate', streak: 'celebrate', answerKey: 'thinking', empty: 'searching',
  error: 'oops', noAccess: 'oops', goodbye: 'goodbye', published: 'celebrate', released: 'celebrate', checklistDone: 'check', noQuizzes: 'wave'
};
export const ALL_ONLY = new Set(['welcome', 'sectionStart', 'sectionDone', 'closed', 'answerKey', 'empty', 'checklistDone', 'noQuizzes']);
export const poseFor = (moment) => MOMENT[moment] || 'wave';
// Whether a moment shows for the person's "Show mascots" choice.
export const showsMoment = (moment, mode = 'all') => !(mode === 'off' || (ALL_ONLY.has(moment) && mode !== 'all'));
export const scoreMoment = (total, max) => (max ? (total / max >= 0.8 ? 'resultHigh' : total / max >= 0.5 ? 'resultMid' : 'resultLow') : 'resultMid');

// Several lines per moment so they do not repeat. Messages never include anyone else's score.
const LINES = {
  welcome: ['Good to see you, {first}.', 'Welcome back, {first}. Ready for another round?', 'Hi {first}. Let\'s see what you know today.'],
  upcoming: ['No quiz today. Browse past quizzes while you wait.', 'The next round is coming. A quick revision never hurts.', 'Quiet day. Browse the Quiz library while you wait.'],
  none: ['The next round hasn\'t been announced yet. I\'ll shout when it is.', 'Nothing scheduled right now. Check back soon.'],
  live: ['Round is open, {first}. Submit it to keep your streak alive.', 'Fresh questions are waiting. About 8 minutes should do it.', 'Take your time, then submit when you\'re happy.'],
  progress: ['{done} down, {left} to go. You\'ve got this.', 'Nice progress. Your answers are saved as you go.'],
  sectionStart: ['Section {n} of {total}: {title}.', 'On to {title}. Take your time.'],
  sectionDone: ['Section done. On to the next one.', 'Good. Keep that momentum going.'],
  review: ['Anything you want to double-check?', 'Have a last look before you submit.'],
  requiredLeft: ['{n} required {answers} left before you can submit.', 'Almost there. {n} required {answers} still to go.'],
  finished: ['Wow. Every question answered. Nicely done.', 'Done. That took focus. Nicely done.', 'Round complete. Nicely done.'],
  finishedFirst: ['First round done. Welcome to the arena.'],
  finishedStreak: ['Round {n} in a row. That\'s a streak.'],
  finishedLate: ['Phew. Just in time.'],
  submitted: ['Locked in. I\'ll shout when the results are out.', 'Submitted. Answers are final, and your streak is safe.'],
  autoSubmitted: ['The quiz closed and your saved answers counted.', 'Time\'s up. Your saved answers counted.'],
  closed: ['Scores are being counted.', 'Closed. Results and the answer key will be out soon.'],
  missed: ['Missed this one. The answer key still teaches.', 'Not this time. There\'s always the next round.'],
  resultHigh: ['Up and strong. Check the answer key for the one you missed.', 'That\'s a great score. Keep it up.'],
  resultMid: ['Holding steady. The answer key has a few quick wins.', 'Good effort. Read the explanations to climb faster.'],
  resultLow: ['A tough one. The answer key has quick wins for the next round.', 'Every round moves you down the funnel. Read the explanations and go again.'],
  resultFirst: ['You\'re on the board. Next round shows how you move.'],
  stageUp: ['You reached {stage}.'],
  streak: ['{n} rounds in a row.'],
  answerKey: ['Take your time with the explanations.', 'Tricky ones are worth reading twice.'],
  empty: ['No quizzes match. Try a longer date range.', 'Nothing here yet. It will fill up after your first round.'],
  error: ['Couldn\'t save that. Retrying. Keep this tab open.', 'Something went wrong. Check your connection and try again.'],
  noAccess: ['You don\'t have access to this page.'],
  goodbye: ['See you next round.'],
  published: ['Published. {title} is scheduled.'],
  released: ['Results are out.'],
  checklistDone: ['Every step ticked. Ready to release.'],
  noQuizzes: ['Create the first quiz.']
};
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
    return { id, mode: prefs.mascotMode || 'all', ...MASCOTS.find((m) => m.id === id) };
  }, [prefs, settings]);
}
export function lineFor(moment, vars, m, seed = 0) {
  const bank = LINES[moment] || LINES.welcome; const base = bank[(seed + (vars.n || 0)) % bank.length];
  const tag = (seed % 3 === 0 && m && m.tags && bank.length > 1) ? m.tags[seed % m.tags.length] + ' ' : '';
  return tag + base.replace(/\{(\w+)\}/g, (x, k) => (vars[k] !== undefined ? vars[k] : x));
}
// A mascot message. It respects the person's "Show mascots" choice: key moments only, every screen, or off.
export function Bolt({ moment, vars = {}, size = 110, level, card = true, force }) {
  const { user } = useApp(); const m = useMascot();
  const seed = useMemo(() => Math.floor(Math.random() * 1000), [moment]);
  const lvl = level || (ALL_ONLY.has(moment) ? 'all' : 'moments');
  if (!force && (m.mode === 'off' || (lvl === 'all' && m.mode !== 'all'))) return null;
  const first = (user && user.name ? user.name.split(' ')[0] : 'there');
  const text = lineFor(moment, { first, ...vars }, m, seed);
  const body = (
    <div className="bolt">
      <Mascot id={m.id} pose={poseFor(moment)} size={size} />
      <div><div className="lab" style={{ marginBottom: 6 }}>{m.short} says</div><div style={{ fontSize: 15, lineHeight: 1.4 }}>{text}</div></div>
    </div>
  );
  return card ? <div className="card">{body}</div> : body;
}

// Just the picture for a moment (no message), for places that already have their own text.
export function MascotPic({ moment, size = 96 }) {
  const m = useMascot(); const lvl = ALL_ONLY.has(moment) ? 'all' : 'moments';
  if (m.mode === 'off' || (lvl === 'all' && m.mode !== 'all')) return null;
  return <Mascot id={m.id} pose={poseFor(moment)} size={size} />;
}
