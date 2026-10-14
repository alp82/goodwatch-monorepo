"""The runner. Use it through run.sh, which holds the lock slot and sets the thread, time and memory limits:

    ./run.sh <predictor.py> --task T1|T2a|T2b --tier A --mode explore|registered|ladder --item NNN
             [--ref <ladder rung> ...] [--members owner,<hash prefix>,...] [--others all|no-owner|before]
             [--split sitting|order] [--no-cache]

What one run does:

1. Refuses what the protocol refuses (see `execute`, in order): a run that does not hold a lock slot under
   run.sh's limits; a pack other than the one the committed MANIFEST.json names; a ledger whose committed lines
   were edited or removed; an item without exactly one folder that holds a committed BRIEF.md; a predictor file
   over 64 KB; a reference that is not a file of lab/ladder/; a registered run that does not match its committed
   PREREG.md line by line; the 21st exploratory or 4th registered run of an item.
2. Builds the views from the pack (views.py) into a run folder and the answers into a file elsewhere.
3. Runs the candidate and every reference predictor, each view in its own sandboxed process (sandbox.py). Outside
   registered, gate and verify runs a reference whose answers for exactly these views are already stored is not
   run again (--no-cache runs everything).
4. Checks every answer against the contract, turns answers into whole ratings (score.py), computes the measures
   with intervals and smallest detectable effects (stats.py), and for a rank-only candidate the calibrator floor.
5. Appends one line to ledger.jsonl and writes result.json and the log under <data root>/results/<run id>/.

Modes. `explore` and `registered` are for candidate predictors and use the item's budget. `ladder` runs a file of
lab/ladder/ only, uses no budget, and is the only mode table.py reads. `control` is used by lab/controls: only the
six control names, only predictors under lab/ladder/ or lab/controls/predictors/; never a result. `verify` and
`gate` are entered through verify.py and gate.py only. Whatever runs without a budget (a rung, a control predictor,
any reference) must be a file pinned by hash in lab/pins.json, which is part of the harness hash.

`--ref` names the reference rungs; the first one is the run's primary reference. Without --ref it is rung B0 in
T1 and rung B2 (today's taste) in T2a.

T2a (the hidden-title test) runs through the same steps. Its views have about 60,000 targets each, so an answer is
turned into the few numbers the measures need (score.t2a_view) the moment it is read, and the ranks are dropped:
neither the runner nor the stored answers of a reference ever hold more than one view's ranks. T2a has no
calibrator, no planted effect, no `--others before` (it has no moment in time) and no gate.

T2b (ranking later Want to See adds) runs the same way, one view per member. Its `--others` is `before` unless
named, `--split` chooses how targets are cut (`sitting`, the default, or `order`), and it has no gate either. Its
shuffled control keeps the views and names random non-target titles as the targets.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
import re
import resource
import shutil
import subprocess
import sys
import time

import numpy as np

import score
import views
from common import (BUDGET, CONTROL_PREDICTORS, CONTROLS, DRAWS, LAB, LADDER, LOOP, MANIFEST, OTHERS,
                    PREDICTOR_BYTES, SEED, append_ledger, checked_ledger, git, harness_sha256, inside, loop_pack,
                    pinned, rel, sha256_file)
from pack import Pack

B0 = os.path.join(LADDER, 'b0_median.py')
B2 = os.path.join(LADDER, 'b2_taste_today.py')
TASKS = ('T1', 'T2a', 'T2b')
DEFAULT_REF = {'T1': B0, 'T2a': B2, 'T2b': B2}      # T2a, T2b: B0 gives no order; the reference is today's taste
DEFAULT_OTHERS = {'T1': 'all', 'T2a': 'all', 'T2b': 'before'}
VIEWS_PER_WORKER = {'T2a': 64, 'T2b': 64}            # their answers are large: a sandbox worker gets 64 views at a time
THREADS = '2'                        # the run as a whole: at most two predictor processes at a time,
SANDBOX_THREADS = '1'                # each with one thread
FULL_SANDBOX = ('landlock', 'seccomp', 'net_isolated', 'namespaces')
THREAD_VARS = ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS',
               'VECLIB_MAXIMUM_THREADS', 'BLIS_NUM_THREADS')
MEMORY_MB = 4096
VIEW_CPU_SECONDS = 300
VIEW_WALL_SECONDS = 600
MODES = ('explore', 'registered', 'ladder', 'control', 'verify', 'gate')
LEDGER = os.path.join(LOOP, 'ledger.jsonl')
PREREG_KEYS = ('candidate', 'reference', 'others', 'task')


class Refused(Exception):
    """The protocol does not allow this run. Nothing was computed and nothing was written."""


class Failed(Exception):
    """The run was started and cannot give measures (a contract failure, a crash)."""


# ------------------------------------------------------------------ what the protocol refuses

def under_run_sh(root):
    """None when this process holds one of the two lock slots of the data root under run.sh's limits, else what is
    missing. Checked on the process itself, so no environment variable can stand in for run.sh."""
    locks = os.path.join(root, 'work', 'locks')
    try:
        mine = os.fstat(9)
        slots = [os.stat(os.path.join(locks, name)) for name in ('slot0.lock', 'slot1.lock')
                 if os.path.exists(os.path.join(locks, name))]
        if not any((s.st_dev, s.st_ino) == (mine.st_dev, mine.st_ino) for s in slots):
            return 'descriptor 9 is not a lock slot of the data root'
        fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)             # succeeds only when this process holds the slot
    except OSError:
        return 'no lock slot is held'
    soft = resource.getrlimit(resource.RLIMIT_AS)[0]
    if soft == resource.RLIM_INFINITY or soft > MEMORY_MB << 20:
        return 'no 4 GB address-space limit'
    if any(os.environ.get(v) != THREADS for v in THREAD_VARS):
        return 'the thread limits are not set'
    if os.getpriority(os.PRIO_PROCESS, 0) < 10:
        return 'not at low priority'
    try:
        with open(f'/proc/{os.getppid()}/comm') as f:
            if f.read().strip() != 'timeout':
                return 'no wall-clock limit'
    except OSError:
        return 'no wall-clock limit'
    return None


def the_pack():
    """The one pack this loop folder's ledger belongs to: the committed MANIFEST.json names its folder and hash."""
    folder, sha = loop_pack()
    if folder is None:
        raise Refused(f'{rel(MANIFEST, LOOP)} does not name a pack')
    if git(['ls-files', '--error-unmatch', os.path.basename(MANIFEST)], LOOP).returncode != 0 or \
            git(['status', '--porcelain', '--', os.path.basename(MANIFEST)], LOOP).stdout.strip():
        raise Refused('MANIFEST.json is not committed, or differs from the committed version')
    try:
        pack = Pack(folder)
    except OSError as e:
        raise Refused(f'the pack named by MANIFEST.json cannot be read: {e}') from None
    if pack.manifest['files_sha256']['pack.pkl'] != sha or sha256_file(os.path.join(folder, 'pack.pkl')) != sha:
        raise Refused('the pack is not the one MANIFEST.json names')
    return pack


