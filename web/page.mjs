import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CONNECTION_RESET'))errs.push(m.text());});
await p.goto('http://localhost:4173/',{waitUntil:'load'});
await p.waitForTimeout(9000);
for (const [n,sel] of [['p-chain','#tab-chain'],['p-parts','#tab-parts'],['p-dec','#tab-decisions'],['p-bom','#tab-bom']]) {
  await p.click(sel); await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('#tablist').scrollIntoView({block:'start'}));
  await p.waitForTimeout(2000);
  await p.screenshot({path:`/tmp/shots2/${n}.png`,animations:'disabled',timeout:60000});
}
console.log(errs.length?'ERRORS:\n'+errs.join('\n'):'no errors');
await b.close();
