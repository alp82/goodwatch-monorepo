// Pure local public-frame validation. No private input, host access or imports
// of the executable consumer. The outer authenticates this entry and contract.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [contractPath, contractSha, sourceSha, externalSha] = process.argv.slice(2);
try {
  if (![contractSha,sourceSha,externalSha].every(x=>/^[a-f0-9]{64}$/.test(x||''))) throw Error();
  const raw=readFileSync(contractPath);
  if(raw.length>262144||createHash('sha256').update(raw).digest('hex')!==contractSha)throw Error();
  const {validateAdmissionFrame}=await import(pathToFileURL(contractPath).href);
  const input=readFileSync(0);if(input.length>262144)throw Error();
  const {frame,previous}=JSON.parse(input);
  const value=validateAdmissionFrame(frame,previous,{sourceFreezeSha256:sourceSha,externalManifestSha256:externalSha});
  process.stdout.write(JSON.stringify(value)+'\n');
} catch { process.stdout.write('{"schema":"cpu0-admission-validation.v6","valid":false}\n');process.exitCode=1; }
