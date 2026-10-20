// Run inside the production webapp container. Auth secrets stay in its environment.
// Only existing analytics identities are linked; auth payloads are never logged or exported.
import { readFile, writeFile, rename } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const apply = process.argv.includes('--apply')
const codecPath = process.env.AUTH_CODEC_PATH ?? '/app/app/server/auth/payload-codec.server.ts'
const { authPayloadCodec, parseAuthEncryptionKeys } = await import(pathToFileURL(codecPath).href)
const codec = authPayloadCodec(process.env.AUTH_CRATEDB_ENCRYPTION_SECRET, parseAuthEncryptionKeys(process.env.AUTH_CRATEDB_ENCRYPTION_KEYS))
const knownIds = new Set(JSON.parse(await readFile(process.env.ANALYTICS_KNOWN_IDS_FILE, 'utf8')))
const statePath = process.env.ANALYTICS_IDENTITY_STATE ?? '/tmp/goodwatch-analytics-identities.json'
let state = { done: [], cutoff: Date.now() }
try { state = JSON.parse(await readFile(statePath,'utf8')) } catch(error) { if(error.code !== 'ENOENT') throw error }
const done = new Set(state.done)
const key = process.env.POSTHOG_API_KEY
if (apply && !key) throw new Error('POSTHOG_API_KEY required')
const origin = process.env.AUTH_CRATEDB_ORIGINS.split(',')[0].trim()
const sql = async (stmt,args=[]) => {
 const response = await fetch(`${origin}/_sql`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Basic ${Buffer.from(`${process.env.AUTH_CRATEDB_USERNAME}:${process.env.AUTH_CRATEDB_PASSWORD}`).toString('base64')}` }, body: JSON.stringify({stmt,args}), signal: AbortSignal.timeout(15000) })
 if(!response.ok) throw new Error(`Auth SQL HTTP ${response.status}`)
 return response.json()
}
let cursor = ''; let linked = 0; let skipped = 0
while(true) {
 const result = await sql('SELECT id,payload FROM doc.auth_user WHERE deleted=false AND id > ? ORDER BY id LIMIT 100',[cursor])
 if(!result.rows.length)break
 for(const [id,payload] of result.rows) {
  cursor=id
  if(!knownIds.has(id)||done.has(id)){skipped++;continue}
  const user = codec.decode(payload,`doc.auth_user:${id}:payload`).row
  if(typeof user.email !== 'string' || !user.email.includes('@'))throw new Error('Invalid legacy identity')
  const hex=createHash('sha256').update(`gw-identity-v1:${id}`).digest('hex')
  const uuid=`${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
  if(apply) {
   const response=await fetch(`${process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com'}/batch/`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,batch:[{
    event:'$create_alias',uuid,timestamp:new Date().toISOString(),properties:{ distinct_id:user.email,alias:id,$geoip_disable:true }
   }]}),signal:AbortSignal.timeout(15000) })
   if(!response.ok)throw new Error(`Identity migration HTTP ${response.status}; checkpoint retained`)
   done.add(id);state.done=[...done]
   await writeFile(statePath+'.tmp',JSON.stringify(state),{mode:0o600});await rename(statePath+'.tmp',statePath)
  }
  linked++
 }
}
console.log(JSON.stringify({ applied:apply,linked,skipped,checkpoint:statePath }))
