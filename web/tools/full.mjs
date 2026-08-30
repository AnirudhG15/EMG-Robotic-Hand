import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5199/',{waitUntil:'load'});
await p.waitForTimeout(10000);
for (const t of ['chain','decisions','bom']) {
  await p.evaluate((x)=>document.querySelector(`#tab-${x}`).click(), t);
  await p.waitForTimeout(2000);
  await p.evaluate(()=>document.querySelector('.tabs').scrollIntoView({behavior:'instant',block:'start'}));
  await p.waitForTimeout(900);
  await p.evaluate(()=>window.scrollBy(0,760));
  await p.waitForTimeout(900);
  await p.screenshot({path:`/tmp/shots2/f-${t}.png`,animations:'disabled'});
}
console.log(errs.length?errs.join('\n'):'no errors');
await b.close();
