const { contextBridge, ipcRenderer } = require('electron');
function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld('desktop', {
  call: (action, value) => ipcRenderer.invoke('desktop', action, value),
  onStatus: callback => subscribe('status', callback),
  onState: callback => subscribe('state', callback)
});

