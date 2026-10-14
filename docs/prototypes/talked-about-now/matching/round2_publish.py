#!/usr/bin/env python3
"""Offline metrics and renderer JSON. Never builds a review page."""
from round2_matcher import *
from collections import Counter, defaultdict
import math

LANES=['official_video_id','foreground_exact','alt_title_context','foreground_fuzzy','vector_context']
def wilson(tp,n):
 if not n:return None
 z=1.96;p=tp/n;d=1+z*z/n;c=(p+z*z/(2*n))/d;a=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
 return [c-a,c+a]
def metrics():
 sample=read('fresh-sample.json');labels={x['id']:x for x in read('labels.json')};preds={x['id']:x for x in read('predictions.json')};props=read('candidates.json')
 assert len(sample)==len(labels)==200
 out={'definitions':{'precision':'correct emitted title links / all emitted title links','recall':'positive catalog-linkable items with at least one correct link / all positive catalog-linkable items','entity_recall':'correct emitted title links / catalog-linkable gold title links','lane_recall':'lane correct links / gold title links in its source; contribution, not unresolved-cohort recall','ambiguous':'excluded from scoring, retained as unsure labels','confidence':'uncalibrated rule score or LLM self-report, not measured probability'},'by_source':{},'by_lane':{},'by_source_lane':{}}
 def score(group,lane=None):
  eligible=[x for x in group if not labels[x['id']].get('ambiguous')];tp=fp=fn=positive=right_items=named=gold_total=tn=0
  for x in eligible:
   gold=set(labels[x['id']]['gold']);links=[l for l in preds[x['id']]['links'] if lane is None or l['lane']==lane];actual={l['key'] for l in links}
   tp+=len(gold & actual);fp+=len(actual-gold);fn+=len(gold-actual);gold_total+=len(gold)
   positive+=bool(gold);right_items+=bool(gold & actual);named+=bool(labels[x['id']]['targets']);tn+=not gold and not actual
  return {'items':len(eligible),'unsure':len(group)-len(eligible),'tp':tp,'fp':fp,'fn':fn,'positive_items':positive,'named_positive_items':named,'gold_entities':gold_total,'correctly_linked_items':right_items,
          'precision':tp/(tp+fp) if tp+fp else None,'recall':right_items/positive if positive else None,'entity_recall':tp/gold_total if gold_total else None,'end_to_end_item_recall':right_items/named if named else None,'precision_95_wilson':wilson(tp,tp+fp),'correct_abstentions':tn}
 for source in ['youtube','rss','bluesky','all']:
  group=[x for x in sample if source=='all' or x['source']==source];out['by_source'][source]=score(group)
  out['by_source_lane'][source]={lane:score(group,lane) for lane in LANES}
 for lane in LANES:out['by_lane'][lane]=score(sample,lane)
 out['snapshot']={'sample_sha256':fingerprint(sample),'rules_sha256':read('frozen-rules.json')['logic_sha256'],'labeled_items':len(labels),'corpus_items':len(read('corpus.json'))}
 ledger=[json.loads(s) for s in (R2/'api-charges.jsonl').read_text().splitlines()]
 costs={phase:sum(r['usage'].get('cost',0) or 0 for r in ledger if r['phase']==phase) for phase in ['extract','gate']}
 out['reported_cost']={'journal_usd_by_phase':costs,'journal_usd':sum(costs.values()),'journal_requests':len(ledger),'journal_usd_per_1000_inputs':sum(costs.values())*1000/out['snapshot']['corpus_items'],'complete_billing_reconciliation':False,'note':'Lower bound from returned OpenRouter usage.cost, including journaled retries. Some interrupted extraction requests preceded journal logging; timeout/non-returned request billing is unknown. Local embeddings and production reads have no per-item API charge here; compute/operations costs excluded.'}
 save('metrics.json',out);print(json.dumps(out['by_source'],indent=2))

