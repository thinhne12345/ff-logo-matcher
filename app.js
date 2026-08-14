const $=id=>document.getElementById(id);let teams=[],logos=[],render;
const HEADPICS=[['ANDREW','902000006'],['KELLY','902000007'],['OLIVA','902000008'],['FORD','902000009'],['NIKITA','902000010'],['MISHA','902000012'],['MAXIM','902000030'],['KLA','902000062'],['PALOMA','902000080'],['MIGUEL','902000081'],['CAROLINE','902000096'],['ANTONIO','902000102'],['WUKONG','902000110'],['MOCO','902000119'],['HAYATO','902000130']];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const textKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\.[^.]+$/,'').replace(/[^A-Z0-9]+/g,' ').trim();
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\.[^.]+$/,'').replace(/\b(LOGO|TEAM|CLAN|ESPORTS?|FREE|FIRE|FF)\b/g,' ').replace(/[^A-Z0-9]+/g,' ').trim();
const safe=s=>(String(s||'logo').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s+/g,'_')||'logo');
const CORNER_COLOR_KEY='ff_corner_color_v1',DEFAULT_CORNER_COLOR='#C0C0C0';
let cornerColor=DEFAULT_CORNER_COLOR;
function normalizeHexColor(value){let hex=String(value||'').trim().toUpperCase();if(!hex.startsWith('#'))hex=`#${hex}`;if(/^#[0-9A-F]{3}$/.test(hex))hex=`#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;return/^#[0-9A-F]{6}$/.test(hex)?hex:''}
function setCornerColor(value,persist=true){const normalized=normalizeHexColor(value);if(!normalized)return false;cornerColor=normalized;document.documentElement.style.setProperty('--corner-color',cornerColor);if($('cornerColorPicker'))$('cornerColorPicker').value=cornerColor.toLowerCase();if($('cornerColorHex'))$('cornerColorHex').value=cornerColor;if(persist)try{localStorage.setItem(CORNER_COLOR_KEY,cornerColor)}catch{}return true}
function syncCornerColorAvailability(){const disabled=exportPreservesOriginal();$('cornerColorControl')?.classList.toggle('is-disabled',disabled);if($('cornerColorPicker'))$('cornerColorPicker').disabled=disabled;if($('cornerColorHex'))$('cornerColorHex').disabled=disabled}
const headpicsById=id=>HEADPICS.find(([,candidateId])=>candidateId===String(id||''));
const exactHeadpicsByName=value=>HEADPICS.find(([name])=>textKey(name)===textKey(value));
const hasWholePhrase=(value,phrase)=>{const clean=textKey(value),wanted=textKey(phrase);return Boolean(clean&&wanted&&(clean===wanted||` ${clean} `.includes(` ${wanted} `)))};
function findExplicitHeadpics(...values){const matches=new Map();for(const value of values){const clean=textKey(value);if(!clean)continue;for(const item of HEADPICS){const [name,id]=item;if(hasWholePhrase(clean,name)||hasWholePhrase(clean,id))matches.set(id,item)}}return matches.size===1?[...matches.values()][0]:null}
function duplicateHeadpicsIds(list=teams){const counts=new Map();for(const team of list)if(headpicsById(team.id))counts.set(team.id,(counts.get(team.id)||0)+1);return new Set([...counts].filter(([,count])=>count>1).map(([id])=>id))}
const hasUniqueHeadpicsId=team=>Boolean(headpicsById(team?.id)&&!team.headpicsConflict&&!duplicateHeadpicsIds().has(team.id));
function logoNameMatchScore(team,file){const fileKey=norm(file?.name);if(!fileKey)return 0;const keys=[team.team,team.avatar,team.id].map(norm).filter(Boolean);let score=0;for(const key of keys){if(fileKey===key)score=Math.max(score,100);else if(key.length>=3&&hasWholePhrase(fileKey,key))score=Math.max(score,80)}return score}
try{localStorage.removeItem?.('ff_logo_memory_v2')}catch{}

function parseTeams(text,append=false){
  const base=append?teams.length:0;
  const rows=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    const c=line.split(/\t|\||,|;/).map(x=>x.trim()).filter(Boolean);let no='',team='',avatar='',id='';
    if(c.length>1){if(/^\d+$/.test(c[0])){no=c[0];team=c[1]||'';avatar=c[2]||'';id=c[3]||''}else{team=c[0];avatar=c[1]||'';id=c[2]||''}}
    else{const m=line.match(/^(?:(\d+)\s+)?(.+?)(?:\s+(\d{6,}))?$/);no=m?.[1]||'';team=m?.[2]||line;id=m?.[3]||''}
    if(/^\d{6,}$/.test(avatar)&&!id){id=avatar;avatar=''}
    const idPreset=headpicsById(id),avatarPreset=exactHeadpicsByName(avatar),teamPreset=!avatar&&!id?exactHeadpicsByName(team):null;
    const conflictingInput=idPreset&&avatarPreset&&idPreset[1]!==avatarPreset[1];
    const preset=conflictingInput?null:idPreset||avatarPreset||teamPreset;
    const headpicsSource=preset?(id?'input-id':avatar?'input-avatar':'input-name'):'';
    const headpicsConflict=conflictingInput?`Avatar ${avatar} khÃ´ng khá»›p HEADPICS ID ${id}.`:'';
    if(conflictingInput){avatar='';id=''}else if(preset){avatar=preset[0];id=preset[1]}
    return{no:no||String(base+i+1),team,avatar,id,file:null,headpicsSource,headpicsConflict};
  }).filter(x=>x.team);
  teams=append?[...teams,...rows]:rows;render();
}

