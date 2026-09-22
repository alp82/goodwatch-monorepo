/* Reproduce the fixed decision rule. This evaluates the experiment, not production code. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const here=__dirname,read=f=>JSON.parse(fs.readFileSync(path.join(here,f),'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(here,f))).digest('hex');
const report=read('semantic-evaluation-all.json'),freeze=read('selection-freeze.json');
const bounds=(set,id)=>{const v=report[set].map(s=>s.results.find(r=>r.id===id).summary.ndcg);return [Math.min(...v),Math.max(...v)];};
const comparisons=report.sensitivity.flatMap(s=>s.comparisons),auditComparisons=report.auditSensitivity.flatMap(s=>s.comparisons);
const confirmation=new Set([4,8,9,13]);
const confirmationMean=r=>r.queries.filter(q=>confirmation.has(q.index)).reduce((s,q)=>s+q.metric.ndcg,0)/4;
const confirmationMargin=Math.min(...report.sensitivity.flatMap(s=>{const w=confirmationMean(s.results.find(r=>r.id==='semantic-core'));return s.results.filter(r=>r.id!=='semantic-core').map(r=>w-confirmationMean(r));}));
const audit=new Set([...read('judgments-audit.json'),...read('judgments-audit-final.json')].map(j=>j.query+'|'+j.key));
const winner=report.results.find(r=>r.id==='semantic-core');
const checks={
 marginNdcg:comparisons.every(c=>c.ndcgDelta!==null&&c.ndcgDelta>=.05),
 marginAcceptable:comparisons.every(c=>c.acceptableDelta>=.5-1e-9),
 allGuardrails:comparisons.every(c=>c.guardrailsPass),
 auditMarginAndGuardrails:auditComparisons.every(c=>c.guardrailsPass&&c.ndcgDelta!==null&&c.ndcgDelta>=.05&&c.acceptableDelta>=.5-1e-9),
 selectedRankerUnchanged:['semantic-rank.cjs','semantic-support-v2.json','parsed-intents.json','semantic-packets-v2.json','query-intents.json','evaluation-contract.md'].every(f=>hash(f)===freeze.hashes[f]),
 confirmationNonnegativeVsEveryComparator:confirmationMargin>=0,
 allFinalTopThreeIndependentlyAudited:winner.queries.every(q=>q.metric.top.slice(0,3).every(r=>audit.has(q.query+'|'+r.key)))
};
if(!Object.values(checks).every(Boolean))throw new Error('No declared winner: '+JSON.stringify(checks));
const range=bounds('sensitivity','semantic-core');
const files=['semantic-evaluation-all.json','semantic-support-v2.json','query-intents.json','judgments-a.json','judgments-b.json','judgments-c.json','judgments-audit.json','judgments-audit-final.json','uncertain-evidence-audit.json','evaluate.cjs','evaluate-semantic.cjs','verify-winner.cjs'];
const verification={winner:'semantic-core',scope:'Interpretation + semantic support + source-fact supplementation, on frozen pooled candidates and stated agent relevance rubric',comparatorCount:report.results.length-1,checks,ndcgRange:range,independentAuditRange:bounds('auditSensitivity','semantic-core'),minimumMarginToAnyComparatorAcrossUnknownAssignments:Math.min(...comparisons.map(c=>c.ndcgDelta)),minimumAuditedMarginAcrossUnknownAssignments:Math.min(...auditComparisons.map(c=>c.ndcgDelta)),confirmationMinimumNdcgMargin:confirmationMargin,auditPairs:audit.size,metricsFile:'semantic-evaluation-all.json',qualityMetric:'Macro pool-relative NDCG@10; exact shared-label sensitivity over unresolved Free Guy grade 0,1,2,3',acceptedHumanBaseline:'Not rerun; no human per-title labels manufactured',finalEvidenceHashes:Object.fromEntries(files.map(f=>[f,hash(f)]))};
fs.writeFileSync(path.join(here,'winner-verification.json'),JSON.stringify(verification,null,2));
console.log('Clear proxy winner; all fixed checks passed. NDCG range:',range,'minimum advantage:',verification.minimumMarginToAnyComparatorAcrossUnknownAssignments);