def export():
 corpus=read('corpus.json');preds={x['id']:x for x in read('predictions.json')};labels={x['id']:x for x in read('labels.json')};buzz=read('buzz-top-titles.json')
 # Old annotations only decorate display links; none enter round-two metrics or matcher.
 old_items=json.loads((DATA/'sample.json').read_text());old_labels={x['id']:x for x in json.loads((DATA/'labels.json').read_text())}
 old_by_source_id={x['source_id']:old_labels[x['id']] for x in old_items}
 catalog={x['key']:x for x in read('candidate-catalog.json')};grouped=defaultdict(list)
 for item in corpus:
  p=preds[item['id']]
  for link in p['links']:
   label=labels.get(item['id']);label_set='round2' if label else None
   if label is None and item['source_id'] in old_by_source_id:label=old_by_source_id[item['source_id']];label_set='round1_display_only'
   status=None
   if label:status='unsure' if label.get('ambiguous') else 'right' if link['key'] in label['gold'] else 'wrong'
   grouped[link['key']].append({'post_id':item['id'],'source_id':item['source_id'],'source':item['source'],'url':item['url'],'author':item['author'],
    'author_id':item.get('author_did') or item.get('channel_id'),'publisher':item.get('publisher') or item['author'],'timestamp':item['published_at'],
    'timestamp_precision':item.get('timestamp_precision','timestamp'),'text':item['text'],'headline':item['text'] if item['source'] in ['youtube','rss'] else None,
    'context':foreground(item)['description'],'lane':link['lane'],'stage':link['stage'],'confidence':link['confidence'],'confidence_basis':link['confidence_basis'],
    'match_reason':link['reason'],'discovery':item['discovery'],'hand_label':status,'hand_label_set':label_set,'hand_label_note':label.get('ambiguous') or label.get('note') if label else None})
 ranks=sorted(grouped,key=lambda k:(-len({p['source_id'] for p in grouped[k]}),k));top=ranks[:25];buzz_by={x['key']:x for x in buzz['titles']}
 # Include held-out wrong links as visible diagnostics; selection does not change scores.
 diagnostics=sorted({link['key'] for id,label in labels.items() if not label.get('ambiguous') for link in preds[id]['links'] if link['key'] not in label['gold']})
 selected=set(top)|set(buzz_by)|set(diagnostics)
 # Hydrate selected IDs, including exact clean-lane links absent from text candidates.
 for kind,table in [('movie','movie'),('tv','show')]:
  ids=[int(k.split(':')[1]) for k in selected if k.startswith(kind+':')]
  for r in crate(f'SELECT tmdb_id,title,original_title,release_year FROM {table} WHERE tmdb_id=ANY(?)',[ids]):
   k=kind+':'+str(r['tmdb_id']);catalog[k]=catalog.get(k,{})|r|{'key':k,'media_type':kind}
 titles=[]
 for key in sorted(selected,key=lambda k:(0 if k in top else 1 if k in buzz_by else 2,top.index(k) if k in top else min(buzz_by[k]['buzz_ranks'].values()) if k in buzz_by else 0,k)):
  row=catalog.get(key) or {'title':buzz_by[key]['title'],'release_year':None};posts=list({p['source_id']:p for p in grouped[key]}.values());posts.sort(key=lambda p:p['timestamp'],reverse=True)
  general=sum(not all(d.startswith('buzz_targeted:') for d in p['discovery']) for p in posts)
  b=buzz_by.get(key);titles.append({'key':key,'tmdb_id':int(key.split(':')[1]),'type':key.split(':')[0],'title':row.get('title') or row.get('original_title') or (b['title'] if b else key),'year':row.get('release_year'),
   'post_count':len(posts),'general_discovery_post_count':general,'buzz_targeted_only_post_count':len(posts)-general,'source_counts':dict(Counter(p['source'] for p in posts)),
   'selection':{'top_post_count_rank':top.index(key)+1 if key in top else None,'buzz_ranks':b['buzz_ranks'] if b else {},'buzz_scores':b['scores'] if b else {},'buzz_date':buzz['day'] if b else None,'diagnostic_wrong_link':key in diagnostics},'posts':posts})
 collection=read('collection-audit.json');m=read('metrics.json')
 value={'schema_version':'goodwatch.title-post-matches.v2','generated_at':datetime.now(timezone.utc).isoformat(),'branch':'prototype/talked-about-now-matching','window':{'start':collection['start'],'end':collection['end']},
  'matcher':{'version':RULES['version'],'rules_sha256':read('frozen-rules.json')['logic_sha256'],'confidence_calibrated':False},
  'selection':{'top_post_count_limit':25,'top_post_count_keys':top,'buzz_primary_variant':buzz['primary_variant'],'buzz_variants':list(buzz['rankings']),'buzz_day':buzz['day'],'buzz_branch':buzz['branch'],'buzz_top_keys':list(buzz_by),'diagnostic_wrong_link_keys':diagnostics},
  'coverage':collection|{'matched_title_count_in_corpus':len(grouped),'accepted_post_count_in_corpus':sum(bool(p['links']) for p in preds.values()),'exported_title_count':len(titles),
   'warning':'Observed counts in bounded channel/RSS/search discovery, not total platform volume. Targeted searches have different query budgets; counts are not an independent hotness score. Buzz titles with no accepted posts are deliberately included with empty posts arrays.'},
  'evaluation':{'sample_items':200,'sources':m['by_source'],'lanes':m['by_lane'],'source_lanes':m['by_source_lane']},'titles':titles}
 target=HERE/'matches.json';temp=HERE/'matches.local.tmp';temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temp.replace(target)
 save('exported-title-catalog.json',[catalog[k] for k in selected if k in catalog])
 print('Exported',len(titles),'titles,',sum(len(t['posts']) for t in titles),'links;',len(top),'most-post titles +',len(buzz_by),'buzz titles +',len(diagnostics),'wrong-link diagnostic titles',flush=True)

