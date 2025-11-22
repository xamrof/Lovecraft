const { contextBridge } = require('electron');

// Expose a minimal API for the renderer to get the path to bundled assets
// Avoid requiring Node core modules here to prevent preload bundling errors.
contextBridge.exposeInMainWorld('electronAPI', {
	getVideoPath: () => {
		try {
			// __dirname will point to the preload script directory inside the app bundle.
			return `${__dirname.replace(/\\/g, '/').replace(/\/\/$/, '')}/Video.mp4`;
		} catch (e) { return './Video.mp4'; }
	}
});
