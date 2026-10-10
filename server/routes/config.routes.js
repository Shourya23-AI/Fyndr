const {R}=require('../lib/router');
const {cfg}=require('../config');
R('GET','/api/firebase-config',null,()=>cfg);
