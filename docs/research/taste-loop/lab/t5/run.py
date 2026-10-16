"""Staged T5 preparation runner; live readers remain blocked pending registration.

Run from lab with `python -m t5.run --synthetic --output /tmp/t5-demo all`.
The only temporary-artifact exception is made-up input and fake subprocess readers.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

from . import broker
from .cases import digest, freeze, split, control_payload, controls_for
from .score import power, score, markdown, VOID_STATUSES, VOID_CAP
from .storage import private_root, read, write
from .synthetic import pack

HERE = Path(__file__).resolve().parent
LAB = HERE.parent


def source_manifest(sides='6082cadc'):
    sides_adapter(sides)  # Validate selection before constructing its closure.
    old_adapter = {'adapter.ts', 'parity_check.ts', 'prod-manifest.json', 'tsconfig.json', 'sides.py'}
    files = []
    for p in sorted(HERE.rglob('*')):
        relative = p.relative_to(HERE)
        if not p.is_file() or p.suffix not in ('.py', '.ts', '.tsx', '.json', '.txt'):
            continue
        if relative.parts[0] == 'statements':
            continue
        if sides == '6082cadc' and relative.parts[0] == 'live':
            continue
        if sides == 'live' and (relative.parts[0] in ('prod', 'stubs') or str(relative) in old_adapter):
            continue
        files.append(p)
    files += [LAB / 'stats.py', LAB / 'pack.py']
    return {str(p.relative_to(LAB)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def source_digest(sides='6082cadc'):
    return digest(source_manifest(sides))


def sides_adapter(sides):
    if sides == 'live':
        from .live import sides as adapter
        return adapter
    if sides != '6082cadc':
        raise ValueError('unknown Sides version')
    from . import sides as adapter
    return adapter


def load_pack(sides='6082cadc'):
    """Read only the loop's named immutable A pack. No newest loader, pull, or gate."""
    from pack import Pack, NAT, sha256
    manifest = read(LAB.parent / 'MANIFEST.json')
    from .storage import DATA
    folder = DATA / 'packs' / Path(manifest['pack_folder']).name
    for name, expected in manifest['files_sha256'].items():
        if sha256(folder / name) != expected:
            raise ValueError('pack file hash mismatch')
    p = Pack(str(folder))
    t = p.titles
    # Validate the exact attribute order used by the pinned production adapter.
    import re
    text = (sides_adapter(sides).HERE / 'prod/server/utils/fingerprint.ts').read_text().split('VALID_FINGERPRINT_KEYS:')[1].split('] as const')[0]
    keys = re.findall(r'"([a-z_]+)"', text)
    if keys != t['fingerprint_keys']:
        raise ValueError('fingerprint key order differs from pinned production')
    titles = []
    for i, key in enumerate(t['key']):
        info = p.info(i)
        date = info['release_date']
        titles.append({'key': int(key), 'title': info.get('title') or info.get('name'),
                       'year': None if date is None else __import__('datetime').datetime.fromtimestamp(date / 1000, __import__('datetime').timezone.utc).year,
                       'release_day': None if date is None else date // 86400000,
                       'media_type': info['media_type'], 'hasPoster': bool(t['has_poster'][i]),
                       'public_score': info.get('goodwatch_overall_score_normalized_percent'),
                       'votes': info.get('goodwatch_overall_score_voting_count'), 'genres': info.get('genres') or [],
                       'origin': (info.get('origin_country_codes') or [info.get('original_language_code')])[0],
                       'movie_series_id': info.get('movie_series_id'), 'aliases': [],
                       'in_pool': bool(t['in_pool'][i]),
                       'fingerprint': t['fingerprint'][i].tolist() if t['has_fingerprint'][i] else None})
        if sides == 'live':
            # Live group names choose "animation" from the Animation genre or the anime flag (snapshot FLAG_ANIME).
            titles[-1]['anime'] = bool(info.get('is_anime'))
    population = []
    for m, token in enumerate(p.members['hash']):
        if p.members['tier'][m] != 0 or p.members['is_owner'][m]:
            continue
        rows = []
        for i in (p.ratings['member'] == m).nonzero()[0]:
            rows.append({k: (bool(p.ratings[k][i]) if k in ('in_bulk', 'edited') else
                             None if k == 'updated_at' and p.ratings[k][i] == NAT else int(p.ratings[k][i]))
                         for k in ('title_key', 'score', 'created_at', 'updated_at', 'position', 'in_bulk', 'edited')})
        population.append({'token': str(token), 'tier': 'A', 'owner': False, 'ratings': rows})
    return {'titles': titles, 'population': population}


