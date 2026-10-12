import {execFileSync} from 'node:child_process';
import {writeFileSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
const cwd='/home/alper/projects/goodwatch-monorepo',commit='927d38b2cca815f02a0b1636ec06f63c24603396',base='goodwatch-webapp/app/server/search-ranking/';
const get=(n:string)=>execFileSync('git',['show',commit+':'+base+n],{cwd,encoding:'utf8'});
const rank=get('rank-search.server.ts'),pure=get('ranking.server.ts');
const section=(s:string,a:string,b:string)=>{const start=s.indexOf(a),end=s.indexOf(b,start);if(start<0||end<start)throw Error('extraction_unproven');return s.slice(start,end)};
const ts=section(rank,'function quantizedCosines(','\nconst toMap =')+'\n'+section(pure,'export const WEIGHTS =','export const PROFILE_WEAK')+'\n'+section(pure,'export function z(','/** Mean and population')+'\n'+section(pure,'export function filled(','/**')+'\nexport {quantizedCosines};';
const js=new Bun.Transpiler({loader:'ts',target:'node'}).transformSync(ts);
const dir='/home/alper/projects/search-100-evidence/local-dense-negation-ablation-20261013/';
writeFileSync(dir+'primitives.mjs',js,{mode:0o600});
writeFileSync(dir+'primitive-provenance.json',JSON.stringify({sourceCommit:commit,sourceFiles:{'rank-search.server.ts':sha(rank),'ranking.server.ts':sha(pure)},extractedTsSha256:sha(ts),compiledSha256:sha(js),functions:['quantizedCosines','z','filled','WEIGHTS'],transform:'Bun TypeScript type erasure only'},null,2)+'\n',{mode:0o600});
function sha(s:string){return createHash('sha256').update(s).digest('hex')}
