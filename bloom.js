'use strict';
/* Concept Development questions, written from Bloom's taxonomy.
   Inputs: the week's learning outcome (already decided per week) and the slide that comes before the activity.
   Output: five questions that climb from recall to creation. Tutors can edit or regenerate them. */

const BLOOM = [
  { k: 'identify', label: 'Identify & explain', note: 'Checks foundational and conceptual understanding.',
    tpl: c => `Looking at "${c.topic}": which statement is an assumption rather than an observation, and why is it an assumption?` },
  { k: 'apply', label: 'Apply', note: 'Checks practical application.',
    tpl: c => `Rewrite one assumption about "${c.topic}" using only the evidence that is available.` },
  { k: 'analyse', label: 'Analyse', note: 'Checks evidence interpretation.',
    tpl: c => `What patterns emerge from the observations and evidence related to "${c.topic}"?` },
  { k: 'evaluate', label: 'Evaluate', note: 'Checks judgement and justification.',
    tpl: c => `Does the evidence sufficiently support your approach to "${c.topic}"? Why or why not?` },
  { k: 'create', label: 'Create', note: 'Demonstrates application of the overall outcome.',
    tpl: c => `Develop a statement, based on the evidence, that shows you can ${c.loAction}.` }
];

function cleanTopic(t) {
  return String(t || '')
    .replace(/^Week\s*\d+\s*[:\-–]?\s*/i, '')
    .replace(/^(Tutorial|Masterclass|Lecture)\s*[:\-–]\s*/i, '')
    .replace(/\.(pdf|pptx?|key|png|jpe?g|webp)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* The week's outcome and the slide before position `pos` in the session flow. */
function cdContext(s, pos) {
  const f = flowOf(s), sl = slidesFor(s);
  let slide = null;
  for (let p = pos - 1; p >= 0; p--) if (f[p].k === 's') { slide = sl[Math.min(f[p].i, sl.length - 1)]; break; }
  const W = s.weeks[s.liveWeek] || Object.values(s.weeks)[0];
  const sess = W.sessions.tut || Object.values(W.sessions)[0];
  const o = sess.outs[0];
  const out = o.out;
  return {
    topic: cleanTopic(slide ? slide.t : (s.topics[s.liveWeek] || [''])[0]) || 'this week\'s topic',
    slideTitle: slide ? slide.t : null,
    lo: o.lo, out, loAction: out.charAt(0).toLowerCase() + out.slice(1)
  };
}

function buildCD(ctx) {
  return Object.assign({}, ctx, {
    qs: BLOOM.map(b => ({ level: b.k, label: b.label, note: b.note, text: b.tpl(ctx) }))
  });
}
function ensureCD(s, pos) {
  const item = flowOf(s)[pos];
  if (!item.cd) item.cd = buildCD(cdContext(s, pos));
  return item.cd;
}