def report():
 m=read('metrics.json');collect=read('collection-audit.json');sample=read('sample-audit.json');exported=json.loads((HERE/'matches.json').read_text());labels=read('labels.json')
 def pct(n):return '—' if n is None else f'{n*100:.1f}%'
 out=['# Matching round two: foreground, context and a rejection gate','',
  'This report supplies evidence for the owner’s review; it does not choose or ship an approach. Data/backend only, on `prototype/talked-about-now-matching`, for [#544](https://github.com/alp82/goodwatch-monorepo/issues/544). The original [round-one report](results.md) and fixtures remain intact.','',
  '## Fresh benchmark','',f"Collection window: **{collect['start']} → {collect['end']}**, spanning October 12, 13 and 14 (about 2.5 days). Captured **{collect['sources']['youtube']} YouTube uploads, {collect['sources']['rss']} RSS entries and {collect['sources']['bluesky']} Bluesky posts**; deduplicated by video/item URL or AT URI.",'',
  f"The fresh, date-stratified holdout contains **200 posts: {sample['counts']['youtube']} YouTube, {sample['counts']['rss']} RSS, {sample['counts']['bluesky']} Bluesky**. Each source spans all three UTC dates. Old sample overlap is **zero by canonical URL and source ID**. General-query Bluesky posts enter the benchmark; buzz-targeted-only results are display evidence, not benchmark items. Seed is `5442026`. All 200 references were manually authored from raw text/headlines/excerpts, then checked against title/year/alternate-title/plot/cast metadata. The coding agent is the sole annotator; images, parent threads and videos were not viewed.",'',
  'The seven original channels had no unseen in-window uploads after round one. Three Netflix channels were added to obtain a disjoint YouTube holdout: Netflix, Netflix Brasil, Netflix India. [Netflix’s own Tudum article](https://www.netflix.com/tudum/drop01) explicitly links these official channels; live canonical channel IDs/titles were verified and saved. **The fresh YouTube benchmark is Netflix-only**, while the full display run includes all ten channels. This source distribution limits comparisons with the earlier studio-heavy sample.','',
  'Matcher prompts, thresholds and preprocessing were committed before holdout selection/annotation (`c484dbd2`; `round2/frozen-rules.json`). All 200 resolved manual references were committed before the final gate ran (`52b96813`). No old labels or fresh gold are read by extraction, retrieval or gating. Subsequent fixes handle API batch-ID validation/retries, Crate’s `show`/`order_default` schema, preservation of creator job roles, catalog freshness, model year-string parsing, and enrichment of only retained candidates through bounded relation/person SELECTs; they do not adjust prompts, cutoffs or confidence thresholds. No performance-based tuning pass was made.','',
  '## What changed','',
  '- Strip subscription links, social/legal footers and studio boilerplate while preserving foreground descriptions/title prefixes.',
  '- Extract up to three explicitly primary works using the frozen extraction prompt; incidental credits, general industry news, games, unnamed replies and everyday phrases are rejected.',
  '- Retrieve original/English and production alternate titles; use fuzzy title candidates at ≥88, and keep explicit type/year signals. Refresh extracted-name entries from current production SELECTs.',
  '- Supply synopsis, directors, creators, writers and top cast separately so the gate can distinguish remakes/new versions. Publication date is not a release-year substitute.',
  '- Use Qdrant only for candidate retrieval when lexical candidates are missing. No semantic neighbor is accepted directly.',
  '- Exact unique `official=true` YouTube video-ID crosswalks from verified channels are the clean lane. Other links require grounded foreground evidence, extraction confidence ≥0.90, gate confidence ≥0.97, a valid candidate ID and explicit context disambiguation for exact-name collisions. Confidence is a rule score/model self-report, **not a calibrated probability**.','',
  '## Precision and recall by source','',
  'Precision is **link-level**: correct emitted title IDs / emitted title IDs. Recall is **item-level**: catalog-linkable primary-work posts with at least one correct link / all catalog-linkable primary-work posts. Entity recall also counts every reference title in multi-title posts. Ambiguous references are excluded and stay `unsure` in the renderer data. Named-but-missing catalog works are included in the end-to-end recall column. Thus round-one single-link figures are not a directly comparable controlled ablation.','',
  '| Source | Scored / unsure | Correct / wrong links | Precision | Item recall | Entity recall | End-to-end item recall | Precision 95% Wilson interval |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |']
 for source in ['youtube','rss','bluesky','all']:
  r=m['by_source'][source];ci=r['precision_95_wilson'];out.append(f"| {source} | {r['items']} / {r['unsure']} | {r['tp']} / {r['fp']} | {pct(r['precision'])} | {pct(r['recall'])} ({r['correctly_linked_items']}/{r['positive_items']}) | {pct(r['entity_recall'])} | {pct(r['end_to_end_item_recall'])} | {pct(ci[0])+'–'+pct(ci[1]) if ci else '—'} |")
 out+=['','## Precision and recall by lane','','Lane recall is the contribution of that lane’s correct IDs to **all reference entities** in its source, rather than recall inside a model-selected cohort. A dash means the lane emitted no scored links. All non-clean lanes pass the same context rejection gate.','','| Source | Lane | Correct / wrong | Precision | Recall contribution (entities) |','| --- | --- | ---: | ---: | ---: |']
 for source in ['youtube','rss','bluesky','all']:
  for lane in LANES:
   r=m['by_source_lane'][source][lane];out.append(f"| {source} | {lane} | {r['tp']} / {r['fp']} | {pct(r['precision'])} | {pct(r['entity_recall'])} |")
 out+=['','## Interpretation for the owner','',
  'The improved chain still does **not establish that broad automatic linking is safe to ship**. YouTube emitted 2 wrong links out of 22: an older Christmas namesake and the wrong Riot work. RSS emitted 9 wrong links out of 41, largely incidental filmography/predecessor/comparator titles despite the foreground prompts. Bluesky has the strongest observed precision (28/29), but its 95% interval is 82.8%–99.4%, its item recall is 22/30, and this is selective dated search rather than an independent firehose benchmark. All 12 errors came through `foreground_exact`; exact title text alone still fails to establish primary-work identity.','',
  'Recommendation for review: the unique official catalog video-ID lane is the cleanest limited pilot candidate, but this fresh holdout contains only **one** such link (1/1), so it cannot establish broad reliability by itself. Keep text/context links review-required, especially RSS and YouTube remakes. Treat Bluesky’s result as promising evidence for a larger, independently checked, general-query holdout before automatic publication. The 100% figures for alternative-title, fuzzy and vector lanes have denominators 4, 3 and 2 respectively; they do not justify enabling those lanes unconditionally. No source or lane was deployed and the owner has not selected an approach.','']
 costs=m['reported_cost']
 out+=['','## Recorded inference cost','',f"OpenRouter’s returned usage journal records **${costs['journal_usd']:.4f}**, or **${costs['journal_usd_per_1000_inputs']:.3f} per 1,000 corpus inputs** (extraction ${costs['journal_usd_by_phase']['extract']:.4f}; identity gate ${costs['journal_usd_by_phase']['gate']:.4f}). This is a **lower bound**, not fully reconciled billing: some interrupted extraction requests predate journal logging, and non-returned/time-out request charges are unknown. Retries that returned after logging are included. Local embeddings/production reads carry no measured per-item API charge; compute and operating costs are excluded.",'']
 # Show real holdout mistakes/abstentions alongside successes, without changing labels.
 preds={x['id']:x for x in read('predictions.json')};items={x['id']:x for x in read('fresh-sample.json')};catalog={x['key']:x for x in read('reference-catalog.json')+read('candidate-catalog.json')}
 def describe(keys):
  return '; '.join(f"{catalog.get(k,{}).get('title') or catalog.get(k,{}).get('original_title') or k} ({catalog.get(k,{}).get('release_year') or '?'}, {k})" for k in sorted(keys)) or 'none'
 examples=[]
 for label in labels:
  actual={l['key'] for l in preds[label['id']]['links']};gold=set(label['gold']);item=items[label['id']]
  status='unsure' if label.get('ambiguous') else 'wrong link' if actual-gold else 'missed link' if gold-actual else 'right link' if actual else 'right abstention'
  examples.append({'review_id':label['review_id'],'post_id':label['id'],'source':item['source'],'url':item['url'],'text':item['text'],'expected':describe(gold),'actual':describe(actual),'status':status,'links':preds[label['id']]['links'],'note':label.get('ambiguous') or label['note']})
 order={'wrong link':0,'missed link':1,'unsure':2,'right link':3,'right abstention':4}
 failures=sorted([e for e in examples if e['status'] in ['wrong link','missed link']],key=lambda e:(order[e['status']],e['review_id']))
 selected=[e for e in failures if e['status']=='wrong link'][:12]
 for source in ['youtube','rss','bluesky']:
  selected += [e for e in failures if e['source']==source and e['status']=='missed link'][:1]
 for source in ['youtube','rss','bluesky']:
  selected += [e for e in examples if e['source']==source and e['status']=='right link'][:1]
 selected += [e for e in examples if e['status']=='unsure'][:1]
 selected += [e for e in examples if e not in selected][:max(0,20-len(selected))]
 selected=selected[:20];save('holdout-example-review.json',examples);save('examples.json',selected)
 out+=['','## Twenty fresh examples, including failures','','The complete 200-item decision/reference comparison is in `round2/holdout-example-review.json`; this selection deliberately shows mistakes and missed links first. Hand labels were frozen before these decisions.','','| Item | Source / result | Post | Expected | Emitted |','| --- | --- | --- | --- | --- |']
 def cell(s):return str(s).replace('|','\\|').replace('\n',' ')[:360]
 for e in selected:out.append(f"| {e['review_id']} | {e['source']} / {e['status']} | [{cell(e['text'])}]({e['url']}) | {cell(e['expected'])} | {cell(e['actual'])} |")
 out+=['','## Owner/Opus data handover','',
  f"[`matches.json`](matches.json) contains **{len(exported['titles'])} titles and {sum(len(t['posts']) for t in exported['titles'])} title–post links**, including the 25 titles with the most accepted posts plus all 32 titles in the union of the latest buzz lists. Additional diagnostic titles contain **every wrong link from the fresh holdout**, so the owner can see failures in the title-page prototype; `selection.diagnostic_wrong_link` marks them. The primary buzz list is the buzz prototype’s recommended **`floor_lift`**, with `regularized_z` and `pageviews_tmdb` retained as named supplementary ranks. Date is **{exported['selection']['buzz_day']}**. No hindsight-trending variant was used. Buzz titles with no accepted posts remain visible with empty arrays; no unrelated posts are forced onto them.",'',
  'Schema: top-level `schema_version`, `window`, `matcher`, `selection`, `coverage`, `evaluation`, `titles[]`. Each title has `key`, numeric `tmdb_id`, `type: movie|tv`, `title`, nullable `year`, counts, selection ranks, and `posts[]`. Each post has source/URL/author/timestamp/text or headline, lane/stage/confidence/reason, discovery provenance, and `hand_label: right|wrong|unsure|null` with label set/note. `round1_display_only` labels decorate old overlapping display posts but never enter the fresh benchmark. See [schema](matches.schema.json).','',
  'Post counts are counts in this bounded corpus, not platform-wide volume or a buzz score. Publisher feed inventories can omit older items; WordPress feeds were read up to 18 pages, other feeds are rolling. Bluesky uses anonymous dated first-page searches, with distinct general versus buzz-title queries; cursors are not followed. Search-targeted exposure and syndicated/bot posts can change the observed order. The full source requests/statuses/dates and corpus are retained.','',
  '## Ambiguous references','']
 for x in labels:
  if x.get('ambiguous'):out.append(f"- **{x['review_id']}** (`{x['id']}`): {x['ambiguous']}")
 out+=['','## Verification and remaining limits','','Production access used only Crate SELECTs and Qdrant point queries. No production store/cache writes, app server, frontend or review page was created. All 3,983 inputs were processed with the frozen matcher. Offline source/lane metric arithmetic, holdout disjointness/date coverage, renderer schema/ID/URL/confidence/hand-label invariants, exact top-25 selection and complete buzz inclusion were checked. Python compilation and git diff checks passed.','',
  'This remains a single-agent, text/excerpt-only benchmark with a Netflix-only fresh YouTube cohort and selective historical discovery. Grounding/name normalization inherits the ASCII-based first-round normalizer, which can discard non-Latin title evidence; multilingual coverage is not established. Multi-day publication history is real; continuous multi-day ingestion/reliability, independent annotation adjudication, confidence calibration, deletion synchronization and deployment were not tested. Keep accepted links and their wrong/unsure badges in the data for the owner to judge; do not silently filter them out.','',
  '## Reproduce','',
  '`MATCHING_ENV_FILE=/path/to/existing/.env python round2_collect.py collect`; select a **new** disjoint holdout and annotate it before viewing decisions. Run `round2_matcher.py extract`, `candidates`, `vector_fallback`, `run` sequentially. `round2_labels.py prepare`/`resolve` checks manually authored identities separately. `round2_publish.py metrics` is offline; `export` hydrates selected title metadata with SELECTs; `report` is offline. Committed snapshots under `round2/` reproduce the measured result. The original catalog index and pinned embedding files remain local/ignored.','']
 (HERE/'results-round2.md').write_text('\n'.join(out))

if __name__=='__main__':
 import sys
 globals()[sys.argv[1]]()
