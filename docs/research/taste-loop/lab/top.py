"""The first titles a rung would show a member: with the member's full history, every title of the candidate
universe (in the pool, with a fingerprint) that the member has not rated, ordered by the rung's rank.

    python3 top.py <rung> --member owner|<hash prefix> [--n 20] [--others all|no-owner]

<rung> is a label (B1, B2, B3, B4, B5, BP) or a file of lab/ladder/. Only the pinned rungs run here: the rung is
called in this process, without the sandbox, on a view in which nothing is hidden, so there is nothing to leak and
nothing to measure. It writes to standard output only: no file, no ledger line. Ties keep the order of the view's
shuffled list. The output names titles a member's ratings point to; keep it out of the repository.
"""
import os

for _name in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS',
              'VECLIB_MAXIMUM_THREADS', 'BLIS_NUM_THREADS'):
    os.environ[_name] = '2'

import argparse  # noqa: E402
import sys  # noqa: E402
import types  # noqa: E402

import numpy as np  # noqa: E402

import views  # noqa: E402
from common import LADDER, loop_pack, pinned, rel, sha256_file  # noqa: E402
from pack import Pack  # noqa: E402

RUNGS = {'B1': 'b1_public.py', 'B2': 'b2_taste_today.py', 'B3': 'b3_taste_standardized.py',
         'B4': 'b4_consensus.py', 'B5': 'b5_pooled.py', 'BP': 'bp_votes.py'}


def first(pack, path, member, n=20, others='all'):
    """[(title row, rank)] of the first n unrated candidates the rung at `path` shows the member."""
    with open(path, 'rb') as f:
        source = f.read()
    module = types.ModuleType(f'rung_{sha256_file(path)[:12]}')
    exec(compile(source, path, 'exec'), module.__dict__)
    view = views.t2a_full_view(pack, member, views.titles_of(views.title_arrays(pack)), others)
    answer = module.predict(view)
    rank = np.asarray(answer['rank'], float)
    targets = view['targets']['title']
    assert rank.shape == targets.shape and np.isfinite(rank).all()
    order = np.argsort(-rank, kind='stable')[:n]
    return [(int(targets[i]), float(rank[i])) for i in order], len(targets), len(view['me']['ratings']['title'])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('rung')
    ap.add_argument('--member', required=True)
    ap.add_argument('--n', type=int, default=20)
    ap.add_argument('--others', default='all', choices=['all', 'no-owner'])
    a = ap.parse_args(argv)
    path = os.path.join(LADDER, RUNGS[a.rung.upper()]) if a.rung.upper() in RUNGS else os.path.abspath(a.rung)
    if not os.path.isfile(path) or not pinned(path, LADDER):
        sys.exit('refused: top.py runs the pinned rungs of lab/ladder/ only (lab/pins.json)')
    pack = Pack(loop_pack()[0])
    found = [pack.owner] if a.member == 'owner' else \
        [i for i, h in enumerate(pack.members['hash']) if h.startswith(a.member)]
    if len(found) != 1 or pack.members['tier'][found[0]] != 0:
        sys.exit(f'refused: --member {a.member}: {len(found)} tier A members match')
    rows, candidates, history = first(pack, path, found[0], a.n, a.others)
    t = pack.titles
    year, g = t['num']['release_year'], t['num']['goodwatch_overall_score_normalized_percent']
    out = [f'### {rel(path)}: the first {len(rows)} of {candidates:,} unrated candidates, from {history:,} ratings', '',
           '| # | Title | Year | Type | GoodWatch score |', '|---:|---|---:|---|---:|']
    for k, (i, _) in enumerate(rows, 1):
        title = str(t['text']['title'][i] or '').replace('|', '/')
        out.append(f'| {k} | {title} | {int(year[i]) if year[i] > 0 else ""} | '
                   f'{t["media_types"][t["media_type"][i]]} | {"" if np.isnan(g[i]) else f"{g[i]:.0f}"} |')
    print('\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
