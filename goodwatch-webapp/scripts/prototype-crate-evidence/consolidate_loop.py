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


def consolidate(inputs, output_dir, reviews=(), statuses=(), controls=('corrected', 'english_phrase'), summary=None, winner=None):
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
    evidence_fields = {'facet_evidence', 'fingerprint_evidence', 'centrality_evidence', 'avoid_evidence', 'hygiene_evidence', 'format_evidence'}
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
    args = parser.parse_args()
    print(consolidate(args.inputs, args.output_dir, args.review, args.variant_status, args.controls, args.summary, args.winner))
