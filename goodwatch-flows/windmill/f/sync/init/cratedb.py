from f.db.cratedb import CrateConnector
from f.sync.models.crate_schemas import SCHEMAS


def init_database():
    print("Starting database initialization...")
    db = CrateConnector()

    try:
        for table_name, spec in SCHEMAS.items():
            print(f"\n--- Processing table: {table_name} ---")

            col_specs = spec["columns"] | {
                "created_at": "TIMESTAMP",
                "updated_at": "TIMESTAMP",
            }
            col_defs = [f'{name} {dtype}' for name, dtype in col_specs.items()]

            if not db.table_exists(table_name):
                print(f"Table '{table_name}' does not exist. Creating...")
                pk_def = f"PRIMARY KEY ({', '.join(spec['primary_key'])})"
                all_parts = col_defs + [pk_def]
                create_sql = (
                    f"CREATE TABLE {table_name} ({', '.join(all_parts)}) "
                    f"CLUSTERED INTO {spec['shards']} SHARDS"
                )
                db.run(create_sql)
            else:
                print(f"Table '{table_name}' already exists. Checking for missing columns...")
                existing_columns = db.get_existing_columns(table_name)
                for col_name, col_type in col_specs.items():
                    if col_name.strip('"') not in existing_columns:
                        print(f"Adding missing column '{col_name}' to table '{table_name}'.")
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                        db.run(alter_sql)

    except Exception as e:
        print(f"\nAn error occurred during database initialization: {e}")
    finally:
        if db:
            db.disconnect()
        print("\nDatabase initialization process finished.")


def main():
    init_database()