def item_folder(item):
    """The item's folder: three digits, exactly one folder items/NNN-*, with a committed BRIEF.md (an item exists
    once the orchestrator has committed its brief; a new number is not a new budget)."""
    if not re.fullmatch(r'\d{3}', str(item)):
        raise Refused(f'item {item!r}: an item is three digits')
    items = os.path.join(LOOP, 'items')
    found = sorted(d for d in (os.listdir(items) if os.path.isdir(items) else [])
                   if d.startswith(f'{item}-') and os.path.isdir(os.path.join(items, d)))
    if len(found) != 1:
        raise Refused(f'item {item}: expected one folder items/{item}-*, found {len(found)}')
    folder = os.path.join(items, found[0])
    if git(['ls-files', '--error-unmatch', 'BRIEF.md'], folder).returncode != 0:
        raise Refused(f'item {item}: items/{found[0]}/BRIEF.md is not committed')
    return folder


def parse_prereg(text):
    """PREREG.md -> {'candidate', 'reference', 'others', 'task'}. Each key stands alone on exactly one line that
    starts with it (`candidate: <sha256>`); everything else in the file is prose and is not read."""
    found = {k: [] for k in PREREG_KEYS}
    for line in text.splitlines():
        m = re.match(r'(candidate|reference|others|task):(.*)$', line)
        if m:
            found[m.group(1)].append(m.group(2).strip())
    for k, v in found.items():
        if len(v) != 1:
            raise Refused(f'PREREG.md must hold exactly one line `{k}: ...`, found {len(v)}')
    out = {k: v[0] for k, v in found.items()}
    if not re.fullmatch(r'[0-9a-f]{64}', out['candidate']):
        raise Refused('PREREG.md: candidate is not a sha256')
    if not re.fullmatch(r'ladder/[A-Za-z0-9_]+\.py', out['reference']):
        raise Refused('PREREG.md: reference is not ladder/<file>')
    if out['others'] not in OTHERS:
        raise Refused(f'PREREG.md: others is not one of {", ".join(OTHERS)}')
    return out


def check_prereg(folder, predictor, sha, refs, others, task, members):
    """A registered run is the one comparison its committed PREREG.md names, on committed code."""
    path = os.path.join(folder, 'PREREG.md')
    if not os.path.exists(path):
        raise Refused(f'a registered run needs {rel(path, LOOP)}')
    if git(['ls-files', '--error-unmatch', 'PREREG.md'], folder).returncode != 0:
        raise Refused('PREREG.md is not committed')
    if git(['status', '--porcelain', '--', 'PREREG.md'], folder).stdout.strip():
        raise Refused('PREREG.md differs from the committed version')
    with open(path) as f:
        reg = parse_prereg(f.read())
    if reg['candidate'] != sha:
        raise Refused(f'PREREG.md registers candidate {reg["candidate"][:12]}, not this file ({sha[:12]})')
    if rel(refs[0]) != reg['reference']:
        raise Refused(f'PREREG.md registers reference {reg["reference"]}, not {rel(refs[0])}')
    if reg['others'] != others:
        raise Refused(f'PREREG.md registers others: {reg["others"]}, not {others}')
    if reg['task'] != task:
        raise Refused(f'PREREG.md registers task {reg["task"]}, not {task}')
    if members is not None:
        raise Refused('a registered run is on all members: --members is refused')
    if git(['status', '--porcelain', '--', 'lab'], LOOP).stdout.strip():
        raise Refused('lab/ has uncommitted changes: a registered run needs committed code')
    top = git(['rev-parse', '--show-toplevel'], LOOP).stdout.strip()
    if not top or not inside(predictor, top):
        raise Refused('the candidate file is not in the repository')
    done = git(['show', f'HEAD:./{os.path.basename(predictor)}'], os.path.dirname(predictor), text=False)
    if done.returncode != 0 or hashlib.sha256(done.stdout).hexdigest() != sha:
        raise Refused('the candidate file is not committed with the registered hash')


def check_budget(ledger, item, mode):
    if mode not in BUDGET:
        return
    used = sum(1 for line in ledger if line.get('item') == item and line.get('mode') == mode)
    if used >= BUDGET[mode]:
        raise Refused(f'item {item} has used its {BUDGET[mode]} {mode} runs')


