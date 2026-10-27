const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('shell', {
  platform: process.platform,
  control: action => ipcRenderer.send('win', action)
});
