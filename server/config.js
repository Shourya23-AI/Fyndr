// Paths, port and Firebase web config. Everything environment-specific lives here.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const PORT=process.env.PORT||3000,PUB=path.join(ROOT,'public');

// Runtime data (database + uploaded files) lives in data/.
const DATA_DIR=path.join(ROOT,'data'),DB_FILE=path.join(DATA_DIR,'data.json'),UP_DIR=path.join(DATA_DIR,'uploads');
fs.mkdirSync(DATA_DIR,{recursive:true});
// One-time move from the old flat layout (data.json and uploads/ next to server.js) so existing data is kept.
try{
  const oldDb=path.join(ROOT,'data.json'),oldUp=path.join(ROOT,'uploads');
  if(!fs.existsSync(DB_FILE)&&fs.existsSync(oldDb))fs.renameSync(oldDb,DB_FILE);
  if(!fs.existsSync(UP_DIR)&&fs.existsSync(oldUp))fs.renameSync(oldUp,UP_DIR);
}catch(e){console.warn('Could not migrate old data files:',e.message)}

// Firebase web config: config/firebase-config.json (falls back to the old root location)
let cfg={};
for(const f of [path.join(ROOT,'config','firebase-config.json'),path.join(ROOT,'firebase-config.json')]){try{cfg=JSON.parse(fs.readFileSync(f));break}catch{}}

// Built-in admin account (sign up with this email, confirm it, and the account becomes admin). More can be added with ADMIN_EMAILS.
const DEFAULT_ADMINS='fyndr.admin@gmail.com';
const isAdminEmail=e=>(DEFAULT_ADMINS+','+(process.env.ADMIN_EMAILS||'')).toLowerCase().split(',').map(x=>x.trim()).filter(Boolean).includes((e||'').toLowerCase());

module.exports={ROOT,PORT,PUB,DATA_DIR,DB_FILE,UP_DIR,cfg,isAdminEmail};
