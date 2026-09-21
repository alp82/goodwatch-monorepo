"""Offline metrics audit. No provider calls. --apply backfills supplied report/raw files.

Uses original metrics on cache hits, or exact generation ID matches. Historical failed
reranks may be attributed only by a unique exact complete candidate-ID set plus model/stage.
Missing/ambiguous attribution remains unknown. Cost projections are not spend ledgers.
"""
import argparse
from collections import defaultdict
from copy import deepcopy
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
PRIVATE = ROOT / 'private'


def read(path): return json.loads(path.read_text())
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def load_attempts():
    attempts = []
    generations = {}
    for path in (PRIVATE / 'model_pipeline').glob('attempt-*.json'):
        data = read(path); metrics = data.get('metrics', {})
        raw = data.get('raw', {}); generation = metrics.get('generation_id') or raw.get('id')
        if generation and generation in generations: continue
        match = re.match(r'attempt-(.+)-([a-f0-9]{64})-\d+\.json$', path.name)
        stage = match.group(1) if match else None
        try: value = json.loads(raw['choices'][0]['message']['content'])
        except (KeyError, IndexError, ValueError, TypeError): value = {}
        keys = value.get('considered_keys')
        if keys is None and 'candidate_outcomes' in value: keys = [x['key'] for x in value['candidate_outcomes']]
        item = {'path': path, 'metrics': metrics, 'generation_id': generation, 'stage': stage,
                'candidate_keys': frozenset(keys) if keys else None}
        attempts.append(item)
        if generation: generations[generation] = item
    return attempts, generations


def normalize(metrics, generations):
    if not isinstance(metrics, dict): return None
    prior = generations.get(metrics.get('generation_id'), {}).get('metrics', {})
    hit = metrics.get('cache_hit') is True
    def original(name):
        if not hit: return metrics.get(name)
        return metrics.get('original_' + name, prior.get(name))
    return {'cache_hit': hit, 'actual_execution_wall_ms': metrics.get('wall_ms'),
            'actual_new_model_spend_usd': 0 if hit else metrics.get('cost_usd'),
            'cold_model_wall_ms': original('wall_ms'), 'cold_model_cost_usd': original('cost_usd'),
            'generation_id': metrics.get('generation_id'),
            'source': 'original cache metadata or exact generation' if hit else 'observed API call'}


def metrics_walk(value, generations, path='$'):
    found = []
    if isinstance(value, dict):
        if 'cache_hit' in value and ('usage' in value or 'generation_id' in value):
            found.append({'path': path, **normalize(value, generations)})
        for key, child in value.items():
            if key != 'raw': found.extend(metrics_walk(child, generations, path + '.' + key))
    elif isinstance(value, list):
        for i, child in enumerate(value): found.extend(metrics_walk(child, generations, f'{path}[{i}]'))
    return found


def failed_match(raw, variant, attempts):
    if variant == 'evidence_rerank':
        candidates = raw.get('rerank_candidates', []); stage = 'rerank'; model = 'google/gemini-3.1-flash-lite'
    elif variant in ('compact_25', 'compact_31'):
        candidates = raw.get('candidates', []); stage = 'rerank_compact'
        model = 'google/gemini-2.5-flash-lite' if variant.endswith('25') else 'google/gemini-3.1-flash-lite'
    else: return None
    keys = frozenset(str(c['key']) for c in candidates)
    matches = [a for a in attempts if a['stage'] == stage and a['metrics'].get('model') == model and a['candidate_keys'] == keys]
    return matches[0] if len(matches) == 1 else None


def audit_report(path, attempts, generations, apply=False):
    report = read(path); changes = []
    raw_dir = path.with_suffix(''); raw_dir = raw_dir.with_name(raw_dir.name + '-raw')
    for round_ in report.get('rounds', []):
        for case in round_.get('cases', []):
            raw_path = raw_dir / (case['id'] + '.json')
            if not raw_path.exists(): continue
            raw = read(raw_path)
            for variant, row in case.get('results', {}).items():
                audit = None
                if row.get('error'):
                    match = failed_match(raw, variant, attempts)
                    if match:
                        audit = normalize(match['metrics'], generations)
                        audit.update({'attribution': 'unique exact complete candidate-ID set plus model/stage', 'attempt_artifact': match['path'].name})
                        # Failure latency is only the failed model stage: never pretend it
                        # includes unrecorded full-search overhead.
                        row['failed_model_wall_ms'] = audit['cold_model_wall_ms']
                        row['failed_model_cost_usd'] = audit['cold_model_cost_usd']
                        row['wall_ms'] = None
                        row['cost_usd'] = None
                    else:
                        row['wall_ms'] = None; row['cost_usd'] = None
                        audit = {'attribution': 'unknown; no unique exact saved-attempt match',
                                 'actual_new_model_spend_usd': None, 'cold_model_wall_ms': None, 'cold_model_cost_usd': None}
                elif variant in ('planned_union_fast31', 'baseline_union_fast31'):
                    rerank = raw.get('arms', {}).get(variant, {}).get('rerank', {})
                    metrics = rerank.get('metrics')
                    if metrics:
                        audit = normalize(metrics, generations)
                        components = row.get('components_ms', {})
                        upstream = components.get('reconstructed_parallel_upstream_critical_path')
                        if upstream is not None and audit['cold_model_wall_ms'] is not None:
                            row['wall_ms'] = upstream + audit['cold_model_wall_ms']
                            components['measured_fast_rerank'] = audit['cold_model_wall_ms']
                        # Rebuild the frozen upstream cost independently of a possibly
                        # already-inflated report total, making this operation idempotent.
                        baseline = case.get('results', {}).get('corrected', {}).get('cost_usd')
                        planning = normalize(raw.get('planning', {}).get('metrics', {}), generations)
                        plan_cost = planning['cold_model_cost_usd'] if variant == 'planned_union_fast31' and planning else 0
                        if baseline is not None and plan_cost is not None and audit['cold_model_cost_usd'] is not None:
                            row['cost_usd'] = baseline + plan_cost + audit['cold_model_cost_usd']
                        row['actual_new_model_spend_usd'] = audit['actual_new_model_spend_usd']
                if audit is not None:
                    row['metrics_audit'] = audit
                    changes.append({'case_id': case['id'], 'variant': variant, **audit})
            raw['report_case'] = deepcopy(case)
            if apply: write(raw_path, raw)
    if apply: write(path, report)
    return {'report': str(path), 'applied': apply, 'changes': changes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reports', nargs='*', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', type=Path, default=PRIVATE / 'metrics-audit.json')
    args = parser.parse_args()
    attempts, generations = load_attempts()
    cache_audit = []
    # Look only at caches/artifacts, not public duplicated reports, for cache metadata audit.
    paths = list((PRIVATE / 'model_pipeline').glob('*.json')) + list(PRIVATE.glob('loop*-raw/*.json'))
    for path in paths:
        if path.name.startswith('attempt-'): continue
        for item in metrics_walk(read(path), generations):
            if item['cache_hit']: cache_audit.append({'artifact': str(path.relative_to(PRIVATE)), **item})
    out = {'note': 'No provider calls. Cold projections, observed current execution, and new spend are separate. Failed model-stage measurements do not establish complete search latency/cost.',
           'cache_hits': cache_audit, 'reports': [audit_report(p, attempts, generations, args.apply) for p in args.reports]}
    write(args.output, out)
    print(json.dumps({'cache_hit_records': len(cache_audit), 'reports': [{'report':r['report'],'updated_or_audited':len(r['changes'])} for r in out['reports']]}))


if __name__ == '__main__': main()
