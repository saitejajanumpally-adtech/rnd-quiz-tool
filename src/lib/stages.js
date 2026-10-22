// The ad request funnel. Points are the sum of a person's quiz scores.
export const STAGES = ['Ad request', 'Bid', 'Win', 'Impression', 'Conversion'];
export const DEFAULT_THRESHOLDS = [0, 20, 50, 100, 160];

export function stageFor(points, thresholds = DEFAULT_THRESHOLDS) {
  let index = 0;
  thresholds.forEach((t, i) => { if (points >= t) index = i; });
  const last = index >= STAGES.length - 1;
  const next = last ? null : thresholds[index + 1];
  const span = last ? 1 : next - thresholds[index];
  const pct = last ? 1 : Math.min(1, Math.max(0, (points - thresholds[index]) / span));
  return { index, name: STAGES[index], nextName: last ? null : STAGES[index + 1], toNext: last ? 0 : Math.max(0, next - points), pct };
}

// history: { [quizId]: { score, max, opens, title } }; ordered: quiz index items sorted oldest to newest (closed or released only)
export function summarize(history = {}, orderedClosedIds = []) {
  const entries = Object.entries(history);
  const rounds = entries.length;
  const points = entries.reduce((a, [, h]) => a + (h.score || 0), 0);
  const avg = rounds ? points / rounds : 0;
  let streak = 0;
  for (let i = orderedClosedIds.length - 1; i >= 0; i--) {
    if (history[orderedClosedIds[i]]) streak++; else break;
  }
  return { rounds, points: Math.round(points * 2) / 2, avg, streak };
}
