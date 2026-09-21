"""Combine measured rounds and separate assessments into a compact local report.

Example (from repository root):
  python goodwatch-webapp/scripts/prototype-crate-evidence/consolidate_loop.py \
    goodwatch-webapp/scripts/prototype-crate-evidence/private/loop-round{1,2}.json \
    --output-dir docs/prototypes/crate-evidence \
    --review 1 docs/prototypes/crate-evidence/round1-main-review.json \
    --review 1 docs/prototypes/crate-evidence/round1-independent-review.json \
    --variant-status evidence_rerank discarded 'Failed 8/13 development requests.' \
    --variant-status compact_25 discarded 'Failed 5/13 development requests.' \
    --variant-status compact_31 active 'Development results promising; no winner.'

Review round numbers are one-based in the concatenated input order. Input files
remain unchanged. Later inputs supply the overall summary; no winner is inferred.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from loop_report import render

OMITTED = {
    'strong_evidence', 'text_evidence', 'strong_evidence_standard',
    'text_evidence_standard', 'fingerprint_scores', 'trope_names',
    'essence_tags', 'keywords', 'text', 'first', 'attempt_path',
}


def compact(value):
    if isinstance(value, dict):
        if 'evidence_abridgements' in value:
            value = dict(value)
            entries = value.pop('evidence_abridgements')
            value['evidence_abridgement_summary'] = {'candidates_with_abridgements': len(entries), 'sample': entries[:1], 'note': 'Repeated per-candidate packing metadata omitted; full provenance remains in private run input.'}
        return {key: compact(item) for key, item in value.items() if key not in OMITTED}
    if isinstance(value, list):
        return [compact(item) for item in value]
    return value



def original_comparison_round(path, rounds, cost_document=None):
    """Restore the original ordered request/variant cohort without rerunning it."""
    original = json.loads(Path(path).read_text(encoding='utf-8'))
    if len(original) != 13:
        raise ValueError('Expected the original 13-request comparison')
    labels = {
        'original': 'Original D4+ predicate', 'corrected': 'D4+ with corrected predicate',
        'standard': 'Combined evidence · standard', 'english': 'Combined evidence · English stemming',
        'english_boost2': 'English stemming · strong evidence ×2',
        'english_phrase': 'English stemming · restored phrase bonus',
    }
    expensive_id = 'planned_union_google_gemini_3_flash_preview_packing3_ids_v3_minimal'
    final_cases = {case['request']: case for round_ in rounds for case in round_.get('cases', []) if expensive_id in case.get('results', {})}
    costs_by_request = {case['request']: case for case in (cost_document or {}).get('cases', [])}
    primary = {'name': 'Original 13 requests · primary comparison', 'kind': 'primary',
        'default_variants': {'left': 'corrected', 'right': 'english'},
        'variants': [{'id': key, 'label': label, 'status': 'active', 'reason': 'Original retrieval experiment: same frozen request interpretation, no extra model call for this retrieval variant.'} for key, label in labels.items()], 'cases': []}
    primary['variants'].append({'id': expensive_id, 'label': 'Higher-cost experiment · Flash + extra planning', 'status': 'active', 'reason': 'Supplemental quality exploration only. Additional model cost and latency have not been accepted; this is not the chosen production approach.'})
    for index, item in enumerate(original):
        later = final_cases.get(item['request'])
        case = {'id': later['id'] if later else f'original-{index+1}', 'request': item['request'], 'split': 'original request', 'results': {},
            'interpretation': {key: item.get(key) for key in ['flags', 'weights', 'phrases', 'allowed_counts']}}
        for key, old in item['summary'].items():
            titles = copy.deepcopy(old['top10'])
            for title in titles:
                if title.get('text_evidence'):
                    title['essence_text'] = title['text_evidence']
                if title.get('strong_evidence'):
                    title['matched_source_tags'] = title['strong_evidence']
            case['results'][key] = {'top10': titles, 'wall_ms': old.get('median_wall_ms'), 'cost_usd': None,
                'extra_model_cost_usd': 0, 'baseline_model_cost_usd': None,
                'diagnostics': {'timing_kind': 'original_measured_retrieval_median', 'repeats': 5,
                    'median_server_sum_ms': old.get('median_server_sum_ms'), 'candidate_count': old.get('candidates'),
                    'query_count': old.get('query_count'), 'gated': old.get('gated'), 'searched': old.get('searched'),
                    'timing_exclusions': 'Jev interpretation, precomputed eligibility filters and production vector fill excluded.',
                    'cost_scope': 'No extra model calls for retrieval; original request-interpretation cost is shared and shown separately when available.',
                    'source': str(path)}}
        if later:
            case['results'][expensive_id] = copy.deepcopy(later['results'][expensive_id])
            case['results'][expensive_id]['diagnostics']['comparison_role'] = 'Higher-cost experiment; cost tradeoff not accepted'
        costs = costs_by_request.get(item['request'])
        if costs:
            for key, run in case['results'].items():
                run['baseline_model_cost_usd'] = costs.get('original_jev_cost_usd')
                if key == expensive_id:
                    run['extra_model_cost_usd'] = costs.get('incremental_model_cost_usd')
                    run['cost_usd'] = costs.get('final_projected_model_cost_usd')
                    run['model_cost_ratio'] = costs.get('cost_ratio')
                else:
                    baseline = costs.get('baseline_variants', {}).get(key, {})
                    run['cost_usd'] = baseline.get('model_cost_usd', costs.get('original_jev_cost_usd'))
                    run['reconstructed_total_ms'] = baseline.get('reconstructed_total_ms')
        assessment = item.get('assistant_review')
        if assessment:
            case['assessment'] = assessment
            case['assessments'] = [{'source': 'Original assistant assessment · original retrieval variants', **assessment}]
        primary['cases'].append(case)
    return primary

def consolidate(inputs, output_dir, reviews=(), statuses=(), controls=('corrected', 'english_phrase'), summary=None, winner=None, original_comparison=None, cost_review=None):
    documents = [json.loads(Path(path).read_text(encoding='utf-8')) for path in inputs]
    rounds = [copy.deepcopy(r) for document in documents for r in document['rounds']]
    for round_number, path in reviews:
        index = int(round_number) - 1
        if not 0 <= index < len(rounds):
            raise ValueError(f'Review round {round_number} does not exist')
        review_document = json.loads(Path(path).read_text(encoding='utf-8'))
        assessments = {item['id']: item for item in review_document['cases']}
        for case in rounds[index].get('cases', []):
            if case['id'] in assessments:
                existing = case.setdefault('assessments', [])
                if not existing and case.get('assessment', {}).get('assessment') and not case['assessment']['assessment'].startswith('Pending'):
                    existing.append({'source': 'Embedded run assessment', **case['assessment']})
                existing.append({'source': Path(path).name, 'reviewed_input': review_document.get('source'), **assessments[case['id']]})
                case['assessment'] = assessments[case['id']]
    for variant_id, status, reason in statuses:
        if status not in {'active', 'discarded', 'winner'}:
            raise ValueError(f'Invalid variant status: {status}')
        matched = False
        for round_ in rounds:
            for variant in round_.get('variants', []):
                if variant['id'] == variant_id:
                    variant.update(status=status, reason=reason)
                    matched = True
        if not matched:
            raise ValueError(f'Variant {variant_id} does not exist')
    # Reuse controls only for exactly the same case id AND unchanged request.
    frozen = {}
    for round_ in rounds:
        variants = {v['id']: v for v in round_.get('variants', [])}
        for case in round_.get('cases', []):
            results = case.setdefault('results', {})
            for control in controls:
                identity = (case['id'], case['request'], control)
                if control in results and control in variants:
                    frozen[identity] = (copy.deepcopy(results[control]), copy.deepcopy(variants[control]), round_['name'])
                elif identity in frozen:
                    result, metadata, source_round = frozen[identity]
                    results[control] = copy.deepcopy(result)
                    results[control].setdefault('diagnostics', {})['comparison_reused_from_round'] = source_round
                    if control not in variants:
                        variants[control] = copy.deepcopy(metadata)
                        round_.setdefault('variants', []).append(variants[control])
    limitations = list(dict.fromkeys(f"{document['rounds'][0].get('name', 'Input round')}: {item}" for document in documents for item in document.get('overall', {}).get('limitations', [])))
    limitations.extend([
        'Assistant assessments are subjective and separate from user judgments.',
        'Unchanged frozen controls may be reused for the same case id and request; provenance is recorded in diagnostics.',
        'Compact artifact retains synopsis, essence and selected match evidence; duplicated full source text, trope lists and complete fingerprint vectors are omitted.',
    ])
    overall = copy.deepcopy(documents[-1].get('overall', {}))
    overall['limitations'] = list(dict.fromkeys(limitations))
    if winner is not None:
        overall['winner_id'] = winner
    if summary is not None:
        overall['summary'] = summary
    if original_comparison is not None:
        for round_ in rounds:
            round_['kind'] = 'supplemental'
            for variant in round_.get('variants', []):
                if variant.get('status') == 'winner':
                    variant.update(status='active', reason='Historical quality-only candidate; additional cost/latency not accepted.')
        cost_document = json.loads(Path(cost_review).read_text(encoding='utf-8')) if cost_review else None
        rounds.append(original_comparison_round(original_comparison, rounds, cost_document))
        overall['winner_id'] = None
        overall['title'] = 'Original requests, original cost scope'
        overall['original_comparison_source'] = str(original_comparison)
        if cost_review:
            overall['cost_review'] = json.loads(Path(cost_review).read_text(encoding='utf-8'))
    # Preserve measurements, source metadata and execution provenance per input.
    result = compact({
        'schema_version': 1, 'rounds': rounds, 'overall': overall,
        'sources': [{'input': str(path), 'metadata': {k: v for k, v in document.items() if k not in {'rounds', 'overall'}}} for path, document in zip(inputs, documents)],
    })
    # Deduplicate immutable source prose and repeated retrieval annotations across
    # rounds while preserving every score, reason and request-specific result.
    title_sources = {}
    evidence_sets = {}
    source_fields = {'title', 'year', 'release_year', 'tmdb_id', 'media_type', 'poster_path', 'synopsis', 'essence_text', 'votes'}
    evidence_fields = {'facet_evidence', 'fingerprint_evidence', 'centrality_evidence', 'avoid_evidence', 'hygiene_evidence', 'format_evidence', 'matched_source_tags'}
    for round_ in result['rounds']:
        for case in round_.get('cases', []):
            for run in case.get('results', {}).values():
                for title in run.get('top10', []):
                    for fields, table, ref_field in [(source_fields, title_sources, 'source_ref'), (evidence_fields, evidence_sets, 'evidence_ref')]:
                        record = {key: title.pop(key) for key in list(title) if key in fields}
                        if record:
                            ref = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
                            table.setdefault(ref, record)
                            title[ref_field] = ref
    result['title_sources'] = title_sources
    result['evidence_sets'] = evidence_sets
    result['compact_format'] = 'Top10 records reference title_sources[source_ref] and evidence_sets[evidence_ref]; merge those objects with the top10 record to reconstruct its full display data.'
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / 'loop-results.json'
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    render(output, output_dir / 'loop-review.html')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('inputs', nargs='+', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--review', nargs=2, action='append', default=[], metavar=('ROUND', 'JSON'))
    parser.add_argument('--variant-status', nargs=3, action='append', default=[], metavar=('ID', 'STATUS', 'REASON'))
    parser.add_argument('--controls', nargs='*', default=['corrected', 'english_phrase'])
    parser.add_argument('--summary')
    parser.add_argument('--winner')
    parser.add_argument('--original-comparison', type=Path)
    parser.add_argument('--cost-review', type=Path)
    args = parser.parse_args()
    print(consolidate(args.inputs, args.output_dir, args.review, args.variant_status, args.controls, args.summary, args.winner, args.original_comparison, args.cost_review))
