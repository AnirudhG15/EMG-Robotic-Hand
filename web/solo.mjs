import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CONNECTION_RESET'))errs.push(m.text());});
await p.goto('http://localhost:4180/',{waitUntil:'load'});
await p.waitForTimeout(9000);
const n = await p.evaluate(()=>{
  // count real meshes actually in the hero scene
  return document.querySelectorAll('canvas').length;
});
await p.screenshot({path:'/tmp/shots2/solo-real.png',animations:'disabled',timeout:40000});
console.log('canvases:',n);
console.log(errs.length?'ERRORS:\n'+errs.join('\n'):'no errors');
await b.close();
