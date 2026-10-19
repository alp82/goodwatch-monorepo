#!/usr/bin/env python3
"""Offline, allowlisted evidence capture. Never imports app code or opens credentials."""
import ast
import collections
import datetime as dt
import gzip
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path('/home/alp/dev/projects/goodwatch/goodwatch-monorepo')
OUT = Path(__file__).resolve().parent
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def load(path): return json.loads(path.read_text())
def git(*args): return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

# Explicit roots only: no environment files, credential stores, cache/model downloads,
# production connections, crawlers or experiment entry points are executed.
groups = {
 'guidance': ['AGENTS.md','CONTEXT.md','docs/agents/issue-tracker.md','docs/agents/triage-labels.md','docs/agents/domain.md','docs/adr/0001-no-jev-for-fingerprint-scoring.md','docs/adr/0002-local-text-embeddings-for-search.md','docs/adr/0011-search-runs-as-a-role-of-the-webapp-image.md','goodwatch-webapp/AGENTS.md','docs/tvtropes.md'],
 'v2-design': ['docs/design/fingerprint-v2'],
 'catalog-gap-audit': ['docs/research/fingerprint-v2-gap-audit'],
 'historical-title-benchmarks': ['docs/benchmarks/fingerprint'],
 'historical-discovery': ['docs/research/jev-search','docs/research/jev-search-prototypes.md','docs/prototypes/search-arena'],
 'source-qa': ['docs/research/tvtropes-repair','goodwatch-flows/windmill/f/tvtropes_web/pages.py','goodwatch-flows/windmill/f/tvtropes_web/crawl.py','goodwatch-flows/scripts/recover_tvtropes.py','goodwatch-flows/scripts/import_tvtropes_recovered.py'],
 'implementation-records': ['TODO.md','docs/research/openrouter-fingerprint-candidates.md','docs/implementation/search-ranking/README.md','docs/text-embedding-removal.md','docs/search-role.md','docs/search-role-deploy.md','docs/search-role-runbook.md','docs/implementation/search-ranking/bm25-acquisition-20261013/offline-bm25-reader-20261013/source-manifest.json','docs/implementation/search-ranking/bm25-acquisition-20261013/offline-bm25-validator-20261013/source-manifest.json'],
 'current-generation-pipeline': ['goodwatch-flows/windmill/f/dna','goodwatch-flows/windmill/f/search','goodwatch-flows/windmill/f/priority','goodwatch-flows/windmill/f/sync/copy','goodwatch-flows/windmill/f/sync/models','goodwatch-flows/windmill/f/sync/populate_crate.flow','goodwatch-flows/windmill/f/data_source/common.py','goodwatch-flows/windmill/f/data_source/details_scan.py','goodwatch-flows/windmill/f/tmdb_api/tmdb_fetch_details_from_api/fetch.py','goodwatch-flows/scripts/load_snapshot_text_vectors.py'],
 'current-search-consumers': ['goodwatch-webapp/app/server/combined-search','goodwatch-webapp/app/server/search-runtime','goodwatch-webapp/app/server/search-ranking','goodwatch-webapp/app/server/title-snapshot','goodwatch-webapp/app/server/role.server.ts','goodwatch-webapp/app/server/utils/fingerprint.ts','goodwatch-webapp/app/server/dna.server.ts','goodwatch-webapp/app/server/title-filter','goodwatch-webapp/app/domain/moods.ts','goodwatch-webapp/app/domain/themes-styles.ts','goodwatch-webapp/app/ui/fingerprint/fingerprintMeta.ts','goodwatch-webapp/app/ui/fingerprint/fingerprintMeta.tsx','goodwatch-webapp/app/server/taste/formula.server.ts','goodwatch-webapp/app/server/explorer/pool.server.ts','goodwatch-webapp/app/server/related.server.ts','goodwatch-webapp/app/server/related-map.server.ts','goodwatch-webapp/app/server/person.server.ts','goodwatch-webapp/scripts/write-title-snapshot.ts','goodwatch-webapp/scripts/fetch-search-models.mjs','goodwatch-webapp/Dockerfile','goodwatch-webapp/package.json','goodwatch-webapp/package-lock.json','goodwatch-webapp/pnpm-lock.yaml'],
}
tracked = set(subprocess.check_output(['git','-C',str(ROOT),'ls-files','-z']).decode().split('\0'))
tree = {}
for line in git('ls-tree','-r','HEAD').splitlines():
    meta, path = line.split('\t',1); tree[path] = meta.split()[2]
