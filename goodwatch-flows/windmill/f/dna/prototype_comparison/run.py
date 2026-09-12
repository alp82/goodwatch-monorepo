"""Throwaway, resumable FIRST-PASS driver. No production writes or judge calls.

Default is read-only preflight. --execute requires a dedicated capped key.
An unresolved paid attempt stops the run, including after process interruption.
"""
import argparse
import copy
import fcntl
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import prepare

API = 'https://openrouter.ai/api/v1/'
D = Decimal
TOL = D('0.000001')


def now():
    return datetime.now(timezone.utc).isoformat()


def read_key(path, variable):
    if path is None:
        value = os.environ.get(variable, '')
    else:
        values = {}
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.removeprefix('export ').strip()] = value.strip().strip('"').strip("'")
        value = values.get(variable, '')
    if not value or any(c in value for c in '\r\n'):
        raise ValueError('Missing or invalid API key; never pass its value on the command line')
    return value


def http(path, key=None, payload=None):
    headers = {'Content-Type':'application/json'}
    if key:
        headers['Authorization'] = 'Bearer ' + key
    req = urllib.request.Request(API + path, headers=headers,
        data=json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None)
    start = time.monotonic()
    try:
        response = urllib.request.urlopen(req, timeout=180 if payload is not None else 30)
    except urllib.error.HTTPError as e:
        response = e
    with response:
        raw = response.read().decode('utf-8')
        # Preserve raw response text, stripping a secret if a service ever echoes it.
        if key:
            raw = raw.replace(key, '[REDACTED]')
        allowed = ('date', 'x-request-id', 'x-openrouter-request-id', 'retry-after')
        result = {'http_status':response.status, 'raw':raw, 'elapsed_seconds':time.monotonic()-start,
                  'headers':{k:v for k,v in response.headers.items() if k.lower() in allowed}, 'captured_at':now()}
        return result


def get_data(path, key=None):
    response = http(path, key)
    if response['http_status'] != 200:
        raise RuntimeError(f'GET {path.split("?")[0]} returned HTTP {response["http_status"]}')
    return json.loads(response['raw'])['data']


def key_metadata(key):
    data = get_data('key', key)
    fields = ['limit','limit_remaining','limit_reset','usage','byok_usage','include_byok_in_limit',
              'is_management_key','is_provisioning_key','expires_at']
    return {k:data.get(k) for k in fields}


def number(value):
    value = D(str(value))
    if not value.is_finite() or value < 0:
        raise ValueError('Missing, negative, or non-finite monetary value')
    return value


def check_key(meta):
    errors = []
    if meta.get('limit_reset') is not None:
        errors.append('Key limit resets; dedicated non-resetting cap required')
    try:
        limit, remaining = number(meta['limit']), number(meta['limit_remaining'])
        if not 0 < limit <= 9 or remaining > limit:
            errors.append('Key cap must be greater than zero and at most $9')
    except (KeyError, ValueError, ArithmeticError):
        errors.append('Missing or invalid key allowance')
    if meta.get('byok_usage') is None or number(meta['byok_usage']) != 0:
        errors.append('BYOK charge accounting requires a separate execution adapter')
    return errors


