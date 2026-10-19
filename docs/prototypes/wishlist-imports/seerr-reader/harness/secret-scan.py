#!/usr/bin/env python3
"""Look for a secret, and common encodings of it, without the secret ever
being a command-line argument. The first line of stdin is the secret.

    secret-scan.py files PATH...   scan files and folders
    secret-scan.py stdin           scan the rest of stdin
    secret-scan.py proc STOPFILE   scan every readable /proc/*/cmdline and
                                   environ until STOPFILE exists

Exit 0 when nothing matches, 1 when something does, 2 on usage errors.
Prints counts only, never the secret or the matching text.
"""
import base64
import json
import os
import sys
import time
import urllib.parse


def encodings(secret: str) -> list[bytes]:
    raw = secret.encode()
    forms = {
        secret,
        urllib.parse.quote(secret, safe=""),
        urllib.parse.quote_plus(secret, safe=""),
        base64.b64encode(raw).decode(),
        base64.b64encode(raw).decode().rstrip("="),
        base64.urlsafe_b64encode(raw).decode(),
        base64.urlsafe_b64encode(raw).decode().rstrip("="),
        json.dumps(secret)[1:-1],
        json.dumps(secret)[1:-1].replace("/", "\\/"),
        "".join(f"\\u{ord(c):04x}" for c in secret),
        "".join(f"\\u{ord(c):04X}" for c in secret),
    }
    return [form.encode() for form in forms if form]


def hits(data: bytes, needles: list[bytes]) -> int:
    return sum(data.count(needle) for needle in needles)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    secret = sys.stdin.buffer.readline().decode().rstrip("\n")
    if not secret:
        print("No secret on stdin.", file=sys.stderr)
        return 2
    needles = encodings(secret)
    mode = sys.argv[1]

    if mode == "stdin":
        data = sys.stdin.buffer.read()
        found = hits(data, needles)
        print(json.dumps({"bytes": len(data), "hits": found}))
        return 1 if found else 0

    if mode == "files":
        found_files = 0
        scanned = 0
        for root in sys.argv[2:]:
            paths = [root] if os.path.isfile(root) else [
                os.path.join(folder, name) for folder, _, names in os.walk(root) for name in names
            ]
            for path in paths:
                try:
                    with open(path, "rb") as handle:
                        data = handle.read()
                except OSError:
                    continue
                scanned += 1
                if hits(data, needles):
                    found_files += 1
        print(json.dumps({"files": scanned, "filesWithSecret": found_files}))
        return 1 if found_files else 0

    if mode == "proc":
        stop = sys.argv[2]
        me = str(os.getpid())
        found = 0
        sweeps = 0
        while not os.path.exists(stop):
            sweeps += 1
            for pid in os.listdir("/proc"):
                if not pid.isdigit() or pid == me:
                    continue
                for part in ("cmdline", "environ"):
                    try:
                        with open(f"/proc/{pid}/{part}", "rb") as handle:
                            if hits(handle.read(), needles):
                                found += 1
                    except OSError:
                        pass
        print(json.dumps({"sweeps": sweeps, "hits": found}))
        return 1 if found else 0

    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
