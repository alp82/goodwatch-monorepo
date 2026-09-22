/* THROWAWAY: independently inferred semantic core tiers on a frozen pooled slate.
 * The inference agent sees user query and catalog text, never relevance labels or ranks.
 * This is captured reranker output, not a implemented/benchmarked online model endpoint.
 */
const {rank}=require('./rankers.cjs');
const config={id:'semantic-core',name:'Semantic core, then mood',family:'semantic',base:{family:'strength',evidenceMood:.08,evidenceConcrete:.2,coreWeight:1,combine:'auto'},coreScale:4,fitScale:1,strengthScale:.25};
function rerank(cap,support,input=config){
 const rows=rank(cap,input.base), judgments=new Map(support.filter(s=>s.query===cap.query).map(s=>[s.key,s]));
 if(!judgments.size)return rows.map(r=>({...r,semantic:null}));
 // All comparisons use the same frozen pooled slate; undisclosed candidates cannot be inferred.
 const slate=rows.filter(r=>judgments.has(r.key));
 for(const r of slate){
  const s=judgments.get(r.key);
  r.semantic=s;r.priorScore=r.score;
  r.score=(s.contradiction?-8:0)+(s.reference?-4:0)+input.coreScale*s.core+input.fitScale*s.fit+input.strengthScale*r.features.strength;
 }
 slate.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 return slate;
}
module.exports={config,rerank};
