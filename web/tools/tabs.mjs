import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(() => { window.__forceQuality = true; });
await p.goto('http://localhost:5199/',{waitUntil:'load'});
await p.waitForTimeout(10000);
for (const t of ['chain','parts','decisions','bom']) {
  await p.evaluate((x)=>{document.querySelector(`#tab-${x}`).click();
    document.querySelector('.tabs').scrollIntoView({behavior:'instant',block:'start'});}, t);
  await p.waitForTimeout(2200);
  await p.screenshot({path:`/tmp/shots2/t-${t}.png`,animations:'disabled'});
}
await p.evaluate(()=>document.querySelector('.placeholder-note').scrollIntoView({behavior:'instant',block:'center'}));
await p.waitForTimeout(1200);
await p.screenshot({path:'/tmp/shots2/t-note.png',animations:'disabled'});
console.log(errs.length?errs.join('\n'):'no errors');
await b.close();
