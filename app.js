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
const O = { qp: 0, w: 6, s: 'tut', open: null, q: '', tab: 'lo', anon: false, folder: null };
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
  const oldStrip = document.querySelector('.planbody .tiles'), keepX = oldStrip ? oldStrip.scrollLeft : 0;
  $('#view').innerHTML = V === 'live' ? live() : overview();
  courseBtn(); mainMenu(); botbar();
  if (V === 'live') { renderQP(); pulseDots(); syncStrip(keepX); if (A && A.type === 'Q&A Session') qaScroll(); }
}
/* keep the Studio flow strip in step with the main screen: the current tile is always in view, and a manual scroll is kept while nothing changes */
let stripKey = '';
function syncStrip(keepX) {
  const strip = document.querySelector('.planbody .tiles'), on = strip && strip.querySelector('.tile.on'); if (!strip) return;
  const key = si + '|' + S().pos;
  strip.scrollLeft = keepX;
  if (key !== stripKey || (on && (on.offsetLeft < strip.scrollLeft || on.offsetLeft + on.offsetWidth > strip.scrollLeft + strip.clientWidth))) {
    if (on) strip.scrollLeft = on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
    stripKey = key;
  }
}
/* The session flow is an ordered list of steps: slides and activities. */
function flowOf(s) {
  const n = slidesFor(s).length;
  if (!s.flow || s.flowN !== n) { s.flow = Array.from({ length: n }, (_, i) => ({ k: 's', i })); s.flowN = n; s.pos = 0; }
  if (s.pos == null || s.pos >= s.flow.length) s.pos = 0;
  return s.flow;
}
function syncA(s) { const it = flowOf(s)[s.pos]; A = it && it.k === 'a' ? { type: it.act, q: 0 } : null; }
function goTo(s, p) { const f = flowOf(s); if (A && A.type === 'Q&A Session') L.qopen = false; /* leaving the Q&A page keeps the side column closed */ s.pos = Math.max(0, Math.min(f.length - 1, p)); syncA(s); }
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
  m.innerHTML = `<button data-a="upload">Upload slides for ${esc(S().name)}</button><button data-a="unitimport">⇩ Import unit outline…</button><button data-a="aisettings">✦ AI question writer…</button><button data-a="end">End session</button>`;
}
function botbar() {
  const b = $('#botbar'), s = S();
  b.style.display = V === 'live' ? '' : 'none';
  b.className = 'botbar' + (L.plan ? ' open' : '');
  b.innerHTML = `<div class="barrow"><button class="${L.plan ? 'ptab flip' : 'bb planbtn'}" id="planbtn" data-a="toggleplan" aria-expanded="${L.plan}" aria-label="Studio flow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/></svg><span>Studio flow</span><i class="caret">${L.plan ? '▾' : '▴'}</i></button><span class="spacer"></span>
  
  <span class="bb reactlbl" aria-label="Class reactions appear here"><span class="reactemo">${EMOJIS.map(e => `<i data-k="${e.k}" data-tip="${e.l} · ${s.reactions[e.k]}">${e.e}</i>`).join("")}</span></span></div>`;
}
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function popBall(k) {
  const em = EMOJIS.find(x => x.k === k); if (!em) return;
  const ball = document.querySelector(`.reactemo i[data-k="${k}"]`); if (!ball) return;
  ball.dataset.tip = `${em.l} · ${S().reactions[k]}`; const n = ball.querySelector('small'); if (n) n.textContent = S().reactions[k];
  if (REDUCED) return;
  ball.classList.remove('pop'); void ball.offsetWidth; ball.classList.add('pop');
  ball.addEventListener('animationend', () => ball.classList.remove('pop'), { once: true });
}

