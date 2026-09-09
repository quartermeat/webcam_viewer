if (process.argv.includes('--compute')) { require('./compute-check.cjs'); } else {
const { app, BrowserWindow } = require('electron');
let window;
const timeout = setTimeout(() => { console.error('GPU diagnostic timed out'); app.exit(1); }, 15000);
app.whenReady().then(async () => {
 window = new BrowserWindow({ show: false, transparent: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
 await window.loadURL('data:text/html,<canvas id="c"></canvas>');
 await window.webContents.executeJavaScript("document.getElementById('c').getContext('2d').fillRect(0,0,10,10)");
 const info = await app.getGPUInfo('complete');
 console.log(JSON.stringify({ features: app.getGPUFeatureStatus(), devices: info.gpuDevice, renderer: info.auxAttributes?.glRenderer }, null, 2));
 clearTimeout(timeout); app.quit();
}).catch(error => { console.error(error); app.exit(1); });

}
