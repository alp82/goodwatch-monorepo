import psycopg2
import wmill


def init_postgres():
    print(f"Initializing postregsql...")
    db_name = wmill.get_variable("u/Alp/POSTGRES_DB")
    db_host = wmill.get_variable("u/Alp/POSTGRES_HOST")
    db_port = int(wmill.get_variable("u/Alp/POSTGRES_PORT"))
    db_user = wmill.get_variable("u/Alp/POSTGRES_USER")
    db_pass = wmill.get_variable("u/Alp/POSTGRES_PASS")
    try:
        connection = psycopg2.connect(
            database=db_name,
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_pass,
        )
        print(f"Successfully initialized postregsql")
        return connection
    except Exception as error:
        print(f"Failed postregsql initialization: ", error)


def generate_upsert_query(table_name, columns):
    columns_str = ", ".join([f"\"{column}\"" for column in columns])

    unique_column, *other_columns = columns 
    update_str = ", ".join([f"\"{col}\" = EXCLUDED.\"{col}\"" for col in other_columns])

    query = f"""
        INSERT INTO "{table_name}" ({columns_str})
        VALUES %s
        ON CONFLICT ({unique_column}) DO UPDATE SET {update_str}
    """
    return query



def main():
    pass
