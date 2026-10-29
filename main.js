const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isMac = process.platform === 'darwin';

function createWindow() {
  // On macOS use the native traffic lights; elsewhere draw a macOS-style frame ourselves.
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1000, minHeight: 640,
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 }, vibrancy: 'sidebar' }
      : { frame: false }),
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  win.maximize();
  win.loadFile(path.join(__dirname, 'index.html'));
  // developer self-test: STUDIO_TEST_PDF / STUDIO_TEST_PPTX read the given files with the app's own slide reader and write a report
  if (process.env.STUDIO_TEST_OUT) {
    win.webContents.once('did-finish-load', async () => {
      let report;
      if (process.env.STUDIO_TEST_AI) { process.env.STUDIO_AI_URL = process.env.STUDIO_TEST_AI; aiSave({ provider: 'anthropic', key: 'sk-ant-test-0123456789abcdef', model: 'claude-haiku-5-5' }); }
      if (process.env.STUDIO_TEST_OLLAMA) { aiSave({ provider: 'ollama', ollamaUrl: process.env.STUDIO_TEST_OLLAMA, ollamaModel: 'qwen2.5:3b' }); }
      try {
        const b64 = p => (p && fs.existsSync(p)) ? fs.readFileSync(p).toString('base64') : null;
        const code = `(async () => {
          const mk = (b, n) => new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], n);
          const out = { origin: location.protocol };
          const pdf = ${JSON.stringify(b64(process.env.STUDIO_TEST_PDF))}, pptx = ${JSON.stringify(b64(process.env.STUDIO_TEST_PPTX))};
          if (pdf) { const t0 = performance.now(); const s = await readSlideFile(mk(pdf, 'test.pdf')); out.pdf = { pages: s.length, withText: s.filter(x => x.text).length, images: s.filter(x => (x.url||'').startsWith('data:image')).length, titles: s.slice(0, 3).map(x => x.title), ms: Math.round(performance.now() - t0) }; }
          if (pptx) { const s = await readSlideFile(mk(pptx, 'test.pptx')); out.pptx = { slides: s.length, titles: s.map(x => x.title), notes: s[0].text.includes('Notes') }; }
          if (${JSON.stringify(!!(process.env.STUDIO_TEST_AI || process.env.STUDIO_TEST_OLLAMA))} && pptx) {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const dt = new DataTransfer(); dt.items.add(mk(pptx, 'deck.pptx'));
            const inp = document.getElementById('slideFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
            await sleep(1500); insertAct(1, 'Concept Development'); await sleep(200);
            const early = (flowOf(S())[S().pos].cd || {}).pending;
            const t0 = Date.now(); await sleep(1500);
            while (flowOf(S())[S().pos].cd.pending && Date.now() - t0 < 240000) await sleep(1000);
            out.aiSeconds = Math.round((Date.now() - t0) / 1000);
            const cd = flowOf(S())[S().pos].cd;
            out.ai = { state: cd.state, asked: cd.asked, aiError: cd.aiError, status: await window.shell.ai.status(), pendingWhileWaiting: early, by: cd.by, pendingNow: cd.pending, error: cd.aiError || null, footer: (document.querySelector('.cdfoot') || {}).textContent, qs: cd.qs.map(q => q.type + ' | ' + q.text + (q.options ? ' | ' + q.options.map(o => (o.ok ? '*' : '') + o.t).join(' ; ') : '')) };
          }
          if (${JSON.stringify(!!process.env.STUDIO_TEST_UNIT)}) {
            const bad = await window.shell.unit.fetch('https://example.com/units/IDEA9301');
            const bad2 = await window.shell.unit.fetch('not a link');
            const r = await window.shell.unit.fetch('https://www.sydney.edu.au/units/IDEA9301/2026-S2C-ND-CC');
            const o = r.html ? parseUnitOutline(r.html, r.url) : null;
            out.unit = { refusedOtherSite: bad.error, refusedJunk: bad2.error, fetched: !!r.html, bytes: r.html ? r.html.length : 0, code: o && o.code, name: o && o.name, term: o && o.term, weeks: o && Object.keys(o.weeks).length, outcomes: o && Object.keys(o.ulo).length, assessments: o && o.assess.length, week6: o && JSON.stringify(o.weeks[6].tut) };
          }
          if (${JSON.stringify(!!process.env.STUDIO_TEST_INSIGHT)}) {
            const sleep2 = ms => new Promise(r => setTimeout(r, ms));
            O.w = 6; O.s = 'tut'; V = 'ov'; O.open = null; render();
            const o = weekOutcomes().outs[0]; O.open = o.id; render();
            const t0 = Date.now(); while ((o.insight || {}).state === 'pending' && Date.now() - t0 < 170000) await sleep2(1000);
            const panel = document.querySelector('.lopanel');
            out.insight = { seconds: Math.round((Date.now() - t0) / 1000), state: o.insight && o.insight.state, summary: o.insight && o.insight.summary, stuck: o.insight && o.insight.stuck, why: o.insight && o.insight.why, error: o.insight && o.insight.error, shownInPanel: panel ? panel.querySelector('.insight-text').textContent : null, stuckNumber: panel ? panel.querySelector('.stuckn b').textContent : null };
          }
          return out;
        })()`;
        report = await win.webContents.executeJavaScript(code);
      } catch (e) { report = { error: String(e && e.message || e) }; }
      fs.writeFileSync(process.env.STUDIO_TEST_OUT, JSON.stringify(report, null, 2));
      app.quit();
    });
  }
}
ipcMain.on('win', (e, action) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (action === 'close') w.close();
  else if (action === 'min') w.minimize();
  else if (action === 'max') w.isMaximized() ? w.unmaximize() : w.maximize();
});
const { execFile } = require('child_process');
const os = require('os');
const fs = require('fs');
ipcMain.handle('pptx2pdf', (e, input) => new Promise(resolve => {
  if (process.platform !== 'win32') return resolve({ error: 'Export the presentation as PDF and upload that.' });
  const out = path.join(os.tmpdir(), 'studio-bridge-' + Date.now() + '.pdf');
  const q = s => String(s).replace(/'/g, "''");
  const ps = "$ErrorActionPreference='Stop'; $p=New-Object -ComObject PowerPoint.Application; try { $d=$p.Presentations.Open('" + q(input) + "',$true,$true,$false); $d.SaveAs('" + q(out) + "',32); $d.Close() } finally { $p.Quit() }";
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 180000 }, err => {
    if (err || !fs.existsSync(out)) return resolve({ error: 'PowerPoint is needed to open .pptx files. Export it as PDF and upload that instead.' });
    const data = fs.readFileSync(out); fs.unlink(out, () => {});
    resolve({ data });
  });
}));
/* ---------- AI question writer ----------
   Three choices, picked in the ⋯ menu → AI question writer:
   - template  : built-in question templates (free, offline, the default)
   - ollama    : a free AI model running on this computer through Ollama (no account, slide text never leaves the laptop)
   - anthropic : Claude through the Anthropic API (paid, needs an API key; the key is stored encrypted with safeStorage)
   Settings and the key live only here in the main process. */
