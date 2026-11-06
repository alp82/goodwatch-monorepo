# extra_requirements:
# requests
# pymongo
# wmill

"""Authenticated TVDB transport. One shared request budget for all TVDB jobs."""

import time
from datetime import timedelta
from email.utils import parsedate_to_datetime

import requests
from f.critic_sites.polite_http import claim_slot
from f.sync.copy.sync_state import utc_now

BASE = "https://api4.thetvdb.com/v4"
INTERVAL = 0.25  # At most four requests/second across all workers; lower on 429.


class ApiError(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"TVDB HTTP {status}")


class Deferred(RuntimeError):
    pass


class Client:
    def __init__(self, db, key, session=None, clock=utc_now, sleep=time.sleep):
        self.db, self.key = db, key
        self.session = session or requests.Session()
        self.clock, self.sleep = clock, sleep
        self.token = None
        self.requests = 0

    def request(self, method, path, **kwargs):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("TVDB relative API path required")
        now = self.clock()
        state = self.db.tvdb_state.find_one({"_id": "api"}) or {}
        if state.get("blocked_until", now) > now:
            raise Deferred("TVDB shared cooldown active")
        slot = claim_slot(self.db, "tvdb-api", self.clock, INTERVAL)
        self.sleep(max(0, (slot - self.clock()).total_seconds()))
        self.requests += 1
        try:
            response = self.session.request(
                method, BASE + path, timeout=(5, 40), **kwargs
            )
        except requests.RequestException:
            # Never include a requests exception: it can contain authentication headers/body.
            raise ApiError(0) from None
        if response.status_code == 429:
            value = response.headers.get("Retry-After", "")
            try:
                seconds = int(value)
            except ValueError:
                try:
                    seconds = int(
                        parsedate_to_datetime(value).timestamp() - now.timestamp()
                    )
                except (ValueError, TypeError, OverflowError):
                    seconds = 60
            self.db.tvdb_state.update_one(
                {"_id": "api"},
                {
                    "$max": {
                        "blocked_until": self.clock()
                        + timedelta(seconds=max(60, seconds))
                    }
                },
                upsert=True,
            )
            raise Deferred("TVDB rate limit; remaining work deferred")
        return response

    def login(self):
        response = self.request("POST", "/login", json={"apikey": self.key})
        if response.status_code != 200:
            raise ApiError(response.status_code)
        self.token = response.json().get("data", {}).get("token")
        if not self.token:
            raise ValueError("TVDB login returned no token")

    def get(self, path):
        if not self.token:
            self.login()
        for attempt in range(3):
            response = self.request(
                "GET", path, headers={"Authorization": "Bearer " + self.token}
            )
            if response.status_code == 401 and attempt == 0:
                self.login()
                continue
            if response.status_code >= 500 and attempt < 2:
                self.sleep(2**attempt)
                continue
            if response.status_code != 200:
                raise ApiError(response.status_code)
            body = response.json()
            if body.get("status") != "success" or "data" not in body:
                raise ValueError("TVDB response lacks successful data envelope")
            return body
        raise ApiError(401)


def main():
    """Importable transport; jobs read the secret only at runtime."""
