const { contextBridge } = require('electron');

// Preload is intentionally minimal. Expose a safe API surface here if needed.
contextBridge.exposeInMainWorld('electronAPI', {});
