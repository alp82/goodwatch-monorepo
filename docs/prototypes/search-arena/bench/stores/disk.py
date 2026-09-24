"""Disk usage per Qdrant variant, split by component (allocated bytes, du -sk, summed over shards and segments).

Usage: .venv/bin/python bench/stores/disk.py
"""
import subprocess

import common as K

SCRIPT = r"""
cd /qdrant/storage/collections/{name} || exit 1
for f in */segments/*/* */wal; do
  b=$(du -sk "$f" | cut -f1); a=$(du -sk --apparent-size "$f" | cut -f1)
  echo "$(basename "$f") $b $a"
done
"""


def breakdown(name):
    out = subprocess.run(["docker", "exec", K.QDRANT_CONTAINER, "sh", "-c", SCRIPT.format(name=name)],
                         capture_output=True, text=True, check=True).stdout
    alloc, apparent = {}, {}
    for line in out.split("\n"):
        if not line.strip():
            continue
        f, b, a = line.split()
        key = "wal" if f == "wal" else f if f.startswith(("vector_", "payload_")) else "other"
        alloc[key] = alloc.get(key, 0) + int(b) * 1024
        apparent[key] = apparent.get(key, 0) + int(a) * 1024
    return dict(total_allocated_bytes=K.du(K.QDRANT_CONTAINER, f"/qdrant/storage/collections/{name}"),
                allocated_bytes=dict(sorted(alloc.items())), apparent_bytes=dict(sorted(apparent.items())))


def main():
    res = {v: breakdown(n) for v, n in list(K.VARIANTS.items()) + [K.BASE]}
    for v, r in res.items():
        print(v, round(r["total_allocated_bytes"] / 2 ** 20), "MiB",
              {k: round(b / 2 ** 20) for k, b in r["allocated_bytes"].items()}, flush=True)
    K.update_results("qdrant_disk", res)


if __name__ == "__main__":
    main()
