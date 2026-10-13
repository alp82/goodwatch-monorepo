"""The runner. Use it through run.sh, which holds the lock slot and sets the thread, time and memory limits:

    ./run.sh <predictor.py> --task T1 --tier A --mode explore|registered --item NNN
             [--ref <predictor.py> ...] [--members owner,<hash prefix>,...] [--others all|no-owner|before]
             [--no-cache]

What one run does:

1. Refuses what the protocol refuses: a tier other than A, a registered run whose `items/NNN-*/PREREG.md` is not
   committed or does not list the predictor's sha256, the 21st exploratory or 4th registered run of an item.
2. Builds the views from the pack (views.py) into a run folder and the answers into a file elsewhere.
3. Runs the candidate and every reference predictor, each view in its own sandboxed process (sandbox.py). In an
   exploratory run a reference whose answers for exactly these views are already stored is not run again
   (--no-cache runs everything); a registered run runs everything, one view at a time, and needs the full sandbox.
4. Checks every answer against the contract, turns answers into whole ratings (score.py), computes the measures
   with intervals and smallest detectable effects (stats.py).
5. Appends one line to ledger.jsonl and writes result.json and the log under <data root>/results/<run id>/.

`--ref` names the reference rungs; the first one is the run's primary reference. Without --ref it is rung B0.
Modes `control` and `verify` are used by lab/controls and verify.py: control lines never count as results and do
not use the item's budget; a verify run writes no ledger line of its own.
"""
import argparse
import datetime
import glob
import hashlib
import json
import os
import resource
import shutil
import subprocess
import sys
import time

import numpy as np

import score
import views
from common import (BUDGET, DATA_ROOT, DRAWS, LAB, LOOP, SEED, append_ledger, git, harness_sha256, read_ledger, rel,
                    sha256_file)
from pack import Pack

B0 = os.path.join(LAB, 'ladder', 'b0_median.py')
THREADS = '2'                        # the run as a whole: at most two predictor processes at a time,
SANDBOX_THREADS = '1'                # each with one thread
FULL_SANDBOX = ('landlock', 'seccomp', 'net_isolated', 'namespaces')
THREAD_VARS = ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS',
               'VECLIB_MAXIMUM_THREADS', 'BLIS_NUM_THREADS')
MEMORY_MB = 4096
VIEW_CPU_SECONDS = 300
VIEW_WALL_SECONDS = 600


class Refused(Exception):
    """The protocol does not allow this run. Nothing was computed and nothing was written."""


class Failed(Exception):
    """The run was started and cannot give measures (a contract failure, a crash)."""


# ------------------------------------------------------------------ what the protocol refuses

def item_folder(loop_dir, item):
    found = sorted(glob.glob(os.path.join(loop_dir, 'items', f'{item}-*')))
    if len(found) != 1:
        raise Refused(f'item {item}: expected one folder items/{item}-*, found {len(found)}')
    return found[0]


def check_prereg(loop_dir, item, sha):
    path = os.path.join(item_folder(loop_dir, item), 'PREREG.md')
    if not os.path.exists(path):
        raise Refused(f'a registered run needs {rel(path, loop_dir)}')
    folder = os.path.dirname(path)
    if git(['ls-files', '--error-unmatch', 'PREREG.md'], folder).returncode != 0:
        raise Refused('PREREG.md is not committed')
    if git(['status', '--porcelain', '--', 'PREREG.md'], folder).stdout.strip():
        raise Refused('PREREG.md differs from the committed version')
    with open(path) as f:
        if sha not in f.read():
            raise Refused(f'PREREG.md does not list the predictor\'s sha256 {sha}')


def check_budget(ledger, item, mode):
    if mode not in BUDGET:
        return
    used = sum(1 for line in ledger if line.get('item') == item and line.get('mode') == mode)
    if used >= BUDGET[mode]:
        raise Refused(f'item {item} has used its {BUDGET[mode]} {mode} runs')


# ------------------------------------------------------------------ running predictors

