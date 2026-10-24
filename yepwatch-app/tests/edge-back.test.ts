import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeBackIntent, edgeBackComplete } from '../src/features/glow/edge-back';
import codes from '../src/features/home/codes.json';
import invitations from '../src/features/beta/invitations.json';
test('edge navigation requires a deliberate rightward gesture, not a tap, vertical scroll, left swipe or short reversal',()=>{
 for(const [x,y,v]of[[2,0,1],[-100,0,1],[30,70,1],[12,1,0],[20,0,.8]])assert.equal(edgeBackComplete(x,y,v),false);
 assert.equal(edgeBackIntent(40,2),true);assert.equal(edgeBackComplete(70,15,0),true);assert.equal(edgeBackComplete(35,2,.6),true);
});
test('QR destinations stay in sync with the published app invitations',()=>{assert.equal(codes.ios.url,invitations.ios);assert.equal(codes.android.url,invitations.android??invitations.androidApk);});
