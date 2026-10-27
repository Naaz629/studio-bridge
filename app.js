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
  $('#navLiveSub').textContent = `Week ${s0.liveWeek} in progress`;
  $('#crumb').innerHTML = V === 'live' ? `<b>Session</b><span>/</span><span class="sub">${esc(s0.name)} · Week ${s0.liveWeek}</span>` : `<b>Overview</b><span>/</span><span class="sub">${esc(s0.name)} · Week ${O.w}</span>`;
  $('#view').innerHTML = V === 'live' ? live() : overview();
  courseBtn(); mainMenu(); botbar();
  if (V === 'live') renderQP();
}
function courseBtn() {
  const s = S();
  $('#course').innerHTML = `<button class="coursebtn" data-a="subj" aria-expanded="${L.subj}"><span class="badge">${esc(s.badge)}</span><span><b>${esc(s.name)}</b><small>${esc(s.code)} · ${esc(s.term)}</small></span><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
  ${L.subj ? `<div class="menu subjmenu"><div class="mh"><b>Change subject</b></div>${SUBJECTS.map((x, i) => `<button data-a="pick" data-i="${i}" aria-checked="${i === si}"><span class="badge sm">${esc(x.badge)}</span><span><b>${esc(x.name)}</b><small>${esc(x.code)}</small></span>${i === si ? '<span class="tick">✓</span>' : ''}</button>`).join('')}</div>` : ''}`;
}
function mainMenu() {
  const m = $('#mainMenu'); m.hidden = !L.menu;
  m.innerHTML = `<button data-a="upload">Upload slides for ${esc(S().name)}</button><button data-a="end">End session</button>`;
}
function botbar() {
  const b = $('#botbar'), s = S();
  b.style.display = V === 'live' ? '' : 'none';
  b.innerHTML = `${L.plan ? planStrip(slidesFor(s), s) : ''}
  <div class="barrow"><button class="bb planbtn" data-a="toggleplan" aria-pressed="${L.plan}">Session plan ${L.plan ? '▾' : '▴'}</button><span class="spacer"></span>
  <button class="bb" data-a="toggleq" id="qbtn" aria-pressed="${L.qopen}">Activity <span class="bdg" id="bdg">${unanswered()}</span></button>
  <span class="bb reactlbl" aria-label="Class reactions appear here"><span class="reactemo">${EMOJIS.map(e => `<i>${e.e}</i>`).join("")}</span></span></div>`;
}
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function spawnEmoji(k) {
  const layer = $('#floatlayer'); if (!layer || V !== 'live' || REDUCED) return;
  const em = EMOJIS.find(x => x.k === k); if (!em) return;
  const el = document.createElement('span');
  el.className = 'fe'; el.textContent = em.e;
  el.style.setProperty('--x', Math.round(Math.random() * 80) + '%');
  el.style.setProperty('--sway', (Math.random() * 60 - 30).toFixed(0) + 'px');
  el.style.setProperty('--dur', (2.8 + Math.random() * 1.6).toFixed(2) + 's');
  el.addEventListener('animationend', () => el.remove());
  layer.appendChild(el);
}