async function addFiles(items){
  for(const file of items){if(!/^image\/(png|jpeg|webp)$/i.test(file.type))continue;logos.push({file,name:file.name,url:URL.createObjectURL(file),key:crypto.randomUUID()})}
  matchNames();
}

function matchNames(){
  const free=logos.filter(f=>!teams.some(t=>t.file===f));let attached=0;
  for(const team of teams){
    if(team.file)continue;
    const scored=free.map(file=>({file,score:logoNameMatchScore(team,file)})).filter(item=>item.score>0);
    if(!scored.length)continue;
    const bestScore=Math.max(...scored.map(item=>item.score));
    const best=scored.filter(item=>item.score===bestScore);
    if(best.length!==1)continue;
    const found=best[0].file;
    const competingTeams=teams.filter(candidate=>!candidate.file&&candidate!==team&&logoNameMatchScore(candidate,found)>=bestScore);
    if(competingTeams.length)continue;
    team.file=found;applyHeadpics(team,found);free.splice(free.indexOf(found),1);attached++;
  }
  render();return attached;
}

function applyHeadpics(team,file){
  const selected=headpicsById(team.id);
  if(selected){team.avatar=selected[0];team.headpicsSource=team.headpicsSource||'input-id';return selected}
  if(team.headpicsConflict)return null;
  const avatarMatch=findExplicitHeadpics(team.avatar),filenameMatch=findExplicitHeadpics(file?.name),teamNameMatch=exactHeadpicsByName(team.team);
  const candidates=[avatarMatch,filenameMatch,teamNameMatch].filter(Boolean);
  const unique=new Map(candidates.map(item=>[item[1],item]));
  if(unique.size>1){team.headpicsConflict='Avatar, tÃªn team hoáº·c tÃªn file Ä‘ang chá»‰ tá»›i cÃ¡c HEADPICS khÃ¡c nhau.';return null}
  if(unique.size!==1)return null;
  const found=[...unique.values()][0];
  if(teams.some(candidate=>candidate!==team&&candidate.id===found[1]))return null;
  team.avatar=found[0];team.id=found[1];team.headpicsSource=filenameMatch?.[1]===found[1]?'filename':avatarMatch?.[1]===found[1]?'input-avatar':'input-name';team.headpicsConflict='';
  return found;
}
function applyHeadpicsByOrder(team,index){
  if(!team)return null;
  const selected=headpicsById(team.id);
  if(selected){team.avatar=selected[0];return selected}
  const ordered=HEADPICS[index];if(!ordered)return null;
  team.avatar=ordered[0];team.id=ordered[1];team.headpicsSource='order';team.headpicsConflict='';return ordered;
}
function assign(key,index){if(index==='')return;const file=logos.find(x=>x.key===key),row=Number(index),team=teams[row];if(!file||!team||team.file||teams.some(t=>t.file===file)){render();return}team.file=file;if(!applyHeadpics(team,file))applyHeadpicsByOrder(team,row);render()}
function pickForTeam(index,file){if(!file||!/^image\/(png|jpeg|webp)$/i.test(file.type))return;const obj={file,name:file.name,url:URL.createObjectURL(file),key:crypto.randomUUID()};logos.push(obj);teams[index].file=obj;if(!applyHeadpics(teams[index],obj))applyHeadpicsByOrder(teams[index],index);render()}
function setHeadpics(index,id){
  const item=headpicsById(id),team=teams[index];if(!team)return false;
  if(item&&teams.some((candidate,candidateIndex)=>candidateIndex!==index&&candidate.id===item[1])){alert(`${item[0]} â€” ${item[1]} Ä‘Ã£ Ä‘Æ°á»£c chá»n cho team khÃ¡c.`);render();return false}
  team.id=item?.[1]||'';team.avatar=item?.[0]||'';team.headpicsSource=item?'manual':'';team.headpicsConflict='';render();return true;
}
function detach(index){teams[index].file=null;render()}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}

