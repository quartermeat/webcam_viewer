const {app,BrowserWindow}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{
 const name=req.url.slice(1);
 if(name.startsWith('api/')){res.writeHead(503);res.end('{}');return;}
 if(!['terrarium.html','terrarium.mjs','creature-compute-gl.mjs','creature-compute.vert','creature-compute.mjs','creature-compute.wgsl','circuit-mouse.mjs','scripts/compute-check.mjs'].includes(name)){
  res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/scripts/compute-check.mjs"></script>');return;
 }
 res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript':name.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(path.join(root,name)));
});
let window;const timeout=setTimeout(()=>{console.error('Compute check timed out');app.exit(1);},20000);
app.whenReady().then(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 window=new BrowserWindow({show:false,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await window.loadURL(`http://127.0.0.1:${server.address().port}/`);
 const result=await window.webContents.executeJavaScript('window.check');
 if(result.ok){
  const errors=[];
  window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await window.loadURL(`http://127.0.0.1:${server.address().port}/terrarium.html`);
  await new Promise(resolve=>setTimeout(resolve,400));
  const scene=await window.webContents.executeJavaScript("({tooltip:!!document.getElementById('tooltip'), controls:document.querySelectorAll('button,header,nav').length})");
  const transparency=await window.webContents.executeJavaScript(`(async()=>{
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
   const check=()=>ctx.getImageData(0,0,1,1).data[3]===0&&getComputedStyle(document.body).backgroundColor==='rgba(0, 0, 0, 0)';
   const water=check();
   ctx.fillStyle='red';ctx.fillRect(0,0,1,1);
   await new Promise(resolve=>setTimeout(resolve,150));
   return {water,land:check(),oldPixelsCleared:ctx.getImageData(0,0,1,1).data[3]===0};
  })()`);
  result.transparency=transparency;
  result.ok=result.ok&&Object.values(transparency).every(Boolean);
  result.diagnostics={scene,errors};
  result.scene=scene.tooltip&&scene.controls===0;
  result.ok=result.ok&&result.scene;
 }
 console.log(JSON.stringify(result,null,2));clearTimeout(timeout);server.close();app.exit(result.ok?0:1);
}).catch(error=>{console.error(error);server.close();app.exit(1);});
