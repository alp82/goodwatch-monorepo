/* THROWAWAY: offline ranking hypotheses. No title/query identity branches. */
const fs = require('node:fs');
const path = require('node:path');
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const defaults = {family:'blend', coverageMix:.3, weighted:true, topFraction:1, strengthPower:1,
  evidenceMood:.15,evidenceConcrete:.6,evidenceCap:3,evidenceTransform:'linear',combine:'textfirst',
  penalty:0,threshold:6,softWidth:2};

// Explicit legacy: freezes original source fingerprints, membership and pool normalization.
function legacy(cap,id) {
  const main=id==='legacy-main', used=cap.used;
  const lo=used.reduce((s,[,w])=>s+Math.min(w,0)*10,0),hi=used.reduce((s,[,w])=>s+Math.max(w,0)*10,0);
  const concrete=Boolean(cap.phrases?.[0]?.concrete);
  const norm=(v,l,h)=>h===l?0:(v-l)/(h-l);
  function score(rows,text){
    for(const r of rows){r.ws=used.reduce((s,[k,w])=>s+w*(r.fp[k]??0),0);r.hits=used.reduce((s,[k,w])=>s+Number(w>0?(r.fp[k]??0)>=6:(r.fp[k]??0)<=4),0);}
    const min=Math.min(...rows.map(r=>r.ws)),max=Math.max(...rows.map(r=>r.ws));
    const cmin=Math.min(...rows.map(r=>r.cosine??0)),cmax=Math.max(...rows.map(r=>r.cosine??0));
    for(const r of rows){
      r.primaryScore=main?norm(r.ws,min,max):r.hits;
      r.tieScore=main?.01*norm(r.cosine??0,cmin,cmax):.25*norm(r.ws,lo,hi);
      r.ev=text?Math.min((main?.5:concrete?1:.5)*Math.min(r.text??0,4),main?3:concrete?3:1):0;
      r.coreScore=0;r.score=r.primaryScore+r.tieScore+r.ev;
    }
    return rows.sort((a,b)=>b.score-a.score);
  }
  const textKeys=new Set(cap.textPool.map(r=>r.key));
  const t=score(cap.textPool.map(r=>({...r,cosine:null,inT:true,inV:false,fpSource:'text'})),true);
  const v=score(cap.vectorPool.filter(r=>!textKeys.has(r.key)).map(r=>({...r,inV:true,inT:false,text:0,fpSource:'vector'})),false);
  return t.length>=100?t:[...t,...v];
}
function candidates(cap) {
  const rows=new Map(cap.vectorPool.map(r=>[r.key,{...r,inV:true,inT:false,text:0,fpSource:'vector'}]));
  for(const r of cap.textPool)rows.set(r.key,{...rows.get(r.key),...r,inV:rows.has(r.key),inT:true,fpSource:'text'});
  return [...rows.values()];
}
function dimensions(cap,cfg){
  const sorted=cap.used.filter(([,w])=>w!==0).slice().sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  return sorted.slice(0,Math.max(1,Math.ceil(sorted.length*cfg.topFraction)));
}
function features(row,used,cfg) {
  let strength=0,coverage=0,soft=0,deficit=0,mass=0;
  for(const [key,w] of used){
    const v=clamp(row.fp[key]??0,0,10),aligned=w>0?v:10-v,weight=cfg.weighted?Math.abs(w):1;
    strength+=weight*Math.pow(aligned/10,cfg.strengthPower);
    coverage+=weight*(aligned>=cfg.threshold?1:0);
    soft+=weight*clamp((aligned-(cfg.threshold-cfg.softWidth))/(2*cfg.softWidth));
    deficit+=weight*Math.pow(Math.max(0,cfg.threshold-aligned)/cfg.threshold,2);
    mass+=weight;
  }
  return {strength:strength/mass,coverage:coverage/mass,soft:soft/mass,deficit:deficit/mass};
}
function rank(cap,input={}) {
  if(input.family==='legacy')return legacy(cap,input.id);
  const cfg={...defaults,...input}, used=dimensions(cap,cfg), concrete=Boolean(cap.phrases?.[0]?.concrete);
  let rows=candidates(cap),combine=cfg.combine==='auto'?(concrete?'textfirst':'union'):cfg.combine;
  if(combine==='vector')rows=rows.filter(r=>r.inV);
  if(combine==='text')rows=rows.filter(r=>r.inT);
  const textCount=rows.filter(r=>r.inT).length;
  if(combine==='textfirst'&&textCount>=100)rows=rows.filter(r=>r.inT);
  for(const r of rows){
    const f=features(r,used,cfg); let primary;
    if(cfg.family==='strength')primary=f.strength;
    else if(cfg.family==='coverage')primary=f.coverage;
    else if(cfg.family==='soft')primary=(1-cfg.coverageMix)*f.strength+cfg.coverageMix*f.soft;
    else if(cfg.family==='product')primary=Math.sqrt(Math.max(0,f.strength*f.coverage));
    else primary=(1-cfg.coverageMix)*f.strength+cfg.coverageMix*f.coverage;
    let evidence=Math.min(cfg.evidenceCap,Math.max(0,r.text??0));
    if(cfg.evidenceTransform==='round')evidence=Math.round(evidence);
    if(cfg.evidenceTransform==='floor')evidence=Math.floor(evidence);
    if(cfg.evidenceTransform==='log')evidence=Math.log1p(evidence);
    if(cfg.evidenceTransform==='binary')evidence=Number(evidence>0);
    const ev=evidence*(concrete?cfg.evidenceConcrete:cfg.evidenceMood);
    const core=clamp(cap.coreEvidence?.[r.key]??0)*(cfg.coreWeight??0);
    r.features=f;r.primaryScore=primary-cfg.penalty*f.deficit;r.ev=ev;r.coreScore=core;r.score=r.primaryScore+ev+core;
  }
  rows.sort((a,b)=>((combine==='textfirst'&&textCount<100)?Number(b.inT)-Number(a.inT):0)||b.score-a.score||b.features.strength-a.features.strength||a.key.localeCompare(b.key));
  return rows;
}
const configs = [
 {id:'legacy-main',name:'Legacy main approximation',family:'legacy'},
 {id:'legacy-leads',name:'Legacy concrete leads',family:'legacy'},
 {id:'strength-intent',name:'Strength + bounded mood evidence',family:'strength',evidenceMood:.1,evidenceConcrete:.3},
 {id:'coverage-blend',name:'Weighted coverage / strength blend',family:'blend',coverageMix:.2,evidenceMood:.1,evidenceConcrete:.3},
 {id:'soft-deficit',name:'Strength with soft deficit penalty',family:'strength',penalty:.3,evidenceMood:.1,evidenceConcrete:.3},
 {id:'selective-strength',name:'Highest-weight half of dimensions',family:'blend',topFraction:.5,coverageMix:.2,evidenceMood:.1,evidenceConcrete:.55},
 {id:'rounded-evidence',name:'Rounded evidence + attribute strength',family:'strength',evidenceTransform:'round',evidenceMood:.1,evidenceConcrete:.3},
 {id:'soft-coverage',name:'Soft weighted coverage blend',family:'soft',coverageMix:.5,evidenceMood:.1,evidenceConcrete:.55},
 {id:'log-evidence',name:'Strength + diminishing text evidence',family:'strength',evidenceTransform:'log',evidenceMood:.1,evidenceConcrete:.55},
 {id:'nonlinear-strength',name:'Emphasize strong attributes',family:'strength',strengthPower:1.5,evidenceMood:.1,evidenceConcrete:.55}
];
module.exports={rank,configs,defaults,candidates,features};
if(require.main===module && !process.argv.includes('--sweep')){
 const cap=JSON.parse(fs.readFileSync(path.join(__dirname,'../capture.json'),'utf8'));
 console.log(JSON.stringify(configs.map(cfg=>({id:cfg.id,queries:cap.map(c=>({query:c.query,top:rank(c,cfg).slice(0,10).map(r=>({key:r.key,title:c.titles[r.key]?.title,score:r.score}))}))})),null,2));
}

