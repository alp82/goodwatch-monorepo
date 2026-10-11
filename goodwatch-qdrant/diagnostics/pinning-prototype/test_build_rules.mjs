import test from 'node:test';
import assert from 'node:assert/strict';
import {blockQueryTransport,blockMissingModel} from './build-rules.mjs';
test('missing or changed typed function boundary never inserts into default options object',()=>{
 const source='export async function queryBatch(collection: string, queries: QdrantQuery[], options: {timeoutMs?: number} = {},): Promise<QueryBatchResult> { return actualTransport(); }';
 const transformed=blockQueryTransport(source);
 assert.ok(transformed.includes('): Promise<QueryBatchResult> {throw'));
 assert.ok(transformed.includes('options: {timeoutMs?: number} = {}'));
 assert.throws(()=>blockQueryTransport(source.replace('Promise<QueryBatchResult>','Promise<Changed>')));
 assert.throws(()=>blockQueryTransport(source+source));assert.throws(()=>blockQueryTransport(''));
});
test('verified existing model fence must occur exactly once',()=>{
 const source='if (await isVerified(path, file)) return { path, downloaded: false }; return download();';
 assert.ok(blockMissingModel(source).includes('throw new Error'));
 assert.throws(()=>blockMissingModel('return download();'));assert.throws(()=>blockMissingModel(source+source));
});
