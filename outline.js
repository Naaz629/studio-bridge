'use strict';
/* Reads a University of Sydney unit outline page (sydney.edu.au/units/CODE/term) and turns it into the data the app needs:
   unit name, learning outcomes, the weekly schedule (topic, activity, outcomes for each lecture / tutorial / practical) and the assessments.
   The page is fetched by the main process (see main.js, 'unit:fetch'); this file only reads the HTML. */

const OUTLINE_ACT = [['lec', /lecture/i], ['tut', /tutorial|seminar/i], ['prac', /./]];
const TERM_NAMES = { S1: 'Semester 1', S2: 'Semester 2', S3: 'Semester 3' };

function termFromUrl(url) {
  const m = String(url).match(/\/(\d{4})-([A-Z]\d?)/i);
  if (!m) return '';
  const base = m[2].toUpperCase();
  return `${TERM_NAMES[base] || base} · ${m[1]}`;
}

function parseUnitOutline(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  const h1 = txt(doc.querySelector('h1'));
  const hm = h1.match(/^([A-Z]{3,4}\d{4})\s*[:\-–]\s*(.+)$/);
  if (!hm) throw new Error('This does not look like a unit outline page.');
  const out = { url, code: hm[1], name: hm[2].trim(), term: termFromUrl(url), ulo: {}, weeks: {}, assess: [] };

  // learning outcomes: "LO1 . text"
  const loPanel = doc.querySelector('#learning_outcomes_panel');
  if (loPanel) {
    const t = txt(loPanel), start = t.search(/LO\s*1\s*\./), end = t.search(/Graduate qualities\s+The graduate qualities/);
    const seg = start >= 0 ? t.slice(start, end > start ? end : undefined) : '';
    for (const m of seg.matchAll(/(LO\d+)\s*\.\s*(.+?)(?=\s+LO\d+\s*\.|$)/g)) out.ulo[m[1]] = m[2].trim();
  }

  // weekly schedule: WK | Topic | Learning activity | Learning outcomes (the week cell spans several rows)
  const table = doc.querySelector('#learnAct');
  if (!table) throw new Error('No weekly schedule was found on this page.');
  let week = null;
  for (const tr of table.querySelectorAll('tbody tr')) {
    const tds = [...tr.children].filter(c => c.tagName === 'TD');
    if (tds.length < 3) continue;
    let k = 0;
    if (tds.length >= 4) { const wm = txt(tds[0]).match(/(\d+)/); week = wm ? +wm[1] : week; k = 1; }
    if (week == null) continue;
    const topic = txt(tds[k]), activity = txt(tds[k + 1]);
    const los = [...tds[k + 2].querySelectorAll('a')].map(a => {
      const id = txt(a).replace(/\s+/g, '');
      if (a.getAttribute('title') && !out.ulo[id]) out.ulo[id] = a.getAttribute('title').trim();
      return id;
    }).filter(Boolean);
    const type = (OUTLINE_ACT.find(([, re]) => re.test(activity)) || ['prac'])[0];
    const w = out.weeks[week] = out.weeks[week] || {};
    if (!w[type]) w[type] = { topic, activity, los };
  }
  if (!Object.keys(out.weeks).length) throw new Error('The weekly schedule was empty.');

  // assessments: a primary row ("Assessment N: title", weight, due) followed by a row with "Outcomes assessed: LO1 LO2"
  const ap = doc.querySelector('#assessment_panel');
  if (ap) {
    let cur = null;
    for (const tr of ap.querySelectorAll('tr')) {
      const b = tr.querySelector('td b');
      if (b && /^(Assessment|Assignment|Exam|Quiz|Test|Project|Report|Presentation)\b/i.test(txt(b))) {
        const tds = [...tr.children].filter(c => c.tagName === 'TD');
        const due = txt(tds[2]), wk = due.match(/Week\s*(\d+)/i);
        cur = { title: txt(b).replace(/^[^:]+:\s*/, ''), label: txt(b).split(':')[0], weight: txt(tds[1]), due, week: wk ? +wk[1] : null, los: [] };
        out.assess.push(cur);
      } else if (cur && /Outcomes assessed/i.test(txt(tr))) {
        cur.los = [...txt(tr).matchAll(/LO\d+/g)].map(m => m[0]); cur = null;
      }
    }
  }
  return out;
}

/* ---- turn an outline into a subject the app can show ---- */
function outlineToConfig(o) {
  const weeks = Object.keys(o.weeks).map(Number).sort((a, b) => a - b);
  const topics = {}, plan = {};
  for (const w of weeks) {
    const p = o.weeks[w];
    topics[w] = [(p.lec || p.tut || p.prac).topic, (p.tut || p.prac || p.lec).topic];
    plan[w] = p;
  }
  const spread = a => a.week != null ? [a.week, a.title, a.los] : null;
  const assess = o.assess.map(spread).filter(Boolean);
  // assessments that run over several weeks are tested at the midpoint of the plan
  o.assess.filter(a => a.week == null).forEach(a => assess.push([weeks[Math.min(weeks.length - 1, Math.floor(weeks.length / 2))], a.title, a.los]));
  assess.sort((a, b) => a[0] - b[0]);
  return {
    name: o.name, code: o.code, badge: o.code.replace(/^[A-Z]+/, ''), term: o.term || 'This semester', ulo: o.ulo, topics, plan, weeks, assess,
    liveWeek: weeks.includes(6) ? 6 : weeks[Math.floor(weeks.length / 2)], files: {}, qs: [],
    outFor: lo => o.ulo[lo] || lo
  };
}

function applyOutline(o, select = true) {
  const cfg = outlineToConfig(o);
  const at = SUBJECTS.findIndex(x => x.code === o.code);
  const old = at >= 0 ? SUBJECTS[at] : null;
  if (old) { cfg.qs = old.qs; cfg.liveWeek = cfg.weeks.includes(old.liveWeek) ? old.liveWeek : cfg.liveWeek; cfg.files = old.files || {}; }
  else cfg.qs = [{ id: 1, who: 'Yuki Tanaka', av: 'sand', ago: 3, text: 'Can you explain this week\'s outcome again?', up: 6, same: 2, st: 'open' }];
  const fresh = makeSubject(cfg);
  fresh.fromOutline = o.url;
  if (old) Object.assign(fresh, { uploads: old.uploads, upload: old.upload, flow: old.flow, flowN: old.flowN, pos: old.pos, attach: old.attach, reactions: old.reactions, cards: old.cards, artefacts: old.artefacts });
  if (at >= 0) SUBJECTS[at] = fresh; else SUBJECTS.push(fresh);
  return select ? (at >= 0 ? at : SUBJECTS.length - 1) : at;
}
