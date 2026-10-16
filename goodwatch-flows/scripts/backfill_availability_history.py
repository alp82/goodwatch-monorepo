"""#681 baseline and repair. SELECT-only dry run by default; --apply writes.

Pause both streaming copy callers and wait for active jobs before any apply.
Backfill precedes deployment; --reconcile repairs drift after deployment/rollback.
Neither mode creates tables, changes schedules, or writes source offers.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

_WINDMILL = Path(__file__).resolve().parents[1] / 'windmill'
if _WINDMILL.is_dir():
    sys.path.insert(0, str(_WINDMILL))

from f.sync.availability_history import KEY, PRIMARY_KEY, OFFER_TYPES, Stay, availability_key, utc_day, utc_ms

ESTIMATED_BYTES_PER_RECORD = 240  # Planning estimate, not measured history storage.
GROUPS = [(media, kind) for media in ('movie', 'show') for kind in OFFER_TYPES]
REPAIR_BATCH_SIZE = 2000
FILTER = "media_type IN ('movie', 'show') AND streaming_type IN ('flatrate', 'free', 'ads')"
INSERT_SQL = """
INSERT INTO availability_history (
    media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type,
    observed_at, appeared_on, appeared_after, appeared_source, appeared_precision,
    last_seen_on, dropped_on, dropped_precision, created_at, updated_at
)
SELECT media_tmdb_id, media_type, country_code, streaming_service_id, streaming_type,
       created_at, date_trunc('day', created_at), NULL, 'backfill', 'unknown',
       NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM streaming_availability WHERE media_type = ? AND streaming_type = ?
ON CONFLICT DO NOTHING
"""
MATCH_KEY = ' AND '.join(f'h.{column} = a.{column}' for column in KEY)
MISSING_OFFER = f"""FROM availability_history h LEFT JOIN streaming_availability a ON {MATCH_KEY}
    WHERE h.media_type = ? AND h.streaming_type = ? AND h.dropped_on IS NULL AND a.media_tmdb_id IS NULL"""
MISSING_STAY = f"""FROM streaming_availability a LEFT JOIN availability_history h
    ON {MATCH_KEY} AND h.dropped_on IS NULL
    WHERE a.media_type = ? AND a.streaming_type = ? AND h.media_tmdb_id IS NULL"""


def grouped_counts(rows):
    return {(row['media_type'], row['streaming_type']): row['offers'] for row in rows if row['offers']}


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
            raise ValueError('History writer has already run; use --reconcile to repair drift')
        for group in GROUPS:
            connector.run(INSERT_SQL, group)
        connector.run('REFRESH TABLE availability_history')
        actual = connector.select("""SELECT media_type, streaming_type, count(*) AS offers
            FROM availability_history WHERE dropped_on IS NULL
            GROUP BY media_type, streaming_type ORDER BY media_type, streaming_type""")
        report['history_groups'] = actual
        report['counts_match'] = grouped_counts(actual) == grouped_counts(groups)
        if not report['counts_match']:
            print(json.dumps(report, sort_keys=True, indent=2))
            raise ValueError('Backfill grouped counts differ from source preview; keep both schedules paused')
    print(json.dumps(report, sort_keys=True, indent=2))
    return report


def repair_counts(connector):
    return [{'media_type': media, 'streaming_type': kind,
             'to_close': connector.select('SELECT count(*) AS records ' + MISSING_OFFER, (media, kind))[0]['records'],
             'to_open': connector.select('SELECT count(*) AS records ' + MISSING_STAY, (media, kind))[0]['records']}
            for media, kind in GROUPS]


def repair_group(connector, group, close):
    changed = 0
    source = MISSING_OFFER if close else MISSING_STAY
    alias = 'h' if close else 'a'
    while True:
        rows = connector.select(f'SELECT {alias}.* {source} LIMIT ?', (*group, REPAIR_BATCH_SIZE))
        if not rows:
            return changed
        now = utc_ms(datetime.utcnow())
        if close:
            writes = [Stay(**(row | {'dropped_on': max(utc_day(now), utc_day(row['observed_at'])),
                                     'dropped_precision': 'unknown'})) for row in rows]
        else:
            previous = connector.select('SELECT * FROM availability_history WHERE media_type = ? AND media_tmdb_id = ANY(?)',
                                        (group[0], sorted({row['media_tmdb_id'] for row in rows})))
            latest = {}
            for old in previous:
                key = availability_key(old)
                latest[key] = max(latest.get(key, 0), old['observed_at'])
            writes = []
            for row in rows:
                key = availability_key(row)
                at = max(now, latest.get(key, -1) + 1)
                writes.append(Stay(**key._asdict(), observed_at=at, appeared_on=utc_day(at),
                                   appeared_source='backfill', appeared_precision='unknown'))
        connector.upsert_many(table='availability_history', records=writes,
                              conflict_columns=PRIMARY_KEY, silent=True, replace_nulls=True)
        connector.run('REFRESH TABLE availability_history')
        changed += len(writes)


def reconcile(connector, dry_run=True):
    """Repair both directions in bounded batches. All repaired precision is unknown."""
    if not dry_run:
        connector.run('REFRESH TABLE streaming_availability')
        connector.run('REFRESH TABLE availability_history')
    groups = repair_counts(connector)
    report = {'dry_run': dry_run, 'mode': 'reconcile', 'groups': groups,
              'to_close': sum(row['to_close'] for row in groups),
              'to_open': sum(row['to_open'] for row in groups)}
    if not dry_run:
        report['closed'] = sum(repair_group(connector, group, close=True) for group in GROUPS)
        report['opened'] = sum(repair_group(connector, group, close=False) for group in GROUPS)
        remaining = repair_counts(connector)
        report['remaining'] = remaining
        if any(row['to_close'] or row['to_open'] for row in remaining):
            raise ValueError('Reconcile still has drift; keep both schedules paused')
    print(json.dumps(report, sort_keys=True, indent=2))
    return report


def main(dry_run: bool = True, reconcile_mode: bool = False):
    from f.db.cratedb import CrateConnector
    connector = CrateConnector()
    try:
        return (reconcile if reconcile_mode else backfill)(connector, dry_run)
    finally:
        connector.disconnect()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write the reviewed baseline or repair')
    parser.add_argument('--reconcile', action='store_true', help='Repair drift instead of creating the initial baseline')
    args = parser.parse_args()
    main(dry_run=not args.apply, reconcile_mode=args.reconcile)
