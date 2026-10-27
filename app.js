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
  m.innerHTML = `<button data-a="upload">Upload slides for ${esc(S().name)}</button><button data-a="aisettings">✦ AI question writer…</button><button data-a="end">End session</button>`;
}
function botbar() {
  const b = $('#botbar'), s = S();
  b.style.display = V === 'live' ? '' : 'none';
  b.className = 'botbar' + (L.plan ? ' open' : '');
  b.innerHTML = `<div class="barrow"><button class="${L.plan ? 'ptab flip' : 'bb planbtn'}" id="planbtn" data-a="toggleplan" aria-expanded="${L.plan}" aria-label="Session plan"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/></svg><span>Session plan</span><i class="caret">${L.plan ? '▾' : '▴'}</i></button><span class="spacer"></span>
  <button class="bb" data-a="toggleq" id="qbtn" aria-pressed="${L.qopen}">Activity <span class="bdg" id="bdg">${unanswered()}</span></button>
  <span class="bb reactlbl" aria-label="Class reactions appear here"><span class="reactemo">${EMOJIS.map(e => `<i data-k="${e.k}" data-tip="${e.l} · ${s.reactions[e.k]}">${e.e}</i>`).join("")}</span></span></div>`;
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
  return `<button class="navarrow l" data-a="prev" aria-label="Previous" ${canPrev ? '' : 'disabled'}>${ARROW_L}</button><button class="navarrow r" data-a="next" aria-label="Next" ${canNext ? '' : 'disabled'}>${ARROW_R}</button>${total > 1 ? `<div class="dotsov" aria-hidden="true">${dots}</div>` : ''}`;
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
  return PROMPTS[A.type];
}
function actCard() {
  const s = S(), f = flowOf(s), m = ACT_META[A.type], p = actQs();
  if (A.type === 'Discussion Activity') return discussionCard(s, f, m, p);
  if (A.type === 'Concept Development') return cdCard(s, f, m);
  return `<div class="card2 actcard" style="background:${m.color}"><div class="ahead"><div><small>ACTIVITY</small><h2>${esc(m.title)}</h2></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="abody"><small>QUESTION ${A.q + 1} OF ${p.length}</small><h3>${esc(p[A.q])}</h3><textarea placeholder="Add your thoughts here…" aria-label="Your thoughts"></textarea><div class="meta">${8 + A.q * 3} students have responded</div></div>
  ${navOverlay(A.q, p.length, A.q > 0 || s.pos > 0, A.q < p.length - 1 || s.pos < f.length - 1)}</div>`;
}
function planStrip(sl, s) {
  const f = flowOf(s), gap = p => `<div class="tgap" data-ins="${p}"></div>`;
  const tiles = f.map((it, p) => {
    if (it.k === 'a') { const m = ACT_META[it.act]; return gap(p) + `<div class="tile act ${p === s.pos ? 'on' : ''}" style="background:${m.color}" data-a="tile" data-i="${p}" data-ins="${p + 1}"><small>${pad(p + 1)}</small><span>${esc(m.tile)}</span><button class="tx" data-a="rmflow" data-i="${p}" aria-label="Remove activity">✕</button></div>`; }
    return gap(p) + `<div class="tile ${p === s.pos ? 'on' : ''}" data-a="tile" data-i="${p}" data-ins="${p + 1}"><small>${pad(p + 1)}</small><span>Slide ${it.i + 1}/${sl.length}</span></div>`;
  }).join('') + gap(f.length);
  return `<section class="plan2 ${L.plan ? '' : 'collapsed'}"><div class="planclip"><div class="planbody"><h2 class="phead">Studio flow</h2><div class="tiles">${tiles}</div>
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
async function openAISettings() {
  if (!(window.shell && window.shell.ai)) return modal(`<h4>AI question writer</h4><p class="sub">This is available in the desktop app. The browser preview uses the template questions.</p><div class="row"><button class="sm p" data-x>Close</button></div>`);
  const st = await window.shell.ai.status();
  const names = { 'claude-sonnet-5-5': 'Claude Sonnet 5.5 — balanced', 'claude-haiku-5-5': 'Claude Haiku 5.5 — fastest, lowest cost', 'claude-opus-5-5': 'Claude Opus 5.5 — most capable' };
  const opt = (v, title, sub) => `<label class="aiopt"><input type="radio" name="aiprov" value="${v}" ${st.provider === v ? 'checked' : ''}><span><b>${title}</b><small>${sub}</small></span></label>`;
  const sec = (v, html) => `<div class="aisec" data-sec="${v}" ${st.provider === v ? '' : 'hidden'}>${html}</div>`;
  const local = ['qwen2.5:3b|about 2 GB · recommended', 'llama3.2:3b|about 2 GB', 'gemma3:4b|about 3.3 GB · better wording, slower'];
  modal(`<div class="k2">✦ AI question writer</div><h4>Who writes the concept check questions?</h4>
  <div class="aiopts">
    ${opt('template', 'Built-in templates', 'Free · works offline · uses the slide text and the week’s outcome')}
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
  ${q.type === 'mc' ? `<div class="cdoptlist">${slots.map((o, k) => `<div class="cdoptrow"><input type="radio" name="ok${i}" value="${k}" ${o.ok ? 'checked' : ''} title="Correct answer"><span class="let">${'ABCD'[k]}</span><input class="cdo" value="${esc(o.t)}" placeholder="Option ${'ABCD'[k]}"></div>`).join('')}<small class="muted">Select the circle next to the correct answer.</small></div>` : ''}
  ${q.type === 'scale' ? `<div class="cdoptrow"><input class="cdlo" value="${esc(q.lo || 'Not yet')}" placeholder="Low label"><input class="cdhi" value="${esc(q.hi || 'Very')}" placeholder="High label"></div>` : ''}</div>`;
}
function readBlock(i, q) {
  const b = document.querySelector(`.cdblock[data-i="${i}"]`); if (!b) return;
  q.text = b.querySelector('.cdq').value.trim() || q.text;
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
    case 'toggleq': { L.qopen = !L.qopen; document.querySelector('.sess2')?.classList.toggle('qclosed', !L.qopen); a.setAttribute('aria-pressed', L.qopen); return; }
    case 'end': L.menu = false; V = 'ov'; if (s.liveWeek in s.weeks) O.w = s.liveWeek; toast('Session ended · questions saved'); break;
    case 'prev': if (A && A.q > 0) A.q--; else goTo(s, s.pos - 1); break;
    case 'next': if (A && A.q < actQs().length - 1) A.q++; else goTo(s, s.pos + 1); break;
    case 'tile': goTo(s, +a.dataset.i); break;
    case 'rmflow': { const f = flowOf(s), i = +a.dataset.i; f.splice(i, 1); if (i < s.pos) s.pos--; if (s.pos >= f.length) s.pos = f.length - 1; syncA(s); break; }
    case 'actclose': { const f = flowOf(s); goTo(s, s.pos < f.length - 1 ? s.pos + 1 : s.pos - 1); break; }
    case 'upload': L.menu = false; return $('#slideFile').click();
    case 'qnum': q.seen = !q.seen; renderQP(); return;
    case 'qopen': q.seen = true; L.open = L.open === q.id ? null : q.id; L.reply = L.open === q.id && q.st === 'open' ? q.id : null; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reply': L.reply = L.reply === q.id ? null : q.id; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'reopen': q.st = 'open'; q.ans = null; renderQP(); return;
    case 'cdedit': {
      const cd = ensureCD(s, s.pos); cdDraft = JSON.parse(JSON.stringify(cd.qs));
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
        try { fresh = await aiBuildCD(ctx); } catch (err) { toast('AI unavailable: ' + err.message + ' Using the template questions.'); }
        fresh = fresh || buildCD(ctx);
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
      cd.qs = cdDraft.map((q, i) => { const old = cd.qs[i] || {}; const same = old.text === q.text && old.type === q.type && JSON.stringify(old.options) === JSON.stringify(q.options); return Object.assign({}, q, { res: same ? old.res : null, edited: old.edited || !same }); });
      A.q = Math.min(A.q, cd.qs.length - 1);
      $('#modal').innerHTML = ''; toast('Questions saved'); break;
    }
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
        toast(prov === 'template' ? 'Concept checks use the built-in templates.' : prov === 'ollama' ? 'Free local AI is on. New concept checks will be written on this laptop.' : 'Claude is on. New concept checks will be written from the slide text.');
      });
      return;
    }
    case 'aicheck': checkOllama(); return;
    case 'olpick': { const i = document.getElementById('olModel'); if (i) { i.value = a.dataset.m; checkOllama(); } return; }
    case 'aiclear': window.shell.ai.clear().then(() => { $('#modal').innerHTML = ''; toast('Saved key removed. Concept checks use the built-in templates.'); }); return;
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
  const s = S(), cd = flowOf(s)[s.pos] && flowOf(s)[s.pos].cd; if (!cd) return;
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

render();function answersHTML(q) {
  const r = ensureRes(q);
  if (q.type === 'mc') {
    const tot = r.counts.reduce((x, y) => x + y, 0) || 1;
    return `<div class="cdopts">${q.options.map((o, i) => `<div class="cdopt ${o.ok ? 'ok' : ''}"><i class="rbar" style="width:${Math.round(r.counts[i] / tot * 100)}%"></i><span class="let">${'ABCDEF'[i]}</span><span class="otxt">${esc(o.t)}</span><span class="ocnt">${r.counts[i]}${o.ok ? ' ✓' : ''}</span></div>`).join('')}</div>`;
  }
  if (q.type === 'scale') {
    const tot = r.counts.reduce((x, y) => x + y, 0) || 1, avg = r.counts.reduce((x, c, i) => x + c * (i + 1), 0) / tot, mx = Math.max(...r.counts, 1);
    return `<div class="cdscale">${r.counts.map((c, i) => `<div class="sbox"><i class="rbar" style="height:${Math.round(c / mx * 100)}%"></i><b>${i + 1}</b><small>${c}</small></div>`).join('')}</div><div class="cdlabels"><span>${esc(q.lo || 'Not yet')}</span><span>Average ${avg.toFixed(1)}</span><span>${esc(q.hi || 'Very')}</span></div>`;
  }
  return `<div class="cdopen"><div class="ophead"><b>${r.n}</b> responses · students can write in any language · only you see these</div>${r.shown.map(k => { const sm = SAMPLES[k]; return `<div class="oresp"><p>${esc(sm.en || sm.t)}</p>${sm.lang ? `<small>Translated from ${sm.lang}: “${esc(sm.t)}”</small>` : ''}</div>`; }).join('')}</div>`;
}
function cdCard(s, f, m) {
  const cd = ensureCD(s, s.pos), q = cd.qs[Math.min(A.q, cd.qs.length - 1)];
  return `<div class="card2 actcard cdcard" style="background:${m.color}"><div class="cdtop"><span class="cdchip">✦ CONCEPT CHECK</span><span class="bloomchip">${esc(q.label)}</span><span class="spacer"></span><span class="cdbrand">Studio Bridge</span><button class="sm" data-a="cdedit">✎ Edit questions</button><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="cdbody"><small class="cdnum">QUESTION ${A.q + 1} OF ${cd.qs.length} · ${TYPE_NAMES[q.type]}</small><h3 class="cdq">${esc(q.text)}</h3><p class="cdsrc">Checking your understanding of: ${esc(q.source || cd.source)}</p><div id="cdAns">${answersHTML(q)}</div><div class="cdfoot">${cd.pending ? '<span class="aiflag busy">✦ Writing questions from this slide…</span> · ' : cd.by === 'ai' ? `<span class="aiflag">✦ ${cd.edited ? 'AI draft, edited' : 'AI draft from this slide · check before you use it'}</span> · ` : ''}${esc(q.note)} · <b>${esc(cd.lo)}</b> ${esc(cd.out)}</div></div>
  ${navOverlay(A.q, cd.qs.length, A.q > 0 || s.pos > 0, A.q < cd.qs.length - 1 || s.pos < f.length - 1)}</div>`;
}

