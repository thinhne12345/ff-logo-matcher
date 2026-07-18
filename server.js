const http=require('http');
const fs=require('fs');
const path=require('path');
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

http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{ai:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-5.6-sol'});
  if(req.method==='POST'&&req.url==='/api/ai-match')return aiMatch(req,res);
  const urlPath=req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0].replace(/^\//,''));
  const filePath=path.resolve(root,urlPath);
  if(!filePath.startsWith(path.resolve(root)))return res.writeHead(403).end();
  fs.readFile(filePath,(error,data)=>{if(error)return res.writeHead(404).end('Not found');res.writeHead(200,{'Content-Type':types[path.extname(filePath)]||'application/octet-stream'});res.end(data)});
}).listen(process.env.PORT||3000,()=>console.log(`FF Logo Matcher: http://localhost:${process.env.PORT||3000}`));
