import crypto from 'node:crypto';
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const orderedIds=results=>digest(results.map(rows=>rows.map(row=>row.id)));
export const orderedIdsScores=results=>digest(results.map(rows=>rows.map(row=>[row.id,row.score])));
export const idScoreSets=results=>digest(results.map(rows=>rows.map(row=>[row.id,row.score]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))));
export const idSets=results=>digest(results.map(rows=>rows.map(row=>String(row.id)).sort()));
export function signal(q){const allowed=new Set(['fingerprint_v1','fingerprint_v1_raw','text_en_v1','text_multi_v1','terms_bm25f_v1']);return{using:allowed.has(q.using)?q.using:'other',limit:typeof q.limit==='number'?q.limit:null,exact:q.params?.exact===true,queryKind:Array.isArray(q.query)?'dense':q.query?.indices?'sparse':typeof q.query==='string'?'profile':'other',filterMust:Array.isArray(q.filter?.must)?q.filter.must.length:0,filterMustNot:Array.isArray(q.filter?.must_not)?q.filter.must_not.length:0,filterShould:Array.isArray(q.filter?.should)?q.filter.should.length:0}}