def check_files(predictor, refs, mode, control):
    """Where predictors may live. A file that runs without a budget (a reference in any mode, the predictor of a
    ladder or control run) is one of the files pinned in lab/pins.json, unchanged: a file dropped into lab/ladder/
    or a rung edited in place is refused until the pins, and with them the harness hash, change."""
    for p in [predictor] + refs:
        if not os.path.isfile(p):
            raise Refused(f'no predictor file {p}')
        if os.path.getsize(p) > PREDICTOR_BYTES:
            raise Refused(f'{rel(p)} is over {PREDICTOR_BYTES >> 10} KB: a predictor is code, not a table')
    for r in refs:
        if not pinned(r, LADDER):
            raise Refused(f'a reference is a rung of lab/ladder/, pinned in lab/pins.json and unchanged: '
                          f'{rel(r)} is not')
    if len(set(os.path.realpath(r) for r in refs)) != len(refs):
        raise Refused('each reference rung is named once')
    if mode == 'ladder' and not pinned(predictor, LADDER):
        raise Refused('mode ladder runs the pinned files of lab/ladder/ only (lab/pins.json); a candidate runs in '
                      'mode explore or registered')
    if mode == 'control':
        if control not in CONTROLS:
            raise Refused(f'unknown control {control!r}: the controls are {", ".join(CONTROLS)}')
        if not (pinned(predictor, LADDER) or pinned(predictor, CONTROL_PREDICTORS)):
            raise Refused('mode control runs the pinned predictors under lab/ladder/ or lab/controls/predictors/ '
                          'only (lab/pins.json)')
    elif control:
        raise Refused('--control names the control of a run in mode control, and only there')


# ------------------------------------------------------------------ running predictors

def _worker(predictor, sha, vids, run_dir, titles_path, log, tag, workers, each):
    """Start sandbox.py for one predictor and a list of views; read back what it left in its output folder and
    hand each view's result to `each(vid, result)` the moment it is read. Nothing of a view is kept after that."""
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
                                  pass_fds=(views_fd, out_fd), close_fds=True)
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
    namespaces = True
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
                r['answer'] = {'returned': 'error', 'error': f'the predictor process {why}'}
            r['attempts'] = []                         # what the audit hook noted, one JSON line per attempt
            try:
                with open(base + '.notes', 'rb') as f:
                    for row in f.read().decode('utf-8', 'replace').splitlines():
                        try:
                            note = json.loads(row)
                        except ValueError:
                            note = ['unreadable note', row[:100]]
                        r['attempts'].append(note if isinstance(note, list) else ['unreadable note', str(note)[:100]])
            except OSError:
                pass
            try:
                with open(base + '.log', 'rb') as f:
                    text = f.read(20000).decode('utf-8', 'replace')
                if text.strip():
                    lf.write(f'[view {vid}]\n{text}\n')
            except OSError:
                pass
            lf.flush()
            try:
                each(vid, r)
            except BaseException:
                shutil.rmtree(out_dir, ignore_errors=True)
                raise
    shutil.rmtree(out_dir, ignore_errors=True)
    return {'landlock': facts['landlock'], 'seccomp': facts['seccomp'], 'net_isolated': facts['net_isolated'],
            'namespaces': namespaces}