statuses = {}
for line in subprocess.check_output(['git','-C',str(ROOT),'status','--porcelain=v1','--untracked-files=all'],text=True).splitlines():
    statuses[line[3:]] = line[:2]

selected = {}
not_found_selectors = []
for group, selectors in groups.items():
    for selector in selectors:
        p = ROOT/selector
        if not p.exists():
            not_found_selectors.append(selector); continue
        for f in sorted(p.rglob('*')) if p.is_dir() else [p]:
            if not f.is_file() or f.is_symlink(): continue
            rel = f.relative_to(ROOT).as_posix()
            if any(x in f.parts for x in ['.venv','__pycache__','node_modules','private','cache','models']):
                # sync/models and dependency locks are source, not downloaded model caches.
                if '/sync/models/' not in rel: continue
            if f.suffix in ['.pyc','.pkl','.npy','.npz','.onnx'] or '.env' in f.name: continue
            if '.test.' in f.name or f.name.startswith('test_'): continue
            selected[rel] = group

# Read text only for secret signatures; never print matched values. Excluded files
# retain a hash/metadata entry, with no snapshot content. This is a bounded safety
# screen, not a claim that arbitrary future inputs are safe to publish.
secret_re = re.compile(rb'(?:sk-or-v1-[0-9a-f]{24,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)')
entries = []
for rel, group in sorted(selected.items()):
    p=ROOT/rel; data=p.read_bytes(); digest=sha(data)
    local_only = '/sources/' in rel and group == 'source-qa'
    secret_found = bool(secret_re.search(data))
    snapshot = None
    if not local_only and not secret_found:
        snapshot = 'snapshots/'+rel
        dest=OUT/snapshot; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
    classification = ['historical']
    quality = 'Historical artifact; interpret via its report and dated scope, not a current run.'
    if group in ['current-generation-pipeline','current-search-consumers']:
        classification=['measured'];quality='Static source bytes observed now; no deployed-state or behavior verification.'
    elif group=='guidance':
        classification=['historical'];quality='Current repository guidance; ADR status and scope retained.'
    elif group=='v2-design':
        classification=['illustrative'] if 'example-matrix' in rel else ['proposed']
        quality='Draft/provenance/index; no V2 output or approved implementation.'
    elif group=='catalog-gap-audit':
        classification=['proposed'] if any(x in p.name for x in ['proposal','recommended']) else ['historical']
        if any(x in p.name for x in ['inventory','top-movies','top-shows','essence-tags-','extraction-manifest']): classification=['measured','historical']
        if 'queries-cases' in p.name: classification=['illustrative']
        quality='Frozen catalog assertions or local audit; not independently verified title truth.'
    elif group=='source-qa': quality='Historical source QA; work/namespace rules and review scope apply; source page bodies stay local.'
    elif group=='historical-title-benchmarks' and any(x in rel for x in ['repeat-cost/','jev/results.json','jev/scores.json','-evidence.json']): classification=['measured','historical']
    elif group=='historical-discovery' and '/results/' in rel: classification=['measured','historical']
    if secret_found: classification=['unavailable'];quality='Potential secret signature: content excluded. Do not publish without separate redaction review.'
    entries.append(dict(path=rel,group=group,bytes=len(data),sha256=digest,snapshot=snapshot,availability='excluded_sensitive' if secret_found else 'local_only' if local_only else 'captured',classification=classification,evidence_quality=quality,git_status=statuses.get(rel,'tracked_clean' if rel in tracked else 'ignored_or_untracked'),head_blob=tree.get(rel),observed_at=NOW,semantic_review='group_report_only; byte capture is not per-file semantic approval'))

