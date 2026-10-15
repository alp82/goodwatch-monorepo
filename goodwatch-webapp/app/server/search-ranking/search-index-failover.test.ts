import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { test } from "node:test"
import { readManifest, readBlob, BlobMissing } from "./search-index-build.server.ts"

test("search manifest and index blobs survive loss of crate-01 and log both coordinators", async (t) => {
 const previous={...process.env}
 const body=Buffer.from("local index artifact")
 const sha=createHash("sha1").update(body).digest("hex")
 const counts=[0,0]
 let missing=false
 const servers=[0,1].map(i=>createServer((req,res)=>{
  counts[i]++
  if(i===0){req.socket.destroy();return}
  if(req.url?.startsWith("/_blobs")){res.statusCode=missing?404:200;res.end(missing?"missing":body)}
  else res.end(JSON.stringify({rows:[[{version:"local"}]]}))
 }))
 const events:Record<string,unknown>[]=[]
 t.mock.method(console,"warn",(line:string)=>events.push(JSON.parse(line)))
 t.after(async()=>{
  for(const key of ["CRATE_HOSTS","CRATE_PORT"]){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
  await Promise.all(servers.map(async s=>{s.closeAllConnections();await new Promise(resolve=>s.close(resolve))}))
 })
 await new Promise<void>(resolve=>servers[0].listen(0,"127.0.0.1",resolve))
 const address=servers[0].address();assert.ok(address&&typeof address!=="string")
 await new Promise<void>(resolve=>servers[1].listen(address.port,"127.0.0.2",resolve))
 Object.assign(process.env,{CRATE_HOSTS:"127.0.0.1,127.0.0.2",CRATE_PORT:String(address.port)})
 assert.equal((await readManifest()).version,"local")
 assert.deepEqual(await readBlob(sha),body)
 assert.deepEqual(counts,[2,2])
 assert.equal(events.filter(e=>e.event==="crate.query"&&e.outcome==="recovered").length,2)
 assert.equal(events.filter(e=>e.event==="crate.attempt_failed").length,2)
 missing=true
 await assert.rejects(readBlob(sha),e=>e instanceof BlobMissing)
 assert.equal(events.at(-1)?.outcome,"failed")
})
