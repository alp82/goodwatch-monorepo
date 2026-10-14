#!/usr/bin/env python3
"""Build a disposable, disk-backed local index from the read-only snapshot."""
from spike import *
import ijson
import sqlite3

db=sqlite3.connect(DATA/'catalog.local.sqlite')
db.executescript('DROP TABLE IF EXISTS titles; DROP TABLE IF EXISTS names; CREATE TABLE titles(key TEXT PRIMARY KEY,body TEXT); CREATE TABLE names(name TEXT,key TEXT); PRAGMA journal_mode=OFF;')
n=0
with gzip.open(DATA/'catalog.local.json.gz','rb') as f:
    for row in ijson.items(f,'item',use_float=True):
        db.execute('INSERT INTO titles VALUES (?,?)',[row['key'],json.dumps(row,ensure_ascii=False)])
        db.executemany('INSERT INTO names VALUES (?,?)',[(norm(name),row['key']) for name in {row.get('title'),row.get('original_title')} if name])
        n+=1
        if n%100000==0:db.commit();print(n,flush=True)
db.execute('CREATE INDEX names_lookup ON names(name)');db.commit()
print('Indexed',n,flush=True)
