import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {quantizedCosines,z,filled,WEIGHTS} from './primitives.mjs';
import {labelNegation} from '../offline-public-encoder-20261013/source/query-parsing.server.mjs';
const dir='/home/alper/projects/search-100-evidence/local-dense-negation-ablation-20261013';
const indexDir='/home/alper/projects/search-100-evidence/index-readonly-acquisition-20261013/verified-index';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(p));
const load=n=>JSON.parse(gunzipSync(readFileSync(`${indexDir}/${n}.json.gz`)));
const validation=read('../index-readonly-acquisition-20261013/actual-index-v2-validation.json');
for(const f of validation.files){if(sha(readFileSync(`${indexDir}/${f.name}.json.gz`))!==f.sha256)throw Error('index_hash_drift')}
const t=load('title_table'),mix=load('mix_vectors'),neg=load('negation_labels');
if(JSON.stringify(t.point_ids)!==JSON.stringify(mix.point_ids))throw Error('row_alignment_drift');
const v=mix.text_en_v1;
function decodeVector(q){const a=Object.values(q).find(x=>x&&typeof x==='object'&&x.int8);if(!a)throw Error('vector_encoding_unknown');const b=Buffer.from(a.int8,'base64');const s=Buffer.from(q.scale.float32,'base64');return {dim:q.scale.shape[0],scale:new Float32Array(s.buffer,s.byteOffset,s.byteLength/4),values:new Int8Array(b.buffer,b.byteOffset,b.byteLength)}}
const vector=decodeVector(v);
if(vector.dim!==768||vector.values.length!==t.point_ids.length*768)throw Error('vector_shape_drift');
const labelsWithStem=new Map();for(let i=0;i<neg.stems.length;i++)for(const s of neg.stems[i]){if(!labelsWithStem.has(s))labelsWithStem.set(s,[]);labelsWithStem.get(s).push(i)}
const labelIndex={negationLabels:{labelsWithStem,titles:neg.titles}};
const vectorsPath='../offline-public-encoder-additions-20261013/query-vectors-merged.json';
const cache=read(vectorsPath);if(sha(readFileSync(vectorsPath))!=='35a2716af5e5b9a45b1678185b558cca736c7d81250f1c085ef59d62eb98a854')throw Error('cache_hash_drift');
const bindingPath=process.argv[2];if(!bindingPath)throw Error('binding_required');const binding=read(bindingPath);
const maskDir='/home/alper/projects/search-100-evidence/offline-prepared-inputs-20261013';const maskManifest=read(maskDir+'/filter-mask-manifest.json');const masks=readFileSync(maskDir+'/filter-masks.bin');const maskById=new Map(maskManifest.masks.map(x=>[x.id,x]));
if(maskManifest.rows!==t.point_ids.length||maskManifest.indexBuildId!==validation.buildId)throw Error('mask_index_drift');
const out={schema:'search.local-dense-negation-ablation.v1',sourceCommit:'927d38b2cca815f02a0b1636ec06f63c24603396',indexBuildId:validation.buildId,indexRows:t.point_ids.length,bindingSha256:sha(readFileSync(bindingPath)),vectorCacheSha256:sha(readFileSync(vectorsPath)),productionAcceptance:false,currentFinalOverlap:null,weights:WEIGHTS,candidatePool:'exact filtered dense cosine top500 only; z over these candidates',uncomputedSignals:['fingerprint','bm25','facets','coverage','reference/profile','memberTaste','authoritative catalog metadata'],queries:[],excluded:[]};
for(const b of binding.rows){
 const penaltyTexts=[...new Set([...(b.negated??[]),...(b.lateAvoidedEnglish??[])])];
 const reason=b.exclusionReason??(b.nonEnglish?'nonEnglish':b.reference?'reference':!b.hasDense?'no_dense_text':Object.entries(b.early).some(([model,texts])=>texts.some(t=>!cache[model][t]))?'early_cache_missing':!cache.english[b.denseText]?'dense_cache_missing':penaltyTexts.some(s=>!cache.english[s])?'negative_cache_missing':!b.mask?'filter_missing':null);
 if(reason){out.excluded.push({id:b.id,reason});continue}
 const mb=maskById.get(b.id);if(!mb||mb.bytes!==t.point_ids.length)throw Error('filter_binding_unproven');
 const mask=Uint8Array.from(masks.subarray(mb.offset,mb.offset+mb.bytes));if(sha(mask)!==mb.sha256||mask.some(x=>x!==0&&x!==1))throw Error('filter_hash_drift');const rows=[];for(let i=0;i<mask.length;i++)if(mask[i])rows.push(i);
 const start=performance.now(),dense=quantizedCosines(vector,Float32Array.from(cache.english[b.denseText]),mask);
 const ranked=dense.map((score,i)=>({row:rows[i],score})).sort((a,b)=>b.score-a.score||a.row-b.row).slice(0,500);
 const candRows=ranked.map(x=>x.row),candidateMask=new Uint8Array(mask.length);candRows.forEach(i=>candidateMask[i]=1);
 const orderedRows=[...candRows].sort((a,b)=>a-b),denseMap=new Map(ranked.map(x=>[x.row,x.score]));
 const d=z(orderedRows.map(i=>denseMap.get(i)));
 const priorScore=z(filled(orderedRows.map(i=>t.goodwatch_scores[i]))),priorVotes=z(orderedRows.map(i=>Math.log1p(t.votes[i])));
 const negatives=penaltyTexts.map(s=>quantizedCosines(vector,Float32Array.from(cache.english[s]),candidateMask));
 const negative=negatives.length?z(orderedRows.map((_,i)=>Math.max(...negatives.map(x=>x[i])))):new Float64Array(orderedRows.length);
 const shares=(b.negated??[]).map(s=>labelNegation(labelIndex,s,false));
 const labelPenalty=orderedRows.map(r=>shares.length?Math.max(...shares.map(s=>s.get(t.point_ids[r])??0)):0);
 const variants={};for(const mode of ['dense','dense-priors','dense-negation-priors']){
  const scores=orderedRows.map((r,i)=>({id:t.point_ids[r],row:r,score:WEIGHTS.dense*d[i]+(mode==='dense'?0:WEIGHTS.goodwatchScore*priorScore[i]+WEIGHTS.votes*priorVotes[i])-(mode==='dense-negation-priors'?WEIGHTS.negation*negative[i]+WEIGHTS.negationLabels*labelPenalty[i]:0)}));
  scores.sort((a,b)=>b.score-a.score||a.row-b.row);variants[mode]=scores.slice(0,100).map(x=>({id:x.id,score:x.score}));
 }
 out.queries.push({id:b.id,denseText:b.denseText,negated:b.negated??[],lateAvoidedEnglish:b.lateAvoidedEnglish??[],eligibleRows:rows.length,maskSha256:mb.sha256,era:mb.era??null,flags:b.decodedFlags??[],policy:b.policy??null,found:false,nonEnglish:false,computeMs:performance.now()-start,variants});
}
writeFileSync(`${dir}/rankings-v2.json`,JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({included:out.queries.length,excluded:out.excluded.length,indexRows:out.indexRows,rankingSha256:sha(readFileSync(`${dir}/rankings-v2.json`))}));
