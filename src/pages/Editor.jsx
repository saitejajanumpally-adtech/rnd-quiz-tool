import React, { useEffect, useRef, useState } from 'react';
import { useApp, go } from '../ctx.jsx';
import * as ops from '../lib/ops.js';
import { newQuiz, newQuestion, validate, TYPES, uid, quizStatus, allQuestions, maxScore } from '../lib/quizModel.js';
import { suggestSchedule, toInputValue, fromInputValue, fmtDateTime } from '../lib/time.js';
import { Spinner, ErrorBox, useAsync, Switch } from '../components/ui.jsx';
import { Rich } from '../components/Rich.jsx';
import { applyFormat, safeUrl } from '../lib/richtext.js';

const HEADS = (n, topic) => [topic ? `${topic}: how sharp are you?` : '', `Round ${n} is live. Show what you know.`, 'A fresh round is open. Ready when you are?', 'New questions are in. Make them count.', `${topic ? topic + ' time. ' : ''}Show us what you've got.`].filter(Boolean);

function resizeImage(file, max = 640) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.7)); };
    img.onerror = () => rej(new Error('That file isn\'t a picture the browser can open.')); img.src = url;
  });
}
const List = ({ items, onChange, placeholder, minItems = 2 }) => (
  <div>{items.map((o, i) => <div className="row center" key={i} style={{ marginBottom: 8, flexWrap: 'nowrap' }}><input className="input" aria-label={`${placeholder} ${i + 1}`} placeholder={`${placeholder} ${i + 1}`} value={o} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} /><button className="btn sm" aria-label="Remove" disabled={items.length <= minItems} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button></div>)}<button className="btn sm" onClick={() => onChange([...items, ''])}>Add another</button></div>
);

// A text box with a small formatting bar: bold, italic, bullets and links. Stored as simple markers, shown formatted to participants.
function FormatField({ label, value, onChange, minHeight = 90 }) {
  const { ask, toast } = useApp(); const ref = useRef(null);
  const wrap = async (kind) => {
    const el = ref.current; if (!el) return; const start = el.selectionStart; const end = el.selectionEnd; let url;
    if (kind === 'link') {
      const u = await ask({ title: 'Add a link', input: { label: 'Web address, starting with https://', placeholder: 'https://', required: true }, ok: 'Add link' }); if (!u) return;
      url = safeUrl(u); if (!url) { toast('Enter an address that starts with https:// or http://', 'err'); return; }
    }
    const r = applyFormat(value || '', start, end, kind, url); onChange(r.value);
    requestAnimationFrame(() => { if (ref.current) { ref.current.focus(); ref.current.setSelectionRange(r.start, r.end); } });
  };
  const marked = /\*[^\s*]|\]\(https?:|^\s*[-•]\s/m.test(value || '');
  const Btn = ({ k, label, children }) => <button type="button" aria-label={label} title={label} onClick={() => wrap(k)}>{children}</button>;
  return (
    <div className="field mb"><label>{label}</label>
      <div className="fmt" role="toolbar" aria-label={`Formatting for ${label}`}><Btn k="bold" label="Bold"><b>B</b></Btn><Btn k="italic" label="Italic"><i>I</i></Btn><Btn k="bullet" label="Bulleted list">•≡</Btn><Btn k="link" label="Link">↗</Btn><span className="muted small">Bold, italics, bullet lists and links</span></div>
      <textarea ref={ref} className="textarea" aria-label={label} style={{ minHeight }} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {marked && <div className="rich-prev" aria-label="Preview"><div className="lab" style={{ marginBottom: 4 }}>Preview</div><Rich text={value} /></div>}
    </div>
  );
}
const FORMATS = [['mcq', 'A/B', 'One correct answer'], ['multi', 'A+B', 'Several correct answers'], ['tf', 'T/F', 'A statement to judge'], ['text', 'Aa', 'Scored with your rubric'], ['order', '1-2-3', 'Put items in the right order'], ['rating', '1-5', 'An opinion from 1 to 5'], ['match', 'A↔B', 'Connect each item'], ['picture', 'IMG', 'A question with an image']];
function FormatPicker({ onPick, onSection }) {
  return (
    <div><div className="fg2 mb">Start by choosing the format of your first question.</div>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>{FORMATS.map(([t, b, h]) => <button key={t} className="pick" style={{ flexDirection: 'row', textAlign: 'left', gap: 12, padding: 14, borderRadius: 12 }} onClick={() => onPick(t)}><span className="chip teal mono" style={{ minWidth: 46, textAlign: 'center', padding: '7px 8px', borderRadius: 8 }}>{b}</span><span><b style={{ display: 'block', fontWeight: 500 }}>{TYPES[t]}</b><span className="muted small">{h}</span></span></button>)}</div>
      <div className="row between center" style={{ marginTop: 18, padding: 14, border: '1px dashed var(--border2)', borderRadius: 12 }}><div><div style={{ fontWeight: 500 }}>Group questions into sections (optional)</div><div className="muted small">Only needed when the quiz has parts, like Multiple choice then Opinion.</div></div><button className="btn sm s" onClick={onSection}>Add a section</button></div>
    </div>
  );
}

