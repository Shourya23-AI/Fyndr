const fs=require('fs');
const {DB_FILE}=require('../config');
const {uid}=require('../lib/helpers');
// JSON-file database. `db` is loaded (or seeded) once; call save() after changing it.
let db;try{db=JSON.parse(fs.readFileSync(DB_FILE))}catch{db=null}
const save=()=>fs.writeFileSync(DB_FILE,JSON.stringify(db,null,1));
if(!db){
  const org={id:'seed-org',name:'Linear HR',email:'',role:'org',orgName:'Linear',verified:true,created:new Date().toISOString()};
  const L=(title,type,location,pay,description)=>({id:uid(),orgId:org.id,orgName:'Linear',title,type,location,pay,description,status:'approved',created:new Date().toISOString()});
  db={users:[org],listings:[
    L('Product Design Intern','Internship','Remote · Worldwide','$2,000–$3,000 / month','Work with our design team on real product features.'),
    L('Junior Frontend Developer','Job','New York, NY · Hybrid','$75K–$95K / year','Build and ship UI with React and TypeScript.'),
    L('Data Analytics Certificate','Course','Online · Self-paced','$14 / month','Learn SQL, spreadsheets and dashboards.')],
    applications:[],saved:[]};
  save();
}
module.exports={db,save};
