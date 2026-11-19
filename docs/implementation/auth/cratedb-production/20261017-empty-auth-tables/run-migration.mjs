import {readFileSync,appendFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const source=readFileSync('/tmp/gw-auth-14/crate-adapter.server.ts','utf8');
const pieces=[
 'type AuthSql = (statement: string, args?: unknown[]) => Promise<any>; const localTransports = new WeakSet<AuthSql>();',
 source.slice(source.indexOf('export const authModelTable ='),source.indexOf('\nconst digest =')),
 source.match(/export const authModels = [^\n]+/)[0],
 source.match(/const indexedFields = [^\n]+/)[0],
 source.slice(source.indexOf('export async function migrateAuthTables('),source.indexOf('\nexport const localAuthEncryptionSecret')),
];
writeFileSync('/tmp/gw-auth-14/repository-migration.ts',pieces.join('\n'));
const {migrateAuthTables,authModels,authModelTable}=await import('./repository-migration.ts');
const tables=[...authModels,'capacity'].map(authModelTable).concat('doc.auth_user_email');
writeFileSync('/tmp/gw-auth-14/tables.json',JSON.stringify(tables,null,2)+'\n');
let sequence=0;
async function sql(stmt,args=[]) {
 if(args.length) throw Error('No bound parameters expected in schema-only migration');
 appendFileSync('/tmp/gw-auth-14/executed.sql',stmt+';\n\n');
 const raw=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','root@10.0.0.11','docker','exec','-i','crate-01','curl','-sS','--max-time','60','-H',"'Content-Type: application/json'",'--data-binary','@-','http://127.0.0.1:4200/_sql'],{input:JSON.stringify({stmt,args}),encoding:'utf8'});
 const result=JSON.parse(raw);
 appendFileSync('/tmp/gw-auth-14/execution.jsonl',JSON.stringify({sequence:++sequence,stmt,result})+'\n');
 if(result.error) throw Error('STOP: SQL failed: '+JSON.stringify(result.error));
 console.log(sequence,stmt.split('\n')[0],result.rowcount);
 return result;
}
// Invoke the repository's exact migration body; no adapter/runtime is started.
await migrateAuthTables(sql);
for(const table of tables) {
 await sql(`DENY DQL, DML ON TABLE ${table} TO goodwatch_webapp`);
 await sql(`DENY DQL ON TABLE ${table} TO goodwatch_search`);
 await sql(`DENY DQL, DML, DDL ON TABLE ${table} TO goodwatch_windmill`);
 await sql(`DENY DQL ON TABLE ${table} TO goodwatch_readonly`);
 await sql(`GRANT DQL, DML ON TABLE ${table} TO goodwatch_auth`);
}
await sql('GRANT DQL ON TABLE sys.cluster, sys.nodes TO goodwatch_auth');
const mcp=readFileSync('/tmp/gw-auth-14/mcp-schema.sql','utf8').replace(/^--.*\n/gm,'').trim().replace('CREATE TABLE doc.','CREATE TABLE IF NOT EXISTS doc.').replace(/;\s*$/,' WITH (number_of_replicas=\'2\', "write.wait_for_active_shards"=1, "translog.durability"=\'REQUEST\')');
await sql(mcp);
