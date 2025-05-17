import os
from config import get_arango_client, get_arango_sys_db, ARANGO_DB

def main():
    client = get_arango_client()
    sys_db = get_arango_sys_db(client)
    if sys_db.has_database(ARANGO_DB):
        sys_db.delete_database(ARANGO_DB)
    print(f"Database '{ARANGO_DB}' deleted.")

if __name__ == '__main__':
    main()