// DEVELOPMENT DIAGNOSTIC ONLY. These pre-existing familiar examples are not relevance ground truth.
const developmentAnchors={
 'complete nonsense':{positive:['show:1229','show:251'],negative:['show:129959','movie:278924']},
 'tarkovsky':{positive:['movie:1398','movie:1483']},
 'feel good cooking show':{positive:['show:114574','show:76305','show:106694']},
 'slow burn space horror':{positive:['movie:376865','movie:594718','movie:8413']},
 'tense heist thriller, not bleak':{positive:['movie:75656','movie:388']},
 'grief after losing a child':{positive:['movie:334541','movie:27585']},
 'furious':{positive:['movie:545609','movie:1160018','movie:94329']},
 'craty':{positive:['show:6024','show:9826']},
 'melancholy lighthouse keeper mystery':{positive:['movie:503919']},
 'scifi with cars':{positive:['movie:10483']},
 'sunglasses at night':{positive:['movie:8337']},
 'fantasy with dragons':{positive:['movie:10191','movie:57158','show:94997']},
 'like groundhog day':{positive:['movie:137','movie:587792']},
 'time travel complex':{positive:['movie:206487','movie:14337']}
};
function evaluateDevelopment(captures,cfg){
 let score=0,badTop10=0;const perQuery={};
 for(const c of captures){const rows=rank(c,cfg),ranks=new Map(rows.map((r,i)=>[r.key,i+1])),a=developmentAnchors[c.query];
  if(!a)continue;const targetRanks=Object.fromEntries(a.positive.map(key=>[key,ranks.get(key)??null]));
  const discount=a.positive.reduce((s,key)=>s+(ranks.has(key)?1/Math.log2(ranks.get(key)+1):0),0)/a.positive.length;
  const negatives=Object.fromEntries((a.negative??[]).map(key=>[key,ranks.get(key)??null]));
  badTop10+=Object.values(negatives).filter(r=>r&&r<=10).length;score+=discount;
  perQuery[c.query]={discount,targetRanks,negatives};
 }
 return {proxyMeanDiscount:score/Object.keys(perQuery).length,badTop10,perQuery};
}
module.exports.evaluateDevelopment=evaluateDevelopment;
if(require.main===module && process.argv.includes('--sweep')){
 const captures=JSON.parse(fs.readFileSync(path.join(__dirname,'../capture.json'),'utf8'));
 const settings=[];
 const families=[{family:'strength'},{family:'blend',coverageMix:.2},{family:'blend',coverageMix:.5},
  {family:'soft',coverageMix:.5},{family:'strength',penalty:.3},{family:'strength',strengthPower:1.5},
  {family:'blend',coverageMix:.2,topFraction:.5},{family:'product'},
  {family:'strength',evidenceTransform:'round'},{family:'strength',evidenceTransform:'floor'},
  {family:'strength',evidenceTransform:'binary'},{family:'strength',evidenceTransform:'log'}];
 for(const shape of families)for(const evidenceMood of [0,.05,.1,.2])for(const evidenceConcrete of [.15,.3,.55,.8,1.2]){
  settings.push({...shape,evidenceMood,evidenceConcrete,id:`sweep-${settings.length}`});
 }
 const results=settings.map(cfg=>({cfg,...evaluateDevelopment(captures,cfg)}));
 results.sort((a,b)=>a.badTop10-b.badTop10||b.proxyMeanDiscount-a.proxyMeanDiscount);
 const report={warning:'DEVELOPMENT proxy only: familiar anchor exposure, no graded relevance labels, no confidence claims.',candidates:settings.length,anchors:developmentAnchors,baseline:configs.filter(c=>c.family==='legacy').map(cfg=>({cfg,...evaluateDevelopment(captures,cfg)})),results};
 fs.writeFileSync(path.join(__dirname,'scoring-sweep.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(results.slice(0,15).map(({cfg,proxyMeanDiscount,badTop10})=>({cfg,proxyMeanDiscount,badTop10})),null,2));
}
