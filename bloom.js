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
  const asked = [...(s.qs || [])].sort((a, b) => b.up - a.up).slice(0, 6).map(q => ({ text: q.tr || q.text, count: q.up }));
  return {
    asked,
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
    const q = { level: LEVELS[i].k, label: LEVELS[i].label, note: LEVELS[i].note, source: ctx.source, type, text, zh: String(r.zh || '').trim().slice(0, 220) };
    if (type === 'mc') {
      const opts = (Array.isArray(r.options) ? r.options : []).map(o => ({ t: String((o && o.t) || '').trim(), ok: !!(o && o.ok), zh: String((o && o.zh) || '').trim().slice(0, 90) })).filter(o => o.t).slice(0, 4);
      if (opts.length < 3 || !opts.some(o => o.ok) || opts.some(o => wordCount(o.t) > 32)) return null;
      let seen = false; opts.forEach(o => { if (o.ok && seen) o.ok = false; if (o.ok) seen = true; });
      q.options = opts;
    } else if (type === 'scale') {
      q.lo = String(r.lo || 'Not yet').trim().slice(0, 24); q.hi = String(r.hi || 'Very sure').trim().slice(0, 24);
      q.lo_zh = String(r.lo_zh || '').trim().slice(0, 14); q.hi_zh = String(r.hi_zh || '').trim().slice(0, 14);
    } else { q.hint = String(r.hint || '').trim().slice(0, 90); q.hint_zh = String(r.hint_zh || '').trim().slice(0, 120); }
    qs.push(q);
  }
  return qs;
}
function normTerms(raw) {
  return (Array.isArray(raw) ? raw : []).map(t => ({ term: String((t && t.term) || '').trim().slice(0, 40), simple: String((t && t.simple) || '').trim().slice(0, 90), zh: String((t && t.zh) || '').trim().slice(0, 60) })).map(t => /[a-z]/i.test(t.simple) ? t : Object.assign(t, { simple: '' })).filter(t => t.term && t.zh).slice(0, 5);
}
async function aiBuildCD(ctx) {
  const ai = window.shell && window.shell.ai;
  const fail = (state, msg) => Object.assign(new Error(msg), { state });
  if (!ai) throw fail('off', 'The AI question writer runs in the desktop app.');
  const st = await ai.status();
  if (!st.enabled) throw fail('off', 'AI is turned off. Choose a question writer to create concept checks.');
  if (!ctx.hasText) throw fail('notext', 'This slide has no text the app can read, so the AI has nothing to work from.');
  let last = 'The AI reply could not be used.';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ai.generate({ lo: ctx.lo, out: ctx.out, title: ctx.title, text: ctx.text, asked: ctx.asked });
    if (res.error) { last = res.error; break; }   // connection or key problems are not fixed by asking again
    const qs = normaliseAI(res.questions, ctx);
    if (qs) return Object.assign({}, ctx, { qs, terms: normTerms(res.terms), by: 'ai', aiProvider: res.provider, state: 'ready', pending: false });
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
