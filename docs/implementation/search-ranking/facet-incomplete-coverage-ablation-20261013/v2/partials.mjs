import{z,WEIGHTS}from'./primitives.mjs';
export function partialTerms(rows,cosines,facets,units){
 const col=text=>{const c=rows.map(r=>cosines.get(text)?.get(r));if(c.some(x=>!Number.isFinite(x)))throw Error('partial_score_unavailable');return c};
 const facetZ=facets.map(t=>z(col(t))),unitZ=units.map(t=>z(col(t)));
 const facet=rows.map((_,i)=>facetZ.length?facetZ.reduce((s,c)=>s+c[i],0)/facetZ.length:0);
 const minimum=rows.map((_,i)=>unitZ.length?Math.min(...unitZ.map(c=>c[i])):0),coverage=units.length?Array.from(z(minimum)):rows.map(()=>0);
 return{facet:new Map(rows.map((r,i)=>[r,facet[i]])),incompleteDenseCoverage:new Map(rows.map((r,i)=>[r,coverage[i]])),facetColumns:facets.map((text,i)=>({text,cosines:col(text),populationZ:Array.from(facetZ[i])})),unitColumns:units.map((text,i)=>({text,cosines:col(text),populationZ:Array.from(unitZ[i])})),unitMinimum:minimum,unitBm25Observed:false};
}
export function addTerms(base,terms,facet,coverage){return base.map(x=>({...x,score:x.score+(facet?WEIGHTS.facet*terms.facet.get(x.row):0)+(coverage?WEIGHTS.coverage*terms.incompleteDenseCoverage.get(x.row):0)})).sort((a,b)=>b.score-a.score||a.row-b.row)}
export function expandedPool(base,partials,mask){const rows=[...new Set([...base,...partials.flatMap(p=>p.rows)])].sort((a,b)=>a-b);if(rows.length>2800||rows.some(r=>!Number.isInteger(r)||r<0||r>=mask.length||mask[r]!==1))throw Error('expanded_pool_bound');return rows;}