/* ---------- live view ---------- */
const ARROW_L = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>';
const ARROW_R = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
function navOverlay(idx, total, canPrev, canNext) {
  return `<nav class="presentation-arrows glass" aria-label="Move between steps"><button class="navarrow l" data-a="prev" aria-label="Previous" ${canPrev ? '' : 'disabled'}>${ARROW_L}</button><span class="pgnum"><b>${idx + 1}</b> / ${total}</span><button class="navarrow r" data-a="next" aria-label="Next" ${canNext ? '' : 'disabled'}>${ARROW_R}</button></nav>`;
}
function slideCard(sl, s) {
  const f = flowOf(s), it = f[s.pos], cur = sl[Math.min(it.i, sl.length - 1)];
  const lines = cur.text ? cur.text.split('\n').slice(1, 8) : [];
  const body = cur.img ? `<img class="simg" src="${esc(cur.img)}" alt="${esc(cur.t)}">` : cur.text ? `<div class="stext"><small>SLIDE ${it.i + 1} OF ${sl.length}</small><h2>${esc(cur.t)}</h2>${lines.length ? `<ul class="sbul">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>` : `<div class="blank" title="${esc(cur.t)}">${s.upload ? '' : 'Upload slides to show them here'}</div>`;
  return `<div class="slidewrap2"><div class="slidepage">${body}${navOverlay(s.pos, f.length, s.pos > 0, s.pos < f.length - 1)}</div></div>`;
}
function discussionCard(s, f, m, p) {
  const cards = DISCUSS_CARDS.map(c => `<div class="dcard" data-card="${c.k}" data-tip="${c.label} · ${s.cards[c.k]} students"><img src="${c.img}" alt="${c.label}"><span class="dcount">${s.cards[c.k]}</span></div>`).join('');
  return `<div class="card2 actcard discuss" style="background:${m.color}"><div class="ahead"><div><small>DISCUSSION ACTIVITY</small><h2>Discuss with your peers.</h2><p class="dsub">Use your cards to share what you think.</p></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="dwrap"><div class="dcards">${cards}</div></div>
  ${navOverlay(0, 1, s.pos > 0, s.pos < f.length - 1)}</div>`;
}
/* the question list for the running activity (Concept Development comes from Bloom's taxonomy) */
function actQs() {
  if (A.type === 'Concept Development') { const s = S(); return ensureCD(s, s.pos).qs.map(q => q.text); }
  if (A.type === 'Q&A Session') return sortedQs(S()).map(q => q.text);
  if (A.type === 'Artefact upload') return ['upload'];
  return PROMPTS[A.type];
}
/* ---------- Q&A Session: full-screen questions with the other students' answers arriving live ---------- */
const REPLY_BANK = [
  { t: 'I think yes, because the client knows the real needs.' },
  { t: 'We asked our client last week and they said to include it.' },
  { t: 'Maybe we can test it with two users first.' },
  { t: 'I am not sure. Can the tutor give an example?' },
  { t: 'In our team we wrote this in the brief.' },
  { t: '我们团队也遇到了同样的问题。', en: 'Our team has the same problem.', lang: 'Chinese' },
  { t: '我觉得应该先和客户确认。', en: 'I think we should check with the client first.', lang: 'Chinese' },
  { t: 'I agree with this question, we have the same problem.' }
];
const sortedQs = s => [...s.qs].sort((x, y) => (x.st === 'open' ? 0 : 1) - (y.st === 'open' ? 0 : 1) || y.up - x.up);
function qaReplies(q) {
  if (!q.replies) {
    const r = seeded(hash('qa' + q.id + q.text)), n = 2 + Math.floor(r() * 2);
    q.replies = shuffled(REPLY_BANK.map((_, i) => i), hash('rp' + q.id)).slice(0, n).map(k => Object.assign({ who: NAMES[(hash(q.text) + k) % NAMES.length] }, REPLY_BANK[k]));
  }
  return q.replies;
}
function qaListHTML(s) {
  const list = sortedQs(s), at = Math.max(0, Math.min(list.length - 1, A && A.q || 0)), sel = list[at] && list[at].id;
  const nm = (n, i) => O.anon ? 'Student ' + String.fromCharCode(65 + i) : n;
  return list.map((q, i) => [q, i]).filter(([q]) => q.id === sel).map(([q, i]) => `<div class="qablk sel" data-qb="${q.id}"><div class="qahd"><span class="qanum">${pad(i + 1)}</span><div class="qatxt"><b>${esc(q.tr || q.text)}</b>${q.tr ? `<small>Original: ${esc(q.text)}</small>` : ''}<small>${esc(q.who)} · ${q.ago ? q.ago + ' min ago' : 'just now'}</small></div>${q.up ? `<span class="asked">${q.up}</span>` : ''}</div>
    <div class="qaans">${qaReplies(q).map((r, k) => `<div class="qar"><b>${esc(nm(r.who, k))}</b><p>${esc(r.en || r.t)}</p>${r.lang ? origHTML(r.t, r.lang) : ''}</div>`).join('')}${q.ans ? `<div class="qar tutor"><b>Dr. Priya Nair</b><p>${esc(q.ans)}</p></div>` : ''}</div></div>`).join('') || '<div class="none">No questions yet.</div>';
}
function qaCard(s, f, m) {
  return `<div class="card2 actcard qacard" style="background:${m.color}"><div class="ahead"><div><small>ACTIVITY</small><h2>Questions &amp; answers</h2></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="qaline"><div class="qalist" id="qaList">${qaListHTML(s)}</div>
  <div class="qanums" aria-label="Questions">${sortedQs(s).map((q, i) => `<div class="qr ${q.st !== 'open' ? 'done' : ''} ${q.seen ? 'seen' : ''} ${(A.q || 0) === i ? 'selq' : ''}"><div class="qwrap"><div class="qrow"><button class="qn" data-a="qnum" data-q="${q.id}" aria-label="Question ${i + 1}">${pad(i + 1)}</button></div></div></div>`).join('')}</div></div>
  ${navOverlay(Math.min(A.q || 0, Math.max(0, sortedQs(s).length - 1)), Math.max(1, sortedQs(s).length), (A.q || 0) > 0 || s.pos > 0, (A.q || 0) < sortedQs(s).length - 1 || s.pos < f.length - 1)}</div>`;
}
function qaScroll() {}
/* ---------- Artefact upload: an image slideshow. Examples first, then each student's upload (name + type) as it arrives.
   Playing by itself; the tutor can stop on any artefact (click it, or pick it below) and it starts again after 2 minutes of no activity. ---------- */
const EXAMPLE_ARTS = [['Business model canvas', 'assets/artefacts/bmc-1.svg'], ['Value proposition canvas', 'assets/artefacts/vpc-2.svg']];
const ART_IDLE = 120000;
const artHeld = () => !!(A && A.hold && Date.now() - A.hold < ART_IDLE);
function artItems(s) { return EXAMPLE_ARTS.map(([t, src]) => ({ ex: true, t, src })).concat((s.liveArts || []).map(e => ({ n: artLabel(e), t: e[1], src: e[2] }))); }
function artefactCard(s, f, m) {
  const items = artItems(s), at = Math.max(0, Math.min(items.length - 1, A.q || 0)), it = items[at];
  const dots = items.map((x, i) => `<button class="artdot ${i === at ? 'on' : ''}" data-a="artpick" data-i="${i}" aria-label="Show ${esc(x.t)} ${i + 1}"></button>`).join('');
  return `<div class="card2 actcard artcard" style="background:${m.color}"><h2 class="arttitle">Upload your artefact</h2><button class="x artx" data-a="actclose" aria-label="Close activity">✕</button>
  <div class="artshow" id="artLive" data-a="artpause" title="Click to stop here">${artSlideHTML(it)}</div>
  <div class="artbar"><span class="artstate">${artHeld() ? 'Stopped' : ''}</span><div class="artdots">${dots}</div></div>
  ${navOverlay(0, 1, true, true)}</div>`;
}
function artSlideHTML(it) {
  const cap = it.ex ? `<span class="extag">Example</span><b>${esc(it.t)}</b>` : `<b>${esc(it.n)}</b><span>${esc(it.t)}</span>`;
  return `<div class="artslide"><div class="artimg">${artPic(it.src)}</div><div class="artcap">${cap}</div></div>`;
}
/* artefacts are image files */
function artPic(src) { return String(src).startsWith("assets/") ? `<img class="artpic" src="${esc(src)}" alt="" draggable="false">` : src; }
function actCard() {
  const s = S(), f = flowOf(s), m = ACT_META[A.type], p = actQs();
  if (A.type === 'Discussion Activity') return discussionCard(s, f, m, p);
  if (A.type === 'Concept Development') return cdCard(s, f, m);
  if (A.type === 'Q&A Session') return qaCard(s, f, m);
  if (A.type === 'Artefact upload') return artefactCard(s, f, m);
  return `<div class="card2 actcard" style="background:${m.color}"><div class="ahead"><div><small>ACTIVITY</small><h2>${esc(m.title)}</h2></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="abody"><small>QUESTION ${A.q + 1} OF ${p.length}</small><h3>${esc(p[A.q])}</h3><textarea placeholder="Add your thoughts here…" aria-label="Your thoughts"></textarea><div class="meta">${8 + A.q * 3} students have responded</div></div>
  ${navOverlay(A.q, p.length, A.q > 0 || s.pos > 0, A.q < p.length - 1 || s.pos < f.length - 1)}</div>`;
}
function planStrip(sl, s) {
  const f = flowOf(s), gap = p => `<div class="tgap" data-ins="${p}"></div>`;
  const tiles = f.map((it, p) => {
    if (it.k === 'a') { const m = ACT_META[it.act]; return gap(p) + `<div class="tile act ${p === s.pos ? 'on' : ''}" style="background:${m.color}" data-a="tile" data-i="${p}" data-ins="${p + 1}"><small>${pad(p + 1)}</small><span>${esc(m.tile)}</span><button class="tx" data-a="rmflow" data-i="${p}" aria-label="Remove activity">✕</button></div>`; }
    const cur = sl[Math.min(it.i, sl.length - 1)] || {};
    const thumb = cur.img ? `<img src="${esc(cur.img)}" alt="" draggable="false">` : cur.text ? `<div class="ttext"><b>${esc(cur.t)}</b><span>${esc((cur.text.split(String.fromCharCode(10))[1] || ''))}</span></div>` : `<div class="ttext"><b>${esc(cur.t || 'Slide ' + (it.i + 1))}</b></div>`;
    return gap(p) + `<div class="tile slide ${p === s.pos ? 'on' : ''}" data-a="tile" data-i="${p}" data-ins="${p + 1}" title="${esc(cur.t || '')}"><div class="tthumb">${thumb}</div><small class="tnum">${pad(p + 1)}</small></div>`;
  }).join('') + gap(f.length);
  return `<section class="plan2 ${L.plan ? '' : 'collapsed'}"><div class="planclip"><div class="planbody"><h2 class="phead">Studio flow</h2><div class="tiles">${tiles}</div>
  <div class="chips2">${ACTIVITY_TYPES.map(a => `<div class="achip2" draggable="true" data-act="${esc(a)}" style="background:${ACT_META[a].color}">${esc(a)}</div>`).join('')}</div></div></div></section>`;
}
/* the heading is the title of the slide on screen (the last slide shown while an activity is open) */
function slideTitle(s, sl, fallback) {
  const f = flowOf(s); let p = s.pos; while (p > 0 && f[p].k !== 's') p--;
  const cur = f[p] && f[p].k === 's' ? sl[Math.min(f[p].i, sl.length - 1)] : null;
  let t = cur ? String(cur.title || cur.t || '').replace(/^[•·*–— -]+/, '').replace(/[ ]+/g, ' ').trim() : '';
  if (/recognise and pay respect|acknowledg/i.test(t)) t = 'Acknowledgement of Country';
  if (!t || /^slide [0-9]+$/i.test(t) || /[.](pdf|pptx?)/i.test(t)) t = fallback || 'Studio';
  return t.length > 70 ? t.slice(0, 68).trim() + '…' : t;
}
function live() {
  const s = S(), sl = slidesFor(s), t = s.topics[s.liveWeek]; flowOf(s);
  const qa = A && A.type === 'Q&A Session';
  return `<div class="livewrap"><div class="crumbbar"><h1 class="crumbtitle">${esc(slideTitle(s, sl, t[0]))}</h1><span class="spacer"></span>
  <button class="qtoggle" data-a="toggleq" id="qbtn" aria-pressed="${L.qopen}" aria-label="Questions and activities" data-tip="Questions &amp; activities"><svg class="bulb" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#f5cf2a" stroke-width="3.4" stroke-linecap="round"><path d="M32 4v6"/><path d="M12.5 12l4.2 4.2"/><path d="M51.5 12l-4.2 4.2"/><path d="M4 31h6"/><path d="M54 31h6"/><path d="M12.5 50l4.2-4.2"/><path d="M51.5 50l-4.2-4.2"/></g><path d="M32 14c-8.3 0-14.5 6-14.5 14 0 5 2.6 8.6 5.2 11.4 1.2 1.3 1.8 2.8 1.8 4.6h15c0-1.8.6-3.3 1.8-4.6 2.6-2.8 5.2-6.4 5.2-11.4 0-8-6.2-14-14.5-14z" fill="#f7d63a"/><path d="M44 24c1.6 6-1 10.6-4.4 14.4-1.2 1.3-1.8 2.8-1.8 4.6h4.4c0-1.8.6-3.3 1.8-4.6 2.6-2.8 5.2-6.4 5.2-11.4 0-1.2-.2-2.4-.6-3.5z" fill="#f2b705"/><path d="M24 22c1.2-2.6 3.4-4.2 6-4.6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".85"/><g fill="#5b5b5b"><rect x="24.5" y="48" width="15" height="3.4" rx="1.7"/><rect x="25.5" y="52.5" width="13" height="3.4" rx="1.7"/><rect x="27.5" y="57" width="9" height="3.4" rx="1.7"/></g></svg></button></div>
  <div class="sess2 ${L.qopen || qa ? '' : 'qclosed'} ${qa ? 'qamode' : ''} ${qa && L.qside ? 'qside' : ''}"><section class="left">
  <div class="stagebox" data-ins="${s.pos + 1}">${A ? actCard() : slideCard(sl, s)}</div>${transPanel(s, sl)}${planStrip(sl, s)}</section>
  <aside class="rightcol" id="qp" aria-label="Questions and activities"></aside></div></div>`;
}
/* live translation: what the tutor says or shows, in English and Simplified Chinese, with the class reactions beside it */
const TR_EXAMPLE = ['A persona should reflect patterns in your research, not assumptions about your users.', '用户画像应体现研究中发现的共性，而不是你对用户的主观假设。'];
function liveLine(s, sl) {
  const it = flowOf(s)[s.pos], cur = it && it.k === 's' ? sl[Math.min(it.i, sl.length - 1)] : null;
  const line = cur && cur.text ? String(cur.text).split('\n').map(x => x.trim()).find(x => x.split(' ').length >= 6 && !/acknowledg|gadigal|copyright|click to edit|master text/i.test(x)) : '';
  return line || '';
}
function transPanel(s, sl) {
  const en = liveLine(s, sl) || TR_EXAMPLE[0];
  return `<div class="capline"><p class="cap">${esc(en)}</p></div>`;
}
/* which slide a question was asked on (new questions: the slide on screen; the examples get a fixed one) */
function qSlide(q) {
  if (q.slide == null) {
    const s0 = S(), n = Math.max(1, slidesFor(s0).length), f = flowOf(s0); let p = s0.pos; while (p > 0 && f[p].k !== 's') p--;
    q.slide = q.ago ? 1 + hash(q.text) % n : (f[p] && f[p].k === 's' ? f[p].i + 1 : 1);
  }
  return q.slide;
}
function renderQP() {
  const el = $('#qp'); if (!el) return;
  const s = S(), q0 = String(L.qsearch || '').trim().toLowerCase(), list = [...s.qs].filter(q => !q0 || (q.text + ' ' + (q.tr || '') + ' ' + q.who).toLowerCase().includes(q0)).sort((x, y) => (x.st === 'open' ? 0 : 1) - (y.st === 'open' ? 0 : 1) || y.up - x.up);
  const nOpen = s.qs.filter(q => q.st === 'open').length, nAns = s.qs.length - nOpen, qf = L.qf === 'open' || L.qf === 'ans' ? L.qf : 'all';
  const head0 = `<div class="rhead"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><b>Questions</b><i class="cnt">${s.qs.length}</i></div>`;
  const head = head0 + `<div class="qtabs" role="tablist"><button class="qtab ${qf === 'all' ? 'on' : ''}" data-a="qfilter" data-f="all">All</button><button class="qtab ${qf === 'open' ? 'on' : ''}" data-a="qfilter" data-f="open">Unanswered <i>${nOpen}</i></button><button class="qtab ${qf === 'ans' ? 'on' : ''}" data-a="qfilter" data-f="ans">Answered <i>${nAns}</i></button></div>`;
  el.innerHTML = head + `<div class="qrows">${list.filter(q => qf === 'all' || (qf === 'open' ? q.st === 'open' : q.st !== 'open')).map((q, i) => {
    const open = L.open === q.id && !(A && A.type === 'Q&A Session'), shown = q.tr && !q.showOrig ? q.tr : q.text, sn = qSlide(q);
    return `<div class="qr ${q.st !== 'open' ? 'done' : ''} ${q.seen ? 'seen' : ''} ${A && A.type === 'Q&A Session' && (A.q || 0) === i ? 'selq' : ''}">
    <div class="qwrap"><div class="qrow qhead"><button class="qn" data-a="qnum" data-q="${q.id}" aria-label="Mark question ${i + 1}">${pad(i + 1)}</button>
      <div class="qwho"><b>${esc(q.who)}</b><small>${q.ago ? q.ago + ' min ago' : 'just now'}</small></div>
      <button class="qvote ${q.voted ? 'on' : ''}" data-a="qup" data-q="${q.id}" aria-label="Upvote this question" aria-pressed="${!!q.voted}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>${q.up + (q.voted ? 1 : 0)}</span></button>
      <button class="qreply ${q.st !== 'open' ? 'on' : ''}" data-a="qreply" data-q="${q.id}" aria-pressed="${q.st !== 'open'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>Reply</span></button>
</div>
    <div class="qtline"><button class="qtxt qtext2" data-a="${q.tr ? 'qorig' : 'qopen'}" data-q="${q.id}"><span class="qt ${q.tr && q.showOrig ? 'zhtxt' : ''}">${esc(shown)}</span></button>
      ${q.st !== 'open' ? '<span class="qmic" title="Answered"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span>' : ''}
      <button class="qslide" data-a="qslide" data-n="${sn}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg><span>Slide ${sn}</span><i>›</i></button></div>
    ${q.tr ? `<button class="qoriglink" data-a="qorig" data-q="${q.id}">${q.showOrig ? 'English' : 'Original'}</button>` : ''}</div>
    ${open ? `<div class="qd"><div class="meta">${esc(q.who)} · ${q.ago ? q.ago + ' min ago' : 'just now'}</div>${q.st !== 'open' ? `<div class="qacts"><button class="sm" data-a="reopen" data-q="${q.id}">Reopen</button></div>` : ''}</div>` : ''}</div>`;
  }).join('') || '<div class="none">No questions yet.</div>'}</div>`;
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
/* a file is named after the student, or the group name or number; an anonymous upload is just Student # or Group # */
function artLabel(entry) {
  const [nm, , , anon, group] = entry, i = S().artefacts.indexOf(entry);
  if (group) return group;
  return anon ? 'Student ' + (i + 1) : nm;
}
/* artefacts are kept in one folder per type of artefact; a folder opens to its images */
function artefactFolders() {
  const m = new Map();
  S().artefacts.forEach(x => { if (!m.has(x[1])) m.set(x[1], []); m.get(x[1]).push(x); });
  return [...m.entries()];
}
function artefactsHTML() {
  const folders = artefactFolders(), open = O.folder && folders.find(([t]) => t === O.folder);
  if (open) {
    return `<div class="foldhead"><button class="sm" data-a="ofolderback" aria-label="Back to folders">‹ Folders</button><b>${esc(open[0])}</b><span class="meta">${open[1].length} files</span></div>
    <div class="art-grid">${open[1].map(x => `<div class="art"><div class="thumb">${artPic(x[2])}</div><div class="am"><b>${esc(artLabel(x))}</b></div></div>`).join('')}</div>`;
  }
  return `<div class="folder-grid">${folders.map(([t, list]) => `<button class="folder" data-a="ofolder" data-f="${esc(t)}"><span class="ftab"></span><span class="fbody"><span class="fpeek">${list.slice(0, 3).map(x => `<span class="fp">${artPic(x[2])}</span>`).join('')}</span><b>${esc(t)}</b><span class="meta">${list.length} files</span></span></button>`).join('')}</div>`;
}
/* Overview: Student Activity (one box per learning outcome) beside Artefacts; an LO opens a green card with its Questions & Answer and Your take */
function weekOutcomes() {
  const s = S(), W = s.weeks[O.w] || s.weeks[Object.keys(s.weeks)[0]];
  const key = W.sessions[O.s] ? O.s : Object.keys(W.sessions)[0];
  return { W, key, outs: W.sessions[key].outs };
}
function loBox(o, open) {
  const lv = Object.entries(o.lv);
  return `<div class="lowrap"><div class="lolabel">${esc(o.lo)}</div>
  <button class="lobox ${open ? 'open' : ''}" data-a="olo" data-o="${esc(o.id)}" aria-expanded="${open}">
    <span class="lotext">${esc(S().ulo[o.lo] || o.out)}</span>
  </button></div>`;
}
/* the learning-outcome panel docks on the right of the Overview (no overlay): an AI class insight, who is stuck and why, then a section that opens to the questions and answers */
const STUCK_PHRASE = { k: 'Recalling the main idea', a: 'Using the idea in their own project', e: 'Explaining why it matters' };
function loTakes(o) { return shuffled(SAMPLES.map((_, k) => k), hash(o.id)).slice(0, 3); }
function ensureInsight(o) {
  if (o.insight) return o.insight;
  const ai = (window.shell && window.shell.ai) || window.demoAI;
  if (!ai || !ai.insight) return (o.insight = { state: 'off', error: 'The AI summary runs in the desktop app.' });
  o.insight = { state: 'pending' };
  const lv = Object.entries(o.lv);
  const weak = lv.reduce((m, x) => x[1][0] / o.total < m[1][0] / o.total ? x : m);
  ai.insight({ weakest: LVL[weak[0]][0] + ' (' + LVL[weak[0]][1].toLowerCase() + ')', stuckN: o.total - weak[1][0], lo: o.lo, out: S().ulo[o.lo] || o.out, week: O.w, total: o.total,
    levels: lv.map(([k, [n, src]]) => ({ label: LVL[k][0], n, src })),
    notes: [...new Set(o.who.map(w => w[2]))], takes: loTakes(o).map(k => SAMPLES[k].en || SAMPLES[k].t),
    gaps: Object.entries(loAnswers(o)).flatMap(([k, list]) => list.filter(a => !a.ok).map(a => LVL[k][0] + ': ' + (a.en || a.t))), goods: Object.entries(loAnswers(o)).flatMap(([k, list]) => list.filter(a => a.ok).slice(0, 1).map(a => LVL[k][0] + ': ' + (a.en || a.t))) })
    .then(r => { o.insight = r.summary ? { state: 'ready', summary: r.summary, stuck: r.stuck, why: r.why } : { state: r.off ? 'off' : 'error', error: r.error }; })
    .catch(e => { o.insight = { state: 'error', error: e.message }; })
    .then(() => { if (V === 'ov' && O.open === o.id) render(); });
  return o.insight;
}
/* sample class answers for one outcome (until students are connected): each level is a question topic with students' answers under it */
const ANS_GOOD = {
  k: [{ t: 'A finding says what the evidence shows.' }, { t: 'It is the main idea from the slide.' }, { t: 'We use evidence, not guesses.' }, { t: 'It is what we saw in the interviews.' }],
  a: [{ t: 'In my project, users skip long readings, so we made them shorter.' }, { t: '我们用访谈证据重写了问题。', en: 'We rewrote the problem using interview evidence.', lang: 'Chinese' }, { t: 'I tested it with two users from my team.' }, { t: 'We used it to fix our brief.' }],
  e: [{ t: 'It matters because it shows what users really need.' }, { t: 'It stops us building the wrong thing.' }, { t: 'Because evidence makes our choice stronger.' }, { t: '这很重要，因为它显示了真实的需求。', en: 'It is important because it shows the real need.', lang: 'Chinese' }]
};
const ANS_BAD = {
  k: [{ t: 'Not sure.' }, { t: 'I missed this one.' }, { t: 'I think it is a kind of survey?' }],
  a: [{ t: 'I could not link it to my project.' }, { t: 'We have not tried it yet.' }, { t: 'No example yet.' }],
  e: [{ t: 'It is important.' }, { t: 'Because the tutor said so.' }, { t: '这对项目很重要。', en: 'It is important for the project.', lang: 'Chinese' }]
};
/* the heading of each page is the question that was asked in the concept check (the AI-written one when there is one) */
const QTOPIC = { k: 'What is the main idea of this lesson?', a: 'Give one example of using this idea in your own project.', e: 'Why does this idea matter for your project?', t: 'Write one or two sentences that use this idea in your own project.' };
const CD_AT = { k: 0, a: 1, e: 3, t: 4 };
function askedQuestion(k) {
  const s = S(), cd = flowOf(s).map(x => x.cd).filter(c => c && c.state === 'ready' && c.qs && c.qs.length).pop();
  return (cd && cd.qs[CD_AT[k]] && cd.qs[CD_AT[k]].text) || QTOPIC[k];
}
function loAnswers(o) {
  if (o.answers) return o.answers;
  const r = seeded(hash(o.id + 'ans')), team = o.unit === 'teams', out = {};
  const pool = team ? Array.from({ length: 10 }, (_, i) => 'Team ' + (i + 1)) : NAMES;
  for (const [k, [n]] of Object.entries(o.lv)) {
    const shown = Math.min(8, o.total), good = Math.round(n / o.total * shown), names = shuffled(pool.map((_, i) => i), hash(o.id + k));
    out[k] = Array.from({ length: shown }, (_, i) => {
      const ok = i < good, bank = (ok ? ANS_GOOD : ANS_BAD)[k];
      return Object.assign({ who: pool[names[i % pool.length]], ok }, bank[Math.floor(r() * bank.length)]);
    }).sort(() => r() - .5);
  }
  return (o.answers = out);
}
function qaPages(o) {
  const lv = Object.entries(o.lv), ans = loAnswers(o);
  const pages = lv.map(([k, [n, src]]) => ({ k, title: LVL[k][0], topic: askedQuestion(k), src, n, total: o.total, answers: ans[k] }));
  pages.push({ k: 'take', title: 'Your take', topic: askedQuestion('t'), src: 'Class discussion', answers: null });
  return pages;
}
/* answers written in another language are shown in English first; the original is one tap away */
function origHTML(t, lang) { return `<details class="orig"><summary>Original</summary><span lang="${'zh-Hans'}">${esc(t)}</span></details>`; }
function loPanel(o) {
  const s = S(), anon = O.anon;
  const lv = Object.entries(o.lv), weak = lv.reduce((m, x) => x[1][0] / o.total < m[1][0] / o.total ? x : m);
  const stuckN = o.total - weak[1][0], ins = ensureInsight(o);
  const lo1 = (s.ulo[o.lo] || o.out).replace(/[.]$/, ''), loBit = lo1.split(/[ ]+/).slice(0, 6).join(' ').toLowerCase();
  const topic = ins.state === 'ready' && ins.stuck ? ins.stuck : 'Struggle to ' + loBit;
  const why = '';
  const insBody = ins.state === 'pending' ? '<p class="aiflag busy">✦ The AI is reading the class results…</p>'
    : ins.state === 'ready' ? `<p class="insight-text">${esc(ins.summary)}</p><small class="muted">✦ AI summary · based on this week's results</small>`
    : `<p class="insight-text muted">${ins.state === 'off' ? 'AI is turned off, so there is no written summary.' : 'The AI could not write the summary: ' + esc(ins.error || '')}</p><div class="qacts">${ins.state === 'off' ? '<button class="sm p" data-a="aisettings">✦ Choose AI</button>' : '<button class="sm p" data-a="oinsightretry">↻ Try again</button>'}</div>`;
  const pages = qaPages(o), pi = Math.max(0, Math.min(O.qp || 0, pages.length - 1)), pg = pages[pi];
  const who = (n, i) => anon ? (n.startsWith('Team') ? n : 'Student ' + String.fromCharCode(65 + i)) : n;
  const body = pg.answers
    ? `<div class="qahead"><b>${esc(pg.topic)}</b><small>${pg.n} of ${pg.total} got it right</small></div>
       <div class="anslist">${pg.answers.map((a, i) => `<div class="ans2 ${a.ok ? 'good' : 'gap'}"><span class="ansmark">${a.ok ? '✓' : '!'}</span><div><b>${esc(who(a.who, i))}</b><p>${esc(a.en || a.t)}</p>${a.lang ? origHTML(a.t, a.lang) : ''}</div></div>`).join('')}</div>`
    : `<div class="qahead"><b>${esc(pg.topic)}</b></div>
       <div class="anslist">${loTakes(o).map((k, i) => { const sm = SAMPLES[k]; return `<div class="ans2"><span class="ansmark">“</span><div><b>${anon ? 'Student ' + String.fromCharCode(65 + i) : esc(NAMES[(hash(o.id) + k) % NAMES.length])}</b><p>${esc(sm.en || sm.t)}</p>${sm.lang ? origHTML(sm.t, sm.lang) : ''}</div></div>`; }).join('')}</div>`;
  return `<aside class="lopanel" aria-label="${esc(o.lo)}"><div class="lochead"><b>${esc(o.lo)}</b><button class="x" data-a="oloclose" aria-label="Close">✕</button></div>
  <p class="lodesc">${esc(s.ulo[o.lo] || o.out)}</p>
  <section class="losec"><h4>Class insight</h4>${insBody}</section>
  <section class="losec qasec"><div class="qanav"><button class="qarrow" data-a="oqprev" aria-label="Previous question" ${pi === 0 ? 'disabled' : ''}>‹</button><h4>Concept check analysis</h4><span class="qacount">${pi + 1} / ${pages.length}</span><button class="qarrow" data-a="oqnext" aria-label="Next question" ${pi === pages.length - 1 ? 'disabled' : ''}>›</button></div>${body}</section></aside>`;
}
function overview() {
  const s = S(), { W, key, outs } = weekOutcomes();
  if (O.s !== key) O.s = key;
  const open = outs.find(o => o.id === O.open);
  return `<div class="ovw2">
    <div class="ovtop"><div class="ovintro"><small class="eyebrow">${esc(s.code)} · ${esc(s.name)}</small><h1 class="ovtitle">Class Learning</h1><p>How the whole class is doing, from everything students have answered and uploaded.</p></div><div class="ovweek"><span class="livedot"></span><select id="wk" aria-label="Week">${Object.keys(s.weeks).map(w => `<option value="${w}" ${+w === O.w ? 'selected' : ''}>Week ${w} of 12</option>`).join('')}</select></div></div>
    <div class="ovgrid">
      <section class="ovpanel"><div class="ovhead"><h2>Student Activity</h2><div class="seg2">${Object.entries(W.sessions).map(([k, v]) => `<button data-ss="${k}" aria-pressed="${k === key}">${v.name}</button>`).join('')}</div></div>
        <div class="loscroll">${outs.map(o => loBox(o, open && open.id === o.id)).join('')}</div></section>
      ${open ? loPanel(open) : `<section class="ovpanel"><div class="ovhead"><h2>Artefacts</h2></div>${artefactsHTML()}</section>`}
    </div>
  </div>`;
}



