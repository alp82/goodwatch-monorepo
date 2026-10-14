"""The gate: one look at tier B for an item's registered comparison. Run by the orchestrator only.

    lab/run.sh --gate <item>

It takes the item's latest finished registered run from the ledger and runs exactly that comparison again on the
tier B members: the same candidate file, the same primary reference, the same task and the same `others` option,
with the same harness code on the same pack. Their ratings are read from the gate file named in the pack's
manifest; the population they are predicted from is tier A. A registered line it cannot replay that way (other
harness code, another pack, a file that changed, a member list, a shuffled or planted run) is refused, and no look
is used.

The look is written to looks.jsonl before anything is computed, so a run that fails, or is made to fail, has used
it. One look per item, 8 looks per pack; a further look is refused.

It prints one of `replicated`, `not replicated` or `not finished`, and the number of looks used. `replicated`
means for T1: the tier A effect is an improvement (the candidate's error is below the reference's), tier B shows the same
sign, and at least half the size. Of tier B, one summary line is written (the two effects and the verdict, to
<data root>/gate/results/<pack>/summary.jsonl) and the run's log. No result per member, per measure or per
stratum is written anywhere, printed, or put into the ledger. T2a uses A1: positive paired separation,
same sign and at least half the tier A effect, and paired popularity-matched disliked percentile below +0.03;
each check needs at least 10 tier B members. T2a prints only replicated / not replicated and looks used,
including when replay fails. Its paired guard estimate and coverage stay in the private summary.
"""
import argparse
import contextlib
import datetime
import json
import os
import pickle
import sys

from common import LAB, LOOP, append_ledger, harness_sha256, sha256_file

LOOKS = 8


def replicated(effect_a, effect_b):
    """Tier A improved, tier B has the same sign and at least half the size."""
    return bool(effect_a is not None and effect_b is not None and effect_a < 0 and effect_b < 0
                and abs(effect_b) >= 0.5 * abs(effect_a))