dump(OUT/'captures/selection-not-found.json', {'note':'Optional filename variants are selectors, not asserted evidence assets.', 'selectors':not_found_selectors})

# Freeze the exact current prompt and ordered annotations using AST only.
fetch_tree=ast.parse((ROOT/'goodwatch-flows/windmill/f/dna/generate/fetch.py').read_text())
prompt=next(ast.literal_eval(n.value) for n in fetch_tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='system_instructions' for t in n.targets))
(OUT/'current-system-instructions.txt').write_text(prompt)
model_tree=ast.parse((ROOT/'goodwatch-flows/windmill/f/dna/models.py').read_text())
keys=next([n.target.id for n in c.body if isinstance(n,ast.AnnAssign)] for c in model_tree.body if isinstance(c,ast.ClassDef) and c.name=='CoreScores')
dump(OUT/'current-score-keys.json',keys)
annotations={c.name:[{'field':n.target.id,'annotation':ast.unparse(n.annotation),'default':ast.unparse(n.value) if n.value else None} for n in c.body if isinstance(n,ast.AnnAssign)] for c in model_tree.body if isinstance(c,ast.ClassDef) and any(isinstance(b,ast.Name) and b.id=='BaseModel' for b in c.bases)}
dump(OUT/'current-schema-annotations.json',{'capture_method':'AST only; exact models.py bytes are authoritative. Not a runtime model_json_schema execution.','models':annotations,'runtime_strict_schema':'fetch.strict_schema makes every object disallow additional properties, requires every property including nullable animation_style, and removes defaults.','validation_after_parse':['strict Pydantic JSON validation','score range 0..10','at least one nonzero score','highlight keys must exist among score keys'],'prompt_constraints_not_explicitly_validated_in_fetch':['highlight count 4..8 and uniqueness','tag count 8..10 and distinctness','essence sentence count','anime/style conditional']})

# Verify inherited source hashes; compression hashes and decompressed byte hashes
# are different checks, both retained. No SQL or inventory export is rerun.
inherited=[]
def check(path,expected,kind,content=None):
    exists=path.exists(); actual=sha(path.read_bytes() if content is None else content) if exists else None
    inherited.append({'path':str(path.relative_to(ROOT)),'kind':kind,'expected':expected,'actual':actual,'status':'missing' if not exists else 'match' if expected==actual else 'mismatch'})
cat=load(ROOT/'docs/design/fingerprint-v2/wayfinder/asset-catalog.json')
for row in cat['files']: check(ROOT/row['path'],row['sha256'],'prior_asset_catalog')
bench=ROOT/'docs/benchmarks/fingerprint'
for name,h in load(bench/'manifest.json')['sha256'].items(): check(bench/name,h,'frozen_title_benchmark')
gap=ROOT/'docs/research/fingerprint-v2-gap-audit'
for name in ['title-extraction-manifest.json','essence-extraction-manifest.json','tropes-extraction-manifest.json']:
    for file,row in load(gap/name)['datasets'].items():
        target=gap/row.get('archive_file',file)
        if 'archive_file' in row:
            check(target,row['archive_sha256'],'inventory_archive')
            check(target,row['sha256'],'inventory_decompressed',gzip.decompress(target.read_bytes()))
        else: check(target,row['sha256'],'inventory_raw')
check(gap/'tropes-stored-examples.json',load(gap/'tropes-example-extraction-manifest.json')['sha256'],'stored_excerpt_export')
snapshot=load(ROOT/'docs/research/jev-search/snapshot.json')
for file,h in snapshot['sha256'].items(): check(ROOT/file,h,'jev_prototype_lineage')
dump(OUT/'inherited-hash-checks.json',inherited)

