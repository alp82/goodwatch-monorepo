#!/usr/bin/env python3
"""Import reviewed, recovered TV Tropes results into the production Mongo documents.

Default is a DRY RUN that only reads. Three modes:

  build-manifest  write the reviewed allow-list from run dirs + the review report
  import          (default) dry run, or --apply to write; writes a rollback file
  --rollback F    restore the fields an earlier --apply changed

The import writes exactly what `fetch_entry` in
f/tvtropes_web/tv_tropes_crawl_tags/fetch.py persists for a successful crawl:
tvtropes_url, tropes[{name,url,html}], updated_at=utcnow, is_selected=False and
error_message/failed_at removed (mongoengine unsets fields saved as None).
The scheduled f/sync/copy/tvtropes job copies documents with
`tropes != null` and `updated_at >= now - 48h`, so a fresh updated_at is what
makes it pick the rows up.

Documents are never created: tvtropes_init_tags upserts one document per TMDB
title, so a missing document means the identity is wrong and it is skipped.
Documents that already hold tropes are never replaced. A document with no
tropes but a stale tvtropes_url is importable; the dry run reports the previous
url (url-replaced / url-same) and the rollback record restores it exactly.
--apply requires --expect-count N and aborts before the first write unless
exactly N identities would be imported.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

COLLECTIONS = {"movie": "tv_tropes_movie_tags", "show": "tv_tropes_tv_tags"}
# Reviewed wrong pages (recovery-report-2026-09-21.md, "Do not publish").
BUILTIN_DENY = {("movie", 1491), ("show", 1425)}
URL_PREFIX = "https://tvtropes.org/pmwiki/pmwiki.php/"
COUNTRY_SUFFIX = re.compile(r"(US|UK|AU|CA|NZ|IN|JP|KR|FR|DE|ES|IT|BR|MX)$")
SET_FIELDS = ["tvtropes_url", "tropes", "updated_at", "is_selected"]
UNSET_FIELDS = ["error_message", "failed_at"]
TOUCHED_FIELDS = SET_FIELDS + UNSET_FIELDS
MISSING = {"$missing": True}


# ===== Pure helpers =====


def identity(text):
    media_type, _, tmdb_id = text.partition(":")
    if media_type not in COLLECTIONS or not tmdb_id.isdigit():
        raise argparse.ArgumentTypeError(f"expected media_type:tmdb_id, got {text!r}")
    return media_type, int(tmdb_id)


def canonical_tropes(tropes):
    return [{"name": t["name"], "url": t["url"], "html": t["html"]} for t in tropes]


def tropes_sha256(tropes):
    payload = json.dumps(
        canonical_tropes(tropes),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_latest(run_dirs):
    """Latest record per (media_type, tmdb_id); later lines and later dirs win."""
    latest = {}
    for run_dir in run_dirs:
        with open(Path(run_dir) / "results.jsonl", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    record = json.loads(line)
                    record["_run"] = Path(run_dir).name
                    latest[(record["media_type"], int(record["tmdb_id"]))] = record
    return latest


def recovered(latest):
    return {
        key: record
        for key, record in latest.items()
        if record.get("status") == "recovered"
        and record.get("result", {}).get("url")
        and record["result"].get("tropes")
    }


def has_country_suffix(url):
    return bool(COUNTRY_SUFFIX.search(url or ""))


def parse_report_ok(report_path):
    """(media_type, tmdb_id) -> (page, trope_count) for rows reviewed as ok in the recovered tables."""
    reviewed = {}
    in_recovered = False
    for line in Path(report_path).read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            in_recovered = line.lstrip("# ").startswith("Recovered")
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not in_recovered or len(cells) < 8 or cells[0] not in COLLECTIONS:
            continue
        if not cells[1].isdigit() or not cells[-1].startswith("ok"):
            continue
        key = (cells[0], int(cells[1]))
        if key in reviewed:
            raise SystemExit(f"report lists {key} twice as ok")
        reviewed[key] = (cells[4], int(cells[5]))
    return reviewed


def build_manifest(run_dirs, report_path, deny, expected):
    reviewed = parse_report_ok(report_path)
    candidates = recovered(load_latest(run_dirs))
    entries = []
    problems = []
    for key, record in sorted(candidates.items()):
        url = record["result"]["url"]
        tropes = record["result"]["tropes"]
        if key in deny:
            continue
        if key not in reviewed:
            problems.append(f"{key}: recovered but not reviewed ok in the report")
            continue
        page, count = reviewed[key]
        if url != URL_PREFIX + page:
            problems.append(f"{key}: url {url} differs from reviewed page {page}")
        if count != len(tropes):
            problems.append(f"{key}: {len(tropes)} tropes, report reviewed {count}")
        entries.append(
            {
                "media_type": key[0],
                "tmdb_id": key[1],
                "title": record.get("title"),
                "year": record.get("release_year"),
                "url": url,
                "trope_count": len(tropes),
                "tropes_sha256": tropes_sha256(tropes),
                "country_suffixed_page": has_country_suffix(url),
                "run": record["_run"],
            }
        )
    for key in sorted(set(reviewed) - set(candidates)):
        problems.append(f"{key}: reviewed ok in the report but not recovered in the runs")
    for key in sorted(set(reviewed) & deny):
        problems.append(f"{key}: denied but reviewed ok in the report")
    if any((e["media_type"], e["tmdb_id"]) in deny for e in entries):
        problems.append("a denied identity reached the manifest")
    if len(entries) != expected:
        problems.append(f"expected {expected} entries, built {len(entries)}")
    if problems:
        raise SystemExit("manifest refused:\n  " + "\n  ".join(problems))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "report": Path(report_path).name,
        "runs": [Path(d).name for d in run_dirs],
        "denied": sorted(f"{m}:{i}" for m, i in deny),
        "count": len(entries),
        "entries": entries,
    }


def load_manifest(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {(e["media_type"], int(e["tmdb_id"])): e for e in data["entries"]}


# ===== Store =====


class MongoStore:
    """Thin seam over pymongo; tests substitute a fake with the same three methods."""

    def __init__(self, db):
        self.db = db

    def find(self, media_type, tmdb_id):
        return list(self.db[COLLECTIONS[media_type]].find({"tmdb_id": tmdb_id}))

    def find_by_id(self, media_type, doc_id):
        return self.db[COLLECTIONS[media_type]].find_one({"_id": doc_id})

    def update(self, media_type, query, set_fields, unset_fields):
        update = {}
        if set_fields:
            update["$set"] = set_fields
        if unset_fields:
            update["$unset"] = {name: "" for name in unset_fields}
        return self.db[COLLECTIONS[media_type]].update_one(query, update).modified_count


class ReadOnlyStore:
    def __init__(self, store):
        self.find = store.find
        self.find_by_id = store.find_by_id

    def update(self, *args, **kwargs):
        raise RuntimeError("write attempted during a dry run")


def connect():
    """Same credentials path as export_tvtropes_cohort.py: Windmill variables via the CLI profile."""
    import requests
    from pymongo import MongoClient

    if os.environ.get("MONGODB_URI"):
        client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=20000)
        return client, client[os.environ.get("MONGODB_DB", "goodwatch")]
    profile = next(
        json.loads(line)
        for line in (Path.home() / ".config/windmill/remotes.ndjson")
        .read_text()
        .splitlines()
        if json.loads(line)["name"] == "goodwatch"
    )

    def variable(name):
        response = requests.get(
            f"{profile['remote'].rstrip('/')}/api/w/{profile['workspaceId']}"
            f"/variables/get_value/u/Alp/{name}",
            headers={"Authorization": "Bearer " + profile["token"]},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    m = {k: variable("MONGODB_" + k) for k in ["USER", "PASS", "HOSTS", "DB", "RS"]}
    client = MongoClient(
        f"mongodb://{quote(m['USER'], safe='')}:{quote(m['PASS'], safe='')}"
        f"@{m['HOSTS']}/{m['DB']}?replicaSet={m['RS']}",
        serverSelectionTimeoutMS=20000,
    )
    return client, client[m["DB"]]


# ===== Import =====


def summarize(doc):
    return (
        f"tropes={len(doc.get('tropes') or [])} url={doc.get('tvtropes_url')!r} "
        f"updated_at={doc.get('updated_at')} is_selected={doc.get('is_selected')} "
        f"failed_at={doc.get('failed_at')}"
    )


def previous_values(doc):
    return {name: doc[name] if name in doc else MISSING for name in TOUCHED_FIELDS}


def dump_json(path, data):
    from bson import json_util

    tmp = Path(str(path) + ".tmp")
    tmp.write_text(json_util.dumps(data, indent=2, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def utcnow_ms():
    now = datetime.utcnow()
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def plan(key, record, manifest, deny, store):
    """Returns (action, reason, docs). Only reads."""
    docs = []
    if key in deny:
        return "skip", "denied", docs
    if key not in manifest:
        return "skip", "not in allow-file", docs
    entry = manifest[key]
    url = record["result"]["url"]
    tropes = record["result"]["tropes"]
    if url != entry["url"]:
        return "skip", f"url differs from manifest ({url})", docs
    if has_country_suffix(url) and not entry.get("country_suffixed_page"):
        return "skip", "country-suffixed page not reviewed in manifest", docs
    if tropes_sha256(tropes) != entry["tropes_sha256"]:
        return "skip", "tropes sha256 differs from manifest", docs
    docs = store.find(*key)
    if not docs:
        return "skip", "no Mongo document (initializer creates them; not creating)", docs
    if len(docs) > 1:
        return "skip", f"{len(docs)} Mongo documents for this identity", docs
    if docs[0].get("tropes"):
        return "skip", "Mongo document already has tropes", docs
    return "import", "", docs


def url_state(doc, new_url):
    previous = doc.get("tvtropes_url")
    if not previous:
        return "no-previous-url"
    return "url-same" if previous == new_url else "url-replaced"


def run_import(run_dirs, manifest, deny, store, apply, rollback_path=None, out=print, expect_count=None):
    deny = set(deny) | BUILTIN_DENY
    candidates = recovered(load_latest(run_dirs))
    if not apply:
        store = ReadOnlyStore(store)
    totals = {"import": 0, "skip": 0, "url-replaced": 0, "url-same": 0, "no-previous-url": 0}
    skips = []
    rollback = {"created_at": datetime.now(timezone.utc).isoformat(), "entries": []}
    plans = []
    for key in sorted(set(candidates) | set(manifest)):
        record = candidates.get(key)
        if record is None:
            plans.append((key, record, "skip", "in allow-file but not recovered in the runs", []))
        else:
            plans.append((key, record, *plan(key, record, manifest, deny, store)))
    planned = sum(1 for p in plans if p[2] == "import")
    if apply and planned != expect_count:
        raise SystemExit(
            f"aborted before any write: {planned} identities would be imported, --expect-count is {expect_count}"
        )
    for key, record, action, reason, docs in plans:
        title = (record or manifest[key]).get("title")
        label = f"{key[0]}:{key[1]} {title!r}"
        state = summarize(docs[0]) if docs else "no document read"
        if action == "import" and apply:
            doc = docs[0]
            written = {
                "tvtropes_url": record["result"]["url"],
                "tropes": canonical_tropes(record["result"]["tropes"]),
                "updated_at": utcnow_ms(),
                "is_selected": False,
            }
            rollback["entries"].append(
                {
                    "media_type": key[0],
                    "tmdb_id": key[1],
                    "_id": doc["_id"],
                    "previous": previous_values(doc),
                    "written_url": written["tvtropes_url"],
                    "written_tropes_sha256": tropes_sha256(written["tropes"]),
                    "written_updated_at": written["updated_at"],
                }
            )
            dump_json(rollback_path, rollback)  # before the write
            guard = {
                "_id": doc["_id"],
                "tmdb_id": key[1],
                # null matches absent too; the exact previous url and updated_at must still be there
                "tvtropes_url": doc.get("tvtropes_url"),
                "updated_at": doc.get("updated_at"),
                "$or": [{"tropes": {"$exists": False}}, {"tropes": None}, {"tropes": []}],
            }
            if store.update(key[0], guard, written, UNSET_FIELDS) != 1:
                rollback["entries"].pop()
                dump_json(rollback_path, rollback)
                action, reason = "skip", "document changed between read and write"
        if action == "import":
            totals["import"] += 1
            urls = url_state(docs[0], record["result"]["url"])
            totals[urls] += 1
            verb = "imported" if apply else "would-import"
            out(
                f"{verb:12} {label} <- {record['result']['url']} ({len(record['result']['tropes'])} tropes) "
                f"| {urls} previous_url={docs[0].get('tvtropes_url')!r} | {state}"
            )
        else:
            totals["skip"] += 1
            skips.append((key, reason))
            out(f"{'skip':12} {label}: {reason} | {state}")
    out("")
    out(f"mode: {'APPLY' if apply else 'DRY RUN (no writes)'}")
    out(f"candidates: {len(candidates)} recovered, allow-file: {len(manifest)}")
    out(f"{'imported' if apply else 'would-import'}: {totals['import']}  skipped: {totals['skip']}")
    out(
        f"  url-replaced: {totals['url-replaced']}  url-same: {totals['url-same']}  "
        f"no-previous-url: {totals['no-previous-url']}"
    )
    for key, reason in skips:
        out(f"  skipped {key[0]}:{key[1]}: {reason}")
    if apply:
        out(f"rollback file: {rollback_path}")
    return totals, skips


def run_rollback(path, store, out=print):
    from bson import json_util

    data = json_util.loads(Path(path).read_text())
    restored = skipped = 0
    for entry in data["entries"]:
        label = f"{entry['media_type']}:{entry['tmdb_id']}"
        doc = store.find_by_id(entry["media_type"], entry["_id"])
        written_at = entry["written_updated_at"].replace(tzinfo=None)
        current_at = doc.get("updated_at") if doc else None
        if current_at is not None and current_at.tzinfo is not None:
            current_at = current_at.replace(tzinfo=None)
        if (
            not doc
            or doc.get("tvtropes_url") != entry["written_url"]
            or current_at != written_at
            or tropes_sha256(doc.get("tropes") or []) != entry["written_tropes_sha256"]
        ):
            skipped += 1
            out(f"skip     {label}: document no longer holds what the import wrote")
            continue
        previous = entry["previous"]
        set_fields = {
            k: (v.replace(tzinfo=None) if isinstance(v, datetime) else v)
            for k, v in previous.items()
            if v != MISSING
        }
        unset_fields = [k for k, v in previous.items() if v == MISSING]
        guard = {"_id": entry["_id"], "tvtropes_url": entry["written_url"], "updated_at": current_at}
        if store.update(entry["media_type"], guard, set_fields, unset_fields) == 1:
            restored += 1
            out(f"restored {label}")
        else:
            skipped += 1
            out(f"skip     {label}: document changed during rollback")
    out(f"\nrestored: {restored}  skipped: {skipped}")
    return restored, skipped


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    building = argv[:1] == ["build-manifest"]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("run_dirs", nargs="*", type=Path)
    parser.add_argument("--deny", action="append", type=identity, default=[], metavar="media_type:tmdb_id")
    if building:
        parser.add_argument("--report", type=Path, required=True)
        parser.add_argument("--output", type=Path, required=True)
        parser.add_argument("--expect", type=int, default=99)
        args = parser.parse_args(argv[1:])
        if not args.run_dirs:
            parser.error("run directories required")
        manifest = build_manifest(args.run_dirs, args.report, set(args.deny) | BUILTIN_DENY, args.expect)
        args.output.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {manifest['count']} entries to {args.output}")
        return 0
    parser.add_argument("--allow-file", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expect-count", type=int, help="required with --apply: exact number of identities to import")
    parser.add_argument("--rollback", type=Path)
    parser.add_argument("--rollback-out", type=Path, help="where --apply writes its rollback record")
    args = parser.parse_args(argv)
    if args.rollback:
        client, db = connect()
        try:
            run_rollback(args.rollback, MongoStore(db))
        finally:
            client.close()
        return 0
    if not args.run_dirs or not args.allow_file:
        parser.error("run directories and --allow-file are required")
    rollback_path = None
    if args.apply:
        if args.expect_count is None:
            parser.error("--apply requires --expect-count N")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        rollback_path = args.rollback_out or Path(f"tvtropes-import-rollback-{stamp}.json")
        if rollback_path.exists():
            parser.error(f"{rollback_path} exists; rollback records are never overwritten")
    client, db = connect()
    try:
        run_import(args.run_dirs, load_manifest(args.allow_file), args.deny, MongoStore(db), args.apply, rollback_path,
                   expect_count=args.expect_count)
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