/* ---------- actions ---------- */
function insertAct(p, type, stay) {
  if (!ACTIVITY_TYPES.includes(type)) return;
  const s = S(), f = flowOf(s); f.splice(p, 0, { k: 'a', act: type });
  if (stay) { toast(`${ACT_META[type].title} added after this slide`); render(); return; }
  s.pos = p; syncA(s); toast(`${ACT_META[type].title} added at step ${p + 1}`); render();
}
/* ---------- import a unit outline (sydney.edu.au/units/...) ---------- */
const UNIT_EXAMPLE = 'https://www.sydney.edu.au/units/IDEA9301/2026-S2C-ND-CC';
function openUnitImport() {
  if (!(window.shell && window.shell.unit)) return modal(`<h4>Import a unit outline</h4><p class="sub">This is available in the desktop app.</p><div class="row"><button class="sm p" data-x>Close</button></div>`);
  modal(`<div class="k2">⇩ Unit outline</div><h4>Import the weekly schedule</h4>
  <p class="sub aitext">Paste the link to a unit outline on sydney.edu.au. The app reads the unit name, the learning outcomes, the weekly schedule (each lecture, tutorial and practical with its outcomes) and the assessments. Concept checks then use the real outcomes for each week.</p>
  <label class="k2" for="unitUrl">Unit outline link</label>
  <input id="unitUrl" class="cdinput" spellcheck="false" placeholder="${UNIT_EXAMPLE}" value="${S().fromOutline || ''}">
  <p class="sub aitext" id="unitStatus"></p>
  <div class="row"><button class="sm" data-a="unitfill">Use the IDEA9301 example</button><span class="spacer"></span><button class="sm" data-x>Cancel</button><button class="sm p" data-a="unitgo">Import</button></div>`);
}
async function doUnitImport() {
  const el = document.getElementById('unitStatus'), url = document.getElementById('unitUrl').value.trim() || UNIT_EXAMPLE;
  el.textContent = 'Reading the unit page…';
  const r = await window.shell.unit.fetch(url);
  if (r.error) { el.textContent = '⚠ ' + r.error; return; }
  let o;
  try { o = parseUnitOutline(r.html, r.url); } catch (e) { el.textContent = '⚠ ' + e.message; return; }
  const idx = applyOutline(o);
  si = idx; L.open = null; A = null;
  O.w = S().liveWeek in S().weeks ? S().liveWeek : +Object.keys(S().weeks)[0]; O.s = 'tut'; O.open = null;
  $('#modal').innerHTML = '';
  toast(`Imported ${o.code} ${o.name}: ${Object.keys(o.weeks).length} weeks, ${Object.keys(o.ulo).length} learning outcomes, ${o.assess.length} assessments`);
  render();
}
async function openAISettings() {
  if (!(window.shell && window.shell.ai)) return modal(`<h4>AI question writer</h4><p class="sub">The browser version uses the built-in Demo AI. The desktop app also offers Ollama and Claude.</p><div class="row"><button class="sm p" data-x>Close</button></div>`);
  const st = await window.shell.ai.status();
  const names = { 'claude-sonnet-5-5': 'Claude Sonnet 5.5 — balanced', 'claude-haiku-5-5': 'Claude Haiku 5.5 — fastest, lowest cost', 'claude-opus-5-5': 'Claude Opus 5.5 — most capable' };
  const opt = (v, title, sub) => `<label class="aiopt"><input type="radio" name="aiprov" value="${v}" ${st.provider === v ? 'checked' : ''}><span><b>${title}</b><small>${sub}</small></span></label>`;
  const sec = (v, html) => `<div class="aisec" data-sec="${v}" ${st.provider === v ? '' : 'hidden'}>${html}</div>`;
  const local = ['qwen2.5:3b|about 2 GB · recommended', 'llama3.2:3b|about 2 GB', 'gemma3:4b|about 3.3 GB · better wording, slower'];
  modal(`<div class="k2">✦ AI question writer</div><h4>Who writes the concept check questions?</h4>
  <div class="aiopts">
    ${opt('template', 'Off', 'No AI. You write the concept check questions yourself')}
    ${opt('demo', 'Demo AI (built in)', 'Nothing to install · shows how the AI works with example questions made from your slides')}
    ${opt('ollama', 'Free AI on this laptop (Ollama)', 'Free · no account · slide text never leaves your computer')}
    ${opt('anthropic', 'Claude (Anthropic API)', 'Best wording · paid per use · needs an API key')}
  </div>
  ${sec('ollama', `<p class="sub aitext">Ollama runs an AI model on your laptop. One-time setup: install Ollama from <b>ollama.com</b> (free), then open a terminal and run <code>ollama pull ${esc(st.ollamaModel)}</code>. After that it works without the internet. Each question set takes about 20–60 seconds on a laptop.</p>
    <label class="k2" for="olModel">Model</label>
    <div class="olrow"><input id="olModel" class="cdinput" value="${esc(st.ollamaModel)}" spellcheck="false"><button class="sm" data-a="aicheck">Check</button></div>
    <div class="olpicks">${local.map(x => { const [m, d] = x.split('|'); return `<button class="sm" data-a="olpick" data-m="${m}">${m} <span class="muted">· ${d}</span></button>`; }).join('')}</div>
    <p class="sub aitext" id="olStatus"></p>`)}
  ${sec('anthropic', `<label class="k2" for="aiKey">Anthropic API key</label><input id="aiKey" class="cdinput" type="password" autocomplete="off" spellcheck="false" placeholder="${st.hasKey ? '•••••••• saved — leave blank to keep it' : 'sk-ant-…'}">
    <p class="sub aitext">Create a key at console.anthropic.com. It needs prepaid credit, separate from a Claude chat subscription. It is stored encrypted on this computer and not shown again.${st.canStore ? '' : ' <b>Secure storage is not available here, so a key cannot be saved.</b>'}</p>
    <label class="k2" for="aiModel">Model</label><select id="aiModel" class="cdinput">${st.models.map(m => `<option value="${m}" ${m === st.model ? 'selected' : ''}>${names[m] || m}</option>`).join('')}</select>`)}
  <p class="sub aitext">Only the slide text and the week’s learning outcome are used. Student answers are never sent. AI questions are drafts: check them before you use them.</p>
  <div class="row">${st.hasKey ? '<button class="sm" data-a="aiclear">Remove saved key</button>' : ''}<span class="spacer"></span><button class="sm" data-x>Cancel</button><button class="sm p" data-a="aisave">Save</button></div>`);
  if (st.provider === 'ollama') checkOllama();
}
async function checkOllama() {
  const el = document.getElementById('olStatus'), model = (document.getElementById('olModel') || {}).value || '';
  if (!el) return;
  el.textContent = 'Checking Ollama…';
  const r = await window.shell.ai.check({ model });
  el.innerHTML = !r.running ? '⚠ Ollama is not running on this laptop. Install it from ollama.com and open it, then press Check again.'
    : r.hasModel ? `✓ Ollama is running and <b>${esc(model)}</b> is downloaded. Ready to use.`
    : `Ollama is running, but <b>${esc(model)}</b> is not downloaded yet. In a terminal run: <code>ollama pull ${esc(model)}</code>` + (r.models.length ? `<br>Downloaded models: ${r.models.map(esc).join(', ')}` : '');
}
document.addEventListener('change', e => {
  if (e.target.name !== 'aiprov') return;
  document.querySelectorAll('.aisec').forEach(x => { x.hidden = x.dataset.sec !== e.target.value; });
  if (e.target.value === 'ollama') checkOllama();
});
let cdDraft = [];
function cdBlock(i, q) {
  const slots = [0, 1, 2, 3].map(k => (q.options || [])[k] || { t: '', ok: false });
  if (q.type === 'mc' && !slots.some(o => o.ok)) slots[0].ok = true;
  return `<div class="cdblock" data-i="${i}"><label class="k2">${i + 1}. ${esc(q.label)} <span class="muted">· ${esc(q.note)}</span></label>
  <select class="cdtype" data-i="${i}">${Object.entries(TYPE_NAMES).map(([k, n]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
  <textarea class="cdq" data-i="${i}">${esc(q.text)}</textarea>
  ${q.type === 'open' ? `<div class="cdoptrow"><span class="muted" style="white-space:nowrap">Sentence starter</span><input class="cdhintin" value="${esc(q.hint || '')}" placeholder="In my project, I saw ..."></div>` : ''}
  ${q.type === 'mc' ? `<div class="cdoptlist">${slots.map((o, k) => `<div class="cdoptrow"><input type="radio" name="ok${i}" value="${k}" ${o.ok ? 'checked' : ''} title="Correct answer"><span class="let">${'ABCD'[k]}</span><input class="cdo" value="${esc(o.t)}" placeholder="Option ${'ABCD'[k]}"></div>`).join('')}<small class="muted">Select the circle next to the correct answer.</small></div>` : ''}
  ${q.type === 'scale' ? `<div class="cdoptrow"><input class="cdlo" value="${esc(q.lo || 'Not yet')}" placeholder="Low label"><input class="cdhi" value="${esc(q.hi || 'Very')}" placeholder="High label"></div>` : ''}</div>`;
}
function readBlock(i, q) {
  const b = document.querySelector(`.cdblock[data-i="${i}"]`); if (!b) return;
  q.text = b.querySelector('.cdq').value.trim() || q.text;
  if (q.type === 'open') { const h = b.querySelector('.cdhintin'); q.hint = h ? h.value.trim() : (q.hint || ''); }
  if (q.type === 'mc') {
    const opts = [...b.querySelectorAll('.cdoptrow')].map(r => ({ t: r.querySelector('.cdo').value.trim(), ok: r.querySelector('input[type=radio]').checked })).filter(o => o.t);
    if (opts.length && !opts.some(o => o.ok)) opts[0].ok = true;
    q.options = opts;
  } else if (q.type === 'scale') {
    q.lo = b.querySelector('.cdlo').value.trim() || 'Not yet'; q.hi = b.querySelector('.cdhi').value.trim() || 'Very';
  }
}
document.addEventListener('change', e => {
  if (!e.target.classList.contains('cdtype')) return;
  const i = +e.target.dataset.i, q = cdDraft[i]; readBlock(i, q);
  q.type = e.target.value; q.res = null;
  if (q.type === 'mc' && !(q.options || []).length) q.options = [{ t: '', ok: true }, { t: '', ok: false }, { t: '', ok: false }, { t: '', ok: false }];
  document.querySelector(`.cdblock[data-i="${i}"]`).outerHTML = cdBlock(i, q);
});
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
    case 'toggleq': { if (A && A.type === 'Q&A Session') { L.qside = !L.qside; a.setAttribute('aria-pressed', L.qside); document.querySelector('.sess2')?.classList.toggle('qside', L.qside); return; } L.qopen = !L.qopen; document.querySelector('.sess2')?.classList.toggle('qclosed', !L.qopen); a.setAttribute('aria-pressed', L.qopen); return; }
    case 'end': L.menu = false; V = 'ov'; if (s.liveWeek in s.weeks) O.w = s.liveWeek; toast('Session ended · questions saved'); break;
    case 'prev':
      if (A && A.type === 'Artefact upload') { const n = artItems(s).length; A.q = Math.max(0, (A.q || 0) - 1); A.hold = Date.now(); }
      else if (A && A.q > 0) A.q--; else goTo(s, s.pos - 1);
      break;
    case 'next':
      if (A && A.type === 'Artefact upload') {
        const n = artItems(s).length; A.hold = Date.now();
        if ((A.q || 0) < n - 1) A.q = (A.q || 0) + 1;
        else if (!L.warnNext) {
          /* last artefact: warn once before moving on to the next slide */
          L.warnNext = true; toast('This is the last artefact. Press the arrow again to move to the next slide.');
          document.querySelectorAll('.navarrow.r').forEach(b => b.classList.add('warn'));
          clearTimeout(L.warnT); L.warnT = setTimeout(() => { L.warnNext = false; document.querySelectorAll('.navarrow.r').forEach(b => b.classList.remove('warn')); }, 6000);
          return;
        } else {
          L.warnNext = false;
          const f = flowOf(s); let np = s.pos + 1; while (np < f.length && f[np].k === 'a') np++;
          if (np >= f.length) { toast('This is the last slide.'); return; }
          goTo(s, np);
        }
      }
      else if (A && A.q < actQs().length - 1) A.q++;
      else if (A && A.type !== 'Artefact upload' && s.pos < flowOf(s).length - 1 && !L.warnNext) {
        /* last question: warn once so nobody skips to the next slide by accident */
        L.warnNext = true; toast('This is the last question. Press the arrow again to move to the next slide.');
        document.querySelectorAll('.navarrow.r').forEach(b => b.classList.add('warn'));
        clearTimeout(L.warnT); L.warnT = setTimeout(() => { L.warnNext = false; document.querySelectorAll('.navarrow.r').forEach(b => b.classList.remove('warn')); }, 6000);
        return;
      } else {
        L.warnNext = false;
        /* leaving an activity shows the next slide; it does not open another activity panel */
        let np = s.pos + 1; if (A) { const f = flowOf(s); while (np < f.length && f[np].k === 'a') np++; if (np >= f.length) np = s.pos + 1; }
        goTo(s, np);
      }
      break;
    case 'actback': { const f = flowOf(s); let p = s.pos; while (p > 0 && f[p].k !== 's') p--; if (f[p].k !== 's') { p = f.findIndex(x => x.k === 's'); } goTo(s, Math.max(0, p)); break; }
    case 'qfilter': L.qf = a.dataset.f; renderQP(); return;
    case 'qup': q.voted = !q.voted; renderQP(); return;
    case 'qreply': q.st = q.st === 'open' ? 'ans' : 'open'; if (q.st !== 'open') q.seen = true; renderQP(); return;
    case 'qorig': q.showOrig = !q.showOrig; renderQP(); return;
    case 'qslide': { const f = flowOf(s), idx = f.findIndex(x => x.k === 's' && x.i === +a.dataset.n - 1); if (idx >= 0) { goTo(s, idx); break; } return; }
    case 'trtoggle': L.trShut = !L.trShut; break;
    case 'qsave': q.saved = !q.saved; renderQP(); return;
    case 'rtab': L.rtab = a.dataset.t; renderQP(); return;
    case 'tile': goTo(s, +a.dataset.i); break;
    case 'artpick': A.q = +a.dataset.i; A.hold = Date.now(); break;
    case 'artpause': A.hold = artHeld() ? 0 : Date.now(); break;
    case 'rmflow': { const f = flowOf(s), i = +a.dataset.i; f.splice(i, 1); if (i < s.pos) s.pos--; if (s.pos >= f.length) s.pos = f.length - 1; syncA(s); break; }
    case 'actclose': { const f = flowOf(s); goTo(s, s.pos < f.length - 1 ? s.pos + 1 : s.pos - 1); break; }
    case 'upload': L.menu = false; return $('#slideFile').click();
    case 'qnum': if (A && A.type === 'Q&A Session') { A.q = Math.max(0, sortedQs(s).findIndex(x => x.id === q.id)); q.seen = true; render(); return; } q.seen = !q.seen; renderQP(); return;
    case 'qopen': q.seen = true; L.open = L.open === q.id ? null : q.id; L.reply = L.open === q.id && q.st === 'open' ? q.id : null; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reply': L.reply = L.reply === q.id ? null : q.id; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reopen': q.st = 'open'; q.ans = null; renderQP(); return;
    case 'cdedit': {
      const cd = ensureCD(s, s.pos); cdDraft = cd.qs.length ? JSON.parse(JSON.stringify(cd.qs)) : LEVELS.map(l => ({ level: l.k, label: l.label, note: l.note, source: cd.source, type: 'open', text: '', hint: '' }));
      return modal(`<div class="k2">Concept check · ${esc(cd.lo)}: ${esc(cd.out)}</div><h4>Edit the five questions</h4>
      <label class="k2" for="cdTopic">Topic from the slide before this activity</label><input id="cdTopic" class="cdinput" value="${esc(cd.title)}">
      <div id="cdBlocks">${cdDraft.map((q, i) => cdBlock(i, q)).join('')}</div>
      <div class="row"><button class="sm" data-a="cdregen">↻ Regenerate from slide &amp; outcome</button><span class="spacer"></span><button class="sm" data-x>Cancel</button><button class="sm p" data-a="cdsave">Save</button></div>`);
    }
    case 'cdregen': {
      const topic = cleanTopic(document.getElementById('cdTopic').value) || 'this topic';
      const base = cdContext(s, s.pos);
      const ctx = Object.assign({}, base, { topic, title: topic, source: base.slideNo ? `Slide ${base.slideNo} · ${topic}` : topic });
      toast('Writing new questions…');
      (async () => {
        let fresh = null;
        try { fresh = await aiBuildCD(ctx); } catch (err) { toast('The AI could not write new questions: ' + err.message); }
        if (!fresh) return;
        const box = document.getElementById('cdBlocks'); if (!box) return;
        cdDraft = fresh.qs; document.getElementById('cdTopic').value = topic;
        box.innerHTML = cdDraft.map((q, i) => cdBlock(i, q)).join('');
        if (fresh.by === 'ai') toast('New questions written by AI from the slide');
      })();
      return;
    }
    case 'cdsave': {
      const cd = ensureCD(s, s.pos);
      cdDraft.forEach((q, i) => readBlock(i, q));
      cd.title = cd.topic = document.getElementById('cdTopic').value.trim() || cd.title; cd.edited = true;
      cd.state = 'ready'; cd.pending = false; cd.by = cd.by || 'manual';
      cd.qs = cdDraft.filter(q => q.text).map((q, i) => { const old = cd.qs[i] || {}; const same = old.text === q.text && old.type === q.type && JSON.stringify(old.options) === JSON.stringify(q.options); return Object.assign({}, q, { res: same ? old.res : null, edited: old.edited || !same }); });
      A.q = Math.min(A.q, cd.qs.length - 1);
      $('#modal').innerHTML = ''; toast('Questions saved'); break;
    }
    case 'unitimport': L.menu = false; mainMenu(); openUnitImport(); return;
    case 'unitfill': { const i = document.getElementById('unitUrl'); if (i) i.value = UNIT_EXAMPLE; return; }
    case 'unitgo': doUnitImport(); return;
    case 'cdretry': retryCD(s, s.pos); break;
    case 'aisettings': L.menu = false; mainMenu(); openAISettings(); return;
    case 'aisave': {
      if (!(window.shell && window.shell.ai)) return;
      const prov = (document.querySelector('input[name=aiprov]:checked') || {}).value || 'template';
      const opts = { provider: prov };
      if (prov === 'anthropic') { opts.key = document.getElementById('aiKey').value; opts.model = document.getElementById('aiModel').value; }
      if (prov === 'ollama') opts.ollamaModel = document.getElementById('olModel').value;
      window.shell.ai.save(opts).then(r => {
        if (r.error) return toast(r.error);
        $('#modal').innerHTML = '';
        toast(prov === 'demo' ? 'Demo AI is on. Concept checks use built-in example questions made from your slides.' : prov === 'template' ? 'AI is off. You can still write concept check questions yourself.' : prov === 'ollama' ? 'Free local AI is on. New concept checks will be written on this laptop.' : 'Claude is on. New concept checks will be written from the slide text.');
      });
      return;
    }
    case 'aicheck': checkOllama(); return;
    case 'olpick': { const i = document.getElementById('olModel'); if (i) { i.value = a.dataset.m; checkOllama(); } return; }
    case 'aiclear': window.shell.ai.clear().then(() => { $('#modal').innerHTML = ''; toast('Saved key removed.'); }); return;
    case 'ofolder': O.folder = a.dataset.f; break;
    case 'ofolderback': O.folder = null; break;
    case 'olo': O.open = O.open === a.dataset.o ? null : a.dataset.o; O.qp = 0; break;
    case 'oqprev': O.qp = Math.max(0, (O.qp || 0) - 1); break;
    case 'oqnext': O.qp = (O.qp || 0) + 1; break;
    case 'oinsightretry': { const o = weekOutcomes().outs.find(x => x.id === O.open); if (o) o.insight = null; break; }
    case 'oloclose': O.open = null; break;
    case 'openlo': O.open = O.open === a.dataset.o ? null : a.dataset.o; break;
    case 'otab': O.tab = a.dataset.t; break;
    case 'anon': O.anon = a.checked; break;
    case 'tip': { const o = findOut(a.dataset.o); return modal(`<div class="k2">${o.lo} · Re-teach in 5 minutes</div><h4>${esc(o.out)}</h4><div class="focus" style="background:var(--tint)">${esc(o.tip)}</div><div class="row"><button class="sm p" data-x>Got it</button></div>`); }
    case 'group': { const o = findOut(a.dataset.o); toast('Small group: ' + o.who.slice(0, 4).map(w => w[0].split(' ')[0]).join(', ')); return; }
  }
  render();
});
$('#burger').addEventListener('click', e => { e.stopPropagation(); L.menu = !L.menu; L.subj = false; courseBtn(); mainMenu(); });
document.addEventListener('keydown', e => {
  if (V !== 'ov' || !O.open || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
  const o = weekOutcomes().outs.find(x => x.id === O.open); if (!o) return;
  O.qp = Math.max(0, Math.min(qaPages(o).length - 1, (O.qp || 0) + (e.key === 'ArrowRight' ? 1 : -1))); render(); e.preventDefault();
});
document.addEventListener('submit', e => {
  e.preventDefault(); const q = S().qs.find(x => x.id == e.target.dataset.q), v = e.target.querySelector('input').value.trim();
  if (!v) return; q.ans = v; q.st = 'ans'; L.reply = null; toast('Answer posted to the class'); renderQP();
});
document.addEventListener('change', e => { if (e.target.id === 'wk') { O.w = +e.target.value; O.open = null; render(); } });
$('#slideFile').addEventListener('change', async e => {
  const files = [...e.target.files], s = S(); e.target.value = ''; if (!files.length) return;
  toast('Reading slides…');
  const slides = [], skipped = [];
  for (const f of files) {
    try { const got = await readSlideFile(f, (n, t) => toast(`Reading ${f.name} · page ${n} of ${t}`)); if (got) slides.push(...got); else skipped.push(f.name); }
    catch (err) { skipped.push(f.name); console.error(err); }
  }
  if (slides.length) {
    s.uploads = slides; s.upload = files.length === 1 ? files[0].name : `${files.length} files`; s.flow = null;
    if (window.shell && window.shell.slides) Promise.all(files.map(async f => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))).then(list => window.shell.slides.save(s.code, list)).catch(() => {});
    const withText = slides.filter(x => x.text).length;
    toast(`Read ${slides.length} slide${slides.length > 1 ? 's' : ''} · ${withText} with text the app can use for questions` + (skipped.length ? ` · skipped ${skipped.join(', ')} (save as PDF or PPTX)` : ''));
  } else toast('Could not read ' + skipped.join(', ') + ' — save it as PDF or PPTX');
  render();
});

