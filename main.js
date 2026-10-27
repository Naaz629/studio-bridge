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
      if (process.env.STUDIO_TEST_AI) { process.env.STUDIO_AI_URL = process.env.STUDIO_TEST_AI; aiSave({ key: 'sk-ant-test-0123456789abcdef', model: 'claude-haiku-5-5' }); }
      try {
        const b64 = p => (p && fs.existsSync(p)) ? fs.readFileSync(p).toString('base64') : null;
        const code = `(async () => {
          const mk = (b, n) => new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], n);
          const out = { origin: location.protocol };
          const pdf = ${JSON.stringify(b64(process.env.STUDIO_TEST_PDF))}, pptx = ${JSON.stringify(b64(process.env.STUDIO_TEST_PPTX))};
          if (pdf) { const t0 = performance.now(); const s = await readSlideFile(mk(pdf, 'test.pdf')); out.pdf = { pages: s.length, withText: s.filter(x => x.text).length, images: s.filter(x => (x.url||'').startsWith('data:image')).length, titles: s.slice(0, 3).map(x => x.title), ms: Math.round(performance.now() - t0) }; }
          if (pptx) { const s = await readSlideFile(mk(pptx, 'test.pptx')); out.pptx = { slides: s.length, titles: s.map(x => x.title), notes: s[0].text.includes('Notes') }; }
          if (${JSON.stringify(!!process.env.STUDIO_TEST_AI)} && pptx) {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const dt = new DataTransfer(); dt.items.add(mk(pptx, 'deck.pptx'));
            const inp = document.getElementById('slideFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
            await sleep(1500); insertAct(1, 'Concept Development'); await sleep(200);
            const early = flowOf(S())[S().pos].cd.pending;
            await sleep(2500);
            const cd = flowOf(S())[S().pos].cd;
            out.ai = { status: await window.shell.ai.status(), pendingWhileWaiting: early, by: cd.by, pendingNow: cd.pending, error: cd.aiError || null, footer: (document.querySelector('.cdfoot') || {}).textContent, qs: cd.qs.map(q => q.type + ' | ' + q.text + (q.options ? ' | ' + q.options.map(o => (o.ok ? '*' : '') + o.t).join(' ; ') : '')) };
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
/* ---------- AI question writer (Anthropic Messages API) ----------
   The API key is stored encrypted with the operating system (safeStorage) and is only ever used here in the main process. */
const { safeStorage } = require('electron');
const AI_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];
const aiFile = () => path.join(app.getPath('userData'), 'ai.json');
function aiLoad() {
  try {
    const j = JSON.parse(fs.readFileSync(aiFile(), 'utf8'));
    return { key: safeStorage.decryptString(Buffer.from(j.key, 'base64')), model: AI_MODELS.includes(j.model) ? j.model : AI_MODELS[0] };
  } catch { return null; }
}
function aiSave({ key, model } = {}) {
  if (!safeStorage.isEncryptionAvailable()) return { error: 'Secure storage is not available on this computer, so the key cannot be saved safely.' };
  const prev = aiLoad();
  key = String(key || '').trim() || (prev && prev.key) || '';
  if (!/^sk-ant-[\w-]{10,}$/.test(key)) return { error: 'That does not look like an Anthropic API key (it starts with sk-ant-).' };
  fs.writeFileSync(aiFile(), JSON.stringify({ key: safeStorage.encryptString(key).toString('base64'), model: AI_MODELS.includes(model) ? model : AI_MODELS[0] }));
  return { ok: true };
}
const AI_SYSTEM = `You help a university design tutor check students' understanding during a live studio session.
Write exactly five concept-check questions about ONE slide, using ONLY what the slide text says. Do not add outside facts.
Each question targets a Bloom's taxonomy level, in this order: 1 identify & explain, 2 apply, 3 analyse, 4 evaluate, 5 create.
Question types: "mc" = multiple choice with exactly 4 options and exactly one correct (wrong options are plausible misconceptions, not silly); "scale" = a 1-5 self-rating with short low/high labels; "open" = a short written answer.
Use at least one of each type. Tie questions 4 and 5 to the learning outcome. Plain, direct language. Questions under 30 words, options under 18 words.
Reply with JSON only, no commentary: {"questions":[{"level":"identify|apply|analyse|evaluate|create","type":"mc|scale|open","text":"...","options":[{"t":"...","ok":true}],"lo":"...","hi":"..."}]}
Include "options" only for mc, and "lo"/"hi" only for scale.`;
async function aiGenerate(p = {}) {
  const cfg = aiLoad();
  if (!cfg) return { error: 'No API key saved. Add one in the ⋯ menu → AI question writer.' };
  const base = (process.env.STUDIO_AI_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const user = `Learning outcome (${p.lo || ''}): ${p.out || ''}\nSlide title: ${p.title || ''}\nSlide text:\n"""\n${String(p.text || '').slice(0, 6000)}\n"""`;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch(base + '/v1/messages', {
      method: 'POST', signal: ctl.signal,
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
    const text = (body.content || []).map(c => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { error: 'The AI reply was not in the expected format.' };
    return { questions: JSON.parse(m[0]).questions, model: cfg.model };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'The AI took too long to answer.' : 'Could not reach the AI service. Check the internet connection.' };
  } finally { clearTimeout(timer); }
}
ipcMain.handle('ai:status', () => { const c = aiLoad(); return { hasKey: !!c, model: c ? c.model : AI_MODELS[0], models: AI_MODELS, canStore: safeStorage.isEncryptionAvailable() }; });
ipcMain.handle('ai:save', (e, opts) => aiSave(opts));
ipcMain.handle('ai:clear', () => { try { fs.unlinkSync(aiFile()); } catch { /* nothing saved */ } return { ok: true }; });
ipcMain.handle('ai:generate', (e, payload) => aiGenerate(payload));

// self-test runs use a throwaway data folder so they never touch the real saved settings
if (process.env.STUDIO_TEST_OUT) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'studio-bridge-test-')));
app.setAppUserModelId('edu.studio.bridge');
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
