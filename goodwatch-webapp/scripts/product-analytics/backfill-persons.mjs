// Runs inside an auth-configured container; account payloads never leave it.
// Default is dry-run. Existing person identities are enriched without merging people.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { personProperties } from '../../app/telemetry/person-properties.ts'
const apply = process.argv.includes('--apply')
const { authPayloadCodec, parseAuthEncryptionKeys } = await import(pathToFileURL(process.env.AUTH_CODEC_PATH ?? '/app/app/server/auth/payload-codec.server.ts').href)
const codec = authPayloadCodec(process.env.AUTH_CRATEDB_ENCRYPTION_SECRET, parseAuthEncryptionKeys(process.env.AUTH_CRATEDB_ENCRYPTION_KEYS))
const statePath = process.env.ANALYTICS_PERSON_STATE ?? '/tmp/goodwatch-analytics-persons.json'
let state = { version: 'account-profiles-v1', done: [] }
try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch(error) { if(error.code !== 'ENOENT') throw error }
if(state.version !== 'account-profiles-v1') throw new Error('Profile checkpoint version mismatch')
const done = new Set(state.done)
const key = process.env.POSTHOG_API_KEY
if(apply && !key) throw new Error('POSTHOG_API_KEY required')
const origin = process.env.AUTH_CRATEDB_ORIGINS.split(',')[0].trim()
let cursor = ''; let enriched = 0; let skipped = 0
while(true) {
 const response = await fetch(`${origin}/_sql`, { method:'POST', headers: {'Content-Type':'application/json', Authorization:`Basic ${Buffer.from(`${process.env.AUTH_CRATEDB_USERNAME}:${process.env.AUTH_CRATEDB_PASSWORD}`).toString('base64')}`}, body:JSON.stringify({stmt:'SELECT id,payload FROM doc.auth_user WHERE deleted=false AND id > ? ORDER BY id LIMIT 100',args:[cursor]}),signal:AbortSignal.timeout(15000) })
 if(!response.ok) throw new Error(`Auth SQL HTTP ${response.status}`)
 const result = await response.json()
 if(result.error) throw new Error('Auth SQL failed')
 if(!result.rows.length) break
 const batch = []; const ids = []
 for(const [id,payload] of result.rows) {
  cursor = id
  if(done.has(id)){skipped++;continue}
  const user = codec.decode(payload,`doc.auth_user:${id}:payload`).row
  if(user.id !== id || typeof user.email !== 'string' || !user.email.includes('@')) throw new Error('Invalid account profile')
  const hex = createHash('sha256').update(`gw-person-v1:${id}`).digest('hex')
  const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
  batch.push({event:'$set',uuid,timestamp:new Date().toISOString(),properties:{distinct_id:id,user_id:id,$set:personProperties(user),$geoip_disable:true,$process_person_profile:true,source:'account_profile_backfill',backfilled:true}})
  ids.push(id)
 }
 if(apply && batch.length) {
  const sent = await fetch(`${process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com'}/batch/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,batch}),signal:AbortSignal.timeout(15000)})
  if(!sent.ok) throw new Error(`Profile delivery HTTP ${sent.status}; checkpoint retained`)
  ids.forEach(id=>done.add(id));state.done=[...done]
  await mkdir(dirname(statePath), {recursive:true})
  await writeFile(statePath+'.tmp',JSON.stringify(state),{mode:0o600});await rename(statePath+'.tmp',statePath)
 }
 enriched += batch.length
}
console.log(JSON.stringify({applied:apply,enriched,skipped,checkpoint:statePath}))
