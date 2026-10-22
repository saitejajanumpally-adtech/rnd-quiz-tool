// Sample data for DEMO MODE only. Nothing here is used once Firebase is configured.
import { newQuestion, newQuiz, toDocs, indexItem } from './quizModel.js';
import { gradeQuiz } from './scoring.js';
import { monthName, yearOf, DAY, fromIst, istParts } from './time.js';
import { CONFIG } from '../config.js';

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const PERSONAS = [
  { uid: 'u_participant', email: 'participant@databeat.io', name: 'Priya (participant)', role: 'participant' },
  { uid: 'u_lead', email: 'lead@databeat.io', name: 'Lakshmi (lead)', role: 'lead' },
  { uid: 'u_creator', email: 'creator@databeat.io', name: 'Charan (creator)', role: 'creator' },
  { uid: 'u_admin', email: CONFIG.bootstrapAdmin, name: 'Sai Teja (admin)', role: 'admin' }
];
const NAMES = ['Aarav K', 'Diya M', 'Ishaan R', 'Meera S', 'Kabir T', 'Anaya P', 'Vihaan G', 'Saanvi N', 'Reyansh D', 'Myra B', 'Arjun V', 'Kiara L', 'Rohan C', 'Navya H', 'Ayaan J', 'Tara F', 'Dev A', 'Ira Q', 'Neel W', 'Zoya E', 'Yash U', 'Riya O', 'Om Z', 'Siya X', 'Krish Y', 'Pari I', 'Veer S', 'Mahi K'];