def run_predictor(predictor, index, keys, run_dir, titles_path, log, cache_file=None, cache_key=None, workers=2,
                  reduce=None, batch=None):
    """Answers of one predictor for the main views and, when it gives no score, for the calibration views.
    Returns {'main': {vid: {'rank','score','p_low'}}, 'cal': {...}, 'seconds', 'peak_mb', 'attempts', 'sandbox'}
    with lists in place of arrays. With `reduce` (T2a) a checked answer is replaced at once by
    reduce(vid, answer), which must hold `score` and `p_low` (None where the predictor gives none). `batch`: how
    many views one sandbox worker gets.

    Resuming (item 004, T2a and T2b only, and only where answers may be stored at all: explore, ladder and control
    runs). After every batch the answers so far are written beside the stored-answer file (`.part`), as long as the
    predictor has made no attempt the sandbox refused. A run that is stopped by its time limit leaves that file, and
    the next run of the same file on exactly the same views and answers (the same cache key) starts where it
    stopped. The ledger line says how many views were taken from it (`resumed`). Registered, gate and verify runs
    store nothing and so never resume."""
    sha = sha256_file(predictor)
    main = [v['vid'] for v in index if v['kind'] == 'main']
    cal = [v['vid'] for v in index if v['kind'] == 'cal']
    if cache_file and os.path.exists(cache_file):
        try:
            with open(cache_file) as f:
                got = json.load(f)
        except (OSError, ValueError):
            got = {}
        # stored answers are used only when they say they are this file's answers for exactly these views
        if got.get('sha256') == sha and got.get('views') == cache_key and set(got.get('main', ())) == set(main) \
                and set(got.get('cal', ())) <= set(cal):
            got['cached'] = True
            return got
        os.remove(cache_file)
    start = time.time()
    out = {'main': {}, 'cal': {}, 'attempts': [], 'peak_mb': 0.0, 'sandbox': {}, 'cached': False, 'sha256': sha,
           'views': cache_key, 'resumed': 0}
    part_file = cache_file + '.part' if cache_file and reduce else None
    if part_file and os.path.exists(part_file):
        try:
            with open(part_file) as f:
                part = json.load(f)
        except (OSError, ValueError):
            part = {}
        if part.get('sha256') == sha and part.get('views') == cache_key and set(part.get('main', ())) <= set(main):
            out['main'].update(part['main'])
            out['sandbox'], out['peak_mb'] = part.get('sandbox', {}), part.get('peak_mb', 0.0)
            out['resumed'] = len(part['main'])

    def save_part():
        if part_file and out.get('n_attempts', 0) == 0:
            os.makedirs(os.path.dirname(part_file), exist_ok=True)
            tmp = part_file + f'.tmp{os.getpid()}'
            with open(tmp, 'w') as f:
                json.dump({'sha256': sha, 'views': cache_key, 'main': out['main'], 'sandbox': out['sandbox'],
                           'peak_mb': out['peak_mb']}, f)
            os.replace(tmp, part_file)

    def take(vids, tag, into):
        def each(vid, r):
            out['peak_mb'] = max(out['peak_mb'], r['peak_mb'])
            for a in r['attempts']:
                if len(out['attempts']) < 50:
                    out['attempts'].append(a)
            out['n_attempts'] = out.get('n_attempts', 0) + len(r['attempts'])
            try:
                ok = score.check_answer(r['answer'], views.n_targets(keys[vid]))
            except score.ContractError as e:
                with open(log, 'a') as lf:
                    lf.write(f'contract failure in view {vid}: {e}\n{r["answer"].get("trace", "")}\n')
                raise Failed(f'{rel(predictor)}: {e}') from None
            into[vid] = reduce(vid, ok) if reduce else {k: (None if a is None else a.tolist()) for k, a in ok.items()}

        vids = [v for v in vids if v not in into]       # views a stopped run of this file already answered
        step = batch or max(len(vids), 1)
        for a in range(0, len(vids), step):
            raw = _worker(predictor, sha, vids[a:a + step], run_dir, titles_path, log, tag, workers, each)
            out['sandbox'] = {k: bool(raw[k] and out['sandbox'].get(k, True))
                              for k in ('landlock', 'seccomp', 'net_isolated', 'namespaces')}
            if into is out['main']:
                save_part()

    take(main, 'main', out['main'])
    for name in ('score', 'p_low'):
        given = {out['main'][v][name] is None for v in main}
        if len(given) > 1:
            raise Failed(f'{rel(predictor)}: {name} is given for some views and None for others')
    if main and out['main'][main[0]]['score'] is None and cal:
        take(cal, 'cal', out['cal'])
        if any(out['cal'][v]['score'] is not None for v in cal):
            raise Failed(f'{rel(predictor)}: score is given for some views and None for others')
    out.setdefault('n_attempts', 0)
    out['seconds'] = round(time.time() - start, 2)
    if cache_file and out['n_attempts'] == 0:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        tmp = cache_file + f'.tmp{os.getpid()}'
        with open(tmp, 'w') as f:
            json.dump(out, f)
        os.replace(tmp, cache_file)
    if part_file and os.path.exists(part_file):
        os.remove(part_file)
    return out


def is_calibrated(answers):
    """Does this predictor give no score, so that the harness calibrates one?"""
    return any(a['score'] is None for a in answers['main'].values())


def final_predictions(answers, index, keys, permute=None):
    """{'pred', 'rank', 'p_low'} aligned with the target table (main views in index order). With `permute` (a
    random generator) the ranks of a rank-only predictor are permuted within every view before they are
    calibrated: the calibrator floor."""
    cal_of = {}
    for v in index:
        if v['kind'] == 'cal':
            cal_of.setdefault(v['parent'], []).append(v['vid'])
    mix = (lambda x: x if permute is None else permute.permutation(x))
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
            s = score.calibrated(mix(r), [mix(np.array(answers['cal'][c]['rank'], float)) for c in cals],
                                 [keys[c]['score'] for c in cals], keys[v['vid']]['history_score'])
        pred.append(score.to_rating(s))
        rank.append(r)
        p_low.append(None if a['p_low'] is None else np.array(a['p_low'], float))
    cat = (lambda x: np.concatenate(x) if x else np.zeros(0))
    return {'pred': cat(pred).astype(np.int64), 'rank': cat(rank),
            'p_low': None if not p_low or p_low[0] is None else cat(p_low)}


def calibrator_floor(answers, index, keys, table, candidate, owner):
    """The floor of a rank-only candidate: see score.floor_measures."""
    y = table['y']
    err = np.zeros(len(y))
    for k in range(score.FLOOR_PERMUTATIONS):
        rng = np.random.default_rng([SEED, 7, k])
        err += np.abs(final_predictions(answers, index, keys, permute=rng)['pred'] - y)
    b0 = np.concatenate([np.full(len(keys[v['vid']]['score']),
                                 score.to_rating(np.median(keys[v['vid']]['history_score'])))
                         for v in index if v['kind'] == 'main'])
    return score.floor_measures(table, candidate, err / score.FLOOR_PERMUTATIONS, b0, owner, DRAWS, SEED)


def target_table(pack, index, keys):
    cols = {c: [] for c in ('member', 'view', 'y', 'sitting', 'same_sitting', 'block', 'media', 'provenance',
                            'has_fingerprint', 'old_title', 'label_edited', 'franchise', 'low_share')}
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
        cols['label_edited'].append(key['edited'])
        for c in ('sitting', 'same_sitting', 'media', 'provenance', 'has_fingerprint', 'old_title', 'franchise'):
            cols[c].append(key[c])
        k += 1
    table = {c: (np.concatenate(v) if v else np.zeros(0, np.int64)) for c, v in cols.items()}
    for c in ('same_sitting', 'has_fingerprint', 'old_title', 'label_edited'):
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