async function aiAutoMatch(){
  const targets=teams.filter(t=>t.file&&!HEADPICS.some(([,id])=>id===t.id));
  if(!targets.length){$('aiStatus').textContent='Táº¥t cáº£ logo Ä‘Ã£ cÃ³ HEADPICS ID.';return}
  const button=$('aiMatch');button.disabled=true;let assigned=0;
  try{for(let i=0;i<targets.length;i++){const team=targets[i];$('aiStatus').textContent=`AI Ä‘ang phÃ¢n tÃ­ch ${i+1}/${targets.length}: ${team.team}`;$('bar').style.width=`${i/targets.length*100}%`;const response=await fetch('/api/ai-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team:team.team,fileName:team.file.name,image:await fileToDataUrl(team.file.file),candidates:HEADPICS.map(([name,id])=>({name,id}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||'AI khÃ´ng hoáº¡t Ä‘á»™ng');if(data.id&&Number(data.confidence)>=.7){team.id=data.id;team.avatar=data.name;team.ai={confidence:data.confidence,reason:data.reason};assigned++}render()}
    $('bar').style.width='100%';$('aiStatus').textContent=`AI Ä‘Ã£ tá»± gáº¯n ${assigned}/${targets.length} logo. Logo chÆ°a cháº¯c cháº¯n Ä‘Æ°á»£c giá»¯ láº¡i Ä‘á»ƒ kiá»ƒm tra.`;
  }catch(error){$('aiStatus').textContent=`Lá»—i AI: ${error.message}`}finally{button.disabled=false}
}
async function checkAi(){try{const r=await fetch('/api/health'),d=await r.json();$('aiStatus').textContent=d.ai?`AI sáºµn sÃ ng Â· ${d.model}`:'ChÆ°a cÃ³ OPENAI_API_KEY trÃªn server; váº«n cÃ³ thá»ƒ gáº¯n theo tÃªn file.';$('aiMatch').disabled=!d.ai}catch{$('aiStatus').textContent='KhÃ´ng kiá»ƒm tra Ä‘Æ°á»£c AI.'}}
function localAutoMatch(){
  let attached=matchNames(),numbered=0;
  const free=logos.filter(file=>!teams.some(team=>team.file===file));
  for(let index=0;index<teams.length;index++){
    const team=teams[index];
    if(!team.file&&free.length){team.file=free.shift();applyHeadpics(team,team.file);attached++}
    if(team.file&&!headpicsById(team.id)&&applyHeadpicsByOrder(team,index))numbered++;
  }
  render();
  const needsReview=teams.filter(team=>team.file&&!hasUniqueHeadpicsId(team)).length;
  $('bar').style.width='100%';
  $('aiStatus').textContent=`ÄÃ£ gáº¯n ${attached} logo Â· ${numbered} ID theo thá»© tá»±${needsReview?` Â· ${needsReview} cáº§n kiá»ƒm tra thá»§ cÃ´ng`:''}`;
}

function renderHeadpics(){
  const original=exportPreservesOriginal(),duplicates=duplicateHeadpicsIds();
  const sourceLabels={manual:'ch&#7885;n th&#7911; c&#244;ng','input-id':'t&#7915; ID nh&#7853;p','input-avatar':'t&#7915; avatar nh&#7853;p','input-name':'t&#7915; t&#234;n HEADPICS',filename:'t&#7915; t&#234;n file',order:'theo th&#7913; t&#7921; d&#242;ng',preset:'m&#7863;c &#273;&#7883;nh'};
  $('tbody').innerHTML=teams.map((t,i)=>{
    const valid=headpicsById(t.id),duplicate=duplicates.has(t.id);
    const status=t.headpicsConflict?`<span style="color:#ff6b6b">${esc(t.headpicsConflict)} Ch&#7885;n ID th&#7911; c&#244;ng.</span>`:!t.file?'<span style="color:#f5c451">Ch&#432;a c&#243; logo</span>':!valid?'<span style="color:#f5c451">C&#7847;n ch&#7885;n HEADPICS ID</span>':duplicate?`<span style="color:#ff6b6b">HEADPICS ID b&#7883; tr&#249;ng &middot; ${esc(t.id)}</span>`:`<span style="color:#67e66f">${original?'Gi&#7919; nguy&#234;n logo g&#7889;c':'Avatar tr&#242;n c&#243; khung'} &middot; ${esc(t.avatar||t.id)} &middot; ${sourceLabels[t.headpicsSource]||'&#273;&#227; x&#225;c nh&#7853;n'}</span>`;
    const useBg=bgLogoEnabled(),bgSrc=(useBg&&bgLogoImage)?(bgLogoImage._url||bgLogoImage.src):'';
    let logoCell;
    if(!t.file){
      logoCell=`<label class="row-file">Ch&#7885;n logo<input type="file" accept="image/png,image/jpeg,image/webp" onchange="pickForTeam(${i},this.files[0])"></label>`;
    }else if(original){
      logoCell=`<div class="original-logo-preview"><img class="preview" src="${t.file.url}" alt="${esc(t.file.name)}"></div>`;
    }else{
      const bgLayer=bgSrc?`<img class="bg-layer" src="${bgSrc}" alt="">`:''
      logoCell=`<div class="avatar-preview">${bgLayer}<img class="preview" src="${t.file.url}" alt="${esc(t.file.name)}"></div>`;
    }
    return`<tr><td>${esc(t.no)}</td><td><strong>${esc(t.team)}</strong></td><td>${logoCell}</td><td><select class="headpics-select" onchange="setHeadpics(${i},this.value)"><option value="">Ch&#7885;n HEADPICS...</option>${HEADPICS.map(([name,id])=>`<option value="${id}" ${t.id===id?'selected':''}>${name} &mdash; ${id}</option>`).join('')}</select></td><td>${status}</td><td>${t.file?`<button onclick="downloadOne(${i})">T&#7843;i PNG</button> <button onclick="detach(${i})">B&#7887;</button>`:''}</td></tr>`;
  }).join('');
  const free=logos.filter(f=>!teams.some(t=>t.file===f));
  $('unmatched').innerHTML=free.map(f=>`<div class="card"><img src="${f.url}" alt="${esc(f.name)}"><strong class="filename" title="${esc(f.name)}">${esc(f.name)}</strong><div class="team-picker"><select><option value="">Ch&#7885;n team...</option>${teams.map((t,i)=>t.file?'':`<option value="${i}">${esc(t.team)}</option>`).join('')}</select><button onclick="assign('${f.key}',this.previousElementSibling.value)">OK</button></div></div>`).join('')||'<p>Kh&#244;ng c&#243; logo ch&#7901; gh&#233;p.</p>';
  $('tc').textContent=teams.length;$('lc').textContent=logos.length;$('mc').textContent=teams.filter(t=>t.file).length;
}
render=renderHeadpics;

function clearAll(){
  if(!confirm('XÃ³a toÃ n bá»™ báº£ng team vÃ  táº¥t cáº£ logo Ä‘Ã£ táº£i lÃªn?'))return;
  for(const logo of logos)if(logo.url)URL.revokeObjectURL(logo.url);
  teams=[];logos=[];$('paste').value='';$('files').value='';$('bar').style.width='0%';$('aiStatus').textContent='ÄÃ£ xÃ³a toÃ n bá»™ báº£ng vÃ  logo. Sáºµn sÃ ng cho lÆ°á»£t má»›i.';render();
}

teams=HEADPICS.map(([avatar,id],i)=>({no:String(i+1),team:avatar,avatar,id,file:null,headpicsSource:'preset'}));
$('aiMatch').onclick=localAutoMatch;$('aiMatch').disabled=false;$('aiStatus').textContent='Æ¯u tiÃªn tÃªn khá»›p; logo cÃ²n láº¡i Ä‘Æ°á»£c gáº¯n theo thá»© tá»± dÃ²ng vÃ  thá»© tá»± táº£i lÃªn.';

function drawStar(ctx,cx,cy,outer,inner){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?inner:outer,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function drawCornerFrame(ctx){const inset=5,length=172;ctx.save();ctx.lineCap='square';ctx.lineJoin='miter';ctx.lineWidth=14;ctx.strokeStyle=cornerColor;ctx.shadowColor=cornerColor;ctx.shadowBlur=7;for(const [x,y,sx,sy] of [[inset,inset,1,1],[1000-inset,inset,-1,1],[inset,1000-inset,1,-1],[1000-inset,1000-inset,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*length);ctx.lineTo(x,y);ctx.lineTo(x+sx*length,y);ctx.stroke()}ctx.restore()}
function drawVietnamFlag(ctx){drawCornerFrame(ctx);const x=790,y=58,w=150,h=100,r=16;ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle='#da251d';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#ffe8c7';ctx.stroke();ctx.shadowColor='transparent';drawStar(ctx,x+w/2,y+h/2,31,13);ctx.fillStyle='#ffdc35';ctx.fill();ctx.restore()}
/**
 * drawGoldRing â€” váº½ viá»n vÃ²ng trÃ²n vÃ ng giá»‘ng áº£nh tham chiáº¿u FF.
 * cx,cy = tÃ¢m (500,500), ringR = bÃ¡n kÃ­nh tÃ¢m viá»n, ringW = Ä‘á»™ dÃ y viá»n (px).
 */
function drawGoldRing(ctx,cx=500,cy=500,ringR=455,ringW=28){
  ctx.save();
  // Outer dark shadow ring for depth
  ctx.beginPath();ctx.arc(cx,cy,ringR+ringW/2+4,0,Math.PI*2);
  ctx.lineWidth=6;ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.stroke();
  // Main gold gradient ring
  const grad=ctx.createRadialGradient(cx,cy,ringR-ringW/2,cx,cy,ringR+ringW/2);
  grad.addColorStop(0,'#b87a00');   // inner edge â€” dark gold
  grad.addColorStop(0.25,'#e8a800'); // warm gold
  grad.addColorStop(0.5,'#FFD700'); // bright center gold
  grad.addColorStop(0.75,'#FFC200'); // warm gold
  grad.addColorStop(1,'#cc8800');   // outer edge â€” darker gold
  ctx.beginPath();ctx.arc(cx,cy,ringR,0,Math.PI*2);
  ctx.lineWidth=ringW;
  ctx.strokeStyle=grad;
  ctx.shadowColor='rgba(255,200,0,0.55)';
  ctx.shadowBlur=14;
  ctx.stroke();
  // Thin bright highlight on top
  ctx.beginPath();ctx.arc(cx,cy,ringR,0,Math.PI*2);
  ctx.lineWidth=3;
  ctx.strokeStyle='rgba(255,240,100,0.45)';
  ctx.shadowBlur=0;
  ctx.stroke();
  ctx.restore();
}
function exportPreservesOriginal(){return $('preserveOriginal')?.checked!==false}

// ========== BACKGROUND LOGO STATE ==========
let bgLogoImage=null; // HTMLImageElement when loaded

function bgLogoEnabled(){return $('useBgLogo')?.checked===true&&bgLogoImage!==null}

function syncBgLogoAvailability(){
  const preserve=exportPreservesOriginal();
  const section=$('bgLogoSection');
  if(section)section.classList.toggle('is-disabled',preserve);
  if(preserve&&$('useBgLogo'))$('useBgLogo').checked=false;
  syncBgLogoUploadVisibility();
}
function syncBgLogoUploadVisibility(){
  const uploadArea=$('bgLogoUploadArea');
  if(!uploadArea)return;
  const on=$('useBgLogo')?.checked&&!exportPreservesOriginal();
  uploadArea.classList.toggle('visible',!!on);
}

// ========== FRAME MODE ==========
const FRAME_MODE_KEY='ff_frame_mode_v1';
function getFrameMode(){return $('frameMode')?.value||'vietnam'}
function syncFrameModeAvailability(){
  const disabled=exportPreservesOriginal();
  $('frameModeControl')?.classList.toggle('is-disabled',disabled);
  if($('frameMode'))$('frameMode').disabled=disabled;
}
function loadBgLogoFile(file){
  if(!file||!/^image\/(png|jpeg|webp)$/i.test(file.type))return;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    if(bgLogoImage&&bgLogoImage._url)URL.revokeObjectURL(bgLogoImage._url);
    bgLogoImage=img;bgLogoImage._url=url;
    const thumb=$('bgLogoThumb');if(thumb)thumb.src=url;
    const preview=$('bgLogoPreview');if(preview)preview.style.display='flex';
    const dropLabel=$('bgLogoDropLabel');if(dropLabel)dropLabel.textContent='ðŸ–¼ '+file.name;
  };
  img.onerror=()=>URL.revokeObjectURL(url);
  img.src=url;
}
function clearBgLogo(){
  if(bgLogoImage?._url)URL.revokeObjectURL(bgLogoImage._url);
  bgLogoImage=null;
  const thumb=$('bgLogoThumb');if(thumb)thumb.src='';
  const preview=$('bgLogoPreview');if(preview)preview.style.display='none';
  const dropLabel=$('bgLogoDropLabel');if(dropLabel)dropLabel.textContent='ðŸ–¼ Chá»n áº£nh ná»n (áº£nh 1)';
  const fileInput=$('bgLogoFile');if(fileInput)fileInput.value='';
}

// ========== CANVAS EXPORT ==========
/**
 * makePng modes:
 *  preserveOriginal=true  â†’ scale-to-fit, transparent bg (original behaviour)
 *  useBgLogo=true         â†’ bg image fills circle, logo draws on top, outside circle = transparent
 *  default                â†’ dark gradient bg + circular clip + frame/flag theo frameMode
 */
function makePng(fileObj,preserveOriginal=exportPreservesOriginal(),useBgLogo=bgLogoEnabled(),frameMode=getFrameMode()){
  return new Promise((resolve,reject)=>{
    const logoImg=new Image();
    logoImg.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=1000;canvas.height=1000;
      const ctx=canvas.getContext('2d',{alpha:true});
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';

      if(preserveOriginal){
        // Mode 1: preserve original â€“ scale to fit, transparent outer
        ctx.clearRect(0,0,1000,1000);
        const scale=Math.min(1000/logoImg.width,1000/logoImg.height);
        const w=logoImg.width*scale,h=logoImg.height*scale;
        ctx.drawImage(logoImg,(1000-w)/2,(1000-h)/2,w,h);

      }else if(useBgLogo&&bgLogoImage){
        // Mode 2: background logo mode
        // Both bg and logo are drawn inside the same circular clip so that
        // transparent pixels of the logo reveal the background image underneath.
        // Outside the circle stays fully transparent (PNG alpha).
        ctx.clearRect(0,0,1000,1000);
        ctx.save();
        ctx.beginPath();
        ctx.arc(500,500,441,0,Math.PI*2); // clip radius matches inner edge of gold ring
        ctx.clip();
        // Step 1 – fill circle with background image (cover)
        const bgImg=bgLogoImage;
        const bgScale=Math.max(882/bgImg.width,882/bgImg.height);
        const bgW=bgImg.width*bgScale,bgH=bgImg.height*bgScale;
        ctx.drawImage(bgImg,(1000-bgW)/2,(1000-bgH)/2,bgW,bgH);
        // Step 2 – draw team logo on top; transparent areas show bg through
        ctx.globalCompositeOperation='source-over';
        const logoScale=Math.min(882/logoImg.width,882/logoImg.height);
        const logoW=logoImg.width*logoScale,logoH=logoImg.height*logoScale;
        ctx.drawImage(logoImg,(1000-logoW)/2,(1000-logoH)/2,logoW,logoH);
        ctx.restore();
        // Step 3 – draw gold ring on top (outside the clip, so it paints over the edge)
        drawGoldRing(ctx);

      }else{
        // Mode 3: default - dark bg + circular clip + gold ring + frame/flag theo frameMode
        const dark=ctx.createLinearGradient(0,0,1000,1000);
        dark.addColorStop(0,'#181d25');dark.addColorStop(.55,'#0f141c');dark.addColorStop(1,'#080c12');
        ctx.fillStyle=dark;ctx.fillRect(0,0,1000,1000);
        ctx.save();
        ctx.beginPath();ctx.arc(500,500,440,0,Math.PI*2);ctx.clip();
        const scale=Math.max(880/logoImg.width,880/logoImg.height);
        const w=logoImg.width*scale,h=logoImg.height*scale;
        ctx.drawImage(logoImg,(1000-w)/2,(1000-h)/2,w,h);
        ctx.restore();
        // Draw gold ring (r=455, width=28 -> spans r=441 to r=469)
        drawGoldRing(ctx);
        const fm=frameMode||getFrameMode();
        if(fm==='vietnam')drawVietnamFlag(ctx);
        else if(fm==='frame-only')drawCornerFrame(ctx);
        // fm==='none' -> no extra decoration
      }

      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('KhÃ´ng táº¡o Ä‘Æ°á»£c PNG')),'image/png');
    };
    logoImg.onerror=reject;
    logoImg.src=fileObj.url;
  });
}

function save(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
async function downloadOne(i){
  const t=teams[i];if(!t?.file)return;
  if(!headpicsById(t.id))return alert('Vui lÃ²ng chá»n HEADPICS cho team trÆ°á»›c khi xuáº¥t áº£nh.');
  if(duplicateHeadpicsIds().has(t.id))return alert(`HEADPICS ID ${t.id} Ä‘ang bá»‹ trÃ¹ng á»Ÿ nhiá»u team.`);
  save(await makePng(t.file,exportPreservesOriginal(),bgLogoEnabled(),getFrameMode()),`${t.id}.png`);
}
async function downloadZip(){
  const matched=teams.filter(t=>t.file);if(!matched.length)return alert('ChÆ°a cÃ³ logo nÃ o Ä‘Ã£ ghÃ©p.');
  const missing=matched.filter(t=>!headpicsById(t.id));if(missing.length)return alert('Vui lÃ²ng chá»n HEADPICS cho má»i team Ä‘Ã£ gáº¯n logo trÆ°á»›c khi táº£i ZIP.');
  const duplicates=duplicateHeadpicsIds(matched);if(duplicates.size)return alert(`KhÃ´ng thá»ƒ xuáº¥t ZIP vÃ¬ HEADPICS ID bá»‹ trÃ¹ng: ${[...duplicates].join(', ')}.`);
  $('zip').disabled=true;const entries=[],preserve=exportPreservesOriginal(),useBg=bgLogoEnabled(),fm=getFrameMode();
  try{
    for(let i=0;i<matched.length;i++){
      const t=matched[i],blob=await makePng(t.file,preserve,useBg,fm);
      entries.push({name:`${t.id}.png`,data:new Uint8Array(await blob.arrayBuffer())});
      $('bar').style.width=`${(i+1)/matched.length*100}%`;
    }
    save(buildZip(entries),'ff_team_avatars_1000x1000.zip');
  }finally{$('zip').disabled=false}
}

let crcTable;function crc32(bytes){if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}}let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
function buildZip(entries){const local=[],central=[];let offset=0;for(const e of entries){const name=new TextEncoder().encode(e.name),data=e.data,crc=crc32(data),l=new Uint8Array(30+name.length),lv=new DataView(l.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);l.set(name,30);local.push(l,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=l.length+data.length}const size=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'})}

// ========== INIT EVENT LISTENERS ==========
$('parse').onclick=()=>parseTeams($('paste').value);
$('append').onclick=()=>parseTeams($('paste').value,true);
$('clear').onclick=clearAll;
$('match').onclick=matchNames;
$('zip').onclick=downloadZip;
$('preserveOriginal').checked=false;
$('preserveOriginal').onchange=()=>{syncCornerColorAvailability();syncBgLogoAvailability();syncFrameModeAvailability();render()};
setCornerColor((()=>{try{return localStorage.getItem(CORNER_COLOR_KEY)}catch{return''}})()||DEFAULT_CORNER_COLOR,false);
$('cornerColorPicker').oninput=e=>setCornerColor(e.currentTarget.value);
$('cornerColorHex').oninput=e=>{const normalized=normalizeHexColor(e.currentTarget.value);if(normalized)setCornerColor(normalized)};
$('cornerColorHex').onblur=e=>{e.currentTarget.value=cornerColor};
$('cornerColorHex').onkeydown=e=>{if(e.key==='Enter'){if(!setCornerColor(e.currentTarget.value))e.currentTarget.value=cornerColor;e.currentTarget.blur()}};
syncCornerColorAvailability();

// bg logo UI wiring
if($('useBgLogo')){
  $('useBgLogo').onchange=()=>{syncBgLogoUploadVisibility();render()};
}
if($('bgLogoFile')){
  $('bgLogoFile').onchange=e=>{if(e.target.files[0])loadBgLogoFile(e.target.files[0])};
}
if($('bgLogoClear')){
  $('bgLogoClear').onclick=clearBgLogo;
}
// drag-drop on bg logo drop area
const bgDrop=$('bgLogoDrop');
if(bgDrop){
  bgDrop.ondragover=e=>{e.preventDefault();bgDrop.style.borderColor='#a855f7'};
  bgDrop.ondragleave=()=>{bgDrop.style.borderColor=''};
  bgDrop.ondrop=e=>{e.preventDefault();bgDrop.style.borderColor='';const f=e.dataTransfer.files[0];if(f)loadBgLogoFile(f)};
}

// frame mode wiring
if($('frameMode')){
  // restore persisted choice
  try{const saved=localStorage.getItem(FRAME_MODE_KEY);if(saved)$('frameMode').value=saved}catch{}
  $('frameMode').onchange=()=>{try{localStorage.setItem(FRAME_MODE_KEY,$('frameMode').value)}catch{}render()};
}
syncFrameModeAvailability();

$('files').onchange=e=>addFiles([...e.target.files]);
const drop=$('drop');
drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
drop.ondragleave=()=>drop.classList.remove('drag');
drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files])};
render();



