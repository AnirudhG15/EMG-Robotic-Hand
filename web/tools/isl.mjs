import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
for (const part of ['Index3','thumb5']) {
  const p=await b.newPage({viewport:{width:1500,height:520}});
  p.on('pageerror',e=>console.log('ERR',part,e.message));
  await p.goto(`http://localhost:5199/tools/islands.html?part=${part}`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__ready===true,{timeout:60000}).catch(()=>console.log('timeout',part));
  await p.screenshot({path:`/tmp/shots2/isl-${part}.png`});
  await p.close();
}
await b.close(); console.log('ok');
