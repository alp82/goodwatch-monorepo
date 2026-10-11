// Offline-only build. No capture, source query, model download or production action.
import {blockQueryTransport,blockMissingModel} from './build-rules.mjs';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [project,out,compiler]=process.argv.slice(2);
if(!project||!out)throw Error('explicit_build_paths_required');
const root=resolve(project),files=root+'/app/server';
const {build}=await import(pathToFileURL(resolve(compiler||root+'/node_modules/esbuild/lib/main.js')).href);
const entry=`export {rankSearch} from '${files}/search-ranking/rank-search.server.ts';export {getSearchIndex} from '${files}/search-ranking/search-index.server.ts';export {stopQueryEncoder} from '${files}/search-ranking/query-encoder.server.ts';export {attributeRequest,fingerprintRequest,readingFields} from '${files}/combined-search/reading-retrieval.server.ts';export {nonEnglish,LANGUAGE_VERSION} from '${files}/combined-search/language.server.ts';`;
await build({stdin:{contents:entry,resolveDir:root,sourcefile:'private-producer-entry.ts',loader:'ts'},outfile:resolve(out),bundle:true,platform:'node',format:'esm',target:'node20',alias:{'~':root+'/app'},packages:'external',tsconfig:root+'/tsconfig.json',plugins:[{name:'readonly-producer-boundaries',setup(build){
 build.onLoad({filter:/qdrant-http\.server\.ts$/},args=>{
  const source=blockQueryTransport(readFileSync(args.path,'utf8'));
  return{contents:source,loader:'ts'};
 });
 build.onLoad({filter:/separate-entry\.server\.ts$/},()=>({contents:`import {existsSync} from 'node:fs';export const separateEntryUrl=(file,base)=>{if(file==='search-index.worker.js'){const url=new URL('file:///app/build/server/replay/index-inline.disabled');if(existsSync(url))throw new Error('Diagnostic inline index fence changed');return url;}if(file!=='query-encoder.worker.js')throw new Error('Unexpected diagnostic worker');return new URL('file:///app/build/server/'+file);};`,loader:'ts'}));
 build.onLoad({filter:/query-models\.server\.ts$/},args=>{
  return{contents:blockMissingModel(readFileSync(args.path,'utf8')),loader:'ts'};
 });
 build.onLoad({filter:/combined-search\/language\.server\.ts$/},args=>{const source=readFileSync(args.path,'utf8');return{contents:source.slice(source.indexOf('export const LANGUAGE_VERSION'),source.indexOf('export async function prepareLanguage')).replace(/const PROMPT =[\s\S]*?const GERMAN =/, 'const GERMAN ='),loader:'ts'};});
}}]});
