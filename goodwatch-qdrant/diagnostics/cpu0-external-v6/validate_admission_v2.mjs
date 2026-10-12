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
  const {validateAdmissionFrameV2}=await import(pathToFileURL(contractPath).href);
  const input=readFileSync(0);if(input.length>262144)throw Error();
  const {frame,previous,expected}=JSON.parse(input);
  const names=['sourceFreezeSha256','externalManifestSha256','adoptionIntentSha256','helperCodeSha256','helperPolicySha256','controllerPolicySha256','nodeProvenanceSha256'];
  if(!expected||Object.keys(expected).length!==names.length||!names.every(name=>/^[a-f0-9]{64}$/.test(expected[name]||''))||expected.sourceFreezeSha256!==sourceSha||expected.externalManifestSha256!==externalSha||expected.adoptionIntentSha256!==previous?.adoptionIntentSha256)throw Error();
  const value=validateAdmissionFrameV2(frame,previous,expected);
  process.stdout.write(JSON.stringify(value)+'\n');
} catch { process.stdout.write('{"schema":"cpu0-admission-validation.v7","valid":false}\n');process.exitCode=1; }
