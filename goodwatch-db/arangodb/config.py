import os
from arango import ArangoClient

ARANGO_HOST = os.environ.get('ARANGO_HOST', 'http://localhost:8529')
ARANGO_DB = os.environ.get('ARANGO_DB', 'goodwatch2')
ARANGO_USER = os.environ.get('ARANGO_USER', 'root')
ARANGO_PASSWORD = os.environ.get('ARANGO_PASSWORD', '')


def get_arango_client():
    return ArangoClient(hosts=ARANGO_HOST)


def get_arango_db(client, db_name=None, username=None, password=None):
    db_name = db_name or ARANGO_DB
    username = username or ARANGO_USER
    password = password or ARANGO_PASSWORD
    return client.db(db_name, username=username, password=password)


def get_arango_sys_db(client, username=None, password=None):
    username = username or ARANGO_USER
    password = password or ARANGO_PASSWORD
    return client.db('_system', username=username, password=password)