/* drag & drop: activity chip -> plan tile or the live card */
document.addEventListener('dragstart', e => { const a = e.target.closest('[data-act]'); if (a) { e.dataTransfer.setData('text/plain', a.dataset.act); L.dragging = true; } });
document.addEventListener('dragend', () => { L.dragging = false; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const d = e.target.closest('[data-ins]'); if (d) { e.preventDefault(); document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); d.classList.add('over'); } });
document.addEventListener('drop', e => { const d = e.target.closest('[data-ins]'); if (!d) return; e.preventDefault(); L.dragging = false; insertAct(+d.dataset.ins, e.dataTransfer.getData('text/plain')); });

/* simulated live class: answers arriving on a concept check */
setInterval(() => {
  if (V !== 'live' || !A || A.type !== 'Concept Development') return;
  const s = S(), cd = flowOf(s)[s.pos] && flowOf(s)[s.pos].cd; if (!cd || !cd.qs.length) return;
  const q = cd.qs[Math.min(A.q, cd.qs.length - 1)], r = ensureRes(q), el = document.getElementById('cdAns'); if (!el) return;
  if (q.type === 'mc') { const k = Math.random() < .55 ? Math.max(0, q.options.findIndex(o => o.ok)) : Math.floor(Math.random() * q.options.length); r.counts[k]++; }
  else if (q.type === 'scale') r.counts[Math.min(4, 1 + Math.floor(Math.random() * 4))]++;
  else { r.n++; r.shown = [...new Set([Math.floor(Math.random() * SAMPLES.length), ...r.shown])].slice(0, 3); }
  el.innerHTML = answersHTML(q);
}, 2500);

