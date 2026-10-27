const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('shell', {
  platform: process.platform,
  control: action => ipcRenderer.send('win', action),
  pathFor: file => webUtils.getPathForFile(file),
  pptxToPdf: p => ipcRenderer.invoke('pptx2pdf', p),
  // AI question writer: the key lives only in the main process; the page never sees it
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    save: opts => ipcRenderer.invoke('ai:save', opts),
    clear: () => ipcRenderer.invoke('ai:clear'),
    check: o => ipcRenderer.invoke('ai:check', o),
    generate: payload => ipcRenderer.invoke('ai:generate', payload)
  }
});
