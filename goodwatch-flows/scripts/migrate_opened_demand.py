"""Add the accepted-open timestamp without rewriting priority demand, claims or leases.

Dry run (no connection): python scripts/migrate_opened_demand.py
Apply explicitly: python scripts/migrate_opened_demand.py --apply --env-file .env
Uses the existing Crate connection settings; reads credentials only for --apply.
"""

import argparse

SQL = "ALTER TABLE crawl_priority ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE"


def migrate(cursor):
    cursor.execute(SQL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--windmill-workspace")
    args = parser.parse_args()
    print(SQL + ";")
    print("Read contract: CAST(last_opened_at AS BIGINT), UTC epoch milliseconds; NULL means no accepted open.")
    if not args.apply:
        print("Dry run only. No database connection or writes.")
        return
    from crate import client
    from migrate_priority_queue import crate_hosts, settings

    config = settings(args, "CRATE")
    connection = client.connect(crate_hosts(config), username=config["CRATE_USER"], password=config["CRATE_PASS"])
    cursor = connection.cursor()
    try:
        migrate(cursor)
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()
