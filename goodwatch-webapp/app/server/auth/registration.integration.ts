import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { after, test } from "node:test"
import Redis from "ioredis"
import { CrateAuthRequestError } from "./crate-adapter.server.ts"
import { runAuthMaintenancePass } from "./maintenance-worker.server.ts"
import { createGoodwatchAuth } from "./auth.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { AuthMailQueue } from "./mail.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { authTestValkeyPort } from "./store-fixtures.integration.ts"

const sql = maintenanceDatabase()
const redis = new Redis.Cluster([{host:"127.0.0.1",port:authTestValkeyPort}], {natMap:JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"), redisOptions:{maxRetriesPerRequest:0,commandTimeout:3000}})
after(()=>redis.disconnect())
const origin = "http://127.0.0.1:3359"
const storage = new ValkeyAuthStorage(()=>redis)
const authOptions = {sql, encryptionSecret:"disposable-local-auth-integration-key-548", storage, mail:new AuthMailQueue({sendMail:async()=>{}}),baseURL:origin,secret:"local-registration-secret-at-least-32-chars",trustedIpHeader:"x-real-ip",rateLimit:{enabled:false},google:{clientId:"local",clientSecret:"local"},mcp:{resource:`${origin}/mcp`}}
const auth = createGoodwatchAuth(authOptions)
const ip = () => `2001:db8:${randomBytes(2).toString("hex")}::1`
const register = (address: string, instance = auth) => instance.handler(new Request(`${origin}/api/auth/oauth2/register`,{method:"POST",headers:{"content-type":"application/json","x-real-ip":address,"x-forwarded-for":ip()},body:JSON.stringify({client_name:"Disposable MCP",application_type:"native",redirect_uris:["http://127.0.0.1:6280/callback"],token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],response_types:["code"],scope:"mcp:read offline_access"})}))

test("DCR registration is limited per trusted IP without consuming another caller's allowance",async()=>{
 const address = ip()
 for(let i=0;i<30;i++) { const response = await register(address); assert.equal(response.status,201,await response.text()) }
 assert.equal((await register(address)).status,429)
 assert.equal((await register(ip())).status,201)
})


test("unused DCR clients and failed-registration leftovers are collected after twenty-four hours",async()=>{
 const registered = await register(ip())
 assert.equal(registered.status,201)
 const client = await registered.json()
 let failedClient: string | undefined
 const broken = createGoodwatchAuth({...authOptions,sql:async(statement,args)=>{
  if(statement.startsWith("INSERT INTO doc.auth_oauth_client (")) failedClient=String(args?.[0])
  if(statement.startsWith("INSERT INTO doc.auth_oauth_client_resource (")) throw new CrateAuthRequestError("Local injected registration failure",4000,400,true)
  return sql(statement,args)
 }})
 assert.equal((await register(ip(),broken)).ok,false)
 assert.ok(failedClient)
 const context = await auth.$context
 assert.ok(await context.adapter.findOne({model:"oauthClient",where:[{field:"clientId",value:failedClient}]}))
 await runAuthMaintenancePass({sql,encryptionSecret:authOptions.encryptionSecret,now:new Date(Date.now()+25*3600000)})
 for(const clientId of [client.client_id,failedClient]) {
  assert.equal(await context.adapter.findOne({model:"oauthClient",where:[{field:"clientId",value:clientId}]}),null)
  assert.deepEqual(await context.adapter.findMany({model:"oauthClientResource",where:[{field:"clientId",value:clientId}]}),[])
 }
})

test("a client that was authorized is retained after its last grant is disconnected",async()=>{
 const response = await register(ip())
 const client = await response.json()
 assert.equal(response.status,201)
 const context = await auth.$context
 const user = await context.adapter.create<{id:string}>({model:"user",data:{email:`${crypto.randomUUID()}@example.test`,name:"Confirmed",emailVerified:true}})
 const consent = await context.adapter.create<{id:string}>({model:"oauthConsent",data:{clientId:client.client_id,userId:user.id,scopes:["mcp:read"],resources:[`${origin}/mcp`]}})
 await context.adapter.delete({model:"oauthConsent",where:[{field:"id",value:consent.id}]})
 await runAuthMaintenancePass({sql,encryptionSecret:authOptions.encryptionSecret,now:new Date(Date.now()+25*3600000)})
 assert.ok(await context.adapter.findOne({model:"oauthClient",where:[{field:"clientId",value:client.client_id}]}))
})

test("a collected unused metadata URL can register again without waiting for tombstone retention",async()=>{
 const context = await auth.$context
 const clientId = `https://example.test/${crypto.randomUUID()}.json`
 await context.adapter.create({model:"oauthClient",data:{clientId,clientDiscoveryId:clientId,name:"Metadata client",createdAt:new Date(Date.now()-25*3600000)}})
 await runAuthMaintenancePass({sql,encryptionSecret:authOptions.encryptionSecret})
 assert.equal(await context.adapter.findOne({model:"oauthClient",where:[{field:"clientId",value:clientId}]}),null)
 await context.adapter.create({model:"oauthClient",data:{clientId,clientDiscoveryId:clientId,name:"Metadata client",createdAt:new Date()}})
 assert.ok(await context.adapter.findOne({model:"oauthClient",where:[{field:"clientId",value:clientId}]}))
})