const { safeStorage } = require('electron');
const AI_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];
const OLLAMA_DEFAULT = { url: 'http://127.0.0.1:11434', model: 'qwen2.5:3b' };
const aiFile = () => path.join(app.getPath('userData'), 'ai.json');
function aiRead() { try { return JSON.parse(fs.readFileSync(aiFile(), 'utf8')); } catch { return {}; } }
function aiLoad() {
  const j = aiRead();
  let key = null;
  if (j.key) { try { key = safeStorage.decryptString(Buffer.from(j.key, 'base64')); } catch { key = null; } }
  // settings saved by the first version (key only) mean Anthropic
  const provider = j.provider || (key ? 'anthropic' : 'template');
  return {
    provider, key,
    model: AI_MODELS.includes(j.model) ? j.model : AI_MODELS[0],
    ollamaUrl: j.ollamaUrl || OLLAMA_DEFAULT.url,
    ollamaModel: j.ollamaModel || OLLAMA_DEFAULT.model
  };
}
function aiSave(opts = {}) {
  const prev = aiRead(), cur = aiLoad();
  const provider = ['template', 'ollama', 'anthropic'].includes(opts.provider) ? opts.provider : (opts.key ? 'anthropic' : cur.provider);
  const next = Object.assign({}, prev, { provider });
  if (provider === 'anthropic') {
    if (!safeStorage.isEncryptionAvailable()) return { error: 'Secure storage is not available on this computer, so the key cannot be saved safely.' };
    const key = String(opts.key || '').trim() || cur.key || '';
    if (!/^sk-ant-[\w-]{10,}$/.test(key)) return { error: 'That does not look like an Anthropic API key (it starts with sk-ant-).' };
    next.key = safeStorage.encryptString(key).toString('base64');
    next.model = AI_MODELS.includes(opts.model) ? opts.model : cur.model;
  }
  if (provider === 'ollama') {
    const url = String(opts.ollamaUrl || cur.ollamaUrl).trim().replace(/\/$/, '');
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) return { error: 'Ollama must run on this computer (http://127.0.0.1:11434).' };
    const model = String(opts.ollamaModel || cur.ollamaModel).trim();
    if (!/^[\w.:\/-]{2,80}$/.test(model)) return { error: 'That model name does not look right (for example qwen2.5:3b).' };
    next.ollamaUrl = url; next.ollamaModel = model;
  }
  fs.writeFileSync(aiFile(), JSON.stringify(next));
  return { ok: true };
}
function aiStatus() {
  const c = aiLoad();
  const enabled = c.provider === 'ollama' || (c.provider === 'anthropic' && !!c.key);
  return { provider: c.provider, enabled, hasKey: !!c.key, model: c.model, models: AI_MODELS, ollamaUrl: c.ollamaUrl, ollamaModel: c.ollamaModel, canStore: safeStorage.isEncryptionAvailable() };
}
/* is Ollama running, and is the model downloaded? */
async function ollamaCheck(url, model) {
  url = String(url || OLLAMA_DEFAULT.url).replace(/\/$/, '');
  try {
    const r = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(4000) });
    const names = ((await r.json()).models || []).map(m => m.name);
    const has = names.some(n => n === model || n === model + ':latest' || n.split(':')[0] === model);
    return { running: true, models: names, hasModel: has };
  } catch { return { running: false, models: [], hasModel: false }; }
}

