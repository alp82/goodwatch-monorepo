#!/usr/bin/env python3
"""Read-only preview by default; --apply writes only doc.social_relevance.

Use environment CRATE_HOSTS/CRATE_USER/CRATE_PASS, or --env with a private env file.
Windmill equivalent: f/social/rejudge {"apply": false} or {"apply": true}.
"""
import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.social.rejudge import RelevanceCrate, run
from f.social.settings import KEYS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--env', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    settings = {}
    if args.env:
        for line in args.env.read_text().splitlines():
            key, sep, value = line.partition('=')
            if sep and key.strip() in KEYS:
                settings[key.strip()] = value.strip().strip('\"\'')
    settings.update({k: os.environ[k] for k in KEYS if os.environ.get(k)})
    result = run(RelevanceCrate(settings, apply=args.apply), apply=args.apply)
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'decisions'}, indent=2))


if __name__ == '__main__':
    main()