# Bounded mechanical QA of already-exported public catalog fields. All candidate
# flags are quarantines for human/source review, never automatic merges/labels.
qa={'method':'Offline deterministic scans of supplied frozen exports; no catalog requests, crawl or viewing. Zero gold admissions.','title_exports':{},'review_candidates':[]}
for filename,media in [('top-movies.json','movie'),('top-shows.json','show')]:
    rows=load(gap/filename); ids=collections.Counter(r['tmdb_id'] for r in rows); names=collections.defaultdict(list)
    for i,r in enumerate(rows): names[r['title'].strip().casefold()].append({'rank':i+1,'media_type':media,'tmdb_id':r['tmdb_id'],'title':r['title']})
    qa['title_exports'][media]={'rows':len(rows),'duplicate_ids':[k for k,v in ids.items() if v>1],'same_name_distinct_id_candidates':[v for v in names.values() if len(v)>1],'missing_essence_tags':sum(not r.get('essence_tags') for r in rows),'missing_synopsis':sum(not r.get('synopsis') for r in rows),'identity_limit':'Exports omit release dates, IMDb IDs and edition/episode metadata. Names and original_title alone cannot prove work identity.'}
    for i,r in enumerate(rows):
        if media=='show' and r['tmdb_id']==333439:
            qa['review_candidates'].append({'source':filename,'row_index':i,'identity':'show:333439','reason':'Prior audit flags high-vote, no-synopsis/no-tags catalog anomaly. No content facts inferred.','decision':'quarantine'})
urls=load(gap/'tropes-url-inventory.json')
malformed=[r for r in urls if re.match(r'https?://(?:www\.)?tvtropes\.orghttps?://',r.get('url',''))]
qa['trope_urls']={'rows':len(urls),'duplicate_prefix_strings':len(malformed),'affected_detailed_associations':sum(r['associations'] for r in malformed),'malformed_urls':malformed,'rule':'Detect duplicated scheme/host prefix only; no canonical URL repair or count merging performed. Other malformed URLs may remain.'}
ex=load(gap/'tropes-stored-examples.json'); shared=collections.defaultdict(list); signals=[]
for i,r in enumerate(ex):
    ident=f"{r.get('media_type')}:{r.get('media_tmdb_id')}"
    text=r.get('excerpt_text','')
    shared[(r.get('url'),text)].append({'row_index':i,'identity':ident,'title':r.get('title')})
    flags=[]
    if re.search(r'\bavert(?:ed|s)?\b',text,re.I): flags.append('averted_or_mixed_application')
    if re.search(r'\b(?:season|episode|finale)\b',text,re.I): flags.append('segment_scope_candidate')
    if re.search(r'\b(?:album|novel|books?)\b',text,re.I): flags.append('different_medium_or_source_comparison_candidate')
    if re.search(r'\b(?:subvert\w*|hypothetical|would have|could have)\b',text,re.I): flags.append('polarity_or_hypothetical_candidate')
    if flags: signals.append({'row_index':i,'identity':ident,'title':r.get('title'),'trope':r.get('name'),'flags':flags,'excerpt_sha256':sha(text.encode()),'decision':'quarantine; exact participant/event and scope review required'})