def build(root, synthetic, sides='6082cadc'):
    adapter = sides_adapter(sides)
    pin = adapter.check_source()
    source = pack() if synthetic else load_pack(sides)
    descriptions = {}
    for member in source['population']:
        if member.get('tier', 'A') == 'A' and not member.get('owner', False) and len(member['ratings']) >= 40:
            history = split(member['ratings'])['early']
            descriptions[member['token']] = adapter.describe(history, source['titles'])
    frozen = freeze(source['population'], source['titles'], descriptions, sides=sides)
    frozen.update(power=power(frozen['coverage']['primary_members']), source_digest=source_digest(sides), synthetic=synthetic,
                  input_digest=digest(source), descriptions_digest=digest(descriptions),
                  prompt_digest=hashlib.sha256(broker.PROMPT.encode()).hexdigest())
    if sides == 'live':
        frozen.update(sides=sides, sides_commit=pin['commit'])
    write(root / 'source-manifest.json', source_manifest(sides))
    write(root / 'input.json', source)
    write(root / 'descriptions.json', descriptions)
    write(root / 'frozen.json', frozen)
    ledger(root, 'build', {k:v for k,v in frozen.items() if k not in ('cases',)})
    return frozen


def ledger(root, stage, aggregate):
    # Local preparation ledger only. Existing lab ledger and its committed prefix are untouched.
    path = root / 'ledger.jsonl'
    line = json.dumps({'stage': stage, 'aggregate': aggregate}, sort_keys=True, separators=(',', ':')) + '\n'
    import os
    fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'a') as f:
        f.write(line)


def checked(root, synthetic):
    frozen = read(root / 'frozen.json')
    if frozen['source_digest'] != digest(read(root / 'source-manifest.json')):
        raise ValueError('changed source manifest')
    if frozen['synthetic'] != synthetic or frozen['source_digest'] != source_digest(frozen.get('sides', '6082cadc')):
        raise ValueError('changed source or synthetic flag')
    if frozen['cases_digest'] != digest(frozen['cases']):
        raise ValueError('changed frozen cases')
    if frozen['input_digest'] != digest(read(root / 'input.json')) or frozen['descriptions_digest'] != digest(read(root / 'descriptions.json')):
        raise ValueError('changed frozen input or descriptions')
    return frozen


PREREG = Path(__file__).resolve().parents[2] / 'items' / '015-t5-whose-taste' / 'PREREG.md'
PREREG_LIVE = Path(__file__).resolve().parents[2] / 'items' / '016-t5-live-sides' / 'PREREG.md'


def registered(frozen):
    """Live readers run only against the frozen cases named in a committed, unmodified PREREG.md."""
    import subprocess
    prereg = PREREG_LIVE if frozen.get('sides') == 'live' else PREREG
    text = prereg.read_text() if prereg.exists() else ''
    for name in ('source_digest', 'cases_digest'):
        if f'`{name}`: `{frozen[name]}`' not in text:
            raise ValueError(f'PREREG.md does not register this {name}')
    folder = str(prereg.parent)
    tracked = subprocess.run(['git', '-C', folder, 'ls-files', '--error-unmatch', prereg.name], capture_output=True)
    dirty = subprocess.run(['git', '-C', folder, 'status', '--porcelain', '--', prereg.name, str(Path(__file__).parent)],
                           capture_output=True, text=True)
    if tracked.returncode or dirty.stdout.strip():
        raise ValueError('PREREG.md and lab/t5 must be committed and unchanged before live reader calls')


