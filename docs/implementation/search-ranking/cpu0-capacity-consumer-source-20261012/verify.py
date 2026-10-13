"""Verify public source/review bindings; no runtime operations."""
from pathlib import Path
import hashlib
import json
root = Path(__file__).resolve().parent
bindings = json.loads((root / "review-bindings.json").read_text())["files"]
for name, proof in bindings.items():
    data = (root / name).read_bytes()
    assert len(data) == proof["bytes"] and hashlib.sha256(data).hexdigest() == proof["sha256"], name
repo = root.parents[3]
for version in (1, 2, 3):
    review = root / f"review-v{version}"
    manifest = json.loads((review / "manifest.json").read_text())
    for group, key in (("source", "files"), ("context", "contextFiles")):
        for name, proof in manifest[key].items():
            data = (review / group / name).read_bytes()
            assert len(data) == proof["bytes"] and hashlib.sha256(data).hexdigest() == proof["sha256"], (version, name)
for name in json.loads((root / "review-v3/manifest.json").read_text())["files"]:
    assert (repo / "goodwatch-qdrant/diagnostics/pinning-prototype" / name).read_bytes() == (root / "review-v3/source" / name).read_bytes(), name
print(json.dumps({"artifactsVerified": len(bindings), "finalSourceFilesVerified": 4, "hostOperations": 0, "executionReady": False}))