qa['trope_excerpts']={'rows':len(ex),'exact_duplicate_url_excerpt_across_id_groups':[v for v in shared.values() if len(set(x['identity'] for x in v))>1],'signals':signals,'scope_examples':[{k:r.get(k) for k in ['name','media_type','media_tmdb_id','title','release_year']}|{'row_index':i} for i,r in enumerate(ex) if r.get('title') in ['The Wall','Twilight','Fame']],'limit':'Literal keyword candidates contain false positives and miss implicit scope/polarity. Prior narrative report documents album/book/finale mismatches; no automated factual ruling.'}
edition_pattern=re.compile(r"\b(?:director[’']?s\s+cut|extended\s+(?:cut|edition|version)|theatrical\s+(?:cut|edition|version)|uncut\s+(?:edition|version)|restored\s+(?:edition|version)|special\s+edition)\b",re.I)
editions=[]
for filename,media in [('top-movies.json','movie'),('top-shows.json','show'),('tropes-stored-examples.json',None)]:
    for i,r in enumerate(load(gap/filename)):
        hits=[]
        for field,value in r.items():
            text=' '.join(map(str,value)) if isinstance(value,list) else str(value or '')
            if edition_pattern.search(text): hits.append({'field':field,'value_sha256':sha(text.encode())})
        if hits: editions.append({'source':filename,'row_index':i,'identity':f"{media or r.get('media_type')}:{r.get('tmdb_id',r.get('media_tmdb_id'))}",'title':r.get('title'),'fields':hits,'decision':'quarantine edition interpretation; source may compare editions rather than identify one'})
qa['edition_scope_candidates']={'rows':editions,'method':'Literal cut/edition/version cues in existing exports, not edition verification. Lack of a cue does not prove whole-work or theatrical-edition scope.'}
qa['gold_admission_policy']={'admitted_rows':0,'requirements':['Resolve media type plus stable catalog ID, original/release identity, aliases/remakes and duplicate listings without name-only merges.','Confirm source refers to the same work and distinguish movie/show/season/episode/edition and temporal segment.','Preserve original stored URL, validated canonical URL and namespace; separate malformed prefixes/aliases from source assertions.','Read excerpt for asserted/averted/subverted/referenced/hypothetical application and bind participants/events; a mention is not positive presence.','Record source capture timestamp/hash, independent reviewer judgment and coverage/unknown state.','Independent factual review belongs to corpus/reference ticket; definitions, feature selection and quality gates remain undecided.']}
dump(OUT/'source-quality-audit.json',qa)

missing=[]
def gap_entry(location,status,reason,recovery): missing.append({'location':location,'status':status,'reason':reason,'reuse_or_recovery':recovery})
for loc in ['docs/benchmarks/fingerprint/jev/private/experiment.env','docs/benchmarks/fingerprint/jev/private/runs']:
    exists=(ROOT/loc).exists()
    gap_entry(loc,'private_not_inspected' if exists else 'unavailable_local', 'Credentials are never opened; Jev raw captures are gitignored, sanitized results alone do not reproduce every call.', 'Owner/private custodian can provide redacted capture manifest, response IDs and cost ledger; never publish credential files.')
for loc in ['docs/prototypes/search-arena/data/catalog.jsonl.gz','docs/prototypes/search-arena/data/catalog.pkl','docs/prototypes/search-arena/data/emb-bge-base-en-v1.5-notitle.npy','docs/prototypes/search-arena/data/emb-multilingual-e5-small.npy','docs/prototypes/search-arena/data/captures','docs/prototypes/search-arena/results/grading']:
    gap_entry(loc,'present_not_loaded' if (ROOT/loc).exists() else 'unavailable_local','Arena README archives raw captures/grading on proto/search-simplify; large catalog and vectors are gitignored even there.','Reuse existing custodian copies or immutable archive branch; do not regenerate paid readings or inventory. Hash catalog row order, embeddings, dtype/dimensions and matching readings before a replay.')
