"""Small CrateDB ledger for observations and durable incident delivery state."""

import json
from typing import Any
from uuid import uuid4

from f.db.cratedb import CrateConnector


class MonitoringStore:
    def __init__(self, db: Any = None):
        self.db = db if db is not None else CrateConnector()
        self.owner: str | None = None

    def initialize(self) -> None:
        self.db.run("""CREATE TABLE IF NOT EXISTS workflow_monitoring (
            monitor_key TEXT PRIMARY KEY, kind TEXT, pipeline TEXT,
            payload TEXT INDEX OFF STORAGE WITH (columnstore = false),
            updated_at TIMESTAMP WITH TIME ZONE,
            lease_token TEXT, lease_expires_at TIMESTAMP WITH TIME ZONE
        ) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '1')""")
        self.db.run("""INSERT INTO workflow_monitoring (monitor_key, kind, payload)
            VALUES ('checker-lease', 'lease', '{}')
            ON CONFLICT (monitor_key) DO NOTHING""")

    def acquire(self) -> bool:
        owner = str(uuid4())
        for _ in range(5):
            rows = self.db.select("""SELECT _seq_no, _primary_term,
                CAST(lease_expires_at AS BIGINT) AS expires,
                CAST(current_timestamp AS BIGINT) AS now
                FROM workflow_monitoring WHERE monitor_key = 'checker-lease'""")
            if not rows:
                raise RuntimeError("Monitoring lease row unavailable")
            row = rows[0]
            if row["expires"] and row["expires"] > row["now"]:
                return False
            self.db.run("""UPDATE workflow_monitoring
                SET lease_token = ?, lease_expires_at = ?
                WHERE monitor_key = 'checker-lease'
                AND _seq_no = ? AND _primary_term = ?""",
                (owner, row["now"] + 600000, row["_seq_no"], row["_primary_term"]))
            if self.db.cur.rowcount == 1:
                self.owner = owner
                return True
        return False

    def assert_owner(self) -> None:
        rows = self.db.select("""SELECT lease_token,
            CAST(lease_expires_at AS BIGINT) - CAST(current_timestamp AS BIGINT)
                AS remaining
            FROM workflow_monitoring WHERE monitor_key = 'checker-lease'""")
        if (not self.owner or not rows or rows[0]["lease_token"] != self.owner
                or rows[0]["remaining"] < 30000):
            raise RuntimeError("Monitoring lease lost or near expiry")

    def release(self) -> None:
        if self.owner:
            self.db.run("""UPDATE workflow_monitoring
                SET lease_token = NULL, lease_expires_at = NULL
                WHERE monitor_key = 'checker-lease' AND lease_token = ?""",
                (self.owner,))
            self.owner = None

    def get(self, key: str) -> dict[str, Any] | None:
        rows = self.db.select(
            "SELECT payload FROM workflow_monitoring WHERE monitor_key = ?", (key,))
        return json.loads(rows[0]["payload"]) if rows else None

    def put(self, key: str, kind: str, pipeline: str, payload: dict[str, Any]) -> None:
        self.assert_owner()
        self.db.run("""INSERT INTO workflow_monitoring
            (monitor_key, kind, pipeline, payload, updated_at)
            VALUES (?, ?, ?, ?, current_timestamp)
            ON CONFLICT (monitor_key) DO UPDATE SET
                payload = excluded.payload, updated_at = excluded.updated_at""",
            (key, kind, pipeline, json.dumps(payload, separators=(",", ":"))))
        if self.db.cur.rowcount != 1:
            raise RuntimeError("Monitoring state write unconfirmed")

    def jobs(self, pipeline: str) -> dict[str, dict[str, Any]]:
        rows = self.db.select("""SELECT payload FROM workflow_monitoring
            WHERE kind = 'job' AND pipeline = ?""", (pipeline,))
        jobs = [json.loads(row["payload"]) for row in rows]
        return {job["id"]: job for job in jobs}

    def save_jobs(self, pipeline: str, jobs: list[dict[str, Any]]) -> None:
        if not jobs:
            return
        self.assert_owner()
        result = self.db.cur.executemany("""INSERT INTO workflow_monitoring
            (monitor_key, kind, pipeline, payload, updated_at)
            VALUES (?, 'job', ?, ?, current_timestamp)
            ON CONFLICT (monitor_key) DO UPDATE SET
                payload = excluded.payload, updated_at = excluded.updated_at""",
            [("job:" + job["id"], pipeline, json.dumps(job, separators=(",", ":")))
             for job in jobs])
        if (not isinstance(result, list) or len(result) != len(jobs)
                or any(item.get("rowcount") != 1 or item.get("error")
                       or item.get("error_message") for item in result)):
            raise RuntimeError("Monitoring observation batch write unconfirmed")


def main() -> None:
    pass
