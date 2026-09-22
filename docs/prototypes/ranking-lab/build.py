"""PROTOTYPE - embed a capture JSON into template.html. Usage: python build.py capture.json"""
import json, sys, pathlib, hashlib
here = pathlib.Path(__file__).parent
data = json.load(open(sys.argv[1]))
for c in data:
    for r in c["vectorPool"]: r["cosine"] = round(r["cosine"], 4)
    c["titles"] = {k: v for k, v in c["titles"].items()}
compact = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
meta = json.dumps({"sha256": hashlib.sha256(json.dumps(data, separators=(",", ":")).encode()).hexdigest(), "queries": len(data)})
(here / "index.html").write_text((here / "template.html").read_text().replace("/*DATA*/", compact).replace("/*CAPTURE_META*/", meta))
json.dump(data, open(here / "capture.json", "w"), separators=(",", ":"))
print("index.html", (here / "index.html").stat().st_size // 1024, "KB")
