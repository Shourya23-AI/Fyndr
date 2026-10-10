// Zero-dependency Node server: static files + JSON API + role-based auth (user / org / admin)
const http=require('http');
const {PORT}=require('./config');
require('./routes');
const handleApi=require('./http/api-handler'),serveStatic=require('./http/static');
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  if(u.pathname.startsWith('/api/'))return handleApi(req,res,u);
  serveStatic(res,u);
}).listen(PORT,()=>console.log('Fyndr running on http://localhost:'+PORT));