def measure_t1(pack, index, keys, answers, predictor, refs, names, owner, plant, line):
    """T1: fills line['calibrated'], line['measures'] and the counts in line['views']; returns one row per member
    for result.json."""
    sha = sha256_file(predictor)
    # which of the predictors give no score, so that the harness calibrates one
    line['calibrated'] = sorted({names[p] for p in [predictor] + refs if is_calibrated(answers[sha256_file(p)])})
    table = target_table(pack, index, keys)
    cand = final_predictions(answers[sha], index, keys)
    if plant is not None:
        cand['pred'] = plant_signal(cand['pred'], table, plant, SEED)
    ref_preds = {names[r]: final_predictions(answers[sha256_file(r)], index, keys) for r in refs}
    line['measures'] = score.t1_measures(table, cand, ref_preds, owner, DRAWS, SEED)
    if names[predictor] in line['calibrated']:
        line['measures']['calibrator_floor'] = calibrator_floor(answers[sha], index, keys, table, cand, owner)
    line['views'].update(members=int(len(np.unique(table['member']))), targets=int(len(table['y'])))
    cv = score.member_values(table, cand)
    rvs = {name: score.member_values(table, rp)['mae'] for name, rp in ref_preds.items()}
    per = []
    for u in np.flatnonzero(cv['targets'] > 0).tolist():
        row = {'member': pack.members['hash'][u], 'targets': int(cv['targets'][u]), 'mae': float(cv['mae'][u])}
        for name, rm in rvs.items():
            row[f'mae:{name}'] = float(rm[u])
        per.append(row)
    return per


T2A_PER_MEMBER = ('n_high', 'n_mid', 'n_low', 'pct_high', 'pct_mid', 'pct_low', 'separation', 'separation_matched',
                  'pct_min', 'pct_max', 'pct_lists', 'first50_high', 'first200_high', 'first50_low', 'first200_low',
                  'mae')


def measure_t2a(pack, index, keys, facts, answers, predictor, refs, names, owner, line):
    """T2a: fills line['calibrated'] (always empty: T2a has no calibrator), line['measures'] and the counts in
    line['views']; returns one row per member for result.json."""
    line['calibrated'] = []
    table = score.t2a_table(index, keys, facts, len(pack.members['tier']))
    cand = score.t2a_collect(answers[sha256_file(predictor)], index)
    ref_preds = {names[r]: score.t2a_collect(answers[sha256_file(r)], index) for r in refs}
    line['measures'] = score.t2a_measures(table, cand, ref_preds, owner, DRAWS, SEED)
    line['views'].update(members=int(len(np.unique(table['member']))), targets=int(len(table['y'])),
                         targets_listed=int(sum(views.n_targets(keys[v['vid']]) for v in index)))
    cv = score.t2a_member_values(table, cand)
    rvs = {name: score.t2a_member_values(table, rp) for name, rp in ref_preds.items()}
    num = (lambda x: float(x) if np.isfinite(x) else None)
    per = []
    for u in np.flatnonzero(cv['hidden'] > 0).tolist():
        row = {'member': pack.members['hash'][u], 'owner': u == owner, 'hidden': int(cv['hidden'][u]),
               'outside': int(table['n_outside'][u])}
        row.update({name: num(cv[name][u]) for name in T2A_PER_MEMBER if name in cv})
        for name, r in rvs.items():
            row[f'separation:{name}'] = num(r['separation'][u])
            if 'mae' in r:
                row[f'mae:{name}'] = num(r['mae'][u])
        per.append(row)
    return per


T2B_PER_MEMBER = ('pct', 'first50', 'first200', 'pct_matched', 'pct_popular', 'pct_both', 'later_pct', 'auc',
                  'pct_min', 'pct_max', 'touched_first50', 'touched_listed')


def measure_t2b(pack, index, keys, facts, answers, predictor, refs, names, owner, line):
    """T2b: fills line['calibrated'] (always empty), line['measures'] and the counts in line['views']; returns one
    row per member for result.json."""
    line['calibrated'] = []
    table = score.t2b_table(index, keys, facts, len(pack.members['tier']))
    cand = score.t2b_collect(answers[sha256_file(predictor)], index)
    ref_preds = {names[r]: score.t2b_collect(answers[sha256_file(r)], index) for r in refs}
    line['measures'] = score.t2b_measures(table, cand, ref_preds, owner, DRAWS, SEED)
    line['views'].update(members=int(len(np.unique(table['member']))), targets=int(len(table['member'])),
                         targets_listed=int(sum(views.n_targets(keys[v['vid']]) for v in index)))
    cv = score.t2b_member_values(table, cand)
    rvs = {name: score.t2b_member_values(table, rp) for name, rp in ref_preds.items()}
    num = (lambda x: float(x) if np.isfinite(x) else None)
    per = []
    for u in np.flatnonzero(cv['targets'] > 0).tolist():
        row = {'member': pack.members['hash'][u], 'owner': u == owner, 'targets': int(cv['targets'][u]),
               'outside': int(table['n_outside'][u]), 'touched': int(table['n_touched'][u])}
        row.update({name: num(cv[name][u]) for name in T2B_PER_MEMBER})
        for name, r in rvs.items():
            row[f'pct:{name}'] = num(r['pct'][u])
        per.append(row)
    return per


# ------------------------------------------------------------------ one run

