import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jkm08/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true,channel:'msedge'});
const issues=[];
for(const [file,width,height,scale] of [['hero-preview',680,560,2],['landing-preview',2598,1276,1]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale});
  page.on('pageerror',e=>issues.push(e.message));
  await page.goto(pathToFileURL(path.join(root,file+'.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(root,file+'.png')});
  if(file==='hero-preview'){
    const audit=await page.evaluate(()=>({
      fontLoaded:document.fonts.check('14px "Noto Sans KR"'),
      cards:document.querySelectorAll('[id^="Post-Card-"]').length,
      pins:document.querySelectorAll('[id^="Pin-"]').length,
      photos:document.querySelectorAll('image').length,
      texts:[...document.querySelectorAll('text')].map(t=>({text:t.textContent,bounds:{x:t.getBBox().x,y:t.getBBox().y,width:t.getBBox().width,height:t.getBBox().height}})),
      cardBounds:[...document.querySelectorAll('[id^="Post-Card-"]')].map(n=>({id:n.id,bounds:{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}}))
    }));
    fs.writeFileSync(path.join(root,'visual-audit.json'),JSON.stringify(audit,null,2));
    console.log(JSON.stringify({fontLoaded:audit.fontLoaded,cards:audit.cards,pins:audit.pins,photos:audit.photos,cardBounds:audit.cardBounds}));
  }
  await page.close();
}
await browser.close();
if(issues.length)throw new Error(issues.join('\n'));
console.log('Rendered hero and reference landing preview without browser errors.');
