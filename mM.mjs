import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:880}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('403'))errs.push(m.text())});
p.on('dialog',d=>d.accept());
await p.goto('http://localhost:3450');
await p.fill('#nameInput','EMREZL'); await p.click('#joinBtn');
await p.waitForTimeout(3200);
await p.click('[data-bot="fill"]'); await p.waitForTimeout(1400);
await p.click('#autoBalanceBtn'); await p.waitForTimeout(400);
await p.click('#settingsBtn'); await p.waitForTimeout(400);
await p.evaluate(()=>{
  const set=(s,v)=>{const e=document.querySelector(s); if(e){e.value=v; e.dispatchEvent(new Event('change',{bubbles:true}));}};
  set('[data-timer="reveal"]',5); set('[data-timer="night"]',40); set('[data-timer="nightResult"]',14);
  const fd=document.querySelector('[data-flag="firstDayTalk"]');
  if(fd&&fd.checked){fd.checked=false; fd.dispatchEvent(new Event('change',{bubbles:true}));}
  document.getElementById('closeSettings').click();
});
await p.waitForTimeout(600);
await p.click('#readyBtn');

// gece süresi gerçekten doluyor mu
let t0=null,t1=null;
for(let i=0;i<120;i++){
  const st=await p.evaluate(()=>({f:window.__lastState?.phase, t:window.__lastState?.timeLeft}));
  if(st.f==='night' && t0===null) t0=Date.now();
  if(st.f==='night_result' && t0!==null){ t1=Date.now(); break; }
  await p.waitForTimeout(400);
}
console.log('gece süresi:', t1&&t0 ? ((t1-t0)/1000).toFixed(0)+' sn' : 'ölçülemedi');

// sabah bildirimi ve vasiyet sırası
const seritte = await p.textContent('#banner');
console.log('sabah bildirimi:', seritte.slice(0,120));
const probe = await p.evaluate(()=>({
  faz: window.__lastState?.phase,
  ozet: (window.__lastState?.nightSummary??[]).map(x=>({k:x.kind, id:!!x.playerId, w:x.will?.text?.slice(0,20)})),
}));
console.log('probe:', JSON.stringify(probe));
const acikHemen = await p.evaluate(()=>!document.getElementById('willReveal').hidden);
await p.waitForTimeout(3200);
const acikSonra = await p.evaluate(()=>({
  acik:!document.getElementById('willReveal').hidden,
  kim:document.getElementById('willWho').textContent }));
console.log('vasiyet hemen acildi mi:', acikHemen, '| 3 sn sonra:', acikSonra);
await p.screenshot({path:'/tmp/m_morn.png'});
console.log('hatalar:', errs.length?errs.slice(0,3):'yok');
await b.close(); process.exit(0);