/* simulated live class: students playing discussion cards */
setInterval(() => {
  if (V !== 'live' || !A || A.type !== 'Discussion Activity') return;
  const s = S(), c = DISCUSS_CARDS[Math.floor(Math.random() * DISCUSS_CARDS.length)];
  s.cards[c.k]++;
  const el = document.querySelector(`.dcard[data-card="${c.k}"]`); if (!el) return;
  el.dataset.tip = `${c.label} · ${s.cards[c.k]} students`;
  el.querySelector('.dcount').textContent = s.cards[c.k];
  if (!REDUCED) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}, 2200);

/* simulated live class: reactions and new questions */
const busy = () => V !== 'live' || L.reply || L.dragging || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.closest?.('.inl');
setInterval(() => { if (V !== 'live' || L.dragging) return; const k = EMOJIS[Math.floor(Math.random() * EMOJIS.length)].k; S().reactions[k]++; popBall(k); if (!busy() && Math.random() < .4) { const qs = S().qs; qs[Math.floor(Math.random() * qs.length)].up++; renderQP(); } }, 1300);
setInterval(() => { if (busy() || !POOLQ.length) return; const p = POOLQ.shift(), s = S(); s.qs.forEach(q => { q.ago++; }); s.qs.push({ id: qid++, who: p[0], av: p[1], text: p[2], tr: p[3], ago: 0, up: 1, same: 0, st: 'open' }); renderQP(); }, 25000);

