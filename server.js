const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('node:crypto');
const {createAdminAuth}=require('./admin-auth');
const root=__dirname;
const envFile=path.join(root,'.env');
if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'')}
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8'};

function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json;charset=utf-8'});res.end(JSON.stringify(data))}
function readBody(req,limit=16*1024*1024){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(new Error('Ảnh quá lớn'));req.destroy();return}parts.push(chunk)});req.on('end',()=>resolve(Buffer.concat(parts).toString('utf8')));req.on('error',reject)})}
function getOutputText(data){for(const item of data.output||[])for(const content of item.content||[])if(content.type==='output_text'&&content.text)return content.text;return ''}

async function aiMatch(req,res){
  if(!process.env.OPENAI_API_KEY)return json(res,503,{error:'Server chưa có OPENAI_API_KEY.'});
  try{
    const body=JSON.parse(await readBody(req));
    if(!body.image||!body.candidates?.length)return json(res,400,{error:'Thiếu ảnh hoặc danh sách HEADPICS.'});
    const allowed=body.candidates.map(x=>`${x.name}=${x.id}`).join(', ');
    const prompt=`Nhận dạng logo và chọn đúng một HEADPICS từ danh sách cho team. Dùng chữ nhìn thấy trong logo, tên file và tên team làm bằng chứng. Chỉ chọn khi hợp lý; nếu không đủ bằng chứng trả id rỗng. Danh sách: ${allowed}. Team: ${body.team||''}. Tên file: ${body.fileName||''}. Chỉ trả JSON: {"id":"","name":"","confidence":0,"reason":""}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-sol',input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:body.image}]}],max_output_tokens:300})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error?.message||'OpenAI API lỗi');
    const text=getOutputText(data).replace(/^```json\s*|\s*```$/g,'').trim();
    const result=JSON.parse(text);
    const valid=body.candidates.find(x=>x.id===String(result.id));
    if(!valid)return json(res,200,{id:'',name:'',confidence:Number(result.confidence)||0,reason:result.reason||'Không đủ bằng chứng'});
    json(res,200,{id:valid.id,name:valid.name,confidence:Number(result.confidence)||0,reason:String(result.reason||'AI nhận dạng')});
  }catch(error){json(res,500,{error:error.message||'AI không xử lý được ảnh.'})}
}

function createServer(options={}) {
const env=options.env||process.env;
const auth=createAdminAuth(env,options.fetch||fetch);
return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  let url;
  try { url=new URL(req.url,'http://localhost'); decodeURIComponent(url.pathname); }
  catch { return json(res,400,{error:'Invalid URL'}); }
  if(await auth.handle(req,res,url))return;
  if(url.pathname==='/api/admin/frame-01.png'){
    res.setHeader('Cache-Control','private, no-store');
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    if(!auth.isAdmin(req))return json(res,403,{error:'Hãy đăng nhập tài khoản admin để dùng mẫu 01.'});
    try {
      if(!/^[a-f0-9]{64}$/i.test(env.FRAME_ASSET_KEY||''))throw new Error('key');
      const data=options.frameAsset||fs.readFileSync(path.join(root,'private','frame-01.enc'));
      const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(env.FRAME_ASSET_KEY,'hex'),data.subarray(0,12));
      decipher.setAuthTag(data.subarray(12,28));
      const image=Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]);
      res.writeHead(200,{'Content-Type':'image/png'});return res.end(image);
    } catch { return json(res,503,{error:'Mẫu 01 chưa được cấu hình trên máy chủ.'}); }
  }
  if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{ai:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-5.6-sol'});
  if(req.method==='POST'&&req.url==='/api/ai-match')return aiMatch(req,res);
  const publicFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/admin-ui.js':'admin-ui.js'};
  const publicFile=publicFiles[url.pathname];
  if(!Object.hasOwn(publicFiles,url.pathname))return res.writeHead(404).end('Not found');
  if(!['GET','HEAD'].includes(req.method))return res.writeHead(405).end();
  const filePath=path.join(root,publicFile);
  fs.readFile(filePath,(error,data)=>{if(error)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':types[path.extname(filePath)]||'application/octet-stream'});res.end(data)});
});
}
if(require.main===module)createServer().listen(process.env.PORT||3000,()=>console.log(`FF Logo Matcher: http://localhost:${process.env.PORT||3000}`));
module.exports={createServer};
