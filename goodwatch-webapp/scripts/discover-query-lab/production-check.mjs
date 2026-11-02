// Read-only smoke check against the deployed/production-built interpreter.
import assert from 'node:assert/strict'
const base=new URL(process.argv[2]??'http://127.0.0.1:3000')
for(const [query,expected] of [
 ['Tom Hanks Disney from the 90s',{people:'31',services:'337',minYear:'1990',maxYear:'1999'}],
 ['80+ Brad Pitt vibes on Prime',{people:'287',services:'9',score:'80'}],
 ['Matrix vibes',{similar:'1000000000603'}],
 ['low budget flop',{budget:'-4.999',returns:'flop'}],
 ['100',{q:'100'}],
]){
 const response=await fetch(new URL('/api/discover/interpret',base),{method:'POST',headers:{Origin:base.origin,'Content-Type':'application/json'},body:JSON.stringify({query})})
 assert.equal(response.status,200,query)
 const result=await response.json(),params=new URLSearchParams(result.params)
 for(const [key,value] of Object.entries(expected))assert.equal(params.get(key),value,`${query}: ${key}`)
 if(query==='100')assert.equal(params.has('score'),false)
 else assert.equal(result.residual,'',`${query}: unresolved text`)
 if(expected.people)assert.ok(result.display.people[expected.people])
 console.log(`PASS ${query}`)
}
