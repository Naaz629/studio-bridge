'use strict';
/* Studio Bridge - tutor app. Layout follows the Figma Make reference: top nav, live card, Q&A column, bottom bar. */

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = n => n === 'Anonymous' ? 'A' : n.split(' ').map(w => w[0]).join('');
const pad = n => String(n).padStart(2, '0');
function toast(m) { $('#toasts').innerHTML = `<div class="toast">${esc(m)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => $('#toasts').innerHTML = '', 2400); }

const lvState = (n, t) => { const p = n / t; return p >= .8 ? 'ok' : p >= .65 ? 'mid' : 'low'; };
const ST = { ok: ['On track', 'var(--good)', 'var(--good-s)'], mid: ['Watch', 'var(--mid)', 'var(--mid-s)'], low: ['Needs you', 'var(--live)', 'var(--live-soft)'], na: ['Not taught yet', 'var(--muted)', 'var(--line)'] };
const AVC = ['', 'sand', 'lav', 'dk', '', 'sand', 'lav'];

let V = 'live';
let si = 0; // subject index
const S = () => SUBJECTS[si];
const L = { open: null, reply: null, plan: true, qopen: true, react: false, subj: false, menu: false, dragging: false };
const O = { w: 6, s: 'tut', open: null, q: '', tab: 'lo', anon: false };
let A = null; // running activity { type, q }
let qid = 100;

/* ---------- window controls (non-mac frame) ---------- */
if (window.shell && window.shell.platform === 'darwin') document.body.classList.add('native-mac');
$('#dots').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b && window.shell) window.shell.control(b.dataset.w); });

/* ---------- shell ---------- */
const unanswered = () => S().qs.filter(q => q.st === 'open').length;
function render() {
  document.querySelectorAll('.nav [data-v]').forEach(b => b.dataset.v === V ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const s0 = S();
  $('#navLiveSub').textContent = `Week ${s0.liveWeek} in progress`; $('#navLive').dataset.tip = `Session · Week ${s0.liveWeek} in progress`;
  $('#view').innerHTML = V === 'live' ? live() : overview();
  courseBtn(); mainMenu(); botbar();
  if (V === 'live') { renderQP(); pulseDots(); }
}
/* The session flow is an ordered list of steps: slides and activities. */
function flowOf(s) {
  const n = slidesFor(s).length;
  if (!s.flow || s.flowN !== n) { s.flow = Array.from({ length: n }, (_, i) => ({ k: 's', i })); s.flowN = n; s.pos = 0; }
  if (s.pos == null || s.pos >= s.flow.length) s.pos = 0;
  return s.flow;
}
function syncA(s) { const it = flowOf(s)[s.pos]; A = it && it.k === 'a' ? { type: it.act, q: 0 } : null; }
function goTo(s, p) { const f = flowOf(s); s.pos = Math.max(0, Math.min(f.length - 1, p)); syncA(s); }
let pulseKey = '', pulseTimer = null;
function pulseDots() {
  const s = S(), key = si + '|' + s.pos + '|' + (A ? A.type + A.q : '');
  if (key === pulseKey) return;
  pulseKey = key;
  const on = document.querySelector('.dotsov i.on'); if (!on) return;
  clearTimeout(pulseTimer);
  setTimeout(() => on.classList.add('open'), 40);
  pulseTimer = setTimeout(() => document.querySelector('.dotsov i.on')?.classList.remove('open'), 2800);
}
function courseBtn() {
  const s = S();
  $('#course').innerHTML = `<button class="coursebtn" data-a="subj" data-tip="${esc(s.name)} · ${esc(s.code)}" aria-label="Change subject: ${esc(s.name)}" aria-expanded="${L.subj}"><span class="badge">${esc(s.badge)}</span></button>
  ${L.subj ? `<div class="menu subjmenu"><div class="mh"><b>Change subject</b></div>${SUBJECTS.map((x, i) => `<button data-a="pick" data-i="${i}" aria-checked="${i === si}"><span class="badge sm">${esc(x.badge)}</span><span><b>${esc(x.name)}</b><small>${esc(x.code)}</small></span>${i === si ? '<span class="tick">✓</span>' : ''}</button>`).join('')}</div>` : ''}`;
}
function mainMenu() {
  const m = $('#mainMenu'); m.hidden = !L.menu;
  m.innerHTML = `<button data-a="upload">Upload slides for ${esc(S().name)}</button><button data-a="end">End session</button>`;
}
function botbar() {
  const b = $('#botbar'), s = S();
  b.style.display = V === 'live' ? '' : 'none';
  b.className = 'botbar' + (L.plan ? ' open' : '');
  b.innerHTML = `<div class="barrow"><button class="${L.plan ? 'ptab flip' : 'bb planbtn'}" id="planbtn" data-a="toggleplan" aria-expanded="${L.plan}" aria-label="Session plan"><span>Session plan</span><i class="caret">${L.plan ? '▾' : '▴'}</i></button><div class="barright"><span class="spacer"></span>
  <button class="bb" data-a="toggleq" id="qbtn" aria-pressed="${L.qopen}">Activity <span class="bdg" id="bdg">${unanswered()}</span></button>
  <span class="bb reactlbl" aria-label="Class reactions appear here"><span class="reactemo">${EMOJIS.map(e => `<i data-k="${e.k}" data-tip="${e.l} · ${s.reactions[e.k]}">${e.e}</i>`).join("")}</span></span></div></div>`;
}
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function popBall(k) {
  const em = EMOJIS.find(x => x.k === k); if (!em) return;
  const ball = document.querySelector(`.reactemo i[data-k="${k}"]`); if (!ball) return;
  ball.dataset.tip = `${em.l} · ${S().reactions[k]}`;
  if (REDUCED) return;
  ball.classList.remove('pop'); void ball.offsetWidth; ball.classList.add('pop');
  ball.addEventListener('animationend', () => ball.classList.remove('pop'), { once: true });
}

/* ---------- live view ---------- */
const ARROW_L = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>';
const ARROW_R = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
function navOverlay(idx, total, canPrev, canNext) {
  const n = Math.min(total, 12), start = Math.max(0, Math.min(idx - 5, total - n));
  let dots = '';
  for (let i = start; i < start + n; i++) dots += i === idx ? `<i class="on"><b>${i + 1}</b></i>` : '<i></i>';
  return `<button class="navarrow l" data-a="prev" aria-label="Previous" ${canPrev ? '' : 'disabled'}>${ARROW_L}</button><button class="navarrow r" data-a="next" aria-label="Next" ${canNext ? '' : 'disabled'}>${ARROW_R}</button><div class="dotsov" aria-hidden="true">${dots}</div>`;
}
function slideCard(sl, s) {
  const f = flowOf(s), it = f[s.pos], cur = sl[Math.min(it.i, sl.length - 1)];
  const body = cur.img ? `<img class="simg" src="${esc(cur.img)}" alt="${esc(cur.t)}">` : `<div class="blank" title="${esc(cur.t)}">${s.upload ? '' : 'Upload slides to show them here'}</div>`;
  return `<div class="slidewrap2"><div class="slidepage">${body}${navOverlay(s.pos, f.length, s.pos > 0, s.pos < f.length - 1)}</div></div>`;
}
function actCard() {
  const s = S(), f = flowOf(s), m = ACT_META[A.type], p = PROMPTS[A.type];
  return `<div class="card2 actcard" style="background:${m.color}"><div class="ahead"><div><small>${A.type === 'Discussion Activity' ? 'DISCUSSION ACTIVITY' : 'ACTIVITY'}</small><h2>${esc(m.title)}</h2></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="abody"><small>QUESTION ${A.q + 1} OF ${p.length}</small><h3>${esc(p[A.q])}</h3><textarea placeholder="Add your thoughts here…" aria-label="Your thoughts"></textarea><div class="meta">${8 + A.q * 3} students have responded</div></div>
  ${navOverlay(A.q, p.length, A.q > 0 || s.pos > 0, A.q < p.length - 1 || s.pos < f.length - 1)}</div>`;
}
function planStrip(sl, s) {
  const f = flowOf(s), gap = p => `<div class="tgap" data-ins="${p}"></div>`;
  const tiles = f.map((it, p) => {
    if (it.k === 'a') { const m = ACT_META[it.act]; return gap(p) + `<div class="tile act ${p === s.pos ? 'on' : ''}" style="background:${m.color}" data-a="tile" data-i="${p}" data-ins="${p + 1}"><small>${pad(p + 1)}</small><span>${esc(m.tile)}</span><button class="tx" data-a="rmflow" data-i="${p}" aria-label="Remove activity">✕</button></div>`; }
    const th = sl[it.i] && sl[it.i].img; return gap(p) + `<div class="tile ${p === s.pos ? 'on' : ''} ${th ? 'hasimg' : ''}" data-a="tile" data-i="${p}" data-ins="${p + 1}">${th ? `<img class="tth" src="${esc(th)}" alt="">` : ''}<small>${pad(p + 1)}</small><span>Slide ${it.i + 1}/${sl.length}</span></div>`;
  }).join('') + gap(f.length);
  return `<section class="plan2 ${L.plan ? '' : 'collapsed'}"><div class="planclip"><div class="planbody"><h2 class="phead">Week ${s.liveWeek} studio flow</h2><div class="tiles">${tiles}</div>
  <div class="chips2">${ACTIVITY_TYPES.map(a => `<div class="achip2" draggable="true" data-act="${esc(a)}" style="background:${ACT_META[a].color}">${esc(a)}</div>`).join('')}<span class="meta" style="align-self:center">Drag an activity between slides to add it to the flow</span></div></div></div></section>`;
}
function live() {
  const s = S(), sl = slidesFor(s), t = s.topics[s.liveWeek]; flowOf(s);
  return `<div class="sess2 ${L.qopen ? '' : 'qclosed'}"><section class="left"><div class="wk"><div><small>WEEK ${s.liveWeek}</small><h1>${esc(t[0])}</h1></div></div>
  <div class="stagebox" data-ins="${s.pos + 1}">${A ? actCard() : slideCard(sl, s)}</div>${planStrip(sl, s)}</section>
  <aside class="rightcol" id="qp" aria-label="Questions and answers"></aside></div>`;
}
function renderQP() {
  const el = $('#qp'); if (!el) return;
  const s = S(), list = [...s.qs].sort((x, y) => (x.st === 'open' ? 0 : 1) - (y.st === 'open' ? 0 : 1) || y.up - x.up);
  el.innerHTML = `<div class="qh"><small>Activity</small><h2>Questions &amp; answers</h2></div>
  <div class="qrows">${list.map((q, i) => { const open = L.open === q.id, en = q.tr || q.text, green = q.seen || q.st !== 'open'; return `<div class="qr ${q.st !== 'open' ? 'done' : ''} ${q.seen ? 'seen' : ''}">
    <div class="qwrap"><div class="qrow"><button class="qn" data-a="qnum" data-q="${q.id}" aria-label="Mark question ${i + 1}">${pad(i + 1)}</button><button class="qtxt" data-a="qopen" data-q="${q.id}"><span class="qt">${esc(en)}</span>${q.tr ? `<span class="qorig">Original: ${esc(q.text)}</span>` : ''}</button></div>
    ${q.up ? `<span class="asked" title="${q.up} students asked">${q.up}</span>` : ''}</div>
    ${open ? `<div class="qd">
      <div class="meta">${esc(q.who)} · ${q.ago ? q.ago + ' min ago' : 'just now'} · ${q.same} same question</div>
      ${q.ans ? `<div class="box ans"><b>Dr. Priya Nair</b><p>${esc(q.ans)}</p></div>` : ''}
      ${q.st === 'open' ? `<form class="inl" data-q="${q.id}"><input placeholder="Type your answer…" aria-label="Answer"><button class="sm p">Post</button></form>` : `<div class="qacts"><button class="sm" data-a="reopen" data-q="${q.id}">Reopen</button></div>`}</div>` : ''}</div>`; }).join('') || '<div class="none">No questions yet.</div>'}</div>`;
  const bd = $('#bdg'); if (bd) bd.textContent = unanswered();
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



/* ---------- actions ---------- */
function insertAct(p, type) {
  if (!ACTIVITY_TYPES.includes(type)) return;
  const s = S(), f = flowOf(s); f.splice(p, 0, { k: 'a', act: type });
  s.pos = p; syncA(s); toast(`${ACT_META[type].title} added at step ${p + 1}`); render();
}
const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const modal = html => { $('#modal').innerHTML = `<div class="scrim" data-x><div class="sheet" role="dialog">${html}</div></div>`; };

document.addEventListener('click', e => {
  const nv = e.target.closest('.nav [data-v]'); if (nv) { V = nv.dataset.v === 'ov' ? 'ov' : 'live'; L.menu = L.subj = false; return render(); }
    const ss = e.target.closest('[data-ss]'); if (ss) { O.s = ss.dataset.ss; O.open = null; return render(); }
  const sd = e.target.closest('[data-s]'); if (sd) {
    const [oid, i] = sd.dataset.s.split('|'), o = findOut(oid), x = o.who[+i];
    return modal(`<h4>${esc(x[0])}</h4><div class="focus" style="background:var(--live-soft)"><small>${o.lo} · STUCK AT ${LVL[x[1]][0].toUpperCase()}</small>${esc(x[2])}</div><p class="sub" style="margin:0;font-size:12px">${esc(o.out)}</p><label class="k2" for="note">Add observation</label><textarea id="note"></textarea><div class="row"><button class="sm" data-x>Close</button><button class="sm p" data-save>Save</button></div>`);
  }
  if (e.target.closest('[data-save]')) { $('#modal').innerHTML = ''; return toast('Saved'); }
  if (e.target.matches('[data-x]') || e.target.closest('button[data-x]')) { $('#modal').innerHTML = ''; return; }
  const a = e.target.closest('[data-a]');
  if (!a) { if (L.menu || L.subj) { L.menu = L.subj = false; courseBtn(); mainMenu(); } if (e.target.closest('#burger')) { } return; }
  const s = S(), q = s.qs.find(x => x.id == a.dataset.q), act = a.dataset.a;
  const top = () => [...s.qs].filter(x => x.st === 'open').sort((x, y) => y.up - x.up)[0];
  switch (act) {
    case 'subj': L.subj = !L.subj; L.menu = false; break;
    case 'pick': si = +a.dataset.i; L.subj = false; syncA(S()); if (!S().weeks[O.w]) O.w = S().liveWeek in S().weeks ? S().liveWeek : +Object.keys(S().weeks)[0]; O.open = null; toast('Subject: ' + S().name); break;
    case 'toggleplan': L.plan = !L.plan; botbar(); document.querySelector('.plan2')?.classList.toggle('collapsed', !L.plan); return;
    case 'toggleq': { L.qopen = !L.qopen; document.querySelector('.sess2')?.classList.toggle('qclosed', !L.qopen); a.setAttribute('aria-pressed', L.qopen); return; }
    case 'end': L.menu = false; V = 'ov'; if (s.liveWeek in s.weeks) O.w = s.liveWeek; toast('Session ended · questions saved'); break;
    case 'prev': if (A && A.q > 0) A.q--; else goTo(s, s.pos - 1); break;
    case 'next': if (A && A.q < PROMPTS[A.type].length - 1) A.q++; else goTo(s, s.pos + 1); break;
    case 'tile': goTo(s, +a.dataset.i); break;
    case 'rmflow': { const f = flowOf(s), i = +a.dataset.i; f.splice(i, 1); if (i < s.pos) s.pos--; if (s.pos >= f.length) s.pos = f.length - 1; syncA(s); break; }
    case 'actclose': { const f = flowOf(s); goTo(s, s.pos < f.length - 1 ? s.pos + 1 : s.pos - 1); break; }
    case 'upload': L.menu = false; return $('#slideFile').click();
    case 'qnum': q.seen = !q.seen; renderQP(); return;
    case 'qopen': q.seen = true; L.open = L.open === q.id ? null : q.id; L.reply = L.open === q.id && q.st === 'open' ? q.id : null; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reply': L.reply = L.reply === q.id ? null : q.id; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reopen': q.st = 'open'; q.ans = null; renderQP(); return;
    case 'openlo': O.open = O.open === a.dataset.o ? null : a.dataset.o; break;
    case 'otab': O.tab = a.dataset.t; break;
    case 'anon': O.anon = a.checked; break;
    case 'tip': { const o = findOut(a.dataset.o); return modal(`<div class="k2">${o.lo} · Re-teach in 5 minutes</div><h4>${esc(o.out)}</h4><div class="focus" style="background:var(--tint)">${esc(o.tip)}</div><div class="row"><button class="sm p" data-x>Got it</button></div>`); }
    case 'group': { const o = findOut(a.dataset.o); toast('Small group: ' + o.who.slice(0, 4).map(w => w[0].split(' ')[0]).join(', ')); return; }
  }
  render();
});
$('#burger').addEventListener('click', e => { e.stopPropagation(); L.menu = !L.menu; L.subj = false; courseBtn(); mainMenu(); });
document.addEventListener('submit', e => {
  e.preventDefault(); const q = S().qs.find(x => x.id == e.target.dataset.q), v = e.target.querySelector('input').value.trim();
  if (!v) return; q.ans = v; q.st = 'ans'; L.reply = null; toast('Answer posted to the class'); renderQP();
});
document.addEventListener('change', e => { if (e.target.id === 'wk') { O.w = +e.target.value; O.open = null; render(); } });
/* ---------- slides: images, PDF pages and PowerPoint files, shown exactly as authored ---------- */
let pdfjsLib = null;
async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('./vendor/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', location.href).href;
  return pdfjsLib;
}
async function renderPdf(data, name) {
  const lib = await getPdfjs();
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  try { return await renderPdfPages(lib, data, name); } finally { window.requestAnimationFrame = raf; }
}
async function renderPdfPages(lib, data, name) {
  const doc = await lib.getDocument({ data: new Uint8Array(data) }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(2.5, 1800 / v0.width) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    out.push({ name: name + ' · ' + n, url: URL.createObjectURL(blob) });
    if (n % 5 === 0) toast('Preparing slides… ' + n + '/' + doc.numPages);
  }
  return out;
}
async function loadSlideFiles(files) {
  const s = S(), slides = [];
  toast('Preparing slides…');
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      if (f.type.startsWith('image/')) slides.push({ name: f.name, url: URL.createObjectURL(f) });
      else if (ext === 'pdf') slides.push(...await renderPdf(await f.arrayBuffer(), f.name));
      else if (ext === 'ppt' || ext === 'pptx') {
        if (!(window.shell && window.shell.pptxToPdf)) { toast('Export ' + f.name + ' as PDF and upload that'); continue; }
        const res = await window.shell.pptxToPdf(window.shell.pathFor(f));
        if (res.error) { toast(res.error); continue; }
        slides.push(...await renderPdf(res.data, f.name));
      } else toast('Upload a PDF, PowerPoint or image file');
    } catch (err) { console.error(err); toast('Could not open ' + f.name); }
  }
  if (!slides.length) return;
  s.upload = files.length === 1 ? files[0].name : files.length + ' files';
  s.uploads = slides; s.flow = null; s.pos = 0; A = null;
  toast(slides.length + ' slides loaded for ' + s.name); render();
}
$('#slideFile').addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) loadSlideFiles(files); });

/* drag & drop: activity chip -> plan tile or the live card */
document.addEventListener('dragstart', e => { const a = e.target.closest('[data-act]'); if (a) { e.dataTransfer.setData('text/plain', a.dataset.act); L.dragging = true; } });
document.addEventListener('dragend', () => { L.dragging = false; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const d = e.target.closest('[data-ins]'); if (d) { e.preventDefault(); document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); d.classList.add('over'); } });
document.addEventListener('drop', e => { const d = e.target.closest('[data-ins]'); if (!d) return; e.preventDefault(); L.dragging = false; insertAct(+d.dataset.ins, e.dataTransfer.getData('text/plain')); });

/* simulated live class: reactions and new questions */
const busy = () => V !== 'live' || L.reply || L.dragging || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.closest?.('.inl');
setInterval(() => { if (V !== 'live' || L.dragging) return; const k = EMOJIS[Math.floor(Math.random() * EMOJIS.length)].k; S().reactions[k]++; popBall(k); if (!busy() && Math.random() < .4) { const qs = S().qs; qs[Math.floor(Math.random() * qs.length)].up++; renderQP(); } }, 1300);
setInterval(() => { if (busy() || !POOLQ.length) return; const p = POOLQ.shift(), s = S(); s.qs.forEach(q => { q.ago++; }); s.qs.push({ id: qid++, who: p[0], av: p[1], text: p[2], tr: p[3], ago: 0, up: 1, same: 0, st: 'open' }); renderQP(); }, 25000);

render();
