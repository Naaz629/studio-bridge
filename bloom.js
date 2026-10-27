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
const GENERIC_WRONG = [
  'It only applies once the project has finished.',
  'It replaces the need to gather evidence.',
  'It is a matter of personal opinion, not evidence.',
  'It mainly concerns how the final poster looks.'
];
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

/* ---- context: the week's outcome + the slide before the activity ---- */
function cdContext(s, pos) {
  const f = flowOf(s), sl = slidesFor(s);
  let slide = null, idx = -1;
  for (let p = pos - 1; p >= 0; p--) if (f[p].k === 's') { idx = Math.min(f[p].i, sl.length - 1); slide = sl[idx]; break; }
  const W = s.weeks[s.liveWeek] || Object.values(s.weeks)[0];
  const sess = W.sessions.tut || Object.values(W.sessions)[0];
  const o = sess.outs[0], out = o.out;
  const text = slide && slide.text ? slide.text : '';
  const title = cleanTopic(slide ? (slide.title || slide.t) : (s.topics[s.liveWeek] || [''])[0]) || 'this week\'s topic';
  // sentences from the rest of the deck serve as believable wrong answers
  const others = [];
  sl.forEach((x, i) => { if (i !== idx && x.text) others.push(...sentencesOf(x.text)); });
  return {
    topic: title, title, text, hasText: sentencesOf(text).length > 0,
    slideNo: idx >= 0 ? idx + 1 : null,
    source: idx >= 0 ? `Slide ${idx + 1} · ${title}` : title,
    others, lo: o.lo, out, loAction: out.charAt(0).toLowerCase() + out.slice(1)
  };
}

/* ---- question builders ---- */
function mcFrom(stem, correct, ctx, seed) {
  const pool = [...new Set(ctx.others.filter(x => x !== correct))];
  const wrong = shuffled(pool, seed).slice(0, 3);
  for (const g of GENERIC_WRONG) if (wrong.length < 3 && !wrong.includes(g)) wrong.push(g);
  const opts = shuffled([{ t: correct, ok: true }, ...wrong.map(t => ({ t, ok: false }))], seed + 7);
  return { type: 'mc', text: stem, options: opts };
}

function buildCD(ctx) {
  const facts = sentencesOf(ctx.text), terms = termsOf(ctx.text), term = terms[0];
  const seed = hash(ctx.source + ctx.out);
  const factWithTerm = facts.find(x => term && x.toLowerCase().includes(term)) || facts[0];
  const mainIdea = facts[0];
  const q = [];

  // 1. Identify & explain: multiple choice when the slide has statements to test
  if (facts.length) {
    const pick = factWithTerm === mainIdea && facts.length > 1 ? facts[1] : factWithTerm;
    q.push(Object.assign(mcFrom(`According to "${ctx.title}", which of these statements is true?`, pick, ctx, seed), {}));
  } else {
    q.push({ type: 'open', text: `Looking at "${ctx.title}": which statement is an assumption rather than an observation, and why is it an assumption?` });
  }
  // 2. Apply: open answer
  q.push({ type: 'open', text: term
    ? `Using "${ctx.title}", rewrite one assumption about ${term} using only the evidence you have.`
    : `Rewrite one assumption about "${ctx.title}" using only the evidence that is available.` });
  // 3. Analyse: multiple choice about the main idea, or open when the slide has little text
  if (facts.length > 1 || (facts.length === 1 && ctx.others.length)) {
    q.push(mcFrom(`Which of these is the main idea of "${ctx.title}"?`, mainIdea, ctx, seed + 3));
  } else {
    q.push({ type: 'open', text: `What patterns emerge from the observations and evidence related to "${ctx.title}"?` });
  }
  // 4. Evaluate: confidence scale
  q.push({ type: 'scale', text: `How confident are you that you can ${ctx.loAction}?`, lo: 'Not yet', hi: 'Very' });
  // 5. Create: open answer, shows the whole outcome
  q.push({ type: 'open', text: `Develop a statement, based on the evidence, that shows you can ${ctx.loAction}.` });

  return Object.assign({}, ctx, {
    qs: q.map((x, i) => Object.assign({ level: LEVELS[i].k, label: LEVELS[i].label, note: LEVELS[i].note, source: ctx.source }, x))
  });
}
function ensureCD(s, pos) {
  const item = flowOf(s)[pos];
  if (!item.cd) item.cd = buildCD(cdContext(s, pos));
  return item.cd;
}

/* ---- simulated class responses (until students are connected) ---- */
const SAMPLES = [
  { t: 'I think the assumption is that everyone already knows who the users are.' },
  { t: '我们应该只用访谈证据来重写这个假设。', en: 'We should rewrite this assumption using only interview evidence.', lang: 'Chinese' },
  { t: 'The evidence doesn\'t show why they skip it, only that they do.' },
  { t: 'Creo que necesitamos más datos antes de decidir.', en: 'I think we need more data before deciding.', lang: 'Spanish' },
  { t: 'We could test it with two more interviews first.' },
  { t: 'Si le brief change, on doit relire les preuves.', en: 'If the brief changes, we must re-read the evidence.', lang: 'French' }
];
function ensureRes(q) {
  if (q.res) return q.res;
  const r = seeded(hash(q.text));
  if (q.type === 'mc') q.res = { counts: (q.options || []).map(o => Math.round((o.ok ? 14 : 3) + r() * 6)) };
  else if (q.type === 'scale') q.res = { counts: [1, 3, 7, 10, 6].map(v => Math.max(0, Math.round(v + r() * 3 - 1))) };
  else q.res = { n: 9 + Math.round(r() * 8), shown: shuffled(SAMPLES.map((_, i) => i), hash(q.text)).slice(0, 3) };
  return q.res;
}
