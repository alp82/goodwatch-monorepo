"""Full-catalog queue, source evidence, replayable writes, pacing and hard stops without network access."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError

import requests

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / "windmill"), str(FLOWS / "scripts")]
from f.tvtropes_catalog.catalog import FIELDS
from recover_tvtropes import LocalClient, State, utcnow
spec = importlib.util.spec_from_file_location("populate_trope_catalog_test", FLOWS / "scripts/populate_trope_catalog.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def entry(index, url=None):
    return {"name": f"Trope {index:05}", "url": url or f"https://tvtropes.org/pmwiki/pmwiki.php/Main/Trope{index}", "description": None}


class Database:
    def __init__(self, rows, *, fail_writes=False):
        self.rows = {row["name"]: dict(row) for row in rows}
        self.reads = []
        self.fail_writes = fail_writes

    def select(self, sql, params=()):
        self.reads.append((sql, params))
        if "information_schema.tables" in sql:
            return [{"table_name": "trope_catalog"}]
        if "description IS NOT NULL" in sql:
            return [{"name": name} for name in params if name in self.rows and self.rows[name].get("description") is not None]
        if "description IS NULL" in sql:
            names = [name for name in sorted(self.rows) if self.rows[name].get("description") is None and (not params or name > params[0])]
            limit = int(re.search(r"LIMIT (\d+)", sql).group(1))
            return [{"name": name, "url": self.rows[name]["url"]} for name in names[:limit]]
        return [self.rows[name] for name in params if name in self.rows]

    def run(self, sql, params=()):
        if self.fail_writes:
            raise RuntimeError("SUPER_SECRET_DO_NOT_LOG")
        if sql.startswith("INSERT"):
            row = dict(zip(FIELDS, params))
            if self.rows[row["name"]].get("description") is None:
                self.rows[row["name"]].update(row)


class HTTP:
    def __init__(self, *, statuses=None, network_failures=False):
        self.calls = []
        self.statuses = statuses or {}
        self.network_failures = network_failures

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.network_failures:
            raise requests.exceptions.Timeout("SUPER_SECRET_DO_NOT_LOG")
        status = self.statuses.get(url, 200)
        text = "A complete, meaningful general trope definition is stored with its source evidence."
        return SimpleNamespace(status_code=status, url=url, text=text, content=text.encode(), headers={})


def extract(html, name, url, *, requested_url=None):
    return {"description": html, "error": None, "heading": name, "canonical_url": url}


class PopulationTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.output = self.root / "run"
        self.output.mkdir()
        self.http = HTTP()
        self.events = []

    def tearDown(self):
        self.directory.cleanup()

    def client(self, http=None):
        ticks = [100.0]
        return LocalClient(self.output / "sources", 6, float("inf"), http=http or self.http,
                           sleep=lambda n: ticks.__setitem__(0, ticks[0]+n), clock=lambda: ticks[0])

    def run_worker(self, db, *, client=None, **kwargs):
        return worker.run(db, self.output, client=client or self.client(), extractor=kwargs.pop("extractor", extract),
                          state_path=self.root / "state.json", lock_path=self.root / "worker.lock", pace_path=self.root / "pace.json",
                          emit=self.events.append, **kwargs)

    def test_label_catalog_carries_the_extracted_document(self):
        value = {'v': 1, 'source': 'crawl', 'blocks': [{'kind': 'p', 'text': 'An actual source definition.'}]}
        result = {**extract('An actual source definition.', 'Trope 00001', entry(1)['url']), 'description_doc': value}
        row = worker.LabelCatalog.record(entry(1), result, {'sha256': 'a' * 64, 'started_at': '2026-10-25T00:00:00Z'}, None)
        self.assertEqual(json.loads(row['description_doc']), value)

    def test_all_missing_names_are_keyset_paginated_past_the_first_thousand(self):
        db = Database([entry(i) for i in range(1005)])
        queued = list(worker.missing_entries(db))
        self.assertEqual(len(queued), 1005)
        self.assertEqual(len(db.reads), 2)
        self.assertTrue(all("OFFSET" not in sql for sql, _ in db.reads))
        self.assertEqual(db.reads[1][1], ("Trope 00999",))

    def test_real_parser_recovers_an_exact_old_name_from_source_redirect_evidence(self):
        old = "https://tvtropes.org/pmwiki/pmwiki.php/Main/OldName"
        canonical = "https://tvtropes.org/pmwiki/pmwiki.php/Main/NewName"
        html = (f'<html><head><link rel="canonical" href="{canonical}"></head><body>'
                '<h1>New Name</h1><div id="main-article"><p>'
                'A complete source definition for the same trope under its current name.'
                '</p><hr></div></body></html>')
        http = SimpleNamespace(get=lambda url, **kwargs: SimpleNamespace(
            status_code=200, url=canonical + "?from=Main.OldName", text=html,
            content=html.encode(), headers={}))
        db = Database([{"name": "Old Name", "url": old, "description": None}])
        result = self.run_worker(db, client=self.client(http), extractor=None)
        self.assertEqual(result["stored"], 1)
        self.assertEqual(result["review"], 0)
        self.assertEqual(db.rows["Old Name"]["url"], canonical)
        self.assertTrue(db.rows["Old Name"]["source_hash"])

    def test_all_mode_has_no_two_hundred_request_stop(self):
        db = Database([entry(i) for i in range(205)])
        result = self.run_worker(db, all_requests=True)
        self.assertEqual(result["stored"], 205)
        self.assertEqual(result["requests"], 205)
        self.assertIsNone(result["stop"])
        self.assertEqual(result["phase"], "complete")
        self.assertEqual(len(list((self.output / "sources").glob("*.gz"))), 1)  # Identical bytes share a hash.
        self.assertEqual(len(worker.read_journal(self.output / "requests.jsonl")), 205)

    def test_bounded_run_resumes_without_refetching_completed_sources(self):
        db = Database([entry(i) for i in range(3)])
        first = self.run_worker(db, max_requests=2)
        self.assertEqual(first["stored"], 2)
        self.assertEqual(first["stop"], "request_budget_exhausted")
        second = self.run_worker(db, max_requests=2)
        self.assertEqual(second["stored"], 3)
        self.assertEqual(len(self.http.calls), 3)
        self.assertEqual(second["requests"], 3)

    def test_priority_order_preserves_saved_queue_and_six_second_request_spacing(self):
        rows = [entry(i) for i in range(4)]
        db = Database(rows)
        worker.prepare_queue(db, self.output)
        queue_path = self.output / "queue.json"
        original_queue = queue_path.read_bytes()
        original_manifest = (self.output / "queue-manifest.json").read_bytes()
        priority = self.root / "priority.json"
        priority.write_text(json.dumps([rows[3]["name"], rows[1]["name"]]))
        wall, requested_at = [100.0], []
        original_get = self.http.get
        def get(url, **kwargs):
            requested_at.append(wall[0])
            return original_get(url, **kwargs)
        self.http.get = get
        client = worker.DurablePacedClient(
            self.output / "sources", 6, float("inf"), http=self.http,
            sleep=lambda seconds: wall.__setitem__(0, wall[0] + seconds),
            clock=lambda: wall[0], wall_clock=lambda: wall[0], pace_path=self.root / "pace.json")
        result = self.run_worker(db, client=client, priority_names=priority)
        self.assertEqual([url for url, _ in self.http.calls], [rows[i]["url"] for i in (3, 1, 0, 2)])
        self.assertEqual(requested_at, [100.0, 106.0, 112.0, 118.0])
        self.assertEqual(queue_path.read_bytes(), original_queue)
        self.assertEqual((self.output / "queue-manifest.json").read_bytes(), original_manifest)
        self.assertEqual(json.loads(original_manifest)["sha256"], hashlib.sha256(queue_path.read_bytes()).hexdigest())
        self.assertEqual(result["priority_names"], {"names": 2, "sha256": hashlib.sha256(priority.read_bytes()).hexdigest()})

    def test_priority_resume_skips_completed_priority_and_keeps_remaining_order(self):
        rows = [entry(i) for i in range(3)]
        db = Database(rows)
        priority = self.root / "priority.json"
        priority.write_text(json.dumps([rows[2]["name"]]))
        first = self.run_worker(db, max_requests=1, priority_names=priority)
        self.assertEqual(first["stored"], 1)
        self.assertIsNotNone(db.rows[rows[2]["name"]]["description"])
        queue_hash = hashlib.sha256((self.output / "queue.json").read_bytes()).hexdigest()
        second = self.run_worker(db, priority_names=priority)
        self.assertEqual(second["stored"], 3)
        self.assertEqual([url for url, _ in self.http.calls], [rows[i]["url"] for i in (2, 0, 1)])
        self.assertEqual(len(worker.read_journal(self.output / "requests.jsonl")), 3)
        self.assertEqual(hashlib.sha256((self.output / "queue.json").read_bytes()).hexdigest(), queue_hash)

    def test_invalid_priority_inputs_fail_before_any_http(self):
        db = Database([entry(1), entry(2)])
        worker.prepare_queue(db, self.output)
        queue = (self.output / "queue.json").read_bytes()
        priority = self.root / "priority.json"
        for value in ("{", json.dumps({"names": [entry(1)["name"]]}), json.dumps([None]),
                      json.dumps([entry(1)["name"], entry(1)["name"]]), json.dumps(["trope 00001"])):
            with self.subTest(value=value):
                priority.write_text(value)
                with self.assertRaisesRegex(ValueError, "Priority names"):
                    self.run_worker(db, priority_names=priority)
                self.assertEqual(self.http.calls, [])
                self.assertEqual((self.output / "queue.json").read_bytes(), queue)
                self.assertFalse((self.output / "requests.jsonl").exists())

    def test_ready_evidence_retries_failed_database_write_without_any_new_http(self):
        db = Database([entry(1)], fail_writes=True)
        first = self.run_worker(db)
        self.assertEqual(first["ready"], 1)
        self.assertEqual(first["stop"], "worker_error:RuntimeError")
        db.fail_writes = False
        second = self.run_worker(db)
        self.assertEqual(second["stored"], 1)
        self.assertEqual(len(self.http.calls), 1)
        self.assertNotIn("SUPER_SECRET", json.dumps(self.events))
        self.assertNotIn("SUPER_SECRET", (self.output / "outcomes.jsonl").read_text())

    def test_semantic_rejections_continue_instead_of_triggering_network_stop(self):
        db = Database([entry(i) for i in range(4)])
        def semantic(html, name, url, *, requested_url=None):
            return extract(html, name, url) if name.endswith("00003") else {"description": None, "error": "ambiguous introduction"}
        result = self.run_worker(db, extractor=semantic)
        self.assertEqual(result["review"], 3)
        self.assertEqual(result["stored"], 1)
        self.assertEqual(len(self.http.calls), 4)
        self.assertEqual(result["phase"], "needs_review")

    def test_three_network_failures_stop_and_leave_remaining_queue_pending(self):
        db = Database([entry(i) for i in range(5)])
        result = self.run_worker(db, client=self.client(HTTP(network_failures=True)))
        self.assertEqual(result["requests"], 3)
        self.assertEqual(result["fetch_error"], 3)
        self.assertEqual(result["stop"], "three_consecutive_network_or_server_failures")
        self.assertNotIn("SUPER_SECRET", json.dumps(self.events))

    def test_source_block_is_saved_and_never_retried_through_its_deadline(self):
        row = entry(1)
        db = Database([row, entry(2)])
        http = HTTP(statuses={row["url"]:403})
        first = self.run_worker(db, client=self.client(http))
        self.assertEqual(first["stop"], "source_blocked_no_retry")
        self.assertEqual(first["requests"], 1)
        self.assertIsNotNone(State(self.root / "state.json").blocked(utcnow()))
        source = worker.read_journal(self.output / "requests.jsonl")[0]
        self.assertEqual(source["status"], 403)
        self.assertEqual(gzip.decompress((self.output / source["source_file"]).read_bytes()).decode(), "A complete, meaningful general trope definition is stored with its source evidence.")
        again = self.run_worker(db, client=self.client(http))
        self.assertEqual(again["stop"], "source_blocked_until_recorded_deadline")
        self.assertEqual(len(http.calls), 1)

    def test_source_block_also_applies_to_a_different_run_and_local_state_file(self):
        row = entry(1)
        db = Database([row])
        http = HTTP(statuses={row["url"]:403})
        self.run_worker(db,client=self.client(http))
        other = self.root / "other-run"
        result = worker.run(db,other,client=self.client(http),extractor=extract,
                            state_path=self.root/"different-state.json",lock_path=self.root/"worker.lock",
                            pace_path=self.root/"pace.json",emit=self.events.append)
        self.assertEqual(result["stop"],"source_blocked_until_recorded_deadline")
        self.assertEqual(len(http.calls),1)

    def test_shared_source_url_is_replayed_for_an_alias_without_second_request(self):
        first = entry(1)
        db = Database([first, entry(2, first["url"])])
        def strict(html, name, url, *, requested_url=None):
            return extract(html,name,url) if name==first["name"] else {"description":None,"error":"heading mismatch"}
        result = self.run_worker(db, extractor=strict, max_requests=1)
        self.assertEqual(result["stored"], 1)
        self.assertEqual(result["review"], 1)
        self.assertEqual(len(self.http.calls), 1)
        requests_log = worker.read_journal(self.output / "requests.jsonl")
        self.assertEqual(len(requests_log), 2)
        self.assertEqual(requests_log[0]["started_at"], requests_log[1]["started_at"])

    def test_external_review_fill_is_reconciled_without_another_source_request(self):
        db = Database([entry(1)])
        reject = lambda html,name,url,**kwargs: {"description":None,"error":"manual check required"}
        first = self.run_worker(db,extractor=reject)
        self.assertEqual(first["review"],1)
        db.rows[entry(1)["name"]]["description"] = "A reviewed description imported by another task."
        second = self.run_worker(db)
        self.assertEqual(second["review"],0)
        self.assertEqual(second["already_present"],1)
        self.assertEqual(second["phase"],"complete")
        self.assertEqual(len(self.http.calls),1)

    def test_external_fill_during_a_pass_spares_the_upcoming_source_request(self):
        first, second = entry(1), entry(2)
        db = Database([first, second])
        http = HTTP()
        original_get = http.get
        def filling_get(url, **kwargs):
            response = original_get(url, **kwargs)
            db.rows[second["name"]]["description"] = "A verified archive import filled this row during the pass."
            return response
        http.get = filling_get
        result = self.run_worker(db, client=self.client(http))
        self.assertEqual(len(http.calls), 1)
        self.assertEqual(result["stored"], 1)
        self.assertEqual(result["already_present"], 1)
        self.assertEqual(result["phase"], "complete")

    def test_final_reconciliation_resolves_an_earlier_review_filled_during_the_pass(self):
        first, second = entry(1), entry(2)
        db = Database([first, second])
        http = HTTP()
        original_get = http.get
        def filling_get(url, **kwargs):
            if url == second["url"]:
                db.rows[first["name"]]["description"] = "A reviewed definition arrived after the first entry was rejected."
            return original_get(url, **kwargs)
        http.get = filling_get
        def reviewing_extract(html, name, url, **kwargs):
            return {"description": None, "error": "review required"} if name == first["name"] else extract(html, name, url)
        result = self.run_worker(db, client=self.client(http), extractor=reviewing_extract)
        self.assertEqual(result["review"], 0)
        self.assertEqual(result["already_present"], 1)
        self.assertEqual(result["phase"], "complete")

    def test_stored_status_cannot_hide_an_actually_null_database_description(self):
        db = Database([entry(1)])
        self.assertEqual(self.run_worker(db)["stored"],1)
        db.rows[entry(1)["name"]]["description"] = None
        again = self.run_worker(db)
        self.assertEqual(again["stored"],1)
        self.assertIsNotNone(db.rows[entry(1)["name"]]["description"])
        self.assertEqual(len(self.http.calls),1)  # Restored from recorded source, not fetched again.

    def test_fetch_errors_outrank_terminal_reviews_in_the_final_phase(self):
        rows = [entry(1),entry(2)]
        db = Database(rows)
        http = HTTP(statuses={rows[0]["url"]:503})
        reject = lambda html,name,url,**kwargs: {"description":None,"error":"manual check required"}
        result = self.run_worker(db,client=self.client(http),extractor=reject)
        self.assertEqual(result["fetch_error"],1)
        self.assertEqual(result["review"],1)
        self.assertEqual(result["pending"],1)
        self.assertEqual(result["phase"],"pending")

    def test_an_exclusive_lock_covers_different_output_runs(self):
        path = self.root / "shared.lock"
        with worker.worker_lock(path):
            self.assertTrue(worker.worker_is_running(path))
            with self.assertRaisesRegex(RuntimeError,"already holds"):
                with worker.worker_lock(path):
                    self.fail("Second worker entered shared lock")
        self.assertFalse(worker.worker_is_running(path))

    def test_persisted_pace_survives_client_restart(self):
        wall = [100.0]
        sleeps = []
        def pause(seconds):
            sleeps.append(seconds)
            wall[0] += seconds
        http = HTTP()
        kwargs = dict(sleep=pause, clock=lambda:wall[0], wall_clock=lambda:wall[0], pace_path=self.root/"pace.json", http=http)
        first = worker.DurablePacedClient(self.output/"sources",6,10,**kwargs)
        first.get(entry(1)["url"])
        second = worker.DurablePacedClient(self.output/"sources",6,10,**kwargs)
        second.get(entry(2)["url"])
        self.assertIn(6,sleeps)
        self.assertEqual(len(http.calls),2)

    def test_complete_final_journal_record_without_newline_remains_appendable(self):
        path = self.output / "outcomes.jsonl"
        path.write_text('{"name":"good"}')
        self.assertEqual(worker.read_journal(path,repair=True),[{"name":"good"}])
        worker.append_json(path,{"name":"next"})
        self.assertEqual(worker.read_journal(path),[{"name":"good"},{"name":"next"}])

    def test_truncated_last_journal_record_is_repaired_before_resume(self):
        path = self.output / "outcomes.jsonl"
        path.write_bytes(b'{"name":"good"}\n{"name":"cut')
        self.assertEqual(worker.read_journal(path,repair=True),[{"name":"good"}])
        self.assertEqual(path.read_bytes(),b'{"name":"good"}\n')


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.directory=TemporaryDirectory()
        self.root=Path(self.directory.name)
        self.output=self.root/"run"
        self.output.mkdir()
        self.clock=[1_000_000.0]
        self.sleeps=[]
        self.calls=[]
        self.events=[]

    def tearDown(self):
        self.directory.cleanup()

    def sleep(self,seconds):
        self.assertTrue(worker.worker_is_running(self.root/"worker.lock"))
        self.assertLessEqual(seconds,30)
        self.sleeps.append(seconds)
        self.clock[0]+=seconds

    def supervise(self,results,**extra):
        results=iter(results)
        def once(db,output,**options):
            self.calls.append(self.clock[0])
            self.assertTrue(options["all_requests"])
            self.assertTrue(options["_lock_held"])
            value=next(results)
            if isinstance(value,Exception):
                raise value
            worker.atomic_json(output/"progress.json",value)
            return value
        return worker.until_complete(self.output,db=object(),clock=lambda:self.clock[0],sleep=self.sleep,
                                     run_once=once,emit=self.events.append,lock_path=self.root/"worker.lock",**extra)

    def complete(self):
        return {"phase":"complete","pending":0,"review":0,"stored":1,"already_present":0,"stop":None}

    def test_source_cooldown_waits_until_its_recorded_deadline_with_no_early_request(self):
        deadline=datetime.fromtimestamp(self.clock[0]+75,timezone.utc).isoformat()
        first={"phase":"stopped","pending":1,"review":0,"stop":"source_blocked_no_retry","blocked_until":deadline}
        result=self.supervise([first,self.complete()])
        self.assertEqual(self.calls,[1_000_000,1_000_075])
        self.assertEqual(sum(self.sleeps),75)
        waiting=next(row for row in self.events if row.get("phase")=="cooldown")
        self.assertEqual(waiting["resume_at"],deadline)
        self.assertEqual(result["phase"],"complete")

    def test_transient_failures_back_off_exponentially_and_cap_the_delay(self):
        failure={"phase":"stopped","pending":1,"review":0,"stop":"three_consecutive_network_or_server_failures"}
        result=self.supervise([failure,failure,failure,self.complete()],retry_initial=10,retry_max=25)
        self.assertEqual(self.calls,[1_000_000,1_000_010,1_000_030,1_000_055])
        self.assertEqual(self.sleeps,[10,20,25])
        self.assertEqual(result["phase"],"complete")

    def test_reboot_resumes_an_existing_wait_before_running_another_pass(self):
        worker.atomic_json(self.output/"supervisor.json",{"phase":"retry_wait","resume_at":self.clock[0]+45,"retry_attempt":2,"completed":0})
        worker.atomic_json(self.output/"progress.json",{"phase":"retry_wait","pending":1})
        self.supervise([self.complete()])
        self.assertEqual(self.calls,[1_000_045])
        self.assertEqual(sum(self.sleeps),45)

    def test_known_backend_transport_failure_retries_without_logging_exception_details(self):
        result=self.supervise([RuntimeError("CrateDB write transport failed; SUPER_SECRET"),self.complete()],retry_initial=2,retry_max=10)
        self.assertEqual(self.calls,[1_000_000,1_000_002])
        self.assertEqual(result["phase"],"complete")
        self.assertNotIn("SUPER_SECRET",json.dumps(self.events))
        self.assertNotIn("SUPER_SECRET",(self.output/"supervisor.json").read_text())

    def test_code_and_schema_errors_stop_without_retries(self):
        for error in [ValueError("broken code"),RuntimeError("CrateDB SQL error (4000): RelationUnknown"),RuntimeError("CrateDB bulk import failed (1 failed rows)")]:
            with self.subTest(error=type(error).__name__):
                self.calls.clear();self.sleeps.clear()
                report=self.supervise([error])
                self.assertEqual(len(self.calls),1)
                self.assertEqual(self.sleeps,[])
                self.assertFalse(report["retryable"])
                self.assertEqual(report["phase"],"stopped")

    def test_reviews_are_explicit_and_never_replayed_in_a_hot_loop(self):
        review={"phase":"needs_review","pending":0,"review":3,"stored":1,"stop":None}
        result=self.supervise([review])
        self.assertEqual(result["phase"],"needs_review")
        self.assertEqual(result["stop"],"manual_review_required")
        self.assertEqual(len(self.calls),1)
        self.assertEqual(self.sleeps,[])

    def test_pending_fetch_error_is_retried_before_terminal_review_is_reported(self):
        pending={"phase":"pending","pending":1,"review":1,"fetch_error":1,"stop":None}
        review={"phase":"needs_review","pending":0,"review":1,"stored":1,"stop":None}
        result=self.supervise([pending,review],retry_initial=3,retry_max=10)
        self.assertEqual(self.calls,[1_000_000,1_000_003])
        self.assertEqual(result["stop"],"manual_review_required")

    def test_a_mislabeled_complete_report_with_unresolved_work_is_not_success(self):
        result=self.supervise([{"phase":"complete","pending":1,"review":0,"stop":None}])
        self.assertEqual(result["pending"],1)
        # CLI checks pending/review as well as phase before choosing a success exit status.
        self.assertFalse(result.get("phase")=="complete" and not result.get("pending") and not result.get("review"))

    def test_transient_classification_does_not_retry_credentials_or_statement_errors(self):
        self.assertTrue(worker.transient_backend_error(URLError("network")))
        self.assertTrue(worker.transient_backend_error(HTTPError("http://local",503,"unavailable",{},None)))
        self.assertFalse(worker.transient_backend_error(HTTPError("http://local",401,"unauthorized",{},None)))
        self.assertFalse(worker.transient_backend_error(RuntimeError("CrateDB SQL error (4000): syntax")))

    def test_node_loss_messages_allow_recovery_but_never_override_uncertain_writes(self):
        class UncertainWrite(RuntimeError):
            retryable = False
        for role in ("Participating", "Coordinator"):
            message = f"CrateDB SQL error (5000): JobKilledException[Job killed. {role} node node2 disconnected]"
            with self.subTest(role=role):
                self.assertTrue(worker.transient_backend_error(RuntimeError(message)))
                self.assertFalse(worker.transient_backend_error(UncertainWrite(message)))
        self.assertFalse(worker.transient_backend_error(RuntimeError(
            "CrateDB SQL error (5000): JobKilledException[Job killed. Killed by user]")))

    def test_transient_database_startup_failure_is_retried_inside_the_one_off_job(self):
        factory_calls=[]
        def factory():
            factory_calls.append(self.clock[0])
            if len(factory_calls)==1:
                raise URLError("SUPER_SECRET")
            return object()
        result=worker.until_complete(self.output,db_factory=factory,clock=lambda:self.clock[0],sleep=self.sleep,
                                     run_once=lambda *args,**kwargs:self.complete(),emit=self.events.append,
                                     lock_path=self.root/"worker.lock",retry_initial=4,retry_max=10)
        self.assertEqual(factory_calls,[1_000_000,1_000_004])
        self.assertEqual(result["phase"],"complete")
        self.assertNotIn("SUPER_SECRET",json.dumps(self.events))


if __name__ == "__main__":
    unittest.main()
