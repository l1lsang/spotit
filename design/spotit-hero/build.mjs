import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('C:/Users/jkm08/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(root, 'design-spec.json'), 'utf8'));
const P = spec.palette;
const escape = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const ICONS = {
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>'
};
const images = {};
for (const n of ['walk','cafe','sunset']) {
  await sharp(path.join(root,`assets/${n}.png`)).resize(1000,1000).jpeg({quality:91}).toFile(path.join(root,`assets/${n}.jpg`));
  images[n] = fs.readFileSync(path.join(root,`assets/${n}.jpg`)).toString('base64');
}
fs.writeFileSync(path.join(root,'figma-plugin/assets.js'),`const PHOTO_BASE64 = ${JSON.stringify(images)};\n`);
const svgIcon = (name,x,y,size,color) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
const text = (str,x,y,size,color,weight=400,extra='') => `<text x="${x}" y="${y}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${escape(str)}</text>`;
function card(c) {
  const large=c.variant==='Large', pad=c.padding, photoW=c.width-pad*2, bodyY=pad+c.photoHeight+c.gap;
  const titleLine=large?22:20, captionLine=large?20:18, gap=large?6:4;
  const metaY=bodyY+titleLine+captionLine+gap*2;
  const actionW=c.actionCount?35:15;
  return `<g id="Post-Card-${c.id}" transform="translate(${c.x} ${c.y}) rotate(${c.rotation})">
    <rect width="${c.width}" height="${c.height}" rx="${large?22:20}" fill="${P.paper}" stroke="${P.line}" stroke-width="0.6" filter="url(#cardShadow)"/>
    <defs><clipPath id="photo-${c.id}"><rect x="${pad}" y="${pad}" width="${photoW}" height="${c.photoHeight}" rx="${large?15:13}"/></clipPath></defs>
    <image id="Photo-${c.id}" x="${pad}" y="${pad}" width="${photoW}" height="${c.photoHeight}" href="data:image/jpeg;base64,${images[c.image]}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo-${c.id})"/>
    ${text(c.title,pad+4,bodyY+titleLine*.78,large?15.5:14,P.ink,600)}
    ${text(c.caption,pad+4,bodyY+titleLine+gap+captionLine*.78,large?11.5:10.5,P.muted)}
    ${svgIcon('pin',pad+4,metaY+4,11,P[c.accent])}
    ${text(c.location+' · '+c.time,pad+19,metaY+13.3,large?10.2:9.1,P.muted)}
    ${svgIcon(c.action,c.width-pad-actionW-3,metaY+3,14,P[c.accent])}
    ${c.actionCount?text(c.actionCount,c.width-pad-17,metaY+13.2,9.5,P.muted):''}
  </g>`;
}
const map = `<g id="Map-Background">
  <g id="Roads" fill="none" stroke="${P.road}" stroke-linecap="round" stroke-linejoin="round" opacity=".29">${spec.roads.map(r=>`<path id="${r.name.replaceAll(' ','-')}" d="${r.d}" stroke-width="${r.width}" ${r.dash?`stroke-dasharray="${r.dash.join(' ')}"`:''}/>`).join('')}</g>
  <g id="Map-Dots" fill="${P.road}" opacity=".35">${spec.dots.map(d=>`<circle cx="${d.x}" cy="${d.y}" r="${d.r}"/>`).join('')}</g>
  <path id="Route" d="${spec.route.d}" fill="none" stroke="${P.teal}" stroke-width="1.4" opacity=".38" stroke-linecap="round"/>
  <circle cx="87" cy="445" r="3.1" fill="${P.teal}" opacity=".5"/><circle cx="615" cy="480" r="3.1" fill="${P.teal}" opacity=".5"/>
  <g id="Connections" fill="none" stroke-width="1.1" opacity=".48">${spec.connections.map(c=>`<path d="${c.d}" stroke="${P[c.color]}"/>`).join('')}</g>
</g>`;
const pins = spec.pins.map(p=>`<g id="Pin-${p.id}" transform="translate(${p.x} ${p.y})"><circle cx="${p.size/2}" cy="${p.size/2}" r="${p.size/2}" fill="${P.paper}" filter="url(#pinShadow)"/><circle cx="${p.size/2}" cy="${p.size/2}" r="${p.size/2-4}" fill="${P[p.color]}"/>${svgIcon('pin',p.size/2-10,p.size/2-11,20,P.paper)}</g>`).join('');
const notes=spec.notes.map(n=>text(n.text,n.x,n.y+n.size,n.size,P[n.color],400,`letter-spacing="${n.tracking}"`)).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="680" height="560" viewBox="0 0 680 560"><title>Spotit — 장소에 남긴 순간</title><defs><filter id="cardShadow" x="-25%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="#293A31" flood-opacity=".07"/><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#293A31" flood-opacity=".025"/></filter><filter id="pinShadow" x="-40%" y="-40%" width="190%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#293A31" flood-opacity=".07"/></filter></defs><rect id="Background" width="680" height="560" fill="${P.bg}"/>${map}${spec.cards.map(card).join('')}${pins}<g id="Journal-Notes">${notes}</g></svg>`;
fs.writeFileSync(path.join(root,'hero-visual.svg'),svg);
const fontCSS=`@font-face{font-family:'Noto Sans KR';src:url('assets/NotoSansKR.ttf') format('truetype');font-weight:100 900;font-display:block}*{box-sizing:border-box}body{margin:0;background:${P.bg};font-family:'Noto Sans KR',sans-serif}`;
fs.writeFileSync(path.join(root,'hero-preview.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Spotit Hero Visual</title><style>${fontCSS}body{width:680px;height:560px}svg{display:block}</style>${svg}</html>`);
const sample=await sharp(path.join(root,'assets/landing-reference.png')).raw().toBuffer({resolveWithObject:true});
const [r,g,b]=sample.data.subarray(0,3);const refBg=`rgb(${r},${g},${b})`;
fs.writeFileSync(path.join(root,'landing-preview.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><title>Spotit — 오른쪽 Hero 교체 미리보기</title><style>${fontCSS}body{width:2598px;height:1276px;position:relative;overflow:hidden;background:${refBg}}.reference{position:absolute;width:2598px;height:1276px;left:0;top:0;clip-path:inset(0 52.7% 0 0)}.hero{position:absolute;left:1235px;top:106px;width:1224px;height:1008px}.hero svg{width:100%;height:100%;overflow:visible}.hero #Background{fill:${refBg}}</style><img class="reference" src="assets/landing-reference.png" alt="기존 왼쪽 제목, 설명과 시작하기 영역"><div class="hero">${svg}</div></html>`);
const codeSource=fs.readFileSync(path.join(root,'figma-plugin/source.js'),'utf8');
fs.writeFileSync(path.join(root,'figma-plugin/code.js'),`const SPEC=${JSON.stringify(spec)};\nconst ICONS=${JSON.stringify(ICONS)};\nconst PHOTO_BASE64=${JSON.stringify(images)};\n${codeSource}`);
console.log('Built self-contained SVG, two previews and offline Figma plugin.');