function sample(type, o) { return { ...newQuestion(type, o.id), ...o }; }
function quizSets(now) {
  const sets = [
    { id: 'z_aug2', ago: 57, sections: [{ id: 's1', title: 'Multiple choice', questions: [
      sample('mcq', { id: 'a1', text: 'What does CPM stand for?', ask: '', options: ['Cost per mille (per 1,000 impressions)', 'Clicks per minute', 'Cost per message', 'Conversions per month'], correct: 0, explanation: 'CPM is the price paid for one thousand impressions.' }),
      sample('tf', { id: 'a2', text: 'ads.txt is a public file where a publisher lists the companies authorised to sell its ad inventory.', correct: true, explanation: 'Yes. Buyers check ads.txt to avoid unauthorised sellers.' })] },
      { id: 's2', title: 'Opinion', questions: [sample('text', { id: 'a3', text: 'Would you let an AI agent adjust floor prices on its own?', ask: 'Explain your reasoning.', strong: 'A clear position, the controls you would require, and the trade-off you accept.' })] }] },
    { id: 'z_sep1', ago: 43, sections: [{ id: 's1', title: 'Multiple choice', questions: [
      sample('mcq', { id: 'b1', text: 'Fill rate is...', options: ['Impressions served divided by ad requests', 'Clicks divided by impressions', 'Revenue per thousand impressions', 'Viewable divided by measured impressions'], correct: 0, explanation: 'It shows how much of the available demand was actually filled.' }),
      sample('multi', { id: 'b2', text: 'Which of these are common programmatic ad formats?', options: ['Display banners', 'Instream video', 'Native', 'Telephone directories'], correct: [0, 1, 2], explanation: 'Display, video and native are all sold programmatically.' })] },
      { id: 's2', title: 'Opinion', questions: [sample('text', { id: 'b3', text: 'Should a publisher reduce ad density if it improves the reader experience?', ask: 'Why or why not?', strong: 'A clear recommendation, the revenue versus experience trade-off, and how you would test it.' })] }] },
    { id: 'z_sep2', ago: 29, sections: [{ id: 's1', title: 'Multiple choice', questions: [
      sample('mcq', { id: 'c1', text: 'Which metric is clicks divided by impressions?', options: ['CTR', 'VTR', 'eCPM', 'Fill rate'], correct: 0, explanation: 'Click-through rate.' }),
      sample('order', { id: 'c2', text: 'Put the steps of a programmatic ad call in order.', options: ['Page loads and an ad request is sent', 'SSP sends bid requests to DSPs', 'DSPs respond with bids', 'Winning ad is rendered on the page'], explanation: 'Request, bid requests, bids, then render.' })] },
      { id: 's2', title: 'Other', questions: [sample('match', { id: 'c3', text: 'Match each term to its role.', pairs: [{ l: 'SSP', r: 'Sells publisher inventory' }, { l: 'DSP', r: 'Buys inventory for advertisers' }, { l: 'DMP', r: 'Stores audience data' }], explanation: 'Sell side, buy side, data.' }), sample('rating', { id: 'c4', text: 'How confident are you explaining header bidding?', scale: { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Very' } })] }] },
    { id: 'z_oct1', ago: 15, sections: [{ id: 's1', title: 'Multiple choice', questions: [
      sample('tf', { id: 'd1', text: 'A viewable display impression needs at least 50% of pixels in view for 1 continuous second.', correct: true, explanation: 'This is the MRC standard for display.' }),
      sample('mcq', { id: 'd2', text: 'Which line item type usually has the highest delivery priority in an ad server?', options: ['Sponsorship', 'House', 'Price priority', 'Bulk'], correct: 0, explanation: 'Sponsorship items are guaranteed and prioritised.' })] },
      { id: 's2', title: 'Opinion', questions: [sample('text', { id: 'd3', text: 'Media agencies are adding audit tools to monitor AI agents that buy media.', ask: 'Would you let an AI agent manage budgets autonomously? Explain.', strong: 'A clear position, the controls you would require (approval thresholds, spend caps, audit logs), and the trade-off you accept.' }), sample('text', { id: 'd4', text: 'Chrome is adding ways to measure ad overload.', ask: 'Would you reduce ad load if it cut impressions? Why or why not?', strong: 'A clear recommendation, the trade-off, and how you would test it.' })] }] },
    { id: 'z_oct2', ago: 1, live: true, autoSubmit: true, allowReview: true, sections: [
      { id: 's1', title: 'Multiple choice', intro: 'Trust your knowledge, think carefully, and choose wisely. Every answer counts!', questions: [
        sample('mcq', { id: 'e1', text: 'A publisher runs a campaign with a frequency cap of 3 impressions per day. The campaign already served 3 impressions for a particular user, but continues to serve the ads for the same user.', ask: 'What is the most likely reason for serving impressions for the same user even after reaching the FC?', options: ['The campaign can continue serving because every new ad request counts as a new user.', 'The campaign will automatically increase its CPM to compete for the next request.', 'The campaign will be eligible against the requests due to missing correlator value.', "The campaign will continue to serve if the user's cookies are disabled, though it is set with frequency capping."], correct: 2, explanation: '[Sample answer for the demo. The real explanation is written by the quiz creator.]' }),
        sample('mcq', { id: 'e2', text: 'A publisher has an eligible Standard line item that is "Behind schedule". Its rate is lower than the eligible Ad Exchange winning bid value.', ask: 'Conclude which line item will win and record the impressions considering the CPM values.', options: ['The AdX has higher CPM and always takes priority over every other line item type.', 'The Standard line item will serve as it is behind schedule and the Temp CPM value will automatically override any other competing campaigns rate.', 'Any campaign can be randomly served.', 'No, because Ad Exchange always wins whenever it has a valid bid.'], correct: 3, explanation: '[Sample answer for the demo. The real explanation is written by the quiz creator.]' })] },
      { id: 's2', title: 'Opinion', intro: "There's no right or wrong here. Share your genuine perspective.", questions: [
        sample('text', { id: 'e3', text: 'Media agencies are introducing audit tools to monitor AI agents involved in planning and buying media, particularly to identify excessive or unnecessary spending.', ask: 'Would you allow an AI agent to manage campaign budgets autonomously, or would you require human approval for certain decisions? Explain your reasoning.', strong: 'A clear position, the controls you would require (approval thresholds, spend caps, audit logs), and the trade-off you accept.' }),
        sample('text', { id: 'e4', text: 'Chrome is introducing additional ways to measure web ad overload, including ad count, density, weight, and resource usage. These measures can help publishers understand when advertising may negatively affect the user experience.', ask: 'If reducing ad density improves user experience but also reduces the number of available ad impressions, would you recommend that a publisher reduce its advertising load? Why or why not?', strong: 'A clear recommendation, the revenue versus experience trade-off, and how you would test it.' })] },
      { id: 's3', title: 'Analytical', intro: 'Take a moment to understand the question, connect the dots, and share your reasoning clearly.', questions: [
        sample('mcq', { id: 'e5', text: 'Five people, P, Q, R, S and T, are standing in a line. P is ahead of Q. Q is ahead of R. S is ahead of P. T is behind R.', ask: 'Who must be standing first in the line?', options: ['P', 'Q', 'R', 'S', 'Cannot be determined'], correct: 3, explanation: 'S is ahead of P, P is ahead of Q, Q is ahead of R, and T is behind R. That gives the order S, P, Q, R, T, so S is first.' })] }] }
  ];
  return sets.map((s) => {
    const opens = fromIst(...(() => { const p = istParts(now - s.ago * DAY); return [p.y, p.m, p.d, 10, 0]; })());
    const p = istParts(opens);
    const closes = fromIst(p.y, p.m, p.d + 2, 23, 59); const keyAt = fromIst(p.y, p.m, p.d + 4, 1, 0);
    const n = p.d <= 15 ? 1 : 2;
    const a = newQuiz({ opens, closes, keyAt }, 'creator@databeat.io');
    return { ...a, id: s.id, title: `R&D Quiz · ${monthName(opens)} ${yearOf(opens)} · ${n}`, headline: s.live ? 'Round 2 is live. Show what you know.' : '', autoSubmit: !!s.autoSubmit, allowReviewRequests: !!s.allowReview, sections: s.sections, live: !!s.live };
  });
}

function genAnswer(q, k, ok, r) {
  const wrongIdx = (n, c) => { let i = Math.floor(r() * n); if (i === c) i = (i + 1) % n; return i; };
  switch (q.type) {
    case 'mcq': case 'picture': return ok ? k.correct : wrongIdx(q.options.length, k.correct);
    case 'tf': return ok ? k.correct : !k.correct;
    case 'multi': return ok ? k.correct : [0];
    case 'order': return ok ? k.correct : [...k.correct].reverse();
    case 'match': return ok ? k.correct : { '0': 1, '1': 2, '2': 0 };
    case 'rating': return 1 + Math.floor(r() * 5);
    case 'text': return ok ? 'I would keep a human in the loop for large changes, set spend caps and audit logs, and let the agent act alone only on small, reversible decisions.' : 'It depends on the situation.';
    default: return null;
  }
}

export function buildDemo(now) {
  const D = {}; const rand = rng(42);
  D['settings/app'] = { leaderboardVisibility: 'leads', thresholds: [0, 20, 50, 100, 160], defaultMascots: ['robot'], integrations: { gas: false }, retention: 'forever', highlightDays: 5 };
  D['roles/lead@databeat.io'] = { role: 'lead', addedBy: CONFIG.bootstrapAdmin, addedAt: now };
  D['roles/creator@databeat.io'] = { role: 'creator', addedBy: CONFIG.bootstrapAdmin, addedAt: now };
  D['roles/admin.two@databeat.io'] = { role: 'admin', addedBy: CONFIG.bootstrapAdmin, addedAt: now };
  const users = [...PERSONAS.map((p) => ({ uid: p.uid, email: p.email, name: p.name })), ...NAMES.map((n, i) => ({ uid: 'u_s' + i, email: n.toLowerCase().replace(/[^a-z]/g, '.') + '@databeat.io', name: n, skill: 0.4 + rand() * 0.55 }))];
  users.forEach((u) => { D['users/' + u.uid] = { name: u.name, email: u.email, prefs: {} }; });
  const items = {}; const stats = {};
  quizSets(now).forEach((a) => {
    const { quiz, key } = toDocs(a);
    D['quizzes/' + a.id] = { ...quiz, published: true };
    const flags = { published: true };
    if (!a.live) {
      key.released = true; flags.released = true; flags.releasedAt = a.keyAt; flags.ops = { calcAt: a.closes, writtenAt: a.closes, reviewedAt: a.closes, backupAt: a.closes, announceAt: a.closes };
      const responses = []; const written = {};
      const qs = quiz.sections.flatMap((s) => s.questions);
      users.forEach((u, ui) => {
        const persona = ui < 4; if (!persona && rand() > 0.85) return; if (ui === 0 || ui === 2 || ui === 3 || ui === 1) { /* personas always take it */ }
        const skill = persona ? 0.8 : u.skill; const answers = {};
        qs.forEach((q) => { answers[q.id] = genAnswer(q, key.answers[q.id], rand() < skill, rand); });
        responses.push({ uid: u.uid, name: u.name, email: u.email, answers, submitted: true, quizId: a.id });
        qs.filter((q) => q.type === 'text').forEach((q) => { (written[q.id] = written[q.id] || {})[u.uid] = { score: Math.min(q.points, Math.round(rand() * skill * 4) / 2), feedback: 'Clear position. Add how you would measure the result.' }; });
      });
      responses.forEach((r) => { D[`responses/${a.id}_${r.uid}`] = { ...r, startedAt: a.opens + DAY, submittedAt: a.opens + DAY }; });
      Object.entries(written).forEach(([qid, scores]) => { D[`writtenScores/${a.id}_${qid}`] = { scores }; });
      const g = gradeQuiz({ quiz, key, responses, written, autoSubmit: false });
      g.rows.forEach((r) => {
        D[`myResults/${a.id}_${r.uid}`] = { uid: r.uid, quizId: a.id, total: r.total, max: r.max, rank: r.rank, count: g.rows.length, sections: r.sections, questions: r.questions, auto: r.auto };
        stats[r.uid] = stats[r.uid] || { history: {} };
        stats[r.uid].history[a.id] = { score: r.total, max: r.max, opens: a.opens, title: a.title };
      });
      D['resultsPublic/' + a.id] = g.pub;
      D['resultsFull/' + a.id] = { rows: g.rows.map((r) => ({ rank: r.rank, uid: r.uid, name: r.name, email: r.email, total: r.total, auto: r.auto, sections: r.sections })) };
      flags.submittedCount = g.rows.length; flags.avgScore = g.pub.avg;
    } else {
      key.released = false;
      users.slice(8, 20).forEach((u) => { D[`responses/${a.id}_${u.uid}`] = { uid: u.uid, quizId: a.id, name: u.name, email: u.email, answers: { e1: 2, e5: 3 }, submitted: true, startedAt: now - DAY / 2, submittedAt: now - DAY / 3 }; });
    }
    D['quizKeys/' + a.id] = key;
    items[a.id] = indexItem(a.id, a, flags);
  });
  D['quizIndex/main'] = { items };
  Object.entries(stats).forEach(([uid, s]) => { D['stats/' + uid] = s; });
  return D;
}
