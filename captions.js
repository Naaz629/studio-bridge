/* Live captions: the tutor's voice becomes English captions on the tutor screen, and the same captions (English + a Chinese translation)
   go to the Student UI through Supabase (sessions.state.caption, plus a log row in events).
   Voice -> text uses the browser's speech recognition (Chrome or Edge, needs internet and microphone permission).
   Translation uses Chrome's built-in Translator when it exists, otherwise the free MyMemory service. */
const Cap = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const LANGS = { 'en-US': ['English', 'en'], 'zh-CN': ['中文', 'zh'] };
  const st = { on: false, lang: 'en-US', rec: null, interim: '', last: null, err: '', status: '', timer: 0, restarts: 0, local: (() => { try { return localStorage.getItem('sb-cap-local') === '1'; } catch (e) { return false; } })() };
  const cache = new Map();
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(''), ms))]);   // never wait long for a translation

  /* ---- translation ---- */
  async function translate(text, from, to) {
    const key = from + '>' + to + '>' + text; if (cache.has(key)) return cache.get(key);
    let out = '';
    try {
      if (typeof self.Translator !== 'undefined' && !st.noBuiltIn) {
        out = await timeout((async () => { const t = await self.Translator.create({ sourceLanguage: from, targetLanguage: to }); return t.translate(text); })(), 2500);
        if (!out) st.noBuiltIn = true;   // not usable here: do not wait for it again
      }
    } catch (e) { out = ''; st.noBuiltIn = true; }
    for (let attempt = 0; attempt < 2 && !out; attempt++) {   // the free service now and then answers late or not at all: try twice
      if (attempt) await new Promise(r => setTimeout(r, 700));
      try {
        const pair = (from === 'zh' ? 'zh-CN' : from) + '|' + (to === 'zh' ? 'zh-CN' : to);
        const r = await timeout(fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 450)) + '&langpair=' + encodeURIComponent(pair)), 4000);
        const j = r && r.json ? await r.json() : null;
        out = j && +j.responseStatus === 200 ? (j.responseData && j.responseData.translatedText) || '' : '';
        if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) out = '';
      } catch (e) { out = ''; }
    }    if (out) { cache.set(key, out); if (cache.size > 200) cache.delete(cache.keys().next().value); }
    return out;
  }

  /* ---- a finished sentence: make both languages, show it, send it ---- */
  async function finalize(text, lang) {
    text = String(text || '').trim(); if (!text) return;
    const src = LANGS[lang][1];
    // 1. the tutor sees the sentence at once (in English if it was spoken in English)
    st.last = src === 'en' ? { en: text, zh: '', src: text, lang: 'en', at: Date.now() } : { en: '...', zh: text, src: text, lang: 'zh', at: Date.now() }; st.interim = ''; draw();
    // 2. then it is translated, shown, and sent to the students
    const other = await translate(text, src, src === 'en' ? 'zh' : 'en');
    const c = src === 'en' ? { en: text, zh: other, src: text, lang: 'en' } : { en: other || text, zh: text, src: text, lang: 'zh' };
    c.at = st.last.at; st.last = c; draw();
    if (typeof Sync !== 'undefined' && Sync.setCaption) Sync.setCaption(c);
    return c;
  }
  /* ---- what the tutor sees ---- */
  function esc(t) { return String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  function draw() {
    const host = document.querySelector('.livewrap .left') || document.querySelector('.livewrap'); if (!host) return;
    let el = document.getElementById('livecap');
    const recent = st.last && Date.now() - st.last.at < 12000;
    if (!st.on || (!st.interim && !recent)) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'livecap'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); host.appendChild(el); }
    el.innerHTML = st.interim
      ? '<span class="lc-en lc-interim">' + esc(st.interim) + '</span>'
      : '<span class="lc-en">' + esc(st.last.en) + '</span>' + (st.last.lang === 'zh' ? '<small class="lc-src">' + esc(st.last.src) + '</small>' : '');
    clearTimeout(st.timer); st.timer = setTimeout(draw, 12500);
  }
  function ctlHTML() {
    const L = LANGS[st.lang][0];
    return '<div class="capctl' + (st.on ? ' on' : '') + '">' +
      '<button type="button" data-a="captoggle" aria-pressed="' + st.on + '" data-tip="' + (SR ? 'Live captions: your voice becomes English captions for you and your students' : 'Live captions need Chrome or Edge') + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' +
      '<span>' + (st.on ? 'Captions on' : 'Captions') + '</span></button>' +
      (st.err ? '<small class="caperr">' + esc(st.err) + '</small>' : st.status ? '<small class="capstatus">' + esc(st.status) + '</small>' : '') + '</div>';
  }
  function refreshCtl() { const c = document.querySelector('.capctl'); if (c) c.outerHTML = ctlHTML(); }

  /* ---- the microphone ---- */
  function startRec() {
    if (!SR || st.local) { startLocal(); return; }   // no browser speech service: use the on-device model instead
    const rec = new SR(); st.rec = rec;
    rec.lang = st.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], t = r[0].transcript;
        if (r.isFinal) finalize(t, st.lang); else interim += t;
      }
      st.interim = interim.trim(); draw();
    };
    rec.onerror = e => {
      if (e.error === 'service-not-allowed') { useLocal(); return; }
      if (e.error === 'not-allowed') { st.err = 'Microphone blocked. Allow it in the address bar.'; st.on = false; }
      else if (e.error === 'network') { useLocal(); return; }   // the browser's speech service (Google) cannot be reached: switch to the on-device model
      else if (e.error === 'audio-capture') { st.err = 'No microphone found.'; st.on = false; }
      refreshCtl();
    };
    rec.onend = () => {   // the browser stops after a pause: keep listening while captions are on
      if (st.on && st.rec === rec) { st.restarts++; setTimeout(() => { if (st.on && st.rec === rec) try { rec.start(); } catch (e) {} }, 250); }
    };
    try { rec.start(); st.err = ''; } catch (e) { st.err = 'Could not start the microphone.'; st.on = false; }
    refreshCtl();
  }
  /* ---- on-device speech recognition: Whisper (tiny, English) running in the browser through the open-source Transformers.js ----
     No Google service and no key. The model (about 40 MB) downloads once and is kept by the browser. */
  const MODEL = 'Xenova/whisper-tiny.en', LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';
  let asrP = null, mic = null;
  function loadModel() {
    if (asrP) return asrP;
    asrP = (async () => {
      st.status = 'Loading the speech model (about 40 MB, first time only)…'; refreshCtl();
      const tf = await import(LIB); tf.env.allowLocalModels = false;
      const asr = await tf.pipeline('automatic-speech-recognition', MODEL);
      st.status = ''; refreshCtl(); return asr;
    })().catch(e => { asrP = null; st.status = ''; st.err = 'Could not load the speech model. Check the internet connection.'; st.on = false; refreshCtl(); throw e; });
    return asrP;
  }
  const quiet = t => !t || /^[\s.,!?-]*$/.test(t) || /^[\[(].*[\])]$/.test(t.trim()) || /^(thank you\.?|thanks for watching\.?|you)$/i.test(t.trim());   // what Whisper invents from silence
  async function transcribe(f32) {
    const asr = await loadModel();
    const out = await asr(f32);
    return String((out && out.text) || '').trim();
  }
  function useLocal() { st.local = true; try { localStorage.setItem('sb-cap-local', '1'); } catch (e) {} stopRec(); st.on = true; startLocal(); if (typeof toast === 'function') toast('Using the on-device speech model'); }
  async function startLocal() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { st.err = 'This browser cannot use the microphone.'; st.on = false; refreshCtl(); return; }
    st.err = '';
    try {
      const modelReady = loadModel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const srcNode = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1);
      const m = { stream, ctx, srcNode, proc, buf: [], pre: [], speaking: false, silent: 0, len: 0, queue: Promise.resolve() };
      const flush = () => {
        const n = m.len; if (n < 16000 * 0.6) { m.buf = []; m.len = 0; m.speaking = false; return; }
        const f = new Float32Array(n); let o = 0; for (const b of m.buf) { f.set(b, o); o += b.length; }
        m.buf = []; m.len = 0; m.speaking = false; m.silent = 0;
        st.interim = '…'; draw();
        m.queue = m.queue.then(async () => {
          try { const t = await transcribe(f); st.interim = ''; if (!quiet(t) && st.on) await finalize(t, 'en-US'); else draw(); }
          catch (e) { st.interim = ''; draw(); }
        });
      };
      proc.onaudioprocess = e => {
        const d = new Float32Array(e.inputBuffer.getChannelData(0)); let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const loud = Math.sqrt(sum / d.length) > 0.012;
        if (loud) { if (!m.speaking) { m.buf.push(...m.pre); m.len += m.pre.reduce((a, b) => a + b.length, 0); m.pre = []; } m.speaking = true; m.silent = 0; }
        if (m.speaking) { m.buf.push(d); m.len += d.length; if (!loud) { m.silent += d.length / 16000; if (m.silent >= 0.8) flush(); } if (m.len >= 16000 * 12) flush(); }
        else { m.pre.push(d); if (m.pre.length > 2) m.pre.shift(); }
      };
      srcNode.connect(proc); proc.connect(ctx.destination);
      mic = m; st.engine = 'local'; await modelReady; st.status = 'Listening'; refreshCtl();
      setTimeout(() => { if (st.status === 'Listening') { st.status = ''; refreshCtl(); } }, 2500);
    } catch (e) {
      st.err = e && e.name === 'NotAllowedError' ? 'Microphone blocked. Allow it in the address bar.' : (st.err || 'Could not start the microphone.'); st.on = false; refreshCtl();
    }
  }
  function stopLocal() {
    const m = mic; mic = null; if (!m) return;
    try { m.proc.disconnect(); m.srcNode.disconnect(); m.stream.getTracks().forEach(t => t.stop()); m.ctx.close(); } catch (e) {}
  }
  /* test helper: transcribe an audio file from a web address */
  async function transcribeUrl(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const audio = await ctx.decodeAudioData(buf); ctx.close();
    return transcribe(audio.getChannelData(0));
  }
  function stopRec() { stopLocal(); const r = st.rec; st.rec = null; st.interim = ''; if (r) try { r.stop(); } catch (e) {} draw(); }
  function toggle() { st.on = !st.on; if (st.on) startRec(); else { stopRec(); refreshCtl(); } if (typeof toast === 'function') toast(st.on ? 'Live captions on. Speak normally.' : 'Live captions off'); }
  function setLang(l) { if (!LANGS[l]) return; st.lang = l; if (st.on) { stopRec(); st.on = true; startRec(); } refreshCtl(); }
  /* for testing and for typed captions: push a finished sentence through the same path as the microphone */
  function say(text, lang) { return finalize(text, lang || st.lang); }
  return { st, ctlHTML, draw, toggle, setLang, say, translate, transcribeUrl, supported: true };
})();
