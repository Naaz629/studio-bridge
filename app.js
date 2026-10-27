'use strict';
/* Studio Bridge - tutor prototype. All data is mock/in-memory (+ localStorage for login). */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

const ACTIVITY_TYPES = ['Discussion Activity', 'Concept Development', 'Q&A Session', 'Idea Exchange'];
const EMOJIS = [
  { key: 'understood', icon: '✅', label: 'Understood' },
  { key: 'confused', icon: '😕', label: 'Confused' },
  { key: 'question', icon: '❓', label: 'Question' },
  { key: 'idea', icon: '💡', label: 'Idea' },
  { key: 'great', icon: '👏', label: 'Great' }
];
const STUDENTS = ['Amira K.', 'Ben T.', 'Chloe R.', 'Dev P.', 'Elena S.', 'Farid A.', 'Grace L.', 'Hamza N.'];

function makeSubject(name, code) {
  const titles = ['Welcome', 'Learning outcomes', 'What is a persona?', 'Case study', 'Empathy maps', 'Building a persona', 'Wrap up', 'Reflection', 'Resources', 'Next week', 'Q&A'];
  return {
    name, code, slideFile: null, current: 0,
    slides: titles.map((t, i) => ({ title: t, body: `${name} · slide ${i + 1}`, activities: [] })),
    questions: [
      { id: 1, text: 'What is the difference between a persona and a user segment?', askers: ['Amira K.', 'Ben T.', 'Dev P.', 'Grace L.'], answered: false },
      { id: 2, text: 'How many personas should one project have?', askers: ['Chloe R.', 'Hamza N.'], answered: false },
      { id: 3, text: 'Can a persona be based on one real person?', askers: ['Elena S.'], answered: false }
    ],
    prompts: {
      'Concept Development': ['Define “persona” in your own words.', 'Which user needs matter most?', 'What makes a persona believable?', 'Where could a persona mislead a team?', 'Sketch one persona goal.'],
      'Discussion Activity': ['Share a time a product ignored you as a user.', 'Who is missing from our persona?', 'Discuss in pairs: needs vs wants.', 'Which assumption would you test first?', 'Summarise your group view.'],
      'Idea Exchange': ['Post one idea for researching users.', 'Build on a peer’s idea.', 'Vote for the most feasible idea.', 'Combine two ideas.', 'Pick one to prototype.'],
      'Q&A Session': ['Ask anything about this week.', 'Upvote questions you share.', 'Clarify the top question.', 'Answer a peer question.', 'Final open questions.']
    },
    weeks: makeWeeks(name)
  };
}

function makeWeeks(name) {
  const weeks = {};
  for (let w = 1; w <= 8; w++) {
    weeks[w] = {
      los: [
        mkLO('LO1', 'Explain the purpose of a persona', w, [
          ['What is a persona for?', [['Amira K.', 'It helps the team design for a real type of user.', true], ['Ben T.', 'To make posters of users.', false], ['Chloe R.', 'It keeps decisions grounded in user needs.', true]]],
          ['Name one risk of using personas.', [['Dev P.', 'Stereotyping people.', true], ['Elena S.', 'Not sure.', false]]]
        ]),
        mkLO('LO2', 'Build a persona from research data', w, [
          ['Which data points belong in a persona?', [['Farid A.', 'Goals, frustrations and context.', true], ['Grace L.', 'Their full address and name.', false], ['Hamza N.', 'Behaviours observed in interviews.', true]]]
        ]),
        mkLO('LO3', 'Critique a persona for bias', w, [
          ['Spot the bias in the sample persona.', [['Amira K.', 'Assumes all older users dislike tech.', true], ['Dev P.', 'I don’t see one.', false], ['Elena S.', 'Gender is assumed from the job.', true], ['Ben T.', 'Assumes all older users dislike tech.', true]]]
        ])
      ],
      artefacts: [
        { name: 'Amira K.', title: 'Persona canvas', icon: '🗂️' },
        { name: 'Ben T.', title: 'Empathy map', icon: '🧠' },
        { name: 'Chloe R.', title: 'Journey sketch', icon: '🛤️' },
        { name: 'Dev P.', title: 'Interview notes', icon: '📝' },
        { name: 'Elena S.', title: 'Persona poster', icon: '🖼️' }
      ]
    };
  }
  return weeks;
}

function mkLO(id, text, week, evidence) {
  const list = evidence.map(([q, answers]) => ({
    q, answers: answers.map(([who, a, ok]) => ({ who, a, ok: week % 3 === 0 && id === 'LO3' ? !ok : ok }))
  }));
  const all = list.flatMap(e => e.answers);
  const pct = Math.round(all.filter(a => a.ok).length / all.length * 100);
  return { id, text, pct, evidence: list };
}

