import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:900,height:1100}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:5199/',{waitUntil:'load'});
await p.waitForTimeout(11000);
// dead-front elevation, framed on the hand
const m = await p.evaluate(()=>{
  const e=window.__explorer; if(!e) return null;
  Object.assign(e.state,{targetYaw:0,targetPitch:0,targetDist:300,targetLift:60,autoSpin:false});
  return true;
});
await p.waitForTimeout(6000);
await p.screenshot({path:'/tmp/shots2/elev.png',animations:'disabled',timeout:60000});
// report world-space landmarks
const info = await p.evaluate(()=>{
  const e=window.__explorer; const out={};
  for (const it of e.items) {
    const b=new (window.THREE_Box3||Object)();
  }
  return null;
});
await b.close(); console.log('ok');
