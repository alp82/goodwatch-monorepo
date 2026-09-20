"""PROTOTYPE: bounded, resumable 13-development-request comparison.

Uses frozen earlier controls and the approved 50k scratch snapshot. No production
writes. Actual model calls max two concurrently. Run --help for invocation.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import re
from pathlib import Path
import time

import experiment
import model_pipeline
import search_variants

VARIANTS = [
    ('corrected', 'Frozen corrected control'),
    ('english_phrase', 'Frozen English phrase control'),
    ('planned_facets', 'Semantic plan + joint facets'),
    ('planned_balanced', 'Semantic plan + balanced ranking'),
    ('evidence_rerank', 'Semantic plan + evidence rerank'),
]




def rerank_variant_id(arm, args):
    if args.rerank_model == 'google/gemini-3.1-flash-lite' and args.packing_version == 2:
        return arm + ('_ids_v3_minimal' if args.minimal_reasoning else '_ids_v2' if args.ids_only else '')
    prefix = 'planned_union' if arm.startswith('planned') else 'baseline_union'
    model = re.sub(r'[^a-z0-9]+', '_', args.rerank_model.lower()).strip('_')
    return f'{prefix}_{model}_packing{args.packing_version}' + ('_ids_v3_minimal' if args.minimal_reasoning else '_ids_v2' if args.ids_only else '')


def selected_rerank(request, plan, pool, args, reading=None):
    method = model_pipeline.rerank_ids_minimal if args.minimal_reasoning else model_pipeline.rerank_ids if args.ids_only else model_pipeline.rerank_fast
    return method(request, plan, pool, cache=not args.no_cache,
                                     model=args.rerank_model, reading=reading, packing_version=args.packing_version)

def cold_model_metrics(metrics):
    """Never compare tiny local-cache lookups against live inference latency."""
    if metrics.get('cache_hit'):
        wall = metrics.get('original_wall_ms', metrics.get('original_api_wall_ms'))
        cost = metrics.get('original_cost_usd')
        if wall is None or cost is None:
            raise ValueError('Cached response lacks original timing/cost; cold projection unavailable')
        return wall, cost
    return metrics['wall_ms'], metrics.get('cost_usd', 0)


def hygienic_pool(rows):
    retained, excluded = [], []
    for row in rows:
        reasons = search_variants.candidate_hygiene(row)
        if reasons:
            excluded.append({'key': row['key'], 'reasons': reasons})
        else:
            retained.append(row)
    return retained, excluded


def constrain_planned_pool(rows, plan):
    retained, excluded = [], []
    for row in rows:
        reasons = []
        if plan.get('media_type') and row.get('media_type') != plan['media_type']:
            reasons.append('validated_media_type_conflict')
        classified = search_variants.candidate_format(row)
        if plan.get('format') == 'fiction' and classified['documentary']:
            reasons.append('known_documentary_conflicts_with_fiction')
        if plan.get('format') == 'documentary' and classified['fiction']:
            reasons.append('known_fiction_conflicts_with_documentary')
        if reasons:
            excluded.append({'key': row['key'], 'reasons': reasons})
        else:
            retained.append({**row, 'format_unknown': bool(plan.get('format') and classified['unknown'])})
    return retained, excluded

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temporary.replace(path)


def case_id(request):
    return hashlib.sha256(request.encode()).hexdigest()[:12]


def reconstruct_control(case, frozen, variant, by_key):
    result = frozen['summary'][variant]
    usages = [case.get('attributes', {}).get('usage', {}), case.get('reading', {}).get('usage', {})]
    jev_ms = max((u.get('ms', 0) for u in usages), default=0)
    cost = sum(u.get('usd', 0) for u in usages)
    top = [{**by_key[r['key']], **r} for r in result['top10']]
    return {'top10': top, 'first': top[0] if top else None,
            'wall_ms': result['median_wall_ms'] + jev_ms, 'cost_usd': cost,
            'retrieval_wall_ms': result['median_wall_ms'],
            'components_ms': {'captured_jev_parallel_max': jev_ms, 'frozen_median_retrieval': result['median_wall_ms']},
            'diagnostics': {'timing_kind': 'reconstructed_end_to_end_NOT_current_measurement',
                            'timing_formula': 'max(captured attribute ms,captured fingerprint ms) + frozen retrieval median',
                            'cost_kind': 'captured prior Jev cost; no new spend',
                            'candidate_count': result.get('candidates'), 'frozen_allowed_counts': frozen.get('allowed_counts'),
                            'eligibility': 'frozen Jev filters; differs from semantic plan eligibility',
                            'vector_fill': 'not run', 'frozen_source': 'private/comparison.json',
                            'gated': result.get('gated'), 'searched': result.get('searched')}}


def candidate_union(facets, balanced, control):
    # Reserve every corrected top10 baseline candidate; fills can total 70 before
    # deduplication, so trim the tail of the new-candidate list to the hard cap60.
    primary = facets[:40] + balanced[:20]
    mandatory = {r['key']: r for r in control[:10]}
    unique = {}
    for row in primary:
        unique.setdefault(row['key'], row)
    selected = list(unique.values())[:60 - len(mandatory)]
    for row in mandatory.values():
        if row['key'] not in {x['key'] for x in selected}:
            selected.append(row)
    # Baseline overlaps can leave room: continue primary order up to the cap.
    seen = {r['key'] for r in selected}
    for row in unique.values():
        if len(selected) >= 60:
            break
        if row['key'] not in seen:
            selected.append(row)
            seen.add(row['key'])
    return selected, {'union_policy': 'facets top40 + balanced top20 + corrected top10; preserve every corrected top10; cap60 trims tail of novel candidates',
                      'primary_unique': len(unique), 'mandatory_count': len(mandatory), 'final_count': len(selected),
                      'mandatory_keys': list(mandatory)}


def run_case(case, frozen, sample, by_key, raw_dir, cache=True, full_rerank=True):
    started = time.perf_counter()
    request = case['request']
    ident = case_id(request)
    raw_path = raw_dir / f'{ident}.json'
    output = {'id': ident, 'request': request, 'split': 'development', 'results': {},
              'assessment': {'preference': None, 'assessment': 'Pending independent main-agent review.', 'next_experiment': None}}
    raw = {'request': request, 'stages': {}}
    for variant in ('corrected', 'english_phrase'):
        output['results'][variant] = reconstruct_control(case, frozen, variant, by_key)
    save(raw_path, raw)
    try:
        planning = model_pipeline.plan_request(request, cache=cache)
        output['plan'] = planning['plan']
        output['planning_metrics'] = planning['metrics']
        raw['stages']['planning'] = planning
        save(raw_path, raw)
        plan_ms = planning['metrics']['wall_ms']
        plan_cost = planning['metrics'].get('cost_usd', 0)
        retrieved = {}
        for label, strategy in [('planned_facets', 'facets'), ('planned_balanced', 'balanced')]:
            retrieval = search_variants.retrieve_candidates(planning['plan'], sample, limit=60, strategy=strategy)
            retrieved[label] = retrieval
            raw['stages'][label] = retrieval
            top = retrieval['candidates'][:10]
            output['results'][label] = {'top10': top, 'first': top[0] if top else None,
                                       'wall_ms': plan_ms + retrieval['wall_ms'], 'cost_usd': plan_cost,
                                       'components_ms': {'plan': plan_ms, 'retrieval': retrieval['wall_ms']},
                                       'diagnostics': {**retrieval['diagnostics'], 'planning_metrics': planning['metrics'],
                                                       'timing_kind': 'measured_components_sum; shared plan charged once per hypothetical variant'}}
            save(raw_path, raw)
        candidates, union_diagnostics = candidate_union(retrieved['planned_facets']['candidates'],
                                                       retrieved['planned_balanced']['candidates'],
                                                       output['results']['corrected']['top10'])
        raw['rerank_candidates'] = candidates
        raw['union_diagnostics'] = union_diagnostics
        save(raw_path, raw)
        if not full_rerank:
            output['case_execution_wall_ms'] = (time.perf_counter() - started) * 1000
            raw['report_case'] = output
            save(raw_path, raw)
            return output
        if not candidates:
            output['results']['evidence_rerank'] = {'top10': [], 'error': 'Empty candidate union; model not called', 'wall_ms': plan_ms, 'cost_usd': plan_cost}
        else:
            reranked = model_pipeline.rerank(request, planning['plan'], candidates, top_k=10, cache=cache)
            raw['stages']['rerank'] = reranked
            candidate_by_key = {r['key']: r for r in candidates}
            top = [{**candidate_by_key[r['key']], **r, 'rating': r['score']} for r in reranked['results']]
            retrieval_ms = sum(r['wall_ms'] for r in retrieved.values())
            # Candidate injection uses stored prior results; a live request would
            # require an extra control retrieval. Show that reconstruction openly.
            baseline_ms = output['results']['corrected']['wall_ms']
            baseline_cost = output['results']['corrected']['cost_usd']
            output['results']['evidence_rerank'] = {
                'top10': top, 'first': top[0] if top else None,
                'wall_ms': plan_ms + retrieval_ms + reranked['metrics']['wall_ms'] + baseline_ms,
                'cost_usd': plan_cost + reranked['metrics'].get('cost_usd', 0) + baseline_cost,
                'components_ms': {'plan': plan_ms, 'retrieval_variants_sequential': retrieval_ms,
                                  'rerank': reranked['metrics']['wall_ms'], 'injected_frozen_control_end_to_end': baseline_ms},
                'diagnostics': {**union_diagnostics, 'planning_metrics': planning['metrics'], 'reranking_metrics': reranked['metrics'],
                                'timing_kind': 'measured_components_plus_frozen_control_end_to_end_estimate',
                                'candidate_outcomes': reranked.get('candidate_outcomes'),
                                'actual_new_model_spend_usd': plan_cost + reranked['metrics'].get('cost_usd', 0),
                                'reconstructed_baseline_model_cost_usd': baseline_cost,
                                'quality_status': 'unassessed; model scores are model opinions, not independent labels'}}
    except Exception as exc:
        error = f'{type(exc).__name__}: {exc}'
        raw['error'] = error
        for label in ('planned_facets', 'planned_balanced', 'evidence_rerank'):
            if label not in output['results']:
                output['results'][label] = {'top10': [], 'error': error, 'wall_ms': None, 'cost_usd': None}
        output['error'] = error
    output['case_execution_wall_ms'] = (time.perf_counter() - started) * 1000
    raw['report_case'] = output
    save(raw_path, raw)
    return output



def compact_pool(raw, control):
    facets = raw['stages']['planned_facets']['candidates']
    balanced = raw['stages']['planned_balanced']['candidates']
    mandatory = control[:4]
    ordered = facets[:14] + balanced[:6] + facets[14:] + balanced[6:]
    seen = {r['key'] for r in mandatory}
    novel = []
    for row in ordered:
        if row['key'] not in seen:
            novel.append(row)
            seen.add(row['key'])
    pool = novel[:24 - len(mandatory)] + mandatory
    return pool, {'policy': 'up to24; facets14+balanced6 priority, reserve corrected4, fill remaining by facets then balanced',
                  'mandatory_keys': [r['key'] for r in mandatory], 'candidate_keys': [r['key'] for r in pool]}


def run_compact_round(args):
    """Isolate reranker models on frozen round1 plans and identical fixed24 pools."""
    source_path = args.output.parent / 'loop-round1.json'
    source = json.loads(source_path.read_text())
    source_raw = source_path.parent / (source_path.stem + '-raw')
    cases = source['rounds'][0]['cases'][:args.limit]
    arms = [('compact_25', 'google/gemini-2.5-flash-lite'), ('compact_31', 'google/gemini-3.1-flash-lite')]
    output = {'schema_version': 1, 'status': 'running', 'rounds': [{
        'name': 'Round 2 — compact reranking on identical fixed24 pools',
        'variants': [{'id': k, 'label': f'Compact {m}', 'status': 'active', 'reason': 'Awaiting independent review.'} for k, m in arms],
        'cases': []}], 'overall': {'winner_id': None, 'summary': 'Pending independent comparison.',
        'limitations': ['Frozen round1 plans retained identically across arms; inherited planner defects remain.',
                        'Both arms use identical up-to24 candidate pools, including up to4 corrected baseline candidates.',
                        'End-to-end costs/times reconstruct frozen planner/retrieval/control components plus measured compact reranking.',
                        'Compact evidence is abridged explicitly; generated scores are not independent quality judgments.']}}
    raw_dir = args.output.parent / (args.output.stem + '-raw')
    def one(case):
        ident = case['id']
        raw = json.loads((source_raw / f'{ident}.json').read_text())
        pool, diagnostics = compact_pool(raw, case['results']['corrected']['top10'])
        output_case = {'id': ident, 'request': case['request'], 'split': 'development', 'plan': case['plan'],
                       'results': {}, 'assessment': {'preference': None, 'assessment': 'Pending independent review.', 'next_experiment': None}}
        record = {'request': case['request'], 'plan': case['plan'], 'candidates': pool, 'diagnostics': diagnostics, 'arms': {}}
        save(raw_dir / f'{ident}.json', record)
        planning = raw['stages']['planning']['metrics']
        plan_ms = planning.get('original_wall_ms', planning['wall_ms'])
        retrieval_ms = sum(raw['stages'][v]['wall_ms'] for v in ('planned_facets', 'planned_balanced'))
        baseline = case['results']['corrected']
        frozen_cost = planning.get('original_cost_usd', planning.get('cost_usd', 0)) + baseline['cost_usd']
        by_key = {r['key']: r for r in pool}
        for label, model in arms:
            # Optional operational switch: preserve completed results and stop
            # launching new paid calls without interrupting in-flight measurement.
            if (args.output.parent / 'STOP_COMPACT_RERANK').exists():
                output_case['results'][label] = {'top10': [], 'error': 'Stopped before model call by operational flag', 'wall_ms': None, 'cost_usd': None}
                continue
            try:
                result = model_pipeline.rerank_compact(case['request'], case['plan'], pool, cache=not args.no_cache, model=model)
                record['arms'][label] = result
                top = [{**by_key[r['key']], **r, 'rating': r['score']} for r in result['results']]
                metrics = result['metrics']
                output_case['results'][label] = {'top10': top, 'first': top[0] if top else None,
                    'wall_ms': plan_ms + retrieval_ms + baseline['wall_ms'] + metrics['wall_ms'],
                    'cost_usd': frozen_cost + metrics.get('cost_usd', 0),
                    'components_ms': {'frozen_plan': plan_ms, 'frozen_retrievals': retrieval_ms,
                                      'frozen_baseline_end_to_end': baseline['wall_ms'], 'compact_rerank': metrics['wall_ms']},
                    'diagnostics': {**diagnostics, 'reranking_metrics': metrics,
                                    'actual_new_model_spend_usd': metrics.get('cost_usd', 0),
                                    'frozen_upstream_cost_usd': frozen_cost,
                                    'candidate_outcomes': result.get('candidate_outcomes'),
                                    'considered_keys': result.get('considered_keys'),
                                    'timing_kind': 'frozen_upstream_reconstruction_plus_measured_compact_rerank'}}
            except Exception as exc:
                error = f'{type(exc).__name__}: {exc}'
                record['arms'][label] = {'error': error}
                output_case['results'][label] = {'top10': [], 'error': error, 'wall_ms': None, 'cost_usd': None}
            save(raw_dir / f'{ident}.json', record)
        record['report_case'] = output_case
        save(raw_dir / f'{ident}.json', record)
        return output_case
    results = {}
    def persist():
        output['rounds'][0]['cases'] = [results[c['id']] for c in cases if c['id'] in results]
        save(args.output, output)
    if args.resume and args.output.exists():
        previous = json.loads(args.output.read_text())
        results = {c['id']: c for c in previous['rounds'][0]['cases'] if all(not r.get('error') for r in c['results'].values())}
    persist()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = [executor.submit(one, c) for c in cases if c['id'] not in results]
        for future in as_completed(jobs):
            case = future.result()
            results[case['id']] = case
            persist()
            print(json.dumps({'completed': len(results), 'total': len(cases), 'request': case['request'],
                              'errors': {k: r['error'] for k, r in case['results'].items() if r.get('error')}}), flush=True)
    output['status'] = 'complete_pending_review'
    persist()


def run_challenges(args):
    """Fresh controls + shortlisted strategies, all restricted to the same sample."""
    requested = args.challenge_variants.split(',') if args.challenge_variants else []
    supported = {'planned_facets', 'planned_balanced', 'compact_25', 'compact_31'}
    if set(requested) - supported:
        raise ValueError('Unsupported challenge variant')
    sample_started = time.perf_counter()
    sample = experiment.read('sample.json')
    by_key = {f"{r['media_type']}:{r['tmdb_id']}": r for r in sample}
    load_ms = (time.perf_counter() - sample_started) * 1000
    index_ms = search_variants.warm_sample_index(sample)
    search_variants.configure(args.env)
    experiment.MIN_VOTES = experiment.read('load.json')['min_votes']
    cases = experiment.read('loop-challenge-interpretations.json')[:args.limit]
    raw_dir = args.output.parent / (args.output.stem + '-raw')
    labels = dict(VARIANTS)
    labels.update(compact_25='Compact Gemini2.5 Flash Lite', compact_31='Compact Gemini3.1 Flash Lite')
    output = {'schema_version': 1, 'status': 'running', 'rounds': [{
        'name': 'Frozen challenge validation', 'variants': [
            {'id': k, 'label': labels[k], 'status': 'active', 'reason': 'Pending independent challenge assessment.'}
            for k in ['corrected', 'english_phrase', *requested]], 'cases': []}],
        'overall': {'winner_id': None, 'summary': 'Pending independent challenge assessment.', 'limitations': [
            'Same 50000-title sample for every arm, with independently derived Jev versus semantic-plan eligibility.',
            'Controls combine fresh measured eligibility/retrieval with captured parallel-max Jev time; reconstructed end-to-end.',
            'New semantic plan is shared across shortlisted arms.',
            'Compact pools reserve4 corrected candidates; English phrase control candidates are not injected.',
            'One measured retrieval per control, not a latency distribution.']},
        'startup': {'sample_load_ms': load_ms, 'sample_index_build_ms': index_ms, 'sample_size': len(sample)},
        'execution': {'workers': args.workers, 'shortlist': requested, 'min_votes': experiment.MIN_VOTES}}
    def one(case):
        ident = case_id(case['request'])
        begin = time.perf_counter()
        allowed = experiment.prepare(case, sample)
        prepare_ms = (time.perf_counter() - begin) * 1000
        actual = {variant: experiment.retrieve(case, variant, allowed, by_key) for variant in ('corrected', 'english_phrase')}
        frozen = {'request': case['request'], 'allowed_counts': {k: len(v) for k, v in allowed.items()}, 'summary': {}}
        for variant, result in actual.items():
            frozen['summary'][variant] = {'median_wall_ms': result['wall_ms'] + prepare_ms,
                'top10': result['top10'], 'candidates': len(result['candidates']), 'gated': result['gated'], 'searched': result['searched']}
        save(raw_dir / f'{ident}-controls.json', {'prepare_wall_ms': prepare_ms, 'allowed_counts': frozen['allowed_counts'], 'controls': actual})
        if requested:
            report_case = run_case(case, frozen, sample, by_key, raw_dir, cache=not args.no_cache, full_rerank=False)
        else:
            report_case = {'id': ident, 'request': case['request'], 'results': {
                variant: reconstruct_control(case, frozen, variant, by_key) for variant in actual},
                'assessment': {'preference': None, 'assessment': 'Pending independent review.', 'next_experiment': None}}
        report_case['split'] = 'challenge'
        for variant in actual:
            result = report_case['results'][variant]
            result['components_ms'] = {'captured_jev_parallel_max': result['components_ms']['captured_jev_parallel_max'],
                                       'measured_eligibility': prepare_ms, 'measured_retrieval': actual[variant]['wall_ms']}
            result['diagnostics'].update(timing_kind='captured_jev_plus_fresh_measured_eligibility_and_retrieval',
                                          frozen_source=None, retrieval_samples=1, server_sum_ms=actual[variant]['server_sum_ms'])
        if 'plan' in report_case and any(k.startswith('compact_') for k in requested):
            raw_path = raw_dir / f'{ident}.json'
            raw = json.loads(raw_path.read_text())
            pool, diagnostics = compact_pool(raw, report_case['results']['corrected']['top10'])
            save(raw_dir / f'{ident}-compact-pool.json', {'candidates': pool, 'diagnostics': diagnostics})
            candidate_by_key = {r['key']: r for r in pool}
            for label, model in [('compact_25', 'google/gemini-2.5-flash-lite'), ('compact_31', 'google/gemini-3.1-flash-lite')]:
                if label not in requested:
                    continue
                try:
                    ranked = model_pipeline.rerank_compact(case['request'], report_case['plan'], pool, cache=not args.no_cache, model=model)
                    save(raw_dir / f'{ident}-{label}.json', ranked)
                    top = [{**candidate_by_key[r['key']], **r, 'rating': r['score']} for r in ranked['results']]
                    plan_metrics = raw['stages']['planning']['metrics']
                    retrieval_ms = sum(raw['stages'][k]['wall_ms'] for k in ('planned_facets', 'planned_balanced'))
                    baseline = report_case['results']['corrected']
                    report_case['results'][label] = {'top10': top, 'first': top[0] if top else None,
                        'wall_ms': plan_metrics['wall_ms'] + retrieval_ms + baseline['wall_ms'] + ranked['metrics']['wall_ms'],
                        'cost_usd': plan_metrics.get('cost_usd', 0) + baseline['cost_usd'] + ranked['metrics'].get('cost_usd', 0),
                        'components_ms': {'plan': plan_metrics['wall_ms'], 'retrievals': retrieval_ms,
                                          'reconstructed_baseline_end_to_end': baseline['wall_ms'], 'compact_rerank': ranked['metrics']['wall_ms']},
                        'diagnostics': {**diagnostics, 'planning_metrics': plan_metrics, 'reranking_metrics': ranked['metrics'],
                                        'candidate_outcomes': ranked.get('candidate_outcomes'), 'considered_keys': ranked.get('considered_keys'),
                                        'actual_new_model_spend_usd': plan_metrics.get('cost_usd', 0) + ranked['metrics'].get('cost_usd', 0)}}
                except Exception as exc:
                    report_case['results'][label] = {'top10': [], 'error': f'{type(exc).__name__}: {exc}', 'wall_ms': None, 'cost_usd': None}
        # Retain only the explicit shortlist in the report; raw component results
        # remain available for pool provenance and reproducibility.
        report_case['results'] = {k: v for k, v in report_case['results'].items() if k in ['corrected', 'english_phrase', *requested]}
        save(raw_dir / f'{ident}-report.json', report_case)
        return report_case
    results = {}
    if args.resume and args.output.exists():
        previous = json.loads(args.output.read_text())
        results = {c['id']: c for c in previous['rounds'][0]['cases'] if all(not r.get('error') for r in c['results'].values())}
    def persist():
        output['rounds'][0]['cases'] = [results[case_id(c['request'])] for c in cases if case_id(c['request']) in results]
        save(args.output, output)
    persist()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = [executor.submit(one, c) for c in cases if case_id(c['request']) not in results]
        for future in as_completed(jobs):
            case = future.result()
            results[case['id']] = case
            persist()
            print(json.dumps({'completed': len(results), 'total': len(cases), 'request': case['request']}), flush=True)
    output['status'] = 'complete_pending_review'
    persist()


def round3_pool(central, broad, english, corrected):
    # Reciprocal-rank fusion over complete available source lists. Reserve the
    # whole frozen English top10 so a rank10 concept match cannot be displaced
    # solely by two correlated new lexical rankers. No request/title rules.
    scores, by_key = {}, {}
    for source in (central, broad, english, corrected):
        for rank, row in enumerate(source, 1):
            by_key.setdefault(row['key'], row)
            scores[row['key']] = scores.get(row['key'], 0) + 1 / (20 + rank)
    mandatory = {r['key'] for r in english[:10]}
    selected = sorted(mandatory, key=lambda key: (-scores[key], key))
    selected += [key for key in sorted(scores, key=lambda key: (-scores[key], key)) if key not in mandatory][:24 - len(selected)]
    return [{**by_key[key], 'rrf_score': scores[key]} for key in selected]


def baseline_pool(corrected, english):
    seen, selected = set(), []
    for row in corrected[:12] + english[:12]:
        if row['key'] not in seen:
            selected.append(row)
            seen.add(row['key'])
    return selected



def fresh_controls(case, sample, by_key):
    started = time.perf_counter()
    allowed = experiment.prepare(case, sample)
    prepare_ms = (time.perf_counter() - started) * 1000
    with ThreadPoolExecutor(max_workers=2) as executor:
        jobs = {v: executor.submit(experiment.retrieve, case, v, allowed, by_key) for v in ('corrected', 'english_phrase')}
        actual = {v: future.result() for v, future in jobs.items()}
    summary = {'request': case['request'], 'allowed_counts': {k: len(v) for k, v in allowed.items()}, 'summary': {}}
    for variant, result in actual.items():
        summary['summary'][variant] = {'median_wall_ms': result['wall_ms'] + prepare_ms, 'top10': result['top10'],
            'candidates': len(result['candidates']), 'gated': result['gated'], 'searched': result['searched']}
    return {'summary': summary, 'actual': actual, 'prepare_ms': prepare_ms, 'wall_ms': (time.perf_counter() - started) * 1000}

def run_round3(args):
    startup = time.perf_counter()
    sample = experiment.read('sample.json')
    by_key = {f"{r['media_type']}:{r['tmdb_id']}": r for r in sample}
    load_ms = (time.perf_counter() - startup) * 1000
    search_variants.configure(args.env)
    index_ms = search_variants.warm_sample_index(sample)
    validation = args.challenge or args.interpretations is not None
    experiment.MIN_VOTES = experiment.read('load.json')['min_votes']
    cases = (json.loads(args.interpretations.read_text()) if args.interpretations else experiment.read('loop-challenge-interpretations.json' if validation else 'interpretations.json'))[:args.limit]
    frozen = {} if validation else {c['request']: c for c in experiment.read('comparison.json')}
    plans_path = None if validation else args.plans or experiment.PRIVATE / 'model_pipeline' / 'development13-plans-v7-validated.json'
    plans = {} if validation else {c['request']: c['revised'] for c in json.loads(plans_path.read_text())['cases']}
    variants = [('corrected', 'Frozen corrected control'), ('english_phrase', 'Frozen English phrase control'), ('centrality', 'Revised plan + precise central evidence'),
                ('planned_union_fast31', 'Revised plan + three-source pool + fast3.1'),
                ('baseline_union_fast31', 'Baseline-only pool + raw request + fast3.1')]
    variants = [(rerank_variant_id(k, args), f'{"Planned" if k.startswith("planned") else "Baseline"} union + {args.rerank_model} (packing v{args.packing_version}; {"IDs minimal reasoning" if args.minimal_reasoning else "IDs only" if args.ids_only else "with reasons"})') if k.endswith('_union_fast31') else (k, v) for k, v in variants if not (args.planned_only and k.startswith('baseline_union'))]
    output = {'schema_version': 1, 'status': 'running', 'rounds': [{
        'name': f'Frozen {args.split or "challenge"} — round3 shortlist' if validation else 'Round 3 — central evidence and fast reranking',
        'variants': [{'id': k, 'label': v, 'status': 'active', 'reason': 'Pending independent assessment.'} for k, v in variants], 'cases': []}],
        'overall': {'winner_id': None, 'summary': 'Pending independent assessment.', 'limitations': [
            'Reuses validated v7 plans and frozen development controls; no new planning calls.',
            'Cold end-to-end time is reconstructed as parallel critical path; actual current execution is separately measured.',
            'Baseline-only arm has at most20 candidates because frozen controls expose top10 each, not12.',
            'Fast model returns order and reasons, no numeric ratings or proof of all-candidate consideration.',
            'No-result baseline arm is unavailable rather than a failed full search.']},
        'startup': {'sample_load_ms': load_ms, 'sample_index_build_ms': index_ms},
        'execution': {'workers': args.workers, 'planner_source': str(plans_path), 'rerank_model': args.rerank_model, 'packing_version': args.packing_version}}
    if validation:
        output['overall']['limitations'] = ['Fresh live planner and scratch/control retrieval; prior captured Jev times reused and explicitly reconstructed.', 'Controls share50000-title sample but Jev and semantic eligibility differ.', 'Actual case wall time includes all evaluated arms sequentially; variant latency is component critical-path reconstruction.', 'Frozen round3 models, prompts, serializer and pool algorithm.']
    raw_dir = args.output.parent / (args.output.stem + '-raw')
    def one(case):
        begin = time.perf_counter()
        ident, request = case_id(case['request']), case['request']
        controls = None
        if validation:
            with ThreadPoolExecutor(max_workers=2) as concurrent:
                plan_job = concurrent.submit(model_pipeline.plan_request, request, cache=not args.no_cache, model='google/gemini-3.1-flash-lite')
                controls_job = concurrent.submit(fresh_controls, case, sample, by_key)
                planning, controls = plan_job.result(), controls_job.result()
            frozen_case = controls['summary']
        else:
            planning, frozen_case = plans[request], frozen[request]
        plan = planning['plan']
        planning_metrics = planning['metrics']
        plan_ms = planning_metrics.get('original_wall_ms', planning_metrics['wall_ms'])
        plan_cost = planning_metrics.get('original_cost_usd', planning_metrics.get('cost_usd', 0))
        corrected = reconstruct_control(case, frozen_case, 'corrected', by_key)
        english = reconstruct_control(case, frozen_case, 'english_phrase', by_key)
        if controls:
            for variant, report in [('corrected', corrected), ('english_phrase', english)]:
                report['diagnostics'].update(timing_kind='captured_jev_plus_fresh_measured_eligibility_and_retrieval', frozen_source=None, retrieval_samples=1)
                report['components_ms'] = {'captured_jev_parallel_max': report['components_ms']['captured_jev_parallel_max'], 'measured_eligibility': controls['prepare_ms'], 'measured_retrieval': controls['actual'][variant]['wall_ms']}
        jev_ms = corrected['components_ms']['captured_jev_parallel_max']
        baseline_branch_ms = jev_ms + max(corrected['retrieval_wall_ms'], english['retrieval_wall_ms'])
        retrieval_context = {}
        central = search_variants.retrieve_candidates(plan, sample, limit=60, strategy='centrality', retrieval_context=retrieval_context)
        broad = search_variants.retrieve_candidates(plan, sample, limit=60, strategy='recall', retrieval_context=retrieval_context)
        central_top = central['candidates'][:10]
        result_case = {'id': ident, 'request': request, 'split': (args.split or 'challenge') if validation else 'development', 'plan': plan,
            'results': {'corrected': corrected, 'english_phrase': english, 'centrality': {'top10': central_top, 'first': central_top[0] if central_top else None,
                        'wall_ms': plan_ms + central['wall_ms'], 'cost_usd': plan_cost,
                        'components_ms': {'captured_revised_plan': plan_ms, 'measured_centrality_retrieval': central['wall_ms']},
                        'diagnostics': {**central['diagnostics'], 'timing_kind': 'captured_plan_plus_current_retrieval', 'planning_metrics': planning_metrics}}},
            'assessment': {'preference': None, 'assessment': 'Pending independent review.', 'next_experiment': None}}
        raw = {'request': request, 'planning': planning, 'centrality': central, 'broad_facets': broad, 'packing_version': args.packing_version, 'rerank_model': args.rerank_model, 'fresh_controls': controls, 'reading': case.get('reading'), 'arms': {}}
        raw_path = raw_dir / f'{ident}.json'
        save(raw_path, raw)
        neutral = {'request': request, 'intent': request, 'media_type': None, 'format': None, 'facets': [], 'avoid': [], 'fingerprint_preferences': [],
                   'notes': ['Neutral API envelope only; use the unmodified raw request and supplied candidate evidence.']}
        pools = {'planned_union_fast31': round3_pool(central['candidates'], broad['candidates'], english['top10'], corrected['top10']),
                 'baseline_union_fast31': baseline_pool(corrected['top10'], english['top10'])}
        if args.planned_only:
            pools = {k: v for k, v in pools.items() if k.startswith('planned')}
        for label, pool in pools.items():
            pool, hygiene_excluded = hygienic_pool(pool)
            pool, constraint_excluded = constrain_planned_pool(pool, plan) if label.startswith('planned') else (pool, [])
            raw['arms'][label] = {'candidates': pool, 'hygiene_excluded': hygiene_excluded, 'constraint_excluded': constraint_excluded}
            save(raw_path, raw)
            if not pool:
                result_case['results'][label] = {'top10': [], 'wall_ms': None, 'cost_usd': 0,
                    'diagnostics': {'availability': 'unavailable_empty_baseline_pool' if label.startswith('baseline') else 'unavailable_empty_pool'}}
                continue
            if (args.output.parent / 'STOP_FAST_RERANK').exists():
                result_case['results'][label] = {'top10': [], 'error': 'Stopped before model call by operational flag', 'wall_ms': None, 'cost_usd': None}
                continue
            try:
                use_plan = plan if label == 'planned_union_fast31' else neutral
                ranked = selected_rerank(request, use_plan, pool, args, reading=case.get('reading'))
                raw['arms'][label]['rerank'] = ranked
                metrics = ranked['metrics']
                cold_rerank_ms, cold_rerank_cost = cold_model_metrics(metrics)
                by_candidate = {r['key']: r for r in pool}
                top = [{**by_candidate[r['key']], **r} for r in ranked['results']]
                upstream_ms = max(plan_ms + central['wall_ms'] + broad['wall_ms'], baseline_branch_ms) if label == 'planned_union_fast31' else baseline_branch_ms
                upstream_cost = corrected['cost_usd'] + (plan_cost if label == 'planned_union_fast31' else 0)
                result_case['results'][label] = {'top10': top, 'first': top[0] if top else None,
                    'wall_ms': upstream_ms + cold_rerank_ms, 'cost_usd': upstream_cost + cold_rerank_cost,
                    'components_ms': {'reconstructed_parallel_upstream_critical_path': upstream_ms,
                                      'captured_jev': jev_ms, 'captured_parallel_control_retrieval': max(corrected['retrieval_wall_ms'], english['retrieval_wall_ms']),
                                      'captured_plan_plus_measured_retrieval': plan_ms + central['wall_ms'] + broad['wall_ms'] if label == 'planned_union_fast31' else 0,
                                      'cold_fast_rerank': cold_rerank_ms, 'actual_current_rerank': metrics['wall_ms']},
                    'diagnostics': {'candidate_count': len(pool), 'hygiene_excluded': hygiene_excluded, 'constraint_excluded': constraint_excluded, 'candidate_keys': [r['key'] for r in pool],
                        'source_quotas': 'RRF(centrality60,broadfacets60,English10,corrected10), reserve all English10, cap24' if label == 'planned_union_fast31' else 'corrected12+English12 requested; only10each available; no fill',
                        'timing_kind': 'cold_critical_path_reconstruction_plus_measured_rerank', 'reranking_metrics': metrics,
                        'actual_new_model_spend_usd': metrics.get('cost_usd', 0), 'cold_rerank_cost_usd': cold_rerank_cost, 'actual_current_rerank_wall_ms': metrics['wall_ms'], 'frozen_upstream_cost_usd': upstream_cost,
                        'candidate_outcomes': ranked.get('candidate_outcomes'), 'scores_available': False}}
            except Exception as exc:
                error = f'{type(exc).__name__}: {exc}'
                raw['arms'][label]['error'] = error
                result_case['results'][label] = {'top10': [], 'error': error, 'wall_ms': None, 'cost_usd': None, 'diagnostics': {'failed_call_metrics': getattr(exc, 'metrics', {}), 'actual_new_model_spend_usd': getattr(exc, 'metrics', {}).get('cost_usd')}}
            save(raw_path, raw)
        result_case['results'] = {rerank_variant_id(k, args) if k.endswith('_union_fast31') else k: v for k, v in result_case['results'].items()}
        result_case['actual_case_execution_wall_ms'] = (time.perf_counter() - begin) * 1000
        raw['report_case'] = result_case
        save(raw_path, raw)
        return result_case
    results = {}
    if args.resume and args.output.exists():
        old = json.loads(args.output.read_text())
        results = {c['id']: c for c in old['rounds'][0]['cases'] if all(not r.get('error') for r in c['results'].values())}
    def persist():
        output['rounds'][0]['cases'] = [results[case_id(c['request'])] for c in cases if case_id(c['request']) in results]
        save(args.output, output)
    persist()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = [executor.submit(one, c) for c in cases if case_id(c['request']) not in results]
        for future in as_completed(jobs):
            case = future.result()
            results[case['id']] = case
            persist()
            print(json.dumps({'completed': len(results), 'total': len(cases), 'request': case['request'],
                              'errors': {k: r['error'] for k, r in case['results'].items() if r.get('error')}}), flush=True)
    output['status'] = 'complete_pending_review'
    persist()


def replay_frozen_pools(args):
    """Rerank identical recorded pools without retrieval or new planning calls."""
    source_arm = 'planned_union_fast31'
    variant = rerank_variant_id(source_arm, args)
    if variant == source_arm:
        variant += '_replay'
    items = []
    for source_path in args.replay_source:
        source = json.loads(source_path.read_text())
        raw_dir = source_path.parent / (source_path.stem + '-raw')
        for case in source['rounds'][0]['cases'][:args.limit]:
            raw = json.loads((raw_dir / f"{case['id']}.json").read_text())
            if source_arm not in raw.get('arms', {}):
                raise ValueError(f'Missing frozen planned pool for {case["request"]}')
            items.append((source_path, case, raw))
    readings = {}
    for name in ('interpretations.json', 'loop-challenge-interpretations.json'):
        for case in experiment.read(name):
            readings[case['request']] = case.get('reading')
    original_ids = []
    for _, case, _ in items:
        for key in case['results']:
            if key not in original_ids:
                original_ids.append(key)
    variants = [{'id': key, 'label': f'Frozen source: {key}', 'status': 'active', 'reason': 'Unchanged prior control/result retained.'} for key in original_ids]
    variants.append({'id': variant, 'label': f'Identical planned pool + {args.rerank_model} (packing v{args.packing_version}; {"IDs minimal reasoning" if args.minimal_reasoning else "IDs only" if args.ids_only else "with reasons"})', 'status': 'active', 'reason': 'Awaiting independent same-pool review.'})
    output = {'schema_version': 1, 'status': 'running', 'rounds': [{'name': 'Round 6 — minimal-reasoning identical planned-pool replay' if args.minimal_reasoning else 'Round 5 — IDs-only identical planned-pool replay' if args.ids_only else 'Round 4 — identical planned-pool replay', 'variants': variants, 'cases': []}],
              'overall': {'winner_id': None, 'summary': 'Pending independent assessment.', 'limitations': [
                  'Frozen candidate pools/plans reused as inputs; validated media/format constraints can remove candidates; no new retrieval/planning.',
                  'Cold total latency/cost reuses source upstream projection and selected model original inference metrics.',
                  'Actual new spend records only this replay call; historical source results are not new spend.',
                  'Retained candidate order unchanged; validated media/format constraints apply to all source candidates, with exclusions recorded.']},
              'execution': {'workers': args.workers, 'model': args.rerank_model, 'packing_version': args.packing_version,
                            'sources': [str(p) for p in args.replay_source], 'source_arm': source_arm, 'ids_only': args.ids_only, 'minimal_reasoning': args.minimal_reasoning}}
    destination_raw = args.output.parent / (args.output.stem + '-raw')
    def one(item):
        source_path, case, source_raw = item
        case = json.loads(json.dumps(case))
        original_pool = source_raw['arms'][source_arm]['candidates']
        pool, constraint_excluded = constrain_planned_pool(original_pool, case['plan'])
        source_result_id = source_arm if source_arm in case['results'] else next(k for k in case['results'] if k.startswith('planned_union'))
        source_result = case['results'][source_result_id]
        provenance = {'source_report': str(source_path), 'source_arm': source_result_id, 'constraint_excluded': constraint_excluded, 'original_pool_count': len(original_pool), 'candidate_keys': [r['key'] for r in pool],
                      'pool_sha256': hashlib.sha256(json.dumps(pool, sort_keys=True, ensure_ascii=False).encode()).hexdigest()}
        record = {'request': case['request'], 'plan': case['plan'], 'candidates': pool, 'provenance': provenance}
        raw_path = destination_raw / f"{case['id']}.json"
        save(raw_path, record)
        try:
            if not pool:
                case['results'][variant] = {'top10': [], 'wall_ms': None, 'cost_usd': 0, 'diagnostics': {'availability': 'unavailable_empty_frozen_pool'}}
            else:
                ranked = selected_rerank(case['request'], case['plan'], pool, args, source_raw.get('reading', readings.get(case['request'])))
                record['rerank'] = ranked
                metrics = ranked['metrics']
                cold_ms, cold_cost = cold_model_metrics(metrics)
                by_key = {r['key']: r for r in pool}
                top = [{**by_key[r['key']], **r} for r in ranked['results']]
                source_components = source_result.get('components_ms', {})
                if 'reconstructed_parallel_upstream_critical_path' in source_components:
                    upstream_ms = source_components['reconstructed_parallel_upstream_critical_path']
                    upstream_cost = source_result['diagnostics']['frozen_upstream_cost_usd']
                else:
                    # A failed original reranker still has a valid frozen pool
                    # and measured upstream components; do not lose a successful
                    # alternative response because the original total is unknown.
                    planning_ms, planning_cost = cold_model_metrics(source_raw['planning']['metrics'])
                    controls = case['results']
                    jev_ms = controls['corrected']['components_ms']['captured_jev_parallel_max']
                    base_ms = jev_ms + max(controls[k]['retrieval_wall_ms'] for k in ('corrected', 'english_phrase'))
                    planned_ms = planning_ms + source_raw['centrality']['wall_ms'] + source_raw['broad_facets']['wall_ms']
                    upstream_ms = max(planned_ms, base_ms)
                    upstream_cost = planning_cost + controls['corrected']['cost_usd']
                    source_components = {'reconstructed_parallel_upstream_critical_path': upstream_ms,
                                         'captured_jev': jev_ms, 'captured_plan_plus_measured_retrieval': planned_ms}
                case['results'][variant] = {'top10': top, 'first': top[0] if top else None,
                    'wall_ms': upstream_ms + cold_ms, 'cost_usd': upstream_cost + cold_cost,
                    'components_ms': {**source_components, 'cold_fast_rerank': cold_ms, 'actual_current_rerank': metrics['wall_ms']},
                    'diagnostics': {**provenance, 'candidate_count': len(pool), 'reranking_metrics': metrics,
                        'actual_new_model_spend_usd': metrics.get('cost_usd', 0), 'cold_rerank_cost_usd': cold_cost,
                        'frozen_upstream_cost_usd': upstream_cost, 'actual_current_rerank_wall_ms': metrics['wall_ms'],
                        'timing_kind': 'frozen_upstream_plus_original_selected_model_inference', 'candidate_outcomes': ranked.get('candidate_outcomes'),
                        'scores_available': metrics.get('scores_available', False)}}
        except Exception as exc:
            metrics = getattr(exc, 'metrics', {})
            error = f'{type(exc).__name__}: {exc}'
            record['error'] = error
            record['failed_call_metrics'] = metrics
            case['results'][variant] = {'top10': [], 'error': error, 'wall_ms': None, 'cost_usd': None,
                                       'diagnostics': {'failed_call_metrics': metrics, 'actual_new_model_spend_usd': metrics.get('cost_usd')}}
        case['assessment'] = {'preference': None, 'assessment': 'Pending independent same-pool comparison.', 'next_experiment': None}
        record['report_case'] = case
        save(raw_path, record)
        return case
    results = {}
    if args.resume and args.output.exists():
        old = json.loads(args.output.read_text())
        results = {c['id']: c for c in old['rounds'][0]['cases'] if variant in c['results'] and not c['results'][variant].get('error')}
    def persist():
        output['rounds'][0]['cases'] = [results[c['id']] for _, c, _ in items if c['id'] in results]
        save(args.output, output)
    persist()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = [executor.submit(one, item) for item in items if item[1]['id'] not in results]
        for future in as_completed(jobs):
            case = future.result()
            results[case['id']] = case
            persist()
            print(json.dumps({'completed': len(results), 'total': len(items), 'request': case['request'], 'error': case['results'][variant].get('error')}), flush=True)
    output['status'] = 'complete_pending_review'
    persist()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', required=True)
    parser.add_argument('--minimal-reasoning', action='store_true', help='Explicit IDs-v3 minimal-reasoning/4096 cap operational variant')
    parser.add_argument('--ids-only', action='store_true', help='Return ordered candidate IDs without generated reasons')
    parser.add_argument('--rerank-model', default='google/gemini-3.1-flash-lite')
    parser.add_argument('--packing-version', type=int, choices=(2, 3), default=2)
    parser.add_argument('--planned-only', action='store_true')
    parser.add_argument('--replay-source', type=Path, nargs='+', help='Frozen round3 report(s); replay planned pools only')
    parser.add_argument('--interpretations', type=Path, help='Explicit frozen interpretation input for round3 validation')
    parser.add_argument('--split', choices=('challenge', 'confirmation'))
    parser.add_argument('--plans', type=Path, help='Explicit frozen planner artifact for round3')
    parser.add_argument('--challenge', action='store_true')
    parser.add_argument('--challenge-variants', default='planned_facets,planned_balanced,compact_25,compact_31')
    parser.add_argument('--round', type=int, choices=(1, 2, 3), default=1)
    parser.add_argument('--output', type=Path, default=experiment.PRIVATE / 'loop-round1.json')
    parser.add_argument('--workers', type=int, choices=(1, 2), default=2)
    parser.add_argument('--limit', type=int, default=13)
    parser.add_argument('--no-cache', action='store_true')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    if args.minimal_reasoning and not args.ids_only:
        parser.error('--minimal-reasoning requires --ids-only')
    if not 1 <= args.limit <= 13:
        parser.error('--limit must be 1..13 development requests')
    if args.replay_source:
        if args.output == experiment.PRIVATE / 'loop-round1.json':
            args.output = experiment.PRIVATE / 'loop-round4-replay.json'
        return replay_frozen_pools(args)
    if args.challenge:
        if args.output == experiment.PRIVATE / 'loop-round1.json':
            args.output = experiment.PRIVATE / 'loop-challenge-round3.json' if args.round == 3 else experiment.PRIVATE / 'loop-challenge-results.json'
        return run_round3(args) if args.round == 3 else run_challenges(args)
    if args.round == 3:
        if args.output == experiment.PRIVATE / 'loop-round1.json':
            args.output = experiment.PRIVATE / 'loop-round3.json'
        return run_round3(args)
    if args.round == 2:
        if args.output == experiment.PRIVATE / 'loop-round1.json':
            args.output = experiment.PRIVATE / 'loop-round2.json'
        return run_compact_round(args)
    load_started = time.perf_counter()
    sample = experiment.read('sample.json')
    by_key = {f"{r['media_type']}:{r['tmdb_id']}": r for r in sample}
    load_ms = (time.perf_counter() - load_started) * 1000
    search_variants.configure(args.env)
    index_ms = search_variants.warm_sample_index(sample)
    cases = experiment.read('interpretations.json')[:args.limit]
    frozen = {r['request']: r for r in experiment.read('comparison.json')}
    if any(c['request'] not in frozen for c in cases):
        raise ValueError('Missing frozen development control')
    output = {'schema_version': 1, 'status': 'running', 'rounds': [{
        'name': 'Round 1 — semantic plans and evidence reranking',
        'variants': [{'id': ident, 'label': label, 'status': 'active', 'reason': 'Awaiting independent comparison.'} for ident, label in VARIANTS],
        'cases': []}], 'overall': {'winner_id': None, 'summary': 'Pending independent assessment.',
        'limitations': ['13 development requests only; challenge set not used.', 'Controls use frozen earlier Jev filters and results; candidate eligibility differs.',
                        'Control end-to-end time reconstructed from parallel-max captured Jev time plus measured prior median retrieval.',
                        'Reranker union injects frozen corrected top10; corresponding full captured Jev+retrieval time and cost added as a reconstruction.',
                        'Shared plan cost appears per variant for independent cost comparison; do not sum variant costs as actual spend.',
                        'Model scores and explanations are not independent relevance judgments.']},
        'startup': {'sample_load_ms': load_ms, 'sample_index_build_ms': index_ms, 'sample_size': len(sample)},
        'execution': {'workers': args.workers, 'model': model_pipeline.DEFAULT_MODEL, 'cache_enabled': not args.no_cache}}
    previous = {}
    if args.resume and args.output.exists():
        existing = json.loads(args.output.read_text())
        previous = {c['id']: c for c in existing['rounds'][0]['cases'] if not c.get('error')}
    results = dict(previous)
    raw_dir = args.output.parent / (args.output.stem + '-raw')
    def persist():
        output['rounds'][0]['cases'] = [results[case_id(c['request'])] for c in cases if case_id(c['request']) in results]
        save(args.output, output)
    persist()
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = {executor.submit(run_case, c, frozen[c['request']], sample, by_key, raw_dir, not args.no_cache): c
                for c in cases if case_id(c['request']) not in results}
        for future in as_completed(jobs):
            case = future.result()
            results[case['id']] = case
            persist()
            print(json.dumps({'completed': len(results), 'total': len(cases), 'request': case['request'],
                              'error': case.get('error'), 'case_execution_wall_ms': case['case_execution_wall_ms']}), flush=True)
    output['status'] = 'complete_with_errors' if any(c.get('error') for c in results.values()) else 'complete_pending_review'
    persist()


if __name__ == '__main__':
    main()
