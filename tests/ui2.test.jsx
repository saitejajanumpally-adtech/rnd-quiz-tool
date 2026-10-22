import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import App from '../src/App.jsx';
import { store } from '../src/lib/store.js';
import * as ops from '../src/lib/ops.js';

const persona = async (name) => { fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) })); };
const go = async (h) => { await act(async () => { location.hash = h; }); };
beforeEach(async () => { await store.ready; await store.reset(); await store.auth.signOut(); localStorage.removeItem('arena-demo-persona'); sessionStorage.clear(); location.hash = '#/'; });

describe('welcome tour', () => {
  it('shows once on first sign-in, can be skipped, and can be replayed from the Menu', async () => {
    await store.update('users/u_participant', { prefs: {} });
    render(<App />); await persona('Priya');
    expect(await screen.findByRole('dialog', { name: /Welcome tour/ })).toBeTruthy();
    expect(screen.getByText('Welcome to R&D Quiz Arena')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start the tour' }));
    expect(await screen.findByText('Taking a quiz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Welcome tour/ })).toBeNull());
    await waitFor(async () => expect((await store.get('users/u_participant')).prefs.tourDone).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Menu/ })); fireEvent.click(screen.getByRole('menuitem', { name: 'Take the tour' }));
    expect(await screen.findByRole('dialog', { name: /Welcome tour/ })).toBeTruthy();
    // walk through to the last step
    fireEvent.click(screen.getByRole('button', { name: 'Start the tour' }));
    for (let i = 0; i < 4; i++) fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('That’s the tour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Welcome tour/ })).toBeNull());
  });
  it('does not show again for someone who finished it', async () => {
    render(<App />); await persona('Priya');
    expect(await screen.findByText(/Welcome back, Priya/)).toBeTruthy(); expect(screen.queryByRole('dialog', { name: /Welcome tour/ })).toBeNull();
  });
});

describe('arena', () => {
  it('shows the greeting, centered scorecards, the journey and a mascot picture, with no date filter', async () => {
    render(<App />); await persona('Priya');
    expect(await screen.findByText(/Welcome back, Priya/)).toBeTruthy();
    expect(screen.getByText('Current streak')).toBeTruthy(); expect(screen.getByText('Rounds completed')).toBeTruthy();
    expect(screen.getByText('Your learning journey')).toBeTruthy(); expect(screen.getByText(/Next milestone/)).toBeTruthy();
    const img = document.querySelector('img.mimg'); expect(img).toBeTruthy(); expect(img.getAttribute('src')).toMatch(/mascots\/bolt-ready\.webp$/);
    expect(screen.queryByText(/October 2026 · Round/)).toBeNull();
  });
  it('falls back to the wave pose, then to the drawn mascot, if a picture is missing', async () => {
    render(<App />); await persona('Priya');
    await screen.findByText(/Welcome back, Priya/);
    let img = document.querySelector('img.mimg'); fireEvent.error(img);
    img = await waitFor(() => { const i = document.querySelector('img.mimg'); expect(i.getAttribute('src')).toMatch(/bolt-wave\.webp$/); return i; });
    fireEvent.error(img);
    await waitFor(() => expect(document.querySelector('svg.mascot')).toBeTruthy());
  });
  it('hides mascots when the person chose Off', async () => {
    await store.update('users/u_participant', { prefs: { tourDone: true, mascotMode: 'off' } });
    render(<App />); await persona('Priya'); await screen.findByText(/Welcome back, Priya/);
    expect(document.querySelector('img.mimg')).toBeNull();
  });
});

describe('required questions and the finish flow', () => {
  async function makeRequired() {
    const q = await store.get('quizzes/z_oct2'); q.sections[0].questions[0].required = true; await store.set('quizzes/z_oct2', q);
  }
  it('blocks submitting until required questions are answered, and links to them', async () => {
    await makeRequired();
    render(<App />); await persona('Priya'); await go('#/quiz/z_oct2');
    expect(await screen.findByText('Required')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Review and submit/ })[0]);
    expect(await screen.findByText(/Answer these to submit/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit quiz' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Go to question/ }));
    const opt = await screen.findByRole('button', { name: /missing correlator/ }); fireEvent.click(opt);
    await waitFor(() => expect(screen.getByText(/Saved just now/)).toBeTruthy(), { timeout: 3000 });
    fireEvent.click(screen.getAllByRole('button', { name: /Review and submit/ })[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit quiz' }).disabled).toBe(false));
    expect(screen.queryByText(/Answer these to submit/)).toBeNull();
  });
  it('does not show the old "switching tabs" box', async () => {
    render(<App />); await persona('Priya'); await go('#/quiz/z_oct2');
    await screen.findByText(/Section 1/); expect(screen.queryByText(/Switching tabs is safe/)).toBeNull();
  });
  it('the submit dialog appears, Cancel keeps answers open, and nothing is submitted until confirmed', async () => {
    render(<App />); await persona('Priya'); await go('#/quiz/z_oct2');
    fireEvent.click((await screen.findAllByRole('button', { name: /Review and submit/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit quiz' }));
    const dlg = await screen.findByRole('dialog', { name: /Submit your answers/ });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await store.get('responses/z_oct2_u_participant'))).toBeNull();
  });
  it('shows a flat quiz as one list with no section headings', async () => {
    const now = Date.now();
    const { newQuiz, newQuestion } = await import('../src/lib/quizModel.js');
    const a = newQuiz({ opens: now - 1000, closes: now + 86400000, keyAt: now + 2 * 86400000 }, 'creator@databeat.io', {}, 'Charan'); a.id = 'z_flat'; a.title = 'Flat quiz';
    a.sections[0].questions = [{ ...newQuestion('tf', 'f1'), text: 'Is **this** flat?', correct: true }];
    await ops.saveQuiz(a, { email: 'creator@databeat.io', name: 'Charan' }, { publish: true });
    render(<App />); await persona('Priya'); await go('#/quiz/z_flat');
    expect(await screen.findByText('1 questions')).toBeTruthy(); expect(screen.queryByText(/Section 1/)).toBeNull();
    expect(screen.getByText('this').tagName).toBe('STRONG'); // formatting is shown, not the markers
    expect(screen.queryByText(/\*\*this\*\*/)).toBeNull();
  });
});

describe('quiz editor', () => {
  it('starts empty with a format picker, takes a Required question with formatting, and sections are optional', async () => {
    render(<App />); await persona('Sai Teja'); await go('#/edit/new');
    expect(await screen.findByText('Create quiz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /2 · Questions/ }));
    expect(await screen.findByText(/Start by choosing the format of your first question/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Written answer/ }));
    expect(await screen.findByText(/Question 1 · Written answer/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Required/ })).toBeTruthy(); fireEvent.click(screen.getByRole('switch', { name: /Required/ }));
    const box = screen.getAllByLabelText('Question').find((e) => e.tagName === 'TEXTAREA');
    fireEvent.change(box, { target: { value: 'Pick **one**' } });
    expect(await screen.findByText('Preview')).toBeTruthy();
    expect(screen.queryByText('Group questions into sections (optional)')).toBeNull(); // the picker is gone once a question exists
    fireEvent.click(screen.getByRole('button', { name: 'Add a section' }));
    expect(await screen.findByLabelText('Section 1 title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove sections, keep the questions' }));
    await waitFor(() => expect(screen.queryByLabelText('Section 1 title')).toBeNull());
    expect(screen.getByText(/Question 1 · Written answer/)).toBeTruthy();
  });
  it('Cancel leaves straight away when nothing changed, and asks first when something did', async () => {
    render(<App />); await persona('Sai Teja'); await go('#/edit/new'); await screen.findByText('Create quiz');
    fireEvent.change(screen.getByLabelText('Quiz name'), { target: { value: 'My quiz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dlg = await screen.findByRole('dialog', { name: /unsaved changes/ });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Keep editing' })); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(location.hash).toBe('#/manage'));
    await go('#/edit/new'); await screen.findByText('Create quiz'); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(location.hash).toBe('#/manage')); // nothing changed, so no question
  });
  it('new quizzes use the admin defaults, which are off, and there is no library switch', async () => {
    render(<App />); await persona('Sai Teja'); await go('#/edit/new'); await screen.findByText('Create quiz');
    fireEvent.click(screen.getByRole('button', { name: /3 · Schedule and settings/ }));
    expect(screen.getByRole('switch', { name: /Auto-submit/ }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: /Allow review requests/ }).getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/Show in the Quiz library/)).toBeNull();
  });
  it('a creator can open and edit a quiz someone else made', async () => {
    render(<App />); await persona('Charan'); await go('#/edit/z_oct2');
    expect(await screen.findByText('Edit quiz')).toBeTruthy(); expect(screen.queryByText(/can't edit this quiz/)).toBeNull();
  });
});

describe('leaderboards', () => {
  it('shows the Top 10 with movement, a Your round panel, and no full table underneath', async () => {
    render(<App />); await persona('Priya'); await go('#/leaderboard/z_oct1');
    expect(await screen.findByText('A little competition. A lot of learning.')).toBeTruthy();
    expect(screen.getByText('Your round')).toBeTruthy(); expect(screen.getByText('Score breakdown')).toBeTruthy();
    expect(screen.getByText(/Change is compared with the previous round/)).toBeTruthy();
    expect(document.querySelectorAll('.chip.mv').length).toBeGreaterThan(0);
    expect(screen.queryByText(/View full leaderboard/)).toBeNull(); // participants do not get the full view
    expect(screen.queryByText(/Leads and above · full leaderboard/)).toBeNull();
  });
  it('leads get a button to a separate full page, with the Rank change column and a fixed previous-round label', async () => {
    render(<App />); await persona('Lakshmi'); await go('#/leaderboard/z_oct1');
    fireEvent.click(await screen.findByRole('link', { name: /View full leaderboard/ }));
    expect(await screen.findByRole('heading', { name: 'Full leaderboard' })).toBeTruthy();
    expect(location.hash).toBe('#/leaderboard/z_oct1/full');
    expect(screen.getByText('Compared with: previous round')).toBeTruthy(); expect(screen.getByText('Rank change')).toBeTruthy();
    expect(screen.getByText('In both rounds')).toBeTruthy(); expect(screen.getByText('Multiple choice / 4')).toBeTruthy();
    expect(screen.queryByText(/All participants/)).toBeNull();
    expect(screen.queryByText(/\((lead|admin)\)/)).toBeNull(); // names only
  });
  it('keeps the full page away from participants', async () => {
    render(<App />); await persona('Priya'); await go('#/leaderboard/z_oct1/full');
    expect(await screen.findByText(/full leaderboard isn’t available to you/)).toBeTruthy();
  });
  it('hides movement when an admin turns it off', async () => {
    await store.set('settings/app', { showMovement: false }, true);
    render(<App />); await persona('Priya'); await go('#/leaderboard/z_oct1'); await screen.findByText('Your round');
    expect(document.querySelectorAll('.chip.mv').length).toBe(0); expect(screen.queryByText(/Change is compared/)).toBeNull();
  });
  it('greys the name of someone whose profile was removed', async () => {
    const top = (await store.get('resultsPublic/z_oct1')).top[0];
    await ops.removeMyProfile({ uid: top.uid }); 
    render(<App />); await persona('Priya'); await go('#/leaderboard/z_oct1');
    expect((await screen.findAllByText('Profile removed')).length).toBeGreaterThan(0);
  });
});

describe('removing a profile', () => {
  it('signs the person out, keeps their history, and reconnects it when they sign in again', async () => {
    render(<App />); await persona('Priya'); await go('#/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
    expect(screen.getByText(/can’t be changed here/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove my profile' })[0]);
    const dlg = await screen.findByRole('dialog', { name: /Remove your profile/ });
    expect(within(dlg).getByText(/Your answers, scores and results from past quizzes/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Remove my profile' }));
    expect(await screen.findByText(/Your profile was removed/)).toBeTruthy();
    expect((await store.get('users/u_participant')).deleted).toBe(true);
    expect((await store.get('myResults/z_oct1_u_participant')).total).toBeGreaterThan(0); // history is untouched
    await persona('Priya');
    await screen.findByText(/Welcome back, Priya/);
    expect((await store.get('users/u_participant')).deleted).toBe(false); expect((await ops.loadRemoved()).has('u_participant')).toBe(false);
  });
});

describe('answer key', () => {
  it('with "Show my answers" off, hides your answers, feedback and score but keeps the correct answers and strong-answer text', async () => {
    render(<App />); await persona('Priya'); await go('#/library/z_oct1');
    expect(await screen.findByText('Show my answers')).toBeTruthy(); expect(screen.getByText('Your score')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /Show my answers/ }));
    expect(screen.queryByText('Your score')).toBeNull(); expect(screen.queryByText(/YOUR ANSWER/)).toBeNull(); expect(screen.queryByText('Feedback on your answer')).toBeNull();
    expect(screen.getByText(/answers, feedback and written scores are hidden/)).toBeTruthy();
    expect(screen.getAllByText(/CORRECT ANSWER/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('What a strong answer covers').length).toBeGreaterThan(0);
  });
  it('says so when a written question has no model answer', async () => {
    const k = await store.get('quizKeys/z_oct1'); Object.values(k.answers).forEach((a) => { if ('strong' in a) a.strong = ''; }); await store.set('quizKeys/z_oct1', k);
    render(<App />); await persona('Priya'); await go('#/library/z_oct1');
    fireEvent.click(await screen.findByRole('switch', { name: /Show my answers/ }));
    expect((await screen.findAllByText(/No model answer was added/)).length).toBeGreaterThan(0);
  });
});

describe('manage quizzes, archive and admin settings', () => {
  it('lists who created each quiz, and only admins see Archive, Restore and Delete', async () => {
    render(<App />); await persona('Charan'); await go('#/manage');
    expect(await screen.findByText('Created by')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull(); expect(screen.queryByText(/Archived ·/)).toBeNull();
  });
  it('an admin archives a quiz, finds it under Archived, and restores it', async () => {
    render(<App />); await persona('Sai Teja'); await go('#/manage');
    const row = (await screen.findByText('R&D Quiz · ' + (await ops.loadIndex()).z_oct1.title.split('· ')[1] + '· 1', { exact: false })) ;
    expect(row).toBeTruthy();
    const archiveButtons = await screen.findAllByRole('button', { name: 'Archive' });
    fireEvent.click(archiveButtons[0]); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive quiz' }));
    await waitFor(async () => expect(Object.keys(await ops.loadArchivedIndex()).length).toBe(1));
    fireEvent.click(await screen.findByRole('button', { name: /Archived · 1/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(async () => expect(Object.keys(await ops.loadArchivedIndex()).length).toBe(0));
    expect(Object.keys(await ops.loadIndex()).length).toBe(5);
  });
  it('shows grouped settings and the user totals, and saves a change', async () => {
    render(<App />); await persona('Sai Teja'); await go('#/admin');
    expect(await screen.findByText('Admin settings')).toBeTruthy();
    expect(await screen.findByText('Total unique sign-ins')).toBeTruthy(); expect(screen.getByText('Signed in within the last 30 days')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Users CSV' })).toBeTruthy();
    expect(screen.getByText(/emails start going out once the email helper/)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Auto-submit default' }));
    await waitFor(async () => expect((await store.get('settings/app')).newQuizDefaults.autoSubmit).toBe(true));
  });
});

describe('written scoring panel', () => {
  const admin = { uid: 'u_admin', email: 'saiteja.janumpally@databeat.io', name: 'Sai Teja' };
  it('exports one self-contained file, then checks the upload in plain words and can round to half points', async () => {
    await store.update('responses/z_oct2_u_s9', { 'answers.e3': 'I would keep a human in the loop, set caps, and audit.', 'answers.e4': 'Yes, but test it first.' });
    await ops.setCloses('z_oct2', Date.now() - 1000, admin, 'x');
    let captured = null; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { captured = b; return 'blob:test'; };
    if (!File.prototype.text) File.prototype.text = function () { return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
    try {
      render(<App />); await persona('Sai Teja'); await go('#/manage/z_oct2');
      fireEvent.click(await screen.findByRole('button', { name: 'Export for scoring' }));
      await waitFor(() => expect(captured).toBeTruthy());
      const text = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(captured); });
      expect(text).toMatch(/SCORING INSTRUCTIONS/); expect(text).toContain('key,question_id,question,max_points,rubric,strong_answer,answer,score,feedback,flag'); expect(text).toContain('Score 0 to 2 in steps of 0.5');
      fireEvent.click(screen.getByRole('button', { name: 'What each column means' })); expect(await screen.findByText('Identifies the person and the question. If it changes, the row can’t be matched.')).toBeTruthy();
      const ex = await ops.exportWrittenFor('z_oct2'); const keys = Object.keys(ex.keys); expect(keys.length).toBe(2);
      const csv = `key,score,feedback,flag\n${keys[0]},0.75,"Clear, and specific.",\n${keys[1]},1,Good,yes\n`;
      fireEvent.change(screen.getByLabelText('Upload scored CSV'), { target: { files: [new File([csv], 'scored.csv', { type: 'text/csv' })] } });
      expect(await screen.findByText(/isn’t in steps of 0.5. Use 0.5 or 1/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Fix the file to continue' }).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /Round 1 score to the nearest 0.5/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save scores' }).disabled).toBe(false));
      fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
      await waitFor(async () => expect((await store.get('writtenScores/z_oct2_e3')).scores.u_s9.score).toBe(1), { timeout: 3000 });
      expect((await store.get('writtenScores/z_oct2_e3')).scores.u_s9.feedback).toBe('Clear, and specific.');
    } finally { URL.createObjectURL = orig; }
  });
});
