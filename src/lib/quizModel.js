// Authoring model (what creators edit) <-> stored documents (public quiz + private answer key).
export const TYPES = {
  mcq: 'Multiple choice', multi: 'Multi-select', tf: 'True or false', text: 'Written answer',
  order: 'Put in order', rating: 'Rating scale', match: 'Match the pairs', picture: 'Picture question'
};
export const AUTO_TYPES = ['mcq', 'multi', 'tf', 'order', 'match', 'picture'];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function permutation(n, seed) {
  const idx = [...Array(n).keys()]; const r = rng(hash(seed));
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  if (n > 1 && idx.every((v, i) => v === i)) [idx[0], idx[1]] = [idx[1], idx[0]];
  return idx;
}
const inverse = (perm) => { const inv = []; perm.forEach((orig, pub) => { inv[orig] = pub; }); return inv; };

export const uid = (p = 'q') => p + Math.random().toString(36).slice(2, 8);

export function newQuestion(type, id = uid()) {
  const base = { id, type, text: '', ask: '', points: 2, explanation: '', required: false };
  switch (type) {
    case 'mcq': case 'picture': return { ...base, options: ['', '', '', ''], correct: null, image: '' };
    case 'multi': return { ...base, options: ['', '', '', ''], correct: [], partial: true };
    case 'tf': return { ...base, correct: true };
    case 'text': return { ...base, strong: '', rubric: 'Score 0 to 2 in steps of 0.5. Reward clear reasoning and relevance. Do not reward agreement with a particular view.' };
    case 'order': return { ...base, options: ['', '', ''] };
    case 'match': return { ...base, pairs: [{ l: '', r: '' }, { l: '', r: '' }, { l: '', r: '' }] };
    case 'rating': return { ...base, points: 0, scale: { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Completely' } };
    default: return base;
  }
}
export function newQuiz(sched, owner, defaults = {}, ownerName = '') {
  return {
    id: uid('z'), title: '', topic: '', headline: '', ...sched, autoSubmit: !!defaults.autoSubmit, allowReviewRequests: !!defaults.allowReviewRequests, showInLibrary: true,
    announceMsg: 'Hey @all, {quiz_name} is live. Take it here: {link}\nCloses: {close_time} · Answer key: {key_time}\nTeam Leads, please make sure everyone on your team submits.',
    releaseMsg: 'Hey @all, results for {quiz_name} are out. Your score and the answer key are ready: {link}',
    ownerEmail: owner, ownerName, editors: [],
    // A new quiz starts empty. "flat" means no sections: one unnamed group that participants see as a single list.
    sections: [{ id: uid('s'), title: '', flat: true, intro: '', timerMin: 0, questions: [] }]
  };
}

export function toDocs(a) {
  const key = { answers: {} };
  const sections = a.sections.map((s) => ({
    id: s.id, title: s.title, flat: !!s.flat, intro: s.intro || '', timerMin: Number(s.timerMin) || 0,
    questions: s.questions.map((q) => {
      const pub = { id: q.id, type: q.type, text: q.text, ask: q.ask || '', points: Number(q.points) || 0, required: !!q.required };
      const k = { explanation: q.explanation || '' };
      const seed = `${a.id}:${q.id}`;
      if (q.type === 'mcq' || q.type === 'picture') { pub.options = q.options.map(String); k.correct = q.correct; if (q.type === 'picture') pub.image = q.image || ''; }
      else if (q.type === 'multi') { pub.options = q.options.map(String); k.correct = [...q.correct].sort((x, y) => x - y); k.partial = !!q.partial; }
      else if (q.type === 'tf') { k.correct = !!q.correct; }
      else if (q.type === 'text') { k.strong = q.strong || ''; k.rubric = q.rubric || ''; }
      else if (q.type === 'order') { const perm = permutation(q.options.length, seed); pub.options = perm.map((o) => String(q.options[o])); k.correct = inverse(perm); }
      else if (q.type === 'match') {
        const perm = permutation(q.pairs.length, seed);
        pub.left = q.pairs.map((p) => String(p.l)); pub.right = perm.map((o) => String(q.pairs[o].r));
        const inv = inverse(perm); k.correct = Object.fromEntries(inv.map((pubIdx, i) => [String(i), pubIdx]));
      } else if (q.type === 'rating') { pub.scale = { ...q.scale }; pub.points = 0; }
      key.answers[q.id] = k;
      return pub;
    })
  }));
  const quiz = {
    title: a.title, topic: a.topic || '', headline: a.headline || '', opens: a.opens, closes: a.closes, keyAt: a.keyAt,
    autoSubmit: !!a.autoSubmit, allowReviewRequests: !!a.allowReviewRequests, showInLibrary: a.showInLibrary !== false,
    announceMsg: a.announceMsg || '', releaseMsg: a.releaseMsg || '', ownerEmail: a.ownerEmail, ownerName: a.ownerName || '', editors: a.editors || [], sections
  };
  return { quiz, key };
}

export function fromDocs(id, quiz, key) {
  const ans = (key && key.answers) || {};
  const sections = quiz.sections.map((s) => ({
    id: s.id, title: s.title, flat: !!s.flat, intro: s.intro || '', timerMin: s.timerMin || 0,
    questions: s.questions.map((p) => {
      const k = ans[p.id] || {};
      const q = { id: p.id, type: p.type, text: p.text, ask: p.ask || '', points: p.points, explanation: k.explanation || '', required: !!p.required };
      if (p.type === 'mcq' || p.type === 'picture') { q.options = [...p.options]; q.correct = k.correct ?? null; q.image = p.image || ''; }
      else if (p.type === 'multi') { q.options = [...p.options]; q.correct = k.correct || []; q.partial = k.partial !== false; }
      else if (p.type === 'tf') q.correct = k.correct !== false;
      else if (p.type === 'text') { q.strong = k.strong || ''; q.rubric = k.rubric || ''; }
      else if (p.type === 'order') { q.options = (k.correct || p.options.map((_, i) => i)).map((pubIdx) => p.options[pubIdx]); }
      else if (p.type === 'match') { q.pairs = p.left.map((l, i) => ({ l, r: p.right[(k.correct || {})[String(i)] ?? i] })); }
      else if (p.type === 'rating') q.scale = { ...p.scale };
      return q;
    })
  }));
  return { id, title: quiz.title, topic: quiz.topic, headline: quiz.headline, opens: quiz.opens, closes: quiz.closes, keyAt: quiz.keyAt,
    autoSubmit: !!quiz.autoSubmit, allowReviewRequests: !!quiz.allowReviewRequests, showInLibrary: quiz.showInLibrary !== false,
    announceMsg: quiz.announceMsg || '', releaseMsg: quiz.releaseMsg || '', ownerEmail: quiz.ownerEmail, ownerName: quiz.ownerName || '', editors: quiz.editors || [], sections };
}

export function allQuestions(quiz) {
  const out = [];
  quiz.sections.forEach((s, si) => s.questions.forEach((q) => out.push({ ...q, sectionIndex: si, sectionTitle: s.flat ? '' : s.title })));
  return out;
}
export const maxScore = (quiz) => allQuestions(quiz).reduce((a, q) => a + (Number(q.points) || 0), 0);
export const hasWritten = (quiz) => allQuestions(quiz).some((q) => q.type === 'text');

// Problems with a single question, independent of which section it's in. Used both by validate()
// below (quiz-wide, prefixed with "Question N: ") and by the Editor's live per-card warning.
export function questionErrors(q) {
  const e = [];
  if (!q.text.trim()) e.push('add the question text.');
  if (['mcq', 'multi', 'picture'].includes(q.type)) {
    if (q.options.length < 2 || q.options.some((o) => !String(o).trim())) e.push('fill in at least two options, with no blanks.');
    else { const nonEmpty = q.options.map((o) => String(o).trim().toLowerCase()); if (new Set(nonEmpty).size !== nonEmpty.length) e.push('remove the duplicate option text.'); }
    if (q.type === 'multi' ? !q.correct.length : (q.correct == null || q.correct >= q.options.length)) e.push('mark the correct answer.');
    if (q.type === 'picture' && !q.image) e.push('add the picture.');
  }
  if (q.type === 'order' && (q.options.length < 2 || q.options.some((o) => !String(o).trim()))) e.push('list at least two items, in the correct order.');
  if (q.type === 'match' && (q.pairs.length < 2 || q.pairs.some((p) => !p.l.trim() || !p.r.trim()))) e.push('fill in at least two complete pairs.');
  if (q.type === 'text' && !(q.rubric || '').trim()) e.push('add a scoring rubric.');
  if (q.type !== 'rating' && !(Number(q.points) > 0)) e.push('points must be more than 0.');
  return e;
}
export function validate(a) {
  const e = [];
  if (!a.title.trim()) e.push('Give the quiz a name.');
  if (!a.opens || !a.closes) e.push('Set when the quiz opens and closes.');
  else if (a.closes <= a.opens) e.push('The close time must be after the open time.');
  if (a.keyAt && a.closes && a.keyAt < a.closes) e.push('The answer key release time should be after the quiz closes.');
  if (!a.sections.length) e.push('Add at least one question.');
  a.sections.forEach((s, si) => {
    if (!s.flat && !s.title.trim()) e.push(`Section ${si + 1} needs a title.`);
    if (!s.questions.length) e.push(s.flat ? 'Add at least one question.' : `Section ${si + 1} has no questions.`);
    s.questions.forEach((q, qi) => {
      const n = s.flat ? `Question ${qi + 1}` : `Section ${si + 1}, question ${qi + 1}`;
      questionErrors(q).forEach((msg) => e.push(`${n}: ${msg}`));
    });
  });
  return e;
}

// status of a quiz index item
export function quizStatus(item, now) {
  if (!item) return 'none';
  if (item.released) return 'released';
  if (!item.published) return 'draft';
  if (now < item.opens) return 'scheduled';
  if (now < item.closes) return 'live';
  return 'closed';
}
export const STATUS_LABEL = { draft: 'Draft', scheduled: 'Scheduled', live: 'Live', closed: 'Closed, awaiting release', released: 'Released' };

export function fillTemplate(t, vars) { return String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)); }

// the small summary kept in quizIndex/main so screens can list quizzes with one read
export function indexItem(id, quiz, flags = {}) {
  return {
    id, title: quiz.title, headline: quiz.headline || '', topic: quiz.topic || '', opens: quiz.opens, closes: quiz.closes, keyAt: quiz.keyAt || 0,
    showInLibrary: quiz.showInLibrary !== false, autoSubmit: !!quiz.autoSubmit, allowReviewRequests: !!quiz.allowReviewRequests,
    ownerEmail: quiz.ownerEmail, ownerName: quiz.ownerName || '', editors: quiz.editors || [], qCount: allQuestions(quiz).length, max: maxScore(quiz), hasWritten: hasWritten(quiz),
    published: false, released: false, ...flags
  };
}

export const nameFromEmail = (e) => String(e || '').split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Unknown';
export const ownerLabel = (item) => (item && (item.ownerName || nameFromEmail(item.ownerEmail))) || 'Unknown';
