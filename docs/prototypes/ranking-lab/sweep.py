"""PROTOTYPE - render index.html headlessly and print watch-title ranks per query and preset.
Usage: python sweep.py [--q 0,2,9] [--presets prod,recall] [--top 8] [--dump tops.jsonl]
"""
import argparse, json, pathlib, re, subprocess

HERE = pathlib.Path(__file__).parent
ap = argparse.ArgumentParser()
ap.add_argument("--q", default="")
ap.add_argument("--presets", default="prod")
ap.add_argument("--top", type=int, default=8)
ap.add_argument("--dump", default="")
ap.add_argument("--browser", default="google-chrome-stable")
args = ap.parse_args()

data = json.load(open(HERE / "capture.json"))
qs = [int(x) for x in args.q.split(",") if x] or list(range(len(data)))
dump = open(args.dump, "w") if args.dump else None
for q in qs:
    for p in args.presets.split(","):
        url = f"file://{HERE / 'index.html'}?q={q}&preset={p}"
        d = subprocess.run([args.browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=8000", "--dump-dom", url],
                           capture_output=True, text=True, timeout=90).stdout
        meta = re.search(r'id="meta">(.*?)</div>', d, re.S)
        if not meta:
            print(q, p, "render failed"); continue
        query = re.sub("<[^>]+>", "", meta.group(1)).split(" ·")[0]
        watch = re.sub("<[^>]+>", "", re.sub("</span>", "; ", re.search(r'id="watch">(.*?)</div>', d, re.S).group(1)))
        watch = re.sub(r" \(prod [0-9–]*\)", "", watch).replace(": not in pool", ": –")
        rows = re.findall(r'<tr class="[^"]*"><td class="num">(\d+)</td><td>(.*?) <span', d)[: args.top]
        on = re.findall(r'<button data-id="([a-z0-9]+)" class="on"', d)
        print(f"{query[:22]:22} | {p:12} | {watch} | top{args.top}: {', '.join(t for _, t in rows)}" + ("" if on == [p] else f" | ACTIVE {on}"))
        if dump:
            keys = json.loads(re.search(r'<pre id="dump"[^>]*>(.*?)</pre>', d, re.S).group(1))
            dump.write(json.dumps({"query": query, "preset": p, "keys": keys[:40]}) + "\n")
if dump:
    dump.close()