const state = {
  user: null,
  subjects: [makeSubject('Design Thinking', 'DES101'), makeSubject('Research Methods', 'RES204'), makeSubject('Digital Media', 'DIG150')],
  subjectIdx: 0,
  week: 6,
  anon: false,
  reactions: Object.fromEntries(EMOJIS.map(e => [e.key, 0])),
  floats: {}
};
const subj = () => state.subjects[state.subjectIdx];

/* ---------- user (login removed) ---------- */
state.user = 'ST1042';
$('#avatar').textContent = state.user.slice(0, 2);
$('#avatar').removeAttribute('title');

/* ---------- navigation ---------- */
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('#view-session').hidden = t.dataset.view !== 'session';
  $('#view-overview').hidden = t.dataset.view !== 'overview';
  if (t.dataset.view === 'overview') renderOverview();
});
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-wrap')) $$('.menu').forEach(m => m.hidden = true);
});

/* ---------- subject menu ---------- */
function renderSubjectMenu() {
  $('#subjectBtn').textContent = subj().name + ' ▾';
  const m = $('#subjectMenu');
  m.innerHTML = state.subjects.map((s, i) => `<button class="${i === state.subjectIdx ? 'sel' : ''}" data-i="${i}">${esc(s.name)} <span class="muted small">${esc(s.code)}</span></button>`).join('');
  $$('button', m).forEach(b => b.onclick = () => {
    state.subjectIdx = +b.dataset.i; m.hidden = true;
    closeAllFloats(); renderAll();
  });
}
$('#subjectBtn').onclick = () => { const m = $('#subjectMenu'); m.hidden = !m.hidden; };

/* ---------- emoji react ---------- */
function renderEmoji() {
  $('#emojiPanel').innerHTML = EMOJIS.map(e => `<button data-k="${e.key}" title="Simulate a student reaction"><span class="em">${e.icon}</span><span class="lbl">${e.label}</span></button>`).join('');
  $$('#emojiPanel button').forEach(b => b.onclick = ev => { ev.stopPropagation(); state.reactions[b.dataset.k]++; renderReactions(); });
  renderReactions();
}
function renderReactions() {
  $('#reactionBar').innerHTML = EMOJIS.map(e => `<div class="reaction"><span>${e.icon}</span><span>${e.label}</span><b>${state.reactions[e.key]}</b></div>`).join('');
}
$('#emojiBtn').onclick = () => { const m = $('#emojiPanel'); m.hidden = !m.hidden; };
setInterval(() => { // simulated live student reactions
  if (!state.user) return;
  const k = EMOJIS[Math.floor(Math.random() * EMOJIS.length)].key;
  if (Math.random() < .5) { state.reactions[k]++; renderReactions(); }
}, 4000);

/* ---------- session: plan + slides ---------- */
function renderPlan() {
  const s = subj();
  $('#planList').innerHTML = s.slides.map((sl, i) =>
    `<div class="plan-item ${i === s.current ? 'active' : ''}" data-i="${i}"><span>Slide ${i + 1}/${s.slides.length} · ${esc(sl.title)}</span><span>${sl.activities.map(a => `<span class="tag" data-run="${i}|${esc(a)}" title="Run ${esc(a)}">${esc(a.split(' ').map(w => w[0]).join(''))}</span>`).join('')}</span></div>`).join('');
  $$('#planList .plan-item').forEach(el => {
    el.onclick = ev => {
      const run = ev.target.closest('[data-run]');
      if (run) { const [i, a] = run.dataset.run.split('|'); s.current = +i; openActivity(a); renderSlide(); renderPlan(); return; }
      s.current = +el.dataset.i; renderSlide(); renderPlan();
    };
    el.ondragover = ev => { ev.preventDefault(); el.classList.add('active'); };
    el.ondragleave = () => renderPlan();
    el.ondrop = ev => { ev.preventDefault(); attach(+el.dataset.i, ev.dataTransfer.getData('text/plain')); };
  });
  $('#activityLib').innerHTML = ACTIVITY_TYPES.map(a => `<div class="plan-item act-card" draggable="true" data-a="${esc(a)}">⠿ ${esc(a)}</div>`).join('');
  $$('.act-card').forEach(c => c.ondragstart = ev => ev.dataTransfer.setData('text/plain', c.dataset.a));
  $('#slideFileName').textContent = s.slideFile ? `Slides: ${s.slideFile}` : 'No slides uploaded for this subject yet.';
}
function attach(i, type) {
  if (!ACTIVITY_TYPES.includes(type)) return;
  const s = subj();
  if (!s.slides[i].activities.includes(type)) s.slides[i].activities.push(type);
  s.current = i; renderPlan(); renderSlide(); openActivity(type);
}
function renderSlide() {
  const s = subj(), sl = s.slides[s.current];
  $('#weekTitle').textContent = s.isGrad ? `Week ${state.week}: ${GRAD.topics[state.week][0]}` : `Week ${state.week}: Persona`;
  $('#slideTitle').textContent = sl.title;
  $('#slideBody').textContent = sl.body + (sl.activities.length ? ` · Activities: ${sl.activities.join(', ')}` : '');
  $('#slideCount').textContent = `Slide ${s.current + 1}/${s.slides.length}`;
}
const dz = $('#dropzone');
dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
dz.ondragleave = () => dz.classList.remove('over');
dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); attach(subj().current, e.dataTransfer.getData('text/plain')); };
$('#prevSlide').onclick = () => { const s = subj(); s.current = Math.max(0, s.current - 1); renderSlide(); renderPlan(); };
$('#nextSlide').onclick = () => { const s = subj(); s.current = Math.min(s.slides.length - 1, s.current + 1); renderSlide(); renderPlan(); };
$('#uploadSlidesBtn').onclick = () => $('#slideFile').click();
$('#slideFile').onchange = e => { const f = e.target.files[0]; if (f) { subj().slideFile = f.name; renderPlan(); } e.target.value = ''; };
$('#activityBtn').onclick = () => { // opens the activity plan (focus the library)
  $('#plan').scrollTo({ top: 9999, behavior: 'smooth' });
  $('#activityLib').animate([{ background: 'var(--accent-soft)' }, { background: 'transparent' }], { duration: 900 });
};

