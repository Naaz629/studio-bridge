'use strict';
/* Concept Development: five "concept check" questions climbing Bloom's taxonomy.
   Inputs: the week's learning outcome (already decided per week) and the slide before the activity,
   including the text read from that slide when it was uploaded (see slides.js).
   Question types mirror a real concept check: multiple choice, 1-5 confidence scale, open answer.
   The questions are drafts: the tutor can edit every part, or regenerate them. */

const LEVELS = [
  { k: 'identify', label: 'Identify & explain', note: 'Checks foundational and conceptual understanding.' },
  { k: 'apply', label: 'Apply', note: 'Checks practical application.' },
  { k: 'analyse', label: 'Analyse', note: 'Checks evidence interpretation.' },
  { k: 'evaluate', label: 'Evaluate', note: 'Checks judgement and justification.' },
  { k: 'create', label: 'Create', note: 'Demonstrates application of the overall outcome.' }
];
const TYPE_NAMES = { mc: 'Multiple choice', scale: '1–5 scale', open: 'Open answer' };
const STOP = new Set('about above after again also because before being between both could does each from have here into just like make more most much must only other over same should some such than that their them then there these they this those through under very want were what when where which while will with would your students student slide slides week tutorial lecture'.split(' '));

const hash = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffled = (arr, seed) => { const r = seeded(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function cleanTopic(t) {
  return String(t || '')
    .replace(/^Week\s*\d+\s*[:\-–]?\s*/i, '')
    .replace(/^(Tutorial|Masterclass|Lecture)\s*[:\-–]\s*/i, '')
    .replace(/\.(pdf|pptx?|key|png|jpe?g|webp)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---- reading the slide text ---- */
function sentencesOf(text) {
  return String(text || '').split(/\n+|(?<=[.!?])\s+/)
    .map(s => s.trim().replace(/^[•\-–·*\d.)\s]+/, '').trim())
    .filter(s => s.split(/\s+/).length >= 4 && s.length >= 20 && s.length <= 190);
}
function termsOf(text, n = 5) {
  const freq = {};
  for (const w of String(text || '').toLowerCase().match(/[a-z][a-z'-]{4,}/g) || []) if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map(e => e[0]);
}

/* the outcomes of the live week; the AI decides which one a slide teaches (see aiBuildCD) */
function weekOuts(s) {
  const W = s.weeks[s.liveWeek] || Object.values(s.weeks)[0], seen = new Map();
  Object.values(W.sessions).forEach(ss => ss.outs.forEach(o => { if (!seen.has(o.lo)) seen.set(o.lo, o); }));
  return [...seen.values()];
}

/* ---- context: the outcome the slide belongs to + the slide before the activity ---- */
function cdContext(s, pos) {
  const f = flowOf(s), sl = slidesFor(s);
  let slide = null, idx = -1;
  for (let p = pos - 1; p >= 0; p--) if (f[p].k === 's') { idx = Math.min(f[p].i, sl.length - 1); slide = sl[idx]; break; }
  const outs = weekOuts(s), o = outs[0], out = o.out;
  // read every slide shown before the activity, in order, so the questions cover the whole lesson so far
  const seenIdx = [...new Set(f.slice(0, pos).filter(x => x.k === 's').map(x => Math.min(x.i, sl.length - 1)))];
  const per = Math.max(400, Math.floor(5600 / Math.max(1, seenIdx.length)));
  const text = seenIdx.map(i => sl[i]).filter(x => x && x.text).map((x, n) => 'Slide ' + (seenIdx.indexOf(sl.indexOf(x)) + 1) + ' - ' + cleanTopic(x.title || x.t) + String.fromCharCode(10) + x.text.slice(0, per)).join(String.fromCharCode(10, 10));
  const title = cleanTopic(slide ? (slide.title || slide.t) : (s.topics[s.liveWeek] || [''])[0]) || 'this week\'s topic';
  // sentences from the rest of the deck serve as believable wrong answers
  const others = [];
  sl.forEach((x, i) => { if (!seenIdx.includes(i) && x.text) others.push(...sentencesOf(x.text)); });
  const asked = [...(s.qs || [])].sort((a, b) => b.up - a.up).slice(0, 6).map(q => ({ text: q.tr || q.text, count: q.up }));
  return {
    asked, outs: outs.map(x => ({ lo: x.lo, out: x.out })),
    topic: title, title, text, hasText: sentencesOf(text).length > 0,
    slideNo: idx >= 0 ? idx + 1 : null,
    source: idx >= 0 ? `Slide ${idx + 1} · ${title}` : title,
    others, lo: o.lo, out, loAction: out.charAt(0).toLowerCase() + out.slice(1)
  };
}

/* ---- question builders ---- */
/* ---- the questions are written by an AI model only: there are no template questions ---- */
const wordCount = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
function normaliseAI(raw, ctx) {
  if (!Array.isArray(raw) || raw.length < 5) return null;
  const qs = [];
  for (let i = 0; i < 5; i++) {
    const r = raw[i] || {}, text = String(r.text || '').trim();
    const type = ['mc', 'scale', 'open'].includes(r.type) ? r.type : null;
    if (!text || !type || wordCount(text) > 45) return null;
    const q = { level: LEVELS[i].k, label: LEVELS[i].label, note: LEVELS[i].note, source: ctx.source, type, text };
    if (type === 'mc') {
      const opts = (Array.isArray(r.options) ? r.options : []).map(o => ({ t: String((o && o.t) || '').trim(), ok: !!(o && o.ok) })).filter(o => o.t).slice(0, 4);
      if (opts.length < 3 || !opts.some(o => o.ok) || opts.some(o => wordCount(o.t) > 32)) return null;
      let seen = false; opts.forEach(o => { if (o.ok && seen) o.ok = false; if (o.ok) seen = true; });
      q.options = opts;
    } else if (type === 'scale') {
      q.lo = String(r.lo || 'Not yet').trim().slice(0, 24); q.hi = String(r.hi || 'Very sure').trim().slice(0, 24);
    } else q.hint = String(r.hint || '').trim().slice(0, 90);
    qs.push(q);
  }
  return qs;
}
/* ---- ready-made question sets: written ahead of time with the AI writer so the concept check appears at once ---- */
const READY_SETS = [{"re":"evaluat|good look|criteria|rubric|success","qs":[{"type":"mc","text":"Which statement best describes what a project evaluation criterion is?","options":[{"t":"A clear standard you judge the project against, agreed before you look at results.","ok":true},{"t":"A personal opinion about which design looks best.","ok":false},{"t":"A list of tasks the team has finished so far.","ok":false},{"t":"A grade the tutor gives at the end of semester.","ok":false}]},{"type":"open","text":"Pick one criterion you would use to judge your own project. Why does it matter for your client?","hint":"I would judge my project by... because..."},{"type":"mc","text":"A team says their project is \"good\" because they like it. What is missing?","options":[{"t":"Evidence and criteria that someone else could check.","ok":true},{"t":"More colour and polish in the final visuals.","ok":false},{"t":"A longer presentation with more slides.","ok":false},{"t":"A bigger team to vote on the result.","ok":false}]},{"type":"scale","text":"How confident are you that your current criteria would convince an outside reviewer?","lo":"Not yet","hi":"Very sure"},{"type":"open","text":"Write two criteria and one piece of evidence for each that would show your project meets them.","hint":"Criterion 1: ... Evidence: ..."}]},{"re":"ideat|brainstorm|diverge|concept","qs":[{"type":"mc","text":"What is the main purpose of ideation in a design process?","options":[{"t":"To generate many different options before choosing one to develop.","ok":true},{"t":"To pick the first good idea and start building.","ok":false},{"t":"To check the budget before any sketching.","ok":false},{"t":"To present the finished solution to the client.","ok":false}]},{"type":"open","text":"Describe one idea you came up with this week and the problem it answers.","hint":"My idea is... it helps... because..."},{"type":"mc","text":"Two teams ideated. One produced 40 varied ideas, the other 5 similar ones. Which is likely to find a stronger solution?","options":[{"t":"The first team, because variety gives more to compare and combine.","ok":true},{"t":"The second team, because fewer ideas means more focus.","ok":false},{"t":"Neither, because quantity never matters.","ok":false},{"t":"The second team, because similar ideas are safer.","ok":false}]},{"type":"scale","text":"How well did your last ideation session push beyond the obvious ideas?","lo":"Not at all","hi":"Very well"},{"type":"open","text":"Combine two of your ideas into a new one. What does it do better than either alone?","hint":"By combining... and..., we get..."}]},{"re":"ethic|responsib|social good|accessib|communit|codesign","qs":[{"type":"mc","text":"What does designing responsibly ask you to do first?","options":[{"t":"Consider who could be helped or harmed by the design.","ok":true},{"t":"Choose the cheapest materials available.","ok":false},{"t":"Focus only on what the client asks for.","ok":false},{"t":"Make it look as original as possible.","ok":false}]},{"type":"open","text":"Name one person your project could affect who is not your client. How might it affect them?","hint":"My project could affect... by..."},{"type":"mc","text":"A feature helps most users but excludes people with low vision. What is the best next step?","options":[{"t":"Test with affected users and redesign to include them.","ok":true},{"t":"Keep it, since most users are served.","ok":false},{"t":"Remove the feature without asking anyone.","ok":false},{"t":"Add a warning in the small print.","ok":false}]},{"type":"scale","text":"How confident are you that you have listened to the people your project affects?","lo":"Not yet","hi":"Very sure"},{"type":"open","text":"Write one change you will make to your project to make it fairer or more inclusive.","hint":"I will change... so that..."}]}];
const READY_GENERIC = [{"type":"mc","text":"Which sentence best explains the main idea of this slide?","options":[{"t":"It names the key idea and shows how it supports your project work.","ok":true},{"t":"It is a step you can skip when time is short.","ok":false},{"t":"It only matters at the very end of a project.","ok":false},{"t":"It means choosing the idea you like most.","ok":false}]},{"type":"open","text":"Use the idea from this slide in your own project. Give one real example.","hint":"In my project, I used this idea to..."},{"type":"mc","text":"Which team used this idea well?","options":[{"t":"The team tested their plan with real users, then changed it.","ok":true},{"t":"The team kept the plan because they liked it.","ok":false},{"t":"The team asked no one and finished early.","ok":false},{"t":"The team copied the plan of another group.","ok":false}]},{"type":"scale","text":"How strong is the evidence behind your current choice?","lo":"Very weak","hi":"Very strong"},{"type":"open","text":"Write 1 to 2 sentences that use this idea to improve your project.","hint":"To improve my project, I will..."}];
function readyCD(ctx) {
  const hay = (ctx.title || '') + ' ' + (ctx.text || '').slice(0, 1500);
  const hit = READY_SETS.find(x => new RegExp(x.re, 'i').test(hay));
  if (!hit && !(ctx.hasText && ctx.title)) return null;
  const set = (hit ? hit.qs : READY_GENERIC).slice(0, 5);
  const qs = set.map((r, i) => {
    const q = Object.assign({ level: LEVELS[i].k, label: LEVELS[i].label, note: LEVELS[i].note, source: ctx.source }, JSON.parse(JSON.stringify(r)));
    return q;
  });
  return Object.assign({}, ctx, { qs, by: 'ai', aiProvider: 'ready', state: 'ready', pending: false });
}
async function aiBuildCD(ctx) {
  { const ready = readyCD(ctx); if (ready) return ready; }   // instant: use the question set written ahead of time
  const ai = (window.shell && window.shell.ai) || window.demoAI;
  const fail = (state, msg) => Object.assign(new Error(msg), { state });
  if (!ai) throw fail('off', 'The AI question writer runs in the desktop app.');
  const st = await ai.status();
  if (!st.enabled) throw fail('off', 'AI is turned off. Choose a question writer to create concept checks.');
  if (!ctx.hasText) throw fail('notext', 'This slide has no text the app can read, so the AI has nothing to work from.');
  let last = 'The AI reply could not be used.';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.generate({ lo: ctx.lo, out: ctx.out, outs: ctx.outs, title: ctx.title, text: ctx.text, asked: ctx.asked });
    const hit = !res.error && ctx.outs && ctx.outs.find(x => x.lo === res.lo);
    if (hit) { ctx.lo = hit.lo; ctx.out = hit.out; ctx.loAction = hit.out.charAt(0).toLowerCase() + hit.out.slice(1); }
    if (res.error) { last = res.error; break; }   // connection or key problems are not fixed by asking again
    const qs = normaliseAI(res.questions, ctx);
    if (qs) return Object.assign({}, ctx, { qs, by: 'ai', aiProvider: res.provider, state: 'ready', pending: false });
  }
  throw fail('error', last);
}
function ensureCD(s, pos) {
  const item = flowOf(s)[pos];
  if (!item.cd) {
    const ctx = cdContext(s, pos);
    item.cd = Object.assign({}, ctx, { qs: [], state: 'pending', pending: true });
    runCD(s, pos, item, ctx);
  }
  return item.cd;
}
function retryCD(s, pos) { const item = flowOf(s)[pos]; item.cd = null; return ensureCD(s, pos); }
function runCD(s, pos, item, ctx) {
  const here = () => typeof A !== 'undefined' && A && A.type === 'Concept Development' && flowOf(s)[s.pos] === item;
  aiBuildCD(ctx).then(ai => {
    if (item.cd && item.cd.edited) { item.cd.pending = false; return; }   // the tutor wrote their own while the AI was working
    item.cd = ai; if (here()) render();
  }).catch(err => {
    const cd = item.cd; if (!cd) return;
    cd.pending = false; cd.state = err.state || 'error'; cd.aiError = err.message;
    if (here()) render();
  });
}

const SAMPLES = [
  { t: 'I think the assumption is that everyone already knows who the users are.' },
  { t: '我们应该只用访谈证据来重写这个假设。', en: 'We should rewrite this assumption using only interview evidence.', lang: 'Chinese' },
  { t: 'The evidence doesn\'t show why they skip it, only that they do.' },
  { t: '我认为决定之前我们需要更多数据。', en: 'I think we need more data before deciding.', lang: 'Chinese' },
  { t: 'We could test it with two more interviews first.' },
  { t: '如果任务书变了，我们必须重新阅读证据。', en: 'If the brief changes, we must re-read the evidence.', lang: 'Chinese' }
];
function ensureRes(q) {
  if (q.res) return q.res;
  const r = seeded(hash(q.text));
  if (q.type === 'mc') q.res = { counts: (q.options || []).map(o => Math.round((o.ok ? 14 : 3) + r() * 6)) };
  else if (q.type === 'scale') q.res = { counts: [1, 3, 7, 10, 6].map(v => Math.max(0, Math.round(v + r() * 3 - 1))) };
  else q.res = { n: 9 + Math.round(r() * 8), shown: shuffled(SAMPLES.map((_, i) => i), hash(q.text)).slice(0, 3) };
  return q.res;
}

/* ---------- Reflection: one AI-written reflection question about all the slides shown before the activity ---------- */
const REFLECT_BANK = [
  { t: 'The idea that was new to me is that a persona comes from research, not guesses.' },
  { t: '我以前以为人物角色只是想象，现在我知道要用访谈证据。', en: 'I used to think a persona was only imagined. Now I know to use interview evidence.', lang: 'Chinese' },
  { t: 'I am still not sure how to choose which insight matters most for my brief.' },
  { t: 'This helped me see that my team was working from assumptions.' },
  { t: '我想用今天学到的方法重新检查我们的用户。', en: 'I want to use what I learned today to check our users again.', lang: 'Chinese' },
  { t: 'Next, I will go back to my interview notes and look for patterns.' },
  { t: 'It changed how I will write my How Might We question.' },
  { t: 'I want an example of a good reframed brief before I start.' }
];
function rfContext(s, pos) {
  const c = cdContext(s, pos), f = flowOf(s);
  const slides = f.slice(0, pos).filter(x => x.k === 's').length;
  return { title: c.title, text: c.text, hasText: c.hasText, lo: c.lo, out: c.out, asked: c.asked, slides, source: slides + ' slide' + (slides === 1 ? '' : 's') + ' so far' };
}
const READY_RF = [{"re":"evaluat|good look|criteria|rubric|success","question":"Think about the criteria we looked at today. Which one is your project weakest on, and what evidence would show it has improved?","hint":"My weakest criterion is ... and I could show improvement by ..."},{"re":"ideat|brainstorm|diverge|concept","question":"Look back at the ideas you generated today. Which idea surprised you most, and what would you test first to find out if it works?","hint":"The idea that surprised me was ... I would test it by ..."},{"re":"ethic|responsib|social good|accessib|communit|codesign","question":"Think about the people your project affects. Whose voice have you not yet heard, and how could you include them?","hint":"I have not yet heard from ... I could include them by ..."}];
const READY_RF_GENERIC = {"question":"Look back at what we covered so far. What is one idea that was new to you, and how could it change your own project?","hint":"One idea that was new to me was ... because ..."};
function readyRF(ctx) {
  if (!ctx.hasText) return null;
  const hay = (ctx.title || '') + ' ' + (ctx.text || '').slice(0, 1500);
  const hit = READY_RF.find(x => new RegExp(x.re, 'i').test(hay)) || READY_RF_GENERIC;
  return Object.assign({}, ctx, { question: hit.question, hint: hit.hint, state: 'ready', pending: false, aiProvider: 'ready' });
}
async function aiBuildRF(ctx) {
  { const ready = readyRF(ctx); if (ready) return ready; }   // instant: question written ahead of time
  const ai = (window.shell && window.shell.ai) || window.demoAI;
  const fail = (state, msg) => Object.assign(new Error(msg), { state });
  if (!ai || !ai.reflect) throw fail('off', 'The AI question writer runs in the desktop app.');
  const st = await ai.status();
  if (!st.enabled) throw fail('off', 'AI is turned off. Choose a question writer to create reflection questions.');
  if (!ctx.hasText) throw fail('notext', 'The slides shown so far have no text the app can read, so the AI has nothing to work from.');
  const res = await ai.reflect({ title: ctx.title, text: ctx.text, lo: ctx.lo, out: ctx.out, asked: ctx.asked, slides: ctx.slides });
  if (res.error) throw fail('error', res.error);
  const question = String(res.question || '').trim();
  if (!question || wordCount(question) > 45) throw fail('error', 'The AI reply could not be used.');
  return Object.assign({}, ctx, { question, hint: String(res.hint || '').trim().slice(0, 90), state: 'ready', pending: false, aiProvider: res.provider });
}
function ensureRF(s, pos) {
  const item = flowOf(s)[pos];
  if (!item.rf) {
    const ctx = rfContext(s, pos);
    item.rf = Object.assign({}, ctx, { state: 'pending', pending: true });
    const here = () => typeof A !== 'undefined' && A && A.type === 'Reflection' && flowOf(s)[s.pos] === item;
    aiBuildRF(ctx).then(rf => { item.rf = rf; if (here()) render(); }).catch(err => {
      const rf = item.rf; if (!rf) return; rf.pending = false; rf.state = err.state || 'error'; rf.aiError = err.message; if (here()) render();
    });
  }
  return item.rf;
}
function retryRF(s, pos) { flowOf(s)[pos].rf = null; return ensureRF(s, pos); }
function rfRes(rf) {
  if (!rf.res) { const r = seeded(hash(rf.question)); rf.res = { n: 6 + Math.round(r() * 6), shown: shuffled(REFLECT_BANK.map((_, i) => i), hash(rf.question)).slice(0, 3) }; }
  return rf.res;
}
