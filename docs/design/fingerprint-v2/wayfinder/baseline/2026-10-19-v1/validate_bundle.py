#!/usr/bin/env python3
"""Validate offline evidence, never import app code, load models or open secrets.

Requires the already-installed jsonschema package. No installation/download occurs.
Use --snapshot-only after publication/extraction without the source checkout.
"""
import argparse
import collections
import copy
import datetime as dt
import gzip
import hashlib
import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path, PurePosixPath
from jsonschema import Draft202012Validator, FormatChecker

B=Path(__file__).resolve().parent
def load(p): return json.loads(p.read_text())
def sha(data): return hashlib.sha256(data).hexdigest()
def safe_path(s):
    p=PurePosixPath(s)
    if not s or p.is_absolute() or '..' in p.parts or '\\' in s: raise ValueError('Unsafe path')
    return p
def checked_file(p,h,size=None):
    data=p.read_bytes()
    if sha(data)!=h: raise ValueError('Hash mismatch: '+str(p))
    if size is not None and len(data)!=size: raise ValueError('Size mismatch: '+str(p))
    return data
def main():
    args=argparse.ArgumentParser()
    args.add_argument('--snapshot-only',action='store_true')
    args.add_argument('--no-seal',action='store_true',help='First-pass preparation only')
    args.add_argument('--self-test',action='store_true')
    opt=args.parse_args()
    m=load(B/'manifest.json'); root=Path(m['repository_root'])
    validator=Draft202012Validator(load(B/'manifest.schema.json'),format_checker=FormatChecker())
    validator.validate(m)
    paths=[f['path'] for f in m['files']]
    assert len(paths)==len(set(paths)), 'Duplicate source paths'
    indexed={f['path']:f for f in m['files']}
    recovered=load(B/'captures/jev-lineage-recovery.json')
    snapshots=sources=local_only=0
    for f in m['files']:
        safe_path(f['path'])
        if f['snapshot']:
            safe_path(f['snapshot'])
            assert f['snapshot']=='snapshots/'+f['path']
            checked_file(B/f['snapshot'],f['sha256'],f['bytes']);snapshots+=1
        elif f['availability']=='local_only': local_only+=1
        if not opt.snapshot_only:
            checked_file(root/f['path'],f['sha256'],f['bytes']);sources+=1
    archive_count=0
    if (B/'snapshots.tar.gz').exists():
        expected_archive={f['snapshot']:f for f in m['files'] if f['snapshot']}
        archived=set()
        with tarfile.open(B/'snapshots.tar.gz','r:gz') as archive:
            for member in archive:
                safe_path(member.name)
                assert member.isfile() and member.name in expected_archive
                assert member.name not in archived
                f=expected_archive[member.name]; data=archive.extractfile(member).read()
                assert len(data)==f['bytes'] and sha(data)==f['sha256']
                archived.add(member.name);archive_count+=1
        assert archived==set(expected_archive)
    def original(path):
        f=indexed.get(path)
        if f and f['snapshot']: return B/f['snapshot']
        lineage=next((r for r in recovered if r['path']==path),None)
        return B/lineage['current_snapshot'] if lineage else root/path
    inherited=load(B/'inherited-hash-checks.json')
    mismatch=[]
    for c in inherited:
        p=original(c['path']); data=p.read_bytes()
        if c['kind']=='inventory_decompressed': data=gzip.decompress(data)
        assert sha(data)==c['actual'], 'Inherited audited bytes changed'
        if c['expected']!=c['actual']: mismatch.append(c['path'])
    assert mismatch==['goodwatch-webapp/app/server/prototype-jev-vector.server.ts']
    for r in recovered:
        checked_file(B/r['frozen_snapshot'],r['expected_sha256'])
        checked_file(B/r['current_snapshot'],r['current_sha256'])
        if not opt.snapshot_only: checked_file(root/r['path'],r['current_sha256'])
        assert r['matches_preserved_manifest'] is True
    # The lineage-current files sit under captures, not the primary source roots.
    for c in inherited:
        if c['kind']=='jev_prototype_lineage':
            r=next(r for r in recovered if r['path']==c['path'])
            assert c['actual']==r['current_sha256']
    keys=load(B/'current-score-keys.json')
    text=original('goodwatch-webapp/app/server/utils/fingerprint.ts').read_text()
    keyblock=text.split('export const VALID_FINGERPRINT_KEYS',1)[1].split('= [',1)[1].split('] as const',1)[0]
    webkeys=re.findall(r'"([a-z_]+)"',keyblock)
    historical=load(original('docs/benchmarks/fingerprint/score-keys.json'))
    assert len(keys)==74 and keys==webkeys==historical,'V1 key-order mismatch'
    hold=load(original('docs/prototypes/search-arena/results/simplify/holdout5/lists/combo-safe-v2.json'))
    assert set(hold)=={f'h5-{i:02}' for i in range(1,31)}
    qa=load(B/'source-quality-audit.json')
    assert qa['gold_admission_policy']['admitted_rows']==0
    for media,name,expect_rows,expect_missing,expect_syn in [('movie','top-movies.json',2000,8,0),('show','top-shows.json',1000,8,5)]:
        rows=load(original('docs/research/fingerprint-v2-gap-audit/'+name))
        assert len(rows)==expect_rows==qa['title_exports'][media]['rows']
        assert len(set(r['tmdb_id'] for r in rows))==expect_rows
        assert sum(not r.get('essence_tags') for r in rows)==expect_missing
        assert sum(not r.get('synopsis') for r in rows)==expect_syn
    urls=load(original('docs/research/fingerprint-v2-gap-audit/tropes-url-inventory.json'))
    bad=[r for r in urls if re.match(r'https?://(?:www\.)?tvtropes\.orghttps?://',r.get('url',''))]
    assert len(bad)==1452==qa['trope_urls']['duplicate_prefix_strings']
    assert sum(r['associations'] for r in bad)==3416==qa['trope_urls']['affected_detailed_associations']
    edition_rows=qa['edition_scope_candidates']['rows']
    assert {r['identity'] for r in edition_rows}=={'movie:791373','movie:1495','movie:949'}
    for r in edition_rows:
        row=load(original('docs/research/fingerprint-v2-gap-audit/'+r['source']))[r['row_index']]
        for hit in r['fields']:
            value=row[hit['field']]
            text=' '.join(map(str,value)) if isinstance(value,list) else str(value or '')
            assert sha(text.encode())==hit['value_sha256']
    # Every evidence/contract inline reference must bind to its audited bytes.
    reference_count=0
    def refs(value):
        nonlocal reference_count
        if isinstance(value,dict):
            if all(k in value for k in ['path','sha256','snapshot']):
                f=indexed[value['path']]
                assert value['sha256']==f['sha256'] and value['snapshot']==f['snapshot']
                reference_count+=1
            for v in value.values(): refs(v)
        elif isinstance(value,list):
            for v in value: refs(v)
    refs(load(B/'evidence-register.json')); refs(load(B/'contract-identities.json')); refs(m['provenance_discrepancies'])
    assert all(r['classification'] for r in load(B/'evidence-register.json')['records'])
    published=load(B/'captures/published-asset-catalog.json')
    assert sha((B/'captures/published-asset-catalog.json').read_bytes())==indexed['docs/design/fingerprint-v2/wayfinder/asset-catalog.json']['sha256']
    assert len(published['files'])==sum(c['kind']=='prior_asset_catalog' for c in inherited)
    seal_count=0
    if not opt.no_seal:
        sealed=set()
        for line in (B/'SHA256SUMS').read_text().splitlines():
            h,name=line.split('  ',1);safe_path(name)
            checked_file(B/name,h);sealed.add(name);seal_count+=1
        eligible={p.relative_to(B).as_posix() for p in B.rglob('*') if p.is_file() and p.name not in ['SHA256SUMS','verification.json'] and '__pycache__' not in p.parts}
        assert sealed==eligible,'Unsealed artifact or missing sealed file'
    checkout='not_checked_snapshot_only'
    if not opt.snapshot_only:
        before=load(B/'captures/checkout-start.json')
        after=load(B/'captures/checkout-end.json')
        assert before['head']==m['head']
        assert before['branch']==after['branch']==m['branch']
        assert after['staged_diff_empty'] is True
        # Verify the initial serialized index tree equalled HEAD's tree (no staged changes).
        head_tree=subprocess.check_output(['git','-C',str(root),'rev-parse',m['head']+'^{tree}'],text=True).strip()
        assert before['index_tree']==head_tree
        if before['head']==after['head']:
            assert before['status_porcelain_v1']==after['status_porcelain_v1']
            checkout='branch_head_status_unchanged_and_no_staged_changes'
        else:
            change=load(B/'captures/concurrent-checkout-change.json')
            assert change['from_head']==before['head'] and change['to_head']==after['head']
            assert change['audited_paths_changed']==[]
            subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',before['head'],after['head']],check=True)
            changed=subprocess.check_output(['git','-C',str(root),'diff','--name-only',before['head'],after['head']],text=True).splitlines()
            assert changed==change['changed_paths']
            assert not set(changed).intersection(indexed)
            checkout='concurrent_unrelated_commit_recorded; all_audited_source_hashes_unchanged; branch_unchanged; no_staged_changes'
    negative=[]
    if opt.self_test:
        broken=copy.deepcopy(m);broken['files'][0]['sha256']='invalid'
        assert list(validator.iter_errors(broken));negative.append('invalid_hash_rejected_by_schema')
        broken=copy.deepcopy(m);del broken['files'][0]['bytes']
        assert list(validator.iter_errors(broken));negative.append('missing_required_field_rejected')
        for path in ['/etc/passwd','../escape','snapshots/../../escape']:
            try: safe_path(path)
            except ValueError: pass
            else: raise AssertionError('Unsafe path accepted')
        negative.append('absolute_and_traversal_paths_rejected')
        sample=B/'current-system-instructions.txt'; expected=sha(sample.read_bytes())
        with tempfile.TemporaryDirectory(prefix='integrity-negative-',dir=B) as temp:
            fixture=Path(temp)/'tampered.txt';fixture.write_bytes(sample.read_bytes()+b'\nTAMPER')
            try: checked_file(fixture,expected)
            except ValueError: pass
            else: raise AssertionError('Tampered content accepted')
        negative.append('tampered_file_rejected_by_hash_validator')
    receipt={'schema_version':'goodwatch.fingerprint-baseline-verification.v1','verified_at':dt.datetime.now(dt.timezone.utc).isoformat(),'success':True,'mode':'snapshot_only' if opt.snapshot_only else 'source_and_snapshot','manifest_schema_valid':True,'source_files_checked':sources,'snapshot_files_checked':snapshots,'archive_members_checked':archive_count,'local_only_source_files':local_only,'inherited_hash_checks':len(inherited),'inherited_matches':len(inherited)-len(mismatch),'preserved_mismatches_with_exact_historical_recovery':mismatch,'recovered_historical_files_checked':len(recovered),'inline_hashed_source_references_checked':reference_count,'sealed_files_checked':seal_count,'seal_sha256':sha((B/'SHA256SUMS').read_bytes()) if not opt.no_seal else None,'v1_key_count_and_order_verified':74,'holdout5_query_keys_verified':30,'qa_counts_recomputed':True,'gold_admissions':0,'checkout':checkout,'negative_checks':negative,'not_run':['Application tests','Model inference or benchmark replay','Live production/configuration/storage checks','Model binary/vector parity','Invoice reconciliation','Independent title-content/gold judgment'],'local_only_portability':'Snapshot-only mode cannot verify omitted local-only source bodies without the original machine; their recorded hashes remain provenance.'}
    (B/'verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))
if __name__=='__main__':main()
