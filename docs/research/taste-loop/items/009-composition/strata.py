"""Item 009: the orchestrator's stratum checks of G1 against B2 (PLAN.md 4, checks 4 and 5), from the same
hash-checked cached outputs as distance.py. Aggregates only."""
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
# Item 009's registered run 20261014T150814-e864bd47-58d5 keeps no predictor outputs, so they are read from an
# exploratory run of the same comparison under the same harness, whose views and measures equal it (asserted below).
RUN, HARNESS, OUT = '20261014T152137-e864bd47-c7f9', LOOP / 'lab', 'STRATA.md'
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
    if True:  # the registered run must match the run whose outputs are read
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

    facts = views.title_facts(pack)
    tm = table['member']  # per hidden title; `member` above is per view
    title, y, view = table['title'], table['y'], table['view']
    pct = [np.concatenate([a['main'][v['vid']]['pct'] for v in index]).astype(float) for a in cached]
    assert len(pct[0]) == len(y)
    high, low = y >= 8, y <= score.LOW  # the bands of score.py (rated 8 or more, 5 or less)
    owner_id = int(np.flatnonzero(pack.members['is_owner'])[0])
    hidden = np.bincount(tm, minlength=len(counts))
    sittings = np.array([len(np.unique(table['sitting'][tm == m])) if counts[m] else 0
                         for m in range(len(counts))])

    def separation(p, mask, with_owner=False):
        """Per member: mean percentile of rated 8+ minus rated 5 or less, both bands with 5+ titles in mask."""
        keep = mask & np.isin(tm, np.flatnonzero(others | (with_owner & (np.arange(len(counts)) == owner_id))))
        out = {}
        for m in np.unique(tm[keep]):
            h, l = keep & (tm == m) & high, keep & (tm == m) & low
            if h.sum() >= score.T2A_BAND_MIN and l.sum() >= score.T2A_BAND_MIN:
                out[int(m)] = p[h].mean() - p[l].mean()
        return out

    def row(name, mask, members=None, with_owner=False):
        a, b = separation(pct[0], mask, with_owner), separation(pct[1], mask, with_owner)
        ms = sorted(set(a) & set(b) & (set(members) if members is not None else set(a)))
        if len(ms) < 5:
            return f'| {name} | {len(ms)} members: too few |  |  |'
        pr = stats.paired(np.array([a[m] for m in ms]), np.array([b[m] for m in ms]), run['draws'], run['seed'],
                         lower_is_better=False)
        return (f'| {name} | {pr["diff"]:+.3f} ({pr["lo"]:+.3f} to {pr["hi"]:+.3f}) | {pr["n"]} | '
                f'{pr["improved"]} of {pr["n"]} |')

    everyone = np.ones(len(y), bool)
    check = stats.paired(*[np.array(list(separation(p_, everyone).values())) for p_ in pct], run['draws'], run['seed'])
    assert abs(check['diff'] - run['measures']['others']['vs'][b2['path']]['separation']['diff']) < 1e-6, check
    is_show = facts['show'][title].astype(bool)
    votes = facts['votes'][title].astype(float)
    median_votes = float(np.nanmedian(votes))
    multi = [m for m in range(len(counts)) if sittings[m] >= 2]
    single = [m for m in range(len(counts)) if sittings[m] == 1]
    eligible = sorted(separation(pct[0], everyone))
    cut = float(np.median([hidden[m] for m in eligible]))
    rows = [
        row('All (check: equals the registered run)', everyone),
        row('Owner in', everyone, with_owner=True),
        row('Hidden movies only', ~is_show),
        row('Hidden shows only', is_show),
        row(f'Members with fewer hidden titles (under {cut:.0f})', everyone, [m for m in eligible if hidden[m] < cut]),
        row(f'Members with more hidden titles ({cut:.0f} or more)', everyone, [m for m in eligible if hidden[m] >= cut]),
        row('Members whose hidden titles come from one sitting', everyone, single),
        row('Members whose hidden titles come from two or more sittings', everyone, multi),
        row(f'Hidden titles with votes under the median ({median_votes:,.0f})', votes < median_votes),
        row('Hidden titles with votes at or over the median', votes >= median_votes),
    ]
    report = '\n'.join([
        '# Item 009: stratum checks of G1 against B2 (orchestrator)', '',
        f'T2a, tier A, `others: all`; predictor outputs of run `{RUN}`, which has the registered run '
        '`20261014T150814-e864bd47-58d5`\'s views, harness and measures (asserted). Separation per member: mean '
        'percentile of hidden titles rated 8 or more minus those rated 5 or less, each band with 5 or more titles '
        'inside the stratum; paired G1 minus B2 over the members that qualify under both, member bootstrap, '
        '10,000 draws, seed 20261013. A stratum restricts the hidden titles; the candidates they are ranked among '
        'are unchanged. Exploratory checks (PLAN.md 4, the orchestrator\'s checks 4 and 5); nothing here is judged '
        'by the win rule.', '',
        '**This would be wrong if** G1 separates loved from disliked titles only because loved titles are more '
        'popular: then the gain would vanish among hidden titles with few votes. Test: the two vote rows below.', '',
        '| Stratum | G1 − B2 separation | Members | G1 better |', '|---|---:|---:|---:|', *rows, '',
        'Reproduce from the worktree root: `python3 -B docs/research/taste-loop/items/009-composition/strata.py`.', '',
    ])
    (ITEM / OUT).write_text(report)
    print(report)


if __name__ == '__main__':
    main()
