import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const shots = [
  ['close-fingers', {targetDist:330,targetLift:80,targetYaw:-0.25,targetPitch:0.0}],
  ['close-side',    {targetDist:340,targetLift:70,targetYaw:-1.15,targetPitch:0.05}],
  ['close-thumb',   {targetDist:300,targetLift:35,targetYaw:0.55,targetPitch:0.10}],
];
for (const [name, st] of shots) {
  const p=await b.newPage({viewport:{width:1200,height:900}});
  p.on('pageerror',e=>console.log('ERR',e.message));
  await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:5199/',{waitUntil:'load'});
  await p.waitForTimeout(11000);
  await p.evaluate((st)=>{
    const e=window.__explorer; if(!e) return;
    Object.assign(e.state, st); e.state.autoSpin=false;
  }, st);
  await p.waitForTimeout(5000);
  await p.screenshot({path:`/tmp/shots2/${name}.png`,animations:'disabled',timeout:60000});
  await p.close();
}
await b.close(); console.log('done');
