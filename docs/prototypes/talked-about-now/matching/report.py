#!/usr/bin/env python3
"""Render the fixed experiment's human-readable report from offline metrics."""
from spike import *

def pct(n):return '—' if n is None else f'{n*100:.1f}%'

def main():
    metrics=load('metrics.json'); rows=load('evaluation.json'); stream=load('jetstream-audit.json')
    cat={x['key']:x for x in load('candidate-catalog.json')}
    for x in load('label-catalog.json'):cat[x['key']]=x
    def title(key):
        if not key:return 'none'
        r=cat.get(key,{});return f"{r.get('title',key)} ({r.get('release_year') or '?'}) `{key}`"
    out=['# Linking posts to titles automatically — data spike',
         '', 'Measured 2026-10-14 for [issue 544](https://github.com/alp82/goodwatch-monorepo/issues/544). Throwaway branch: `prototype/talked-about-now-matching`; base `4003c90d` (`origin/main`).',
         '', '## Answer', '',
         '**The broad automatic waterfall is not ready to ship on any of the three sources.** Official YouTube video-ID crosswalks are the strongest narrow lane; source allowlisting alone is provenance, not title identity. Start with those as editorial suggestions, and keep RSS and Bluesky hand-picked until a new, independent evaluation passes a proposed ≥95% precision target. This threshold is a recommendation, not an established project requirement.',
         '', 'An LLM verification pass over early accepts helps, but does not repair missing candidates or supply enough remake context. Do not let fuzzy matches or semantic similarity bypass verification.',
         '', '## Sample and reference answers', '',
         f"Collected 50 recent YouTube uploads from all seven verified channels (eight fetched per channel, then newest 50), 164 deduplicated publisher RSS items in the trailing 24-hour window, and {stream['retained']:,} keyword-filtered Bluesky posts. Two Netflix newsroom items with publisher dates only are saved separately; the trade-press evaluation excludes them. epd Film had no items in the window. The initial Netflix parse failures and corrected supplementary reads are preserved in their audit files.",
         '', f"Bluesky requested window: **{stream['requested_start']} → {stream['requested_end']}**. Publication and replay event times are filtered. {stream.get('scope_note','')}",
         '', stream.get('migration_skip',''),
         '', 'This is a bounded replay sample, not a complete firehose census. Reconnects are inclusive and deduplicated by AT URI. Old repository imports made replay progress unreliable; their gaps are disclosed rather than silently counted as coverage. Pre-resume raw byte/frame totals were not retained; the final audit totals describe only the final resumed segment. The full retained post dataset is committed.',
         '', f"**{len(rows)} items hand-checked by the coding agent:** 50 YouTube, 60 RSS, 60 Bluesky. The source subsets are deterministic (`Random(544)`, sorted canonical URLs) and chosen before running matching on that source. Human annotations identify the main promoted/discussed work and version; equal-topic lists accept any explicitly discussed main work. Studio boilerplate, incidental filmography, generic business/person/news, sports broadcasts, music without a specific movie/show association, and unnamed works do not count as title links. Posts are labeled from the supplied text and bounded feed context; images, video, article bodies and reply parents were not read. Unknown identities are listed below.",
         '', 'Labels were manually authored separately from predictions, then resolved against the full local snapshot of **1,261,069 movies + 234,440 shows**. Difficult same-year namesakes were checked with production SELECTs for synopsis/director. The concert self-entry was reconciled during this catalog audit and retained as a policy ambiguity. No LLM output was used as a reference answer. This is one annotator, with no independent second review.',
         '', '## Method and per-stage precision / recall', '',
         '1. **Official identity:** the seven verified studio/streamer channel IDs identify their organization, not a movie/show. No per-title Bluesky handle or channel crosswalk was established. An additional exact YouTube `media_video.site_key` crosswalk, restricted to catalog `official=true`, is measured in this stage; it resolves nine uploads, one ambiguous concert case.',
         '2. **Fuzzy title + year:** normalized English/original catalog titles, hashtag splitting, exact n-gram mentions, and bounded prefix retrieval with RapidFuzz for quoted/upload prefixes. Accept only a unique longest exact mention with at least two words/eight characters; explicit headline years add a release-year boost. Publication year is not substituted for release year. Alternative-title/translation tables are not indexed in this baseline.',
         '3. **Qdrant:** production `media_fingerprint_v1`, named `text_multi_v1`, top 10. The query encoder is the webapp’s pinned fp32 multilingual-e5-small ONNX export, `query: ` prefix, masked mean pooling, 512-token truncation and L2 normalization. Direct acceptance requires cosine ≥0.90 and top-two margin ≥0.04. Thresholds were fixed before reading gold labels. Nearest semantic neighbors are candidate retrieval, not identity evidence.',
         '4. **OpenRouter:** `openai/gpt-4.1-mini`, temperature 0, JSON catalog ID or `none`, one main title. Up to 30 lexical plus 10 vector candidates, deduplicated. Candidate metadata is title/original title/year/type; director/synopsis/availability are not supplied. The waterfall calls the model only on unresolved items. A diagnostic guarded variant uses the **same prompt and candidates** to verify early fuzzy/vector accepts, preserving exact official-video crosswalks and reusing fallback responses. Neither algorithm reads labels.',
         '', '**Precision** = correct emitted IDs / emitted IDs. **Recall** = items correctly linked to at least one main work / items with at least one resolvable main work in our catalog. A wrong ID counts as both FP and FN on positive items. This is item recall, not all-entity recall for multi-title posts. Abstentions reduce recall; negative items never enlarge the recall denominator. Ambiguous items are excluded from primary metrics. End-to-end recall below also counts named works missing from the catalog.',
         '', '| Source | Stage (cumulative) | Correct / wrong | Precision | Catalog-item recall |', '| --- | --- | ---: | ---: | ---: |']
    for s in ['youtube','rss','bluesky']:
        for stage,name in [('chain_official','Official identity'),('chain_fuzzy','+ fuzzy/year'),('chain_vector','+ Qdrant'),('chain_llm','+ LLM fallback'),('verified','LLM checks early accepts')]:
            r=metrics[s][stage];out.append(f"| {s} | {name} | {r['tp']} / {r['fp']} | {pct(r['precision'])} | {pct(r['recall'])} ({r['tp']}/{r['positives']}) |")
    out+=['', 'Incremental stage decisions below score only items unresolved by the preceding stage. Stage recall uses the catalog-linkable positives **within that unresolved cohort**; it is not whole-source recall. Early wrong accepts are locked in by the waterfall and absent from later cohorts.',
          '', '| Source | Stage alone | Scored unresolved cohort | Added correct / wrong | Stage precision | Cohort recall |', '| --- | --- | ---: | ---: | ---: | ---: |']
    for s in ['youtube','rss','bluesky']:
        for stage,name in [('chain_official','Official identity'),('chain_fuzzy','Fuzzy/year'),('chain_vector','Qdrant'),('chain_llm','LLM fallback')]:
            r=metrics[s]['incremental_stages'][stage];out.append(f"| {s} | {name} | {r['n']} | {r['tp']} / {r['fp']} | {pct(r['precision'])} | {pct(r['recall'])} |")
    out+=['', '| Source | Scored / ambiguous | Named main-work items | Catalog-linkable items | Final waterfall end-to-end recall | Guarded end-to-end recall | Guarded precision 95% Wilson interval |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |']
    for s in ['youtube','rss','bluesky']:
        r=metrics[s]['chain_llm'];v=metrics[s]['verified'];ci=v['precision_95_wilson']
        out.append(f"| {s} | {r['n']} / {r['ambiguous']} | {r['named_positive_items']} | {r['positives']} | {pct(r['end_to_end_recall'])} | {pct(v['end_to_end_recall'])} | {pct(ci[0])}–{pct(ci[1])} |")
    out+=['', 'The exact official-video lane has eight unambiguous successes and no errors: **8/8 precision, 8/47 recall**, with a 95% Wilson precision interval of **67.6%–100%**. It is the best pilot lane, but eight examples do not certify ≥95% shipping precision. The concert boundary is explicitly excluded, not silently relabeled to make the crosswalk pass.',
          '', '## Retrieval versus decision', '', '| Source | Lexical candidate recall | Vector top-10 candidate recall | Combined candidate recall | Forced vector top-1 precision |', '| --- | ---: | ---: | ---: | ---: |']
    for s in ['youtube','rss','bluesky']:
        c=metrics[s]['candidate_recall'];out.append(f"| {s} | {pct(c['lexical_candidates'])} | {pct(c['vector_candidates'])} | {pct(c['candidates'])} | {pct(metrics['independent_vector_top1'][s]['precision'])} |")
    out+=['', 'The fixed Qdrant acceptance threshold adds no links in this run. Lowering it would convert theme similarity into wrong IDs. Candidate recall is a separate ceiling for a candidate-constrained LLM, except for exact official-video links that can bypass retrieval.',
          '', '## Cost per 1,000 input items', '', '| Source | Waterfall LLM cost | Guarded LLM cost |', '| --- | ---: | ---: |']
    for s in ['youtube','rss','bluesky']:
        out.append(f"| {s} | ${metrics[s]['cost']['usd_per_1000_input_items']:.3f} | ${metrics[s]['verified_cost']['usd_per_1000_input_items']:.3f} |")
    c=metrics['cost'];w=c['waterfall'];a=c['verification_additional'];total=c.get('guarded_total',w)
    out += ['', f"Observed waterfall: **{w['calls']} LLM calls, {w['prompt_tokens']:,} prompt tokens, {w['completion_tokens']:,} completion tokens, ${w['observed_usd']:.6f}**, or **${w['usd_per_1000_input_items']:.3f}/1,000 input items**. The guarded run adds {a['calls']} calls and ${a['observed_usd']:.6f}; the combined spend is ${total['observed_usd']:.6f}, or ${total['usd_per_1000_input_items']:.3f}/1,000. These are observed OpenRouter `usage.cost` charges, including reported cache effects, not a price quote for future workloads. No web-search/tool charges or paid embeddings were used.",
            '', 'Official/feed reads, local fuzzy matching, and local embeddings incurred **$0 measured API charges**. Qdrant/Crate reads incurred no metered API charge. CPU, existing store load, bandwidth, storage and operational worker cost are **not priced here**; therefore the table is inference cost, not total operating cost. Diagnostic vector retrieval was executed on every labeled item to measure candidate recall, even when an early waterfall stage had already accepted.',
            '', '## Twenty examples, including failures', '', '| Item / source | Input (canonical URL) | Hand label | Waterfall output | Guarded output | Result / explanation |', '| --- | --- | --- | --- | --- | --- |']
    chosen=[]
    fixed=['Y001','Y002','Y005','Y006','Y009','Y020','Y023','Y031','R003','R010','R018','R023','R041','R047']
    lookup={r['item']['id']:r for r in rows}
    chosen=[lookup[k] for k in fixed]
    blue=[r for r in rows if r['item']['source']=='bluesky' and not r['label'].get('ambiguous')]
    # Prefer a mix of true matches, false links, misses and correct abstentions.
    for predicate in [lambda r:r['prediction']['verified'] in r['label']['gold'] and bool(r['label']['gold']),
                      lambda r:bool(r['prediction']['verified']) and r['prediction']['verified'] not in r['label']['gold'],
                      lambda r:bool(r['label']['gold']) and not r['prediction']['verified'],
                      lambda r:not r['label']['gold'] and not r['prediction']['verified']]:
        for r in blue:
            if len(chosen)>=20:break
            if predicate(r) and r not in chosen:chosen.append(r);break
    for r in blue:
        if len(chosen)>=20:break
        if r not in chosen:chosen.append(r)
    def cell(s):return str(s).replace('|','\\|').replace('\n',' ')
    for r in chosen:
        x=r['item'];l=r['label'];p=r['prediction'];k=p['verified']
        result='correct link' if k and k in l['gold'] else 'wrong link' if k else 'miss / abstention' if l['gold'] else 'correct none'
        gold_text='; '.join(title(k) for k in l['gold']) or ('main work absent: '+', '.join(t[0] for t in l['targets']) if l['targets'] else 'none')
        out.append('| '+' | '.join(map(cell,[x['id']+' / '+x['source'],f"[{x['text'][:105]}]({x['url']})",gold_text,title(p['chain_llm']),title(k),result+'. '+l['note']]))+' |')
    out+=['', 'Every item, candidate list, model reason and charge is available in the committed JSON, including errors not selected for this table.', '', '## Ambiguous items', '']
    for r in rows:
        if r['label'].get('ambiguous'):out.append(f"- **{r['item']['id']}**: {r['label']['ambiguous']}")
    out+=['', '## Recommendation and limits', '',
          '- **YouTube:** make verified channels the discovery backbone, but promote only independently validated exact catalog video-ID links into the first automatic-link pilot. Use an editorial queue for other uploads. Extract the promoted title from upload title/hashtag/foreground description and strip A24/Disney boilerplate before retrieving candidates. The main-post title must outrank incidental cast credits and literal phrases in plot summaries.',
          '- **RSS:** use as a curated headline/link feed today. For the next linker, extract primary work mentions, include translated/alternative catalog titles, retrieve newer remakes separately, and provide director/cast/synopsis/release context. Excerpt-only ambiguous stories require the article body or manual handling. Generic industry and merchandise news should abstain.',
          '- **Bluesky:** keep hand-picking for title pages; keyword-filtered streaming is a discovery input, not a publishable title-linked feed. Require explicit title/version evidence and resolve quoted/reply context where permitted. Short conversational, book, podcast, political, non-English and generic recommendation posts are not identities. Semantic nearest-neighbor retrieval should never auto-link by itself.',
          '- **Before broad automation:** build a foreground-first candidate generator and a rejection gate, then evaluate on a new independently labeled, multi-day sample. Do not reuse this sample to tune thresholds and claim a held-out shipping result. Check precision on accepted links, recall on both catalog-linkable and named-but-missing works, and error rates for remakes, same-name shorts, localized names, boilerplate, and each publisher/channel.',
          '', 'No production store or cache writes were performed. This branch contains scripts/local artifacts only; main was untouched. Real collection, Crate SELECTs, Qdrant queries, local embeddings and OpenRouter inference ran. Python compilation, mutation rejection guards, offline metric replay, sample/label/ID invariants and git diff checks were used for verification. No UI, production ingestion/deployment, multi-day operation, independent annotation review, publication rights/consent or all-entity recall was tested.',
          '', '## Inputs and reproduction', '',
          '- [Issue 544](https://github.com/alp82/goodwatch-monorepo/issues/544).',
          '- [Discovery facts](https://github.com/alp82/goodwatch-monorepo/blob/research/talked-about-now-discovery/docs/research/talked-about-now/discovery.md), read with `git show origin/research/talked-about-now-discovery:docs/research/talked-about-now/discovery.md`.',
          '- [Prior design](https://github.com/alp82/goodwatch-monorepo/blob/ccr-327ca25f-xd6xns/docs/research/reports/Social%20content%20embeds%20deep%20dive.md), read from `origin/ccr-327ca25f-xd6xns` (the local short branch was absent).',
          '- [Primary Jetstream filtering/replay documentation](https://bsky.network/docs/jetstream/), checked 2026-10-14. Actual collection used the documented west v2 endpoint and `xrpc.v1.json` subprotocol.',
          '- [OpenRouter model metadata](https://openrouter.ai/api/v1/models), checked 2026-10-14; charges use actual per-response usage.',
          '- [Run instructions and artifact index](README.md). Run `python evaluate.py` and `python report.py` offline to regenerate numbers/report. Full catalog/model snapshots are local ignored files; sampled candidates and reference identities are committed.', '']
    (HERE/'results.md').write_text('\n'.join(out))

if __name__=='__main__':main()
