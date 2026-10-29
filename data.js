'use strict';
/* Subject data. Graduation Studio (IDEA9301) outcomes, weekly topics and resources come from the unit's Canvas site.
   Student numbers, answers and questions are SAMPLE data generated for the prototype. */

const NAMES = ['Amira Khan', 'Ben Tran', 'Chloe Rossi', 'Dev Patel', 'Elena Sosa', 'Farid Ali', 'Grace Lin', 'Hamza Noor', 'Yuki Tanaka', 'Maya Chen', 'Leo Park', 'Ravi Shah', 'Emma Lowe', 'Sara Ali'];
const LVL = { k: ['Know it', 'Understands the concept'], a: ['Apply it', 'Uses it in their project'], e: ['Explain it', 'Can say why it matters'] };
const SRC = { k: 'Concept check', a: 'Tutorial activity', e: 'Exit check-in' };
const GAP = { k: 'Students are not yet recalling the core concept.', a: 'Students know it but struggle to apply it to their own project.', e: 'Students can do it but cannot explain why it matters.' };
const TIP = { k: 'Re-open with a 2-minute concept check using one real example.', a: 'Have each team apply the idea to their own brief in 5 minutes.', e: 'Give the frame: "We did ___ because ___, which shows ___."' };
const NOTE = { k: 'Missed the concept check', a: 'Could not apply it to their project', e: 'Gave a one-word explanation' };
const ACT_META = {
  "Discussion Activity": { title: "Idea Exchange", tile: "D activity", color: "#e9e3f2" },
  "Concept Development": { title: "Concept Development", tile: "CD", color: "#f5e7b9" },
  "Q&A Session": { title: "Q&A Session", tile: "Q&A", color: "#d3e8d2" },
  "Artefact upload": { title: "Artefact upload", tile: "Artefact", color: "#cfe3ea" }
};
const PROMPTS = {
  "Discussion Activity": ["Discuss with your peers. Use your cards to share what you think."],
  "Concept Development": ["Define the idea in your own words.", "Which user needs matter most?", "What would make it believable?", "Where could it mislead a team?", "Sketch one goal."],
  "Q&A Session": ["Ask anything about this week.", "Upvote questions you share.", "Clarify the top question.", "Answer a peer question.", "Final open questions."],
  "Artefact upload": ["Upload your persona canvas.", "Upload a photo of your sketch.", "Add a caption explaining it.", "Tag the learning outcome it shows.", "Review a peer's upload."]
};
const DISCUSS_CARDS = [
  { k: 'agree', n: '01', label: 'Agree', img: 'assets/cards/agree.png' },
  { k: 'disagree', n: '02', label: 'Disagree', img: 'assets/cards/disagree.png' },
  { k: 'turn', n: '03', label: 'Take a turn', img: 'assets/cards/turn.png' },
  { k: 'clarify', n: '04', label: 'Clarify', img: 'assets/cards/clarify.png' },
  { k: 'idea', n: '05', label: 'Share an idea', img: 'assets/cards/idea.png' }
];
const ACTIVITY_TYPES = Object.keys(PROMPTS);
const EMOJIS = [
  { k: 'und', e: '✅', l: 'Understood', c: 'var(--tint)' },
  { k: 'con', e: '🤔', l: 'Confused', c: 'var(--lav)' },
  { k: 'qst', e: '❓', l: 'Question', c: 'var(--sand)' },
  { k: 'idea', e: '💡', l: 'Idea', c: 'var(--live-soft)' },
  { k: 'great', e: '👏', l: 'Great', c: 'var(--tint)' }
];

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildOutcome(id, lo, outText, seed, unit) {
  const r = rng(seed), total = unit === 'teams' ? 10 : 38;
  const lv = { k: [Math.round(total * (.82 + r() * .14)), SRC.k], a: [Math.round(total * (.5 + r() * .4)), SRC.a], e: [Math.round(total * (.5 + r() * .35)), SRC.e] };
  const weak = Object.entries(lv).reduce((m, x) => x[1][0] < m[1][0] ? x : m)[0];
  const n = Math.max(2, Math.min(6, total - lv[weak][0]));
  const who = [];
  for (let i = 0; i < n; i++) {
    const nm = unit === 'teams' ? 'Team ' + (1 + Math.floor(r() * 10)) : NAMES[Math.floor(r() * NAMES.length)];
    if (who.some(w => w[0] === nm)) continue;
    const l = i === 0 ? weak : ['k', 'a', 'e'][Math.floor(r() * 3)];
    who.push([nm, l, NOTE[l]]);
  }
  return { id, lo, out: outText, unit, total, lv, gap: GAP[weak], tip: TIP[weak], who };
}

