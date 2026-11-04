import {initialize,search,cards,close} from './engine'
import {writeFileSync} from 'node:fs'
const results:any[]=[]
try {
 console.log('initialize',await initialize())
 for(const input of [
  {query:'Historical Action'},
  {query:'historical action',existing:'themes=war'},
  {query:'historical action',existing:'type=show'},
  {query:'historical action without warfare'},
  {query:'1917'},
 ]) {
  const r=await search(input)
  results.push({input,branch:r.branch,baseline:r.baseline,v7:r.v7,params:r.params,timing:r.timing})
  console.log(JSON.stringify({input,branch:r.branch,baseline:r.baseline.total,v7:r.v7.total,prefix:r.baseline.bestRated.keys.every((k,i)=>r.v7.bestRated.keys[i]===k),head:r.v7.relevance.keys.slice(0,5)}))
  if(input.query==='Historical Action'){
   if(r.baseline.total!==8||r.v7.total!==78)throw Error('Historical Action expected baseline8/V7 78')
   if(!r.baseline.bestRated.keys.every((k,i)=>r.v7.bestRated.keys[i]===k))throw Error('Original eight BestRated prefix changed')
   console.log('cards',JSON.stringify((await cards(r.v7.relevance.keys.slice(0,3))).map(c=>({key:c.key,title:c.title,poster:c.poster,score:c.score}))))
  }
  if(input.query.includes('without warfare')&&(JSON.stringify(r.baseline.relevance)!==JSON.stringify(r.v7.relevance)||JSON.stringify(r.baseline.bestRated)!==JSON.stringify(r.v7.bestRated)))throw Error('Negative baseline changed')
  if(input.query==='1917'&&r.v7.relevance.keys[0]!==1000000530915)throw Error('1917 title guard failed')
 }
 writeFileSync('/tmp/goodwatch-preview-backend-check.json',JSON.stringify(results,null,2))
 console.log('checks passed')
}finally{await close()}
