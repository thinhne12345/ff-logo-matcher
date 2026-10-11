const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createServer}=require('../server');

async function fixture(t,userId=130863341,configured=true) {
  const key=crypto.randomBytes(32),nonce=crypto.randomBytes(12);
  const plaintext=Buffer.from('private-test-image');
  const cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const frameAsset=Buffer.concat([nonce,cipher.getAuthTag(),encrypted]);
  let lastExchange;
  const server=createServer({env:{APP_ORIGIN:'http://localhost:3000',GITHUB_CLIENT_ID:configured?'test-client':'',GITHUB_CLIENT_SECRET:configured?'test-secret':'',FRAME_ASSET_KEY:key.toString('hex')},frameAsset,
    fetch:async(url,options)=>{
      if(url.endsWith('/access_token')){lastExchange=JSON.parse(options.body);return {ok:true,json:async()=>({access_token:'test-token'})};}
      assert.equal(options.headers.Authorization,'Bearer test-token');
      return {ok:true,json:async()=>({id:userId,login:'untrusted-display-name'})};
    }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const get=(route,options={})=>fetch(base+route,{redirect:'manual',...options});
  async function begin(){
    const response=await get('/auth/github');
    const target=new URL(response.headers.get('location'));
    return {state:target.searchParams.get('state'),challenge:target.searchParams.get('code_challenge'),cookie:response.headers.getSetCookie()[0].split(';')[0]};
  }
  async function login(){const flow=await begin();return get(`/auth/github/callback?code=test&state=${flow.state}`,{headers:{cookie:flow.cookie}});}
  return {get,begin,login,plaintext,exchange:()=>lastExchange};
}

test('anonymous users cannot fetch private files or bypass admin with forged flags',async t=>{
  const {get}=await fixture(t);
  assert.equal((await get('/api/admin/session')).status,200);
  for(const route of ['/api/admin/frame-01.png','/api/admin/frame-01.png?admin=true']){
    const response=await get(route,{headers:{cookie:'ff_admin=true; admin=true'}});
    assert.equal(response.status,403);assert.match(response.headers.get('cache-control'),/no-store/);
  }
  for(const route of ['/.env','/server.js','/admin-auth.js','/private/frame-01.enc','/%2eenv','/..%2f.env','/tests/admin.test.js']) assert.equal((await get(route)).status,404,route);
  assert.equal((await get('/%zz')).status,400);
  for(const route of ['/','/app.js','/admin-ui.js','/styles.css'])assert.equal((await get(route)).status,200);
});
test('only exact GitHub numeric owner ID is accepted',async t=>{
  const {get,login}=await fixture(t,12345);
  assert.equal((await login()).status,403);
  assert.equal((await get('/api/admin/frame-01.png')).status,403);
});
test('owner login, PKCE, frame decryption and logout revocation',async t=>{
  const {get,begin,plaintext,exchange}=await fixture(t);
  const flow=await begin();
  const callback=await get(`/auth/github/callback?state=${flow.state}&code=test`,{headers:{cookie:flow.cookie}});
  assert.equal(callback.status,302);
  assert.equal(crypto.createHash('sha256').update(exchange().code_verifier).digest('base64url'),flow.challenge);
  const session=callback.headers.getSetCookie().find(c=>c.startsWith('ff_admin='));
  assert.match(session,/HttpOnly/);assert.match(session,/SameSite=Lax/);
  const headers={cookie:session.split(';')[0]};
  assert.equal((await (await get('/api/admin/session',{headers})).json()).admin,true);
  const frame=await get('/api/admin/frame-01.png',{headers});
  assert.equal(frame.status,200);assert.equal(frame.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await frame.arrayBuffer()),plaintext);
  assert.equal((await get('/api/admin/logout',{method:'POST',headers:{...headers,origin:'https://evil.example'}})).status,403);
  assert.equal((await get('/api/admin/logout',{method:'POST',headers:{...headers,origin:'http://localhost:3000'}})).status,200);
  assert.equal((await get('/api/admin/frame-01.png',{headers})).status,403);
  assert.equal((await get(`/auth/github/callback?state=${flow.state}&code=test`,{headers:{cookie:flow.cookie}})).status,400);
});
test('OAuth rejects missing cookie, invalid state and missing configuration',async t=>{
  const {get,begin}=await fixture(t);
  const flow=await begin();
  assert.equal((await get(`/auth/github/callback?state=${flow.state}&code=test`)).status,400);
  assert.equal((await get('/auth/github/callback?state=forged&code=test',{headers:{cookie:flow.cookie}})).status,400);
  const disabled=await fixture(t,130863341,false);
  assert.equal((await disabled.get('/auth/github')).status,503);
});
test('complete logo fits inside circular medallion for square, portrait and landscape',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../admin-ui.js'),'utf8').replace(/initAdmin\(\);\s*$/,'');
  const context=vm.createContext({}); vm.runInContext(source,context);
  for(const [width,height] of [[1254,1254],[2000,300],[200,1600]]){
    const result=context.fitLogoInsideCircle(width,height,363);
    assert.ok(Math.hypot(result.width/2,result.height/2)<=363.000001);
    assert.ok(Math.abs(result.width/result.height-width/height)<1e-10);
  }
});