/* ---------- floating windows ---------- */
function openActivity(type) {
  if (type === 'Q&A Session') return openQA();
  const s = subj(), id = 'act:' + type;
  if (state.floats[id]) { state.floats[id].el.classList.remove('min'); return; }
  const prompts = s.prompts[type]; let q = 0;
  const el = mkFloat(id, `(${type})`, 60 + Object.keys(state.floats).length * 30, 40 + Object.keys(state.floats).length * 30);
  const body = $('.float-body', el), foot = $('.float-foot', el);
  const draw = () => {
    const answers = STUDENTS.slice(0, 2 + (q % 3)).map((n, i) => `<div class="bubble"><small>${esc(n)}</small>${esc(['Interesting point.', 'I think it depends on the user.', 'Needs more research first.'][(q + i) % 3])}</div>`).join('');
    body.innerHTML = `<div class="q-text">Q${q + 1}/${prompts.length} · ${esc(prompts[q])}</div>${answers}`;
    $('.ctr', el).textContent = `Q${q + 1}/${prompts.length}`;
  };
  foot.innerHTML = '<button class="ghost" data-d="-1">Previous</button><span class="ctr muted"></span><button class="ghost" data-d="1">Next</button>';
  $$('[data-d]', foot).forEach(b => b.onclick = () => { q = Math.min(prompts.length - 1, Math.max(0, q + +b.dataset.d)); draw(); });
  draw();
}
function openQA() {
  const id = 'qa';
  if (state.floats[id]) { state.floats[id].el.classList.remove('min'); return; }
  const el = mkFloat(id, 'Questions & Answer', 420, 60);
  const draw = () => {
    const qs = [...subj().questions].sort((a, b) => b.askers.length - a.askers.length);
    $('.float-body', el).innerHTML = qs.map(q => `<div class="qa-row ${q.answered ? 'answered' : ''}">
      <div class="count" title="${esc(q.askers.join(', '))}">${q.askers.length}</div>
      <div><div class="q-text">${esc(q.text)}</div><div class="muted small">${q.askers.length} student${q.askers.length > 1 ? 's' : ''} asked</div>
      <div class="acts"><button class="ghost" data-id="${q.id}">${q.answered ? 'Reopen' : 'Mark answered'}</button></div></div></div>`).join('');
    $$('[data-id]', el).forEach(b => b.onclick = () => { const q = subj().questions.find(x => x.id === +b.dataset.id); q.answered = !q.answered; draw(); renderQaBadge(); });
  };
  el._redraw = draw; draw();
}
function mkFloat(id, title, x, y) {
  const el = document.createElement('div');
  el.className = 'float'; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.innerHTML = `<div class="float-head"><span class="ttl">${esc(title)}</span><button class="ctl" data-c="min" title="Minimize">–</button><button class="ctl" data-c="x" title="Close">✕</button></div><div class="float-body"></div><div class="float-foot"></div>`;
  $('#floats').appendChild(el); state.floats[id] = { el };
  $('[data-c=min]', el).onclick = () => el.classList.toggle('min');
  $('[data-c=x]', el).onclick = () => { el.remove(); delete state.floats[id]; };
  const head = $('.float-head', el);
  head.onpointerdown = e => {
    if (e.target.closest('.ctl')) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    head.setPointerCapture(e.pointerId);
    head.onpointermove = m => { el.style.left = (m.clientX - sx) + 'px'; el.style.top = (m.clientY - sy) + 'px'; };
    head.onpointerup = () => { head.onpointermove = null; };
  };
  return el;
}
function closeAllFloats() { Object.values(state.floats).forEach(f => f.el.remove()); state.floats = {}; }
function renderQaBadge() {
  const n = subj().questions.filter(q => !q.answered).reduce((t, q) => t + q.askers.length, 0);
  const b = $('#qaBadge'); b.textContent = n; b.classList.toggle('zero', n === 0);
}
$$('[data-open=qa]').forEach(b => b.onclick = openQA);

