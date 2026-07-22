const $=id=>document.getElementById(id);let teams=[],logos=[];
const HEADPICS=[['ANDREW','902000006'],['KELLY','902000007'],['OLIVA','902000008'],['FORD','902000009'],['NIKITA','902000010'],['MISHA','902000012'],['MAXIM','902000030'],['KLA','902000062'],['PALOMA','902000080'],['MIGUEL','902000081'],['CAROLINE','902000096'],['ANTONIO','902000102'],['WUKONG','902000110'],['MOCO','902000119'],['HAYATO','902000130']];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\.[^.]+$/,'').replace(/\b(LOGO|TEAM|CLAN|ESPORTS?|FREE|FIRE|FF)\b/g,' ').replace(/[^A-Z0-9]+/g,' ').trim();
const safe=s=>(String(s||'logo').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s+/g,'_')||'logo');
const MEMORY_KEY='ff_logo_memory_v2';
let logoMemory=(()=>{try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'[]')}catch{return[]}})();
function imageHash(url){return new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});c.width=9;c.height=8;ctx.drawImage(img,0,0,9,8);const d=ctx.getImageData(0,0,9,8).data;let bits='',hex='';for(let y=0;y<8;y++)for(let x=0;x<8;x++){const a=(d[(y*9+x)*4]+d[(y*9+x)*4+1]+d[(y*9+x)*4+2])/3,b=(d[(y*9+x+1)*4]+d[(y*9+x+1)*4+1]+d[(y*9+x+1)*4+2])/3;bits+=a>b?'1':'0'}for(let i=0;i<bits.length;i+=4)hex+=parseInt(bits.slice(i,i+4),2).toString(16);resolve(hex)};img.onerror=()=>resolve('');img.src=url})}
function hashDistance(a,b){if(!a||!b||a.length!==b.length)return 99;let n=0;for(let i=0;i<a.length;i++){let x=parseInt(a[i],16)^parseInt(b[i],16);while(x){n+=x&1;x>>=1}}return n}
function learnedFor(file){const exact=logoMemory.find(m=>m.fileKey===norm(file.name));if(exact)return exact;let best=null,score=99;for(const m of logoMemory){const d=hashDistance(file.hash,m.hash);if(d<score){score=d;best=m}}return score<=8?best:null}
async function rememberLogo(team,file){if(!file||!team.id)return;if(!file.hash)file.hash=await imageHash(file.url);const item={fileKey:norm(file.name),hash:file.hash,teamKey:norm(team.team),id:team.id,avatar:team.avatar||'',savedAt:Date.now()};logoMemory=logoMemory.filter(m=>m.fileKey!==item.fileKey&&m.hash!==item.hash);logoMemory.unshift(item);logoMemory=logoMemory.slice(0,5000);try{localStorage.setItem(MEMORY_KEY,JSON.stringify(logoMemory))}catch{logoMemory=logoMemory.slice(0,2500);localStorage.setItem(MEMORY_KEY,JSON.stringify(logoMemory))}}

function parseTeams(text,append=false){
  const base=append?teams.length:0;
  const rows=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    const c=line.split(/\t|\||,|;/).map(x=>x.trim()).filter(Boolean);let no='',team='',avatar='',id='';
    if(c.length>1){if(/^\d+$/.test(c[0])){no=c[0];team=c[1]||'';avatar=c[2]||'';id=c[3]||''}else{team=c[0];avatar=c[1]||'';id=c[2]||''}}
    else{const m=line.match(/^(?:(\d+)\s+)?(.+?)(?:\s+(\d{6,}))?$/);no=m?.[1]||'';team=m?.[2]||line;id=m?.[3]||''}
    if(/^\d{6,}$/.test(avatar)&&!id){id=avatar;avatar=''}
    const preset=HEADPICS.find(([name,pid])=>norm(name)===norm(avatar)||norm(name)===norm(team)||pid===id);if(preset){avatar=preset[0];id=preset[1]}
    return{no:no||String(base+i+1),team,avatar,id,file:null};
  }).filter(x=>x.team);
  teams=append?[...teams,...rows]:rows;render();
}

async function addFiles(items){
  for(const file of items){if(!/^image\/(png|jpeg|webp)$/i.test(file.type))continue;const obj={file,name:file.name,url:URL.createObjectURL(file),key:crypto.randomUUID(),hash:''};obj.hash=await imageHash(obj.url);logos.push(obj)}
  matchNames();
}

