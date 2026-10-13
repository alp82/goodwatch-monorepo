import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./reader.mjs',import.meta.url));
const h=createHash('sha256').update(source).digest('hex');
const text=`import {createHash} from 'node:crypto';
const deadline=performance.now()+600000;
try {
 const expectedReaderSha256=${JSON.stringify(h)};
 const source=Buffer.from(${JSON.stringify(source.toString('base64'))},'base64');
 if(createHash('sha256').update(source).digest('hex')!==expectedReaderSha256){const e=new Error('driver_source_hash');e.reason='driver_source_hash';throw e;}
 const reader=await import('data:text/javascript;base64,'+source.toString('base64'));
 await reader.runCli(expectedReaderSha256,deadline);
} catch(e) {
 process.stderr.write(JSON.stringify({kind:'refusal',reason:typeof e.reason==='string'?e.reason:'reader_failure',complete:false})+'\\n');
 process.exitCode=1;
}
`;
writeFileSync(new URL('./eval-driver.mjs',import.meta.url),text,{flag:'wx',mode:0o600});