def save(path, value):
    # Durable write before launching a paid attempt; replacement is atomic.
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w') as f:
        json.dump(value, f, indent=2, ensure_ascii=False)
        f.write('\n'); f.flush(); os.fsync(f.fileno())
    tmp.replace(path)
    fd = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def build_requests():
    # Load frozen outputs without rewriting them during execution.
    for base, manifest in [(prepare.BENCH,'manifest.json'), (prepare.OUT,'prepared-manifest.json')]:
        for filename, expected in json.loads((base/manifest).read_text())['sha256'].items():
            if hashlib.sha256((base/filename).read_bytes()).hexdigest() != expected:
                raise ValueError('Frozen input changed: ' + filename)
    candidates = json.loads((prepare.OUT/'candidates.json').read_text())
    titles = {f"{t['media_type']}:{t['tmdb_id']}":t for t in json.loads((prepare.BENCH/'titles.json').read_text())['titles']}
    example = json.loads((prepare.OUT/'request-example.json').read_text())['payload']
    contract = json.loads((prepare.OUT/'schema.json').read_text())
    result = []
    for pair in json.loads((prepare.OUT/'request-order.json').read_text()):
        c = candidates[pair['candidate_index']]
        title = titles[pair['benchmark_id']]
        p = copy.deepcopy(example)
        p['model'] = c['model']
        p['provider'] = {'only':[c['provider']], 'allow_fallbacks':False, 'require_parameters':True}
        p['reasoning'] = prepare.reasoning(c['model'])
        p['messages'][1]['content'] = json.dumps({'benchmark_id':pair['benchmark_id'], **{k:title[k] for k in ['original_title','release_year','media_type','overview']}}, ensure_ascii=False)
        p['response_format'] = {'type':'json_object'} if c['output_mode'].startswith('JSON') else {'type':'json_schema','json_schema':{'name':'fingerprint_response','strict':True,'schema':contract}}
        result.append({**pair,'payload':p})
    if len(result) != 130:
        raise ValueError('Expected exactly 130 first-pass pairs')
    return candidates, result


def selected_route(candidate):
    path = 'models/' + candidate['model'] + '/endpoints'
    data = get_data(path)
    matches = [e for e in data['endpoints'] if e['tag'] == candidate['provider']]
    if len(matches) != 1:
        raise ValueError('Selected route missing or ambiguous: ' + candidate['model'])
    route = matches[0]
    required = {'max_tokens','reasoning','response_format'}
    if not candidate['output_mode'].startswith('JSON'):
        required.add('structured_outputs')
    if not required.issubset(route['supported_parameters']) or route['max_completion_tokens'] < 8192:
        raise ValueError('Selected route lacks required parameters/cap: ' + candidate['model'])
    return {'url':API+path,'captured_at':now(),'route':route}


def reservation(payload, route):
    # Very conservative UTF-8 byte-based allowance: double the complete wire
    # payload, including schema twice where applicable, plus transport overhead.
    # This is an estimate, backed by the server-side dedicated allowance.
    input_bound = 2*len(json.dumps(payload, ensure_ascii=False).encode()) + 4096
    if input_bound + 8192 > route['context_length']:
        raise ValueError('Conservative input allowance exceeds selected context window')
    price = route['pricing']
    rates = [price] + price.get('overrides', [])  # Include even inapplicable higher tiers.
    def highest(name):
        return max(number(r.get(name, price.get(name, 0))) for r in rates)
    if 'prompt' not in price or 'completion' not in price:
        raise ValueError('Missing route prices')
    # Restore undiscounted rates for temporary discounts as a further cushion.
    discount = number(price.get('discount', 0))
    if discount >= 1:
        raise ValueError('Unbounded promotional discount')
    amount = (D(input_bound)*(highest('prompt')+highest('input_cache_write')) +
              D(8192)*max(highest('completion'),highest('internal_reasoning')) + highest('request')) / (1-discount)
    return {'usd':str(amount),'input_token_allowance':input_bound,'completion_token_cap':8192,
            'method':'2x UTF-8 wire bytes + 4096 input; worst listed rates, cache writes, undiscounted pricing'}


