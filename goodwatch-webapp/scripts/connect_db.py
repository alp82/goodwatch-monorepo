import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()


def init_postgres():
    print(f"Initializing postregsql...")
    db_name = os.getenv("POSTGRES_DB")
    db_host = os.getenv("POSTGRES_HOST")
    db_port = os.getenv("POSTGRES_PORT")
    db_user = os.getenv("POSTGRES_USER")
    db_pass = os.getenv("POSTGRES_PASS")
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