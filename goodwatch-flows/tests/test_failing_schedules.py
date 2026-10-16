"""Failing-schedule alerts: the failing rule and the alerted-set transitions."""

import copy
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.failing_schedules import assess, plan, run_check

NOW = datetime(2026, 10, 16, 12, tzinfo=timezone.utc)
WEBHOOK = "https://discord.com/api/webhooks/123/token"
EPISODES = "f/sync/copy/tmdb_episodes"
CRITICS = "f/critic_sites/directory_rotten_tomatoes"


def job(index: int, success: bool, age: timedelta) -> dict:
    return {
        "id": f"01a14698-8351-365d-9c5f-{index:012d}",
        "success": success,
        "started_at": (NOW - age).isoformat().replace("+00:00", "Z"),
        "duration_ms": 2000,
    }


def runs(*outcomes: bool, every: timedelta = timedelta(minutes=5)) -> list:
    """Newest first: runs(False, True) is a failure after a success."""
    return [job(i, ok, every * (i + 1)) for i, ok in enumerate(outcomes)]


class Windmill:
    """Fake Windmill API: schedules and their newest-first completed roots."""

    def __init__(self, schedules: dict, disabled=()) -> None:
        self.schedules = schedules
        self.disabled = set(disabled)
        self.calls = []

    def __call__(self, path: str):
        self.calls.append(path)
        if path.startswith("schedules/list"):
            return [
                {"path": p, "enabled": p not in self.disabled}
                for p in self.schedules
            ]
        query = dict(part.split("=", 1) for part in path.split("?", 1)[1].split("&"))
        assert query["has_null_parent"] == "true"
        assert query["is_skipped"] == "false"
        history = self.schedules[query["schedule_path"]]
        if isinstance(history, Exception):
            raise history
        if query.get("success") == "true":
            history = [run for run in history if run["success"]]
        return history[: int(query["per_page"])]


class Discord:
    def __init__(self, *results: dict) -> None:
        self.results = list(results)
        self.sent = []

    def __call__(self, url: str, notice: dict) -> dict:
        self.sent.append(notice)
        if self.results:
            return self.results.pop(0)
        return delivered(str(len(self.sent)))


def delivered(message_id: str = "1") -> dict:
    return {"delivered": True, "message_id": message_id, "error_code": None,
            "retry_after_seconds": 0, "permanent_failure": False}


def undelivered(code: str = "transport_error", delay: float = 1800) -> dict:
    return {"delivered": False, "message_id": None, "error_code": code,
            "retry_after_seconds": delay, "permanent_failure": False}


class StateStore:
    def __init__(self, value=None) -> None:
        self.value = copy.deepcopy(value)
        self.saves = 0

    def load(self):
        return copy.deepcopy(self.value)

    def save(self, value) -> None:
        self.saves += 1
        self.value = copy.deepcopy(value)


def check(api, store, discord, webhook=WEBHOOK, now=NOW):
    return run_check(api, store.load, store.save, webhook,
                     deliver=discord, clock=lambda: now)


class AssessTests(unittest.TestCase):
    def test_three_failures_in_a_row_are_failing_despite_a_recent_success(self) -> None:
        recent = NOW - timedelta(minutes=20)
        self.assertTrue(assess(runs(False, False, False, True), recent, NOW))

    def test_two_failures_after_a_recent_success_are_not_failing(self) -> None:
        recent = NOW - timedelta(minutes=15)
        self.assertFalse(assess(runs(False, False, True), recent, NOW))

    def test_one_failure_after_a_success_20_hours_old_is_failing(self) -> None:
        self.assertTrue(assess(runs(False, True), NOW - timedelta(hours=20), NOW))
        self.assertFalse(
            assess(runs(False, True), NOW - timedelta(hours=19, minutes=59), NOW)
        )

    def test_a_failure_with_no_success_ever_is_failing(self) -> None:
        self.assertTrue(assess(runs(False), None, NOW))

    def test_a_successful_newest_run_or_no_run_is_not_failing(self) -> None:
        self.assertFalse(assess(runs(True, False, False, False), NOW, NOW))
        self.assertFalse(assess([], None, NOW))


