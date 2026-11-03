/* Studio Bridge sync: connects the Tutor UI to the Student UI through Supabase (see supabase/DATA-CONTRACT.md).
   The tutor opens a class (a short code); students join it. Questions, reactions and answers arrive live, and the tutor's
   slide, activity and "answered" marks go back. Every action is also written to the events table (the log).
   Without a connection (or with ?nosync in the address) the app keeps working on its sample data. */
const Sync = (() => {
  const URL = 'https://nqalksankethoskforml.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xYWxrc2Fua2V0aG9za2Zvcm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTExMDQsImV4cCI6MjEwOTA4NzEwNH0.qEUGoFSJ0daEi_pXkAzibT9PUhmZ7rmlfO8UrRMBgf8';
  const ACT_KIND = { 'Concept Development': 'concept', 'Q&A Session': 'qa', 'Discussion Activity': 'discussion', 'Artefact upload': 'artefact', 'Reflection': 'reflection' };
  const REACT_MAP = { got: 'und', think: 'con', confused: 'qst', insight: 'idea', applause: 'great' };   // student kind -> tutor emoji
  const TUTOR = 'Dr. Priya Nair';
  const me = { on: false, real: 0, code: null, client: null, error: null };
  let lastKey = '', lastQa = null, timer = null;

  const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; return c; };
  /* this is a demo: everyone joins the same class, so nobody has to type a code (add ?code=XXXX to try a private class) */
  function pickCode() { const q = new URLSearchParams(location.search).get('code'); return q ? q.toUpperCase() : 'DEMO'; }
  const tick = () => { if (typeof V !== 'undefined' && V === 'live' && typeof renderQP === 'function') renderQP(); };
  const refresh = () => { if (typeof render === 'function' && typeof V !== 'undefined' && V === 'live') render(); };
  const err = (what, e) => { me.error = what + ': ' + ((e && e.message) || e); console.warn('[sync]', me.error); };

  function log(type, payload = {}) {
    if (!me.on) return;
    me.client.from('events').insert({ session: me.code, role: 'tutor', type, actor: TUTOR, payload }).then(r => r.error && err('log', r.error.message));
  }
  /* ---- database rows <-> tutor questions ---- */
  function fromRow(r) {
    return { id: qid++, dbId: r.id, who: r.anonymous ? 'Anonymous' : (r.student || 'Student'), av: r.anonymous ? 'lav' : '', text: r.text, tr: r.text_en || undefined,
      ago: Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)), at: new Date(r.created_at).getTime(), up: r.upvotes || 1, same: 0, st: r.status === 'ans' ? 'ans' : 'open', ans: r.answer || undefined, slide: r.slide, real: true };
  }
  /* a question written in Chinese is always shown in English first (with "Show original"); the English is also saved for the students */
  function translateQuestion(q, r) {
    if (q.tr || !/[\u3400-\u9fff]/.test(q.text) || typeof Cap === 'undefined') return;
    Cap.translate(q.text, 'zh', 'en').then(en => {
      if (!en) return; q.tr = en; tick(); refresh();
      me.client.from('questions').update({ text_en: en, lang: 'zh' }).eq('id', r.id).is('text_en', null).then(x => x.error && err('translate', x.error.message));
    });
  }
  function addQuestion(r) {
    const qs = S().qs; if (qs.some(q => q.dbId === r.id)) return;
    const q = fromRow(r); qs.push(q); me.real++; translateQuestion(q, r); tick(); refresh();
  }
  function updateQuestion(r) {
    const q = S().qs.find(x => x.dbId === r.id); if (!q) return addQuestion(r);
    q.up = r.upvotes || q.up; q.st = r.status === 'ans' ? 'ans' : 'open'; q.ans = r.answer || undefined; q.at = new Date(r.created_at).getTime(); q.ago = Math.max(0, Math.round((Date.now() - q.at) / 60000)); tick();   // a recycled question comes back as just asked
  }
  function onResponse(r) {
    me.real++;
    const s = S(), p = r.payload || {}, f = flowOf(s), pos = f.findIndex((it, i) => it.k === 'a' && (me.code + '-a' + i) === r.activity_id);
    if (r.kind === 'discussion') { const c = DISCUSS_CARDS[p.card]; if (c) { s.cards[c.k]++; refresh(); } return; }
    if (r.kind === 'choice' || r.kind === 'rating') {
      const cd = pos >= 0 && f[pos].cd, q = cd && cd.qs && cd.qs[p.q || 0]; if (!q) return;
      const res = ensureRes(q); if (q.type === 'mc') { if (res.counts[p.answer] != null) res.counts[p.answer]++; } else if (q.type === 'scale') { const k = Math.max(1, Math.min(5, +p.answer)) - 1; res.counts[k]++; } else res.n++;
      refresh(); return;
    }
    const txt = () => ({ t: p.text || '', en: p.text_en || undefined, lang: p.text_en && p.lang && /^zh/i.test(p.lang) ? 'Chinese' : undefined });   // the Original link only when there is an English version
    if (r.kind === 'open') {   // a free-text answer: to a concept-check question, or to a reflection
      const it = pos >= 0 && f[pos];
      if (it && it.cd && it.cd.qs) { const q = it.cd.qs[p.q || 0]; if (!q) return; const res = ensureRes(q); (res.real = res.real || []).unshift(txt()); res.real = res.real.slice(0, 3); res.n++; refresh(); return; }
      if (it && it.rf && it.rf.state === 'ready') { const res = rfRes(it.rf); (res.real = res.real || []).unshift(txt()); res.real = res.real.slice(0, 3); res.n++; refresh(); }
      return;
    }
    if (r.kind === 'peer_reply') {   // a student's reply to a classmate, shown under the activity
      const it = pos >= 0 && f[pos]; if (!it) return;
      (it.peer = it.peer || []).unshift(Object.assign(txt(), { who: r.student || 'Student' })); it.peer = it.peer.slice(0, 4); refresh(); return;
    }
    if (r.kind === 'qa_reply') {   // a student's reply to a question in the Q&A session
      const q = S().qs.find(x => x.dbId === p.questionId); if (!q) return;
      (q.replies = q.replies || []).push(Object.assign(txt(), { who: r.student || 'Student' })); refresh(); return;
    }
    if (r.kind === 'reflection') {
      const rf = pos >= 0 && f[pos].rf; if (!rf || rf.state !== 'ready') return;
      const res = rfRes(rf); (res.real = res.real || []).unshift({ t: p.text || '', en: p.text_en, lang: p.lang }); res.real = res.real.slice(0, 3); res.n++; refresh(); return;
    }
    if (r.kind === 'artefact' && p.url) { (s.liveArts = s.liveArts || []).push([r.student || 'Student', p.name || 'Artefact', p.url, !r.student, r.team || null]); refresh(); }
  }
  /* every reaction a student sends (or the class sends) counts up here at once, with the pop; the totals are re-read from the database every 20 s so both apps agree */
  function onReaction(r) { const k = REACT_MAP[r.kind] || r.kind; if (S().reactions[k] != null) { S().reactions[k]++; me.real++; popBall(k); } }

  async function start(fresh) {
    if (!window.supabase || /[?&]nosync/.test(location.search)) return;
    try {
      if (!me.client) me.client = window.supabase.createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 10 } } });
      const c = me.client; me.code = pickCode();
      if (me.code === 'DEMO') await c.rpc('demo_fresh', { c: 'DEMO' });   // a new test starts clean when the last one ended a while ago
      const up = await c.from('sessions').upsert({ code: me.code, unit: S().code, week: S().liveWeek }, { onConflict: 'code', ignoreDuplicates: false });
      if (up.error) throw up.error;
      me.on = true; me.error = null; lastKey = ''; cur = {};
      const beat = () => me.client.from('sessions').update({ tutor_seen: new Date().toISOString() }).eq('code', me.code).then(r => r.error && err('heartbeat', r.error.message));
      beat(); clearInterval(me.beatTimer); me.beatTimer = setInterval(beat, 40000);
      if (me.chan) c.removeChannel(me.chan);
      const f = 'session=eq.' + me.code;
      me.chan = c.channel('class-' + me.code)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions', filter: f }, p => addQuestion(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions', filter: f }, p => updateQuestion(p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: f }, p => onReaction(p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses', filter: f }, p => onResponse(p.new))
        .subscribe();
      S().qs.splice(0);   // the shared class is the one list: the tutor and the students see the same questions
      const old = await c.from('questions').select('*').eq('session', me.code).order('created_at');
      if (old.data) old.data.forEach(addQuestion);
      await loadReactions(); clearInterval(me.recountTimer); me.recountTimer = setInterval(loadReactions, 20000);
      log(fresh ? 'session_started' : 'session_resumed', { unit: S().code, week: S().liveWeek });
      refresh();
    } catch (e) { me.on = false; err('connect', e); }
  }

  /* reaction numbers: the database is the one source for both apps, so they always show the same count */
  async function loadReactions() {
    if (!me.on) return;
    try {
      const kinds = Object.keys(REACT_MAP);
      const rs = await Promise.all(kinds.map(k => me.client.from('reactions').select('*', { count: 'exact', head: true }).eq('session', me.code).eq('kind', k)));
      if (rs.some(r => r.error)) throw rs.find(r => r.error).error;
      kinds.forEach((k, i) => { S().reactions[REACT_MAP[k]] = rs[i].count || 0; });
      if (typeof renderQP === 'function' && typeof V !== 'undefined' && V === 'live') renderQP();
    } catch (e) { err('reactions', e); }
  }
  /* ---- tutor -> students: slide, activity and the AI-written questions ---- */
  function push() {
    if (!me.on) return; clearTimeout(timer);
    timer = setTimeout(() => {
      const s = S(), f = flowOf(s), it = f[s.pos]; if (!it) return;
      let slide = null; for (let p = s.pos; p >= 0; p--) if (f[p].k === 's') { slide = f[p].i + 1; break; }
      const act = it.k === 'a' ? { id: me.code + '-a' + s.pos, kind: ACT_KIND[it.act] || it.act } : null;
      const spec = !act ? null : it.act === 'Concept Development' ? { questions: (it.cd && it.cd.state === 'ready' ? it.cd.qs : []) } : it.act === 'Reflection' ? { question: it.rf && it.rf.state === 'ready' ? it.rf.question : '', hint: it.rf && it.rf.hint || '' } : {};
      // the question the tutor is showing in the Q&A: students see the same card (a quiet update, not a slide or activity command)
      const qaId = act && it.act === 'Q&A Session' ? ((sortedQs(s)[(A && A.q) || 0] || {}).dbId || null) : null;
      if (qaId !== lastQa) { lastQa = qaId; writeState({ qaQuestion: qaId }, false); }
      const key = JSON.stringify([slide, act, spec]); if (key === lastKey) return;
      const first = lastKey === ''; lastKey = key;
      writeState({ slide, activityId: act && act.id, activityKind: act && act.kind });
      if (act) me.client.from('activities').upsert({ id: act.id, session: me.code, kind: act.kind, slide, spec }, { onConflict: 'id' }).then(r => r.error && err('activity', r.error.message));
      if (!first) log(act ? 'activity_started' : 'slide_changed', { slide, activity: act && act.kind });
    }, 350);
  }
  /* the tutor marked a question answered / open again, or wrote an answer */
  /* the whole state object is written each time, so the latest caption is never lost when the slide changes (and the reverse) */
  let cur = {};
  function writeState(patch, bump = true) {   // a caption must not look like a new slide or activity command, so it keeps the old updatedAt
    if (!me.on) return; cur = Object.assign(cur, patch); if (bump || !cur.updatedAt) cur.updatedAt = new Date().toISOString();
    me.client.from('sessions').update({ state: cur }).eq('code', me.code).then(r => r.error && err('state', r.error.message));
  }
  /* a live caption: English + Chinese, shown to students */
  function setCaption(c) {
    if (!me.on || !c) return;
    writeState({ caption: { en: c.en, zh: c.zh, src: c.src, lang: c.lang, at: new Date(c.at).toISOString() } }, false);
    log('caption', { lang: c.lang, en: c.en });
  }
  function setQuestion(q) {
    if (!me.on || !q || !q.dbId) return;
    me.client.from('questions').update({ status: q.st === 'open' ? 'open' : 'ans', answer: q.ans || null }).eq('id', q.dbId).then(r => r.error && err('question', r.error.message));
    log(q.st === 'open' ? 'question_reopened' : 'question_answered', { question: q.dbId });
  }
  return Object.assign(me, { start, push, log, setQuestion, setCaption, newClass: () => start(true) });
})();
window.addEventListener('load', () => setTimeout(() => Sync.start(false), 800));