function matchNames(){
  const free=logos.filter(f=>!teams.some(t=>t.file===f));
  for(const team of teams){if(team.file)continue;const keys=[norm(team.team),norm(team.avatar),String(team.id||'')].filter(Boolean);const found=free.find(f=>{const learned=learnedFor(f);return learned&&(learned.teamKey===norm(team.team)||learned.id===team.id)})||free.find(f=>keys.some(k=>norm(f.name)===k||norm(f.name).includes(k)||k.includes(norm(f.name))));if(found){const learned=learnedFor(found);team.file=found;if(learned){team.id=learned.id;team.avatar=learned.avatar}else applyHeadpics(team,found);free.splice(free.indexOf(found),1)}}
  render();
}

function applyHeadpics(team,file){const selected=HEADPICS.find(([,id])=>id===team.id);if(selected){team.avatar=selected[0];return selected}const values=[team.team,team.avatar,file?.name].map(norm);const found=HEADPICS.find(([name,id])=>values.some(v=>v===norm(name)||v.includes(norm(name))||v.includes(id)));if(found){team.avatar=found[0];team.id=found[1]}return found}
async function assign(key,index){if(index==='')return;const file=logos.find(x=>x.key===key),row=Number(index),team=teams[row];if(!file||!team||team.file||teams.some(t=>t.file===file)){render();return}team.file=file;if(!applyHeadpics(team,file)&&HEADPICS[row]){team.avatar=HEADPICS[row][0];team.id=HEADPICS[row][1]}await rememberLogo(team,file);render()}
async function pickForTeam(index,file){if(!file||!/^image\/(png|jpeg|webp)$/i.test(file.type))return;const obj={file,name:file.name,url:URL.createObjectURL(file),key:crypto.randomUUID(),hash:''};obj.hash=await imageHash(obj.url);logos.push(obj);teams[index].file=obj;if(!applyHeadpics(teams[index],obj)&&HEADPICS[index]){teams[index].avatar=HEADPICS[index][0];teams[index].id=HEADPICS[index][1]}await rememberLogo(teams[index],obj);render()}
async function setHeadpics(index,id){const item=HEADPICS.find(x=>x[1]===id);teams[index].id=id;teams[index].avatar=item?.[0]||'';if(teams[index].file)await rememberLogo(teams[index],teams[index].file);render()}
function detach(index){teams[index].file=null;render()}

