import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Tests always run on the in-memory demo backend, never the live database,
// even though src/config.js holds the real Firebase key.
vi.mock('./config.js', async (importOriginal) => {
  const m = await importOriginal();
  return { ...m, CONFIG: { ...m.CONFIG, firebase: { ...m.CONFIG.firebase, apiKey: '' } }, DEMO: true };
});

afterEach(() => cleanup());
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