def execute(predictor, refs=None, *, item, mode, task='T1', tier='A', members=None, others=None,
            shuffle_seed=None, plant=None, control=None, use_cache=True, keep=False, quiet=False,
            verify_of=None, gate=None, split=None, fold_check=False):
    """Run one predictor against its references. Returns the ledger line (also when the run failed).

    verify_of   mode verify only (verify.py): the ledger line that is run again; the run must be that line's.
    gate        mode gate only (gate.py): {'own': the tier B ratings, 'folder': the gate's results folder, 'work':
                the gate's work folder, 'look': the look gate.py has just written}. A tier B run writes its log
                under that results folder and nothing else.
    others      None: the task's default (T2b: before; otherwise all).
    split       T2b only: sitting (None) or order.
    fold_check  T2a only (item 004): folds of at most 5 titles, members other than the owner with fewer than 60
                ratings.
    """
    started = time.time()
    if task not in TASKS:
        raise Refused(f'task {task} is not built yet')
    others = others or DEFAULT_OTHERS[task]
    if task == 'T2b':
        split = split or 'sitting'
        if split not in views.SPLITS:
            raise Refused(f'unknown --split {split}')
    elif split is not None:
        raise Refused('--split is an option of task T2b')
    if fold_check and task != 'T2a':
        raise Refused('--fold-check is an option of task T2a')
    if mode not in MODES:
        raise Refused(f'unknown mode {mode}')
    if others not in OTHERS:
        raise Refused(f'unknown --others {others}')
    pack = the_pack()
    root = os.path.dirname(os.path.dirname(pack.folder))
    missing = under_run_sh(root)
    if missing:
        raise Refused(f'use run.sh: it holds the lock slot and sets the thread, time and memory limits ({missing})')
    try:
        ledger = checked_ledger(LEDGER)
    except ValueError as e:
        raise Refused(str(e)) from None
    if tier not in ('A', 'B') or (tier == 'B') != (mode == 'gate') or (mode == 'gate') != (gate is not None):
        raise Refused('tier B is read by gate.py only')
    if (mode == 'verify') != (verify_of is not None):
        raise Refused('mode verify is entered through verify.py only')
    if (plant is not None or shuffle_seed is not None) and mode not in ('control', 'verify'):
        raise Refused('shuffled labels and planted effects are controls')
    if task == 'T2a':
        if tier != 'A':
            raise Refused('the gate knows task T1 only')
        if others == 'before':
            raise Refused('T2a has no moment in time: --others is all or no-owner')
        if plant is not None:
            raise Refused('the planted effect is a control of task T1')
    if task == 'T2b':
        if tier != 'A':
            raise Refused('T2b has no gate')
        if plant is not None:
            raise Refused('the planted effect is a control of task T1')
    folder = item_folder(item)
    predictor = os.path.abspath(predictor)
    refs = [os.path.abspath(r) for r in (refs or [DEFAULT_REF[task]])]
    if mode == 'verify':                                # the files may live where the verified run's mode lets them
        check_files(predictor, refs, verify_of.get('mode'), verify_of.get('control'))
    else:
        check_files(predictor, refs, mode, control)
    sha = sha256_file(predictor)
    names = {p: rel(p) for p in [predictor] + refs}
    options = {'others': others, 'members': 'all' if members is None else sorted(members),
               'shuffle_seed': shuffle_seed, 'plant': plant}
    if task == 'T2b':
        options['split'] = split
    if fold_check:
        options['fold_check'] = True
    if mode == 'registered':
        check_prereg(folder, predictor, sha, refs, others, task, members)
    if mode == 'verify':
        same = (verify_of.get('predictor') == {'path': names[predictor], 'sha256': sha}
                and [(r['path'], r['sha256']) for r in verify_of.get('refs', [])] ==
                [(names[r], sha256_file(r)) for r in refs]
                and verify_of.get('options') == options and verify_of.get('item') == item
                and verify_of.get('task') == task and verify_of in ledger)
        if not same:
            raise Refused('a verify run repeats a ledgered run: same files, same options')
    if mode == 'gate':
        looks = checked_looks(gate['folder'])
        if not looks or looks[-1] != gate['look'] or looks[-1].get('item') != item:
            raise Refused('a gate run needs its look written first')
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
    work = gate['work'] if tier == 'B' else os.path.join(root, 'work')
    run_dir = os.path.join(work, 'runs', run_id)
    keys_path = os.path.join(work, 'keys', f'{run_id}.bin')
    results_dir = os.path.join(gate['folder'], 'logs', run_id) if tier == 'B' else os.path.join(root, 'results', run_id)
    os.makedirs(run_dir, mode=0o700)
    os.makedirs(results_dir, mode=0o700)
    log = os.path.join(results_dir, 'log.txt')
    harness = harness_sha256()
    commit = git(['rev-parse', 'HEAD'], LOOP).stdout.strip() or None
    dirty = bool(git(['status', '--porcelain', '--', '.'], LAB).stdout.strip())
    line = {'run_id': run_id, 'time': f'{stamp:%Y-%m-%dT%H:%M:%SZ}', 'item': item, 'mode': mode, 'task': task,
            'tier': tier, 'git_commit': commit, 'lab_uncommitted': dirty, 'harness_sha256': harness,
            'pack': os.path.basename(pack.folder), 'pack_sha256': pack.manifest['files_sha256']['pack.pkl'],
            'titles_sha256': pack.manifest['files_sha256']['titles.pkl'],
            'predictor': {'path': names[predictor], 'sha256': sha},
            'refs': [{'path': names[r], 'sha256': sha256_file(r)} for r in refs],
            'primary_ref': names[refs[0]], 'options': options,
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

        reduce = None
        if task == 'T2a':
            index, keys, digest = views.build_t2a(pack, run_dir, members=rows, others_mode=others,
                                                  shuffle_seed=shuffle_seed, fold_check=fold_check)
            facts = views.title_facts(pack)

            def reduce(vid, answer):                    # the view's own target list, read back from its file
                targets = views.load_arrays(os.path.join(run_dir, 'views', vid, 'view.bin'))['targets.title']
                return score.t2a_view(answer, keys[vid], targets, facts)
        elif task == 'T2b':
            index, keys, digest = views.build_t2b(pack, run_dir, members=rows, others_mode=others, split=split,
                                                  shuffle_seed=shuffle_seed)
            facts = views.title_facts(pack)

            def reduce(vid, answer):
                targets = views.load_arrays(os.path.join(run_dir, 'views', vid, 'view.bin'))['targets.title']
                return score.t2b_view(answer, keys[vid], targets, facts)
        else:
            index, keys, digest = views.build_t1(pack, run_dir, own=gate['own'] if gate else None, members=rows,
                                                 others_mode=others, shuffle_seed=shuffle_seed)
        views.write_keys(keys_path, index, keys)
        main = [v for v in index if v['kind'] == 'main']
        if not main:
            raise Failed('no member has a target')
        line['views'] = {'digest': digest, 'titles_digest': titles_digest, 'main': len(main),
                         'calibration': len(index) - len(main)}
        # stored answers are reduced with the answers (T2a, T2b), so they belong to the views and the answers: the
        # T2b shuffled control has the real views and other targets
        answers_digest = views.sha256_arrays({f'{v["vid"]}.{c}': a for v in index for c, a in keys[v['vid']].items()})
        cache_key = hashlib.sha256(f'{digest}|{titles_digest}|{harness}|{answers_digest}'.encode()).hexdigest()[:32]
        cache_dir = os.path.join(work, 'cache', cache_key)

        answers, seconds, peak, attempts, sandbox = {}, {}, 0.0, 0, {}
        strict = mode in ('registered', 'gate')
        workers = 1 if mode in ('registered', 'gate', 'verify') else 2      # runs that count: one view at a time
        for p in [predictor] + refs:
            p_sha = sha256_file(p)
            if p_sha in answers:
                continue
            cache_file = os.path.join(cache_dir, f'{p_sha}.json') \
                if use_cache and mode in ('explore', 'ladder', 'control') else None
            if p == predictor and cache_file:           # the candidate itself always runs; its answers are stored
                if os.path.exists(cache_file):
                    os.remove(cache_file)
            got = run_predictor(p, index, keys, run_dir, titles_path, log, cache_file, cache_key, workers,
                                reduce, VIEWS_PER_WORKER.get(task))
            if strict and not all(got['sandbox'].get(k) for k in FULL_SANDBOX):
                raise Failed(f'a {mode} run needs the full sandbox; this machine gave {got["sandbox"]}')
            answers[p_sha] = got
            if got.get('resumed') and not got.get('cached'):
                line.setdefault('resumed', {})[names[p]] = got['resumed']
            seconds[names[p]] = got['seconds']
            peak = max(peak, got['peak_mb'])
            if p == predictor:
                attempts, sandbox = got['n_attempts'], got['sandbox']
                line['sandbox'] = {**sandbox, 'attempts': attempts, 'examples': got['attempts'][:8]}
        for r in line['refs']:
            r['cached'] = bool(answers[r['sha256']].get('cached'))
        owner = pack.owner if tier == 'A' else None
        if task == 'T2a':
            per = measure_t2a(pack, index, keys, facts, answers, predictor, refs, names, owner, line)
        elif task == 'T2b':
            per = measure_t2b(pack, index, keys, facts, answers, predictor, refs, names, owner, line)
        else:
            per = measure_t1(pack, index, keys, answers, predictor, refs, names, owner, plant, line)
        line['status'] = 'ok' if attempts == 0 else 'attempts'
        line['predictor_seconds'] = seconds
        line['peak_mb'] = round(max(peak, resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024), 1)
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
    if tier == 'A':                                     # nothing of tier B is written here: gate.py writes one line
        with open(os.path.join(results_dir, 'result.json'), 'w') as f:
            json.dump(result, f, indent=1)
    if mode in ('explore', 'registered', 'ladder', 'control'):
        append_ledger(LEDGER, line)
    if not quiet:
        print(summary(line))
        print(f'result and log: {results_dir}')
    return line


def checked_looks(folder):
    """The gate's looks of this pack, oldest first."""
    path = os.path.join(folder, 'looks.jsonl')
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(x) for x in f if x.strip()]


