from collections import defaultdict
from datetime import datetime
from typing import Iterable, List

from crate import client
from pydantic import BaseModel
from urllib3 import Timeout
import wmill


class CrateConnector:
    def __init__(self):
        try:
            db_hosts = wmill.get_variable("u/Alp/CRATE_HOSTS").split(",")
            db_user = wmill.get_variable("u/Alp/CRATE_USER")
            db_pass = wmill.get_variable("u/Alp/CRATE_PASS")

            self.con = client.connect(
                db_hosts,
                username=db_user,
                password=db_pass,
                # The client retries connections to each host repeatedly. Keep
                # private-LAN failures short without cutting off slow queries.
                timeout=Timeout(connect=1, read=180),
            )
            self.cur = self.con.cursor()
            print("Successfully connected to CrateDB.", flush=True)
        except Exception as e:
            print(f"Failed to connect to CrateDB: {e}", flush=True)
            raise

    def run(self, sql: str, params: tuple | None = None):
        if not self.cur:
            print("Cannot execute SQL, no active cursor.")
            return
        print(f"Executing SQL: {sql}", flush=True)
        self.cur.execute(sql, params or ())

    def select(self, sql: str, params: tuple | None = None) -> list[dict]:
        self.run(sql, params)
        results = self.cur.fetchall()
        if self.cur.description is None:
            raise RuntimeError("Crate SELECT returned no columns")
        columns = [column[0] for column in self.cur.description]
        return [
            {column: result[index] for index, column in enumerate(columns)}
            for result in results
        ]

    def upsert_many(
        self,
        table: str,
        records: list[BaseModel],
        conflict_columns: list[str],
        silent: bool = False,
        *,
        auto_timestamps: bool = True,  # fill missing created_at/updated_at with now
        override_timestamps: bool = False,  # if True, overwrite any provided ts with now
        replace_nulls: bool = False,  # verified snapshots can clear obsolete fields
        replace_null_columns: Iterable[str] = (),  # columns the caller owns: NULL clears them
    ) -> dict[str, int]:
        """
        Batch upsert Pydantic models into CrateDB.

        - Preserves manually provided created_at/updated_at when override_timestamps=False.
        - Fills missing timestamps with `now` when auto_timestamps=True.
        - Avoids duplicate timestamp columns in INSERT.
        """
        if not silent:
            print(
                f"    Executing batch upsert of {len(records)} records into '{table}'."
            )

        if not records:
            if not silent:
                print("No records provided for upsert.")
            return {"records_received": 0, "rows_upserted": 0}

        if not conflict_columns:
            raise ValueError(
                "`conflict_columns` must be provided for an upsert operation."
            )

        # ── 1) Make mutable copies & basic cleaning ──────────────────────────────────
        cleaned: list[dict] = []
        for rec in records:
            d = rec.model_dump()  # flat dict
            cleaned.append(d)

        # ── 2) Detect duplicates inside this batch on the conflict key ──────────────
        seen = defaultdict(list)
        for d in cleaned:
            key = tuple(d.get(col) for col in conflict_columns)
            seen[key].append(d)

        dup_keys = {k: v for k, v in seen.items() if len(v) > 1}
        if dup_keys:
            msg = "Upsert aborted. Duplicate records found:\n"
            for k, v in dup_keys.items():
                msg += f"  - Conflict Key {k}: {len(v)} duplicates\n"
                for dup in v:
                    msg += f"    - {dup}\n"
            raise ValueError(msg)

        # ── 3) Timestamp handling (preserve vs. auto-fill vs. override) ─────────────
        now = datetime.utcnow()

        def resolve_ts(val):
            # Allow None/float/datetime; pass through if provided.
            return (
                now
                if (override_timestamps or (auto_timestamps and val is None))
                else val
            )

        for d in cleaned:
            d["created_at"] = resolve_ts(d.get("created_at"))
            d["updated_at"] = resolve_ts(d.get("updated_at"))

        # ── 4) Build a stable column list without duplicates ────────────────────────
        # Union of all keys across the batch, so executemany uses a consistent shape.
        # Ensure timestamps exist in the schema (added in step 3), and place them at the end.
        col_set = set().union(*[set(d.keys()) for d in cleaned])

        # Keep conflict columns first (nice-to-have), then other non-timestamp cols, then timestamps.
        non_ts_cols = [c for c in col_set if c not in {"created_at", "updated_at"}]
        # Keep provided order stable-ish: start from the first record’s keys to preserve column order feel
        first_keys = list(cleaned[0].keys())
        # Order: conflict cols (in given order), then remaining non-ts cols in first_keys order, then any extras, then ts
        ordered_non_ts = []
        for c in conflict_columns:
            if c in non_ts_cols and c not in ordered_non_ts:
                ordered_non_ts.append(c)
        for c in first_keys:
            if c in non_ts_cols and c not in ordered_non_ts:
                ordered_non_ts.append(c)
        for c in non_ts_cols:
            if c not in ordered_non_ts:
                ordered_non_ts.append(c)

        all_cols = ordered_non_ts + ["created_at", "updated_at"]

        # Columns to update on conflict: everything except the conflict key and created_at
        update_cols = [
            c for c in all_cols if c not in set(conflict_columns) | {"created_at"}
        ]
        conflict_list = ", ".join(f'"{c}"' for c in conflict_columns)
        col_list = ", ".join(f'"{c}"' for c in all_cols)
        placeholders = ", ".join(["?"] * len(all_cols))

        # By default a NULL means "this writer does not set the column", so the
        # stored value stays. Callers that own a column name it so NULL clears it.
        cleared_cols = set(replace_null_columns)
        if update_cols:
            updates = "UPDATE SET " + ", ".join(
                (f'"{c}" = excluded."{c}"' if replace_nulls or c in cleared_cols else
                 f'"{c}" = COALESCE(excluded."{c}", "{c}")') for c in update_cols
            )
        else:
            updates = "NOTHING"

        sql = (
            f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict_list}) DO {updates}"
        )

        # ── 5) Bind values (ensure every row has every column; use None when missing) ─
        data = []
        for d in cleaned:
            row = [d.get(c) for c in all_cols]
            data.append(row)

        results = self.cur.executemany(sql, data)
        # CrateDB can return a successful HTTP response with individual failed
        # bulk operations. Callers must not acknowledge a crawl in that case.
        if not isinstance(results, list) or len(results) != len(data):
            raise RuntimeError(f"Incomplete bulk result while writing {table}")
        failures = [
            (index, result)
            for index, result in enumerate(results)
            if result.get("error_message")
            or result.get("error")
            or result.get("rowcount", -1) != 1
        ]
        if failures:
            index, result = failures[0]
            raise RuntimeError(
                f"Failed to upsert {len(failures)} of {len(data)} rows into {table}; "
                f"first failure at row {index}: {result}"
            )

        return {
            "records_received": len(records),
            "rows_upserted": sum(result["rowcount"] for result in results),
        }

    def table_exists(self, table_name: str) -> bool:
        if not self.cur:
            return False
        self.cur.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'doc' AND table_name = ?",
            (table_name,),
        )
        return self.cur.rowcount > 0

    def index_exists(self, table_name: str, index_name: str) -> bool:
        if not self.cur:
            return False
        self.cur.execute(
            """
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'doc'
            AND table_name = ?
            AND constraint_name = ?
            AND constraint_type = 'INDEX'
            """,
            (table_name, index_name),
        )
        return self.cur.rowcount > 0

    def get_existing_columns(self, table_name: str) -> dict[str, str]:
        if not self.cur:
            return {}
        self.cur.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'doc' AND table_name = ?",
            (table_name,),
        )
        return {name: dtype.lower() for name, dtype in self.cur.fetchall()}

    def _debug_nodes(self):
        if not self.cur:
            return
        self.cur.execute("SELECT name, heap FROM sys.nodes")
        for name, heap in self.cur.fetchall():
            free_mb = heap.get("free", 0) / 1_048_576
            print(f"- {name}: {free_mb:.1f} MB free")

    def disconnect(self):
        if self.cur:
            self.cur.close()
        if self.con:
            self.con.close()
        print("Disconnected from CrateDB.", flush=True)


def main():
    connector = CrateConnector()
    connector._debug_nodes()
    connector.disconnect()
