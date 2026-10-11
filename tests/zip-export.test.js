const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');

function fixture() {
  const elements = new Map(), alerts = [], saved = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'',checked:false,disabled:false,style:{},classList:{toggle(){},add(){},remove(){}}});
    return elements.get(id);
  };
  const context = vm.createContext({
    document:{getElementById:element,documentElement:{style:{setProperty(){}}}},
    localStorage:{getItem(){},setItem(){},removeItem(){}},
    URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},
    Blob, TextEncoder, Uint8Array, DataView, setTimeout,
    alert:message=>alerts.push(message),
  });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
  vm.runInContext(`
    teams=HEADPICS.slice(0,7).map(([avatar,id],i)=>({avatar,id,file:{index:i}}));
    save=(blob,name)=>saved.push({blob,name});
    getFrameMode=()=> 'admin-01';
    let active=0,peak=0,frameCalls=0,fail=false;
    adminFrameImage=async()=>({call:++frameCalls});
    makePng=async(file,preserve,bg,mode,frame)=>{
      if(!preserve && frame.call!==frameCalls)throw new Error('Missing batch frame');
      active++;peak=Math.max(peak,active);
      try {
        await new Promise(resolve=>setTimeout(resolve,(3-file.index%3)*3));
        if(fail && file.index===1)throw new Error('PNG failed');
        return new Blob([new Uint8Array([file.index,123,255])]);
      } finally {active--;}
    };
    globalThis.stats=()=>({active,peak,frameCalls});
    globalThis.setFailure=value=>{fail=value;};
  `,Object.assign(context,{saved}));
  return {context,elements,alerts,saved};
}

test('ZIP exports concurrently with one fresh authenticated frame and keeps ID/content order',async()=>{
  const {context,elements,alerts,saved}=fixture();
  await context.downloadZip();
  assert.equal(context.stats().frameCalls,1);
  assert.equal(context.stats().peak,3);
  assert.equal(context.stats().active,0);
  assert.equal(alerts.length,0);
  assert.equal(elements.get('zip').disabled,false);
  assert.equal(elements.get('bar').style.width,'100%');
  const bytes=Buffer.from(await saved[0].blob.arrayBuffer());
  const ids=['902000006','902000007','902000008','902000009','902000010','902000012','902000030'];
  let offset=0;
  for(let i=0;i<ids.length;i++){
    assert.equal(bytes.readUInt32LE(offset),0x04034b50);
    const length=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26);
    assert.equal(bytes.toString('utf8',offset+30,offset+30+nameLength),ids[i]+'.png');
    const data=bytes.subarray(offset+30+nameLength,offset+30+nameLength+length);
    assert.deepEqual([...data],[i,123,255]);
    assert.equal(bytes.readUInt32LE(offset+14),context.crc32(data));
    offset+=30+nameLength+length;
  }
  assert.equal(bytes.readUInt32LE(offset),0x02014b50);
  assert.equal(bytes.readUInt16LE(bytes.length-12),7);
  await context.downloadZip();
  assert.equal(context.stats().frameCalls,2);
});

test('failed export waits for active work, saves no partial ZIP and can retry',async()=>{
  const {context,elements,alerts,saved}=fixture();
  context.setFailure(true);
  await context.downloadZip();
  assert.equal(context.stats().active,0);
  assert.equal(saved.length,0);
  assert.equal(alerts.length,1);
  assert.equal(elements.get('zip').disabled,false);
  context.setFailure(false);
  await context.downloadZip();
  assert.equal(saved.length,1);
});

test('original logo export skips private frame requests',async()=>{
  const {context,elements,saved}=fixture();
  elements.get('preserveOriginal').checked=true;
  await context.downloadZip();
  assert.equal(context.stats().frameCalls,0);
  assert.equal(saved.length,1);
});