(typeof BUNDLED_UNITS !== 'undefined' ? BUNDLED_UNITS : []).forEach(o => applyOutline(o, false));
/* in a browser (no desktop app) the course slides shipped next to the page are shown */
if (!(window.shell && window.shell.slides)) {
  const sub = SUBJECTS.find(x => x.code === 'IDEA9301'), name = 'IDEA9106_Wk6_TUT_S2_2025.pdf';
  if (sub) fetch('slides/IDEA9301/' + encodeURIComponent(name)).then(r => r.ok ? r.blob() : Promise.reject()).then(async b => {
    const got = await readSlideFile(new File([b], name, { type: 'application/pdf' }));
    if (got && got.length) { sub.uploads = got; sub.upload = name; sub.flow = null; render(); }
  }).catch(() => {});
}
/* bring back the slides uploaded earlier */
if (window.shell && window.shell.slides) window.shell.slides.load().then(async saved => {
  for (const sub of SUBJECTS) {
    const list = saved[sub.code]; if (!list || !list.length) continue;
    const slides = [];
    for (const x of list) { try { const f = new File([x.data], x.name); f._path = x.path; const got = await readSlideFile(f); if (got) slides.push(...got); } catch (e) { console.error(e); } }
    if (slides.length) { sub.uploads = slides; sub.upload = list.length === 1 ? list[0].name : list.length + ' files'; sub.flow = null; }
  }
  render();
}).catch(() => {});
render();
function answersHTML(q) {
  const r = ensureRes(q);
  if (q.type === 'mc') {
    const tot = r.counts.reduce((x, y) => x + y, 0) || 1;
    return `<div class="cdopts">${q.options.map((o, i) => `<div class="cdopt ${o.ok ? 'ok' : ''}"><i class="rbar" style="width:${Math.round(r.counts[i] / tot * 100)}%"></i><span class="let">${'ABCDEF'[i]}</span><span class="otxt">${esc(o.t)}</span><span class="ocnt">${r.counts[i]}${o.ok ? ' ✓' : ''}</span></div>`).join('')}</div>`;
  }
  if (q.type === 'scale') {
    const tot = r.counts.reduce((x, y) => x + y, 0) || 1, avg = r.counts.reduce((x, c, i) => x + c * (i + 1), 0) / tot, mx = Math.max(...r.counts, 1);
    return `<div class="cdscale">${r.counts.map((c, i) => `<div class="sbox"><i class="rbar" style="height:${Math.round(c / mx * 100)}%"></i><b>${i + 1}</b><small>${c}</small></div>`).join('')}</div><div class="cdlabels"><span>${esc(q.lo || 'Not yet')}</span><span>Average ${avg.toFixed(1)}</span><span>${esc(q.hi || 'Very')}</span></div>`;
  }
  return `<div class="cdopen"><div class="ophead"><b>${r.n}</b> responses · students can write in any language · only you see these</div>${r.shown.map(k => { const sm = SAMPLES[k]; return `<div class="oresp"><p>${esc(sm.en || sm.t)}</p>${sm.lang ? origHTML(sm.t, sm.lang) : ''}</div>`; }).join('')}</div>`;
}
function cdEmpty(s, f, m, cd) {
  const own = '<button class="sm" data-a="cdedit">✎ Write my own questions</button>';
  const body = cd.pending ? `<div class="cdwait"><span class="aiflag busy">✦ The AI is writing five questions</span></div>`
    : cd.state === 'notext' ? `<div class="cdwait"><b>This slide has no text to read</b><p>${esc(cd.aiError)} Upload the slides as PDF or PowerPoint, or write the questions yourself.</p><div class="qacts">${own}</div></div>`
    : cd.state === 'off' ? `<div class="cdwait"><b>AI is turned off</b><p>${esc(cd.aiError || '')} Concept checks are written by an AI model so the wording is simple and matches your slide.</p><div class="qacts"><button class="sm p" data-a="aisettings">✦ Choose AI</button>${own}</div></div>`
    : `<div class="cdwait"><b>The AI could not write the questions</b><p>${esc(cd.aiError || 'Something went wrong.')}</p><div class="qacts"><button class="sm p" data-a="cdretry">↻ Try again</button><button class="sm" data-a="aisettings">✦ AI settings</button>${own}</div></div>`;
  return `<div class="card2 actcard cdcard" style="background:${m.color}"><div class="cdtop"><span class="cdtake">Your take</span><span class="spacer"></span><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="cdbody">${body}</div>
  ${navOverlay(0, 1, s.pos > 0, s.pos < f.length - 1)}</div>`;
}
function cdCard(s, f, m) {
  const cd = ensureCD(s, s.pos);
  if (!cd.qs.length) return cdEmpty(s, f, m, cd);
  const q = cd.qs[Math.min(A.q, cd.qs.length - 1)];
  const rs = ensureRes(q), n = q.type === 'mc' || q.type === 'scale' ? rs.counts.reduce((x, y) => x + y, 0) : rs.n;
  return `<div class="card2 actcard cdcard classact"><div class="cahead"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><b>Class activity</b><span class="spacer"></span><small>Question ${A.q + 1} of ${cd.qs.length}</small><button class="cdeditbtn" data-a="cdedit" aria-label="Edit questions" data-tip="Edit questions">✎</button><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="cabody"><div class="cameta"><small>${esc(TYPE_NAMES[q.type] || '')}</small><span class="cachip"><i></i>Live · ${n} responses</span></div>
  <h3 class="cdq">${esc(q.text)}</h3>${q.hint ? `<p class="cdhint">Sentence starter for students: <b>${esc(q.hint)}</b></p>` : ''}
  <small class="calabel">What the class answered</small><div id="cdAns">${answersHTML(q)}</div></div>
  <span class="bloomchip">${esc(q.label)}</span>
  ${navOverlay(A.q, cd.qs.length, A.q > 0 || s.pos > 0, A.q < cd.qs.length - 1 || s.pos < f.length - 1)}</div>`;
}


