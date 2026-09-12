// Offline Figma plugin. SPEC, ICONS and PHOTO_BASE64 are bundled by build.mjs.
// No network access, no flattening, no edits to existing canvas objects.
(async function createSpotitHero() {
  const made = [];
  const mark = n => (made.push(n), n);
  const rgb = h => ({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
  const rgba = h => ({...rgb(h),a:1});
  const solid = (h,opacity=1) => ({type:'SOLID',color:rgb(h),opacity});
  const P = SPEC.palette;
  let root;
  try {
    const available = (await figma.listAvailableFontsAsync()).map(f=>f.fontName);
    const regular = available.find(f=>f.family==='Noto Sans KR'&&f.style==='Regular') || available.find(f=>f.family==='Malgun Gothic'&&f.style==='Regular');
    if (!regular) throw new Error('Noto Sans KR 글꼴이 필요합니다. assets/NotoSansKR.ttf를 설치한 후 Figma를 다시 열어주세요.');
    const titleFont = available.find(f=>f.family===regular.family&&f.style==='Medium') || available.find(f=>f.family===regular.family&&f.style==='Bold') || regular;
    await Promise.all([figma.loadFontAsync(regular),figma.loadFontAsync(titleFont)]);

    // Read existing foundations by exact names; preserve user token overrides.
    const collections=await figma.variables.getLocalVariableCollectionsAsync();
    let primitives=collections.find(c=>c.name==='Spotit · Hero / Primitives');
    if(!primitives) {primitives=figma.variables.createVariableCollection('Spotit · Hero / Primitives');primitives.renameMode(primitives.defaultModeId,'Value');}
    let semantic=collections.find(c=>c.name==='Spotit · Hero / Tokens');
    if(!semantic) {semantic=figma.variables.createVariableCollection('Spotit · Hero / Tokens');semantic.renameMode(semantic.defaultModeId,'Warm');}
    const existing=await figma.variables.getLocalVariablesAsync();
    const tokens={};
    function token(name,value,type,scopes,syntax){
      let raw=existing.find(v=>v.variableCollectionId===primitives.id&&v.name===name);
      if(!raw){raw=figma.variables.createVariable(name,primitives,type);raw.setValueForMode(primitives.defaultModeId,value);raw.scopes=[];raw.setVariableCodeSyntax('WEB',`var(--spotit-hero-raw-${name.replace(/\//g,'-')})`);}
      let semanticVar=existing.find(v=>v.variableCollectionId===semantic.id&&v.name===name);
      if(!semanticVar){semanticVar=figma.variables.createVariable(name,semantic,type);semanticVar.setValueForMode(semantic.defaultModeId,{type:'VARIABLE_ALIAS',id:raw.id});semanticVar.scopes=scopes;semanticVar.setVariableCodeSyntax('WEB',`var(${syntax})`);}
      tokens[name]=semanticVar;
    }
    for(const [key,value] of Object.entries(P)) token(`color/${key}`,rgba(value),'COLOR',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR'],`--spotit-hero-${key}`);
    for(const value of [0,4,6,8,9,10,12]) token(`space/${value}`,value,'FLOAT',['GAP'],`--spotit-hero-space-${value}`);
    for(const value of [13,15,20,22,999]) token(`radius/${value}`,value,'FLOAT',['CORNER_RADIUS'],`--spotit-hero-radius-${value}`);
    const paint=(key,opacity=1)=>figma.variables.setBoundVariableForPaint(solid(P[key],opacity),'color',tokens[`color/${key}`]);
    function corners(n,r){for(const p of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']) n.setBoundVariable(p,tokens[`radius/${r}`]);}
    function gap(n,v){n.setBoundVariable('itemSpacing',tokens[`space/${v}`]);}
    function padding(n,top,right=top,bottom=top,left=right){for(const [p,v] of Object.entries({paddingTop:top,paddingRight:right,paddingBottom:bottom,paddingLeft:left}))n.setBoundVariable(p,tokens[`space/${v}`]);}
    function frame(parent,name,w,h){const n=mark(figma.createFrame());parent.appendChild(n);n.name=name;n.resize(w,h);n.fills=[];n.clipsContent=false;return n;}
    function layout(parent,name,direction,w,h){const n=frame(parent,name,w,h);n.layoutMode=direction;n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';gap(n,0);padding(n,0);return n;}
    const existingEffects=await figma.getLocalEffectStylesAsync();
    function effect(name,dy,radius,alpha){let style=existingEffects.find(s=>s.name===name);if(!style){style=figma.createEffectStyle();style.name=name;style.effects=[{type:'DROP_SHADOW',color:{...rgb('#293A31'),a:alpha},offset:{x:0,y:dy},radius,spread:0,visible:true,blendMode:'NORMAL'}];}return style;}
    const cardEffect=effect('Spotit / Post Card · Soft',8,22,.07);
    const pinEffect=effect('Spotit / Location Pin · Soft',4,10,.07);
    const existingTextStyles=await figma.getLocalTextStylesAsync();
    const styles={};
    for(const [name,size,line,emphasis] of [['Title Large',15.5,22,true],['Title Small',14,20,true],['Caption Large',11.5,20,false],['Caption Small',10.5,18,false],['Meta Large',10.2,20,false],['Meta Small',9.1,20,false],['Note',11,16,false]]){
      let style=existingTextStyles.find(s=>s.name===`Spotit / ${name}`);
      if(!style){style=figma.createTextStyle();style.name=`Spotit / ${name}`;style.fontName=emphasis?titleFont:regular;style.fontSize=size;style.lineHeight={unit:'PIXELS',value:line};}
      styles[name]=style;
    }
    await Promise.all(Object.values(styles).map(s=>figma.loadFontAsync(s.fontName)));
    const pendingStyles=[];
    function label(parent,name,str,styleName,color='ink',width){
      const style=styles[styleName];
      const n=mark(figma.createText());parent.appendChild(n);n.name=name;n.fontName=style.fontName;n.characters=str;n.fontSize=style.fontSize;n.lineHeight=style.lineHeight;n.fills=[paint(color)];
      pendingStyles.push(async()=>{const size=n.fontSize,line=n.lineHeight,tracking=n.letterSpacing;await n.setTextStyleIdAsync(style.id);n.fontSize=size;n.lineHeight=line;n.letterSpacing=tracking;});
      if(width){n.textAutoResize='HEIGHT';n.resize(width,n.height);}else n.textAutoResize='WIDTH_AND_HEIGHT';return n;
    }
    function icon(parent,name,kind,size,color){
      const n=mark(figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${P[color]}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</svg>`));
      parent.appendChild(n);n.name=name;
      for(const v of n.findAll(c=>c.type==='VECTOR')) {if(v.strokes.length)v.strokes=[paint(color)];if(v.fills.length)v.fills=[paint(color)];}
      return n;
    }
    function pathVector(parent,name,d,color,width,opacity=1,dash){
      const n=mark(figma.createVector());parent.appendChild(n);n.name=name;n.vectorPaths=[{windingRule:'NONE',data:d}];n.fills=[];n.strokes=[paint(color)];n.strokeWeight=width;n.strokeCap='ROUND';n.strokeJoin='ROUND';n.opacity=opacity;if(dash)n.dashPattern=dash;return n;
    }
    function circle(parent,name,cx,cy,r,color,opacity=1){const n=mark(figma.createEllipse());parent.appendChild(n);n.name=name;n.resize(r*2,r*2);n.x=cx-r;n.y=cy-r;n.fills=[paint(color)];n.opacity=opacity;return n;}

    const page=figma.currentPage;
    const right=page.children.reduce((max,n)=>Math.max(max,n.x+n.width),0);
    root=frame(page,'Spotit · Editable Hero Package',1660,740);root.x=right+100;root.y=80;
    const hero=frame(root,SPEC.name,680,560);hero.x=0;hero.y=80;hero.fills=[paint('bg')];
    hero.exportSettings=[{format:'PNG',constraint:{type:'SCALE',value:2},suffix:'@2x'},{format:'SVG',suffix:''}];
    const library=frame(root,'Components',850,610);library.x=790;library.y=80;
    label(root,'Package Title','Spotit · 장소에 남긴 순간','Title Large').y=0;
    label(root,'Usage','Hero Visual 프레임을 복사해 기존 오른쪽 영역에 배치하세요. 사진·글·핀·경로를 각각 수정할 수 있습니다.','Note','muted').y=31;
    label(library,'Components Title','Post Card / Location Pin','Title Large').y=0;
    label(library,'Components Usage','카드: 사진 교체 + 장소명·기록·시간 수정  /  핀: Color variant 선택','Note','muted').y=28;

    const map=frame(hero,'Map Background',680,560);
    for(const r of SPEC.roads) pathVector(map,r.name,r.d,'road',r.width,.29,r.dash);
    pathVector(map,'Route',SPEC.route.d,'teal',1.4,.38);
    const dots=frame(map,'Map Dots',680,560);
    SPEC.dots.forEach((d,i)=>circle(dots,`Map Dot ${String(i+1).padStart(2,'0')}`,d.x,d.y,d.r,'road',.35));
    circle(dots,'Route Start',87,445,3.1,'teal',.5);circle(dots,'Route End',615,480,3.1,'teal',.5);
    for(const c of SPEC.connections)pathVector(map,c.name,c.d,c.color,1.1,.48);

    const pins=[];
    for(const [i,color] of ['teal','coral','olive'].entries()){
      const comp=mark(figma.createComponent());library.appendChild(comp);comp.name=`Color=${color}`;comp.resize(44,44);comp.layoutMode='HORIZONTAL';comp.primaryAxisSizingMode='FIXED';comp.counterAxisSizingMode='FIXED';comp.primaryAxisAlignItems='CENTER';comp.counterAxisAlignItems='CENTER';padding(comp,4);comp.fills=[paint('paper')];corners(comp,999);await comp.setEffectStyleIdAsync(pinEffect.id);
      const disk=layout(comp,'Pin Background','HORIZONTAL',36,36);disk.primaryAxisSizingMode='FIXED';disk.counterAxisSizingMode='FIXED';disk.primaryAxisAlignItems='CENTER';disk.counterAxisAlignItems='CENTER';disk.fills=[paint(color)];corners(disk,999);icon(disk,'Location Icon','pin',20,'paper');
      pins.push(comp);
    }
    const pinSet=mark(figma.combineAsVariants(pins,library));pinSet.name='Location Pin';pinSet.x=0;pinSet.y=404;pinSet.resize(270,84);pinSet.fills=[];pinSet.description='원형 장소 핀. Color: teal / coral / olive. 아이콘은 개별 Vector로 수정할 수 있습니다.';
    pins.forEach((c,i)=>{c.x=16+i*82;c.y=20;});

    function decode64(str){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';const out=new Uint8Array(Math.floor(str.length*3/4)-(str.endsWith('==')?2:str.endsWith('=')?1:0));let bits=0,value=0,offset=0;for(const char of str){const digit=alphabet.indexOf(char);if(digit<0)continue;value=(value<<6)|digit;bits+=6;if(bits>=8){bits-=8;out[offset++]=(value>>bits)&255;}}return out;}
    const photos={};for(const [key,data] of Object.entries(PHOTO_BASE64))photos[key]=figma.createImage(decode64(data));
    const cardComponents=[];
    for(const c of SPEC.cards){
      const large=c.variant==='Large';
      const comp=mark(figma.createComponent());library.appendChild(comp);comp.name=`Size=${c.variant}`;comp.resize(c.width,c.height);comp.layoutMode='VERTICAL';comp.primaryAxisSizingMode='FIXED';comp.counterAxisSizingMode='FIXED';padding(comp,c.padding);gap(comp,c.gap);comp.fills=[paint('paper')];comp.strokes=[paint('line')];comp.strokeWeight=.6;corners(comp,large?22:20);await comp.setEffectStyleIdAsync(cardEffect.id);
      const photo=mark(figma.createRectangle());comp.appendChild(photo);photo.name='Photo';photo.resize(c.width-c.padding*2,c.photoHeight);photo.layoutSizingHorizontal='FILL';photo.layoutSizingVertical='FIXED';corners(photo,large?15:13);photo.fills=[{type:'IMAGE',imageHash:photos[c.image].hash,scaleMode:'FILL'}];
      const content=layout(comp,'Content','VERTICAL',c.width-c.padding*2,74);content.layoutSizingHorizontal='FILL';padding(content,0,4,large?6:8,4);gap(content,large?6:4);
      const title=label(content,'Location',c.title,large?'Title Large':'Title Small','ink',c.width-c.padding*2-8);title.layoutSizingHorizontal='FILL';
      const caption=label(content,'Caption',c.caption,large?'Caption Large':'Caption Small','muted',c.width-c.padding*2-8);caption.layoutSizingHorizontal='FILL';
      const meta=layout(content,'Metadata','HORIZONTAL',c.width-c.padding*2-8,20);meta.layoutSizingHorizontal='FILL';meta.primaryAxisSizingMode='FIXED';meta.counterAxisSizingMode='FIXED';meta.primaryAxisAlignItems='SPACE_BETWEEN';meta.counterAxisAlignItems='CENTER';
      const place=layout(meta,'Place and Time','HORIZONTAL',100,20);place.counterAxisSizingMode='AUTO';place.counterAxisAlignItems='CENTER';gap(place,4);icon(place,'Location Icon','pin',11,c.accent);
      const location=label(place,'Place',c.location,large?'Meta Large':'Meta Small','muted');label(place,'Separator','·',large?'Meta Large':'Meta Small','muted');const time=label(place,'Time',c.time,large?'Meta Large':'Meta Small','muted');
      const action=layout(meta,'Action','HORIZONTAL',36,20);action.counterAxisSizingMode='AUTO';action.counterAxisAlignItems='CENTER';gap(action,4);icon(action,c.action==='heart'?'Like':'Save',c.action,14,c.accent);if(c.actionCount)label(action,'Count',c.actionCount,'Meta Small','muted');
      for(const [name,node,value] of [['Location title',title,c.title],['Caption',caption,c.caption],['Place',location,c.location],['Time',time,c.time]]){const key=comp.addComponentProperty(name,'TEXT',value);node.componentPropertyReferences={characters:key};}
      comp.description='사진과 짧은 글로 남기는 장소 기록. Photo는 교체 가능한 Image Fill. Content/Metadata/Action은 Auto Layout. 장소명·기록·위치·시간은 Text properties.';
      cardComponents.push(comp);
    }
    const cardSet=mark(figma.combineAsVariants(cardComponents,library));cardSet.name='Post Card';cardSet.x=0;cardSet.y=76;cardSet.resize(724,320);cardSet.fills=[];cardSet.description='Small 178×225 / Medium 192×243 / Large 220×280. 사진 및 텍스트 수정 가능. Hero에는 연결된 Instance가 배치됩니다.';
    let componentX=16;cardComponents.forEach(c=>{c.x=componentX;c.y=16;componentX+=c.width+32;});
    const cardInstances=[];
    for(const [i,c] of SPEC.cards.entries()){
      const instance=mark(cardComponents[i].createInstance());hero.appendChild(instance);instance.name=`Post Card ${c.id}`;
      const theta=c.rotation*Math.PI/180;instance.relativeTransform=[[Math.cos(theta),-Math.sin(theta),c.x],[Math.sin(theta),Math.cos(theta),c.y]];cardInstances.push(instance);
    }
    for(const p of SPEC.pins){const instance=mark(pins[['teal','coral','olive'].indexOf(p.color)].createInstance());hero.appendChild(instance);instance.name=`Pin ${p.id}`;instance.rescale(p.size/44);instance.x=p.x;instance.y=p.y;}
    const notes=frame(hero,'Journal Notes',680,560);
    for(const [i,n] of SPEC.notes.entries()){const t=label(notes,`Note ${i+1}`,n.text,'Note',n.color);t.fontSize=n.size;t.letterSpacing={unit:'PIXELS',value:n.tracking};t.x=n.x;t.y=n.y;}
    const docs=layout(library,'Editing Guide','VERTICAL',820,80);docs.x=0;docs.y=520;gap(docs,6);
    label(docs,'Editing Note 1','1. Hero Visual을 복사 → 기존 지도 영역과 교체','Note','muted');
    label(docs,'Editing Note 2','2. Post Card 인스턴스 안 Photo 선택 → Fill 이미지 교체','Note','muted');
    label(docs,'Editing Note 3','3. 텍스트 속성 수정 / 핀 Color 변경 / Route 벡터 점 편집','Note','muted');
    label(docs,'Photo Note','사진은 AI로 제작한 예시 이미지입니다. 실제 장소 사진으로 교체할 수 있습니다.','Note','muted');
    await Promise.all(pendingStyles.map(apply=>apply()));
    const structure={frame:[hero.width,hero.height],cards:cardInstances.length,pins:hero.children.filter(n=>n.name.startsWith('Pin ')).length,photos:cardSet.findAll(n=>n.type==='RECTANGLE'&&n.name==='Photo').length,textLayers:root.findAll(n=>n.type==='TEXT').length,vectorLayers:root.findAll(n=>n.type==='VECTOR').length,font:regular.family};
    if(structure.cards!==3||structure.pins!==3||structure.photos!==3)throw new Error('생성 결과의 레이어 수 검증에 실패했습니다.');
    figma.currentPage.selection=[hero];figma.viewport.scrollAndZoomIntoView([hero]);
    figma.closePlugin(`680×560 Hero 완성 · 카드 3개 · 핀 3개 · 개별 레이어와 컴포넌트 생성됨`);
  } catch(error) {
    // Only this run's root is removed; existing work is never touched.
    if(root&&!root.removed)root.remove();
    figma.closePlugin(`Spotit Hero 생성 실패: ${error.message||error}`);
  }
})();
