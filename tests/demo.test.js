import { describe, it, expect } from 'vitest';
import { buildDemo } from '../src/lib/demoData.js';
import { createMemory } from '../src/lib/memory.js';
import { quizStatus } from '../src/lib/quizModel.js';

describe('demo data', () => {
  const now = Date.now(); const D = buildDemo(now);
  it('has a live quiz and released quizzes with results', () => {
    const items = D['quizIndex/main'].items; const st = Object.values(items).map((i) => quizStatus(i, now));
    expect(st.filter((s) => s === 'live').length).toBe(1); expect(st.filter((s) => s === 'released').length).toBe(4);
    expect(D['resultsPublic/z_oct1'].top.length).toBeGreaterThan(5);
    expect(D['myResults/z_oct1_u_participant'].total).toBeGreaterThan(0);
    expect(D['stats/u_participant'].history.z_sep2).toBeTruthy();
  });
  it('keeps the answer key private data separate and unreleased for the live quiz', () => {
    expect(D['quizKeys/z_oct2'].released).toBe(false); expect(JSON.stringify(D['quizzes/z_oct2'])).not.toMatch(/"correct"/);
  });
  it('memory backend supports dotted updates, merge, list and count', async () => {
    const m = createMemory();
    await m.set('x/a', { answers: { q1: 1 }, n: 1 }); await m.update('x/a', { 'answers.q2': 2 });
    expect((await m.get('x/a')).answers).toEqual({ q1: 1, q2: 2 });
    await m.set('x/a', { answers: { q3: 3 } }, true); expect((await m.get('x/a')).answers).toEqual({ q1: 1, q2: 2, q3: 3 });
    await m.set('x/b', { n: 2 }); expect(await m.count('x', { where: [['n', '==', 2]] })).toBe(1);
  });
});
