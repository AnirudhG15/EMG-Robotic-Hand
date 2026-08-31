import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1500,height:900},deviceScaleFactor:2});
p.on('pageerror',e=>console.log('ERR',e.message));
p.on('console',m=>{if(m.type()==='error')console.log('C',m.text())});
await p.goto('http://localhost:5199/tools/digit.html',{waitUntil:'load'});
await p.waitForFunction(()=>window.__ready===true,{timeout:60000}).catch(()=>console.log('timeout'));
await p.screenshot({path:'/tmp/shots2/digit.png'});
await b.close(); console.log('ok');
