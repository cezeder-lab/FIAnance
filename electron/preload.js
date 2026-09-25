const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fianance', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (name, data) => ipcRenderer.invoke('data:save', name, data),
  saveSync: (name, data) => ipcRenderer.sendSync('data:save-sync', name, data),
  backup: () => ipcRenderer.invoke('data:backup'),
  openDataFolder: () => ipcRenderer.invoke('data:open-folder'),
  fetchQuote: (symbol) => ipcRenderer.invoke('quote:fetch', symbol),
});
