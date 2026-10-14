"""Item 009's two mix distances, from hash-checked T2a cached outputs only."""
import hashlib
import json
import os
from pathlib import Path
import sys

for name in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS',
             'NUMEXPR_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'BLIS_NUM_THREADS'):
    os.environ[name] = '2'
sys.dont_write_bytecode = True

import numpy as np

ITEM = Path(__file__).resolve().parent
LOOP = ITEM.parent.parent
WORK = Path.home() / 'goodwatch-research/taste/work'
RUN = '20261014T113107-e864bd47-b08d'
# This retained snapshot has exactly the requested run's harness hash.
HARNESS = WORK / 'runs/20261014T104820-3321997e-abdc/harness'
OUT = 'DISTANCE.md'
if len(sys.argv) > 1 and sys.argv[1] == 'registered':
    # Item 009's registered run 20261014T150814-e864bd47-58d5 keeps no predictor outputs, so the distance is read
    # from an exploratory run of the same comparison under the same harness, whose views and paired figures equal it.
    RUN, HARNESS, OUT = '20261014T152137-e864bd47-c7f9', LOOP / 'lab', 'DISTANCE-registered.md'
sys.path.insert(0, str(HARNESS))
import common
from pack import Pack
import score
import stats
import views


def main():
    available = next(int(s.split()[1]) for s in Path('/proc/meminfo').read_text().splitlines()
                     if s.startswith('MemAvailable:'))
    if available < 1536 * 1024:
        raise SystemExit('Under 1.5 GiB available; wait before running again.')
    with (LOOP / 'ledger.jsonl').open() as f:
        run = next(d for s in f if (d := json.loads(s)).get('run_id') == RUN)
    assert (run['task'], run['tier'], run['status']) == ('T2a', 'A', 'ok')
    if OUT != 'DISTANCE.md':
        with (LOOP / 'ledger.jsonl').open() as f:
            reg = next(d for s in f if (d := json.loads(s)).get('run_id') == '20261014T150814-e864bd47-58d5')
        assert reg['mode'] == 'registered' and reg['measures'] == run['measures']
        assert reg['views'] == run['views'] and reg['harness_sha256'] == run['harness_sha256']
    assert run['options'] == {'members': 'all', 'others': 'all',
                              'plant': None, 'shuffle_seed': None}
    assert (run['draws'], run['seed']) == (10000, 20261013)
    assert common.harness_sha256() == run['harness_sha256']
    manifest = json.loads((LOOP / 'MANIFEST.json').read_text())
    folder = Path(manifest['pack_folder']).expanduser()
    for filename, field in (('pack.pkl', 'pack_sha256'), ('titles.pkl', 'titles_sha256')):
        assert common.sha256_file(folder / filename) == run[field]
    pack = Pack(str(folder))  # Tier A ratings only; no gate file is opened.
    index, keys, digest = views.build_t2a(pack, str(WORK), others_mode='all', write=False)
    assert digest == run['views']['digest']
    assert len(index) == run['views']['main'] == 434
    titles_digest = common.sha256_arrays(views.title_arrays(pack))
    assert titles_digest == run['views']['titles_digest']
    answers_digest = common.sha256_arrays(
        {f'{v["vid"]}.{c}': a for v in index for c, a in keys[v['vid']].items()})
    cache_key = hashlib.sha256(
        f'{digest}|{titles_digest}|{run["harness_sha256"]}|{answers_digest}'.encode()
    ).hexdigest()[:32]
    b2 = next(r for r in run['refs'] if r['path'] == 'ladder/b2_taste_today.py')
    cached = []
    for predictor in (run['predictor'], b2):
        assert common.sha256_file(LOOP / 'lab' / predictor['path']) == predictor['sha256']
        path = WORK / 'cache' / cache_key / f'{predictor["sha256"]}.json'
        with path.open() as f:
            answer = json.load(f)
        assert answer['sha256'] == predictor['sha256'] and answer['views'] == cache_key
        assert set(answer['main']) == {v['vid'] for v in index} and not answer['cal']
        identity = answer['identity']
        for field in ('harness_sha256', 'pack_sha256', 'titles_sha256', 'task', 'tier'):
            assert identity[field] == run[field]
        assert identity['views']['digest'] == digest
        assert identity['views']['titles_digest'] == titles_digest
        # A reference's cache file records the run that wrote it, whose predictor may be the candidate; its own
        # hash is checked above (answer['sha256']).
        assert identity['predictor'] in ({k: predictor[k] for k in ('path', 'sha256')},
                                         {k: run['predictor'][k] for k in ('path', 'sha256')})
        assert identity['options']['others'] == 'all'
        assert not answer.get('n_attempts', 0) and not answer['attempts']
        cached.append(answer)

    table = score.t2a_table(index, keys, views.title_facts(pack), len(pack.members['hash']))
    member = table['view_member']
    counts = np.bincount(member, minlength=len(pack.members['hash']))
    others = (counts > 0) & (pack.members['tier'] == 0) & ~pack.members['is_owner']
    assert others.sum() == 61

    def member_mean(values):
        return np.bincount(member, weights=values, minlength=len(counts))[others] / counts[others]

    rows, checks = [], []
    results = (ITEM / 'RESULTS.md').read_text()
    for name, expected in (('shows', 0.175071), ('animation', -0.014557)):
        own = table[f'own_{name}'][member]
        gaps = [np.array([a['main'][v['vid']]['top'][f'top_{name}'] for v in index]) - own
                for a in cached]
        assert all(np.isfinite(g).all() for g in gaps)
        g1, b2_distance = [member_mean(np.abs(g)) for g in gaps]
        pair = stats.paired(g1, b2_distance, run['draws'], run['seed'], lower_is_better=True)
        signed = stats.paired(*[member_mean(g) for g in gaps], run['draws'], run['seed'])
        metric = f'top_{name}_vs_own'
        assert signed['diff'] == expected == run['measures']['others']['vs'][b2['path']][metric]['diff']
        assert any(s.startswith(f'| {metric} |') and f'{expected:+.6f}' in s
                   for s in results.splitlines())
        ties = pair['n'] - pair['improved'] - pair['worse']
        rows.append(f'| {name} | {g1.mean():.6f} | {b2_distance.mean():.6f} | '
                    f'{pair["diff"]:+.6f} [{pair["lo"]:+.6f}, {pair["hi"]:+.6f}] | '
                    f'{pair["n"]} | {pair["improved"]} | {pair["worse"]} | {ties} |')
        checks.append(f'{metric} {signed["diff"]:+.6f}')
    report = '\n'.join([
        '# Item 009: distance from the member’s own mix', '',
        f'T2a run `{RUN}`; tier A members other than the owner; `others: all`.', '',
        'For each view, take `abs(top_share − own_share)`, then average the distances over the member’s '
        'views; members have equal weight. Shares are fractions. The cached `top` values use the harness’s '
        'first 50 non-hidden, non-side-list candidates, with ties in view order. `own` is the member’s '
        'rated universe mix, including hidden ratings, from `score.t2a_table`. '
        'Intervals are paired member bootstrap 95% percentile intervals from `stats.paired`, '
        '10,000 draws, seed 20261013. Negative differences mean G1 is closer.', '',
        '| Mix | G1 mean distance | B2 mean distance | G1 − B2 [95% CI] | n | G1 closer | B2 closer | Tied |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |', *rows, '',
        'Signed paired check: ' + '; '.join(checks) + '. Both equal `RESULTS.md` and the original '
        'ledger to six decimals.', '',
        f'**Cache used; no predictors rerun.** Cache directory: `~/goodwatch-research/taste/work/cache/{cache_key}/`. '
        'Both predictor hashes and cache metadata match. Rebuilt views without writing files; verified the '
        'views, title-array and answer-key digests, pack/title file hashes, and original harness hash '
        f'`{run["harness_sha256"]}`. The retained harness snapshot is '
        '`~/goodwatch-research/taste/work/runs/20261014T104820-3321997e-abdc/harness/`; '
        'the current harness differs from the original run.', '',
        'Reproduce from the worktree root: `python3 -B docs/research/taste-loop/items/009-composition/distance.py`. '
        'The script uses at most two numerical threads and writes only this aggregate report. '
        'No per-member rows are saved.', '',
    ])
    (ITEM / OUT).write_text(report)
    print(report)


if __name__ == '__main__':
    main()