def _worker(predictor, sha, vids, run_dir, titles_path, log, tag, workers):
    """Start sandbox.py for one predictor and a list of views; read back what it left in its output folder."""
    out_dir = os.path.join(run_dir, 'out', os.urandom(16).hex())      # a name no predictor process can know
    os.makedirs(out_dir, mode=0o700)
    views_fd = os.open(os.path.join(run_dir, 'views'), os.O_RDONLY | os.O_DIRECTORY)
    out_fd = os.open(out_dir, os.O_RDONLY | os.O_DIRECTORY)
    job = {'predictor': predictor, 'module': f'predictor_{sha[:12]}', 'titles': titles_path, 'views_fd': views_fd,
           'out_fd': out_fd, 'view_list': list(vids), 'memory_mb': MEMORY_MB, 'cpu_seconds': VIEW_CPU_SECONDS,
           'wall_seconds': VIEW_WALL_SECONDS, 'workers': workers}
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'PYTHONHASHSEED': '0',
           **{v: SANDBOX_THREADS for v in THREAD_VARS}}
    try:
        with open(log, 'a') as lf:
            lf.write(f'--- {predictor} ({sha[:12]}), {len(vids)} views, {tag}\n')
            lf.flush()
            done = subprocess.run([sys.executable, '-s', '-P', '-B', os.path.join(LAB, 'sandbox.py')],
                                  input=json.dumps(job).encode(), env=env, cwd='/', stdout=lf, stderr=lf,
                                  pass_fds=(views_fd, out_fd))
    finally:
        os.close(views_fd)
        os.close(out_fd)
    facts_path = os.path.join(out_dir, 'worker.facts')
    if done.returncode != 0 or not os.path.exists(facts_path):
        raise Failed(f'the sandbox for {rel(predictor)} ended with code {done.returncode}; see the log')
    with open(facts_path) as f:
        facts = json.load(f)
    if facts.get('error'):
        raise Failed(f'{rel(predictor)}: {facts["error"]}')
    results, namespaces = {}, True
    with open(log, 'a') as lf:
        for vid in vids:
            base = os.path.join(out_dir, vid)
            try:
                with open(base + '.facts') as f:
                    r = json.load(f)
            except (OSError, ValueError):
                r = {'seconds': 0.0, 'peak_mb': 0.0, 'namespaces': False, 'timed_out': False, 'ended': 'unknown'}
            namespaces &= bool(r['namespaces'])
            try:
                with open(base + '.answer', 'rb') as f:
                    r['answer'] = json.loads(f.read())
                assert isinstance(r['answer'], dict)
            except (OSError, ValueError, AssertionError):
                why = 'ran over its time limit' if r.get('timed_out') else f'ended without an answer ({r["ended"]})'
                r['answer'] = {'returned': 'error', 'error': f'the predictor process {why}', 'attempts': []}
            try:
                with open(base + '.log', 'rb') as f:
                    text = f.read(20000).decode('utf-8', 'replace')
                if text.strip():
                    lf.write(f'[view {vid}]\n{text}\n')
            except OSError:
                pass
            results[vid] = r
    shutil.rmtree(out_dir, ignore_errors=True)
    return {'results': results, 'landlock': facts['landlock'], 'seccomp': facts['seccomp'],
            'net_isolated': facts['net_isolated'], 'namespaces': namespaces}


