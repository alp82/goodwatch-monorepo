"""Render cheap-search rounds beside the immutable original 13-request comparison.

Reuses the local poster, assessment and judgment UI. No retrieval or model calls.
Inputs use the rounds/variants/cases/results schema of loop_report.py.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from consolidate_loop import original_comparison_round, compact
from loop_report import HTML

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DOCS = ROOT / 'docs/prototypes/crate-evidence'


def build(inputs, original_path, cost_path, reviews=()):
    rounds = []
    for path in inputs:
        document = json.loads(Path(path).read_text(encoding='utf-8'))
        loaded = copy.deepcopy(document['rounds'])
        for round_ in loaded:
            for case in round_.get('cases', []):
                for run in case.get('results', {}).values():
                    run['top10'] = [{**document.get('title_sources', {}).get(t.get('source_ref'), {}), **document.get('evidence_sets', {}).get(t.get('evidence_ref'), {}), **t} for t in run.get('top10', [])]
                    for title in run['top10']:
                        title.pop('source_ref', None)
                        title.pop('evidence_ref', None)
                    if not run.get('cheap_timing') and not run.get('diagnostics', {}).get('timing_kind') == 'original_measured_retrieval_median':
                        d = run.get('diagnostics', {})
                        run['cheap_timing'] = {
                            'warm_rerank_ms': d.get('local_rank_only_median_ms', d.get('local_total_median_ms')),
                            'candidate_preparation_ms': d.get('candidate_preparation_ms'),
                            'local_total_ms': d.get('local_total_median_ms'),
                            'cold_prepare_ms': document.get('startup_ms'),
                            'retrieval_ms': d.get('frozen_retrieval_ms'),
                            'retrieval_label': 'frozen original source retrieval; union projections are not measured new SQL',
                            'cold_scope': 'Once per process sample load and shared index; not per-request model latency',
                        }
                        run.setdefault('baseline_model_cost_usd', d.get('original_jev_model_cost_usd'))
        rounds.extend(loaded)
    for round_number, review_path in reviews:
        document = json.loads(Path(review_path).read_text(encoding='utf-8'))
        by_id = {case['id']: case for case in document['cases']}
        by_request = {case['request']: case for case in document['cases'] if 'request' in case}
        for case in rounds[int(round_number) - 1].get('cases', []):
            review = by_id.get(case['id']) or by_request.get(case['request'])
            if review:
                case.setdefault('assessments', []).append({'source': Path(review_path).name, **review})
                case['assessment'] = review
    cost_data = json.loads(Path(cost_path).read_text(encoding='utf-8')) if cost_path else None
    primary = original_comparison_round(original_path, [], cost_data)
    primary['name'] = 'Final comparison · original 13 requests'
    primary['variants'] = [v for v in primary['variants'] if v['id'] in {'original', 'corrected', 'standard', 'english', 'english_boost2', 'english_phrase'}]
    original_ids = {v['id'] for v in primary['variants']}
    cases = {case['request']: case for case in primary['cases']}
    metadata = {}
    for round_ in rounds:
        round_['kind'] = 'supplemental'
        for variant in round_.get('variants', []):
            if 'awaiting independent review' in variant.get('reason', ''):
                variant['reason'] = 'Reviewed experimental alternative; no universal replacement accepted.'
        for variant in round_.get('variants', []):
            if variant['id'] not in original_ids:
                if variant.get('primary_visible', True):
                    metadata[variant['id']] = copy.deepcopy(variant)
        for case in round_.get('cases', []):
            target = cases.get(case['request'])
            if target is None:
                continue  # Supplemental requests never replace primary requests.
            for variant_id, result in case.get('results', {}).items():
                if variant_id in original_ids:
                    continue  # Never replace an original list with a later control.
                target['results'][variant_id] = copy.deepcopy(result)
                run = target['results'][variant_id]
                run.setdefault('diagnostics', {})['comparison_round'] = round_['name']
                run['diagnostics']['cost_scope'] = 'Actual paired capture cost; changed interpretation disclosed; no extra runtime stage.' if run.get('cost_policy') == 'actual_capture' else 'Same original interpretation; zero additional runtime model calls or tokens.'
                base = target['results']['corrected'].get('baseline_model_cost_usd')
                if run.get('cost_policy') != 'actual_capture':
                    run.update(baseline_model_cost_usd=base, extra_model_cost_usd=0, cost_usd=base)
            if case.get('assessments'):
                target.setdefault('assessments', []).extend(copy.deepcopy(case['assessments']))
            elif case.get('assessment', {}).get('assessment'):
                target.setdefault('assessments', []).append({'source': round_['name'] + ' independent assessment', **copy.deepcopy(case['assessment'])})
    primary['variants'].extend(v for key,v in metadata.items() if any(key in c['results'] for c in primary['cases']))
    visible_ids = {v['id'] for v in primary['variants']}
    for case in primary['cases']:
        case['results'] = {k:v for k,v in case['results'].items() if k in visible_ids}
    final_review = json.loads((DOCS / 'cheap-loop-final-assessment.json').read_text(encoding='utf-8'))
    by_request = {case['request']: case for case in final_review['requests']}
    for case in primary['cases']:
        case['final_assessment'] = by_request[case['request']]
    primary['default_variants'] = {'left': 'corrected', 'right': 'english'}
    primary['final_visible_ids'] = ['corrected', 'english', 'english_phrase', 'clean_english_native_combined']
    # No winner is inferred from scores or the most recent round.
    return {'schema_version': 1, 'rounds': rounds + [primary], 'final_review': final_review, 'overall': {
        'winner_id': None, 'title': 'Same requests. Cheap-loop results.',
        'summary': 'Compare cheap deterministic variants against the exact six original retrieval lists. The original 13 requests remain primary. Unchanged-interpretation ranking arms share the original model cost. Paired interpretation trials disclose their own captured cost; no extra runtime model stage is added. Quality, local overhead and retrieval scope must all hold before choosing a variant. The tested loop is complete: no global winner. Conservative catalog cleanup is a narrow retained improvement; useful gains elsewhere still come with material regressions. This is a practical stop for the tested mechanisms, not proof that all algorithms are exhausted.',
        'limitations': [
            'Original retrieval timings are frozen measured medians; new local reranking timings do not establish new Crate or production end-to-end latency.',
            'Cold preparation/index work and warm ranking must be reported separately. Cached candidate retrieval is not free live retrieval.',
            'Gated mood and parents requests have no original text results and omit production vector fill; they are not complete-search quality or speed wins.',
            'Supplemental requests are already seen regression/stress cases, not fresh held-out validation.',
            'Assistant evidence judgments are separate from user ratings and deterministic ranking explanations.',
        ], 'original_comparison_source': str(original_path)},
        'sources': [str(path) for path in inputs]}


def finalize_decisions(data):
    """Editorial dispositions from completed reviews, never inferred from rank."""
    originals={'original','corrected','standard','english','english_boost2','english_phrase'}
    reasons={
        'Lexical and centrality':'Useful object/driver gains, but wealth relations and mood constraints regress; no universal default.',
        'Native SQL':'Query-shape alternatives do not consistently beat the strongest controls; artifact and subject errors remain.',
        'Shortlist':'Some faster, strong lists; material per-request regressions prevent a universal replacement.',
        'Hygiene':'Conservative identity cleanup helps, but does not validate the underlying experimental ranker.',
        'Structural conjunction':'Improves two original requests; fails older-robbery and peaceful-alien supplemental cases.',
        'Normalization':'Arrival and workplace gains are real; car-pursuit regression and overhead outliers reject the default.',
        'Paired interpretation':'Semantic revision loses the long-tense lexical path; candidate-only revision shows no clear result gain.',
    }
    for rr in data['rounds']:
        for v in rr['variants']:
            key=v['id'];family=v.get('family') or 'Lexical and centrality'
            v['family']=family
            if key in originals:
                v.update(status='baseline',disposition='Baseline',reason='Immutable original control. No new ranking behavior; retain for comparison.',default_visible=key in {'corrected','english','english_phrase'})
            elif key=='clean_english_native_combined':
                v.update(status='retained',disposition='Retained narrow gain',label='English + conservative catalog cleanup',reason='Removes source-identified attraction/pilot artifacts, with relevant replacements. No extra model calls. This is a narrow cleanup gain, not a global ranking winner.',default_visible=True)
            elif key.startswith('superseded_') or v.get('status')=='discarded':
                v.update(status='discarded',disposition='Historical / superseded',default_visible=False)
            elif key.startswith('native_live_') and key.removeprefix('native_live_') in originals or key.startswith('supplemental_') and 'preconjunction' not in key:
                v.update(status='baseline',disposition='Fresh baseline',reason='Fresh measured control; kept separate from original immutable rankings.',default_visible=False)
            else:
                reason=reasons.get(family,reasons['Lexical and centrality'])
                v.update(status='discarded',disposition='Rejected default',reason=reason,default_visible=key in {'joint_anti64','stem_general_snowball'})
                if key=='joint_anti64':v['label']='Pre-cap conjunction + anti64 (promising, rejected default)'
                if key=='stem_general_snowball':v['label']='Stemming + shortlist (mixed gains, rejected default)'
    data['overall'].update(title='Final assessment: no overall winner',summary='Keep the inexpensive controls. Retain conservative catalog cleanup as a narrow improvement. Reject the tested universal ranking replacements: their gains come with material request regressions or excess local work. The bounded loop is complete; this does not prove every possible algorithm is exhausted.')
    data['overall']['decisions']=[
        {'family':'Original controls','disposition':'Baseline','reason':'Corrected D4+, combined English and English phrase remain useful alternatives.'},
        {'family':'Conservative catalog cleanup','disposition':'Retained narrow gain','reason':'Removes explicit attraction/nonreleased-pilot records; keeps ordinary adaptations and ambiguous shorts.'},
        *[{'family':family,'disposition':'Rejected default','reason':reason} for family,reason in reasons.items() if family!='Hygiene'],
        {'family':'Superseded technical runs','disposition':'Historical / superseded','reason':'Routing, recall, fallback and polarity-control corrections are preserved as history, not winning evidence.'},
    ]
    return data


def pack(document):
    """Deduplicate display sources; preserve ranking scores, evidence and timing."""
    result = compact(copy.deepcopy(document))
    sources, evidence, pools = {}, {}, {}
    def deduplicate_pools(value):
        if isinstance(value, dict):
            for key in list(value):
                item = value[key]
                if key == 'candidate_keys' and isinstance(item, list):
                    ref = hashlib.sha256(json.dumps(item).encode()).hexdigest()[:20]
                    pools.setdefault(ref, item)
                    value.pop(key)
                    value['candidate_pool_ref'] = ref
                else:
                    deduplicate_pools(item)
        elif isinstance(value, list):
            for item in value: deduplicate_pools(item)
    deduplicate_pools(result)
    fields = {'title', 'year', 'release_year', 'tmdb_id', 'media_type', 'poster_path', 'synopsis', 'essence_text', 'votes'}
    for round_ in result['rounds']:
        for case in round_.get('cases', []):
            for run in case.get('results', {}).values():
                for title in run.get('top10', []):
                    for selected, table, ref_key in [(fields, sources, 'source_ref'), ({'evidence', 'score_explanation', 'matched_source_tags'}, evidence, 'evidence_ref')]:
                        record = {k: title.pop(k) for k in list(title) if k in selected}
                        if record:
                            ref = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
                            table.setdefault(ref, record)
                            title[ref_key] = ref
    result.update(title_sources=sources, evidence_sets=evidence, candidate_pools=pools,
        compact_format='Merge title_sources[source_ref], evidence_sets[evidence_ref], then each top10 record. Full raw source remains in private run artifacts.')
    return result


CHEAP_METRICS = r'''function metrics(r){const d=r.diagnostics||{};if(d.timing_kind==='original_measured_retrieval_median')return originalMetrics(r);const t=r.cheap_timing||{};return `<div class="metrics"><b>${ms(t.warm_rerank_ms??r.local_rerank_ms)}</b> local ranking only<br><b>${ms(t.hygiene_ms)}</b> optional hygiene filter<br><b>${ms(t.candidate_preparation_ms)}</b> per-request candidate preparation<br><b>${ms(t.local_total_ms)}</b> total local preparation + selection + ranking<br><b>${ms(t.cold_prepare_ms??r.cold_prepare_ms)}</b> cold preparation/index work<br><b>${ms(t.retrieval_ms)}</b> ${esc(t.retrieval_label||'retrieval timing not supplied')}<p><b>${cost(r.baseline_model_cost_usd)}</b> ${r.cost_policy==='actual_capture'?'actual paired interpretation (shared fingerprints)':'shared original interpretation'}<br><b>+ $0.000000</b> extra runtime stage cost</p><small>Local timings do not measure new live SQL or full production search. Missing values remain unknown.</small></div>${r.error?`<p class="note">Run error: ${esc(pretty(r.error))}</p>`:''}<details><summary>Timing, candidate and scoring provenance</summary><pre>${esc(pretty({timing:t,diagnostics:d}))}</pre></details>`;}
'''



FINAL_PRESENTATION = r"""
function reviewParagraph(label,value){return value?`<p><b>${esc(label)}</b> ${esc(Array.isArray(value)?value.join(' '):value)}</p>`:'';}
function cleanupComparison(c){const before=c?.results?.native_live_english;return before?`<aside class="panel note"><h3>Cleanup uses the fresh English run</h3><p>This option filters the newly measured native English result; it is not a rerun of the frozen original English list. The matching pre-cleanup top 10 is:</p><ol>${(before.top10||[]).map(t=>`<li>${esc(t.title||t.key)}</li>`).join('')}</ol><p>The filter removes only supported attraction/pilot identities. Retrieval and filter timings remain separate below.</p><details><summary>Matching source-control measurements</summary>${metrics(before)}</details></aside>`:'';}
function finalAssessment(c){const a=c?.final_assessment;if(!a)return '';return `<h2>Final assistant assessment</h2><p class="verdict">${esc(a.verdict)}</p>${reviewParagraph('Baseline judgment:',a.preferredBaseline)}${reviewParagraph('What improved:',a.improved)}${reviewParagraph('Why alternatives were not adopted:',a.notAdopted)}${reviewParagraph('Limits:',a.limits)}<small>This is the final synthesis across the tested rounds. Assistant judgments are separate from your ratings.</small>`;}
function renderFinalOverview(){const f=data.final_review||{},o=f.overall||{};const rows=(items,status)=>items.map(item=>`<tr><td><span class="badge">${esc(item.decision||status)}</span></td><td><b>${esc(item.label)}</b></td><td>${esc(item.reason)}</td></tr>`).join('');$('overall').innerHTML=`<p class="eyebrow">Final decision · loop complete</p><h2>${esc(o.verdict||'No replacement for the existing baselines')}</h2><p>${esc(o.summary)}</p>${reviewParagraph('Recommendation:',o.defaultRecommendation)}<p><b>Fixed comparison:</b> 13 original requests · 50,000 titles · 28 separate regression requests. <b>New experiment API spend:</b> $0.0061. No added runtime model stage.</p><div class="decisionTable"><table><thead><tr><th>Decision</th><th>Approach</th><th>Final assessment</th></tr></thead><tbody>${rows(f.retainedChoices||[],'Retain')}${rows(f.rejectedFamilies||[],'Discard')}</tbody></table></div>${reviewParagraph('Limits:',o.limits)}${reviewParagraph('Production status:',o.deploymentStatus)}<p><a href="cheap-loop-findings.md">Full findings and stopping rationale</a> · <a href="cheap-loop-protocol.md">Evaluation protocol</a> · <a href="cheap-loop-spend.json">Experiment spend</a></p>`;}
function setHistory(){const history=$('discarded').checked;const previous=ri;if(!history)ri=rounds.findIndex(r=>r.kind==='primary');$('round').innerHTML=rounds.map((r,i)=>(history||r.kind==='primary')?option(i,r.name):'').join('');$('round').value=ri;$('roundPicker').hidden=!history;$('historySearch').hidden=!history;$('historyNotice').hidden=!history;if(!history)$('variantSearch').value='';if(previous!==ri)setRound();else setVariants();}
renderFinalOverview();setHistory();
"""


def final_presentation(template):
    """Make the decision the default view; retain the complete archive on request."""
    template = template.replace('<h1>Cheap search variants</h1>', '<h1>Search experiment · final review</h1>')
    template = template.replace('The original 13 requests and six original retrieval variants remain primary. New variants add no runtime model calls. Candidate ranking explanations are not quality judgments. Assistant opinions remain separate from your judgments.', 'The loop is complete. Review the decision first, then compare the retained baselines on the original requests. Rejected experiments are available in the archive.')
    template = template.replace('<label>Comparison <select id="round"></select></label>', '<label id="roundPicker" hidden>Archived comparison <select id="round"></select></label>')
    template = template.replace('Show discarded variants', 'Open experiment history (includes discarded variants)')
    template = template.replace('<label>Find variant <input id="variantSearch" type="search" placeholder="Name or family"></label>', '<label id="historySearch" hidden>Find archived variant <input id="variantSearch" type="search" placeholder="Name or family"></label><p id="historyNotice" class="note" hidden>History mode: these are archived experiments and intermediate assessments, not additional accepted options.</p>')
    begin = template.index('const visibleVariants=')
    end = template.index('\n', begin)
    template = template[:begin]+"const visibleVariants=()=>(currentRound().variants||[]).filter(v=>($('discarded').checked||(currentRound().final_visible_ids||[]).includes(v.id))&&(!document.getElementById('variantSearch')?.value||((v.label||v.id)+' '+(v.family||'')).toLowerCase().includes(document.getElementById('variantSearch').value.toLowerCase())));"+template[end:]
    template = template.replace("$('discarded').onchange=setVariants", "$('discarded').onchange=setHistory")
    template = template.replace("if(c?.assessments?.length){", "if($('discarded').checked&&c?.assessments?.length){")
    marker = "for(const side of ['left','right']){const id=$(side).value"
    template = template.replace(marker, "if(c?.final_assessment){const history=$('discarded').checked?`<details class=\"assessmentHistory\"><summary>Earlier assessments for this request</summary>${$('assessment').innerHTML}</details>`:'';$('assessment').innerHTML=finalAssessment(c)+history;}\n"+marker)
    template = template.replace("+(r.variants||[]).map(v=>option(v.id,v.label||v.id)).join('')", "+variants.map(v=>option(v.id,v.label||v.id)).join('')")
    # Variant provenance belongs below the decision and selected request, not in a wall of panels.
    template = template.replace("$('variantNotes').innerHTML=variants.map", "$('variantNotes').innerHTML=($('discarded').checked?variants:[]).map")
    template = template.replace(".join('')||'<p class=\"note\">No surviving variants in this round. Enable “Open experiment history (includes discarded variants)” to inspect them.</p>';", ".join('');")
    template = template.replace('<label for="request">Request</label>', '<h2>Compare the retained baselines</h2><p>Default choices: corrected D4+, combined English evidence, the original phrase-bonus control, and conservative catalog cleanup. Cleanup is a narrow retained change, not a new overall winner.</p><label for="request">Original request</label>')
    template = template.replace("':metrics(result)+(Array.isArray(result.top10)", "':(id==='clean_english_native_combined'?cleanupComparison(c):'')+metrics(result)+(Array.isArray(result.top10)")
    template = template.replace('</style>', '.eyebrow{text-transform:uppercase;letter-spacing:.06em;font-size:12px;font-weight:700;color:#52617c}.verdict{font-size:18px;font-weight:650}#overall h2{font-size:26px;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:12px 8px;border-bottom:1px solid #dde2e9}th:first-child{width:110px}.decisionTable{overflow:auto}.assessmentHistory{margin-top:20px}[hidden]{display:none!important}</style>')
    template = template.replace('</script></html>', FINAL_PRESENTATION+'</script></html>')
    return template

def render(inputs, output_dir=DOCS, original_path=DOCS/'comparison.json', cost_path=DOCS/'matched-comparison-metrics.json', reviews=()):
    data = pack(finalize_decisions(build(inputs, original_path, cost_path, reviews)))
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir/'cheap-loop-results.json'
    json_path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n', encoding='utf-8')
    template = HTML.replace('<title>Original search comparison — cost and quality</title>', '<title>Cheap search variants — original 13 requests</title>')
    template = template.replace('<div id="variantNotes"></div>', '<label>Find variant <input id="variantSearch" type="search" placeholder="Name or family"></label><div id="variantNotes"></div>')
    template = template.replace("const visibleVariants=()=>(currentRound().variants||[]).filter(v=>$('discarded').checked||v.status!=='discarded');", "const visibleVariants=()=>(currentRound().variants||[]).filter(v=>($('discarded').checked||v.default_visible)&&(!document.getElementById('variantSearch')?.value||((v.label||v.id)+' '+(v.family||'')).toLowerCase().includes(document.getElementById('variantSearch').value.toLowerCase())));")
    template = template.replace('function setRound(){', "document.getElementById('variantSearch').oninput=()=>setVariants();function setRound(){")
    template = template.replace('<h1>Original search comparison</h1>', '<h1>Cheap search variants</h1>')
    template = template.replace('The same 13 requests and original retrieval variants are the primary comparison. Higher-cost model experiments are supplemental; their cost tradeoff has not been accepted.', 'The original 13 requests and six original retrieval variants remain primary. New variants add no runtime model calls. Candidate ranking explanations are not quality judgments.')
    template = template.replace('href="loop-findings.md">Findings and limitations', 'href="cheap-loop-protocol.md">Evaluation protocol')
    template = template.replace(' · <a href="matched-comparison-metrics.json">Same-request cost comparison</a> · <a href="spend-summary.json">Actual experiment spend</a>', '')
    template = template.replace('function metrics(r)', 'function originalMetrics(r)', 1)
    template = template.replace('function titleCard(', CHEAP_METRICS+'function titleCard(', 1)
    template = template.replace('Supplemental history · includes other requests', 'Cheap round history · scope labeled per request')
    template = template.replace('Model-generated reason · unverified', 'Ranking explanation · not an independent judgment')
    template = template.replace('No model-generated reason supplied.', 'No ranking explanation supplied.')
    template = template.replace('matched_source_tags:t.matched_source_tags,', 'score_explanation:t.score_explanation,matched_source_tags:t.matched_source_tags,')
    template = template.replace('</main>', '<p><a href="cheap-loop-spend.json">Current cheap-loop actual API spend</a> · <a href="cheap-loop-findings.md">Current findings and open questions</a></p></main>')
    start = template.index("$('variantNotes').innerHTML=")
    end = template.index(";$('request').value=ci;", start)
    template = template[:start]+"$('variantNotes').innerHTML=[...new Set([$ ('left').value,$ ('right').value])].map(id=>(r.variants||[]).find(v=>v.id===id)).filter(Boolean).map(v=>`<p><b>${esc(v.label||v.id)} — ${esc(v.disposition)}</b><br>${esc(v.reason)}</p>`).join('')".replace("$ (", "$(")+template[end:]
    template = template.replace("${v.status||'status unknown'}", "${v.disposition||v.status||'status unknown'}")
    template = template.replace("(a.source?.includes('independent')||a.source?.startsWith('Original'))?'open':''", "false?'open':''")
    template = template.replace("':metrics(result)+(Array.isArray(result.top10)", "':(id==='clean_english_native_combined'?cleanupComparison(c):'')+metrics(result)+(Array.isArray(result.top10)")
    template = template.replace('</style>', 'table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #dde2e9}#overall{border-left:5px solid #35527a}#variantNotes{font-size:14px}#variantNotes p{margin:8px 0}#assessment h2{margin-top:0}</style>')
    template = final_presentation(template)
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    (output_dir/'cheap-loop-review.html').write_text(template.replace('__RESULTS_JSON__', payload), encoding='utf-8')
    return json_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', nargs='*', type=Path)
    parser.add_argument('--output-dir', type=Path, default=DOCS)
    parser.add_argument('--original-comparison', type=Path, default=DOCS/'comparison.json')
    parser.add_argument('--cost-review', type=Path, default=DOCS/'matched-comparison-metrics.json')
    parser.add_argument('--review', nargs=2, action='append', default=[], metavar=('ROUND', 'JSON'))
    args = parser.parse_args()
    print(render(args.inputs, args.output_dir, args.original_comparison, args.cost_review, args.review))
