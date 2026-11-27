const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--proxy-server=http://127.0.0.1:9']});
 try {
  const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  const root=path.resolve(__dirname,'../../public');
  const token='synthetic.'+Buffer.from(JSON.stringify({email:'parent@synthetic.invalid',role:'user'})).toString('base64url')+'.synthetic';
  await page.clock.install();
  await context.addInitScript(({token})=>{
   localStorage.setItem('userToken',token);localStorage.setItem('isAuth','true');localStorage.setItem('userEmail','parent@synthetic.invalid');localStorage.setItem('userPlan','free');localStorage.setItem('children',JSON.stringify([{name:'Synthetic',age:7}]));
  },{token});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.hostname!=='audit.invalid')return route.abort();
   if(u.pathname.startsWith('/api/')){
    const r=route.request(),body=r.postDataJSON();let data={},status=200;
    requests.push({path:u.pathname,proof:r.headers()['x-parent-authorization']||null});
    if(u.pathname==='/api/verify-token')data={valid:true,user:{plan:'free'}};
    else if(u.pathname==='/api/verify-pin'){
     if(body?.checkOnly)data={pinRequired:true,noPin:false};
     else if(body?.pin==='1234')data={success:true,parentGrant:'synthetic-proof',expiresAt:Date.now()+300000};
     else {status=403;data={error:'Неверный PIN',attemptsLeft:2};}
    }else if(['/api/profile-update','/api/weekly-stats','/api/parent-consent'].includes(u.pathname)){
     if(r.headers()['x-parent-authorization']!=='Bearer synthetic-proof'){status=403;data={code:'PARENT_PIN_REQUIRED'};}
     else if(u.pathname==='/api/profile-update')data={user:{children:[{name:'Synthetic',age:7}],parentName:'Synthetic'}};
     else if(u.pathname==='/api/parent-consent')data={psychologists:[]};
     else data={children:[]};
    }else if(u.pathname==='/api/psychologists-list'||u.pathname==='/api/specialists-list')data=[];
    else {status=503;data={error:'synthetic offline'};}
    return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   }
   try{const f=path.join(root,decodeURIComponent(u.pathname));return route.fulfill({body:fs.readFileSync(f),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}
  });
  await page.goto('http://audit.invalid/parent.html');await page.locator('#pinOverlay').waitFor({state:'visible'});
  assert.equal(await page.locator('#parentCabinet').isVisible(),false);
  await page.locator('#pinInput').fill('0000');await page.locator('#pinSubmitBtn').click();
  await page.getByText('Неверный PIN',{exact:true}).waitFor();assert.equal(await page.locator('#parentCabinet').isVisible(),false);
  await page.locator('#pinInput').fill('1234');await page.locator('#pinSubmitBtn').click();
  await page.locator('#parentCabinet').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('parentCabinet').style.display==='block');
  await page.waitForTimeout(150);
  assert(requests.some(x=>x.path==='/api/profile-update'&&x.proof==='Bearer synthetic-proof'));
  const storage=await page.evaluate(()=>[...Object.keys(localStorage),...Object.keys(sessionStorage)].map(k=>localStorage.getItem(k)||sessionStorage.getItem(k)).join(' '));
  assert(!storage.includes('synthetic-proof'));
  await page.clock.fastForward(301000);await page.locator('#pinOverlay').waitFor({state:'visible'});
  assert.equal(await page.locator('#parentCabinet').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({initialPin:true,wrongPinDenied:true,correctPinUnlocks:true,proofSent:true,proofNotPersisted:true,expiredCabinetHidden:true,errors,network:'all requests routed locally; external blocked; no providers'},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