def run_predictor(predictor, index, keys, run_dir, titles_path, log, cache_file=None, workers=2):
    """Answers of one predictor for the main views and, when it gives no score, for the calibration views.
    Returns {'main': {vid: {'rank','score','p_low'}}, 'cal': {...}, 'seconds', 'peak_mb', 'attempts', 'sandbox'}
    with lists in place of arrays."""
    sha = sha256_file(predictor)
    if cache_file and os.path.exists(cache_file):
        with open(cache_file) as f:
            got = json.load(f)
        got['cached'] = True
        return got
    start = time.time()
    main = [v['vid'] for v in index if v['kind'] == 'main']
    cal = [v['vid'] for v in index if v['kind'] == 'cal']
    out = {'main': {}, 'cal': {}, 'attempts': [], 'peak_mb': 0.0, 'sandbox': {}, 'cached': False, 'sha256': sha}

    def take(vids, tag, into):
        raw = _worker(predictor, sha, vids, run_dir, titles_path, log, tag, workers)
        out['sandbox'] = {k: bool(raw[k] and out['sandbox'].get(k, True))
                          for k in ('landlock', 'seccomp', 'net_isolated', 'namespaces')}
        for vid in vids:
            r = raw['results'][vid]
            out['peak_mb'] = max(out['peak_mb'], r['peak_mb'])
            for a in r['answer'].get('attempts', []):
                if len(out['attempts']) < 50:
                    out['attempts'].append(a)
            out['n_attempts'] = out.get('n_attempts', 0) + len(r['answer'].get('attempts', []))
            try:
                ok = score.check_answer(r['answer'], len(keys[vid]['score']))
            except score.ContractError as e:
                with open(log, 'a') as lf:
                    lf.write(f'contract failure in view {vid}: {e}\n{r["answer"].get("trace", "")}\n')
                raise Failed(f'{rel(predictor)}: {e}') from None
            into[vid] = {k: (None if a is None else a.tolist()) for k, a in ok.items()}

    take(main, 'main', out['main'])
    for name in ('score', 'p_low'):
        given = {out['main'][v][name] is None for v in main}
        if len(given) > 1:
            raise Failed(f'{rel(predictor)}: {name} is given for some views and None for others')
    if main and out['main'][main[0]]['score'] is None and cal:
        take(cal, 'cal', out['cal'])
    out.setdefault('n_attempts', 0)
    out['seconds'] = round(time.time() - start, 2)
    if cache_file and out['n_attempts'] == 0:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        tmp = cache_file + f'.tmp{os.getpid()}'
        with open(tmp, 'w') as f:
            json.dump(out, f)
        os.replace(tmp, cache_file)
    return out


def final_predictions(answers, index, keys):
    """{'pred', 'rank', 'p_low'} aligned with the target table (main views in index order)."""
    cal_of = {}
    for v in index:
        if v['kind'] == 'cal':
            cal_of.setdefault(v['parent'], []).append(v['vid'])
    pred, rank, p_low = [], [], []
    for v in index:
        if v['kind'] != 'main':
            continue
        a = answers['main'][v['vid']]
        r = np.array(a['rank'], float)
        if a['score'] is not None:
            s = np.array(a['score'], float)
        else:
            cals = [c for c in cal_of.get(v['vid'], []) if c in answers['cal']]
            cr = np.concatenate([answers['cal'][c]['rank'] for c in cals]) if cals else np.zeros(0)
            cs = np.concatenate([keys[c]['score'] for c in cals]) if cals else np.zeros(0)
            s = score.calibrated(r, cr, cs, keys[v['vid']]['history_score'])
        pred.append(score.to_rating(s))
        rank.append(r)
        p_low.append(None if a['p_low'] is None else np.array(a['p_low'], float))
    cat = (lambda x: np.concatenate(x) if x else np.zeros(0))
    return {'pred': cat(pred).astype(np.int64), 'rank': cat(rank),
            'p_low': None if not p_low or p_low[0] is None else cat(p_low)}


def target_table(pack, index, keys):
    cols = {c: [] for c in ('member', 'view', 'y', 'sitting', 'same_sitting', 'block', 'media', 'provenance',
                            'has_fingerprint', 'old_title', 'low_share')}
    k = 0
    for v in index:
        if v['kind'] != 'main':
            continue
        key = keys[v['vid']]
        n = len(key['score'])
        cols['member'].append(np.full(n, v['member'], np.int64))
        cols['view'].append(np.full(n, k, np.int64))
        cols['block'].append(np.full(n, v['block'], np.int64))
        cols['low_share'].append(np.full(n, float((key['history_score'] <= score.LOW).mean())))
        cols['y'].append(key['score'])
        for c in ('sitting', 'same_sitting', 'media', 'provenance', 'has_fingerprint', 'old_title'):
            cols[c].append(key[c])
        k += 1
    table = {c: (np.concatenate(v) if v else np.zeros(0, np.int64)) for c, v in cols.items()}
    for c in ('same_sitting', 'has_fingerprint', 'old_title'):
        table[c] = table[c].astype(bool)
    table['provenance_names'] = list(pack.provenance_names)
    return table