/* sessions taken straight from a unit outline: each lecture / tutorial / practical keeps its own topic and the outcomes the outline lists for it */
function planSessions(cfg, w) {
  const p = cfg.plan[w], names = { lec: 'Lecture', tut: 'Tutorial', prac: 'Practical' }, out = {};
  let n = 0;
  for (const k of ['lec', 'tut', 'prac']) {
    const x = p[k]; if (!x) continue;
    const los = x.los.length ? x.los : [Object.keys(cfg.ulo)[0]];
    out[k] = { name: names[k], topic: x.topic, outs: los.map((lo, i) => buildOutcome(`${cfg.code}-${w}${k}${i}`, lo, cfg.ulo[lo] || lo, w * 31 + n * 7 + i * 3 + cfg.code.length, k === 'prac' ? 'teams' : 'students')) };
    n++;
  }
  return out;
}

function buildWeeks(cfg) {
  const loKeys = Object.keys(cfg.ulo), weeks = {};
  for (const w of cfg.weeks) {
    const t = cfg.topics[w];
    if (cfg.plan && cfg.plan[w]) { weeks[w] = { title: t[0], sessions: planSessions(cfg, w) }; continue; }
    const mk = (k, name, topic, idx, unit) => {
      const lo = loKeys[(w + idx) % loKeys.length];
      return { name, topic, outs: [buildOutcome(`${cfg.code}-${w}${k}`, lo, cfg.outFor(lo, w, k), w * 31 + idx * 7 + cfg.code.length, unit)] };
    };
    weeks[w] = {
      title: t[0],
      sessions: { lec: mk('l', 'Masterclass', t[0], 0, 'students'), tut: mk('t', 'Tutorial', t[1], 1, 'students'), prac: mk('p', 'Studio', 'Practical work with your team', 2, 'teams') }
    };
  }
  for (const w of cfg.weeks) {
    weeks[w].trend = {};
    for (const lo of loKeys) {
      let st = 'na';
      for (const v of cfg.weeks.filter(x => x <= w).reverse()) {
        const o = Object.values(weeks[v].sessions).flatMap(s => s.outs).find(o => o.lo === lo);
        if (o) { const wk = Math.min(...Object.values(o.lv).map(x => x[0] / o.total)); st = wk >= .8 ? 'ok' : wk >= .65 ? 'mid' : 'low'; break; }
      }
      weeks[w].trend[lo] = st;
    }
  }
  return weeks;
}