def _ci(d, key='diff'):
    if d.get(key) is None:
        return 'n/a'
    if d.get('lo') is None:
        return f'{d[key]:+.3f}' + (f' (no interval: {d["why"]})' if d.get('why') else '')
    return f'{d[key]:+.3f} ({d["lo"]:+.3f} to {d["hi"]:+.3f})'


def _summary_t2a(m, num):
    o = m['others']
    val = (lambda d, k: num((d.get(k) or {}).get('value')))
    out = [f'  others: {o["n_members"]} members, {o["n_hidden"]} hidden titles; {o["n_primary"]} members with '
           f'{m["band_min"]}+ titles in both bands',
           f'    percentile of titles rated 8+ {val(o, "pct_high")}, 6 to 7 {val(o, "pct_mid")}, 5 or less '
           f'{val(o, "pct_low")}; separation {_ci(o["separation"], "value")}; among equally well-rated '
           f'{_ci(o["separation_matched"], "value")}']
    for ref, d in o['vs'].items():
        v = d['separation']
        out.append(f'    against {ref}: separation {_ci(v)}, smallest detectable {v.get("sde")}, '
                   f'{v.get("improved")} of {v["n"]} members improved; among equally well-rated '
                   f'{_ci(d["separation_matched"])}')
    if 'owner' in m:
        w = m['owner']
        out.append(f'  owner: {w["n_hidden"]} hidden titles; percentile of titles rated 8+ {val(w, "pct_high")}, '
                   f'6 to 7 {val(w, "pct_mid")}, 5 or less {val(w, "pct_low")}; separation '
                   f'{val(w, "separation")}; among equally well-rated {val(w, "separation_matched")}')
        for ref, d in w['vs'].items():
            out.append(f'    against {ref}: separation {_ci(d["separation"], "value")}; franchises drawn again: '
                       f'{_ci(d["separation_franchise"], "value")}')
    return out


