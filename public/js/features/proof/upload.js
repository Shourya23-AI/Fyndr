// Photo / PDF handling for proof documents: images are shrunk in the browser before upload.
const b64=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(file)});
export async function shrink(file){
  if(file.type==='application/pdf'){if(file.size>1.5*1024*1024)throw{message:'PDF must be under 1.5 MB'};return{name:file.name,data:await b64(file)}}
  if(!file.type.startsWith('image/'))throw{message:'Upload a photo (JPG, PNG, WebP) or a PDF'};
  const bm=await createImageBitmap(file),k=Math.min(1,1600/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=bm.width*k;c.height=bm.height*k;c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  return{name:file.name.replace(/\.\w+$/,'')+'.jpg',data:c.toDataURL('image/jpeg',.82).split(',')[1]}}