def read_suite(root, reader, synthetic):
    frozen = checked(root, synthetic)
    if not synthetic:
        registered(frozen)
    if not frozen['ready']:
        raise ValueError('heuristic baseline exceeds 40% after rematch; reader suite stopped')
    started = time.monotonic()
    totals = {'calls': 0, 'skipped': 0, 'attempts': 0, 'transport': 0, 'malformed': 0, 'tool_use': 0, 'cost': 0.0,
              'usage': {}, 'requested_model': broker.MODELS[reader], 'reasoning': 'low',
              'temperature': 'unavailable', 'seed': 'unavailable', 'synthetic': synthetic,
              'source_digest': frozen['source_digest'], 'cases_digest': frozen['cases_digest']}
    jobs = [(c, control, root / f'{reader}-{control}-{c["id"]}')
            for c in frozen['cases'] for control in controls_for(frozen['cases'])]
    existing, voided = {}, set()
    # Validate every completed record before making any further call. Even a
    # terminal transport/tool-use record is immutable and must never be retried.
    for c, control, folder in jobs:
        if (folder / 'record.json').exists():
            record = stored_record(folder, control_payload(c, control), reader, synthetic)
            existing[(control, c['id'])] = record
            if record['result']['status'] in VOID_STATUSES:
                voided.add(c['id'])
    totals['resumed'] = bool(existing)
    ledger(root, 'read-' + reader + '-start', {**totals, 'existing_records': len(existing)})
    totals['status'] = 'interrupted'
    try:
        for c, control, folder in jobs:
            if len(voided) > VOID_CAP * len(frozen['cases']):
                totals['status'] = 'incomplete'
                raise ValueError('more than 10% voided cases; reader suite incomplete')
            record = existing.get((control, c['id']))
            if record is not None:
                totals['skipped'] += 1
            else:
                remaining = 1800 - (time.monotonic() - started)
                if remaining <= 0:
                    totals['status'] = 'timeout'
                    raise TimeoutError('30 minute reader job cap; resume the same frozen suite')
                fake = [sys.executable, str(HERE / 'synthetic.py'), reader] if synthetic else None
                record = broker.invoke(control_payload(c, control), reader, folder, fake_command=fake, timeout=remaining / 2)
                if record['fake'] != synthetic:
                    raise ValueError('reader kind does not match the run: fake answers in a real run or the reverse')
                totals['calls'] += 1
                totals['attempts'] += len(record['attempts'])
                totals['cost'] += record['result']['cost'] or 0
                for key, value in (record['result']['usage'] or {}).items():
                    if isinstance(value, (int, float)):
                        totals['usage'][key] = totals['usage'].get(key, 0) + value
            for status in ('transport', 'malformed', 'tool_use'):
                totals[status] += record['result']['status'] == status
            if record['result']['status'] in VOID_STATUSES:
                voided.add(c['id'])
        if len(voided) > VOID_CAP * len(frozen['cases']):
            totals['status'] = 'incomplete'
            raise ValueError('more than 10% voided cases; reader suite incomplete')
        totals['status'] = 'complete'
    finally:
        totals['voided_cases'] = len(voided)
        totals['seconds'] = time.monotonic() - started
        ledger(root, 'read-' + reader, totals)
    return totals


def stored_record(folder, payload, reader, synthetic=None):
    record = broker.replay(folder)
    if synthetic is not None and record.get('fake') != synthetic:
        raise ValueError('a fake record in a real run, or a real record in a synthetic run')
    prompt = broker.PROMPT + '\n\n' + json.dumps(payload, ensure_ascii=False, sort_keys=True)
    if record['prompt_sha256'] != hashlib.sha256(prompt.encode()).hexdigest() or record['reader'] != reader:
        raise ValueError('changed prompt or reader')
    return record


def collect(root, frozen):
    records = {}
    for reader in ('haiku', 'astra'):
        for control in controls_for(frozen['cases']):
            for c in frozen['cases']:
                record = stored_record(root / f'{reader}-{control}-{c["id"]}', control_payload(c, control), reader,
                                       frozen['synthetic'])
                records[(reader, control, c['id'])] = record
    return records


def rule_for(frozen):
    """Item 015 registered both readers; the owner set Astra's share for the live Sides (#674)."""
    return 'astra_share' if frozen.get('sides') == 'live' else 'both_readers'


