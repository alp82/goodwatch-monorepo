"""Export public execution evidence; keep it separate from blind review packets."""
import collections
import hashlib
import platform
from importlib.metadata import version
import json
import math
import statistics
from pathlib import Path
from decimal import Decimal
from datetime import datetime

import prepare

PRIVATE_KEYS={'key_fingerprint','workspace_id','user_id','external_user','creator_user_id','session_id','preset_id','http_referer','origin'}


def sanitize(value):
    if isinstance(value,dict):
        result={k:sanitize(v) for k,v in value.items() if k not in PRIVATE_KEYS}
        if 'raw' in result:
            try: result['raw']=json.dumps(sanitize(json.loads(result['raw'])),ensure_ascii=False)
            except (ValueError,TypeError): pass
        return result
    if isinstance(value,list):return [sanitize(v) for v in value]
    return value


def score_vector(run, attempt):
    p=run/attempt['artifact']/'parsed.json'
    if not p.exists():return None
    try:
        parsed=json.loads(p.read_text())
        if len(parsed['results'])!=1 or parsed['results'][0]['benchmark_id']!=attempt['benchmark_id']:return None
        scores=parsed['results'][0]['analysis']['fingerprint']['scores']
        if set(scores)!=set(prepare.KEYS) or any(type(v) is not int or not 0<=v<=10 for v in scores.values()):return None
        return [scores[k] for k in prepare.KEYS]
    except (KeyError,TypeError):return None


