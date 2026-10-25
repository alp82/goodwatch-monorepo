#!/usr/bin/env python3
"""Fetch a bounded, supervised batch of known Main-page descriptions. No database writes.

Uses the existing TV Tropes recovery client's pace, identifying user agent and hard stops.
Subagents can review the saved sources; every live request belongs to this one runner.
"""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / "windmill"), str(FLOWS / "scripts")]
from bs4 import BeautifulSoup
from f.critic_sites.polite_http import FetchError, SiteBlocked
from recover_tvtropes import DEFAULT_STATE, BudgetExhausted, LocalClient, State, utcnow


def main_url(url):
    parsed = urlparse(url or "")
    return parsed.scheme == "https" and parsed.netloc == "tvtropes.org" and bool(re.fullmatch(r"/pmwiki/pmwiki\.php/Main/[A-Za-z0-9]+", parsed.path)) and not parsed.query and not parsed.fragment


def identity(value):
    value = unicodedata.normalize("NFKD", value).casefold()
    return "".join(c for c in value if c.isalnum())


def extract(html, name):
    soup = BeautifulSoup(html or "", "html.parser")
    article = soup.select_one("#main-article")
    heading = soup.select_one("h1")
    title = heading.get_text(" ", strip=True) if heading else ""
    # Source pages may put the Main namespace before the title, separated by a slash.
    title = re.sub(r"^Main\s*/\s*", "", title)
    if not article or identity(title) != identity(name):
        return None, f"Heading mismatch: {title!r}"
    for junk in article.select(".quoteright, .acaptionright, .indent, .tvtropes-ad-unit, .folderlabel, .folder, script, style"):
        junk.decompose()
    paragraphs = [re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip() for p in article.find_all("p", recursive=False)]
    paragraphs = [p for p in paragraphs if p]
    text = " ".join(paragraphs[:2])
    text = re.sub(r"\(\s+", "(", re.sub(r"\s+([,.;:!?)])", r"\1", text))
    sentences = re.findall(r"[^.!?]+[.!?]+[\"')\]]*\s*", text + " ") or [text]
    out = ""
    for sentence in sentences[:4]:
        if out and len(out) + len(sentence) > 700:
            break
        out += sentence
    out = out.strip()
    if len(out) < 40:
        return None, "Missing or very short introduction"
    return out, None


def recover(queue, output, *, state_path=DEFAULT_STATE, delay=6, max_requests=20, client=None):
    if delay < 6 or not 1 <= max_requests <= 200:
        raise ValueError("Use at least six seconds between requests and a budget of 1–200")
    entries = json.loads(Path(queue).read_text())
    if not isinstance(entries, list) or any(not e.get("name") or not main_url(e.get("url")) for e in entries):
        raise ValueError("Queue must contain names and known HTTPS TV Tropes Main URLs")
    if len({e['name'] for e in entries}) != len(entries):
        raise ValueError("Duplicate trope names in queue")
    state = State(Path(state_path))
    blocked = state.blocked(utcnow())
    if blocked:
        raise RuntimeError(f"TV Tropes recovery is blocked until {blocked.isoformat()}")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(Path(queue).read_bytes()).hexdigest()
    manifest = output / "queue.sha256"
    if manifest.exists() and manifest.read_text().strip() != digest:
        raise ValueError("Run folder belongs to another queue")
    manifest.write_text(digest + "\n")
    done_path = output / "descriptions.json"
    done = json.loads(done_path.read_text()) if done_path.exists() else {}
    evidence_path = output / "run.json"
    previous = json.loads(evidence_path.read_text()) if evidence_path.exists() else {}
    saved = {}
    for row in previous.get("log", []):
        path = output / row.get("source_file", "missing")
        if row.get("status") == 200 and path.is_file():
            saved[row["requested_url"]] = {"path": path, "run": str(output), "url": row["url"], "status": 200}
    client = client or LocalClient(output / "sources", delay, max_requests, saved=saved)
    records, failures, stop = [], 0, None
    try:
        for entry in entries:
            if entry['name'] in done:
                continue
            try:
                page = client.get(entry['url'])
                if page.status != 200:
                    record = {"name": entry['name'], "status": page.status, "error": "Non-200 source"}
                    failures += 1
                elif not main_url(page.url):
                    record = {"name": entry['name'], "error": "Redirect left Main namespace"}
                    failures += 1
                else:
                    text, error = extract(page.text, entry['name'])
                    record = {"name": entry['name'], "url": page.url, "error": error}
                    if text:
                        done[entry['name']] = {"text": text, "url": page.url}
                        done_path.write_text(json.dumps(done, ensure_ascii=False, indent=2) + "\n")
                        failures = 0
                    else:
                        failures += 1
                records.append(record)
                print(json.dumps(record, ensure_ascii=False), flush=True)
            except SiteBlocked as error:
                state.add_block(error.until, error.reason, entry['url'], utcnow())
                state.save()
                stop = f"Blocked: {error.reason}; no retry"
                break
            except BudgetExhausted as error:
                stop = str(error)
                break
            except FetchError as error:
                failures += 1
                records.append({"name": entry['name'], "error": str(error)})
            if failures >= 3:
                stop = "Three consecutive failures; stopped"
                break
    finally:
        state.save()
        # Preserve the same evidence schema the catalog importer accepts, including raw source hashes.
        evidence = {"at": utcnow().isoformat(), "requests": previous.get("requests", 0) + client.requests,
                    "requests_this_run": client.requests, "stop": stop,
                    "log": previous.get("log", []) + client.log,
                    "records": previous.get("records", []) + records, "descriptions": len(done)}
        (output / "run.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"descriptions": len(done), "requests": client.requests, "stop": stop}), flush=True)
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("queue", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--delay", type=float, default=6)
    parser.add_argument("--max-requests", type=int, default=20)
    args = parser.parse_args()
    recover(args.queue, args.output, state_path=args.state, delay=args.delay, max_requests=args.max_requests)


if __name__ == "__main__":
    main()
