import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5199/',{waitUntil:'load'});
await p.waitForTimeout(11000);
await p.screenshot({path:'/tmp/shots2/h2.png',animations:'disabled',timeout:60000});
console.log(errs.length?errs.join('\n'):'no errors');
await b.close();
