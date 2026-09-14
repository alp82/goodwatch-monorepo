"""Shared OpenRouter spend pause for selection and concurrent fetch jobs."""
from datetime import datetime, timedelta, timezone
from math import ceil
import re

from f.db.redis import RedisConnector


PAUSE_KEY = "dna:openrouter:spend_pause"


class SpendPause:
    def __init__(self):
        self.redis = RedisConnector().get_redis()

    def is_active(self):
        return bool(self.redis.exists(PAUSE_KEY))

    def for_budget_error(self, response):
        if response is None:
            return False
        monthly = False
        if response.status_code == 403:
            try:
                message = response.json()["error"]["message"].lower()
            except (ValueError, KeyError, TypeError, AttributeError):
                return False
            # 403 also denotes permissions/content restrictions. Only an explicit
            # monthly budget exhaustion matches our provisioned monthly guardrail.
            monthly = bool(re.search(r"\bmonthly\b", message) and
                           re.search(r"\bbudget\b.*\b(exceeded|exhausted|reached)\b", message))
            if not monthly:
                return False
        elif response.status_code != 402:
            return False
        now = datetime.now(timezone.utc)
        resume_at = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        if monthly:
            resume_at = (now.replace(day=1) + timedelta(days=32)).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0)
        # Fetch jobs run concurrently: a daily rejection must never replace a
        # longer monthly pause. One-key Lua is atomic and Redis Cluster compatible.
        self.redis.eval("""
            local ttl = redis.call('PTTL', KEYS[1])
            if ttl == -2 or (ttl >= 0 and ttl < tonumber(ARGV[1])) then
                redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[1])
            end
            return 1
        """, 1, PAUSE_KEY, max(1, ceil((resume_at - now).total_seconds() * 1000)),
                   "monthly" if monthly else "daily")
        return True


def release_unprocessed(entries):
    for entry in entries:
        entry.update(set__is_selected=False, unset__selected_at=1)


def main():
    pass