function QuestionEditor({ q, onChange, onRemove, onMove, n, locked }) {
  const { toast } = useApp(); const set = (patch) => onChange({ ...q, ...patch });
  const optsWithCorrect = (multi) => (
    <div>{q.options.map((o, i) => <div className="row center" key={i} style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
      <input type={multi ? 'checkbox' : 'radio'} aria-label={`Option ${i + 1} is correct`} name={'c' + q.id} checked={multi ? q.correct.includes(i) : q.correct === i} onChange={() => set({ correct: multi ? (q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i]) : i })} />
      <input className="input" aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
      <button className="btn sm" disabled={q.options.length <= 2} onClick={() => set({ options: q.options.filter((_, j) => j !== i), correct: multi ? q.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) : (q.correct === i ? 0 : q.correct > i ? q.correct - 1 : q.correct) })}>Remove</button></div>)}
      <button className="btn sm" onClick={() => set({ options: [...q.options, ''] })}>Add option</button><span className="muted small" style={{ marginLeft: 10 }}>{multi ? 'Tick every correct option.' : 'Select the correct option.'} You can use **bold** and *italic* in options.</span></div>
  );
  return (
    <fieldset disabled={locked} style={{ border: '1px solid var(--border2)', borderRadius: 12, padding: 16, margin: '0 0 14px', background: 'var(--bg1)' }}>
      <legend style={{ padding: '0 8px' }} className="eyebrow">Question {n} · {TYPES[q.type]}</legend>
      <Switch on={!!q.required} onChange={(v) => set({ required: v })} title="Required" sub="Participants can’t submit the quiz until this question is answered." />
      <FormatField label="Question" value={q.text} onChange={(v) => set({ text: v })} minHeight={90} />
      <FormatField label="What to ask (optional second line)" value={q.ask} onChange={(v) => set({ ask: v })} minHeight={46} />
      {(q.type === 'mcq' || q.type === 'picture') && <>{q.type === 'picture' && <div className="mb"><input type="file" accept="image/*" aria-label="Choose a picture" onChange={async (e) => { try { const d = await resizeImage(e.target.files[0]); if (d.length > 300000) { toast('That picture is too large even after shrinking. Try a simpler one.', 'err'); return; } set({ image: d }); } catch (er) { toast(er.message, 'err'); } }} />{q.image && <img src={q.image} alt="Preview" style={{ display: 'block', maxHeight: 160, marginTop: 8, borderRadius: 8 }} />}<div className="muted small" style={{ marginTop: 4 }}>Pictures are shrunk and stored with the question.</div></div>}{optsWithCorrect(false)}</>}
      {q.type === 'multi' && <>{optsWithCorrect(true)}<Switch on={q.partial} onChange={(v) => set({ partial: v })} title="Give partial credit" sub="Points for each correct pick, minus wrong picks" /></>}
      {q.type === 'tf' && <div className="seg"><button className={q.correct ? 'on' : ''} onClick={() => set({ correct: true })}>Correct answer: True</button><button className={!q.correct ? 'on' : ''} onClick={() => set({ correct: false })}>Correct answer: False</button></div>}
      {q.type === 'order' && <><div className="muted small mb">List the items in the correct order. They are shuffled for participants.</div><List items={q.options} onChange={(options) => set({ options })} placeholder="Item" /></>}
      {q.type === 'match' && <><div className="muted small mb">Enter each pair. The right side is shuffled for participants.</div>{q.pairs.map((p, i) => <div className="row center" key={i} style={{ marginBottom: 8, flexWrap: 'nowrap' }}><input className="input" aria-label={`Left ${i + 1}`} placeholder="Left" value={p.l} onChange={(e) => set({ pairs: q.pairs.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)) })} /><input className="input" aria-label={`Right ${i + 1}`} placeholder="Matches with" value={p.r} onChange={(e) => set({ pairs: q.pairs.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)) })} /><button className="btn sm" disabled={q.pairs.length <= 2} onClick={() => set({ pairs: q.pairs.filter((_, j) => j !== i) })}>Remove</button></div>)}<button className="btn sm" onClick={() => set({ pairs: [...q.pairs, { l: '', r: '' }] })}>Add pair</button></>}
      {q.type === 'rating' && <div className="row"><div className="field"><label>Lowest</label><input className="input" type="number" min="0" max="10" style={{ width: 90 }} value={q.scale.min} onChange={(e) => set({ scale: { ...q.scale, min: Number(e.target.value) } })} /></div><div className="field"><label>Highest</label><input className="input" type="number" min="1" max="10" style={{ width: 90 }} value={q.scale.max} onChange={(e) => set({ scale: { ...q.scale, max: Number(e.target.value) } })} /></div><div className="field grow"><label>Label for lowest</label><input className="input" value={q.scale.minLabel} onChange={(e) => set({ scale: { ...q.scale, minLabel: e.target.value } })} /></div><div className="field grow"><label>Label for highest</label><input className="input" value={q.scale.maxLabel} onChange={(e) => set({ scale: { ...q.scale, maxLabel: e.target.value } })} /></div><div className="muted small" style={{ width: '100%' }}>Rating questions are polls. They are not scored.</div></div>}
      {q.type === 'text' && <div className="col" style={{ gap: 12 }}><div className="field"><label>Scoring rubric (the same one you give Claude)</label><textarea className="textarea" value={q.rubric} onChange={(e) => set({ rubric: e.target.value })} /></div><FormatField label="What a strong answer covers (shown after release)" value={q.strong} onChange={(v) => set({ strong: v })} minHeight={70} /><div className="muted small">Written answers are scored in steps of 0.5, from 0 up to the points below.</div></div>}
      {q.type !== 'text' && q.type !== 'rating' && <div style={{ marginTop: 12 }}><FormatField label="Explanation (shown after release)" value={q.explanation} onChange={(v) => set({ explanation: v })} minHeight={60} /></div>}
      <div className="row between center" style={{ marginTop: 12 }}><div className="field" style={{ width: 120 }}><label>Points</label><input className="input" type="number" min="0" step="0.5" disabled={q.type === 'rating'} value={q.type === 'rating' ? 0 : q.points} onChange={(e) => set({ points: Number(e.target.value) })} /></div><div className="row"><button className="btn sm" aria-label="Move question up" onClick={() => onMove(-1)}>↑</button><button className="btn sm" aria-label="Move question down" onClick={() => onMove(1)}>↓</button><button className="btn sm danger" onClick={onRemove}>Delete question</button></div></div>
    </fieldset>
  );
}