const GRAD_LOS = {
  LO1: 'Formulate, plan and execute an individual/group design project in response to a design brief',
  LO2: 'Choose appropriate methods as part of a human-centred design process to suit the problem space',
  LO3: 'Analyse data from multiple sources to understand the problem space and idea, iterate and improve potential design interventions or solutions',
  LO4: 'Document and report research-led design work',
  LO5: 'Deliver evidence-based design presentations that are clear, confident and engaging to an external audience',
  LO6: 'Critically analyse and reflect upon self and peer practices to identify and improve personal accountability in relation to the ethics and values of the discipline and profession'
};
const GRAD_TOPICS = {
  1: ['Introduction', 'Design Briefs'], 2: ['Planet: Design Frameworks & Life Centred Design', 'Frameworks for Design'], 3: ['Building the Project', 'Charette'],
  4: ['Profit: Costing the project', 'Budget'], 5: ['Design Communication', 'Pitching Projects'], 6: ['What does "good" look like?', 'Project Evaluation Approaches'],
  7: ['Planet: design tactics', 'Creating Design Opportunity'], 8: ['Profit: Earning the First Dollar', 'Your Portfolio'], 9: ['People: accessible technology', 'Ideating and Prototyping'],
  10: ['People: designing for social good', 'Client Needs, Social Good'], 11: ['People: codesign and communities', 'Validation with clients and peers'], 12: ['Responsible Design', 'Ethical Reflection'],
  13: ['Final exhibition and presentations', 'Final exhibition and presentations']
};
const GRAD_FILES = {
  1: ['Week 1 Tutorial Slides'], 2: ['Masterclass and tutorial slides (W02)', 'Team Agreement'], 3: ['Podclass: Tom Rivard'], 4: ['Week 4 Masterclass slides', 'Tutorial slides template', 'Project budget example'],
  5: ['Week 5 Tutorial Slides', 'Reverse brief template'], 6: ['Week 6 Masterclass and tutorial slides'], 7: ['W07 codesign workshop slides'], 8: ['Lecture: Clarity & Communication'],
  9: ['Week 9 lecture slides', 'Grad Show prompts'], 10: ['Wk10 Lecture and tutorial slides', 'Lifeline / critique cards'], 11: ['Cooper validation slides', 'Wk11 materials'],
  12: ['W12 Tutorial slides', 'Cooper lecture slides'], 13: []
};
const ALL13 = Array.from({ length: 13 }, (_, i) => i + 1);

function makeSubject(cfg) {
  const s = {
    name: cfg.name, code: cfg.code, badge: cfg.badge, term: cfg.term, ulo: cfg.ulo, assess: cfg.assess, liveWeek: cfg.liveWeek, topics: cfg.topics, files: cfg.files || {},
    weeks: buildWeeks(cfg), upload: null, uploads: [], slideIdx: 0, attach: {}, taught: Object.keys(cfg.topics).length,
    reactions: Object.fromEntries(EMOJIS.map((e, i) => [e.k, [14, 3, 4, 6, 9][i]])),
    qs: cfg.qs, cards: { agree: 7, disagree: 3, turn: 4, clarify: 5, idea: 6 },
    artefacts: [['Amira Khan', 'Business model canvas', 'assets/artefacts/bmc-1.svg'], ['Ben Tran', 'Value proposition canvas', 'assets/artefacts/vpc-2.svg'], ['Chloe Rossi', 'Business model canvas', 'assets/artefacts/bmc-3.svg', false, 'Group 3'], ['Dev Patel', 'Value proposition canvas', 'assets/artefacts/vpc-4.svg', true], ['Elena Sosa', 'Business model canvas', 'assets/artefacts/bmc-5.svg', false, 'Group 5'], ['Farid Ali', 'Value proposition canvas', 'assets/artefacts/vpc-6.svg']]
  };
  return s;
}

function slidesFor(s) {
  if (s.uploads.length) return s.uploads.map(u => ({ img: u.url, t: u.title || u.name, title: u.title, text: u.text || '' }));
  const w = s.liveWeek, t = s.topics[w];
  const base = [{ t: `Week ${w}: ${t[0]}`, p: `Masterclass · ${s.name}` }, { t: `Tutorial: ${t[1]}`, p: 'Work-in-progress updates, then tutorial' }];
  (s.files[w] || []).forEach(f => base.push({ t: f, p: 'Canvas resource for this week' }));
  base.push({ t: 'Studio & Retrospective', p: 'Practical work with your team, then a short retrospective' });
  return base;
}

