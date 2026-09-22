/* THROWAWAY: explicit lexical core evidence, not a learned semantic relevance grade.
 * Uses captured first-phrase interpretation and catalog text. Never branches on a query or title ID.
 * Absence of mention means no boost; it does not establish that a requested feature is absent.
 */
const fs=require('node:fs');
const STOP=new Set('a an the with without and or of in on at to for from after before by about like something movie movies film films'.split(' '));
const GROUPS=[
 ['scifi','sciencefiction','science-fiction','sci-fi'],
 ['cook','cooking','cooked','cooks','culinary','chef','chefs','cuisine'],
 ['car','cars','automobile','automobiles','automotive','vehicle','vehicles'],
 ['child','children','kid','kids','son','daughter','infant'],
 ['loss','losing','lost','lose','death','dead','die','dies','died','bereavement'],
 ['space','spacecraft','spaceship','spaceships','astronaut','astronauts','interstellar'],
 ['heist','heists','robbery','robberies','robber','robbers'],
 ['dragon','dragons'],['travel','travels','travelling','traveling','travelled','traveled'],
 ['sunglass','sunglasses'],['keeper','keepers'],['show','shows','series']
];
const canonical=new Map(GROUPS.flatMap(group=>group.map(term=>[term,group[0]])));
function tokens(text){
 return String(text??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/science[ -]fiction|sci[ -]fi/g,' scifi ').match(/[a-z0-9]+/g)?.map(t=>canonical.get(t)??(t.length>4&&t.endsWith('s')?t.slice(0,-1):t)).filter(t=>!STOP.has(t))??[];
}
function flatten(value){if(value==null)return '';if(Array.isArray(value))return value.map(flatten).join(' ');if(typeof value==='object')return Object.values(value).map(flatten).join(' ');return String(value);}
function termsFor(cap){
 // A title analogy is not a literal request for the words in the reference title.
 if(!cap.phrases?.[0]?.concrete||/^\s*(like|similar to)\b/i.test(cap.query))return [];
 return [...new Set(tokens(cap.phrases[0].phrase))];
}
function score(cap,record,key){
 const terms=termsFor(cap);if(!terms.length||!record)return {score:0,terms,matched:[],missing:terms,enabled:terms.length>0};
 const title=new Set(tokens(record.title)), synopsis=new Set(tokens(record.synopsis)),
  descriptive=new Set(tokens([flatten(record.essence_text),flatten(record.essence_tags),flatten(record.keywords),flatten(record.genres)].join(' ')));
 if(key.startsWith('show:')){synopsis.add('show');descriptive.add('show');}
 const support=terms.map(term=>({term,weight:synopsis.has(term)?1:descriptive.has(term)?.8:title.has(term)?.35:0,
  source:synopsis.has(term)?'synopsis/type':descriptive.has(term)?'essence/tags/genres':title.has(term)?'title':'unmentioned'}));
 const coverage=support.reduce((sum,t)=>sum+t.weight,0)/terms.length;
 // Reward joint coverage more than one incidental word; title-only evidence remains weak.
 const joint=support.every(t=>t.weight>0)?Math.min(...support.map(t=>t.weight)):0;
 return {score:.5*coverage+.5*joint,terms,matched:support.filter(t=>t.weight>0).map(t=>t.term),missing:support.filter(t=>!t.weight).map(t=>t.term),support,enabled:true};
}
function enrich(capture,catalog){
 return capture.map(cap=>{const coreEvidence={},coreDetails={};for(const key of new Set([...cap.vectorPool,...cap.textPool].map(r=>r.key))){const result=score(cap,catalog.records[key],key);coreEvidence[key]=result.score;coreDetails[key]=result;}return {...cap,coreEvidence,coreDetails};});
}
module.exports={tokens,termsFor,score,enrich};
if(require.main===module){
 const path=require('node:path'),here=__dirname;
 const capture=JSON.parse(fs.readFileSync(path.join(here,'../capture.json'),'utf8'));
 const raw=path.join(here,'catalog.json');
 const catalog=JSON.parse(fs.existsSync(raw)?fs.readFileSync(raw,'utf8'):require('node:zlib').gunzipSync(fs.readFileSync(raw+'.gz')).toString());
 const enriched=enrich(capture,catalog);
 fs.writeFileSync(path.join(here,'core-evidence.json'),JSON.stringify({catalogSha256:catalog.catalogSha256,queries:enriched.map(c=>({query:c.query,terms:termsFor(c),scores:c.coreEvidence}))}));
 console.log(enriched.map(c=>({query:c.query,terms:termsFor(c),supported:Object.values(c.coreEvidence).filter(v=>v>=.5).length})));
}
