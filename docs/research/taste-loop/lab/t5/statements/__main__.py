"""Explicit, hash-checked offline pool fit. Never discovers or pulls a newer pack."""
import argparse
from pathlib import Path

from . import artifact
from .data import from_pack


def main():
    parser = argparse.ArgumentParser(__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    command = sub.add_parser('fit-kinds')
    command.add_argument('--pack', type=Path, required=True)
    command.add_argument('--data-root', type=Path, required=True)
    command.add_argument('--pack-sha256', required=True)
    args = parser.parse_args()
    # Importing Pack is safe: no implicit Pack() or default data-loader invocation.
    from pack import Pack, sha256
    folder = args.pack.expanduser().resolve()
    if sha256(folder / 'pack.pkl') != args.pack_sha256:
        parser.error('pack hash changed')
    pack = Pack(folder)
    for filename in ('titles.pkl', 'titles_detail.pkl'):
        expected = pack.manifest['files_sha256'].get(filename)
        if not expected or sha256(folder / filename) != expected:
            parser.error('title file hash changed')
    model = artifact.fit(from_pack(pack))
    path, sha = artifact.save(model, args.data_root)
    print(f'artifact: {path}\nsha256: {sha}\nreference titles: {len(model["pool_keys"])}')


if __name__ == '__main__':
    main()