def _summary_t2b(m, num):
    o = m['others']
    val = (lambda d, k: num((d.get(k) or {}).get('value')))
    out = [f'  others: {o["n_members"]} members, {o["n_targets"]} targets; percentile {_ci(o["pct"], "value")}; '
           f'first 50 {val(o, "first50")}, first 200 {val(o, "first200")}; among equally popular '
           f'{_ci(o["pct_popular"], "value")}; later skips {val(o, "later_pct")}; touched in the list '
           f'{o["touched_listed"]}']
    for ref, d in o['vs'].items():
        out.append(f'    against {ref}: percentile {_ci(d["pct"])}, smallest detectable {d["pct"].get("sde")}, '
                   f'{d["pct"].get("improved")} of {d["pct"]["n"]} members improved')
    if 'owner' in m:
        w = m['owner']
        out.append(f'  owner: {w["n_targets"]} targets; percentile {val(w, "pct")}; among equally popular '
                   f'{val(w, "pct_popular")}; touched in the list {w["touched_listed"]}')
        for ref, d in w['vs'].items():
            out.append(f'    against {ref}: percentile {_ci(d["pct"], "value")}; franchises drawn again: '
                       f'{_ci(d["pct_franchise"], "value")}')
    return out


def summary(line):
    out = [f'run {line["run_id"]}  {line["predictor"]["path"]}  {line["task"]} tier {line["tier"]} '
           f'{line["mode"]}  status {line["status"]}  {line["seconds"]} s']
    if line['status'] == 'failed':
        return out[0] + f'\n  {line["error"]}'
    m = line['measures']
    o = m['others']
    num = (lambda x: 'n/a' if x is None else f'{x:.3f}')
    if line['task'] == 'T2a':
        return '\n'.join(out + _summary_t2a(m, num))
    if line['task'] == 'T2b':
        return '\n'.join(out + _summary_t2b(m, num))
    out.append(f'  others: {o["n_members"]} members with {m["min_targets"]}+ targets, error {num(o["mae"]["value"])}, '
               f'pair accuracy {num(o["pair_acc"]["value"])}')
    for ref, d in o['vs'].items():
        v = d['mae']
        out.append(f'    against {ref}: {_ci(v)}, smallest detectable {v.get("sde")}, '
                   f'{v.get("improved")} of {v["n"]} members improved; pair accuracy {_ci(d.get("pair_acc", {}))}')
    if 'calibrator_floor' in m:
        c = m['calibrator_floor']['others']
        out.append(f'  calibrator floor (ranks permuted within each view): against B0 {_ci(c["vs_b0"])}; '
                   f'the rung against its floor {_ci(c["rung_vs_floor"])}')
    if 'owner' in m:
        w = m['owner']
        out.append(f'  owner: {w["n_targets"]} targets, error {num(w["mae"]["value"])}')
        for ref, d in w['vs'].items():
            out.append(f'    against {ref}: {_ci(d["mae"])}; franchises drawn again: {_ci(d["mae_franchise"])}')
    if line.get('sandbox', {}).get('attempts'):
        out.append(f'  the predictor tried {line["sandbox"]["attempts"]} things the sandbox refused: '
                   f'{line["sandbox"]["examples"][:3]}')
    return '\n'.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Run one predictor through the harness. Use run.sh.')
    ap.add_argument('predictor')
    ap.add_argument('--task', default='T1', choices=list(TASKS))
    ap.add_argument('--tier', default='A')
    ap.add_argument('--mode', required=True, choices=['explore', 'registered', 'ladder', 'control'])
    ap.add_argument('--item', required=True)
    ap.add_argument('--ref', action='append')
    ap.add_argument('--members')
    ap.add_argument('--others', choices=list(OTHERS), help='default: before in T2b, all otherwise')
    ap.add_argument('--split', choices=['sitting', 'order'], help='T2b only; default sitting')
    ap.add_argument('--fold-check', action='store_true', help='T2a only: folds of 5, members under 60 ratings')
    ap.add_argument('--no-cache', action='store_true')
    ap.add_argument('--control', help='the name of the control (mode control only)')
    ap.add_argument('--shuffle-seed', type=int)
    ap.add_argument('--plant', type=float)
    ap.add_argument('--keep', action='store_true', help='keep the run folder with the views')
    a = ap.parse_args(argv)
    if a.tier != 'A':
        sys.exit('refused: tier B is read by gate.py only')
    try:
        line = execute(a.predictor, a.ref, item=a.item, mode=a.mode, task=a.task, tier=a.tier,
                       members=a.members.split(',') if a.members else None, others=a.others,
                       shuffle_seed=a.shuffle_seed, plant=a.plant, control=a.control, use_cache=not a.no_cache,
                       keep=a.keep, split=a.split, fold_check=a.fold_check)
    except Refused as e:
        sys.exit(f'refused: {e}')
    sys.exit(0 if line['status'] in ('ok', 'attempts') else 2)


if __name__ == '__main__':
    main()