/* pressing the empty part of the Studio flow section closes it (tiles and activity chips keep working) */
document.addEventListener('click', e => {
  const sec = e.target.closest('.plan2');
  if (!sec || !L.plan || e.target.closest('.tile,.achip2,button,.tgap,[data-a]')) return;
  L.plan = false; botbar(); sec.classList.add('collapsed');
});

/* simulated live class: other students' answers keep arriving in the Q&A Session */
setInterval(() => {
  if (!A || A.type !== 'Q&A Session' || V !== 'live') return;
  const s = S(), list = sortedQs(s); if (!list.length) return;
  const q = list[Math.floor(Math.random() * list.length)], used = qaReplies(q);
  if (used.length >= 6) return;
  const pick = REPLY_BANK.filter(r => !used.some(u => u.t === r.t)); if (!pick.length) return;
  used.push(Object.assign({ who: NAMES[Math.floor(Math.random() * NAMES.length)] }, pick[Math.floor(Math.random() * pick.length)]));
  const l = document.getElementById('qaList'); if (l) { const top = l.scrollTop; l.innerHTML = qaListHTML(s); l.scrollTop = top; }
}, 4500);

/* the slideshow plays by itself unless the tutor has stopped it; students' uploads arrive one by one */
setInterval(() => {
  if (!A || A.type !== 'Artefact upload' || V !== 'live' || artHeld()) return;
  const n = artItems(S()).length; A.q = ((A.q || 0) + 1) % n; render();
}, 6000);
setInterval(() => {
  if (!A || A.type !== 'Artefact upload' || V !== 'live') return;
  const s = S(), got = s.liveArts || (s.liveArts = []), pool = (s.artefacts || []).slice(2);
  if (got.length >= pool.length) return;
  got.push(pool[got.length]);
  if (!artHeld()) A.q = EXAMPLE_ARTS.length + got.length - 1;
  render();
}, 9000);

/* double-click the artefact slideshow to carry on to the next slide */
document.addEventListener('dblclick', e => {
  if (!A || A.type !== 'Artefact upload' || !e.target.closest('.artshow')) return;
  const s = S(), f = flowOf(s); let np = s.pos + 1;
  while (np < f.length && f[np].k === 'a') np++;
  if (np >= f.length) { toast('This is the last slide.'); return; }
  goTo(s, np); render();
});

/* search the questions; Ctrl+K jumps to the search box */
document.addEventListener('input', e => { if (e.target.id !== 'qSearch') return; L.qsearch = e.target.value; if (!L.qopen) { L.qopen = true; document.querySelector('.sess2')?.classList.remove('qclosed'); } L.rtab = 'q'; renderQP(); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const i = document.getElementById('qSearch'); if (i) { e.preventDefault(); i.focus(); i.select(); } } });

/* click an activity to add it right after the slide (or activity) you are on; dragging still places it anywhere */
document.addEventListener('click', e => {
  const c = e.target.closest('.achip2'); if (!c || L.dragging) return;
  const s = S(); flowOf(s); insertAct(s.pos + 1, c.dataset.act, true);
});