class ObservationTests(unittest.TestCase):
    def test_last_success_older_than_the_window_is_looked_up(self) -> None:
        # Ten failures every 5 minutes, then a success 2 days ago.
        history = runs(*[False] * 10) + [job(10, True, timedelta(days=2))]
        api = Windmill({EPISODES: history})
        result = check(api, StateStore(), Discord(), webhook=None)
        observed = result["observed"][EPISODES]
        self.assertTrue(observed["failing"])
        self.assertEqual(observed["last_success_job_id"], history[10]["id"])
        self.assertTrue(any("success=true" in call for call in api.calls))

    def test_no_lookup_when_the_newest_run_succeeded(self) -> None:
        api = Windmill({EPISODES: runs(True, False)})
        check(api, StateStore(), Discord(), webhook=None)
        self.assertFalse(any("success=true" in call for call in api.calls))

    def test_weekly_schedule_that_never_succeeded_is_failing(self) -> None:
        week = timedelta(days=7)
        api = Windmill({CRITICS: runs(False, False, every=week)})
        result = check(api, StateStore(), Discord(), webhook=None)
        self.assertEqual(result["failing"], [CRITICS])
        self.assertIsNone(result["observed"][CRITICS]["last_success_at"])


class TransitionTests(unittest.TestCase):
    def test_new_failure_sends_one_incident_linking_the_newest_run(self) -> None:
        history = runs(False, False, False)
        store, discord = StateStore(), Discord()
        result = check(Windmill({EPISODES: history}), store, discord)
        self.assertEqual(discord.sent, [{
            "kind": "incident", "pipeline": EPISODES,
            "causes": ["consecutive_failures"], "job_id": history[0]["id"],
        }])
        self.assertEqual(store.value["schedules"][EPISODES]["status"], "alerted")
        self.assertEqual(result["deliveries"][0]["message_id"], "1")

    def test_still_failing_sends_nothing_more(self) -> None:
        api = Windmill({EPISODES: runs(False, False, False)})
        store, discord = StateStore(), Discord()
        check(api, store, discord)
        api.schedules[EPISODES] = runs(False, False, False, False)
        check(api, store, discord)
        self.assertEqual(len(discord.sent), 1)
        self.assertEqual(store.value["schedules"][EPISODES]["status"], "alerted")

    def test_recovery_sends_one_message_and_leaves_the_set(self) -> None:
        api = Windmill({EPISODES: runs(False, False, False)})
        store, discord = StateStore(), Discord()
        check(api, store, discord)
        api.schedules[EPISODES] = runs(True, False, False, False)
        check(api, store, discord)
        check(api, store, discord)
        self.assertEqual([n["kind"] for n in discord.sent], ["incident", "recovery"])
        self.assertEqual(store.value["schedules"], {})

    def test_failed_incident_delivery_is_retried_on_the_next_run(self) -> None:
        api = Windmill({EPISODES: runs(False, False, False)})
        store = StateStore()
        first = check(api, store, Discord(undelivered()))
        self.assertFalse(first["deliveries"][0]["delivered"])
        self.assertEqual(
            store.value["schedules"][EPISODES]["status"], "incident_pending"
        )
        discord = Discord()
        check(api, store, discord, now=NOW + timedelta(minutes=10))
        self.assertEqual([n["kind"] for n in discord.sent], ["incident"])
        self.assertEqual(store.value["schedules"][EPISODES]["status"], "alerted")

    def test_failed_recovery_delivery_is_retried_on_the_next_run(self) -> None:
        store = StateStore({"schedules": {EPISODES: {
            "status": "alerted", "job_id": runs(False)[0]["id"]}}})
        api = Windmill({EPISODES: runs(True, False)})
        check(api, store, Discord(undelivered()))
        self.assertEqual(
            store.value["schedules"][EPISODES]["status"], "recovery_pending"
        )
        discord = Discord()
        check(api, store, discord)
        self.assertEqual([n["kind"] for n in discord.sent], ["recovery"])
        self.assertEqual(store.value["schedules"], {})

    def test_failing_again_before_the_recovery_was_delivered_stays_alerted(self) -> None:
        store = StateStore({"schedules": {EPISODES: {
            "status": "recovery_pending", "job_id": runs(False)[0]["id"]}}})
        discord = Discord()
        check(Windmill({EPISODES: runs(False, False, False)}), store, discord)
        self.assertEqual(discord.sent, [])
        self.assertEqual(store.value["schedules"][EPISODES]["status"], "alerted")

    def test_recovered_before_the_incident_was_delivered_sends_nothing(self) -> None:
        store = StateStore({"schedules": {EPISODES: {
            "status": "incident_pending", "job_id": runs(False)[0]["id"]}}})
        discord = Discord()
        check(Windmill({EPISODES: runs(True)}), store, discord)
        self.assertEqual(discord.sent, [])
        self.assertEqual(store.value["schedules"], {})

    def test_disabled_schedule_leaves_the_set_without_a_message(self) -> None:
        store = StateStore({"schedules": {EPISODES: {
            "status": "alerted", "job_id": runs(False)[0]["id"]}}})
        discord = Discord()
        api = Windmill({EPISODES: runs(False, False, False)}, disabled={EPISODES})
        result = check(api, store, discord)
        self.assertEqual(discord.sent, [])
        self.assertEqual(store.value["schedules"], {})
        self.assertNotIn(EPISODES, result["observed"])
        self.assertFalse(any("schedule_path" in call for call in api.calls))

    def test_unreadable_history_keeps_the_entry_and_sends_nothing(self) -> None:
        entry = {"status": "alerted", "job_id": runs(False)[0]["id"]}
        store = StateStore({"schedules": {EPISODES: entry}})
        discord = Discord()
        result = check(Windmill({EPISODES: RuntimeError("HTTP 500")}), store, discord)
        self.assertEqual(discord.sent, [])
        self.assertEqual(store.value["schedules"][EPISODES], entry)
        self.assertEqual(result["unreadable"], [EPISODES])

    def test_one_failed_delivery_defers_the_rest_of_the_run(self) -> None:
        api = Windmill({
            CRITICS: runs(False, False, False),
            EPISODES: runs(False, False, False),
        })
        store, discord = StateStore(), Discord(undelivered())
        result = check(api, store, discord)
        self.assertEqual(len(discord.sent), 1)
        self.assertEqual(
            [d["error_code"] for d in result["deliveries"]],
            ["transport_error", "deferred"],
        )
        self.assertEqual(
            {s["status"] for s in store.value["schedules"].values()},
            {"incident_pending"},
        )

    def test_rate_limit_delays_retries_until_discord_allows_them(self) -> None:
        api = Windmill({EPISODES: runs(False, False, False)})
        store = StateStore()
        check(api, store, Discord(undelivered("rate_limited", 900)))
        early = Discord()
        check(api, store, early, now=NOW + timedelta(minutes=10))
        self.assertEqual(early.sent, [])
        later = Discord()
        check(api, store, later, now=NOW + timedelta(minutes=20))
        self.assertEqual(len(later.sent), 1)
        self.assertIsNone(store.value["retry_at"])

    def test_without_a_webhook_nothing_is_sent_or_saved(self) -> None:
        store, discord = StateStore(), Discord()
        result = check(
            Windmill({EPISODES: runs(False, False, False)}), store, discord,
            webhook=None,
        )
        self.assertEqual(discord.sent, [])
        self.assertEqual(store.saves, 0)
        self.assertEqual(result["failing"], [EPISODES])


class PlanTests(unittest.TestCase):
    def test_pending_incident_keeps_its_first_job_link(self) -> None:
        state, owed = plan(
            {EPISODES: {"status": "incident_pending", "job_id": "first"}},
            {EPISODES: {"failing": True, "newest_job_id": "newer"}},
        )
        self.assertEqual(owed[0]["job_id"], "first")
        self.assertEqual(state[EPISODES]["job_id"], "first")


if __name__ == "__main__":
    unittest.main()
