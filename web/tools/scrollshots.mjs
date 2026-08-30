import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5199/',{waitUntil:'load'});
await p.waitForTimeout(11000);
const steps=[0,0.18,0.4,0.62,0.85,1.0];
for (let i=0;i<steps.length;i++){
  await p.evaluate((f)=>{
    const t=document.querySelector('#build');
    const top=t.offsetTop, h=t.offsetHeight-window.innerHeight;
    window.scrollTo({top: top + h*f, behavior:'instant'});
  }, steps[i]);
  await p.waitForTimeout(3500);
  await p.screenshot({path:`/tmp/shots2/s${i}.png`,animations:'disabled',timeout:60000});
}
console.log(errs.length?errs.join('\n'):'no errors');
await b.close();
