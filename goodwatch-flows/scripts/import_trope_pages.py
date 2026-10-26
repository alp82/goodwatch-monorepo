#!/usr/bin/env python3
"""Plan/apply reviewed URI pages and observed references; no TV Tropes requests. Apply requires fresh receipts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from import_trope_catalog import Crate, settings
from f.tvtropes_catalog.pages import import_document, normalize_document


def atomic(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.' + path.name, mode='w', delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(value, handle, ensure_ascii=False, sort_keys=True, indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    os.replace(temporary, path)


class Receipts:
    def __init__(self, directory, expected_plan=None):
        self.directory = Path(directory); self.expected_plan = expected_plan; self.batch = 0
    def __call__(self, event):
        phase = event['phase']
        if phase == 'planned':
            atomic(self.directory / 'plan.json', event)
            if self.expected_plan and event['report']['plan_sha256'] != self.expected_plan:
                raise ValueError('Current write plan differs from the reviewed plan; no writes attempted')
        elif phase == 'verified_batch':
            atomic(self.directory / 'readback' / f'{self.batch:05}.json', event); self.batch += 1
        elif phase == 'acknowledged':
            atomic(self.directory / 'acknowledgements' / f"{event['index']:06}.json", event)
        elif phase == 'complete':
            atomic(self.directory / 'complete.json', event['report'])
        atomic(self.directory / 'state.json', {k: v for k, v in event.items() if k not in ('plans', 'documents')})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--receipt-dir', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--expect-plan-sha256')
    parser.add_argument('--batch-size', type=int, default=25)
    args = parser.parse_args()
    raw = args.input.read_bytes(); document = normalize_document(json.loads(raw))
    if args.apply and args.receipt_dir is None:
        parser.error('--apply requires --receipt-dir to preserve uncertain-write evidence')
    callback = lambda event: None
    lock = None
    if args.receipt_dir:
        args.receipt_dir.mkdir(parents=True, exist_ok=True)
        # Exclusive creation survives crashes. Never remove it to replay an unverified attempt.
        lock = args.receipt_dir / 'attempt-started.json'
        if args.apply:
            try:
                with lock.open('x') as handle:
                    json.dump({'input_sha256': hashlib.sha256(raw).hexdigest(), 'apply': True}, handle)
                    handle.flush(); os.fsync(handle.fileno())
            except FileExistsError:
                parser.error('This receipt directory already has an apply attempt; inspect/reconcile without replaying it')
        callback = Receipts(args.receipt_dir, args.expect_plan_sha256)
    elif args.expect_plan_sha256:
        def callback(event):
            if event['phase'] == 'planned' and event['report']['plan_sha256'] != args.expect_plan_sha256:
                raise ValueError('Current write plan differs from reviewed plan')
    try:
        report = import_document(Crate(settings()), document, apply=args.apply, batch_size=args.batch_size, on_event=callback)
    except BaseException as error:
        if args.receipt_dir and args.apply:
            atomic(args.receipt_dir / 'stopped.json', {'error_type': type(error).__name__, 'inspect_before_retry': True})
        raise
    if args.report: atomic(args.report, report)
    print(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    main()
