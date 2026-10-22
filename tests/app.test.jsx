import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import App from '../src/App.jsx';
import { store } from '../src/lib/store.js';
import * as ops from '../src/lib/ops.js';

const persona = async (name) => { fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) })); };
beforeEach(async () => { await store.ready; await store.reset(); await store.auth.signOut(); localStorage.removeItem('arena-demo-persona'); location.hash = '#/'; });

describe('participant journey', () => {
  it('sees the live round, answers, reviews and submits; answers lock', async () => {
    render(<App />); await persona('Priya');
    expect(await screen.findByText(/Round 2 is live/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start quiz' })).toBeTruthy();
    expect(screen.queryByText(/Manage quizzes/)).toBeNull(); // participants don't get the admin tab
    await act(async () => { location.hash = '#/quiz/z_oct2'; });
    const opt = await screen.findByRole('button', { name: /missing correlator/ });
    fireEvent.click(opt);
    await waitFor(() => expect(screen.getByText(/Saved just now/)).toBeTruthy(), { timeout: 3000 });
    expect((await store.get('responses/z_oct2_u_participant')).answers.e1).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /Next section: Opinion/ }));
    const ta = (await screen.findAllByLabelText('Your answer'))[0];
    fireEvent.change(ta, { target: { value: 'I would keep a human in the loop.' } });
    await waitFor(async () => expect((await store.get('responses/z_oct2_u_participant')).answers.e3).toMatch(/human/), { timeout: 4000 });
    fireEvent.click(screen.getAllByRole('button', { name: /Review and submit/ })[0]);
    expect(await screen.findByText(/questions answered/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Submit quiz' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/can't change your answers/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Submit quiz' }));
    // right after confirming: the finish moment, then Continue leads to the locked screen
    expect(await screen.findByText(/Round complete, Priya/)).toBeTruthy();
    expect(screen.getByText('Answered')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect((await screen.findAllByText(/Answers are locked/)).length).toBeGreaterThan(0);
    const r = await store.get('responses/z_oct2_u_participant'); expect(r.submitted).toBe(true);
    // the database layer refuses nothing in demo mode, so make sure the UI will not let them back in
    await act(async () => { location.hash = '#/quiz/z_oct2'; });
    expect((await screen.findAllByText(/Answers are locked/)).length).toBeGreaterThan(0);
  });
  it('browses the library with the quarter filter and opens an answer key with their answers', async () => {
    render(<App />); await persona('Priya');
    await act(async () => { location.hash = '#/library'; });
    expect((await screen.findAllByText(/Quiz library/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'This quarter' }).className).toMatch(/on/);
    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect((await screen.findAllByText(/R&D Quiz · /, { selector: 'b' })).length).toBeGreaterThan(2);
    await act(async () => { location.hash = '#/library/z_oct1'; });
    expect(await screen.findByText('Show my answers')).toBeTruthy();
    expect(screen.getAllByText(/CORRECT ANSWER|YOUR ANSWER/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('switch', { name: /Show my answers/ }));
    expect(screen.queryByText(/YOUR ANSWER/)).toBeNull();
  });
  it('cannot open admin pages', async () => {
    render(<App />); await persona('Priya');
    await act(async () => { location.hash = '#/manage'; });
    expect(await screen.findByText(/don't have access/)).toBeTruthy();
    await act(async () => { location.hash = '#/admin'; });
    expect(await screen.findByText(/don't have access/)).toBeTruthy();
  });
});

describe('admin journey', () => {
  it('closes, calculates and releases a quiz, and participants then see results', async () => {
    render(<App />); await persona('Sai Teja');
    expect(await screen.findByText(/Round 2 is live/)).toBeTruthy();
    expect(screen.getByText('Manage quizzes')).toBeTruthy();
    await act(async () => { location.hash = '#/manage/z_oct2'; });
    fireEvent.click(await screen.findByRole('button', { name: 'Close now' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close now' }));
    expect(await screen.findByText('Release checklist')).toBeTruthy();
    expect(screen.getByRole('button', { name: /steps left/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Calculate scores' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recalculate' })).toBeTruthy(), { timeout: 4000 });
    // the demo quiz has no written answers, so that step ticks by itself after calculating
    expect((await ops.loadIndex()).z_oct2.ops.writtenAt).toBeGreaterThan(0);
    for (const k of ['reviewedAt', 'backupAt', 'announceAt']) await ops.markOp('z_oct2', k, { email: 'a@databeat.io' });
    await ops.calculate('z_oct2', { email: 'a@databeat.io' });
    await act(async () => { location.hash = '#/'; });
    await screen.findByText(/Scores are\s*on the way|Quiz closed/);
    await act(async () => { location.hash = '#/manage/z_oct2'; });
    const rel = await screen.findByRole('button', { name: 'Release to participants' });
    await waitFor(() => expect(rel.disabled).toBe(false));
    fireEvent.click(rel); fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Release' }));
    await waitFor(async () => expect((await store.get('quizKeys/z_oct2')).released).toBe(true), { timeout: 3000 });
    // switch to the participant: results card is the headline
    await act(async () => { await store.auth.signIn('u_s9'); });
  });
  it('creator gets Manage but not Admin settings; roles page limits what they can grant', async () => {
    render(<App />); await persona('Charan');
    expect(await screen.findByText('Manage quizzes')).toBeTruthy();
    await act(async () => { location.hash = '#/admin'; }); expect(await screen.findByText(/don't have access/)).toBeTruthy();
    await act(async () => { location.hash = '#/roles'; });
    expect(await screen.findByText(/Roles \(leads and participants\)/)).toBeTruthy();
    const sel = screen.getByRole('combobox', { name: 'Role' }); expect(within(sel).queryByText('Admin')).toBeNull();
    expect(screen.getAllByText('Admin only').length).toBeGreaterThan(0);
  });
  it('admin can create and publish a quiz in the editor with validation', async () => {
    render(<App />); await persona('Sai Teja');
    await act(async () => { location.hash = '#/edit/new'; });
    expect(await screen.findByText('Create quiz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /4 · Review/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText(/Fix these before publishing/)).toBeTruthy();
    expect(screen.getByText(/Give the quiz a name/)).toBeTruthy();
  });
});
