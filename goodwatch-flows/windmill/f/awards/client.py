# extra_requirements:
# requests
# pymongo
# mongoengine
# wmill

"""Cached Wikidata transport and a query budget shared with the existing ID backfill."""

import time
from datetime import timedelta

import requests
from f.awards.models import QID
from f.sync.copy.sync_state import utc_now
from f.tvdb.store import Busy, exclusive

USER_AGENT = "GoodWatchBot/0.1 (https://goodwatch.app; hello@goodwatch.app) awards"
ENDPOINT = "https://query.wikidata.org/sparql"
KEEP = {
    "P31",
    "P279",
    "P345",
    "P4947",
    "P4983",
    "P4985",
    "P179",
    "P361",
    "P585",
    "P393",
    "P4566",
    "P580",
    "P582",
}


class Deferred(RuntimeError):
    pass


class BudgetedHTTP:
    def __init__(self, db, http=None, sleep=time.sleep, timer=time.monotonic):
        self.db, self.http, self.sleep, self.timer = (
            db,
            http or requests.Session(),
            sleep,
            timer,
        )

    def get(self, url, **kwargs):
        for _ in range(90):
            try:
                return self._get(url, **kwargs)
            except Busy:
                self.sleep(2)
        raise Deferred("Wikidata query budget stayed busy")

    def _get(self, url, **kwargs):
        with exclusive(self.db, "wikidata-query", 3):
            state = self.db.award_state.find_one({"_id": "wikidata-budget"}) or {}
            now = utc_now()
            if state.get("blocked_until", now) > now:
                raise Deferred("Wikidata cooldown active")
            delay = max(0, (state.get("next_at", now) - now).total_seconds())
            self.sleep(delay)
            start = self.timer()
            try:
                params = kwargs.get("params") or {}
                if url == ENDPOINT and len(params.get("query", "")) > 3500:
                    kwargs["data"] = kwargs.pop("params")
                    response = self.http.post(url, **kwargs)
                else:
                    response = self.http.get(url, **kwargs)
                if response.status_code == 429:
                    try:
                        retry = max(60, int(response.headers.get("Retry-After", "60")))
                    except ValueError:
                        retry = 60
                    self.db.award_state.update_one(
                        {"_id": "wikidata-budget"},
                        {
                            "$set": {
                                "blocked_until": utc_now() + timedelta(seconds=retry)
                            }
                        },
                        upsert=True,
                    )
                    raise Deferred("Wikidata rate limited; source scope retained")
                return response
            finally:
                elapsed = self.timer() - start
                self.db.award_state.update_one(
                    {"_id": "wikidata-budget"},
                    {
                        "$set": {
                            "next_at": utc_now() + timedelta(seconds=max(1, elapsed))
                        }
                    },
                    upsert=True,
                )


class Client:
    def __init__(self, db, http=None):
        self.db = db
        self.http = http or requests.Session()
        self.http.headers.update({"User-Agent": USER_AGENT})
        self.budget = BudgetedHTTP(db, self.http)
        self.deadline = None

    def check_deadline(self):
        if self.deadline and time.monotonic() >= self.deadline:
            raise Deferred("Award worker time budget reached; resume next run")

    def query(self, query):
        self.check_deadline()
        response = self.budget.get(
            ENDPOINT,
            params={"query": query, "format": "json"},
            headers={
                "Accept": "application/sparql-results+json",
                "User-Agent": USER_AGENT,
            },
            timeout=(10, 65),
        )
        if not response.ok:
            raise RuntimeError(f"Wikidata query HTTP {response.status_code}")
        body = response.json()
        rows = body.get("results", {}).get("bindings")
        if not isinstance(rows, list):
            raise TypeError("Incomplete Wikidata query response")
        return rows

    def entities(self, qids, refresh=False):
        qids = {q for q in qids if isinstance(q, str) and QID.fullmatch(q)}
        cached = (
            {
                d["_id"]: d["entity"]
                for d in self.db.award_wikidata_entities.find(
                    {"_id": {"$in": list(qids)}, "expires_at": {"$gt": utc_now()}}
                )
            }
            if not refresh
            else {}
        )
        missing = sorted(qids - set(cached))
        for offset in range(0, len(missing), 50):
            self.check_deadline()
            batch = missing[offset : offset + 50]
            response = self.http.get(
                "https://www.wikidata.org/w/api.php",
                params={
                    "action": "wbgetentities",
                    "ids": "|".join(batch),
                    "props": "info|claims|labels",
                    "languages": "en|mul",
                    "redirects": "yes",
                    "format": "json",
                    "maxlag": 5,
                },
                timeout=(10, 45),
            )
            if response.status_code == 429:
                raise Deferred("Wikidata entity API rate limited")
            response.raise_for_status()
            body = response.json()
            if "error" in body or not isinstance(body.get("entities"), dict):
                raise ValueError("Incomplete Wikidata entity response")
            redirects = {d["from"]: d["to"] for d in body.get("redirects", [])}
            for qid in batch:
                target = redirects.get(qid, qid)
                value = body["entities"].get(target)
                if value is None:
                    raise ValueError("Missing Wikidata entity in batch response")
                entity = {
                    k: v
                    for k, v in value.items()
                    if k in {"id", "labels", "lastrevid", "missing"}
                }
                entity["claims"] = {
                    p: cs for p, cs in value.get("claims", {}).items() if p in KEEP
                }
                self.db.award_wikidata_entities.update_one(
                    {"_id": qid},
                    {
                        "$set": {
                            "entity": entity,
                            "fetched_at": utc_now(),
                            "expires_at": utc_now() + timedelta(days=7),
                        }
                    },
                    upsert=True,
                )
                cached[qid] = entity
        return cached


def main():
    """Importable Wikimedia transport."""
