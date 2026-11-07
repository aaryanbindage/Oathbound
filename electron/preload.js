'use strict';
// The only desktop features the game can reach. It gets no direct access to Node or the file system.
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  quit: () => ipcRenderer.send('app:quit'),
  toggleFullscreen: () => ipcRenderer.send('window:toggleFullscreen'),
  fatal: msg => ipcRenderer.send('game:fatal', String(msg)),
  saves: {
    readAll: () => ipcRenderer.sendSync('saves:readAll'),
    write: (id, rec) => ipcRenderer.sendSync('saves:write', id, rec),
    remove: id => ipcRenderer.sendSync('saves:remove', id),
    openFolder: () => ipcRenderer.send('saves:openFolder')
  }
};
if (process.argv.includes('--oathbound-test')) api.shot = name => ipcRenderer.invoke('test:shot', name);

contextBridge.exposeInMainWorld('desktop', api);