def score_suite(root, synthetic):
    frozen = checked(root, synthetic)
    aggregate = score(frozen['cases'], collect(root, frozen), rule=rule_for(frozen))
    aggregate.update(coverage=frozen['coverage'], baselines=frozen['baselines'], power=frozen['power'],
                     ready=frozen['ready'], source_digest=frozen['source_digest'], cases_digest=frozen['cases_digest'])
    aggregate['pass'] &= frozen['ready']
    write(root / 'aggregate.json', aggregate)
    label = 'SYNTHETIC ONLY — fake readers; no research result.\n\n' if synthetic else ''
    write(root / 'RESULTS.md', (label + markdown(aggregate)).encode())
    ledger(root, 'score', aggregate)
    return aggregate


def verify(root, synthetic):
    """Fresh-process entry: reconstruct descriptions/cases and reparse immutable raw bytes."""
    frozen = checked(root, synthetic)
    source = read(root / 'input.json')
    version = frozen.get('sides', '6082cadc')
    descriptions = {m['token']: sides_adapter(version).describe(split(m['ratings'])['early'], source['titles']) for m in source['population']
                    if m['token'] in read(root / 'descriptions.json')}
    if digest(descriptions) != frozen['descriptions_digest']:
        raise ValueError('description rebuild differs')
    rebuilt = freeze(source['population'], source['titles'], descriptions, sides=version)
    if rebuilt['cases_digest'] != frozen['cases_digest'] or rebuilt['baselines'] != frozen['baselines']:
        raise ValueError('case rebuild differs')
    aggregate = score(frozen['cases'], collect(root, frozen), rule=rule_for(frozen))
    stored = read(root / 'aggregate.json')
    for key, value in aggregate.items():
        expected = value and frozen['ready'] if key == 'pass' else value
        if stored[key] != expected:
            raise ValueError('scoring replay differs')
    label = 'SYNTHETIC ONLY — fake readers; no research result.\n\n' if synthetic else ''
    if (root / 'RESULTS.md').read_text() != label + markdown(stored):
        raise ValueError('aggregate report differs')
    ledger(root, 'verify', {'match': True, 'cases_digest': frozen['cases_digest']})
    return {'match': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--synthetic', action='store_true')
    parser.add_argument('--sides', choices=['6082cadc', 'live'], default='6082cadc')
    parser.add_argument('--output', required=True)
    parser.add_argument('stage', choices=['build', 'read', 'score', 'verify', 'all'])
    parser.add_argument('--reader', choices=['haiku', 'astra'])
    args = parser.parse_args()
    if args.stage != 'build' and Path(args.output).expanduser().joinpath('frozen.json').exists():
        version = read(Path(args.output).expanduser() / 'frozen.json').get('sides', '6082cadc')
        if version != args.sides:
            parser.error('--sides differs from the frozen run')
    root = private_root(args.output, args.synthetic)
    if args.stage == 'all':
        if not args.synthetic:
            parser.error('all is synthetic-only; reader jobs must run separately')
        build(root, True, args.sides)
        read_suite(root, 'haiku', True)
        read_suite(root, 'astra', True)
        score_suite(root, True)
        cmd = [sys.executable, '-m', 't5.run', '--synthetic', '--sides', args.sides, '--output', str(root), 'verify']
        done = subprocess.run(cmd, cwd=LAB, capture_output=True, text=True, check=True)
        print(done.stdout.strip())
    elif args.stage == 'read':
        if not args.reader:
            parser.error('--reader is required')
        print(json.dumps(read_suite(root, args.reader, args.synthetic)))
    else:
        fn = {'build': build, 'score': score_suite, 'verify': verify}[args.stage]
        result = fn(root, args.synthetic, args.sides) if args.stage == 'build' else fn(root, args.synthetic)
        print(json.dumps({'ready': result['ready'], 'coverage': result['coverage'], 'baselines': result['baselines'],
                          'initial_baselines': result['initial_baselines'], 'power': result['power']} if args.stage == 'build' else result))


if __name__ == '__main__':
    main()
