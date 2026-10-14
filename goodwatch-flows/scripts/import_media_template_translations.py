#!/usr/bin/env python3
"""Import owner-reviewed dynamic template blocks without model calls. Dry-run default."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.media_language.episode_translations import LAUNCH_LOCALES
from f.media_language.prose_jobs import VALIDATION_REVISION, detector, revision, validate


def records_from_manifest(manifest, detect):
    if not isinstance(manifest, list) or not 1 <= len(manifest) <= 1000:
        raise ValueError('Bounded 1–1000 reviewed blocks required')
    records = []
    seen = set()
    for block in manifest:
        source, language = block['source'], block['language']
        if language not in LAUNCH_LOCALES or language == 'en':
            raise ValueError('Unsupported translation locale')
        source_revision = revision(source)
        if block['source_revision'] != source_revision or block.get('reviewed_by') != 'owner':
            raise ValueError('Current source revision and explicit owner review required')
        key = ('template:' + source_revision, source_revision, language)
        if key in seen:
            raise ValueError('Duplicate translation identity')
        seen.add(key)
        text = validate(source, block['text'], language, detect)
        records.append(dict(zip(('source_id', 'source_revision', 'language'), key)) |
                       {'text': text, 'status': 'valid', 'model': 'reviewed-template', 'attempts': 0,
                        'prompt_tokens': 0, 'completion_tokens': 0, 'cost_usd': 0,
                        'validation_revision': VALIDATION_REVISION})
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    identify = detector()
    records = records_from_manifest(json.loads(args.manifest.read_text()), identify)
    if not args.apply:
        print(json.dumps({'dry_run': True, 'rows': len(records), 'cost_usd': 0}))
        return
    from f.db.cratedb import CrateConnector
    connector = CrateConnector()
    try:
        for record in records:
            columns = list(record)
            connector.run_many(f"INSERT INTO prose_translation ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)}) "
                               'ON CONFLICT (source_id, source_revision, language) DO UPDATE SET ' +
                               ', '.join(f'{column} = excluded.{column}' for column in columns if column not in ('source_id', 'source_revision', 'language')),
                               [tuple(record.values())])
    finally:
        connector.disconnect()


if __name__ == '__main__':
    main()
