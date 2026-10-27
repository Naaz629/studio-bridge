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
app.setAppUserModelId('edu.studio.bridge');
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