/* ---------- overview ---------- */
function renderOverview() {
  const sel = $('#weekSelect');
  sel.innerHTML = Array.from({ length: subj().isGrad ? 13 : 8 }, (_, i) => `<option value="${i + 1}" ${state.week === i + 1 ? 'selected' : ''}>Week ${i + 1}</option>`).join('');
  const w = subj().weeks[Math.min(state.week, subj().isGrad ? 13 : 8)];
  $('#ov-insight').innerHTML = w.los.map((lo, i) => {
    const cls = lo.pct >= 70 ? 'ok' : lo.pct >= 40 ? 'mid' : 'low';
    const txt = lo.pct >= 70 ? 'Understood' : lo.pct >= 40 ? 'Partly understood' : 'Not yet understood';
    return `<div class="lo" data-lo="${i}"><div class="lo-head"><span class="caret">▶</span><div class="name"><b>${esc(lo.id)}</b> · ${esc(lo.text)}</div><div class="meter"><i style="width:${lo.pct}%"></i></div><b>${lo.pct}%</b><span class="status ${cls}">${txt}</span></div>
      <div class="lo-body">${lo.evidence.map(ev => `<div class="evidence"><div class="q">${esc(ev.q)}</div>${ev.answers.map(a => `<div class="ans"><span class="who">${esc(a.who)}</span><span class="verdict ${a.ok ? 'y' : 'n'}">${a.ok ? 'Shows understanding' : 'Gap'}</span><span>${esc(a.a)}</span></div>`).join('')}</div>`).join('')}</div></div>`;
  }).join('');
  $$('.lo-head').forEach(h => h.onclick = () => h.parentElement.classList.toggle('open'));
  renderArtefacts();
}
function renderArtefacts() {
  const w = subj().weeks[Math.min(state.week, subj().isGrad ? 13 : 8)];
  $('#ov-artefacts').innerHTML = `<div class="art-tools"><label class="switch"><input type="checkbox" id="anonToggle" ${state.anon ? 'checked' : ''}> Anonymise student names</label><span class="muted small">${w.artefacts.length} uploads · Week ${state.week}</span></div>
    <div class="art-grid">${w.artefacts.map((a, i) => `<div class="art"><div class="thumb">${a.icon}</div><div class="meta"><b>${esc(a.title)}</b><div class="muted small">${state.anon ? 'Student ' + String.fromCharCode(65 + i) : esc(a.name)}</div></div></div>`).join('')}</div>`;
  $('#anonToggle').onchange = e => { state.anon = e.target.checked; renderArtefacts(); };
}
$('#weekSelect').onchange = e => { state.week = +e.target.value; syncGradWeek(); renderOverview(); renderSlide(); renderPlan(); };
$$('#ovTabs button').forEach(b => b.onclick = () => {
  $$('#ovTabs button').forEach(x => x.classList.toggle('active', x === b));
  $('#ov-insight').hidden = b.dataset.ov !== 'insight';
  $('#ov-artefacts').hidden = b.dataset.ov !== 'artefacts';
});

/* ---------- boot ---------- */
function syncGradWeek() { const s = subj(); if (s.isGrad && s.gradWeek !== state.week) { s.gradWeek = state.week; s.slides = gradSlides(state.week); s.current = 0; } }
function renderAll() { syncGradWeek(); renderSubjectMenu(); renderEmoji(); renderPlan(); renderSlide(); renderQaBadge(); if (!$('#view-overview').hidden) renderOverview(); }
function boot() { state.subjects.unshift(makeGradStudio()); state.subjectIdx = 0; renderAll(); }

/* ---------- window controls (non-mac) ---------- */
if (window.shell && window.shell.platform !== 'darwin') {
  $('#traffic').hidden = false;
  $$('.tl').forEach(b => b.onclick = () => window.shell.control(b.dataset.w));
}
