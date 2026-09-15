import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const b=await chromium.launch();
const boyutlar=[
  ['iPhone 15 Pro dikey (Safari)', 393, 659],
  ['iPhone 15 Pro dikey (dar)', 393, 600],
  ['iPhone SE dikey', 375, 553],
  ['iPhone 15 Pro yatay', 852, 320],
];
for(const [ad,w,h] of boyutlar){
  const ctx=await b.newContext({viewport:{width:w,height:h}, isMobile:true, hasTouch:true, deviceScaleFactor:3});
  const p=await ctx.newPage();
  await p.goto('http://localhost:3420');
  await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{
    const btn=document.getElementById('joinBtn');
    const rect=btn.getBoundingClientRect();
    const join=document.getElementById('join');
    return {
      ekranda: rect.top>=0 && rect.bottom<=innerHeight,
      kaydirilabilir: join.scrollHeight > join.clientHeight,
      btnAlt: Math.round(rect.bottom), vh: innerHeight,
    };
  });
  // kaydirip tiklanabiliyor mu
  await p.evaluate(()=>document.getElementById('join').scrollTo(0,99999));
  await p.waitForTimeout(300);
  const sonra=await p.evaluate(()=>{
    const rect=document.getElementById('joinBtn').getBoundingClientRect();
    return rect.top>=0 && rect.bottom<=innerHeight;
  });
  console.log(ad.padEnd(30), JSON.stringify(r), '| kaydırınca görünür:', sonra);
  await ctx.close();
}
await b.close(); process.exit(0);