/* ---------- live view ---------- */
function slideCard(sl, s) {
  const cur = sl[Math.min(s.slideIdx, sl.length - 1)];
  const body = cur.img ? `<img class="simg" src="${esc(cur.img)}" alt="${esc(cur.t)}">` : `<div class="stext"><small>SLIDE ${s.slideIdx + 1} OF ${sl.length}</small><h2>${esc(cur.t)}</h2><p>${esc(cur.p || '')}</p></div>`;
  return `<div class="slidewrap2"><div class="slidepage">${body}</div>
  <div class="snav"><button class="lk" data-a="prev" ${s.slideIdx === 0 ? 'disabled' : ''}>Previous</button>
  <span class="snavmid">${(s.attach[s.slideIdx] || []).map(a => `<button class="run" style="background:${ACT_META[a].color}" data-a="run" data-t="${esc(a)}">▶ ${esc(a)}</button>`).join('')}<span class="dotsrow">${sl.slice(0, 12).map((_, i) => `<i class="${i === s.slideIdx ? 'on' : ''}"></i>`).join('')}</span></span>
  <button class="lk" data-a="next" ${s.slideIdx >= sl.length - 1 ? 'disabled' : ''}>Next</button></div></div>`;
}
function actCard() {
  const m = ACT_META[A.type], p = PROMPTS[A.type];
  return `<div class="card2 actcard" style="background:${m.color}"><div class="ahead"><div><small>${A.type === 'Discussion Activity' ? 'DISCUSSION ACTIVITY' : 'ACTIVITY'}</small><h2>${esc(m.title)}</h2></div><button class="x" data-a="actclose" aria-label="Close activity">✕</button></div>
  <div class="abody"><small>QUESTION ${A.q + 1} OF ${p.length}</small><h3>${esc(p[A.q])}</h3><textarea placeholder="Add your thoughts here…" aria-label="Your thoughts"></textarea><div class="meta">${8 + A.q * 3} students have responded</div></div>
  <div class="cfoot"><button class="lk" data-a="prev" ${A.q === 0 ? 'disabled' : ''}>Previous</button><span class="dotsrow">${p.map((_, i) => `<i class="${i === A.q ? 'on' : ''}"></i>`).join('')}</span><button class="lk" data-a="next" ${A.q >= p.length - 1 ? 'disabled' : ''}>Next</button></div></div>`;
}
function planStrip(sl, s) {
  return `<section class="plan2"><div class="ph"><div><small>SESSION PLAN</small><h2>Week ${s.liveWeek} studio flow</h2></div></div>
  <div class="tiles">${sl.map((x, i) => { const at = (s.attach[i] || [])[0]; const m = at && ACT_META[at]; return `<div class="tile ${i === s.slideIdx ? 'on' : ''}" ${m ? `style="background:${m.color}"` : ''} data-a="tile" data-i="${i}" data-drop="${i}"><small>${pad(i + 1)}</small><span>${m ? esc(m.tile) : `Slide ${i + 1}/${sl.length}`}</span></div>`; }).join('')}</div>
  <div class="chips2">${ACTIVITY_TYPES.map(a => `<div class="achip2" draggable="true" data-act="${esc(a)}" style="background:${ACT_META[a].color}">${esc(a)}</div>`).join('')}<span class="meta" style="align-self:center">${s.upload ? 'Slides: ' + esc(s.upload) : 'Drag an activity onto a slide'}</span></div></section>`;
}
function live() {
  const s = S(), sl = slidesFor(s), t = s.topics[s.liveWeek];
  return `<div class="sess2 ${L.qopen ? '' : 'qclosed'}"><section class="left"><div class="wk"><div><small>WEEK ${s.liveWeek}</small><h1>${esc(t[0])}</h1></div><span class="livetag"><i></i>LIVE SESSION</span></div>
  <div class="stagebox" data-drop="${s.slideIdx}">${A ? actCard() : slideCard(sl, s)}</div></section>
  <aside class="rightcol" id="qp" aria-label="Questions and answers"></aside></div>`;
}
function renderQP() {
  const el = $('#qp'); if (!el) return;
  const s = S(), list = [...s.qs].sort((x, y) => (x.st === 'open' ? 0 : 1) - (y.st === 'open' ? 0 : 1) || y.up - x.up);
  el.innerHTML = `<div class="qh"><small>Activity</small><h2>Questions &amp; answers</h2></div>
  <div class="qrows">${list.map((q, i) => { const open = L.open === q.id, en = q.tr || q.text, green = q.seen || q.st !== 'open'; return `<div class="qr ${q.st !== 'open' ? 'done' : ''} ${green ? 'seen' : ''}">
    <div class="qwrap"><button class="qrow" data-a="qopen" data-q="${q.id}"><span class="qn">${pad(i + 1)}</span><span class="qtxt"><span class="qt">${q.st !== 'open' ? '✓ ' : ''}${esc(en)}</span>${q.tr ? `<span class="qorig">Original: ${esc(q.text)}</span>` : ''}</span></button>
    ${q.up ? `<span class="asked" title="${q.up} students asked">${q.up}</span>` : ''}</div>
    ${open ? `<div class="qd">
      <div class="meta">${esc(q.who)} · ${q.ago ? q.ago + ' min ago' : 'just now'} · ${q.same} same question</div>
      ${q.st === 'verbal' ? `<div class="box verbal">🎙 <span><b>Answered verbally in class</b><small>You responded at ${esc(q.at)}</small></span></div>` : ''}
      ${q.ans ? `<div class="box ans"><b>Dr. Priya Nair</b><p>${esc(q.ans)}</p></div>` : ''}
      ${q.st === 'open' ? `<form class="inl" data-q="${q.id}"><input placeholder="Type your answer…" aria-label="Answer"><button class="sm p">Post</button></form><div class="qacts"><button class="sm" data-a="verbal" data-q="${q.id}">🎙 Answered verbally</button></div>` : `<div class="qacts"><button class="sm" data-a="reopen" data-q="${q.id}">Reopen</button></div>`}</div>` : ''}</div>`; }).join('') || '<div class="none">No questions yet.</div>'}</div>
  <button class="addq" data-a="addq">+ Add a question</button>`;
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
function runActivity(type) { A = { type, q: 0 }; V = 'live'; render(); }
function attach(i, type) {
  if (!ACTIVITY_TYPES.includes(type)) return;
  const s = S(); s.attach[i] = s.attach[i] || [];
  if (!s.attach[i].includes(type)) s.attach[i].push(type);
  s.slideIdx = i; toast(`${type} added to slide ${i + 1}`); runActivity(type);
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
  if (e.target.closest('[data-addok]')) { const v = $('#newq').value.trim(); $('#modal').innerHTML = ''; if (v) { S().qs.push({ id: qid++, who: 'You', av: 'dk', text: v, ago: 0, up: 0, same: 0, st: 'open' }); toast('Question added'); renderQP(); } return; }
  if (e.target.matches('[data-x]') || e.target.closest('button[data-x]')) { $('#modal').innerHTML = ''; return; }
  const a = e.target.closest('[data-a]');
  if (!a) { if (L.menu || L.subj) { L.menu = L.subj = false; courseBtn(); mainMenu(); } if (e.target.closest('#burger')) { } return; }
  const s = S(), q = s.qs.find(x => x.id == a.dataset.q), act = a.dataset.a;
  const top = () => [...s.qs].filter(x => x.st === 'open').sort((x, y) => y.up - x.up)[0];
  switch (act) {
    case 'subj': L.subj = !L.subj; L.menu = false; break;
    case 'pick': si = +a.dataset.i; L.subj = false; A = null; if (!S().weeks[O.w]) O.w = S().liveWeek in S().weeks ? S().liveWeek : +Object.keys(S().weeks)[0]; O.open = null; toast('Subject: ' + S().name); break;
    case 'toggleplan': L.plan = !L.plan; botbar(); return;
    case 'toggleq': { L.qopen = !L.qopen; document.querySelector('.sess2')?.classList.toggle('qclosed', !L.qopen); a.setAttribute('aria-pressed', L.qopen); return; }
    case 'end': L.menu = false; V = 'ov'; if (s.liveWeek in s.weeks) O.w = s.liveWeek; toast('Session ended · questions saved'); break;
    case 'prev': if (A) A.q = Math.max(0, A.q - 1); else s.slideIdx = Math.max(0, s.slideIdx - 1); break;
    case 'next': if (A) A.q = Math.min(PROMPTS[A.type].length - 1, A.q + 1); else s.slideIdx = Math.min(slidesFor(s).length - 1, s.slideIdx + 1); break;
    case 'tile': s.slideIdx = +a.dataset.i; { const at = (s.attach[s.slideIdx] || [])[0]; A = at ? { type: at, q: 0 } : null; } break;
    case 'run': return runActivity(a.dataset.t);
    case 'actclose': A = null; break;
    case 'upload': L.menu = false; return $('#slideFile').click();
    case 'addq': return modal(`<h4>Add a question</h4><textarea id="newq" placeholder="Type a question for the class…"></textarea><div class="row"><button class="sm" data-x>Cancel</button><button class="sm p" data-addok>Add</button></div>`);
    case 'qopen': q.seen = true; L.open = L.open === q.id ? null : q.id; L.reply = L.open === q.id && q.st === 'open' ? q.id : null; renderQP(); document.querySelector('.inl input')?.focus(); return;
    case 'verbal': q.st = 'verbal'; q.at = now(); toast('Marked as answered verbally · students notified'); renderQP(); return;
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
$('#slideFile').addEventListener('change', e => {
  const files = [...e.target.files], s = S(); if (!files.length) return;
  s.upload = files.length === 1 ? files[0].name : `${files.length} files`;
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (imgs.length) { s.uploads = imgs.map(f => ({ name: f.name, url: URL.createObjectURL(f) })); s.slideIdx = 0; }
  e.target.value = ''; toast(`Slides uploaded for ${s.name}`); render();
});

/* drag & drop: activity chip -> plan tile or the live card */
document.addEventListener('dragstart', e => { const a = e.target.closest('[data-act]'); if (a) { e.dataTransfer.setData('text/plain', a.dataset.act); L.dragging = true; } });
document.addEventListener('dragend', () => { L.dragging = false; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
document.addEventListener('dragover', e => { const d = e.target.closest('[data-drop]'); if (d) { e.preventDefault(); document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); d.classList.add('over'); } });
document.addEventListener('drop', e => { const d = e.target.closest('[data-drop]'); if (!d) return; e.preventDefault(); L.dragging = false; attach(+d.dataset.drop, e.dataTransfer.getData('text/plain')); });

/* simulated live class: reactions and new questions */
const busy = () => V !== 'live' || L.reply || L.dragging || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.closest?.('.inl');
setInterval(() => { if (V !== 'live' || L.dragging) return; const k = EMOJIS[Math.floor(Math.random() * EMOJIS.length)].k; S().reactions[k]++; spawnEmoji(k); if (!busy() && Math.random() < .4) { const qs = S().qs; qs[Math.floor(Math.random() * qs.length)].up++; renderQP(); } }, 1300);
setInterval(() => { if (busy() || !POOLQ.length) return; const p = POOLQ.shift(), s = S(); s.qs.forEach(q => { q.ago++; }); s.qs.push({ id: qid++, who: p[0], av: p[1], text: p[2], tr: p[3], ago: 0, up: 1, same: 0, st: 'open' }); renderQP(); }, 25000);

render();