def plant_signal(pred, table, effect, seed):
    """Control only: move the rounded prediction one point toward the true rating on a random share of each
    member's targets, chosen so that the member's expected error falls by `effect` points."""
    pred = pred.copy()
    for u in np.unique(table['member']).tolist():
        at = np.flatnonzero(table['member'] == u)
        off = pred[at] != table['y'][at]
        if not off.any():
            continue
        q = min(1.0, effect / off.mean())
        move = off & (np.random.default_rng([seed, u]).random(len(at)) < q)
        pred[at[move]] += np.sign(table['y'][at[move]] - pred[at[move]])
    return pred


# ------------------------------------------------------------------ one run

def execute(predictor, refs=None, *, item, mode, task='T1', tier='A', pack=None, loop_dir=LOOP, members=None,
            others='all', shuffle_seed=None, plant=None, control=None, use_cache=True, own=None, work=None,
            keep=False, write_ledger=True, quiet=False):
    """Run one predictor against its references. Returns the ledger line (also when the run failed)."""
    started = time.time()
    if task != 'T1':
        raise Refused(f'task {task} is not built yet')
    pack = pack or Pack()
    root = os.path.dirname(os.path.dirname(pack.folder))
    real = os.path.realpath(root) == os.path.realpath(DATA_ROOT)
    if real and os.path.realpath(loop_dir) != os.path.realpath(LOOP):
        raise Refused('the real pack is scored into the repository ledger only')
    if (tier == 'B') != (own is not None) or tier not in ('A', 'B'):
        raise Refused('tier B is read by gate.py only')
    if mode not in ('explore', 'registered', 'control', 'verify', 'gate'):
        raise Refused(f'unknown mode {mode}')
    if (plant is not None or shuffle_seed is not None) and mode not in ('control', 'verify'):
        raise Refused('shuffled labels and planted effects are controls')
    predictor = os.path.abspath(predictor)
    refs = [os.path.abspath(r) for r in (refs or [B0])]
    for p in [predictor] + refs:
        if not os.path.isfile(p):
            raise Refused(f'no predictor file {p}')
    sha = sha256_file(predictor)
    ledger_path = os.path.join(loop_dir, 'ledger.jsonl')
    ledger = read_ledger(ledger_path)
    item_folder(loop_dir, item)
    if mode == 'registered':
        check_prereg(loop_dir, item, sha)
    check_budget(ledger, item, mode)

    rows = None
    if members is not None:
        rows = []
        for who in members:
            found = [pack.owner] if who == 'owner' else \
                [i for i, h in enumerate(pack.members['hash']) if h.startswith(who)]
            if len(found) != 1:
                raise Refused(f'--members {who}: {len(found)} members match')
            rows += found

    stamp = datetime.datetime.now(datetime.timezone.utc)
    run_id = f'{stamp:%Y%m%dT%H%M%S}-{sha[:8]}-{os.urandom(2).hex()}'
    work = work or os.path.join(root, 'work')
    run_dir = os.path.join(work, 'runs', run_id)
    keys_path = os.path.join(work, 'keys', f'{run_id}.npz')
    results_dir = os.path.join(root, 'gate', 'results', 'runs', run_id) if tier == 'B' else \
        os.path.join(root, 'results', run_id)
    os.makedirs(run_dir, mode=0o700)
    os.makedirs(results_dir, mode=0o700)
    log = os.path.join(results_dir, 'log.txt')
    harness = harness_sha256()
    commit = git(['rev-parse', 'HEAD'], loop_dir).stdout.strip() or None
    dirty = bool(git(['status', '--porcelain', '--', '.'], LAB).stdout.strip())
    names = {p: rel(p) for p in [predictor] + refs}
    line = {'run_id': run_id, 'time': f'{stamp:%Y-%m-%dT%H:%M:%SZ}', 'item': item, 'mode': mode, 'task': task,
            'tier': tier, 'git_commit': commit, 'lab_uncommitted': dirty, 'harness_sha256': harness,
            'pack': os.path.basename(pack.folder), 'pack_sha256': pack.manifest['files_sha256']['pack.pkl'],
            'titles_sha256': pack.manifest['files_sha256']['titles.pkl'],
            'predictor': {'path': names[predictor], 'sha256': sha},
            'refs': [{'path': names[r], 'sha256': sha256_file(r)} for r in refs],
            'primary_ref': names[refs[0]],
            'options': {'others': others, 'members': 'all' if members is None else sorted(members),
                        'shuffle_seed': shuffle_seed, 'plant': plant},
            'seed': SEED, 'draws': DRAWS, 'threads': int(THREADS)}
    if control:
        line['control'] = control
    try:
        t_sha = pack.manifest['files_sha256']['titles.pkl']
        titles_dir = os.path.join(work, 'titles', f'{t_sha[:16]}-{sha256_file(os.path.join(LAB, "views.py"))[:8]}')
        titles_path = os.path.join(titles_dir, 'titles.npz')
        if not os.path.exists(titles_path):
            digest = views.export_titles(pack, titles_path)
            with open(os.path.join(titles_dir, 'digest'), 'w') as f:
                f.write(digest)
        with open(os.path.join(titles_dir, 'digest')) as f:
            titles_digest = f.read().strip()

        index, keys, digest = views.build_t1(pack, run_dir, own=own, members=rows, others_mode=others,
                                             shuffle_seed=shuffle_seed)
        views.write_keys(keys_path, index, keys)
        main = [v for v in index if v['kind'] == 'main']
        if not main:
            raise Failed('no member has a target')
        line['views'] = {'digest': digest, 'titles_digest': titles_digest, 'main': len(main),
                         'calibration': len(index) - len(main)}
        cache_key = hashlib.sha256(f'{digest}|{titles_digest}|{harness}'.encode()).hexdigest()[:32]
        cache_dir = os.path.join(work, 'cache', cache_key)

        answers, seconds, peak, attempts, sandbox = {}, {}, 0.0, 0, {}
        strict = mode in ('registered', 'gate')
        workers = 1 if mode in ('registered', 'gate', 'verify') else 2      # runs that count: one view at a time
        for p in [predictor] + refs:
            p_sha = sha256_file(p)
            if p_sha in answers:
                continue
            cache_file = os.path.join(cache_dir, f'{p_sha}.json') if use_cache and mode in ('explore', 'control') \
                else None
            if p == predictor and cache_file:           # the candidate itself always runs; its answers are stored
                if os.path.exists(cache_file):
                    os.remove(cache_file)
            got = run_predictor(p, index, keys, run_dir, titles_path, log, cache_file, workers)
            if strict and not all(got['sandbox'].get(k) for k in FULL_SANDBOX):
                raise Failed(f'a {mode} run needs the full sandbox; this machine gave {got["sandbox"]}')
            answers[p_sha] = got
            seconds[names[p]] = got['seconds']
            peak = max(peak, got['peak_mb'])
            if p == predictor:
                attempts, sandbox = got['n_attempts'], got['sandbox']
                line['sandbox'] = {**sandbox, 'attempts': attempts, 'examples': got['attempts'][:8]}
        for r in line['refs']:
            r['cached'] = bool(answers[r['sha256']].get('cached'))

        table = target_table(pack, index, keys)
        cand = final_predictions(answers[sha], index, keys)
        if plant is not None:
            cand['pred'] = plant_signal(cand['pred'], table, plant, SEED)
        ref_preds = {names[r]: final_predictions(answers[sha256_file(r)], index, keys) for r in refs}
        owner = pack.owner if tier == 'A' else None
        line['measures'] = score.t1_measures(table, cand, ref_preds, owner, DRAWS, SEED)
        line['views'].update(members=int(len(np.unique(table['member']))), targets=int(len(table['y'])))
        line['status'] = 'ok' if attempts == 0 else 'attempts'
        line['predictor_seconds'] = seconds
        line['peak_mb'] = round(max(peak, resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024), 1)

        cv = score.member_values(table, cand)
        rvs = {name: score.member_values(table, rp)['mae'] for name, rp in ref_preds.items()}
        per = []
        for u in np.flatnonzero(cv['targets'] > 0).tolist():
            row = {'member': pack.members['hash'][u], 'targets': int(cv['targets'][u]), 'mae': float(cv['mae'][u])}
            for name, rm in rvs.items():
                row[f'mae:{name}'] = float(rm[u])
            per.append(row)
        result = {**line, 'per_member': per}
    except Failed as e:
        line['status'] = 'failed'
        line['error'] = str(e)
        result = dict(line)
    finally:
        if not keep:
            shutil.rmtree(run_dir, ignore_errors=True)
            if os.path.exists(keys_path):
                os.remove(keys_path)
    line['seconds'] = round(time.time() - started, 1)
    result['seconds'] = line['seconds']
    with open(os.path.join(results_dir, 'result.json'), 'w') as f:
        json.dump(result, f, indent=1)
    if write_ledger and mode in ('explore', 'registered', 'control'):
        append_ledger(ledger_path, line)
    if not quiet:
        print(summary(line))
        print(f'result and log: {results_dir}')
    return line


