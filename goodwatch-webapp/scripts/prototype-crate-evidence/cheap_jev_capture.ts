// Offline-cache-aware reproduction of the frozen three-arm Jev attribute experiment.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { interpretEvidencePrototype } from '../../app/server/prototype-jev-vector.server'
const modeArg=process.argv[2]
if(!['control','revised','candidates_only'].includes(modeArg)||process.argv[3]!=='--execute')throw Error('Usage: cheap-jev-capture <control|revised|candidates_only> --execute [private-output-directory]; this makes paid attribute calls for uncached original13 requests')
const dir=process.argv[4]??'scripts/prototype-crate-evidence/private/cheap-loop/jev-paired'
mkdirSync(dir,{recursive:true})
const frozen=JSON.parse(readFileSync('scripts/prototype-crate-evidence/private/interpretations.json','utf8'))
const nativeFetch=globalThis.fetch
const stop=new Set('a an and the but or not no non without with for that this some something any anything to of in on at by my our your i we you it is are be goes go going like want wants very really little lot more less than too also about'.split(' '))
const candidates=(request:string,limit=19)=>{
 const clauses=request.toLowerCase().replace(/[’‘]/g,"'").split(/[,;.!?]|\bbut\b/)
 const groups=clauses.filter(c=>!/^\s*(?:(?:i|we)\s+)?(?:(?:do\s+not|don't|doesn't|wouldn't|would\s+not)\s+(?:want|like)|not|no|non|without|never|nothing|little|less|few|fewer|minimal|low|barely|hardly)\b/.test(c)).map(c=>{
  const words=c.split(/[^a-z0-9'-]+/).filter(w=>w.length>2&&!stop.has(w));return words.flatMap((w,i)=>i+1<words.length?[w,`${w} ${words[i+1]}`]:[w])
 })
 const result:string[]=[]
 for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const g of groups)if(g[i]&&!result.includes(g[i])&&result.length<limit)result.push(g[i])
 return result
}
const output:any[]=[]
for(let i=0;i<frozen.length;i++){
 const original=frozen[i];const arms:any={};const cacheHits=new Set<string>()
 for(const mode of [modeArg]){
  const path=`${dir}/${i}-${mode}.json`
  if(existsSync(path)){arms[mode]=JSON.parse(readFileSync(path,'utf8'));cacheHits.add(mode);continue}
  let raw:any;let chosen:any;let attributeMs=0
  globalThis.fetch=async (url:any,options:any)=>{
   if(String(url)!=='https://api.typesafe.ai/v1/systemone')throw Error('Unexpected network destination')
   const body=JSON.parse(options.body)
   if(Object.keys(body.questions).some(k=>k.startsWith('want:'))){
    const answers:any={};for(const d of original.reading.details){answers[`want:${d.key}`]={type:'noul',noul:Math.max(d.weight/2,0)};answers[`avoid:${d.key}`]={type:'noul',noul:Math.max(-d.weight/2,0)}}
    return new Response(JSON.stringify({answers,usage:{input_tokens:0}}),{status:200})
   }
   body.model='jev-1.13.0'
   if(mode!=='control'&&body.questions.phrase){
    const names=candidates(original.request,mode==='candidates_only'?20:19)
    body.questions.phrase=mode==='candidates_only'?{...body.questions.phrase,criteria:Object.fromEntries(names.map(n=>[n,null]))}:{type:'choice',instructions:'Which option names wanted story content in `request`, excluding rejected content and viewing circumstances? Choose none if none fits.',criteria:{...Object.fromEntries(names.map(n=>[n,null])),none:'No option names wanted story content.'}}
   }
   const start=performance.now();const response=await nativeFetch(url,{...options,body:JSON.stringify(body)});attributeMs=performance.now()-start
   raw=await response.json();chosen=body.questions.phrase
   writeFileSync(`${dir}/${i}-${mode}-attempt.json`,JSON.stringify({request:original.request,mode,model:body.model,body,raw,wall_ms:attributeMs,http_status:response.status},null,2))
   if(!response.ok)throw Error(`Provider failure ${response.status}; attempt preserved, no retry`)
   return new Response(JSON.stringify(raw),{status:200})
  }
  const captured=await interpretEvidencePrototype(original.request)
  captured.reading=original.reading;captured.weights=original.weights;captured.model='jev-1.13.0'
  let noneProbability=0
  if(chosen){
   noneProbability=raw.answers.phrase.probabilities.none??0
   captured.attributes.phrases=Object.keys(chosen.criteria).filter(p=>p!=='none').map(phrase=>({phrase,probability:raw.answers.phrase.probabilities[phrase]??0})).sort((a,b)=>b.probability-a.probability)
   if(mode==='revised'&&raw.answers.phrase.choice==='none')captured.attributes.phrases=[]
  }
  const result={...captured,experiment:{mode,pinned_model:'jev-1.13.0',shared_fingerprint:true,fingerprint_source:'private/interpretations.json',actual_new_cost_usd:captured.attributes.usage.usd,projected_full_runtime_cost_usd:captured.attributes.usage.usd+original.reading.usage.usd,actual_attribute_wall_ms:attributeMs,none_probability:noneProbability,question_count:Object.keys(raw.answers).length}}
  writeFileSync(path,JSON.stringify(result,null,2));arms[mode]=result
 }
 const controlPath=`${dir}/${i}-control.json`;const control=existsSync(controlPath)?JSON.parse(readFileSync(controlPath,'utf8')):null;const captured=arms[modeArg]
 output.push({request:original.request,variant:modeArg,captured,cache_hit:cacheHits.has(modeArg),actual_new_spend_usd:cacheHits.has(modeArg)?0:captured.experiment.actual_new_cost_usd,budget_pass:control?captured.attributes.usage.tokens<=control.attributes.usage.tokens:null,token_delta:control?captured.attributes.usage.tokens-control.attributes.usage.tokens:null})
 writeFileSync(`${dir}/${modeArg}-reproduction.json`,JSON.stringify(output,null,2));console.log(JSON.stringify({case:i+1,budget_pass:output.at(-1).budget_pass,token_delta:output.at(-1).token_delta}))
}
globalThis.fetch=nativeFetch