function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
async function aiAutoMatch(){
  const targets=teams.filter(t=>t.file&&!HEADPICS.some(([,id])=>id===t.id));
  if(!targets.length){$('aiStatus').textContent='Tất cả logo đã có HEADPICS ID.';return}
  const button=$('aiMatch');button.disabled=true;let assigned=0;
  try{for(let i=0;i<targets.length;i++){const team=targets[i];$('aiStatus').textContent=`AI đang phân tích ${i+1}/${targets.length}: ${team.team}`;$('bar').style.width=`${i/targets.length*100}%`;const response=await fetch('/api/ai-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team:team.team,fileName:team.file.name,image:await fileToDataUrl(team.file.file),candidates:HEADPICS.map(([name,id])=>({name,id}))})});const data=await response.json();if(!response.ok)throw new Error(data.error||'AI không hoạt động');if(data.id&&Number(data.confidence)>=.7){team.id=data.id;team.avatar=data.name;team.ai={confidence:data.confidence,reason:data.reason};assigned++}render()}
    $('bar').style.width='100%';$('aiStatus').textContent=`AI đã tự gắn ${assigned}/${targets.length} logo. Logo chưa chắc chắn được giữ lại để kiểm tra.`;
  }catch(error){$('aiStatus').textContent=`Lỗi AI: ${error.message}`}finally{button.disabled=false}
}
async function checkAi(){try{const r=await fetch('/api/health'),d=await r.json();$('aiStatus').textContent=d.ai?`AI sẵn sàng · ${d.model}`:'Chưa có OPENAI_API_KEY trên server; vẫn có thể gắn theo tên file.';$('aiMatch').disabled=!d.ai}catch{$('aiStatus').textContent='Không kiểm tra được AI.'}}
function localAutoMatch(){
  const free=logos.filter(f=>!teams.some(t=>t.file===f));let attached=0,numbered=0;
  for(let i=0;i<teams.length;i++){const team=teams[i];if(!team.file&&free.length){const keys=[norm(team.team),norm(team.avatar),String(team.id||'')].filter(Boolean);let pos=free.findIndex(f=>keys.some(k=>norm(f.name)===k||norm(f.name).includes(k)||k.includes(norm(f.name))));if(pos<0)pos=0;team.file=free.splice(pos,1)[0];attached++}if(team.file&&!HEADPICS.some(([,id])=>id===team.id)&&HEADPICS[i]){team.avatar=HEADPICS[i][0];team.id=HEADPICS[i][1];numbered++}}
  teams.filter(t=>t.file&&t.id).forEach(t=>rememberLogo(t,t.file));render();$('bar').style.width='100%';$('aiStatus').textContent=`AI cục bộ: đã gắn ${attached} logo, ${numbered} HEADPICS ID và đang nhớ ${logoMemory.length} mẫu logo.`;
}

function render(){
  $('tbody').innerHTML=teams.map((t,i)=>`<tr><td>${esc(t.no)}</td><td><strong>${esc(t.team)}</strong></td><td>${t.file?`<img class="preview" src="${t.file.url}" alt="">`:'—'}</td><td><input value="${esc(t.id)}" oninput="teams[${i}].id=this.value"></td><td>${t.file?'<span style="color:#67e66f">Đã ghép · giữ nền gốc</span>':'<span style="color:#f5c451">Chưa có logo</span>'}</td><td>${t.file?`<button onclick="downloadOne(${i})">Tải PNG</button> <button onclick="detach(${i})">Bỏ</button>`:''}</td></tr>`).join('');
  const free=logos.filter(f=>!teams.some(t=>t.file===f));
  $('unmatched').innerHTML=free.map(f=>`<div class="card"><img src="${f.url}" alt=""><strong>${esc(f.name)}</strong><select onchange="assign('${f.key}',this.value)"><option value="">Chọn team...</option>${teams.map((t,i)=>`<option value="${i}">${esc(t.team)}</option>`).join('')}</select></div>`).join('')||'<p>Không có logo chờ ghép.</p>';
  $('tc').textContent=teams.length;$('lc').textContent=logos.length;$('mc').textContent=teams.filter(t=>t.file).length;
}

function drawStar(ctx,cx,cy,outer,inner){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?inner:outer,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}
function drawRedCornerFrame(ctx){const inset=5,length=172;ctx.save();ctx.lineCap='square';ctx.lineJoin='miter';ctx.lineWidth=14;ctx.strokeStyle='#ff1838';ctx.shadowColor='#ff1838';ctx.shadowBlur=7;for(const [x,y,sx,sy] of [[inset,inset,1,1],[1000-inset,inset,-1,1],[inset,1000-inset,1,-1],[1000-inset,1000-inset,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*length);ctx.lineTo(x,y);ctx.lineTo(x+sx*length,y);ctx.stroke()}ctx.restore()}
function drawVietnamFlag(ctx){drawRedCornerFrame(ctx);const x=790,y=58,w=150,h=100,r=16;ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle='#da251d';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#ffe8c7';ctx.stroke();ctx.shadowColor='transparent';drawStar(ctx,x+w/2,y+h/2,31,13);ctx.fillStyle='#ffdc35';ctx.fill();ctx.restore()}
function exportPreservesOriginal(){return $('preserveOriginal')?.checked!==false}
function makePng(fileObj,preserveOriginal=exportPreservesOriginal()){
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;const ctx=canvas.getContext('2d',{alpha:preserveOriginal});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';if(preserveOriginal){const scale=Math.min(1000/img.width,1000/img.height),w=img.width*scale,h=img.height*scale;ctx.clearRect(0,0,1000,1000);ctx.drawImage(img,(1000-w)/2,(1000-h)/2,w,h)}else{const dark=ctx.createLinearGradient(0,0,1000,1000);dark.addColorStop(0,'#181d25');dark.addColorStop(.55,'#0f141c');dark.addColorStop(1,'#080c12');ctx.fillStyle=dark;ctx.fillRect(0,0,1000,1000);ctx.save();ctx.beginPath();ctx.arc(500,500,440,0,Math.PI*2);ctx.clip();const scale=Math.max(880/img.width,880/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(1000-w)/2,(1000-h)/2,w,h);ctx.restore();ctx.beginPath();ctx.arc(500,500,440,0,Math.PI*2);ctx.lineWidth=8;ctx.strokeStyle='#080b10';ctx.stroke();drawVietnamFlag(ctx)}canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được PNG')),'image/png')};img.onerror=reject;img.src=fileObj.url});
}
function save(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
async function downloadOne(i){const t=teams[i];if(!t?.file)return;if(!HEADPICS.some(([,id])=>id===t.id))return alert('Vui lòng chọn HEADPICS cho team trước khi xuất ảnh.');save(await makePng(t.file,exportPreservesOriginal()),`${t.id}.png`)}
async function downloadZip(){
  const matched=teams.filter(t=>t.file);if(!matched.length)return alert('Chưa có logo nào đã ghép.');const missing=matched.filter(t=>!HEADPICS.some(([,id])=>id===t.id));if(missing.length)return alert('Vui lòng chọn HEADPICS cho mọi team đã gắn logo trước khi tải ZIP.');$('zip').disabled=true;const entries=[],preserveOriginal=exportPreservesOriginal();
  try{for(let i=0;i<matched.length;i++){const t=matched[i],blob=await makePng(t.file,preserveOriginal);entries.push({name:`${t.id}.png`,data:new Uint8Array(await blob.arrayBuffer())});$('bar').style.width=`${(i+1)/matched.length*100}%`}
  save(buildZip(entries),'ff_team_avatars_1000x1000.zip')}finally{$('zip').disabled=false}
}

let crcTable;function crc32(bytes){if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}}let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0}
function buildZip(entries){const local=[],central=[];let offset=0;for(const e of entries){const name=new TextEncoder().encode(e.name),data=e.data,crc=crc32(data),l=new Uint8Array(30+name.length),lv=new DataView(l.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);l.set(name,30);local.push(l,data);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=l.length+data.length}const size=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'})}

function renderHeadpics(){
  const original=exportPreservesOriginal();
  $('tbody').innerHTML=teams.map((t,i)=>`<tr><td>${esc(t.no)}</td><td><strong>${esc(t.team)}</strong></td><td>${t.file?`<div class="${original?'original-logo-preview':'avatar-preview'}"><img class="preview" src="${t.file.url}" alt="${esc(t.file.name)}"></div>`:`<label class="row-file">Ch&#7885;n logo<input type="file" accept="image/png,image/jpeg,image/webp" onchange="pickForTeam(${i},this.files[0])"></label>`}</td><td><select class="headpics-select" onchange="setHeadpics(${i},this.value)"><option value="">Ch&#7885;n HEADPICS...</option>${HEADPICS.map(([name,id])=>`<option value="${id}" ${t.id===id?'selected':''}>${name} &mdash; ${id}</option>`).join('')}</select></td><td>${t.file?`<span style="color:#67e66f">${original?'Gi&#7919; nguy&#234;n logo g&#7889;c':'Avatar tr&#242;n c&#243; khung'} &middot; ${esc(t.avatar||t.id)}</span>`:'<span style="color:#f5c451">Ch&#432;a c&#243; logo</span>'}</td><td>${t.file?`<button onclick="downloadOne(${i})">T&#7843;i PNG</button> <button onclick="detach(${i})">B&#7887;</button>`:''}</td></tr>`).join('');
  const free=logos.filter(f=>!teams.some(t=>t.file===f));
  $('unmatched').innerHTML=free.map(f=>`<div class="card"><img src="${f.url}" alt="${esc(f.name)}"><strong class="filename" title="${esc(f.name)}">${esc(f.name)}</strong><div class="team-picker"><select><option value="">Ch&#7885;n team...</option>${teams.map((t,i)=>t.file?'':`<option value="${i}">${esc(t.team)}</option>`).join('')}</select><button onclick="assign('${f.key}',this.previousElementSibling.value)">OK</button></div></div>`).join('')||'<p>Kh&#244;ng c&#243; logo ch&#7901; gh&#233;p.</p>';
  $('tc').textContent=teams.length;$('lc').textContent=logos.length;$('mc').textContent=teams.filter(t=>t.file).length;
}
render=renderHeadpics;

function clearAll(){
  if(!confirm('Xóa toàn bộ bảng team và tất cả logo đã tải lên?'))return;
  for(const logo of logos)if(logo.url)URL.revokeObjectURL(logo.url);
  teams=[];logos=[];$('paste').value='';$('files').value='';$('bar').style.width='0%';$('aiStatus').textContent='Đã xóa toàn bộ bảng và logo. Sẵn sàng cho lượt mới.';render();
}

teams=HEADPICS.map(([avatar,id],i)=>({no:String(i+1),team:avatar,avatar,id,file:null}));
$('aiMatch').onclick=localAutoMatch;$('aiMatch').disabled=false;$('aiStatus').textContent=`AI cục bộ miễn phí · đang nhớ ${logoMemory.length} mẫu logo trên thiết bị này.`;

$('parse').onclick=()=>parseTeams($('paste').value);$('append').onclick=()=>parseTeams($('paste').value,true);$('clear').onclick=clearAll;$('match').onclick=matchNames;$('zip').onclick=downloadZip;$('preserveOriginal').onchange=render;$('files').onchange=e=>addFiles([...e.target.files]);const drop=$('drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files])};render();
