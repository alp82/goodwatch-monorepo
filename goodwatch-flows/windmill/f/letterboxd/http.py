# extra_requirements:
# requests
# pymongo

"""Plain HTTP: every redirect hop shares the site's pace and block deadline."""
import time
from datetime import datetime
from urllib.parse import urljoin, urlsplit

import requests

from f.critic_sites import polite_http as shared

SITE = "letterboxd"
USER_AGENT = "GoodWatchBot/0.1 (+https://goodwatch.app; hello@goodwatch.app) letterboxd-scores"


class Client:
    def __init__(self, db, session=None, clock=datetime.utcnow, sleep=time.sleep):
        self.db, self.clock, self.sleep = db, clock, sleep
        self.session = session or requests.Session()
        self.requests = 0

    def get(self, url):
        requested = url
        for _ in range(6):
            parts = urlsplit(url)
            if parts.scheme != "https" or parts.netloc != "letterboxd.com":
                raise shared.FetchError("redirect outside Letterboxd")
            until = shared.blocked_until(self.db, SITE, self.clock())
            if until:
                raise shared.SiteBlocked(SITE, until, "blocked earlier")
            slot = shared.claim_slot(self.db, SITE, self.clock, shared.REQUEST_INTERVAL_SECONDS)
            wait = (slot - self.clock()).total_seconds()
            if wait > 0:
                self.sleep(wait)
            # Another worker may have recorded a source block while this slot waited.
            until = shared.blocked_until(self.db, SITE, self.clock())
            if until:
                raise shared.SiteBlocked(SITE, until, "blocked while waiting for request slot")
            try:
                response = self.session.get(url, headers={**shared.HEADERS, "User-Agent": USER_AGENT},
                                            timeout=shared.TIMEOUT_SECONDS, allow_redirects=False)
            except requests.RequestException as error:
                raise shared.FetchError(f"{type(error).__name__} for {url}") from error
            finally:
                self.requests += 1
            reason = shared.block_reason(response.status_code, response.headers, response.text)
            if reason:
                now = self.clock()
                until = shared.block_deadline(response.status_code, response.headers, now)
                shared.record_block(self.db, SITE, until, reason, url, response.status_code, now)
                raise shared.SiteBlocked(SITE, until, reason)
            if response.status_code in (301, 302, 303, 307, 308):
                if not response.headers.get("Location"):
                    raise shared.FetchError("redirect without Location")
                url = urljoin(url, response.headers["Location"])
                continue
            return shared.Page(response.status_code, url, response.text, requested)
        raise shared.FetchError("too many redirects")


def main():
    pass