def replicated_t2a(effect_a, separation, guard):
    """A1: positive separation replicates, with enough paired members for both checks."""
    effect_b, harm = separation.get('diff'), guard.get('diff')
    return bool(effect_a is not None and effect_a > 0 and effect_b is not None and effect_b > 0
                and effect_b >= 0.5 * effect_a and separation.get('n', 0) >= 10
                and guard.get('n', 0) >= 10 and harm is not None and harm < 0.03)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('item')
    a = ap.parse_args()
    import run
    try:
        pack = run.the_pack()
        root = os.path.dirname(os.path.dirname(pack.folder))
        missing = run.under_run_sh(root)
        if missing:
            sys.exit(f'refused: start the gate with lab/run.sh --gate {a.item} ({missing})')
        ledger = run.checked_ledger(run.LEDGER)
        run.item_folder(a.item)
    except (run.Refused, ValueError) as e:
        sys.exit(f'refused: {e}')
    name = os.path.basename(pack.folder)
    registered = [x for x in ledger if x.get('item') == a.item and x.get('mode') == 'registered'
                  and x.get('status') == 'ok' and x.get('tier') == 'A']
    if not registered:
        sys.exit(f'refused: item {a.item} has no finished registered run')
    old = registered[-1]
    ref = old['primary_ref']
    o = old.get('options', {})
    problems = []
    if old.get('pack_sha256') != pack.manifest['files_sha256']['pack.pkl'] or \
            old.get('titles_sha256') != pack.manifest['files_sha256']['titles.pkl']:
        problems.append('it ran on another pack')
    if old.get('harness_sha256') != harness_sha256():
        problems.append('it ran with other harness code')
    if o.get('members') != 'all' or o.get('shuffle_seed') is not None or o.get('plant') is not None:
        problems.append('it is not a run on all members with the true labels')
    task = old.get('task')
    allowed_others = run.OTHERS if task == 'T1' else ('all', 'no-owner')
    if o.get('others') not in allowed_others or task not in ('T1', 'T2a'):
        problems.append('its task or its others option is not one the gate knows')
    if any(k not in ('others', 'members', 'shuffle_seed', 'plant') for k in o):
        problems.append('it has options the gate cannot replay')
    if not any(r['path'] == ref for r in old['refs']):
        problems.append('its primary reference file is missing')
    paths = {}
    for p in [old['predictor']] + [r for r in old['refs'] if r['path'] == ref]:
        full = p['path'] if os.path.isabs(p['path']) else os.path.join(LAB, p['path'])
        paths[p['path']] = full
        if not os.path.isfile(full) or sha256_file(full) != p['sha256']:
            problems.append(f'{p["path"]} is not the file the registered run used')
    effect_a = old.get('measures', {}).get('others', {}).get('vs', {}).get(ref, {}).get('separation' if task == 'T2a' else 'mae', {}).get('diff')
    if effect_a is None:
        problems.append('it holds no tier A effect against its primary reference')
    if problems:
        sys.exit(f'refused: the registered run {old["run_id"]} cannot be replayed: ' + '; '.join(problems))

    gate_folder = pack.manifest['gate_folder']
    if gate_folder.startswith('~/'):
        gate_folder = os.path.join(root, 'gate', os.path.basename(gate_folder))
    out_dir = os.path.join(os.path.dirname(gate_folder), 'results', name)
    os.makedirs(out_dir, mode=0o700, exist_ok=True)
    looks_path = os.path.join(out_dir, 'looks.jsonl')
    looks = run.checked_looks(out_dir)
    if any(x['item'] == a.item for x in looks):
        sys.exit(f'refused: item {a.item} has had its look')
    if len(looks) >= LOOKS:
        sys.exit(f'refused: all {LOOKS} looks of pack {name} are used')

    gate_file = os.path.join(gate_folder, 'gate.pkl')
    if sha256_file(gate_file) != pack.manifest['gate_sha256']['gate.pkl']:
        sys.exit('refused: the gate file is not the one in the manifest')
    now = (lambda: f'{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}')
    look = {'item': a.item, 'time': now(), 'registered_run': old['run_id']}
    append_ledger(looks_path, look)                    # the look is used from here on, whatever happens next
    used = len(looks) + 1
    summary = {'item': a.item, 'time': look['time'], 'registered_run': old['run_id'], 'task': old['task'],
               'reference': ref, 'others': o['others'], 'harness_sha256': old['harness_sha256'],
               'tier_a_effect': effect_a, 'tier_b_effect': None, 'verdict': 'not finished'}
    try:
        with contextlib.ExitStack() as output:
            if task == 'T2a':
                # Even an unexpected harness diagnostic must stay in the private results folder.
                log = output.enter_context(open(os.path.join(out_dir, f'replay-{old["run_id"]}.log'), 'a'))
                output.enter_context(contextlib.redirect_stdout(log))
                output.enter_context(contextlib.redirect_stderr(log))
            with open(gate_file, 'rb') as f:
                own = pickle.load(f)['ratings']
            new = run.execute(paths[old['predictor']['path']], [paths[ref]], item=a.item, mode='gate', tier='B',
                              task=task, others=o['others'],
                              use_cache=False, quiet=True,
                              gate={'own': own, 'folder': out_dir, 'work': os.path.join(os.path.dirname(gate_folder),
                                                                                       'work'), 'look': look, 'registered': old})
        summary.update(gate_run=new['run_id'], status=new['status'])
        if new['status'] == 'ok':
            m = new['measures']['others']
            paired = m['vs'][ref]
            primary = paired['separation' if task == 'T2a' else 'mae']
            summary.update(tier_b_effect=primary['diff'],
                           tier_b_members=primary['n'] if task == 'T2a' else m['n_members'],
                           views_digest=new['views']['digest'])
            if task == 'T2a':
                guard = paired['pct_popular_low']
                summary.update(tier_b_guard1=guard['diff'], tier_b_guard1_members=guard['n'])
                passed = replicated_t2a(effect_a, primary, guard)
            else:
                passed = replicated(effect_a, summary['tier_b_effect'])
            summary['verdict'] = 'replicated' if passed else 'not replicated'
        del new
    except Exception as e:
        if task != 'T2a' and not isinstance(e, run.Refused):
            raise
        summary['error'] = f'{type(e).__name__}: {e}'
    if task == 'T2a' and summary['verdict'] == 'not finished':
        summary['verdict'] = 'not replicated'
    append_ledger(os.path.join(out_dir, 'summary.jsonl'), summary)
    os.chmod(os.path.join(out_dir, 'summary.jsonl'), 0o600)
    append_ledger(run.LEDGER, {'mode': 'gate', 'item': a.item, 'time': now(), 'of': old['run_id'],
                               'verdict': summary['verdict'], 'looks_used': used, 'looks_allowed': LOOKS,
                               'pack': name})
    print(summary['verdict'] if summary['verdict'] != 'not finished'
          else 'not finished: the gate run did not finish, and the look is used (the log is in the gate results folder)')
    print(f'looks used: {used} of {LOOKS}')
    # A T2a replay that failed prints the same two words, but exits 2 so the orchestrator reads the private log.
    failed = summary.get('error') or summary.get('status') != 'ok'
    sys.exit(2 if summary['verdict'] == 'not finished' or (task == 'T2a' and failed) else 0)


if __name__ == '__main__':
    main()
