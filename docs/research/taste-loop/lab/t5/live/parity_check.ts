// Independent direct production call used by the synthetic parity test.
import { moodsOf } from './prod/domain/moods'
import { readPerson } from './prod/server/taste-portrait/person.server'
import { buildSides } from './prod/server/taste-portrait/sides.server'
import { NO_TASTE } from './stubs/taste'
const c = JSON.parse(await Bun.stdin.text())
const rows = [...c.titles].sort((a,b)=>a.key-b.key)
const at = new Map(rows.map((r,i)=>[r.key,i]))
const factsAt = (i: number) => {
 const t=rows[i]
 return {mediaType:t.media_type,tmdbId:t.key-(t.media_type==='show'?2e12:1e12),hasPoster:t.hasPoster,hasBackdrop:false,
  releaseDay:t.release_day??null,genres:t.genres??[],origin:t.origin??null,score:t.public_score??null,
  votes:t.votes??0,adult:t.adult??false,moods:moodsOf(t.fingerprint,t.genres),anime:t.anime??false}
}
const snapshot:any={version:'independent-fixture',stats:c.stats,referenceRows:rows.flatMap((t,i)=>t.in_pool&&t.fingerprint?[i]:[]),
 factsAt,facts:(key:number)=>at.has(key)?factsAt(at.get(key)!):null,
 fingerprint:(key:number)=>at.has(key)&&rows[at.get(key)!].fingerprint?Uint8Array.from(rows[at.get(key)!].fingerprint):null,
 fingerprintAt:(i:number)=>Uint8Array.from(rows[i].fingerprint)}
const scores=new Map(c.early.map(r=>[r.title_key,r.score]))
const person=readPerson(snapshot,{kind:'member',scores,chosen:new Set(scores.keys()),wantToSee:new Set(),
 skipped:new Set(),notInterested:new Set(),country:'',services:[],taste:NO_TASTE} as any)
console.log(JSON.stringify({view:buildSides(person),mu:person.mu,sigma:person.sigma,
 selection:Array.from(person.selection),signature:Array.from(person.signature)}))
