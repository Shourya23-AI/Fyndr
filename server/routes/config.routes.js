const {R}=require('../lib/router');
const {cfg,PHONE_EMAIL_CLIENT_ID}=require('../config');
R('GET','/api/firebase-config',null,()=>cfg);
// The phone.email Client ID is not a secret (it is part of the login popup URL), so the browser may read it.
R('GET','/api/phone-config',null,()=>({clientId:PHONE_EMAIL_CLIENT_ID||null}));
