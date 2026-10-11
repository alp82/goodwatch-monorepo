export function blockQueryTransport(source){
 const declaration='export async function queryBatch(',signature='): Promise<QueryBatchResult> {';
 if(source.split(declaration).length!==2)throw Error('query_boundary_source_changed');
 source=source.replace(declaration,'export async function originalQueryBatch(');
 const index=source.indexOf(signature,source.indexOf('export async function originalQueryBatch('));
 if(index<0||source.indexOf(signature,index+signature.length)>=0)throw Error('query_boundary_source_changed');
 const body=index+signature.length-1;
 source=source.slice(0,body+1)+`throw new Error('PRODUCER_QDRANT_FORBIDDEN');`+source.slice(body+1);
 return source+`\nexport async function queryBatch(collection,queries,timeoutMs){if(collection==='media_fingerprint_v1' && queries.some(q=>q.limit===500||q.limit===300)){globalThis.replayCaptured={collection,queries};throw new Error('DIAGNOSTIC_INTERCEPT');}throw new Error('PRODUCER_QDRANT_FORBIDDEN');}`;
}
export function blockMissingModel(source){
 const needle='if (await isVerified(path, file)) return { path, downloaded: false }';
 if(source.split(needle).length!==2)throw Error('model_boundary_source_changed');
 return source.replace(needle,needle+`;throw new Error('Verified existing models required');`);
}