const SUBJECTS = [
  makeSubject({
    name: 'Graduation Studio', code: 'IDEA9301', badge: '9301', term: 'Semester 2 · 2026', ulo: GRAD_LOS, topics: GRAD_TOPICS, files: GRAD_FILES, weeks: ALL13, liveWeek: 6,
    assess: [[3, 'WIP update 1', ['LO1', 'LO4']], [5, 'Project proposal & budget', ['LO1', 'LO2']], [8, 'Portfolio', ['LO4', 'LO5']], [9, 'WIP update 2', ['LO3', 'LO4']], [12, 'Group reflection', ['LO6']], [13, 'Final project', ['LO1', 'LO3', 'LO4', 'LO5']]],
    outFor: (lo, w, k) => ({ LO1: 'Plan the next step of the project against the brief', LO2: 'Justify the method chosen for this problem space', LO3: 'Use evidence from more than one source to decide', LO4: 'Document research-led work clearly', LO5: 'Present evidence-based reasoning to the client', LO6: 'Reflect on team and personal accountability' }[lo]),
    qs: [
      { id: 1, who: 'Yuki Tanaka', av: 'sand', ago: 6, text: 'Can our WIP update include prototypes that are not finished?', up: 9, same: 4, st: 'ans', ans: 'Yes, an unfinished prototype is fine for a WIP update as long as you explain what is still to be tested.' },
      { id: 2, who: 'Maya Chen', av: '', ago: 2, text: 'How is the group reflection marked against LO6?', up: 12, same: 5, st: 'ans', ans: 'Reflections are assessed on whether you critique your own and your peers\' practice against the ethics and values of the discipline.' },
      { id: 3, who: 'Anonymous', av: 'lav', ago: 1, text: '我们的预算需要包括哪些内容？', tr: 'What should our budget include?', up: 7, same: 4, st: 'open' },
      { id: 4, who: 'Leo Park', av: '', ago: 0, text: 'Should our evaluation criteria be agreed with the client first?', up: 3, same: 1, st: 'open' }
    ]
  }),
  makeSubject({
    name: 'Design Thinking', code: 'DESN9106', badge: '9106', term: 'Semester 2 · 2026', liveWeek: 6, weeks: [1, 6],
    ulo: { LO1: 'Understand the drivers of organisational and personal behaviour', LO2: 'Understand how design innovation can be used to manage change', LO3: 'Select design innovation tools based on the challenge at hand', LO4: 'Develop ability to get design innovation projects implemented in organisations' },
    topics: { 1: ['Intro to innovation & team forming', 'Exploring the client brief'], 6: ['Ethical lens & ideation', 'Ideation'] },
    assess: [[7, 'Research analysis', ['LO2', 'LO3']], [9, 'Reflection 2', ['LO2', 'LO3', 'LO4']], [12, 'Client pitch', ['LO1', 'LO2', 'LO3', 'LO4']]],
    outFor: (lo, w, k) => ({ LO1: 'Identify whose behaviour and values an innovation affects', LO2: 'Explain how change creates the need for innovation', LO3: 'Choose a method that fits the challenge', LO4: 'Plan how an idea could be implemented' }[lo]),
    qs: [
      { id: 1, who: 'Yuki Tanaka', av: 'sand', ago: 6, text: 'Can one finding lead to multiple insights?', up: 9, same: 3, st: 'ans', ans: 'Yes, an unfinished prototype is fine for a WIP update as long as you explain what is still to be tested.' },
      { id: 2, who: 'Maya Chen', av: '', ago: 2, text: 'How is an insight different from a finding?', up: 12, same: 5, st: 'ans', ans: 'A finding describes what the evidence shows. An insight explains why it matters.' },
      { id: 3, who: 'Leo Park', av: '', ago: 0, text: 'Should our HMW question mention the technology?', up: 3, same: 1, st: 'open' }
    ]
  })
];
const POOLQ = [['Ravi Shah', 'sand', 'Can this be done with only two interviews?'], ['Anonymous', 'lav', '这周的作业什么时候交？', 'When is this week\'s assignment due?'], ['Emma Lowe', '', 'Do we reframe the brief as a group or individually?']];
