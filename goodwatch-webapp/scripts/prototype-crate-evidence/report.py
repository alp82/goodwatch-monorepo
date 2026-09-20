"""Build a self-contained review page from real experiment results."""
import json
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / 'docs/prototypes/crate-evidence'
results = json.loads((HERE/'private/comparison.json').read_text())
assert len(results) == 13, 'Do not publish a partial comparison'
cases = json.loads((HERE/'private/interpretations.json').read_text())
load = json.loads((HERE/'private/load.json').read_text())
review_path = OUT/'assistant-review.json'
reviews = json.loads(review_path.read_text()) if review_path.exists() else {}
compact = []
for result,case in zip(results,cases):
    compact.append({k:v for k,v in result.items() if k!='runs'} | {'flags':case['filters'],'weights':case['weights'],'phrases':case['attributes']['phrases'],'assistant_review':reviews.get(result['request'])})
(OUT/'comparison.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2))
(OUT/'interpretations.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2))
for name in ('load.json','probes.json'):
    (OUT/name).write_text((HERE/'private'/name).read_text())
sample_path=HERE/'private/sample.json'
sample = json.loads(sample_path.read_text())
(OUT/'sample-manifest.json').write_text(json.dumps({'sha256':hashlib.file_digest(sample_path.open('rb'),'sha256').hexdigest(),'titles':[{'media_type':r['media_type'],'tmdb_id':r['tmdb_id']} for r in sample]},indent=2))
(OUT/'timings.json').write_text(json.dumps([{'request':r['request'],'runs':[{k:v for k,v in run.items() if k not in ('top10','candidates')} for run in r['runs']]} for r in results],indent=2))
html = r'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GoodWatch evidence search — prototype review</title>
<style>
*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f5f7;color:#172033}header,main{max-width:1500px;margin:auto;padding:24px}header{padding-bottom:0}h1{margin:0;font-size:28px}h2{font-size:20px}p{max-width:1000px}.muted{color:#586478}select,button{font:inherit;padding:9px;border:1px solid #b6becd;border-radius:6px;background:white}#request{width:100%}.columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.column{min-width:0}article{background:white;padding:16px;border:1px solid #dde2e9;border-radius:8px;margin:12px 0}h3{margin:0;font-size:18px}.metrics{background:#e7edf6;padding:12px;border-radius:6px}details{margin:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer}a{color:#1956b8}.note{border-left:4px solid #d69e2e;padding:8px 16px;background:#fff8e5}.toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:16px 0}.badge{font-size:13px;color:#675200;background:#fff3bf;padding:3px 6px;border-radius:4px}@media(max-width:750px){.columns{grid-template-columns:1fr}header,main{padding:16px}}
.resultHead{display:flex;gap:16px;align-items:flex-start}.resultTitle{min-width:0}.posterButton{flex:0 0 90px;width:90px;padding:0;overflow:hidden;cursor:zoom-in;border:0;background:#e7edf6}.posterThumb{display:block;width:90px;height:135px;object-fit:cover}.noPoster{flex:0 0 90px;width:90px;height:135px;display:grid;place-items:center;font-size:12px;background:#e7edf6}.agentReview{padding:14px;background:#edf1fa;border-radius:8px}dialog{border:0;border-radius:10px;background:#111827;color:white;max-width:96vw;max-height:96vh;padding:14px}dialog::backdrop{background:rgba(0,0,0,.85)}#fullPoster{display:block;max-width:90vw;max-height:78vh;width:auto;height:auto;margin:auto;object-fit:contain}#posterTitle{margin:8px 0;font-size:16px}#closePoster{float:right;cursor:pointer}body:has(dialog[open]){overflow:hidden}
</style>
<header><h1>Does richer search evidence help?</h1><p>Real results from SAMPLE_DESCRIPTION. Compare the existing retrieval with combined tags, keywords, trope names and description text. Every column uses the same frozen interpretation of your request.</p>
<p class="note">This is a retrieval experiment, not a production search preview. Vector fill is omitted. Mood-only requests may deliberately show no text results. Timings exclude Jev and precomputed eligibility filters; scratch and source tables differ in size and shard count. Assistant assessments are separate from your judgments.</p></header>
<main><label for="request">Request</label><select id="request"></select><div class="toolbar"><button id="previous">Previous request</button><button id="next">Next request</button><button id="export">Export judgments</button><span id="progress"></span></div><div class="note"><b>Your initial review of the 5,000-title sample:</b> combined evidence is much faster, but D4+ corrected seems more relevant and combined evidence more generic. Neither is perfect. This enlarged sample tests that impression.</div><div id="assessment"></div><div id="context"></div>
<div class="columns"><section class="column"><select id="left"></select><div id="leftResults"></div></section><section class="column"><select id="right"></select><div id="rightResults"></div></section></div>
<p class="muted">Judgments stay in this page's memory until you export them. No automatic quality pass is calculated. Strong = directly satisfies the request; acceptable = reasonably fits; wrong = fails the intent or an explicit exclusion.</p></main><dialog id="posterDialog" aria-labelledby="posterTitle"><button id="closePoster" aria-label="Close full-size poster">Close ✕</button><h2 id="posterTitle"></h2><img id="fullPoster" alt=""><p id="posterError" hidden>Poster could not be loaded.</p></dialog>
<script>
const data=DATA;
const labels={original:'Original D4+ predicate',corrected:'D4+ with corrected predicate',standard:'Combined evidence · standard',english:'Combined evidence · English stemming',english_boost2:'English stemming · strong evidence ×2',english_phrase:'English stemming · restored phrase bonus'};
const experimentMeta=META;
const judgments={}; let index=0;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('request').innerHTML=data.map((r,i)=>`<option value="${i}">${i+1}. ${esc(r.request)}</option>`).join('');
for(const side of ['left','right']){$(side).innerHTML=Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$(side).onchange=render;}
$('left').value='corrected';$('right').value='english';
function render(){
 const c=data[index];$('request').value=index;
 const review=c.assistant_review; $('assessment').innerHTML=review?`<details class="agentReview"><summary>Assistant assessment · ${esc(review.preference)}</summary><p>${esc(review.assessment)}</p><p><b>Next experiment:</b> ${esc(review.next_experiment)}</p><small>Independent, provisional assessment from the result evidence; not your rating.</small></details>`:'';
 $('context').innerHTML=`<details><summary>Interpretation and sample eligibility</summary><pre>${esc(JSON.stringify({phrases:c.phrases.slice(0,5),filters:c.flags,eligible:c.allowed_counts,weights:c.weights},null,2))}</pre></details>`;
 for(const side of ['left','right']){
  const s=c.summary[$(side).value];const other=c.summary[$(side==='left'?'right':'left').value];const otherKeys=new Set(other.top10.map(t=>t.key));
  $(side+'Results').innerHTML=`<div class="metrics"><b>${s.median_wall_ms.toFixed(1)} ms</b> median retrieval wall time · ${s.candidates} candidates · ${s.query_count} queries<br><small>${s.median_server_sum_ms.toFixed(1)} ms sum of server durations (parallel queries overlap). Five measured repeats.</small></div><p class="muted">${s.gated?'Text search skipped by the existing mood gate.':`Phrases: ${esc(s.searched.join(' / '))}`}</p>`+s.top10.map((r,i)=>{
   const key=index+':'+r.key;const rating=judgments[key]?.rating||'';
   const poster=r.poster_path && /^\/[A-Za-z0-9._-]+$/.test(r.poster_path) ? r.poster_path : null;
   const posterHtml=poster?`<button class="posterButton" data-poster="${esc(poster)}" data-title="${esc(r.title)}" aria-label="View full-size poster for ${esc(r.title)}"><img class="posterThumb" src="https://image.tmdb.org/t/p/w185${esc(poster)}" alt="${esc(r.title)} poster" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>Poster unavailable</span></button>`:'<div class="noPoster">No poster</div>';
   return `<article><div class="resultHead">${posterHtml}<div class="resultTitle"><h3>${i+1}. <a href="https://www.themoviedb.org/${r.key.startsWith('movie:')?'movie':'tv'}/${r.key.split(':')[1]}" target="_blank" rel="noreferrer">${esc(r.title)}</a> (${r.year})</h3><small>${esc(r.key)} · combined ${r.combined.toFixed(3)} · fingerprint sum ${r.weighted_sum.toFixed(2)}</small> ${otherKeys.has(r.key)?'':'<span class="badge">Only in this top 10</span>'}</div></div><p>${esc(r.evidence.join(' / '))}</p><details><summary>Why it matched: source evidence</summary><b>Tags, keywords and tropes</b><pre>${esc(r.strong_evidence)}</pre><b>Description</b><pre>${esc(r.text_evidence)}</pre></details><label>Your judgment <select data-key="${key}">${[['','Needs review'],['strong','Strong'],['acceptable','Acceptable'],['wrong','Wrong']].map(([k,v])=>`<option value="${k}" ${rating===k?'selected':''}>${v}</option>`).join('')}</select></label></article>`;
  }).join('');
 }
 for(const el of document.querySelectorAll('[data-poster]'))el.onclick=()=>{const img=$('fullPoster');img.hidden=false;$('posterError').hidden=true;img.alt=el.dataset.title+' poster';$('posterTitle').textContent=el.dataset.title;img.src='https://image.tmdb.org/t/p/original'+el.dataset.poster;$('posterDialog').showModal();};
 for(const el of document.querySelectorAll('[data-key]'))el.onchange=()=>{const key=el.dataset.key; if(el.value)judgments[key]={request:c.request,key:key.slice(key.indexOf(':')+1),rating:el.value};else delete judgments[key];render();};
 $('progress').textContent=`${index+1} / ${data.length} requests · ${Object.keys(judgments).length} title judgments`;
}
$('closePoster').onclick=()=>$('posterDialog').close();
$('posterDialog').onclick=e=>{if(e.target===$('posterDialog')){const r=$('posterDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('posterDialog').close();}};
$('fullPoster').onerror=()=>{$('fullPoster').hidden=true;$('posterError').hidden=false;};
$('request').onchange=()=>{index=Number($('request').value);render();};
$('next').onclick=()=>{index=(index+1)%data.length;render();};$('previous').onclick=()=>{index=(index+data.length-1)%data.length;render();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({experiment:'crate-evidence-104',sample:experimentMeta,reviewer:'user',judgments:Object.values(judgments)},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='evidence-search-judgments.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};render();
</script>'''
description=f"{sum(r['n'] for r in load['counts']):,} titles: "+', '.join(f"{r['n']:,} {r['media_type']} titles" for r in load['counts'])
(OUT/'review.html').write_text(html.replace('SAMPLE_DESCRIPTION',description).replace('META',json.dumps(load)).replace('DATA',json.dumps(compact,ensure_ascii=False).replace('<','\\u003c')))
print('Wrote comparison artifacts and self-contained review.html')
