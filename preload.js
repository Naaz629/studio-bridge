const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('shell', {
  platform: process.platform,
  control: action => ipcRenderer.send('win', action),
  pathFor: file => webUtils.getPathForFile(file),
  pptxToPdf: p => ipcRenderer.invoke('pptx2pdf', p)
});
