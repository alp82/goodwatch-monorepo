from f.db.cratedb import CrateConnector
from f.sync.models.crate_schemas import BLOB_TABLES, SCHEMAS


def column_specs(spec: dict) -> dict[str, str]:
    if spec.get("timestamps") is False:
        return spec["columns"]
    return spec["columns"] | {
        "created_at": "TIMESTAMP",
        "updated_at": "TIMESTAMP",
    }


def create_table_sql(table_name: str, spec: dict) -> str:
    col_defs = [f"{name} {dtype}" for name, dtype in column_specs(spec).items()]
    pk_def = f"PRIMARY KEY ({', '.join(spec['primary_key'])})"
    routing = f"BY ({spec['clustered_by']}) " if spec.get("clustered_by") else ""
    replicas = f" WITH (number_of_replicas = '{spec['replicas']}')" if spec.get("replicas") else ""
    return (
        f"CREATE TABLE {table_name} ({', '.join(col_defs + [pk_def])}) "
        f"CLUSTERED {routing}INTO {spec['shards']} SHARDS{replicas}"
    )


def init_database(dry_run: bool = False):
    """Creates missing tables, adds missing columns and inserts missing rows. With dry_run, only reports them."""
    print(f"Starting database initialization{' (dry run: nothing is changed)' if dry_run else ''}...")
    db = CrateConnector()

    def change(sql: str, params: tuple | None = None):
        if dry_run:
            print(f"Would run: {sql}{f' with {params}' if params else ''}", flush=True)
        else:
            db.run(sql, params)

    try:
        for table_name, spec in SCHEMAS.items():
            print(f"\n--- Processing table: {table_name} ---")
            col_specs = column_specs(spec)
            created = False

            if not db.table_exists(table_name):
                print(f"Table '{table_name}' does not exist. Creating...")
                change(create_table_sql(table_name, spec))
                created = True
            else:
                print(f"Table '{table_name}' already exists. Checking for missing columns...")
                existing_columns = db.get_existing_columns(table_name)
                for col_name, col_type in col_specs.items():
                    if col_name.strip('"') not in existing_columns:
                        print(f"Adding missing column '{col_name}' to table '{table_name}'.")
                        change(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                # Sub-columns of objects are listed as parent['child'] and aren't declared one by one.
                listed = {name.strip('"') for name in col_specs}
                unlisted = sorted(name for name in existing_columns if "[" not in name and name not in listed)
                if unlisted:
                    print(f"Columns in '{table_name}' that the schema doesn't list (left as they are): {unlisted}")

            if not (dry_run and created):
                for row in spec.get("rows", []):
                    columns = list(row)
                    change(
                        f"INSERT INTO {table_name} ({', '.join(columns)}) "
                        f"VALUES ({', '.join('?' for _ in columns)}) ON CONFLICT DO NOTHING",
                        tuple(row[column] for column in columns),
                    )

        for table_name, spec in BLOB_TABLES.items():
            print(f"\n--- Processing blob table: {table_name} ---")
            db.cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_schema = 'blob' AND table_name = ?",
                (table_name,),
            )
            if db.cur.rowcount > 0:
                print(f"Blob table '{table_name}' already exists.")
            else:
                print(f"Blob table '{table_name}' does not exist. Creating...")
                change(f"CREATE BLOB TABLE {table_name} CLUSTERED INTO {spec['shards']} SHARDS")

    except Exception as e:
        print(f"\nAn error occurred during database initialization: {e}")
    finally:
        if db:
            db.disconnect()
        print("\nDatabase initialization process finished.")


def main(dry_run: bool = False):
    init_database(dry_run)
