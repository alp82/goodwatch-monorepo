"""Write lab/pins.json: the sha256 of every rung of the ladder and every control predictor.

    python3 pin.py            # write the file
    python3 pin.py --check    # exit 1 when a pinned file has changed or a file is not pinned

Run it only when the ladder or a control predictor is changed on purpose. pins.json is one of the harness files:
a new pin gives a new harness hash, and the table then refuses to mix old ladder rows with new ones.
"""
import json
import os
import sys

from common import CONTROL_PREDICTORS, LAB, LADDER, PINS, sha256_file


def current():
    out = {}
    for folder in (LADDER, CONTROL_PREDICTORS):
        for d, _, files in os.walk(folder):
            for name in files:
                if name.endswith('.py'):
                    path = os.path.join(d, name)
                    out[os.path.relpath(path, LAB)] = sha256_file(path)
    return dict(sorted(out.items()))


if __name__ == '__main__':
    now = current()
    if '--check' in sys.argv[1:]:
        with open(PINS) as f:
            pinned = json.load(f)
        if pinned != now:
            sys.exit('lab/pins.json does not match the files: ' +
                     ', '.join(sorted(k for k in set(pinned) | set(now) if pinned.get(k) != now.get(k))))
        print(f'{len(now)} files match lab/pins.json')
    else:
        with open(PINS, 'w') as f:
            json.dump(now, f, indent=1)
            f.write('\n')
        print(f'pinned {len(now)} files')
