const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
const defaultPasswordHash = require('./private/admin-password.json').hash;

const OWNER_ID = '130863341'; // thinhne12345; numeric ID survives username changes.
const SESSION_TTL = 8 * 60 * 60 * 1000;
const STATE_TTL = 10 * 60 * 1000;

function createAdminAuth(env = process.env, request = fetch) {
  const sessions = new Map(), states = new Map(), attempts = new Map();
  const origin = env.APP_ORIGIN || 'https://ff-logo-matcher-1000.onrender.com';
  const secure = !origin.startsWith('http://localhost:');
  const cookieName = secure ? '__Host-ff_admin' : 'ff_admin';
  const stateName = secure ? '__Host-ff_oauth' : 'ff_oauth';
  const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  const passwordHash = env.ADMIN_PASSWORD_HASH ?? defaultPasswordHash;
  const passwordConfigured = /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/i.test(passwordHash);
  const configured = githubConfigured || passwordConfigured;
  const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const token = () => crypto.randomBytes(32).toString('hex');
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')));
  function prune(map) { for (const [key, value] of map) if (value.expires <= Date.now()) map.delete(key); }
  function isAdmin(req) {
    prune(sessions);
    return sessions.has(cookies(req)[cookieName]);
  }
  function respond(res, status, data) {
    res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(JSON.stringify(data));
  }
  function newSession(req) {
    prune(sessions);
    const previous = cookies(req)[cookieName]; if (previous) sessions.delete(previous);
    const session = token(); sessions.set(session,{expires:Date.now()+SESSION_TTL});
    return cookie(cookieName,session,SESSION_TTL/1000);
  }
  async function readLogin(req) {
    let size = 0, parts = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) throw new Error('body');
      parts.push(chunk);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }
  async function handle(req, res, url) {
    if (url.pathname === '/api/admin/session' && req.method === 'GET') {
      respond(res, 200, {admin:isAdmin(req), configured, passwordConfigured, githubConfigured}); return true;
    }
    if (url.pathname === '/api/admin/login') {
      if (req.method !== 'POST') { respond(res,405,{error:'Method not allowed'}); return true; }
      if (req.headers.origin !== origin) { respond(res,403,{error:'Origin không hợp lệ.'}); return true; }
      if (!passwordConfigured) { respond(res,503,{error:'Chưa cấu hình mật khẩu admin.'}); return true; }
      if (!(req.headers['content-type'] || '').startsWith('application/json')) { respond(res,415,{error:'Dữ liệu đăng nhập không hợp lệ.'}); return true; }
      prune(attempts);
      // Use the actual peer, not a spoofable client-supplied forwarded header.
      const peer = req.socket.remoteAddress;
      const attempt = attempts.get(peer) || {count:0,expires:Date.now()+15*60*1000};
      if (attempt.count >= 5 || attempts.size >= 1000) {
        res.setHeader('Retry-After','900'); respond(res,429,{error:'Thử sai quá nhiều lần. Vui lòng chờ 15 phút.'}); return true;
      }
      attempt.count++; attempts.set(peer,attempt);
      let password;
      try { ({password} = await readLogin(req)); }
      catch { respond(res,400,{error:'Dữ liệu đăng nhập không hợp lệ.'}); return true; }
      if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) {
        respond(res,400,{error:'Vui lòng nhập mật khẩu hợp lệ.'}); return true;
      }
      try {
        const [,salt,digest] = passwordHash.split(':');
        const actual = await scrypt(password,salt,64);
        if (!crypto.timingSafeEqual(actual,Buffer.from(digest,'hex'))) {
          respond(res,401,{error:'Mật khẩu admin không đúng.'}); return true;
        }
        attempts.delete(peer);
        res.setHeader('Set-Cookie',newSession(req)); respond(res,200,{admin:true});
      } catch { respond(res,503,{error:'Không thể đăng nhập. Vui lòng thử lại.'}); }
      return true;
    }
    if (url.pathname === '/auth/github' && req.method === 'GET') {
      if (!githubConfigured) { respond(res, 503, {error:'Chưa cấu hình đăng nhập GitHub admin.'}); return true; }
      prune(states);
      if (states.size >= 500) { respond(res, 429, {error:'Vui lòng thử lại sau.'}); return true; }
      const state = token(), verifier = token(); states.set(state, {expires:Date.now() + STATE_TTL, verifier});
      const target = new URL('https://github.com/login/oauth/authorize');
      target.search = new URLSearchParams({client_id:env.GITHUB_CLIENT_ID, redirect_uri:`${origin}/auth/github/callback`, state, scope:'', code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method:'S256'}).toString();
      res.writeHead(302, {'Location':target.href, 'Set-Cookie':cookie(stateName,state,600), 'Cache-Control':'no-store'}); res.end(); return true;
    }
    if (url.pathname === '/auth/github/callback' && req.method === 'GET') {
      prune(states);
      const state = url.searchParams.get('state');
      const valid = githubConfigured && state && cookies(req)[stateName] === state && states.has(state);
      const verifier = states.get(state)?.verifier;
      if (state) states.delete(state);
      res.setHeader('Set-Cookie',cookie(stateName,'',0));
      if (!valid || !url.searchParams.get('code')) { respond(res,400,{error:'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.'}); return true; }
      try {
        const exchange = await request('https://github.com/login/oauth/access_token', {
          method:'POST', headers:{Accept:'application/json','Content-Type':'application/json'},
          body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),code_verifier:verifier,redirect_uri:`${origin}/auth/github/callback`}), signal:AbortSignal.timeout(15000)
        });
        const credentials = await exchange.json();
        if (!exchange.ok || !credentials.access_token) throw new Error('exchange');
        const profile = await request('https://api.github.com/user', {headers:{Authorization:`Bearer ${credentials.access_token}`,Accept:'application/vnd.github+json','User-Agent':'ff-logo-matcher'},signal:AbortSignal.timeout(15000)});
        const user = await profile.json();
        if (!profile.ok) throw new Error('profile');
        if (String(user.id) !== OWNER_ID) { respond(res,403,{error:'Mẫu 01 chỉ dành cho tài khoản admin thinhne12345.'}); return true; }
        res.writeHead(302, {Location:'/', 'Set-Cookie':[cookie(stateName,'',0),newSession(req)], 'Cache-Control':'no-store'}); res.end();
      } catch { respond(res,502,{error:'Không thể xác minh GitHub. Vui lòng thử lại.'}); }
      return true;
    }
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
      if (req.headers.origin !== origin) { respond(res,403,{error:'Origin không hợp lệ.'}); return true; }
      sessions.delete(cookies(req)[cookieName]);
      res.setHeader('Set-Cookie',cookie(cookieName,'',0)); respond(res,200,{admin:false}); return true;
    }
    return false;
  }
  return {handle,isAdmin};
}
module.exports = {createAdminAuth};
