const fs=require('fs'),path=require('path');
const {PUB}=require('../config');
const types={'.html':'text/html','.json':'application/json','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
// Serves public/ and falls back to index.html for unknown paths (single-page app).
module.exports=function serveStatic(res,u){
  let f=path.join(PUB,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(PUB,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(res);
};
