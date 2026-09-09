# extra_requirements:
# psycopg2-binary

import psycopg2
import wmill


def init_postgres():
    print("Initializing PostgreSQL...")
    try:
        db_name = wmill.get_variable("u/Alp/POSTGRES_DB")
        db_host = wmill.get_variable("u/Alp/POSTGRES_HOST")
        db_port = int(wmill.get_variable("u/Alp/POSTGRES_PORT"))
        db_user = wmill.get_variable("u/Alp/POSTGRES_USER")
        db_pass = wmill.get_variable("u/Alp/POSTGRES_PASS")
        connection = psycopg2.connect(
            database=db_name,
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
            connect_timeout=10,
            application_name="windmill",
        )
        print("Successfully initialized PostgreSQL")
        return connection
    except Exception as error:
        message = (
            "Failed to initialize PostgreSQL connection "
            f"({type(error).__name__}): {error}"
        )
        print(message)
        raise RuntimeError(message) from error


def generate_insert_query(table_name, columns):
    columns_str = ", ".join([f'"{column}"' for column in columns])

    query = f"""
        INSERT INTO "{table_name}" ({columns_str})
        VALUES %s
    """
    return query


def generate_upsert_query(table_name, columns):
    columns_str = ", ".join([f'"{column}"' for column in columns])

    unique_column, *other_columns = columns
    update_str = ", ".join([f'"{col}" = EXCLUDED."{col}"' for col in other_columns])

    query = f"""
        INSERT INTO "{table_name}" ({columns_str})
        VALUES %s
        ON CONFLICT ({unique_column}) DO UPDATE SET {update_str}
    """
    return query


def main():
    pass