def parse_output(body, bid):
    if body.get('error'):
        return 'api_error', [str(body['error'])], None
    choices = body.get('choices', [])
    if len(choices) != 1:
        return 'structural_failure', ['Expected one choice'], None
    choice = choices[0]
    if choice.get('finish_reason') == 'length':
        return 'truncation', ['Completion truncated'], None
    message = choice.get('message', {})
    if message.get('refusal'):
        return 'abstention', ['Model refused'], None
    try:
        def unique_object(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError('Duplicate JSON key: '+key)
                result[key] = value
            return result
        value = json.loads(message.get('content') or '', object_pairs_hook=unique_object,
                           parse_constant=lambda v: (_ for _ in ()).throw(ValueError(v)))
    except (ValueError, TypeError):
        return 'malformed_json', ['Cannot parse strict JSON; no cleanup applied'], None
    if isinstance(value, dict) and value.get('unknown') is True:
        return 'abstention', ['Unknown title'], value
    errors = prepare.validate(value, bid)
    return ('structural_failure' if errors else 'valid'), errors, value


def measured_charge(body, generation, before, after, reserved):
    cost = number(body['usage']['cost'])
    total = number(generation['total_cost'])
    delta = number(after['usage'])-number(before['usage'])
    if generation.get('is_byok') is not False or number(after['byok_usage']) != 0:
        raise ValueError('Unreconciled external BYOK charge')
    if abs(cost-total) > TOL or abs(cost-delta) > TOL:
        raise ValueError('Usage, generation and key-usage delta disagree')
    if max(cost,total,delta) > number(reserved['usd']) + TOL:
        raise ValueError('Actual charge exceeds reservation')
    usage = body['usage']
    if number(usage['prompt_tokens']) > reserved['input_token_allowance']:
        raise ValueError('Actual input tokens exceed conservative allowance')
    if number(usage['completion_tokens']) > 8192 or number(generation['native_tokens_completion']) > 8192:
        raise ValueError('Observed completion cap exceeded')
    return str(max(cost,total,delta))


def execute(args, key, meta, candidates, pairs, routes):
    errors = check_key(meta)
    if errors:
        raise ValueError('; '.join(errors))
    if not args.dedicated_key:
        raise ValueError('Execution requires --dedicated-key, asserting this key is exclusive to this experiment')
    run = args.run_dir
    run.mkdir(parents=True, exist_ok=True)
    with (run/'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        path = run/'ledger.json'
        fingerprint = hashlib.sha256(key.encode()).hexdigest()
        if path.exists():
            ledger = json.loads(path.read_text())
            if ledger['prepared_manifest'] != json.loads((prepare.OUT/'prepared-manifest.json').read_text()):
                raise ValueError('Prepared contract changed since this run began')
            if ledger['key_fingerprint'] != fingerprint:
                raise ValueError('Key changed; reconcile the existing experiment before switching')
            if any(a['status'] != 'reconciled' for a in ledger['attempts']):
                raise ValueError('Unresolved prior attempt: reconcile it before any further inference')
        else:
            ledger = {'started_at':now(),'key_fingerprint':fingerprint,'initial_usage':meta['usage'],
                      'target_usd':5,'inference_ceiling_usd':9,'attempts':[], 'stopped_candidates':{},
                      'prepared_manifest':json.loads((prepare.OUT/'prepared-manifest.json').read_text())}
            save(path, ledger)
        spent = sum(number(a['actual_cost_usd']) for a in ledger['attempts'])
        if abs(number(meta['usage'])-number(ledger['initial_usage'])-spent) > TOL:
            raise ValueError('Key usage changed outside reconciled attempts')
        made = 0
        for pair_index, pair in enumerate(pairs):
            ci = pair['candidate_index']
            if str(ci) in ledger['stopped_candidates']:
                continue
            prior = [a for a in ledger['attempts'] if a['pair_index'] == pair_index]
            if prior and (prior[-1]['outcome'] in ('valid','abstention') or len(prior) >= 2):
                continue
            while len(prior) < 2:
                if made >= args.max_attempts:
                    print('Reached invocation attempt limit; resume using the same run directory')
                    return
                payload = copy.deepcopy(pair['payload'])
                if prior and prior[-1]['outcome'] in ('structural_failure','malformed_json','truncation'):
                    previous = json.loads((run/prior[-1]['artifact']/'response.json').read_text())
                    raw_body = json.loads(previous['raw'])
                    raw_content = raw_body.get('choices',[{}])[0].get('message',{}).get('content')
                    if isinstance(raw_content, str):
                        payload['messages'].extend([{'role':'assistant','content':raw_content},
                            {'role':'user','content':'Correct only these machine-detected structural errors using the same title and definitions: '+json.dumps(prior[-1]['validation_errors'])}])
                route_snapshot = selected_route(candidates[ci])
                reserve = reservation(payload, route_snapshot['route'])
                before = key_metadata(key)
                if check_key(before):
                    raise ValueError('Key allowance changed')
                if abs(number(before['usage'])-number(ledger['initial_usage'])-spent) > TOL:
                    raise ValueError('Unexplained key usage before attempt')
                amount = number(reserve['usd'])
                if spent + amount > 9 or amount > number(before['limit_remaining']):
                    print('Stopped before request: reservation exceeds remaining allowance')
                    return
                # Stop optional retries at the normal target; ceiling can fund
                # approved first attempts, but cannot introduce additional arms.
                if prior and spent + amount >= 5:
                    break
                name = f'{len(ledger["attempts"]):04d}'
                artifact = run/name; artifact.mkdir()
                save(artifact/'request.json',payload)
                save(artifact/'route.json',route_snapshot)
                save(artifact/'key-before.json',before)
                record = {'pair_index':pair_index,'candidate_index':ci,'benchmark_id':pair['benchmark_id'],
                    'attempt':len(prior)+1,'artifact':name,'status':'reserved','reserved':reserve,'started_at':now()}
                ledger['attempts'].append(record); save(path,ledger)
                # No SDK retries and no retry after a timeout/unknown charge.
                try:
                    response = http('chat/completions', key, payload)
                    save(artifact/'response.json',response)
                    body = json.loads(response['raw'])
                    record['http_status'] = response['http_status']
                    record['elapsed_seconds'] = response['elapsed_seconds']
                    outcome, errors, parsed = parse_output(body,pair['benchmark_id'])
                    record.update(outcome=outcome, validation_errors=errors)
                    if parsed is not None:
                        save(artifact/'parsed.json',parsed)
                    if not body.get('id') or not body.get('usage'):
                        raise ValueError('No generation ID/usage: reservation retained pending reconciliation')
                    generation = get_data('generation?id='+urllib.parse.quote(body['id'],safe=''),key)
                    save(artifact/'generation.json',generation)
                    after = key_metadata(key); save(artifact/'key-after.json',after)
                    charge = measured_charge(body,generation,before,after,reserve)
                    if body.get('model') != payload['model'] or generation.get('model') != payload['model']:
                        raise ValueError('Returned model differs from pinned model; inspect version metadata')
                    if generation.get('provider_name') != route_snapshot['route']['provider_name']:
                        raise ValueError('Returned provider differs from pinned provider')
                    record.update(actual_cost_usd=charge, generation_id=body['id'], status='reconciled')
                    spent += number(charge)
                    if response['http_status'] in (400,401,402,403,404):
                        ledger['stopped_candidates'][str(ci)] = 'configuration/access error'
                    save(path,ledger)
                except Exception as error:
                    record['stop_reason'] = type(error).__name__+': '+str(error).replace(key,'[REDACTED]')
                    save(path,ledger)
                    raise RuntimeError('Attempt stopped; reservation retained. Inspect local ledger and reconcile before resuming.') from None
                made += 1; prior.append(record)
                print(f'Attempt {name}: {outcome}; reconciled total ${spent}',flush=True)
                if outcome in ('valid','abstention') or str(ci) in ledger['stopped_candidates']:
                    break
        print('First pass stopped/completed. Human review is required before any finalist repeats.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file',type=Path)
    parser.add_argument('--key-variable',default='OPENROUTER_API_KEY')
    parser.add_argument('--run-dir',type=Path,default=prepare.OUT/'run-first')
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--dedicated-key',action='store_true')
    parser.add_argument('--max-attempts',type=int,default=1)
    args = parser.parse_args()
    if not 1 <= args.max_attempts <= 260:
        parser.error('--max-attempts must be 1..260')
    key = read_key(args.env_file,args.key_variable)
    meta = key_metadata(key)
    candidates, pairs = build_requests()
    routes = [selected_route(c) for c in candidates]
    print(json.dumps({'key':meta,'execution_blockers':check_key(meta),'pairs':len(pairs),
        'initial_reservations_usd':str(sum(number(reservation(p['payload'],routes[p['candidate_index']]['route'])['usd']) for p in pairs)),
        'note':'Conservative reservations are not expected or measured costs.'},indent=2))
    if args.execute:
        execute(args,key,meta,candidates,pairs,routes)


if __name__ == '__main__':
    main()
