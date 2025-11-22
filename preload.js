const { contextBridge } = require('electron');
const path = require('path');

// Expose a minimal API for the renderer to get the path to bundled assets
contextBridge.exposeInMainWorld('electronAPI', {
	getVideoPath: () => {
		try {
			return path.join(__dirname, 'Video.mp4');
		} catch (e) { return './Video.mp4'; }
	}
});
