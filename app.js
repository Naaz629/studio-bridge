'use strict';
/* Studio Bridge - tutor app. Layout and interaction model follow the "Studio Bridge Dashboard" artifact. */

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => n === 'Anonymous' ? 'A' : n.split(' ').map(w => w[0]).join('');
function toast(m) { $('#toasts').innerHTML = `<div class="toast">${esc(m)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => $('#toasts').innerHTML = '', 2400); }

const lvState = (n, t) => { const p = n / t; return p >= .8 ? 'ok' : p >= .65 ? 'mid' : 'low'; };
const ST = { ok: ['On track', 'var(--good)', 'var(--good-s)'], mid: ['Watch', 'var(--mid)', 'var(--mid-s)'], low: ['Needs you', 'var(--live)', 'var(--live-soft)'], na: ['Not taught yet', 'var(--muted)', 'var(--line)'] };
const AVC = ['', 'sand', 'lav', 'dk', '', 'sand', 'lav'];

let V = 'live';
let si = 0; // subject index
const S = () => SUBJECTS[si];
const L = { qt: 'all', reply: null, menu: false, q: '', plan: false, react: true, subj: false, dragging: false };
const O = { w: 6, s: 'tut', open: null, q: '', tab: 'lo', anon: false };
let qid = 100;
const floats = {};

/* ---------- window controls (non-mac frame) ---------- */
if (window.shell && window.shell.platform === 'darwin') document.body.classList.add('native-mac');
$('#dots').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b && window.shell) window.shell.control(b.dataset.w); });

/* ---------- render shell ---------- */
function render() {
  document.querySelectorAll('.nav [data-v]').forEach(b => b.dataset.v === V ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const s = S();
  $('#navLiveSub').textContent = `Week ${s.liveWeek} in progress`;
  $('#crumb').innerHTML = V === 'live' ? `<b>Live session</b><span>/</span><span class="sub">${esc(s.name)} · Week ${s.liveWeek}</span>` : `<b>Overview</b><span>/</span><span class="sub">${esc(s.name)} · Week ${O.w}</span>`;
  $('#srch').placeholder = V === 'live' ? 'Search questions' : 'Search students';
  $('#srch').value = V === 'live' ? L.q : O.q;
  $('#emojiBtn').setAttribute('aria-pressed', L.react);
  $('#activityBtn').setAttribute('aria-pressed', L.plan);
  $('#emojiBtn').style.display = $('#activityBtn').style.display = V === 'live' ? '' : 'none';
  $('#view').innerHTML = V === 'live' ? live() : overview();
  courseBtn();
  if (V === 'live') { renderReact(); renderQP(); }
}
function courseBtn() {
  const s = S();
  $('#course').innerHTML = `<button class="coursebtn" data-a="subj" aria-expanded="${L.subj}"><span class="badge">${esc(s.badge)}</span><span><b>${esc(s.name)}</b><small>${esc(s.code)} · ${esc(s.term)}</small></span><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
  ${L.subj ? `<div class="menu subjmenu"><div class="mh"><b>Change subject</b></div>${SUBJECTS.map((x, i) => `<button data-a="pick" data-i="${i}" aria-checked="${i === si}"><span class="badge sm">${esc(x.badge)}</span><span><b>${esc(x.name)}</b><small>${esc(x.code)}</small></span>${i === si ? '<span class="tick">✓</span>' : ''}</button>`).join('')}</div>` : ''}`;
}

/* ---------- live view ---------- */
function slideHTML() {
  const sl = slidesFor(S()), cur = sl[Math.min(S().slideIdx, sl.length - 1)];
  if (cur.img) return `<img src="${esc(cur.img)}" alt="${esc(cur.t)}">`;
  return `<div class="gen"><div class="art">${esc(S().name)}</div><div class="txt"><h3>${esc(cur.t)}</h3><p>${esc(cur.p || '')}</p></div></div>`;
}
function planHTML() {
  const s = S(), sl = slidesFor(s);
  return `<aside class="plan" aria-label="Activity plan"><div class="plan-head"><h2>Activity plan</h2><button class="sm" data-a="upload">⬆ Upload slides</button></div>
  <p class="meta">${s.upload ? `Slides: ${esc(s.upload)}` : `No slides uploaded for ${esc(s.name)} yet.`}</p>
  <div class="k2">Slides · drop an activity on one</div>
  <div class="plist">${sl.map((x, i) => `<div class="pi ${i === s.slideIdx ? 'on' : ''}" data-a="goto" data-i="${i}" data-drop="${i}"><span class="n">${i + 1}</span><span class="t">${esc(x.t)}</span><span class="chips">${(s.attach[i] || []).map(a => `<button class="achip" data-t="${esc(a)}" title="Run ${esc(a)}">${esc(a.split(/[ &]+/).map(w => w[0]).join(''))}</button>`).join('')}</span></div>`).join('')}</div>
  <div class="k2" style="margin-top:14px">Activities · drag onto a slide</div>
  <div class="plist">${ACTIVITY_TYPES.map(a => `<div class="pi act" draggable="true" data-act="${esc(a)}"><span class="n">⠿</span><span class="t">${esc(a)}</span></div>`).join('')}</div></aside>`;
}
function live() {
  const s = S(), total = slidesFor(s).length, t = s.topics[s.liveWeek];
  return `<div class="sess ${L.plan ? 'withplan' : ''}">
  ${L.plan ? planHTML() : ''}
  <div class="stagearea" data-drop="${s.slideIdx}">
   <div class="shd"><div><div class="eyebrow"><span class="dot"></span>Live now · Tutorial</div><h1 class="serif">Week ${s.liveWeek}: ${esc(t[0])}</h1><div class="meta">You're presenting · 38 of 42 students joined</div></div>
    <div class="more"><button class="morebtn" data-a="menu" aria-label="Session options" aria-expanded="${L.menu}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
    ${L.menu ? `<div class="menu"><button data-a="pausepoll">Send "still unsure?" check</button><button data-a="end">End session</button></div>` : ''}</div></div>
   <div class="slidewrap"><button class="arrow l" data-a="prev" aria-label="Previous slide" ${s.slideIdx === 0 ? 'disabled' : ''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg></button>
    <div class="slide">${slideHTML()}</div>
    <button class="arrow r" data-a="next" aria-label="Next slide" ${s.slideIdx >= total - 1 ? 'disabled' : ''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 6 6 6-6 6"/></svg></button></div>
   <div class="slidebar">${(s.attach[s.slideIdx] || []).map(a => `<button class="sm p" data-a="run" data-t="${esc(a)}">▶ ${esc(a)}</button>`).join('')}<span class="counter">${s.slideIdx + 1} / ${total} <span class="tag">Live</span></span></div>
   <div class="react" id="react"></div>
  </div>
  <aside class="qpanel" id="qp" aria-label="Student questions"></aside></div>`;
}
function renderReact() {
  const el = $('#react'); if (!el) return;
  const r = S().reactions, tot = Object.values(r).reduce((a, b) => a + b, 0), cp = Math.round(r.con / Math.max(1, tot) * 100);
  el.style.display = L.react ? '' : 'none';
  el.innerHTML = `<div class="lbl"><span class="on"></span><span><b>How is this landing?</b><small>Class reactions · only you see this</small></span></div>
   ${EMOJIS.map(e => `<span class="rbtn" data-k="${e.k}"><span class="e" style="background:${e.c}">${e.e}</span>${e.l}<span class="n">${r[e.k]}</span></span>`).join('')}
   <span class="rhint ${cp >= 20 ? 'warn' : ''}">${cp >= 20 ? cp + '% confused — pause and re-explain?' : 'Landing well · ' + cp + '% confused'}</span>`;
}
function qlist() {
  const s = S();
  let list = [...s.qs].sort((a, b) => (a.st === 'open' ? 0 : 1) - (b.st === 'open' ? 0 : 1) || b.up - a.up);
  if (L.qt === 'open') list = list.filter(q => q.st === 'open'); if (L.qt === 'done') list = list.filter(q => q.st !== 'open');
  const f = L.q.toLowerCase(); if (f) list = list.filter(q => (q.text + ' ' + (q.tr || '') + ' ' + q.who).toLowerCase().includes(f));
  if (!list.length) return '<div class="none">No questions here.</div>';
  return list.map(q => `<article class="q ${q.fresh ? 'new' : ''}" id="q${q.id}">
  <div class="qtop"><span class="av ${q.av}">${ini(q.who)}</span><span><b>${esc(q.who)}</b><small>${q.ago ? q.ago + ' min ago' : 'just now'}</small></span>
   <span class="st ${q.st === 'open' ? 'wait' : q.st}">${q.st === 'open' ? 'Waiting' : q.st === 'verbal' ? '🎙 Answered verbally' : '✓ Answered'}</span></div>
  <p class="qtext">${esc(q.text)}</p>
  ${q.tr ? `<div class="box tr"><div class="k">Translated · English</div>${esc(q.tr)}</div>` : ''}
  ${q.st === 'verbal' ? `<div class="box verbal">🎙<span><b>Answered verbally in class</b><small>You responded at ${esc(q.at)}</small></span></div>` : ''}
  ${q.ans ? `<div class="box ans"><div class="h"><span class="av dk" style="width:24px;height:24px;font-size:9px">PN</span><span><b>Dr. Priya Nair</b><small>Your answer</small></span></div><p>${esc(q.ans)}</p></div>` : ''}
  ${L.reply === q.id ? `<form class="inl" data-q="${q.id}"><input placeholder="Type an answer for the class…" aria-label="Answer"><button class="sm p">Post</button></form>` : ''}
  <div class="qfoot"><span class="v"><span class="asked" title="Students who asked">${q.up}</span> students asked · ${q.same} same question</span>
   ${q.st === 'open' ? `<button class="sm" data-a="verbal" data-q="${q.id}">🎙 Verbally</button><button class="sm p" data-a="reply" data-q="${q.id}">Answer</button>` : `<button class="sm" data-a="reopen" data-q="${q.id}">Reopen</button>`}</div></article>`).join('');
}
function renderQP() {
  const el = $('#qp'); if (!el) return;
  const s = S(), un = s.qs.filter(q => q.st === 'open').length;
  const top = [...s.qs].filter(q => q.st === 'open').sort((a, b) => b.up - a.up)[0];
  el.innerHTML = `<div class="qhead"><h2>Questions &amp; Answer</h2><span class="count ${un ? 'hot' : ''}" title="Unanswered">${un}</span></div>
  <div class="tabs" role="tablist">${[['all', 'All', s.qs.length], ['open', 'Unanswered', un], ['done', 'Answered', s.qs.length - un]].map(([k, l, n]) => `<button role="tab" aria-selected="${L.qt === k}" data-qt="${k}">${l}${k === 'all' ? '' : ` <span class="c">${n}</span>`}</button>`).join('')}</div>
  <div class="qlist">${qlist()}</div>
  <div class="composer"><div class="k">Up next</div><p>${top ? esc(top.tr || top.text) : 'All questions answered 🎉'}</p>
   <div class="crow"><button class="sm" data-a="verbalTop" ${un ? '' : 'disabled'}>🎙 Answered verbally</button><button class="sm p" data-a="replyTop" ${un ? '' : 'disabled'}>Answer</button></div></div>`;
}

/* ---------- overview ---------- */
function nextAssess(lo) { return S().assess.find(([w, , los]) => w >= O.w && los.includes(lo)); }
function findOut(id) { for (const sub of SUBJECTS) for (const W of Object.values(sub.weeks)) for (const ss of Object.values(W.sessions)) for (const o of ss.outs) if (o.id === id) return o; }
function outcomeCard(o) {
  const ulo = S().ulo, lv = Object.entries(o.lv), weak = lv.reduce((m, x) => x[1][0] / o.total < m[1][0] / o.total ? x : m);
  const need = o.who.filter(w => w[0].toLowerCase().includes(O.q.toLowerCase())), isOpen = O.open === o.id, st = lvState(weak[1][0], o.total);
  return `<article class="lo card"><div class="loh"><span class="lochip">${o.lo}</span><small>${esc(ulo[o.lo])}</small><span class="lost" style="background:${ST[st][2]};color:${ST[st][1]}">${ST[st][0]}</span></div>
  <h3>${esc(o.out)}</h3>
  <div class="lvls">${lv.map(([k, [n, src]]) => { const s2 = lvState(n, o.total); return `<div class="lvl ${k === weak[0] ? 'weak' : ''}"><div class="lt"><b>${LVL[k][0]}</b><span>${n}/${o.total}</span></div><div class="mbar"><i style="width:${Math.round(n / o.total * 100)}%;background:${ST[s2][1]}"></i></div><small>${esc(src)}</small></div>`; }).join('')}</div>
  <div class="gap"><span class="k2">Where it breaks</span><p><b>${LVL[weak[0]][0]}</b> is the weak step. ${esc(o.gap)}</p></div>
  <div class="loa"><button class="sm ${isOpen ? 'p' : ''}" data-a="openlo" data-o="${o.id}" aria-expanded="${isOpen}">See evidence · ${o.who.length} ${o.unit} need you ${isOpen ? '▴' : '▾'}</button><button class="sm" data-a="tip" data-o="${o.id}">Re-teach tip</button><button class="sm" data-a="group" data-o="${o.id}">Make a small group</button></div>
  ${isOpen ? `<div class="stu">${need.length ? need.map(([nm, l, note], i) => `<button class="s" data-s="${o.id}|${i}"><span class="av ${AVC[i % 7]}">${nm.startsWith('Team') ? 'T' + nm.split(' ')[1] : ini(nm)}</span><span><b>${esc(nm)}</b><small>${esc(note)}</small></span><span class="lvtag">Stuck at: ${LVL[l][0]}</span><em>›</em></button>`).join('') : '<div class="none">No matches</div>'}</div>` : ''}</article>`;
}
function artefactsHTML() {
  const s = S();
  return `<div class="art-tools"><label class="switch"><input type="checkbox" data-a="anon" ${O.anon ? 'checked' : ''}> Show anonymously</label><span class="meta">${s.artefacts.length} uploads · Week ${O.w}</span></div>
  <div class="art-grid">${s.artefacts.map(([nm, t, ic], i) => `<div class="art"><div class="thumb">${ic}</div><div class="am"><b>${esc(t)}</b><div class="meta">${O.anon ? 'Student ' + String.fromCharCode(65 + i) : esc(nm)}</div></div></div>`).join('')}</div>`;
}
function overview() {
  const s = S(), W = s.weeks[O.w] || s.weeks[Object.keys(s.weeks)[0]], S2 = W.sessions[O.s];
  return `<div class="ovw"><div class="ovh"><div><div class="eyebrow">Learning outcomes · Week ${O.w}</div><h1 class="serif">${esc(W.title)}</h1><p class="sub">Each session is checked against its unit outcomes: can students <b>know</b>, <b>apply</b> and <b>explain</b> it?</p></div>
  <select id="wk" aria-label="Week">${Object.keys(s.weeks).map(w => `<option value="${w}" ${+w === O.w ? 'selected' : ''}>Week ${w}</option>`).join('')}</select></div>
  <div class="seg2"><button data-a="otab" data-t="lo" aria-pressed="${O.tab === 'lo'}">Class insight</button><button data-a="otab" data-t="art" aria-pressed="${O.tab === 'art'}">Artefacts</button></div>
  ${O.tab === 'art' ? artefactsHTML() : `
  <div class="semester card"><div class="k2">Unit outcomes this semester</div><div class="los">${Object.keys(s.ulo).map(lo => { const t = W.trend[lo], na = nextAssess(lo); return `<div class="sem"><div class="semt"><span class="lochip">${lo}</span><span class="lost" style="background:${ST[t][2]};color:${ST[t][1]}">${ST[t][0]}</span></div><p>${esc(s.ulo[lo])}</p><small>${na ? `Next tested: <b>${esc(na[1])}</b> · Week ${na[0]}` : 'No more assessments'}</small></div>`; }).join('')}</div></div>
  <div class="sesstabs" role="tablist">${Object.entries(W.sessions).map(([k, v]) => `<button role="tab" aria-selected="${O.s === k}" data-ss="${k}"><b>${v.name}</b><small>${v.outs.map(o => o.lo).join(' · ')}</small></button>`).join('')}</div>
  <p class="topic"><b>${S2.name}:</b> ${esc(S2.topic)}</p><div class="loList">${S2.outs.map(outcomeCard).join('')}</div>`}</div>`;
}

/* ---------- floating activity windows ---------- */
function mkFloat(id, title, x, y) {
  if (floats[id]) { floats[id].classList.remove('min'); return null; }
  const el = document.createElement('div');
  el.className = 'float'; el.style.left = x + 'px'; el.style.top = y + 'px';
  el.innerHTML = `<div class="float-head"><span class="ttl">${esc(title)}</span><button class="ctl" data-c="min" title="Minimize">–</button><button class="ctl" data-c="x" title="Close">✕</button></div><div class="float-body"></div><div class="float-foot"></div>`;
  $('#floats').appendChild(el); floats[id] = el;
  el.querySelector('[data-c=min]').onclick = () => el.classList.toggle('min');
  el.querySelector('[data-c=x]').onclick = () => { el.remove(); delete floats[id]; };
  const head = el.querySelector('.float-head');
  head.onpointerdown = e => {
    if (e.target.closest('.ctl')) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop; head.setPointerCapture(e.pointerId);
    head.onpointermove = m => { el.style.left = (m.clientX - sx) + 'px'; el.style.top = (m.clientY - sy) + 'px'; };
    head.onpointerup = () => { head.onpointermove = null; };
  };
  return el;
}
function runActivity(type) {
  if (type === 'Q&A Session') { L.qt = 'open'; renderQP(); return toast('Q&A open · unanswered questions shown'); }
  const prompts = PROMPTS[type], n = Object.keys(floats).length; let q = 0;
  const el = mkFloat('act:' + type, `(${type})`, 90 + n * 28, 80 + n * 28); if (!el) return;
  const body = el.querySelector('.float-body'), foot = el.querySelector('.float-foot');
  const people = ['Amira K.', 'Ben T.', 'Chloe R.', 'Dev P.'], say = ['Interesting point.', 'I think it depends on the user.', 'Needs more research first.'];
  const draw = () => {
    body.innerHTML = `<div class="q-text">Q${q + 1}/${prompts.length} · ${esc(prompts[q])}</div>` + people.slice(0, 2 + q % 3).map((p, i) => `<div class="bubble"><small>${esc(p)}</small>${esc(say[(q + i) % 3])}</div>`).join('');
    el.querySelector('.ctr').textContent = `Q${q + 1}/${prompts.length}`;
  };
  foot.innerHTML = '<button class="sm" data-d="-1">Previous</button><span class="ctr meta"></span><button class="sm p" data-d="1">Next</button>';
  foot.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { q = Math.min(prompts.length - 1, Math.max(0, q + +b.dataset.d)); draw(); });
  draw();
}
function attach(i, type) {
  if (!ACTIVITY_TYPES.includes(type)) return;
  const s = S(); s.attach[i] = s.attach[i] || [];
  if (!s.attach[i].includes(type)) s.attach[i].push(type);
  s.slideIdx = i; render(); toast(`${type} added to slide ${i + 1}`);
}

/* ---------- events ---------- */
const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
document.addEventListener('click', e => {
  const chip = e.target.closest('.achip'); if (chip) return runActivity(chip.dataset.t);
  const nv = e.target.closest('.nav [data-v]'); if (nv) { V = nv.dataset.v; L.menu = false; L.subj = false; return render(); }
  const rb = e.target.closest('.rbtn'); if (rb) { S().reactions[rb.dataset.k]++; return renderReact(); }
  const ss = e.target.closest('[data-ss]'); if (ss) { O.s = ss.dataset.ss; O.open = null; return render(); }
  const sd = e.target.closest('[data-s]'); if (sd) {
    const [oid, i] = sd.dataset.s.split('|'), o = findOut(oid), x = o.who[+i];
    $('#modal').innerHTML = `<div class="scrim" data-x><div class="sheet" role="dialog" aria-label="${esc(x[0])}"><h4>${esc(x[0])}</h4><div class="focus" style="background:var(--live-soft)"><small>${o.lo} · STUCK AT ${LVL[x[1]][0].toUpperCase()}</small>${esc(x[2])}</div><p class="sub" style="margin:0;font-size:12px">${esc(o.out)}</p><label class="k2" for="note">Add observation</label><textarea id="note"></textarea><div class="row"><button class="sm" data-x>Close</button><button class="sm p" data-save>Save</button></div></div></div>`; return;
  }
  if (e.target.closest('[data-save]')) { $('#modal').innerHTML = ''; return toast('Observation saved'); }
  if (e.target.matches('[data-x]')) { $('#modal').innerHTML = ''; return; }
  const qt = e.target.closest('[data-qt]'); if (qt) { L.qt = qt.dataset.qt; return renderQP(); }
  if (e.target.closest('#emojiBtn')) { L.react = !L.react; return render(); }
  if (e.target.closest('#activityBtn')) { V = 'live'; L.plan = !L.plan; return render(); }
  const a = e.target.closest('[data-a]');
  if (!a) { if (L.menu || L.subj) { L.menu = false; L.subj = false; render(); } return; }
  const s = S(), q = s.qs.find(x => x.id == a.dataset.q), act = a.dataset.a;
  const top = () => [...s.qs].filter(x => x.st === 'open').sort((x, y) => y.up - x.up)[0];
  switch (act) {
    case 'subj': L.subj = !L.subj; L.menu = false; break;
    case 'pick': si = +a.dataset.i; L.subj = false; if (!S().weeks[O.w]) O.w = S().liveWeek in S().weeks ? S().liveWeek : +Object.keys(S().weeks)[0]; O.open = null; for (const k in floats) { floats[k].remove(); delete floats[k]; } toast('Subject: ' + S().name); break;
    case 'menu': L.menu = !L.menu; L.subj = false; break;
    case 'end': L.menu = false; V = 'ov'; if (s.liveWeek in s.weeks) O.w = s.liveWeek; toast('Session ended · questions saved'); break;
    case 'pausepoll': L.menu = false; toast('Check sent: "What are you still unsure about?"'); break;
    case 'prev': s.slideIdx = Math.max(0, s.slideIdx - 1); break;
    case 'next': s.slideIdx = Math.min(slidesFor(s).length - 1, s.slideIdx + 1); break;
    case 'goto': s.slideIdx = +a.dataset.i; break;
    case 'run': return runActivity(a.dataset.t);
    case 'upload': return $('#slideFile').click();
    case 'verbal': q.st = 'verbal'; q.at = now(); toast('Marked as answered verbally · students notified'); break;
    case 'verbalTop': { const t = top(); if (t) { t.st = 'verbal'; t.at = now(); toast('Marked as answered verbally · students notified'); } break; }
    case 'reply': L.reply = L.reply === q.id ? null : q.id; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'replyTop': { const t = top(); if (t) { L.qt = 'all'; L.reply = t.id; renderQP(); document.getElementById('q' + t.id)?.scrollIntoView({ block: 'center' }); document.querySelector('.inl input')?.focus(); } return; }
    case 'reopen': q.st = 'open'; q.ans = null; break;
    case 'openlo': O.open = O.open === a.dataset.o ? null : a.dataset.o; break;
    case 'otab': O.tab = a.dataset.t; break;
    case 'anon': O.anon = a.checked; break;
    case 'tip': { const o = findOut(a.dataset.o); $('#modal').innerHTML = `<div class="scrim" data-x><div class="sheet" role="dialog" aria-label="Re-teach tip"><div class="k2">${o.lo} · Re-teach in 5 minutes</div><h4>${esc(o.out)}</h4><div class="focus" style="background:var(--tint)">${esc(o.tip)}</div><div class="row"><button class="sm p" data-x>Got it</button></div></div></div>`; return; }
    case 'group': { const o = findOut(a.dataset.o); toast('Small group: ' + o.who.slice(0, 4).map(w => w[0].split(' ')[0]).join(', ')); break; }
  }
  if (V === 'live' && ['verbal', 'verbalTop', 'reopen'].includes(act)) return renderQP();
  render();
});
document.addEventListener('submit', e => {
  e.preventDefault(); const s = S(), q = s.qs.find(x => x.id == e.target.dataset.q), v = e.target.querySelector('input').value.trim();
  if (!v) return; q.ans = v; q.st = 'ans'; L.reply = null; toast('Answer posted to the class'); renderQP();
});
document.addEventListener('change', e => { if (e.target.id === 'wk') { O.w = +e.target.value; O.open = null; render(); } });
$('#slideFile').addEventListener('change', e => {
  const files = [...e.target.files], s = S(); if (!files.length) return;
  s.upload = files.length === 1 ? files[0].name : `${files.length} files`;
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (imgs.length) { s.uploads = imgs.map(f => ({ name: f.name, url: URL.createObjectURL(f) })); s.slideIdx = 0; }
  e.target.value = ''; toast(`Slides uploaded for ${s.name}`); render();
});
$('#srch').addEventListener('input', e => {
  if (V === 'live') { L.q = e.target.value; renderQP(); return; }
  O.q = e.target.value; if (O.q && !O.open) O.open = S().weeks[O.w].sessions[O.s].outs[0].id;
  render(); $('#srch').focus();
});
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); $('#srch').focus(); } });

/* drag & drop: activity -> slide row or the live slide */
document.addEventListener('dragstart', e => { const a = e.target.closest('[data-act]'); if (a) { e.dataTransfer.setData('text/plain', a.dataset.act); L.dragging = true; } });
document.addEventListener('dragend', () => { L.dragging = false; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); d.classList.add('over'); } });
document.addEventListener('drop', e => { const d = e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); L.dragging = false; attach(+d.dataset.drop, e.dataTransfer.getData('text/plain')); });

/* simulated live class: reactions and new questions */
const busy = () => V !== 'live' || L.reply || L.menu || L.dragging || document.activeElement?.id === 'srch' || document.activeElement?.closest?.('.inl');
setInterval(() => { if (busy()) return; const k = EMOJIS[Math.floor(Math.random() * EMOJIS.length)].k; S().reactions[k]++; renderReact(); if (Math.random() < .4) { const qs = S().qs; qs[Math.floor(Math.random() * qs.length)].up++; renderQP(); } }, 3500);
setInterval(() => { if (busy() || !POOLQ.length) return; const p = POOLQ.shift(), s = S(); s.qs.forEach(q => { q.ago++; q.fresh = 0; }); s.qs.push({ id: qid++, who: p[0], av: p[1], text: p[2], tr: p[3], ago: 0, up: 1, same: 0, st: 'open', fresh: 1 }); renderQP(); }, 25000);

render();
