import { createCreatureCompute } from '/creature-compute.mjs';
import { advanceMouse } from '/circuit-mouse.mjs';
window.check=(async()=>{
 let gpu;
 try{
  gpu=await createCreatureCompute(3);
  const tests=[];
  for(const aquarium of [false,true]){
   const creatures=[0,1,2].map(i=>({x:.2+i*.1,y:.3,phase:i*2.4,speed:.04,energy:.5,nibble:i===2?.6:0,heading:0}));
   const expected=structuredClone(creatures),food=[{x:.7,y:.6}],dt=.016,time=1;
   expected.forEach(c=>{const dx=.7-c.x,dy=.6-c.y;if(aquarium){const d=Math.hypot(dx,dy);c.x+=dx/d*c.speed*dt;c.y+=dy/d*c.speed*dt;}else advanceMouse(c,dx,dy,dt,time);});
   await gpu.step(creatures,food,dt,time,aquarium);
   creatures.forEach((c,i)=>{if(Math.abs(c.x-expected[i].x)>1e-6||Math.abs(c.y-expected[i].y)>1e-6||c.target!==0)throw Error('GPU / CPU behavior mismatch');});
   for(let i=0;i<60;i++)await gpu.step(creatures,[],dt,time+i*dt,aquarium);
   if(!creatures.every(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.target===-1))throw Error('Invalid empty-food simulation');
   tests.push(aquarium?'Aquarium targeting / movement / empty food':'Mouse scanning / nibbling / movement / empty food');
  }
  gpu.destroy();let rejected=false;try{await gpu.step([],[],.016,1,false);}catch{rejected=true;}
  if(!rejected)throw Error('Destroyed GPU did not reject');
  return {ok:true,backend:gpu.label,tests,deviceLoss:'rejects for host fallback'};
 }catch(error){return {ok:false,error:String(error)};}finally{gpu?.destroy();}
})();