export default function Editor({ id }) {
  const { user, role, index, now, toast, ask, reload, settings } = useApp(); const isNew = id === 'new'; const [leaving, setLeaving] = useState(false);
  const [a, setA] = useState(null); const [step, setStep] = useState(1); const [errs, setErrs] = useState([]); const [busy, setBusy] = useState(false); const [h, setH] = useState(0); const [dirty, setDirty] = useState(false);
  const { loading, error } = useAsync(async () => {
    if (isNew) { const s = suggestSchedule(index, now); const q = newQuiz(s, user.email, settings.newQuizDefaults, user.name); const n = Object.values(index).filter((i) => new Date(i.opens).getUTCMonth() === new Date(s.opens).getUTCMonth()).length + 1; setA({ ...q, headline: HEADS(n, '')[0] }); return null; }
    const x = await ops.loadAuthoring(id); setA(x); return x;
  }, [id]);
  useEffect(() => { const f = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, [dirty]);
  if (error) return <div className="mt"><ErrorBox error={error} /></div>; if (loading || !a) return <Spinner />;
  const item = index[a.id]; const st = item ? quizStatus(item, now) : 'draft'; const can = isNew || ops.canEditQuiz(role);
  const questionsLocked = !!item && item.published && now >= item.opens;
  if (!can) return <div className="card mt"><div className="h3" style={{ marginBottom: 6 }}>You can't edit this quiz</div><div className="fg2">Only creators and admins can edit quizzes. <a href="#/manage">Back to Manage quizzes</a></div></div>;
  const upd = (patch) => { setA((x) => ({ ...x, ...patch })); setDirty(true); };
  const updSec = (si, patch) => upd({ sections: a.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) });
  const updQ = (si, qi, q) => updSec(si, { questions: a.sections[si].questions.map((x, i) => (i === qi ? q : x)) });
  const move = (arr, i, d) => { const n = [...arr]; const t = i + d; if (t < 0 || t >= n.length) return n; [n[i], n[t]] = [n[t], n[i]]; return n; };
  const leave = () => { if (!dirty) { go('/manage'); return; } setLeaving(true); };
  const save = async (publish, opts = {}) => {
    const e = publish || step === 4 ? validate(a) : []; setErrs(e);
    if (publish && e.length) { toast('Fix the highlighted problems first.', 'err'); setStep(4); return; }
    if (!a.title.trim()) { toast('Give the quiz a name before saving.', 'err'); setStep(1); return; }
    if (publish && !(await ask({ title: 'Publish this quiz?', body: `It opens ${fmtDateTime(a.opens)} and closes ${fmtDateTime(a.closes)}. Participants can see it from the opening time.`, ok: 'Publish' }))) return;
    setBusy(true);
    try { await ops.saveQuiz(a, user, { publish }); setDirty(false); await reload(); toast(publish ? 'Published.' : (item && item.published && step === 4 ? 'Changes saved.' : 'Draft saved.')); if (publish) { try { sessionStorage.setItem('arena-published', a.id); } catch (e) { /* only a nicety */ } go('/manage/' + a.id); } else if (opts.leave || step === 4) go('/manage'); }
    catch (er) { toast('Couldn\'t save. ' + (er.message || ''), 'err'); } setBusy(false);
  };
  const steps = ['1 · Basics', '2 · Questions', '3 · Schedule and settings', '4 · Review'];
  const topic = a.topic;
  const addQ = (si, type) => updSec(si, { questions: [...a.sections[si].questions, newQuestion(type, uid())] });
  const flat = a.sections.length === 1 && !!a.sections[0].flat;
  const groupIntoSections = () => upd({ sections: a.sections.map((x) => ({ ...x, flat: false, title: x.title || 'Section 1' })) });
  const addSection = () => upd({ sections: [...a.sections, { id: uid('s'), title: `Section ${a.sections.length + 1}`, flat: false, intro: '', timerMin: 0, questions: [] }] });
  const delSection = (si) => { const left = a.sections.filter((_, i) => i !== si); upd({ sections: left.length ? left : [{ id: uid('s'), title: '', flat: true, intro: '', timerMin: 0, questions: [] }] }); };
  const ungroup = async () => { if (a.sections.length > 1 && !(await ask({ title: 'Remove the sections?', body: 'Every question stays, in one list. Section titles and introductions are removed.', ok: 'Remove sections', danger: true }))) return; upd({ sections: [{ id: a.sections[0].id, title: '', flat: true, intro: '', timerMin: 0, questions: a.sections.flatMap((x) => x.questions) }] }); };
  return (
    <div className="pan mt" style={{ maxWidth: 940, margin: '28px auto 0' }}>
      <div className="row between center mb" style={{ alignItems: 'flex-end' }}><div><a href="#/manage" onClick={(e) => { e.preventDefault(); leave(); }}>← Back to Manage quizzes</a><div className="h2" style={{ marginTop: 8 }}>{isNew ? 'Create quiz' : 'Edit quiz'}</div></div><div className="row center" style={{ gap: 14 }}><span className="muted small">{dirty ? 'Unsaved changes' : 'No changes yet'}</span><button className="btn sm" onClick={leave}>Cancel</button></div></div>
      {questionsLocked && <div className="banner warn"><span>This quiz has opened, so questions are locked. You can still change the close time and messages.</span></div>}
      <div className="steps" style={{ marginTop: 16 }}>{steps.map((l, i) => <button key={l} className={'btn sm ' + (step === i + 1 ? 's' : '')} aria-current={step === i + 1} onClick={() => setStep(i + 1)}>{l}</button>)}</div>
      <div className="card" style={{ padding: 26 }}>
        {step === 1 && <div className="col" style={{ gap: 16 }}><div className="h3">Basics</div>
          <div className="row"><div className="field grow" style={{ flex: '1 1 300px' }}><label htmlFor="t">Quiz name</label><input id="t" className="input" value={a.title} placeholder="R&D Quiz · November 2026 · 1" onChange={(e) => upd({ title: e.target.value })} /></div><div className="field grow" style={{ flex: '1 1 220px' }}><label htmlFor="tp">Topic (optional)</label><input id="tp" className="input" value={a.topic} placeholder="Header bidding" onChange={(e) => upd({ topic: e.target.value })} /></div></div>
          <div className="field"><label htmlFor="hd">Headline on the home screen</label><div className="row center" style={{ flexWrap: 'nowrap' }}><input id="hd" className="input" value={a.headline} onChange={(e) => upd({ headline: e.target.value })} /><button className="btn sm s" style={{ whiteSpace: 'nowrap' }} onClick={() => { const list = HEADS(Object.keys(index).length + 1, topic); upd({ headline: list[h % list.length] }); setH(h + 1); }}>Suggest another</button></div><div className="muted small" style={{ marginTop: 6 }}>Suggested for every quiz from the quiz number and topic. Edit it freely.</div></div>
        </div>}
        {step === 2 && <div><div className="h3 mb">Questions</div>
          {flat && a.sections[0].questions.length === 0 && !questionsLocked && <FormatPicker onPick={(t) => addQ(0, t)} onSection={groupIntoSections} />}
          {(!flat || a.sections[0].questions.length > 0) && a.sections.map((s, si) => (
            <div key={s.id} style={{ marginBottom: 26 }}>
              {!flat && <><div className="row center between" style={{ marginBottom: 10 }}><div className="row center" style={{ flexWrap: 'nowrap', flex: 1 }}><span className="lab">Section {si + 1}</span><input className="input" aria-label={`Section ${si + 1} title`} style={{ maxWidth: 320 }} value={s.title} disabled={questionsLocked} onChange={(e) => updSec(si, { title: e.target.value })} /><div className="field" style={{ width: 130 }}><input className="input" type="number" min="0" aria-label="Section timer in minutes" placeholder="Timer (min)" value={s.timerMin || ''} disabled={questionsLocked} onChange={(e) => updSec(si, { timerMin: Number(e.target.value) })} /></div></div>
                <div className="row"><button className="btn sm" disabled={questionsLocked} onClick={() => upd({ sections: move(a.sections, si, -1) })}>↑</button><button className="btn sm" disabled={questionsLocked} onClick={() => upd({ sections: move(a.sections, si, 1) })}>↓</button><button className="btn sm danger" disabled={questionsLocked} onClick={() => delSection(si)}>Delete section</button></div></div>
              <div className="field mb"><input className="input" aria-label="Section introduction" placeholder="Short introduction shown at the top of the section (optional)" disabled={questionsLocked} value={s.intro} onChange={(e) => updSec(si, { intro: e.target.value })} /></div></>}
              {s.questions.map((q, qi) => <QuestionEditor key={q.id} q={q} n={qi + 1} locked={questionsLocked} onChange={(x) => updQ(si, qi, x)} onRemove={() => updSec(si, { questions: s.questions.filter((_, i) => i !== qi) })} onMove={(d) => updSec(si, { questions: move(s.questions, qi, d) })} />)}
              {!questionsLocked && <div><div className="muted small" style={{ marginBottom: 8 }}>{flat ? 'Add a question' : 'Add a question to this section'}</div><div className="row" style={{ gap: 8 }}>{Object.entries(TYPES).map(([t, l]) => <button key={t} className="btn sm" onClick={() => addQ(si, t)}>{l}</button>)}</div></div>}
            </div>))}
          {!questionsLocked && flat && a.sections[0].questions.length > 0 && <div className="row between center" style={{ padding: 14, border: '1px dashed var(--border2)', borderRadius: 12 }}><span className="fg2">Want headings? Group these into sections.</span><button className="btn sm s" onClick={groupIntoSections}>Add a section</button></div>}
          {!questionsLocked && !flat && <div className="row" style={{ gap: 10 }}><button className="btn s" onClick={addSection}>Add section</button><button className="btn sm" onClick={ungroup}>Remove sections, keep the questions</button></div>}
        </div>}
        {step === 3 && <div className="col" style={{ gap: 18 }}><div className="h3">Schedule and settings</div>
          <div className="muted">Rounds repeat every second Tuesday, so these dates follow that. Change them for holidays or special rounds. All times are IST.</div>
          <div className="row">{[['opens', 'Opens'], ['closes', 'Closes'], ['keyAt', 'Answer key release (planned)']].map(([k, l]) => <div className="field" key={k} style={{ flex: '1 1 220px' }}><label htmlFor={k}>{l}</label><input id={k} className="input" type="datetime-local" disabled={k === 'opens' && questionsLocked} value={a[k] ? toInputValue(a[k]) : ''} onChange={(e) => upd({ [k]: fromInputValue(e.target.value) })} /></div>)}</div>
          <div><div className="lab" style={{ marginBottom: 4 }}>Quiz settings</div>
            <Switch on={a.autoSubmit} onChange={(v) => upd({ autoSubmit: v })} title="Auto-submit saved answers at close" sub="Anyone with at least one saved answer counts as submitted when the quiz closes. Off by default." />
            <Switch on={a.allowReviewRequests} onChange={(v) => upd({ allowReviewRequests: v })} title="Allow review requests" sub="Participants can ask a creator or admin to re-check a written-answer score. Off by default." />
            <div className="muted small" style={{ marginTop: 10 }}>A quiz appears in the Quiz library once it is published. The answer key and scores stay hidden until you release them from Manage quizzes.</div></div>
          <div className="field"><label htmlFor="am">Announcement message (Chat post and email draft). Placeholders: {'{quiz_name} {link} {open_time} {close_time} {key_time}'}</label><textarea id="am" className="textarea" value={a.announceMsg} onChange={(e) => upd({ announceMsg: e.target.value })} /></div>
          <div className="field"><label htmlFor="rm">Release message</label><textarea id="rm" className="textarea" style={{ minHeight: 80 }} value={a.releaseMsg} onChange={(e) => upd({ releaseMsg: e.target.value })} /></div>
        </div>}
        {step === 4 && <div><div className="h3 mb">Review</div>
          {errs.length > 0 && <div className="banner warn" role="alert" style={{ display: 'block', marginBottom: 14 }}><b style={{ fontWeight: 500 }}>Fix these before publishing:</b>{errs.map((e, i) => <div key={i}>• {e}</div>)}</div>}
          {[['Quiz', a.title || '(no name)'], ['Headline', a.headline], ['Questions', `${allQuestions({ sections: a.sections }).length} questions${flat ? '' : ' in ' + a.sections.length + ' sections'} · ${maxScore({ sections: a.sections })} points`], ['Opens', a.opens ? fmtDateTime(a.opens) : '–'], ['Closes', a.closes ? fmtDateTime(a.closes) : '–'], ['Auto-submit', a.autoSubmit ? 'On' : 'Off'], ['Review requests', a.allowReviewRequests ? 'On' : 'Off']].map(([k, v]) => <div key={k} className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}><span className="fg2">{k}</span><span style={{ textAlign: 'right' }}>{v}</span></div>)}
          <div className="row" style={{ marginTop: 18 }}><button className="btn" disabled={busy} onClick={() => save(false)}>Save draft</button>{st !== 'released' && !(item && item.published) && <button className="btn p" disabled={busy} onClick={() => save(true)}>Publish</button>}{item && item.published && <button className="btn p" disabled={busy} onClick={() => save(false)}>Save changes</button>}</div>
        </div>}
        <div className="row between" style={{ marginTop: 22 }}><button className="btn" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</button><div className="row">{step < 4 && <button className="btn" disabled={busy} onClick={() => save(false)}>Save draft</button>}{step < 4 && <button className="btn p" onClick={() => setStep(step + 1)}>Next</button>}</div></div>
      </div>
      {leaving && <div className="modal-bg" onClick={() => setLeaving(false)}><div className="modal" role="dialog" aria-modal="true" aria-label="You have unsaved changes" onClick={(e) => e.stopPropagation()}><div className="h3" style={{ marginBottom: 8 }}>You have unsaved changes</div><div className="fg2" style={{ marginBottom: 16 }}>Save a draft, leave without saving, or keep editing.</div><div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setLeaving(false)}>Keep editing</button><button className="btn sm danger" onClick={() => { setDirty(false); go('/manage'); }}>Discard changes</button><button className="btn sm p" disabled={busy} onClick={() => { setLeaving(false); save(false, { leave: true }); }}>Save draft</button></div></div></div>}
    </div>
  );
}
