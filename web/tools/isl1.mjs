import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
for (const [part,i,name] of [['Index3','0','i0'],['Index3','2','i2'],['Index3','4','i4'],['thumb5','0','t0']]) {
  const p=await b.newPage({viewport:{width:1560,height:280}});
  p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto(`http://localhost:5199/tools/islands.html?part=${part}&i=${i}`,{waitUntil:'load'});
  await p.waitForFunction(()=>window.__ready===true,{timeout:60000}).catch(()=>console.log('timeout',part,i));
  await p.screenshot({path:`/tmp/shots2/v-${name}.png`});
  await p.close();
}
await b.close(); console.log('ok');
