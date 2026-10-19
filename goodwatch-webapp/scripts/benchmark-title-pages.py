"""Measure complete title documents, recording page-cache state and client type.

Use a fresh local production process with PAGE_CACHE=off and an isolated data cache
for cold-render comparisons. This script never clears a cache. URL files are JSON
arrays of paths, or the evidence file's `paths` array. Scratch/output belongs outside
the repository. Requests are sequential, including retries; redirects are recorded.
"""
import argparse
import json
import subprocess
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--urls", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--visits", type=int, default=3)
    args = parser.parse_args()
    data = json.loads(args.urls.read_text())
    paths = data["paths"] if isinstance(data, dict) else data
    assert args.visits > 0
    assert all(path.startswith(("/movie/", "/show/")) and "\n" not in path for path in paths)
    agents = {
        "googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "browser": "Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    headers_file = args.output.with_suffix(".headers")
    last = 0.0
    with args.output.open("w") as output:
        for path in paths:
            for client, ua in agents.items():
                for visit in range(args.visits):
                    time.sleep(max(0, last + 1.1 - time.monotonic()))
                    last = time.monotonic()
                    result = subprocess.run([
                        "curl", "--silent", "--show-error", "--compressed",
                        "--user-agent", ua, "--header", "Accept: text/html",
                        "--dump-header", str(headers_file), "--output", "/dev/null",
                        "--max-time", "95", "--write-out", "%{json}",
                        args.base_url.rstrip("/") + path,
                    ], capture_output=True, text=True)
                    meta = json.loads(result.stdout or "{}")
                    headers = headers_file.read_text() if headers_file.exists() else ""
                    cache = [line.split(":", 1)[1].strip() for line in headers.splitlines()
                             if line.lower().startswith("gw-page-cache:")]
                    row = {
                        "path": path, "client": client, "visit": visit,
                        "status": meta.get("http_code"), "exit": result.returncode,
                        "total_ms": round(meta.get("time_total", 0) * 1000),
                        "bytes": meta.get("size_download"), "page_cache": cache,
                    }
                    # time_starttransfer can refer to 103 Early Hints. Measure through the final body instead.
                    output.write(json.dumps(row) + "\n")
                    output.flush()
                    print(json.dumps(row), flush=True)
    headers_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
