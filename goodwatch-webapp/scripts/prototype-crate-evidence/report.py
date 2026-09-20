"""Build a self-contained review page from real experiment results."""
import json
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / 'docs/prototypes/crate-evidence'
results = json.loads((HERE/'private/comparison.json').read_text())
cases = json.loads((HERE/'private/interpretations.json').read_text())
compact = []
for result,case in zip(results,cases):
    compact.append({k:v for k,v in result.items() if k!='runs'} | {'flags':case['filters'],'weights':case['weights'],'phrases':case['attributes']['phrases']})
(OUT/'comparison.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2))
(OUT/'interpretations.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2))
for name in ('load.json','probes.json'):
    (OUT/name).write_text((HERE/'private'/name).read_text())
sample = json.loads((HERE/'private/sample.json').read_text())
(OUT/'sample-manifest.json').write_text(json.dumps({'sha256':hashlib.sha256((HERE/'private/sample.json').read_bytes()).hexdigest(),'titles':[{'media_type':r['media_type'],'tmdb_id':r['tmdb_id']} for r in sample]},indent=2))
(OUT/'timings.json').write_text(json.dumps([{'request':r['request'],'runs':[{k:v for k,v in run.items() if k not in ('top10','candidates')} for run in r['runs']]} for r in results],indent=2))
html = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GoodWatch evidence search — prototype review</title>
<style>
*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f5f7;color:#172033}header,main{max-width:1500px;margin:auto;padding:24px}header{padding-bottom:0}h1{margin:0;font-size:28px}h2{font-size:20px}p{max-width:1000px}.muted{color:#586478}select,button{font:inherit;padding:9px;border:1px solid #b6becd;border-radius:6px;background:white}#request{width:100%}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.column{min-width:0}article{background:white;padding:16px;border:1px solid #dde2e9;border-radius:8px;margin:12px 0}h3{margin:0;font-size:18px}.metrics{background:#e7edf6;padding:12px;border-radius:6px}details{margin:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer}a{color:#1956b8}.note{border-left:4px solid #d69e2e;padding:8px 16px;background:#fff8e5}.toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:16px 0}.badge{font-size:13px;color:#675200;background:#fff3bf;padding:3px 6px;border-radius:4px}@media(max-width:750px){.columns{grid-template-columns:1fr}header,main{padding:16px}}
</style>
<header><h1>Does richer search evidence help?</h1><p>Real results from 5,000 popular titles: 2,500 movies and 2,500 shows. Compare the existing retrieval with combined tags, keywords, trope names and description text. Every column uses the same frozen interpretation of your request.</p>
<p class="note">This is a retrieval experiment, not a production search preview. Vector fill is omitted. Mood-only requests may deliberately show no text results. Timings exclude Jev and precomputed eligibility filters; scratch and source tables differ in size and shard count. New results need your judgment.</p></header>
<main><label for="request">Request</label><select id="request"></select><div class="toolbar"><button id="previous">Previous request</button><button id="next">Next request</button><button id="export">Export judgments</button><span id="progress"></span></div><div id="context"></div>
<div class="columns"><section class="column"><select id="left"></select><div id="leftResults"></div></section><section class="column"><select id="right"></select><div id="rightResults"></div></section></div>
<p class="muted">Judgments stay in this page's memory until you export them. No automatic quality pass is calculated. Strong = directly satisfies the request; acceptable = reasonably fits; wrong = fails the intent or an explicit exclusion.</p></main>
<script>
const data=DATA;
const labels={original:'Original D4+ predicate',corrected:'D4+ with corrected predicate',standard:'Combined evidence · standard',english:'Combined evidence · English stemming',english_boost2:'English stemming · strong evidence ×2'};
const judgments={}; let index=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('request').innerHTML=data.map((r,i)=>`<option value="${i}">${i+1}. ${esc(r.request)}</option>`).join('');
for(const side of ['left','right']){$(side).innerHTML=Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$(side).onchange=render;}
$('left').value='corrected';$('right').value='english';
function render(){
 const c=data[index];$('request').value=index;
 $('context').innerHTML=`<details><summary>Interpretation and sample eligibility</summary><pre>${esc(JSON.stringify({phrases:c.phrases.slice(0,5),filters:c.flags,eligible:c.allowed_counts,weights:c.weights},null,2))}</pre></details>`;
 for(const side of ['left','right']){
  const s=c.summary[$(side).value];const other=c.summary[$(side==='left'?'right':'left').value];const otherKeys=new Set(other.top10.map(t=>t.key));
  $(side+'Results').innerHTML=`<div class="metrics"><b>${s.median_wall_ms.toFixed(1)} ms</b> median retrieval wall time · ${s.candidates} candidates · ${s.query_count} queries<br><small>${s.median_server_sum_ms.toFixed(1)} ms sum of server durations (parallel queries overlap). Five measured repeats.</small></div><p class="muted">${s.gated?'Text search skipped by the existing mood gate.':`Phrases: ${esc(s.searched.join(' / '))}`}</p>`+s.top10.map((r,i)=>{
   const key=index+':'+r.key;const rating=judgments[key]?.rating||'';
   return `<article><h3>${i+1}. <a href="https://www.themoviedb.org/${r.key.startsWith('movie:')?'movie':'tv'}/${r.key.split(':')[1]}" target="_blank" rel="noreferrer">${esc(r.title)}</a> (${r.year})</h3><small>${esc(r.key)} · combined ${r.combined.toFixed(3)} · fingerprint sum ${r.weighted_sum.toFixed(2)}</small> ${otherKeys.has(r.key)?'':'<span class="badge">Only in this top 10</span>'}<p>${esc(r.evidence.join(' / '))}</p><details><summary>Why it matched: source evidence</summary><b>Tags, keywords and tropes</b><pre>${esc(r.strong_evidence)}</pre><b>Description</b><pre>${esc(r.text_evidence)}</pre></details><label>Judgment <select data-key="${key}">${[['','Needs review'],['strong','Strong'],['acceptable','Acceptable'],['wrong','Wrong']].map(([k,v])=>`<option value="${k}" ${rating===k?'selected':''}>${v}</option>`).join('')}</select></label></article>`;
  }).join('');
 }
 for(const el of document.querySelectorAll('[data-key]'))el.onchange=()=>{const key=el.dataset.key; if(el.value)judgments[key]={request:c.request,key:key.slice(key.indexOf(':')+1),rating:el.value};else delete judgments[key];render();};
 $('progress').textContent=`${index+1} / ${data.length} requests · ${Object.keys(judgments).length} title judgments`;
}
$('request').onchange=()=>{index=Number($('request').value);render();};
$('next').onclick=()=>{index=(index+1)%data.length;render();};$('previous').onclick=()=>{index=(index+data.length-1)%data.length;render();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({experiment:'crate-evidence-104',judgments:Object.values(judgments)},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='evidence-search-judgments.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};render();
</script>'''
(OUT/'review.html').write_text(html.replace('DATA',json.dumps(compact,ensure_ascii=False).replace('<','\\u003c')))
print('Wrote comparison artifacts and self-contained review.html')