def _ci(d, key='diff'):
    if d.get(key) is None:
        return 'n/a'
    if d.get('lo') is None:
        return f'{d[key]:+.3f}'
    return f'{d[key]:+.3f} ({d["lo"]:+.3f} to {d["hi"]:+.3f})'


def summary(line):
    out = [f'run {line["run_id"]}  {line["predictor"]["path"]}  {line["task"]} tier {line["tier"]} '
           f'{line["mode"]}  status {line["status"]}  {line["seconds"]} s']
    if line['status'] == 'failed':
        return out[0] + f'\n  {line["error"]}'
    m = line['measures']
    o = m['others']
    out.append(f'  others: {o["n_members"]} members with {m["min_targets"]}+ targets, error {o["mae"]["value"]:.3f}')
    for ref, d in o['vs'].items():
        v = d['mae']
        out.append(f'    against {ref}: {_ci(v)}, smallest detectable {v.get("sde")}, '
                   f'{v.get("improved")} of {v["n"]} members improved')
    if 'owner' in m:
        w = m['owner']
        out.append(f'  owner: {w["n_targets"]} targets, error {w["mae"]["value"]:.3f}')
        for ref, d in w['vs'].items():
            out.append(f'    against {ref}: {_ci(d["mae"])}, smallest detectable {d["mae"].get("sde")}')
    if line.get('sandbox', {}).get('attempts'):
        out.append(f'  the predictor tried {line["sandbox"]["attempts"]} things the sandbox refused: '
                   f'{line["sandbox"]["examples"][:3]}')
    return '\n'.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Run one predictor through the harness. Use run.sh.')
    ap.add_argument('predictor')
    ap.add_argument('--task', default='T1')
    ap.add_argument('--tier', default='A')
    ap.add_argument('--mode', required=True, choices=['explore', 'registered', 'control'])
    ap.add_argument('--item', required=True)
    ap.add_argument('--ref', action='append')
    ap.add_argument('--members')
    ap.add_argument('--others', default='all', choices=['all', 'no-owner', 'before'])
    ap.add_argument('--no-cache', action='store_true')
    ap.add_argument('--control', help='the name of the control (mode control only)')
    ap.add_argument('--shuffle-seed', type=int)
    ap.add_argument('--plant', type=float)
    ap.add_argument('--pack', help='a pack folder other than the newest (tests)')
    ap.add_argument('--loop-dir', default=LOOP, help='the folder with ledger.jsonl and items/ (tests)')
    ap.add_argument('--keep', action='store_true', help='keep the run folder with the views')
    a = ap.parse_args(argv)
    if os.environ.get('TASTE_RUN_SH') != '1':
        sys.exit('use run.sh: it holds the lock slot and sets the thread, time and memory limits')
    if a.tier != 'A':
        sys.exit('refused: tier B is read by gate.py only')
    if (a.mode == 'control') != bool(a.control):
        sys.exit('refused: --control names the control of a run in mode control, and only there')
    try:
        line = execute(a.predictor, a.ref, item=a.item, mode=a.mode, task=a.task, tier=a.tier,
                       pack=Pack(a.pack) if a.pack else None, loop_dir=os.path.abspath(a.loop_dir),
                       members=a.members.split(',') if a.members else None, others=a.others,
                       shuffle_seed=a.shuffle_seed, plant=a.plant, control=a.control, use_cache=not a.no_cache,
                       keep=a.keep)
    except Refused as e:
        sys.exit(f'refused: {e}')
    sys.exit(0 if line['status'] in ('ok', 'attempts') else 2)


if __name__ == '__main__':
    main()
