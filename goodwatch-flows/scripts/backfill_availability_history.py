"""One-off #681 baseline. Dry-run by default; apply only before enabling the writer.

Production validation is SELECT-only. Run locally with the workspace's Windmill
credentials, or as a reviewed read-only preview. No table creation, refresh,
schedule changes or source writes. Stop the streaming copy during an applied
backfill; deploy the history writer only after it finishes. A retry before writer
activation is safe, including a partially completed INSERT SELECT.
"""
import json
import sys
from pathlib import Path

_WINDMILL = Path(__file__).resolve().parents[1] / 'windmill'
if _WINDMILL.is_dir():
    sys.path.insert(0, str(_WINDMILL))

ESTIMATED_BYTES_PER_RECORD = 240  # Estimate, not measured history storage; includes added proof fields.
FILTER = "streaming_type IN ('flatrate', 'free', 'ads')"
INSERT_SQL = f"""
INSERT INTO availability_history (
    media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type,
    observed_at, appeared_on, appeared_after, appeared_source, appeared_precision,
    last_seen_on, dropped_on, dropped_precision, created_at, updated_at
)
SELECT media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type,
       created_at, date_trunc('day', created_at), NULL, 'backfill', 'unknown',
       NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM streaming_availability WHERE {FILTER}
ON CONFLICT DO NOTHING
"""


def backfill(connector, dry_run=True):
    groups = connector.select(f"""
        SELECT media_type, streaming_type, count(*) AS offers,
               count(DISTINCT country_code) AS countries,
               count(*) - count(created_at) AS missing_created_at
        FROM streaming_availability WHERE {FILTER}
        GROUP BY media_type, streaming_type ORDER BY media_type, streaming_type
    """)
    storage = connector.select("""
        SELECT sum(num_docs) AS rows, sum(size) AS bytes FROM sys.shards
        WHERE schema_name = 'doc' AND table_name = 'streaming_availability' AND primary = true
    """)[0]
    count = sum(row['offers'] for row in groups)
    report = {'dry_run': dry_run, 'open_records': count, 'groups': groups,
              'source_primary_storage': storage, 'estimated_bytes_per_record': ESTIMATED_BYTES_PER_RECORD,
              'estimated_primary_bytes': count * ESTIMATED_BYTES_PER_RECORD,
              'estimate_excludes_replicas': True}
    if not dry_run:
        if any(row['missing_created_at'] for row in groups):
            raise ValueError('Cannot backfill offers without created_at')
        active = connector.select("""SELECT count(*) AS records FROM availability_history
            WHERE appeared_source <> 'backfill' OR dropped_on IS NOT NULL""")[0]['records']
        if active:
            raise ValueError('History writer has already run; backfill must precede writer activation')
        connector.run(INSERT_SQL)
    print(json.dumps(report, sort_keys=True, indent=2))
    return report


def main(dry_run: bool = True):
    from f.db.cratedb import CrateConnector
    connector = CrateConnector()
    try:
        return backfill(connector, dry_run)
    finally:
        connector.disconnect()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write the reviewed baseline before writer activation')
    args = parser.parse_args()
    main(dry_run=not args.apply)
