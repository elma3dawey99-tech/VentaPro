// Tiny, safe bridge: pages can only ask the shell to minimise, close or toggle full screen.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vpShell', { cmd: (c) => ipcRenderer.send('vp-cmd', String(c)) });
