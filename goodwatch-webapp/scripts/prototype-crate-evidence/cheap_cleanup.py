"""Drop only the approved cheap-loop scratch table after the main agent's GO.

This is an explicit closure command, not part of search or report generation.
The record is write-once; prior cleanup history is never overwritten.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values
import experiment as e

APPROVED_TABLE = 'doc.prototype_search_evidence_104_v1'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', required=True)
    parser.add_argument('--execute-drop', action='store_true')
    parser.add_argument('--record', type=Path, default=e.ROOT / 'docs/prototypes/crate-evidence/cheap-loop-cleanup-result.json')
    args = parser.parse_args()
    if not args.execute_drop:
        parser.error('Requires --execute-drop and the main agent\'s explicit GO.')
    if args.record.exists():
        raise FileExistsError('Cleanup record already exists; refusing to overwrite history.')
    assert e.TABLE == APPROVED_TABLE
    env = dotenv_values(args.env)
    e.URL = f"http://{env['CRATE_HOSTS'].split(',')[0]}:{env.get('CRATE_PORT', '4200')}/_sql"
    e.AUTH = (env.get('CRATE_USER', ''), env.get('CRATE_PASS', ''))
    lookup = "SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name=?"
    lookup_args = [APPROVED_TABLE.split('.')[1]]
    before = e.sql(lookup, lookup_args)
    dropped = e.sql('DROP TABLE doc.prototype_search_evidence_104_v1') if before['rows'] else None
    after = e.sql(lookup, lookup_args)
    if after['rows']:
        raise RuntimeError('Scratch table remains present; cleanup is not verified.')
    record = {
        'status': 'dropped_and_verified_absent' if dropped else 'already_absent_verified',
        'table': APPROVED_TABLE,
        'verified_at': datetime.now(timezone.utc).isoformat(),
        'present_before': bool(before['rows']),
        'absent_after': True,
        'drop_wall_ms': dropped['wall_ms'] if dropped else None,
        'verification_wall_ms': after['wall_ms'],
        'source_catalog_writes': False,
        'private_snapshots_and_candidate_pools_retained': True,
        'historical_cleanup_records_preserved': True,
    }
    args.record.parent.mkdir(parents=True, exist_ok=True)
    with args.record.open('x') as output:
        output.write(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record))


if __name__ == '__main__':
    main()