def main():
    run=prepare.OUT/'run-first';out=prepare.OUT/'evidence-first';out.mkdir(exist_ok=True)
    ledger=json.loads((run/'ledger.json').read_text())
    candidates=json.loads((prepare.OUT/'candidates.json').read_text())
    rows=[]
    original_hashes={}
    for i,candidate in enumerate(candidates):
        attempts=[a for a in ledger['attempts'] if a['candidate_index']==i]
        pairs=collections.defaultdict(list)
        for a in attempts:pairs[a['benchmark_id']].append(a)
        cost=sum(Decimal(a.get('actual_cost_usd','0')) for a in attempts)
        held=sum(Decimal(a['reserved']['usd']) for a in attempts if a['status']!='reconciled')
        valid=sum(any(a.get('outcome')=='valid' for a in group) for group in pairs.values())
        latencies=sorted(a['elapsed_seconds'] for a in attempts if 'elapsed_seconds' in a)
        usable_times=[sum(a.get('elapsed_seconds',0) for a in group) for group in pairs.values() if any(a.get('outcome')=='valid' for a in group)]
        pair_wall=[]
        for bid,group in pairs.items():
            if any(a.get('outcome')=='valid' for a in group):
                final_response=json.loads((run/group[-1]['artifact']/'response.json').read_text())
                seconds=(datetime.fromisoformat(final_response['captured_at'])-datetime.fromisoformat(group[0]['started_at'])).total_seconds()
                pair_wall.append({'benchmark_id':bid,'seconds':seconds,'attempts':len(group)})
        row={**candidate,'expected_titles':10,'attempted_titles':len(pairs),'attempts':len(attempts),
            'first_attempt_74_score_valid':sum(score_vector(run,group[0]) is not None for group in pairs.values()),
            'first_attempt_valid':sum(group[0].get('outcome')=='valid' for group in pairs.values()),
            'after_retry_valid':valid,'abstaining_titles':sum(any(a.get('outcome')=='abstention' for a in group) for group in pairs.values()),
            'reconciled_cost_usd':str(cost),'unresolved_reservation_usd':str(held),
            'cost_per_attempted_title_usd':str(cost/len(pairs)) if pairs and not held else None,
            'cost_per_structurally_valid_title_usd':str(cost/valid) if valid and not held else None,
            'cost_per_human_accepted_title_usd':None,'quality_verdict':'pending independent review',
            'latency_sample_count':len(latencies),'median_request_seconds':statistics.median(latencies) if latencies else None,
            'p95_request_seconds':latencies[math.ceil(.95*len(latencies))-1] if latencies else None,
            'median_total_attempt_seconds_per_valid_title':statistics.median(usable_times) if usable_times else None,
            'complete_pair_wall_times':pair_wall,
            'median_complete_pair_wall_seconds':statistics.median(p['seconds'] for p in pair_wall) if pair_wall else None,
            'stop_reason':ledger['stopped_candidates'].get(str(i))}
        row['transport_failures']=[]
        for a in attempts:
            f=run/a['artifact']/'response.json'
            if a.get('outcome')=='transport_error' and f.exists():
                response=json.loads(f.read_text());body=json.loads(response['raw'])
                row['transport_failures'].append({'attempt':a['artifact'],'http_status':response['http_status'],'error':body.get('error')})
        rows.append(row)
    normalized=[]
    for attempt in ledger['attempts']:
        vector=score_vector(run,attempt)
        if vector is not None:
            normalized.append({'candidate_index':attempt['candidate_index'],'benchmark_id':attempt['benchmark_id'],
                'attempt':attempt['attempt'],'artifact':attempt['artifact'],'full_response_outcome':attempt.get('outcome'),
                'scores_in_schema_order':vector})
    prepare.dump(out/'normalized-scores.json',{'score_keys':prepare.KEYS,'results':normalized})
    prepare.dump(out/'summary.json',rows)
    prepare.dump(out/'ledger.json',sanitize(ledger))
    for attempt in ledger['attempts']:
        d=out/attempt['artifact'];d.mkdir(exist_ok=True)
        for source in (run/attempt['artifact']).glob('*.json'):
            prepare.dump(d/source.name,sanitize(json.loads(source.read_text())))
            original_hashes[str(source.relative_to(run))]=hashlib.sha256(source.read_bytes()).hexdigest()
    total=sum(Decimal(r['reconciled_cost_usd']) for r in rows)
    held=sum(Decimal(r['unresolved_reservation_usd']) for r in rows)
    lines=['# First-pass execution evidence','',
        '**Quality review is pending. Structural validity does not establish factual or trait accuracy.**','',
        f'Reconciled inference charges: **${total}**. Additional unresolved reservations: **${held}**. No judge API or embedding calls have run. The account has a $9 non-resetting cap; the complete experiment ceiling is $10.', '',
        '| Configuration | Titles attempted / 10 | First full-response valid | Full valid after retry | Attempts | Reconciled USD | Held USD |',
        '|---|---:|---:|---:|---:|---:|---:|']
    for r in rows:
        lines.append(f"| {r['model']} @ {r['provider']} | {r['attempted_titles']}/10 | {r['first_attempt_valid']} | {r['after_retry_valid']} | {r['attempts']} | {r['reconciled_cost_usd']} | {r['unresolved_reservation_usd']} |")
    lines+=['','## Interpretation and limitations','',
        '- The primary 74-score structural check is reported separately from full-response validity. The JSON-only repairs corrected two omitted required-null animation_style fields and one invalid highlight key; original score vectors remain available, annotated with full-response outcome.',
        '- This is a ten-title pilot. Full-response and 74-score human/Astra/Fable quality reviews remain pending; no winners or finalists are selected.',
        '- Transport errors are distinct from unknown titles or bad fingerprints. Remaining titles for stopped configurations were not attempted. All costs include failed paid attempts where charges are available.',
        '- A rejected request without generation metadata retains its full reservation even when the observed account delta is zero. Held values are conservative allowances, not measured charges. Later unexplained account usage stops the run.',
        '- Generation metadata and key-usage counters were observed to lag responses. Read-only polling reconciles them; it never resubmits an inference request.',
        '- Public model IDs map to dated canonical slugs in generation metadata. The captured public model catalog verifies these exact mappings; neither candidate IDs nor providers were substituted.',
        '- Requested reasoning and returned reasoning counts are preserved. Zero reported reasoning tokens alone does not prove the provider disabled internal computation. Provider-side retries/streaming metadata may differ from the single non-streaming client request and are preserved.',
        '- Latency statistics in summary.json include observed request attempts, with sample counts; summed HTTP attempt time excludes accounting polls and backoff. Complete-pair wall time additionally includes all intervening waits from the first attempt start through the final response, including any manual recovery pause. Ten titles gives a small sample.',
        '- Repeats and separately billed finalist embeddings depend on independent first-pass review and human selection. Cost per human-accepted title is therefore unmeasured.',
        '- Public copies redact account/user/workspace identifiers from response metadata. Raw response content and generation details are otherwise preserved; private original captures remain in the execution worktree.',
        '', 'Reviewers should use only `../blind-first/` before recording their initial judgments. The mapping and this financial report must remain outside their review context.','']
    (out/'README.md').write_text('\n'.join(lines))
    source_dir=Path(__file__).parent
    prepare.dump(out/'execution-manifest.json',{'python_version':platform.python_version(),
        'jsonschema_version':version('jsonschema'),'phase':'first-pass; independent review pending',
        'private_original_sha256':original_hashes,
        'driver_sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in source_dir.glob('*.py')},
        'prepared_manifest':ledger['prepared_manifest'],
        'note':'Early accounting pauses and read-only reconciliation are recorded per attempt; request contract did not change.'})
    print(f'Exported evidence: {sum(r["attempted_titles"] for r in rows)} title/configuration pairs, ${total} reconciled, ${held} held.')


if __name__=='__main__':main()