gap_entry('docs/research/tvtropes-repair/run-2026-09-26b/sources','unavailable_local' if not (ROOT/'docs/research/tvtropes-repair/run-2026-09-26b/sources').exists() else 'local_only','TV Tropes source page bodies stay local; historical review/import metadata is preserved.','Private custodian supplies local body manifest if needed; no new fetch or crawl.')
gap_entry('Production: title-snapshot:current + title-snapshot:<version>:*; search_index_builds[current] + blob files; Qdrant collection/vector config and counts; Windmill schedules/script hashes; role deployment commits','unverified_live','No production connections, schedule reads, manifests or host inspection performed; local HEAD is not a deployment identity.','If a later trial needs live-baseline parity, obtain an authorized sanitized read-only capture with UTC timestamp, manifest/chunk hashes, collection/version, per-role deployment commits and source watermark. No broad inventory re-export.')
gap_entry('Pinned encoder binaries and host caches: SEARCH_MODEL_CACHE / SEARCH_MODEL_DIR','unverified_binary','Code revisions, hashes, pooling, dimensions and limits are captured; no model files loaded/downloaded or on-host hash audit.','Reuse verified cached files; compare file hashes with pinned source config before any authorized replay.')
gap_entry('Original private conversation links in TODO.md; independently judged V2 references and new blind holdout','unavailable_or_uncreated','Private discussion contents not fetched; V2 examples are illustrative, synthetic queries exposed.','Corpus/quality and holdout tickets own independent judgments and fresh hidden confirmation. This prerequisite does not invent them.')
dump(OUT/'missing-and-private-assets.json',missing)

manifest={'schema_version':'goodwatch.fingerprint-baseline.v1','bundle_version':'1.0.0','captured_at':NOW,'repository':'alp82/goodwatch-monorepo','repository_root':str(ROOT),'head':git('rev-parse','HEAD'),'branch':git('branch','--show-current'),'map':{'title':'Benchmark a richer fingerprint and discovery system','url':'https://github.com/alp82/goodwatch-monorepo/issues/716'},'task':{'title':'Capture the current baseline and audited evidence bundle','url':'https://github.com/alp82/goodwatch-monorepo/issues/718'},'published_evidence_ref':load(OUT/'captures/published-ref.json')['object']['sha'],'capture_scope':'Static/read-only audit and offline hash/structure/QA verification, not current production attestation. Existing exports reused. No benchmark or inference execution.','classification_values':['measured','historical','proposed','illustrative','waived','unavailable','superseded'],'classification_semantics':{'measured':'An observation with a stated mechanism; static bytes and historical run metrics have different evidence_quality. Never means factual gold.','historical':'Dated prior artifact/observation, not a current service guarantee.','proposed':'Draft design, planned experiment or unapproved implementation.','illustrative':'Synthetic or explanatory example, not model output or observed demand.','waived':'Explicit gate waiver, never a passing measurement.','unavailable':'No usable audited content at this location.','superseded':'A specific claim replaced by a later source, preserving original artifact.'},'files':entries,'unavailable_assets':'missing-and-private-assets.json','claim_level_classification':'evidence-register.json','integrity_policy':{'hash':'SHA-256 exact bytes','source_snapshots':'snapshots/<repository-relative-path>; local_only source bodies deliberately not copied','self_exclusion':'manifest.json excludes itself; SHA256SUMS hashes it plus schema/reports/captures/snapshots. SHA256SUMS and verification.json exclude themselves.','source_and_copy_validation':'validate_bundle.py checks each source file and snapshot against this manifest; inherited export hashes checked separately.','working_tree':'Untracked/modified state and HEAD blob recorded separately; branch alone never identifies draft content.','semantic_review':'Byte capture is exhaustive over selected roots; semantic audit is narrow and explicitly scoped by group/report.'}}
dump(OUT/'manifest.json',manifest)
print(json.dumps({'files':len(entries),'snapshots':sum(bool(e['snapshot']) for e in entries),'local_only':sum(e['availability']=='local_only' for e in entries),'excluded_sensitive':sum(e['availability']=='excluded_sensitive' for e in entries),'bytes':sum(e['bytes'] for e in entries),'inherited_checks':dict(collections.Counter(c['status'] for c in inherited)),'duplicate_prefix_urls':len(malformed),'qa_signal_rows':len(signals)},indent=2))
