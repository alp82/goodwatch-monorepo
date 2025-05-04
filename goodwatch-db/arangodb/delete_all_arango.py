import os
from arango import ArangoClient
from dotenv import load_dotenv

load_dotenv()

ARANGO_HOST = os.getenv('ARANGO_HOST', 'http://localhost:8529')
ARANGO_DB = os.getenv('ARANGO_DB', '_system')
ARANGO_USER = os.getenv('ARANGO_USER', 'root')
ARANGO_PASSWORD = os.getenv('ARANGO_PASSWORD', '')

def main():
    client = ArangoClient(hosts=ARANGO_HOST)
    db = client.db(ARANGO_DB, username=ARANGO_USER, password=ARANGO_PASSWORD)
    # Get all user collections (skip system collections)
    for col_meta in db.collections():
        cname = col_meta['name']
        if cname.startswith('_'):
            continue  # skip system collections
        coll = db.collection(cname)
        count = coll.count()
        coll.truncate()
        print(f"Truncated {cname} ({count} docs deleted)")
    print("All user collections truncated.")

if __name__ == '__main__':
    main()
