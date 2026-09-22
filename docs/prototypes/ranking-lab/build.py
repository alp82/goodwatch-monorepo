"""PROTOTYPE - embed a capture JSON into template.html. Usage: python build.py capture.json"""
import json, sys, pathlib
here = pathlib.Path(__file__).parent
data = json.load(open(sys.argv[1]))
for c in data:
    for r in c["vectorPool"]:
        if r.get("cosine") is not None: r["cosine"] = round(r["cosine"], 4)
    c["titles"] = {k: v for k, v in c["titles"].items()}
compact = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
(here / "index.html").write_text((here / "template.html").read_text().replace("/*DATA*/", compact))
json.dump(data, open(here / "capture.json", "w"), separators=(",", ":"))
print("index.html", (here / "index.html").stat().st_size // 1024, "KB")
