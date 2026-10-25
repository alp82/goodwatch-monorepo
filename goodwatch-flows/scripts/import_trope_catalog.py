#!/usr/bin/env python3
"""Import reviewed general trope metadata/descriptions into CrateDB. No TV Tropes requests are made.

Dry run is the default. Credentials come from CRATE_HOSTS/CRATE_USER/CRATE_PASS, or the local `goodwatch` Windmill
CLI profile. `--evidence-log` accepts the existing prototype's run log and preserves captured page hashes/dates.
The input can be the legacy {name:{text,url}} file, a record array, or {records:[...]} from a reviewed batch.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "windmill"))
from f.tvtropes_catalog.catalog import evidence_by_url, import_records, records_from_document


def settings():
    names = ("CRATE_HOSTS", "CRATE_USER", "CRATE_PASS")
    if all(os.environ.get(name) is not None for name in names):
        return {name: os.environ[name] for name in names}
    profile_path = Path.home() / ".config/windmill/remotes.ndjson"
    try:
        profile = next(json.loads(line) for line in profile_path.read_text().splitlines()
                       if json.loads(line).get("name") == "goodwatch")
    except (FileNotFoundError, StopIteration) as error:
        raise RuntimeError("Set CRATE_HOSTS/CRATE_USER/CRATE_PASS or configure the goodwatch Windmill CLI profile") from error
    values = {}
    for name in names:
        request = Request(f"{profile['remote'].rstrip('/')}/api/w/{profile['workspaceId']}/variables/get_value/u/Alp/{name}",
                          headers={"Authorization": "Bearer " + profile["token"]})
        try:
            with urlopen(request, timeout=20) as response:
                values[name] = json.load(response)
        except (HTTPError, URLError) as error:
            # HTTPError includes its URL. Do not expose private hosts or credential-bearing transport details.
            raise RuntimeError(f"Could not load {name} from the Windmill CLI profile") from None
    return values


class Crate:
    def __init__(self, config):
        self.urls = []
        for value in config["CRATE_HOSTS"].split(","):
            value = value.strip()
            if not value:
                continue
            url = value if "://" in value else "http://" + value
            parts = urlsplit(url)
            if parts.username or parts.password or parts.query or parts.fragment or parts.path not in ("", "/"):
                raise ValueError("CRATE_HOSTS must contain plain coordinator URLs without credentials, paths or queries")
            if parts.scheme not in ("http", "https") or not parts.hostname:
                raise ValueError("CRATE_HOSTS must contain HTTP coordinator URLs")
            if parts.port is None:
                url = url.rstrip("/") + ":4200"
            self.urls.append(url.rstrip("/") + "/_sql")
        if not self.urls:
            raise ValueError("CRATE_HOSTS must contain at least one coordinator")
        self.auth = base64.b64encode((config["CRATE_USER"] + ":" + config["CRATE_PASS"]).encode()).decode()

    def _sql(self, sql, params=(), *, bulk=False):
        payload = json.dumps({"stmt": sql, "bulk_args" if bulk else "args": list(params)}).encode()
        for url in self.urls:
            try:
                request = Request(url, data=payload, headers={"Content-Type": "application/json", "Authorization": "Basic " + self.auth})
                with urlopen(request, timeout=30) as response:
                    return json.load(response)
            except HTTPError as error:
                # An HTTP SQL error may have reached a write; never replay it against another coordinator.
                try:
                    body = json.load(error)
                    message = body.get("error", {}).get("message", "SQL request failed")
                    code = body.get("error", {}).get("code")
                except (ValueError, TypeError):
                    message, code = "SQL request failed", None
                raise RuntimeError(f"CrateDB SQL error ({code}): {message}") from None
            except URLError:
                # SELECT can move to another host. An ambiguous write cannot be replayed automatically.
                if not sql.lstrip().upper().startswith("SELECT"):
                    raise RuntimeError("CrateDB write transport failed; inspect state and rerun the idempotent import") from None
        raise RuntimeError("No CrateDB coordinator answered the read")

    def select(self, sql, params=()):
        result = self._sql(sql, params)
        return [dict(zip(result["cols"], row)) for row in result["rows"]]

    def run(self, sql, params=()):
        return self._sql(sql, params)

    def run_many(self, sql, params):
        response = self._sql(sql, [list(row) for row in params], bulk=True)
        results = response.get("results", [])
        failed = [row for row in results if row.get("error") or row.get("rowcount", -1) < 0]
        if len(results) != len(params) or failed:
            raise RuntimeError(f"CrateDB bulk import failed ({len(failed)} failed rows); inspect state and rerun the idempotent import")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--evidence-log", type=Path)
    parser.add_argument("--apply", action="store_true", help="Create the catalog if needed and write reviewed records")
    parser.add_argument("--replace-descriptions", action="store_true", help="Explicitly replace existing descriptions; default fills gaps only")
    parser.add_argument("--expect-count", type=int, help="Require exactly this many validated input records")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    evidence = evidence_by_url(json.loads(args.evidence_log.read_text())) if args.evidence_log else None
    rows = records_from_document(json.loads(args.input.read_text()), evidence=evidence)
    if args.expect_count is not None and len(rows) != args.expect_count:
        parser.error(f"Expected {args.expect_count} records, got {len(rows)}")
    report = import_records(Crate(settings()), rows, apply=args.apply, replace_descriptions=args.replace_descriptions)
    report["with_source_hash"] = sum(row["source_hash"] is not None for row in rows)
    report["with_fetch_date"] = sum(row["fetched_at"] is not None for row in rows)
    encoded = json.dumps(report, indent=2) + "\n"
    if args.report:
        args.report.write_text(encoded)
    print(encoded, end="")


if __name__ == "__main__":
    main()
