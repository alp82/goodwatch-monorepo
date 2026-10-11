import {readFileSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import crypto from 'node:crypto';
export const SOURCE_FILES=['compare.mjs','compare-contract.mjs','parity.mjs','transport.mjs','private-pipe.mjs','producer-guard.mjs','run-heldout-no-profile.mjs','build-producer.mjs','build-rules.mjs','source-freeze.mjs'];
export const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function verifySources(manifestBytes,expected,read){
 if(!/^[a-f0-9]{64}$/.test(expected||'')||sha(manifestBytes)!==expected)throw Error('source_manifest_changed');
 const manifest=JSON.parse(manifestBytes);
 if(manifest.schema!=='private-comparison-source-freeze.v1'||Object.keys(manifest).sort().join(',')!=='files,producerRuleSha256,productionBundleSha256,schema'||Object.keys(manifest.files||{}).sort().join(',')!==[...SOURCE_FILES].sort().join(','))throw Error('source_manifest_shape');
 for(const name of SOURCE_FILES)if(!/^[a-f0-9]{64}$/.test(manifest.files[name])||sha(read(name))!==manifest.files[name])throw Error('comparison_or_producer_source_changed');
 if(manifest.producerRuleSha256!==manifest.files['run-heldout-no-profile.mjs']||!/^[a-f0-9]{64}$/.test(manifest.productionBundleSha256))throw Error('producer_rule_freeze_missing');
 return manifest;
}
export function verifyFrozenSources(expected=process.env.SOURCE_MANIFEST_SHA256,{producer=false}={}){
 const directory=dirname(fileURLToPath(import.meta.url));
 if(realpathSync(directory)!==directory)throw Error('source_directory_changed');
 const read=name=>{const path=join(directory,name);if(realpathSync(path)!==path)throw Error('source_path_changed');return readFileSync(path);};
 const manifest=verifySources(read('prepared-source-manifest.json'),expected,read);
 if(producer&&sha(read('production.mjs'))!==manifest.productionBundleSha256)throw Error('production_bundle_changed');
 return manifest;
}
