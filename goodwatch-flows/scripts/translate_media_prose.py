#!/usr/bin/env python3
"""Translate an explicit source manifest, dry-run by default. No SSR dependency."""
import argparse
from decimal import Decimal
import fcntl
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.media_language.prose_jobs import Budget, detector, run_jobs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=Path, required=True, help='JSON array of {source_id,text,source_revision?}')
    parser.add_argument('--locales', required=True)
    parser.add_argument('--execute', action='store_true', help='Owner-approved paid execution and Crate publication')
    parser.add_argument('--spend-cap-usd', type=Decimal, default=Decimal('0'))
    parser.add_argument('--ledger', type=Path, help='Durable reservation ledger, reused across restarts')
    args = parser.parse_args()
    sources = json.loads(args.sources.read_text())
    if not args.execute:
        print(json.dumps(run_jobs(sources, args.locales.split(','), read=lambda *key: None,
                                  publish=lambda record: None), indent=2))
        return
    if not args.ledger or not args.spend_cap_usd.is_finite() or args.spend_cap_usd <= 0:
        parser.error('--execute requires a positive spend cap and a durable --ledger')
    identify = detector()  # Fail before provider I/O when detector is unavailable.
    token = os.environ.get('OPENROUTER_API_KEY')
    if not token:
        parser.error('OPENROUTER_API_KEY required')
    import requests
    from f.db.cratedb import CrateConnector
    # All executors sharing this budget must reuse this ledger. Exclusive lock spans
    # the run; never run parallel jobs against distinct ledgers for the same cap.
    with args.ledger.open('a+') as ledger:
        fcntl.flock(ledger, fcntl.LOCK_EX)
        ledger.seek(0)
        lines = ledger.read().splitlines()
        used = Decimal(lines[-1]) if lines else Decimal('0')

        def persist(amount):
            ledger.write(str(amount) + '\n')
            ledger.flush()
            os.fsync(ledger.fileno())

        budget = Budget(args.spend_cap_usd, used, persist)
        connector = CrateConnector()
        try:
            def read(source_id, revision, language):
                rows = connector.select('SELECT status, validation_revision, attempts, cost_usd, prompt_tokens, completion_tokens FROM prose_translation '
                                        'WHERE source_id = ? AND source_revision = ? AND language = ?',
                                        (source_id, revision, language))
                return rows[0] if rows else None

            def publish(record):
                columns = list(record)
                sql = (f"INSERT INTO prose_translation ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)}) "
                       'ON CONFLICT (source_id, source_revision, language) DO UPDATE SET ' +
                       ', '.join(f'{col} = excluded.{col}' for col in columns if col not in ('source_id', 'source_revision', 'language')))
                connector.run_many(sql, [tuple(record.values())])

            def request(payload):
                response = requests.post('https://openrouter.ai/api/v1/chat/completions',
                                         headers={'Authorization': 'Bearer ' + token}, json=payload,
                                         timeout=(10, 120), allow_redirects=False)
                response.raise_for_status()
                return response.json()

            print(json.dumps(run_jobs(sources, args.locales.split(','), read=read, publish=publish,
                                      request=request, detect=identify, budget=budget, dry_run=False), indent=2))
        finally:
            connector.disconnect()


if __name__ == '__main__':
    main()