const AI_SYSTEM = `You write concept-check questions for a university design tutor. Many students are international students and English is an additional language (CALD students). Questions must be easy to read, build understanding of the idea, and make students think about how it works in a real project.

WRITE EXACTLY FIVE QUESTIONS about ONE slide, using ONLY what the slide text says. Do not add outside facts. Follow Bloom's taxonomy in this order:
1 identify & explain: check the student understands the main idea.
2 apply: ask for one real example from the student's OWN project, client or daily life.
3 analyse: ask the student to compare, find a pattern, or say why.
4 evaluate: ask the student to judge their own confidence or the strength of evidence.
5 create: ask the student to write 1 to 2 sentences that use the idea on their real project.

USE THE STUDENTS' OWN QUESTIONS: you are given the questions students asked during this session, most asked first. They show what is confusing. Write the multiple-choice and open questions so they test those exact ideas, in the students' own simple words. Do not copy a student question word for word if it is unclear: make it simpler.

PLAIN LANGUAGE RULES (very important):
- Short sentences. Maximum 18 words in a sentence. Maximum 2 sentences in a question.
- Everyday words. Say "use" not "utilise", "show" not "demonstrate", "idea" not "concept".
- No idioms, no phrasal-verb riddles, no slang, no sport or culture-specific examples.
- One idea per question. No double questions. No negatives like "which is NOT" or "all except".
- If a key design word is needed, keep it and add a short meaning in brackets, for example: insight (a new understanding of why something matters).
- Use the same word for the same thing every time.

REAL USE: questions 2 to 5 must connect to the student's real project, real users, or real evidence (for example "your project", "a real user you spoke to"). Never ask about a made-up story.

QUESTION TYPES: "mc" = multiple choice, exactly 4 short options, exactly one correct, the wrong options are common misunderstandings in the same simple English, all four options are about the same length. "scale" = a 1 to 5 self-rating with short low and high labels. "open" = a short written answer. Use at least one of each type.

HELP STUDENTS START: for every "open" question add "hint": a short sentence starter, for example "In my project, I saw ...". For other types leave "hint" out.

EXAMPLE of the style (do not copy the topic):
{"level":"apply","type":"open","text":"Think about your own project. Where do you see a user need? Give one real example.","hint":"In my project, I saw that users need ..."}

Reply with JSON only, no other words: {"questions":[{"level":"identify|apply|analyse|evaluate|create","type":"mc|scale|open","text":"...","options":[{"t":"...","ok":true}],"lo":"...","hi":"...","hint":"..."}]}
Include "options" only for mc, "lo" and "hi" only for scale, "hint" only for open.`;
const QUESTIONS_SCHEMA = {
  type: 'object', required: ['questions'],
  properties: { questions: { type: 'array', minItems: 5, maxItems: 5, items: {
    type: 'object', required: ['level', 'type', 'text'],
    properties: {
      level: { type: 'string', enum: ['identify', 'apply', 'analyse', 'evaluate', 'create'] },
      type: { type: 'string', enum: ['mc', 'scale', 'open'] },
      text: { type: 'string' },
      options: { type: 'array', items: { type: 'object', required: ['t', 'ok'], properties: { t: { type: 'string' }, ok: { type: 'boolean' } } } },
      lo: { type: 'string' }, hi: { type: 'string' }, hint: { type: 'string' }
    } } } }
};
const pickJSON = text => { const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

async function aiGenerate(p = {}) {
  const cfg = aiLoad();
  const asked = Array.isArray(p.asked) && p.asked.length ? `\nQuestions students asked in this session (most asked first):\n` + p.asked.map(a => `- ${String(a.text).slice(0, 200)} (${a.count} students)`).join('\n') : '';
  const user = `Learning outcome (${p.lo || ''}): ${p.out || ''}\nSlide title: ${p.title || ''}\nSlide text:\n"""\n${String(p.text || '').slice(0, 6000)}\n"""${asked}`;

  if (cfg.provider === 'ollama') {
    const url = (process.env.STUDIO_OLLAMA_URL || cfg.ollamaUrl).replace(/\/$/, '');
    try {
      const res = await fetch(url + '/api/chat', {
        method: 'POST', signal: AbortSignal.timeout(240000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.ollamaModel, stream: false, format: QUESTIONS_SCHEMA, options: { temperature: 0.4 },
          messages: [{ role: 'system', content: AI_SYSTEM }, { role: 'user', content: user }] })
      });
      if (res.status === 404) return { error: `The model "${cfg.ollamaModel}" is not downloaded yet. In a terminal run: ollama pull ${cfg.ollamaModel}` };
      if (!res.ok) return { error: `Ollama returned an error (${res.status}).` };
      const body = await res.json();
      const j = pickJSON(body.message && body.message.content);
      if (!j) return { error: 'The local model did not reply in the expected format.' };
      return { questions: j.questions, model: cfg.ollamaModel, provider: 'ollama' };
    } catch (e) {
      return { error: e.name === 'TimeoutError' ? 'The local model took too long. Try a smaller model.' : 'Ollama is not running. Start the Ollama app, then try again.' };
    }
  }

  if (cfg.provider !== 'anthropic' || !cfg.key) return { error: 'AI is off. Choose a question writer in the ⋯ menu → AI question writer.' };
  const base = (process.env.STUDIO_AI_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  try {
    const res = await fetch(base + '/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1800, system: AI_SYSTEM, messages: [{ role: 'user', content: user }] })
    });
    if (!res.ok) {
      if (res.status === 401) return { error: 'The API key was rejected. Check it in the AI question writer settings.' };
      if (res.status === 429) return { error: 'Too many requests right now. Try again in a minute.' };
      if (res.status === 402 || res.status === 403) return { error: 'The account cannot use the API (billing or permissions).' };
      return { error: `The AI service returned an error (${res.status}).` };
    }
    const body = await res.json();
    const j = pickJSON((body.content || []).map(c => c.text || '').join(''));
    if (!j) return { error: 'The AI reply was not in the expected format.' };
    return { questions: j.questions, model: cfg.model, provider: 'anthropic' };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'The AI took too long to answer.' : 'Could not reach the AI service. Check the internet connection.' };
  }
}
ipcMain.handle('unit:fetch', async (e, raw) => {
  let u; try { u = new URL(String(raw).trim()); } catch { return { error: 'That is not a web address.' }; }
  if (u.protocol !== 'https:' || !/(^|.)sydney.edu.au$/.test(u.hostname) || !u.pathname.startsWith('/units/')) return { error: 'Paste a unit outline link that starts with https://www.sydney.edu.au/units/' };
  try {
    const r = await fetch(u.href, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0 StudioBridge' } });
    if (!r.ok) return { error: 'The page returned an error (' + r.status + ').' };
    return { html: await r.text(), url: u.href };
  } catch { return { error: 'Could not reach the page. Check the internet connection.' }; }
});
/* a short structured answer from whichever AI is switched on (used for the class insight) */
async function aiAsk(system, user, schema) {
  const cfg = aiLoad();
  try {
    if (cfg.provider === 'ollama') {
      const url = (process.env.STUDIO_OLLAMA_URL || cfg.ollamaUrl).replace(/[/]$/, '');
      const res = await fetch(url + '/api/chat', { method: 'POST', signal: AbortSignal.timeout(180000), headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.ollamaModel, stream: false, format: schema, options: { temperature: 0.3 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
      if (res.status === 404) return { error: `The model "${cfg.ollamaModel}" is not downloaded yet.` };
      if (!res.ok) return { error: `Ollama returned an error (${res.status}).` };
      const j = pickJSON(((await res.json()).message || {}).content);
      return j ? { json: j } : { error: 'The local model did not reply in the expected format.' };
    }
    if (cfg.provider === 'anthropic' && cfg.key) {
      const base = (process.env.STUDIO_AI_URL || 'https://api.anthropic.com').replace(/[/]$/, '');
      const res = await fetch(base + '/v1/messages', { method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: cfg.model, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }) });
      if (!res.ok) return { error: res.status === 401 ? 'The API key was rejected.' : `The AI service returned an error (${res.status}).` };
      const j = pickJSON(((await res.json()).content || []).map(c => c.text || '').join(''));
      return j ? { json: j } : { error: 'The AI reply was not in the expected format.' };
    }
    return { off: true, error: 'AI is turned off.' };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'The AI took too long to answer.' : cfg.provider === 'ollama' ? 'Ollama is not running. Start the Ollama app, then try again.' : 'Could not reach the AI service.' };
  }
}
const INSIGHT_SYSTEM = `You help a university design tutor read class results for ONE learning outcome. Use plain, simple English and short sentences. Use only the data you are given. Never name individual students.
Reply with JSON only: {"summary":"...","stuck":"...","why":"..."}
- summary: exactly 2 short sentences about how the whole class is doing on this outcome. Use the numbers. Say how many students are stuck at the weakest level.
- stuck: ONE specific insight about what students got wrong, written as one plain sentence of at most 12 words that starts with "Students". Read the answers that were wrong or weak and name the exact thing they could not do, in terms of this learning outcome. Example: "Students could not narrow their design plan to fit the brief." Do not copy the learning outcome and do not use general words like "apply" or "understand".
- why: leave this as an empty string.`;
const INSIGHT_SCHEMA = { type: 'object', required: ['summary', 'stuck', 'why'], properties: { summary: { type: 'string' }, stuck: { type: 'string' }, why: { type: 'string' } } };
ipcMain.handle('ai:insight', async (e, p = {}) => {
  const lv = (p.levels || []).map(l => `- ${l.label}: ${l.n} of ${p.total} students (${l.src})`).join(String.fromCharCode(10));
  const notes = (p.notes || []).slice(0, 8).map(n => '- ' + String(n).slice(0, 140)).join(String.fromCharCode(10));
  const takes = (p.takes || []).slice(0, 4).map(n => '- "' + String(n).slice(0, 160) + '"').join(String.fromCharCode(10));
  const user = `Learning outcome (${p.lo}): ${p.out}
Week ${p.week}. Class size: ${p.total}.
Weakest level: ${p.weakest} (${p.stuckN} of ${p.total} students are stuck here).
How many students got it right at each level:
${lv}
What the tutor noticed:
${notes}
Weak answers (what went wrong):
${(p.gaps || []).slice(0, 10).map(n => '- ' + String(n).slice(0, 160)).join(String.fromCharCode(10))}
Strong answers:
${(p.goods || []).slice(0, 4).map(n => '- ' + String(n).slice(0, 160)).join(String.fromCharCode(10))}
What some students wrote:
${takes}`;
  const r = await aiAsk(INSIGHT_SYSTEM, user, INSIGHT_SCHEMA);
  if (!r.json) return r;
  const clip = (t, n) => String(t || '').trim().slice(0, n);
  return { summary: clip(r.json.summary, 360), stuck: clip(r.json.stuck, 90), why: clip(r.json.why, 220) };
});
ipcMain.handle('ai:status', () => aiStatus());
ipcMain.handle('ai:save', (e, opts) => aiSave(opts));
ipcMain.handle('ai:clear', () => { try { fs.unlinkSync(aiFile()); } catch { /* nothing saved */ } return { ok: true }; });
ipcMain.handle('ai:check', (e, o = {}) => ollamaCheck(o.url, o.model));
ipcMain.handle('ai:generate', (e, payload) => aiGenerate(payload));

// self-test runs use a throwaway data folder so they never touch the real saved settings
if (process.env.STUDIO_TEST_OUT) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bridge-test-')));
app.setAppUserModelId('edu.studio.bridge');
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
