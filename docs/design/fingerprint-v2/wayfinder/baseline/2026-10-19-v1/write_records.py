#!/usr/bin/env python3
"""Write interpretation records for this fixed audit; does not execute experiments."""
import hashlib
import json
from pathlib import Path

B=Path(__file__).resolve().parent
M=json.loads((B/'manifest.json').read_text())
FILES={f['path']:f for f in M['files']}
def dump(name,value): (B/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def ref(path):
    f=FILES[path]
    return {'path':path,'sha256':f['sha256'],'snapshot':f['snapshot']}
R=[]
def claim(id,classes,statement,sources,limits,reuse):
    R.append({'id':id,'classification':classes,'statement':statement,'sources':[ref(s) for s in sources],'limitations':limits,'reuse':reuse})

claim('current-source-contract',['measured'],
 'Current V1 generation/reading/pipeline source identities are captured at local HEAD; source observations are static.',
 ['goodwatch-flows/windmill/f/dna/generate/fetch.py','goodwatch-flows/windmill/f/dna/models.py','goodwatch-webapp/app/server/search-runtime/runtime.server.ts','goodwatch-flows/windmill/f/search/title_text.py'],
 'No deployed hashes, environment values, running jobs, live catalog or storage manifests inspected.',
 'Fixed comparison contract and scope for future controlled experiments; require live attestation only if a later decision needs it.')
claim('v2-proposals',['proposed','illustrative'],
 'Full and compact V2 definitions and both Matrix examples are draft/illustrative. The verbose schema does not validate compact output.',
 ['docs/design/fingerprint-v2/definition.json','docs/design/fingerprint-v2/schema.json','docs/design/fingerprint-v2/example-matrix.json','docs/design/fingerprint-v2/llm-definition.json','docs/design/fingerprint-v2/llm-example-matrix.json'],
 'No V2 model generation, approved production schema or compatibility validation.',
 'Vocabulary and transport candidates; no automatic feature selection or gold scores.')
claim('inventory-title',['measured','historical'],
 'Existing SELECT-only 2026-10-19 exports preserve 2,000 vote-ranked movies and 1,000 shows, with no hidden presentability filter.',
 ['docs/research/fingerprint-v2-gap-audit/title-extraction-manifest.json','docs/research/fingerprint-v2-gap-audit/top-movies.json','docs/research/fingerprint-v2-gap-audit/top-shows.json'],
 'No independent viewing or work identity verification. Release-year/IMDb/edition metadata are absent from these exports. No current live re-export.',
 'Reuse exact frozen rows as catalog evidence; independently judge a selected corpus before gold admission.')
claim('inventory-essence',['measured','historical'],
 'Existing exact-label exports contain 334,284 merged labels and 2,224,427 assignments; compressed and decompressed hashes verified.',
 ['docs/research/fingerprint-v2-gap-audit/essence-extraction-manifest.json','docs/research/fingerprint-v2-gap-audit/essence-triage-summary.json','docs/research/fingerprint-v2-gap-audit/essence-findings.md'],
 'Generated assertions; 823 prioritized labels semantically reviewed according to the prior report. Exhaustive lexical screening is not exhaustive semantic review.',
 'Vocabulary coverage and missingness hypotheses, not reference answers.')
claim('inventory-tropes',['measured','historical'],
 '42,936 exact names, 42,142 stored URL strings, 468 stored excerpts; arrays and detailed rows use different association units.',
 ['docs/research/fingerprint-v2-gap-audit/tropes-extraction-manifest.json','docs/research/fingerprint-v2-gap-audit/tropes-example-extraction-manifest.json','docs/research/fingerprint-v2-gap-audit/tropes-vocabulary-findings.md'],
 'Sampled stored excerpts can be truncated HTML, wrong-work, wrong-medium, segment-specific or averted applications. 1,282 names were semantically reviewed; counts are not prevalence or demand.',
 'Quarantine identity/scope/polarity candidates. Preserve URL aliases and source strings, never convert all mentions to positive scores.')
claim('gap-ledgers',['historical','proposed'],
 'All essence/movie/show/trope ledgers, proposals, screening scripts and samples are frozen in the file manifest.',
 ['docs/research/fingerprint-v2-gap-audit/README.md','docs/research/fingerprint-v2-gap-audit/movies-coverage.json','docs/research/fingerprint-v2-gap-audit/shows-ledger.json','docs/research/fingerprint-v2-gap-audit/recommended-changes.json'],
 'Movie report: all names, four tags for 798 residual rows and 77 detailed reviews. Show report: all names/three rare tags, 160 expanded residuals and 99 detailed reviews. These scopes are not 3,000 deep reviews.',
 'Use reviewed snippets and source pointers to design cases; retain residuals and missingness.')
claim('synthetic-searches',['illustrative','proposed'],
 '256 imagined query cases in 32 categories and 78 trope-inspired scenarios in 29 families retain the expressiveness discussion.',
 ['docs/research/fingerprint-v2-gap-audit/queries-cases.json','docs/research/fingerprint-v2-gap-audit/tropes-search-proposals.json'],
 'No observed query frequency, graded retrieval improvement or hidden confirmation set; openly discussed development material.',
 'Stratified development cases after independent relevance/reference review; never call them a new blind holdout.')
claim('human-selection',['measured','historical'],
 'Historical POC: 90 valid full outputs across nine executed configurations after three repairs. Owner selected Qwen3.8 primary / Qwen3.7 fallback on 2026-09-12.',
 ['docs/benchmarks/fingerprint/poc/human-review/results.md','docs/benchmarks/fingerprint/poc/human-review/selection.json'],
 'Human preference is scoped to ten titles; assistant quality stars are a synthesis. Four blocked/incompatible routes are not quality losers. Current configuration is separately captured.',
 'Whole-output comparator, route/failure history and human review provenance.')
claim('independent-review-waiver',['waived','superseded'],
 'Owner resolution explicitly waived independent Astra/Fable first-pass reviews as a gate; old pending wording is superseded for that gate.',
 ['docs/design/fingerprint-v2/wayfinder/history-issue-33.json','docs/benchmarks/fingerprint/poc/human-review/selection.json','docs/benchmarks/fingerprint/protocol.md'],
 'A waiver is not a passing independent review. It applies to the earlier strategy, not a new V2 quality protocol.',
 'Preserve waiver and outstanding-check history without resurrecting a waived prerequisite.')
claim('repeat-cost',['measured','historical'],
 '20/20 historical repeats completed. Observed generation charges $0.01179756; unresolved-rejection reservations $0.006466144.',
 ['docs/benchmarks/fingerprint/poc/repeat-cost/repeatability.md','docs/benchmarks/fingerprint/poc/repeat-cost/comparison.json','docs/benchmarks/fingerprint/poc/repeat-cost/cost-summary.json'],
 'Both models changed highlights for all ten titles; score drift includes semantic regressions. Reservations are not charges. Frozen POC replay is not current production acceptance.',
 'Noise baseline and cost-ledger semantics; preserve drift rather than editing outputs.')
claim('paid-embedding-history',['measured','historical','superseded'],
 '2026-09-14 historical embedding call: 20 valid 768-D vectors, 1,881 measured input tokens; $0.0003762 rate-derived, not invoice-confirmed.',
 ['docs/benchmarks/fingerprint/poc/repeat-cost/embedding-cost.md','docs/benchmarks/fingerprint/poc/repeat-cost/embedding-ledger.json','docs/text-embedding-removal.md','docs/adr/0002-local-text-embeddings-for-search.md'],
 'Old paid embedding acquisition differs from current local title/query encoders. Combined $0.018639904 includes reservations and rate estimates, not all observed charges.',
 'Accounting example only; never use as current local-encoder cost or proof text vectors are absent.')
claim('jev-title-scoring',['measured','historical'],
 'September 17 Jev-1.13.0 synopsis-only experiment: 10 titles × 74 scores, MAE vs reviewed Qwen 2.65 against Qwen repeat noise 0.51.',
 ['docs/benchmarks/fingerprint/jev/README.md','docs/benchmarks/fingerprint/jev/results.json','docs/benchmarks/fingerprint/jev/scores.json','docs/adr/0001-no-jev-for-fingerprint-scoring.md'],
 'Qwen agreement is not correctness. Scores-only and full-output costs are unequal scope. Enriched evidence was unrun; raw private captures absent locally. ADR 0001 remains accepted.',
 'Motivation for controlled evidence arms, not a universal provider verdict. Six levels map to 0,2,4,6,8,10; ten native levels mapped to 0..10 are not eleven levels.')
claim('acceptance-followups',['measured','historical','superseded'],
 'Initial acceptance found invalid highlights; regeneration and actual monthly-budget rejection later superseded those specific unresolved claims.',
 ['docs/benchmarks/fingerprint/acceptance/README.md','docs/benchmarks/fingerprint/acceptance/regeneration.md','docs/benchmarks/fingerprint/acceptance/monthly-live.md','docs/benchmarks/fingerprint/acceptance/followups/reconcile-cost.md'],
 'Missing request-cost reconciliation was not silently resolved. Historical disabled-schedule statements do not establish the schedule today.',
 'Preserve original failure plus fix evidence, route hashes and retained unknown-cost reservations.')
claim('early-query-reading',['historical'],
 'Early Jev search A–E/D1–D5/D4+ results are retained assistant reports plus final code, not a complete set of raw API responses.',
 ['docs/research/jev-search-prototypes.md','docs/research/jev-search/historical-reports.json','docs/research/jev-search/snapshot.json'],
 'Variant names reused; some historical costs omit shared reading. One current source differs from frozen snapshot; all four original files recovered by hash from c22696bfe961651a01c0da63778cdb9b00c7caa2.',
 'Mechanism hypotheses and historical lineage, not fresh measured title knowledge or new inference authorization.')
claim('holdout5-provenance',['measured','historical','superseded'],
 'holdout5 was 30 blind agent-written queries h5-01..h5-30; frozen combo-safe-v2 scored .794 vs r6 .764 and captured prod .511. Later v3 is an exposed-set regression check.',
 ['docs/prototypes/search-arena/results/LOG.md','docs/prototypes/search-arena/evaluation-contract.md','docs/prototypes/search-arena/results/simplify/holdout5/lists/combo-safe-v2.json','docs/design/fingerprint-v2/wayfinder/evidence-index.md','docs/design/fingerprint-v2/wayfinder/discovery-evidence-index.md'],
 'evidence-index.md says five-query, contradicting discovery index, protocol and measured run log. Two historical Sonnet assessors and blind-third adjudication are provenance only; no new Claude work was launched. Agent-written/graded queries are not real-user confirmation.',
 'Correct count is 30. Preserve discrepant source unchanged. Treat every exposed historical holdout as development/regression evidence now.')
claim('ranking-components',['measured','historical'],
 'All six simplification branches, grading/rubric overlays, parity, encoder, sparse, stores, backfill and language-negation results are indexed and captured.',
 ['docs/design/fingerprint-v2/wayfinder/discovery-evidence-index.md','docs/prototypes/search-arena/results/simplify/HOW-IT-WORKS.md','docs/prototypes/search-arena/results/bench/encoders.json','docs/prototypes/search-arena/results/bench/parity.json'],
 'Historical CPU/ranking timings, cached encodes, synthetic grades and production endpoint latency have different scopes. Catalog/vector/capture files needed for full replay are not local.',
 'Keep catalog fixed for ranker-only comparisons; pair embeddings with exact row order, text prep and reading versions.')
claim('search-latency',['measured','historical'],
 'September 26 followup reports fresh/cached whole-search p95 835/389 ms after changes on 35/11 searches; before populations differ.',
 ['docs/implementation/search-ranking/README.md','docs/adr/0011-search-runs-as-a-role-of-the-webapp-image.md'],
 'No current latency probe. Historical role benchmark links may live on bench/search-role; no current role/host identity or traffic distribution captured. First delivery is not complete response or browser paint.',
 'Stage-cost vocabulary and capacity hypotheses; new authorized measurements must record complete vs partial results and concurrent load.')
claim('source-qa-history',['measured','historical','unavailable'],
 'Prior trope repair/recheck metadata and 689 local source-body hashes are indexed. Source bodies stay at original local locations; later recovery bodies are missing locally.',
 ['docs/tvtropes.md','docs/research/tvtropes-repair/README.md','goodwatch-flows/windmill/f/tvtropes_web/pages.py'],
 'Prior reviewed imports/rollback manifests are historical, not evidence that every exported association has correct work/scope/polarity today. Missing saved pages cannot be replaced by an unapproved crawl.',
 'Reuse existing local pages and reviewed identity rules with custodian help; no new fetches.')
claim('prepared-only-work',['proposed','illustrative'],
 'Recent offline BM25 reader/validator source manifests explicitly distinguish preparation and synthetic tests from host execution.',
 ['docs/implementation/search-ranking/bm25-acquisition-20261013/offline-bm25-reader-20261013/source-manifest.json','docs/implementation/search-ranking/bm25-acquisition-20261013/offline-bm25-validator-20261013/source-manifest.json'],
 'preparedOnly / hostExecuted:false is not a production acquisition or measurement; full-size synthetic fixtures are not live data.',
 'Preserve intended source bindings without upgrading them to performed work.')
dump('evidence-register.json',{'version':'1.0.0','records':R})

contract={
 'version':'1.0.0','observation':'static source only; no environment values or deployed identity attested',
 'generation':{
  'sources':[ref('goodwatch-flows/windmill/f/dna/generate/fetch.py'),ref('goodwatch-flows/windmill/f/dna/models.py'),ref('goodwatch-flows/windmill/f/dna/generate/spend_pause.py')],
  'prompt':'current-system-instructions.txt','schema_source':'current-schema-annotations.json','score_order':'current-score-keys.json','score_count':74,'input':'original_title (release_year) - Movie|Show: overview',
  'primary':'qwen/qwen3.8-flash','fallback':'qwen/qwen3.7-flash','endpoint':'https://openrouter.ai/api/v1/chat/completions','provider':{'only':['alibaba'],'allow_fallbacks':False,'require_parameters':True},'reasoning':{'enabled':False},'max_tokens':8192,'timeout_seconds':[10,120],
  'response_modes':{'primary':'strict json_schema from DNAAnalysis via strict_schema()','fallback':'json_object + local strict validation'},
  'tier':'Primary if TMDB popularity >=1.0 or release date within the last calendar year through today; otherwise fallback first. Each can try the other.',
  'retry':'At most 6 requests per title total; per model one validation repair, at most two transport retries for 429/502/503 honoring Retry-After or exponential delay. No quality retry. All-zero scores skip repair and try alternate model. Non-budget 401/403 raise.',
  'freshness_days':180,'queue_batch_size':100,'chunk_size':5,'flow_parallel_chunks':5,'claim_buffer_minutes':60,'priority_failed_cooldown_days':7,
  'spend_pause':'402 => next UTC midnight; explicit monthly-budget 403 => next UTC month; Redis longest pause wins; unprocessed claims released. Provider $1/day $30/month limits are historical owner configuration, not verified live.',
  'persistence':'Mongo analysis, generation timestamp, raw ordered vector, route name and release saved together; vector persistence rechecks stored scores with conditional update and no model call.',
  'provenance_format':'openrouter:<model>@alibaba'},
 'query_reading':{
  'sources':[ref('goodwatch-webapp/app/server/combined-search/reading-retrieval.server.ts'),ref('goodwatch-webapp/app/server/search-runtime/runtime.server.ts'),ref('goodwatch-webapp/app/server/combined-search/search.server.ts')],
  'model':'jev-1.13.0','question_version':'accepted-d4-corrected-v1','requests':'Two parallel locked requests: lean full-criteria attributes/concrete words/phrase choice, plus 148 want/avoid noul questions (74 keys).',
  'fingerprint_state':'Shared short task + normalized request','weight':'2*(want-avoid); wanted >=0.5, avoided <=-1.2; up to 74 dims, strongest fallback if empty','flag_probability':0.5,'concrete_probability':0.6,'second_phrase_probability':0.15,
  'contract_cache_key':'d4+/<model>/<questionVersion>/<language.mode>/<language.version> plus canonical requests/language/text via keyed digest','reading_normalization':'lowercase + collapsed whitespace; original text kept elsewhere; request key normalizes NFC',
  'deadline_ms':1500,'retry_529_delays_ms':[100,250],'retry_min_remaining_ms':700,'sdk_automatic_retries':0,'input_bound_tokens_per_request':65536,'rate_config':'42 nanoUSD/input token; typesafe-public-2026-09-21-42nano-v1 (dated source constant, not current price verification)','reserve_nano_usd':5505024,
  'language':'five-language-markers-v2; optional gpt-4.1-nano translation only when SEARCH_TRANSLATION_ENABLED=true; runtime env not read','admission':'shared store, cache, claim, limits and settlement; errors retain unknown-usage reservation, not assumed zero'},
 'title_text':{
  'sources':[ref('goodwatch-flows/windmill/f/search/title_text.py'),ref('goodwatch-flows/windmill/f/search/terms.py')],
  'contract':'text_en_v1+text_multi_v1+terms_bm25f_v1','inputs':'Qdrant payload title/original_title/release_year/genres/tropes plus Crate original_title, essence_text, tags, substr(synopsis,1,600), keywords/tropes fallback. Stores may differ.',
  'english':'No title or prefix, year retained; genres + tags + essence_text or synopsis + first 25 keywords + first 15 tropes. Exact punctuation/order frozen in source.',
  'multilingual':'passage: prefix + title or original_title and same body','sparse':'All tags/keywords/tropes/essence fields, no dense top-N cuts; stable term IDs, local tokenization/stemming, field weights 2/2/1/1, K1=1.2, B=.75 and frozen float32 average lengths.',
  'hash':'SHA256 JSON of [contract, english_text, multilingual_text, term_fields]'},
 'encoders':{
  'title_config':ref('goodwatch-flows/windmill/f/search/text_encoder.py'),'query_config':ref('goodwatch-webapp/app/server/search-ranking/query-models.server.ts'),'query_runtime':ref('goodwatch-webapp/app/server/search-ranking/query-encoder.worker.js'),
  'title_bge':{'repo':'BAAI/bge-base-en-v1.5','revision':'a5beb1e3e68b9ab74eb54cfd186867f64f240e1a','onnx_sha256':'9bc579acdba21c253c62a9bf866891355a63ffa3442b52c8a37d75b2ccb91848','pooling':'CLS','dimensions':768},
  'title_multi':{'repo':'intfloat/multilingual-e5-small','revision':'614241f622f53c4eeff9890bdc4f31cfecc418b3','onnx_sha256':'ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665','pooling':'attention-mask mean','dimensions':384},
  'query_bge':{'repo':'Xenova/bge-base-en-v1.5','revision':'4d6cd88e18e51a5e020c2c305726d76ada9c03cf','onnx_sha256':'9bc579acdba21c253c62a9bf866891355a63ffa3442b52c8a37d75b2ccb91848','prefix':'Represent this sentence for searching relevant passages: '},
  'query_multi':{'repo':'Xenova/multilingual-e5-small','revision':'761b726dd34fb83930e26aab4e9ac3899aa1fa78','onnx_sha256':'4aa845c27760e06e9a686b9d8b5d440eae4b6612cd09e5b522b716d3941f77ff','prefix':'query: '},
  'runtime':'fp32 CPU ONNX; L2 normalization. Title max512/batch32/threads4; query config max512 but worker caps128; search role defaults2 threads, in-flight4; other roles use core-dependent default. Environment overrides unverified.',
  'parity_qualification':'Different multilingual title/query ONNX byte identities, with historical encoder parity evidence; no new binary or vector parity run. Do not equate model-name agreement with byte identity.'},
 'storage':{
  'qdrant':{'source':ref('goodwatch-flows/windmill/f/sync/models/qdrant_schemas.py'),'collection':'media_fingerprint_v1','vectors':{'fingerprint_v1':'74 Cosine, raw score input normalized by Qdrant','fingerprint_v1_raw':'74 Dot, exact-only m=0','text_en_v1':'768 Cosine float16 storage','text_multi_v1':'384 Cosine float16 storage','terms_bm25f_v1':'sparse, no Qdrant IDF modifier'},'reference_collection':'search_reference_profiles','point_id':'1e12+tmdb_id for movie; 2e12+tmdb_id for show','ownership':'Fingerprint publish updates owned vectors/payload and retains text vectors. Text publish updates only its three vectors.'},
  'sync_checkpoint':{'source':ref('goodwatch-flows/windmill/f/sync/copy/sync_state.py'),'overlap_minutes':30,'fallback_hours':48,'max_lookback_days':7,'success_rule':'Commit checkpoint only after media type succeeds; carried missing-streaming IDs retained. ID-scoped runs keep fixed window and do not advance scheduled checkpoint.'},
  'text_pipeline':{'source':ref('goodwatch-flows/windmill/f/search/embed_titles.py'),'incremental_overlap_hours':72,'chunk_size':1000,'write_batch_size':250,'trigger_columns':['tmdb_details_updated_at','dna_updated_at','tvtropes_tags_updated_at'],'state_tables':['search_embedding_inputs','search_terms','search_embedding_state'],'sweep':'Daily full input-hash sweep catches older-source timestamp publication; no full run performed.'},
  'search_index':{'source':ref('goodwatch-flows/windmill/f/search/build_indexes.py'),'format':1,'eligibility':'votes>=2000 and not adult; alias rules/version retained','manifest':'search_index_builds[current]: format,build_id,created_at,previous_build_id,files{sha1,bytes},alias_version,profiles,stats','blobs':'search_index_files: deterministic gzip JSON addressed by SHA-1; runtime checks SHA-1. Audit uses SHA-256 of captured files.','publication':'Build files + reference profiles, then complete/current CAS; retains current/previous and running builds. No live build captured.'},
  'title_snapshot':{'writer':ref('goodwatch-flows/windmill/f/sync/copy/title_snapshot.py'),'reader':ref('goodwatch-webapp/app/server/title-snapshot/format.server.ts'),'format':1,'base_bytes_per_title':101,'scores':'74 uint8 values 0..10; 255 missing; ordered keys','manifest':'title-snapshot:current -> version,count,format,sha256,keyOrder,genres,origins,builtAt,sourceMark, optional ratings','chunk_bytes':1048576,'ratings_sidecar':'format1; 2+country_count bytes/title, separate chunk hashes; precise layout in source','source_mark':'Per movie/show count and sum(dna_updated_at), plus ratings-format/config inputs; metadata freshness is not a live evidence attestation.'}},
 'ranker':{'source':ref('goodwatch-webapp/app/server/search-ranking/ranking.server.ts'),'version':'hybrid-v2','scope':'Current source identity is separate from historical combo-safe-v2/v3 prototype names. Fusion/config/layout/consumer files are captured, no ranking run performed.'}}
dump('contract-identities.json',contract)

discrepancies=[
 {'id':'holdout5-count','classification':['historical','superseded'],'original_claim':'evidence-index.md: five-query holdout','correction':'30 blind agent-written queries, h5-01..h5-30; frozen v2, later v3 regression','supporting_sources':[ref('docs/prototypes/search-arena/results/LOG.md'),ref('docs/prototypes/search-arena/evaluation-contract.md'),ref('docs/design/fingerprint-v2/wayfinder/discovery-evidence-index.md'),ref('docs/prototypes/search-arena/results/simplify/holdout5/lists/combo-safe-v2.json')],'original_source':ref('docs/design/fingerprint-v2/wayfinder/evidence-index.md'),'repository_edit':'none'},
 {'id':'jev-vector-source-lineage','classification':['historical','superseded'],'original_claim':'Four files match docs/research/jev-search/snapshot.json; one differs at current HEAD.','correction':'Current vector prototype hash ca0fd243... differs from frozen 009fcaef...; recovered four original exact files from c22696bfe961651a01c0da63778cdb9b00c7caa2.','supporting_record':'captures/jev-lineage-recovery.json','repository_edit':'none'},
 {'id':'old-pending-validation','classification':['waived','superseded'],'correction':'Historical independent Astra/Fable review gate waived in strategy resolution; repeats and embedding measurement completed later. Preserve old pending wording as historical.','supporting_sources':[ref('docs/design/fingerprint-v2/wayfinder/history-issue-33.json'),ref('docs/benchmarks/fingerprint/poc/repeat-cost/cost-summary.json')]},
 {'id':'acceptance-state','classification':['historical','superseded'],'correction':'Initial invalid highlights and monthly-response uncertainty superseded by named followups; exact earlier fallback charge remains unreconciled. No statement about current schedule inferred.','supporting_sources':[ref('docs/benchmarks/fingerprint/acceptance/regeneration.md'),ref('docs/benchmarks/fingerprint/acceptance/monthly-live.md')]}
]
M.update({'provenance_discrepancies':discrepancies,'contract_identities':'contract-identities.json','source_quality_audit':'source-quality-audit.json','reuse_plan':'reuse-plan.md','audit_report':'audit-report.md','proposed_resolution':'proposed-resolution.md','gold_admissions':0})
dump('manifest.json',M)
skill=Path('/home/alp/.agents/skills/wayfinder/SKILL.md')
(B/'captures/wayfinder-SKILL.md').write_bytes(skill.read_bytes())
dump('captures/external-guidance.json',{'path':str(skill),'sha256':hashlib.sha256(skill.read_bytes()).hexdigest(),'snapshot':'captures/wayfinder-SKILL.md'})
print(json.dumps({'evidence_records':len(R),'provenance_discrepancies':len(discrepancies)}))
