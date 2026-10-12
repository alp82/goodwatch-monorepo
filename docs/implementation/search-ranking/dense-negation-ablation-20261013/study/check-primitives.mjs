import assert from 'node:assert/strict';
import {quantizedCosines,z,filled,WEIGHTS} from './primitives.mjs';
import {labelNegation} from '../offline-public-encoder-20261013/source/query-parsing.server.mjs';
// Hand-computed quantized projection: scaled query [1,1], mask keeps rows0/2 =>3,7.
assert.deepEqual(quantizedCosines({dim:2,scale:Float32Array.of(2,4),values:Int8Array.of(1,2,9,9,3,4)},Float32Array.of(.5,.25),Uint8Array.of(1,0,1)),[3,7]);
assert.deepEqual(Array.from(z([1,3])),[-1,1]);assert.deepEqual(Array.from(z([2,2])),[0,0]);
assert.deepEqual(Array.from(filled([10,0,20,NaN])),[10,15,20,15]);
// A one-label hit is0.5, two saturate1; phrase requires intersection, not an OR.
const index={negationLabels:{labelsWithStem:new Map([['jump',[0,1]],['scare',[0,1]],['zombie',[2]]]),titles:[[1001],[1001,1002],[1003]]}};
assert.deepEqual([...labelNegation(index,'jump scares')],[[1001,1],[1002,.5]]);
assert.equal(labelNegation(index,'jump zombies').size,0);
assert.deepEqual({dense:WEIGHTS.dense,negation:WEIGHTS.negation,negationLabels:WEIGHTS.negationLabels,votes:WEIGHTS.votes,goodwatchScore:WEIGHTS.goodwatchScore},{dense:.4,negation:.1,negationLabels:2,votes:.1,goodwatchScore:.1});
console.log(JSON.stringify({knownQuantizedProjection:true,knownPopulationZ:true,knownPriorMeanFill:true,knownNegationIntersectionAndSaturation:true,fixedWeightPins:true}));
