# requirements:
# crate==2.2.1
# pydantic
# wmill==1.806.0

import base64
import http.client
import re
from urllib.parse import urlsplit
import wmill
from crate import client
from f.db.cratedb import CrateConnector


def main():
    user = wmill.get_variable('u/Alp/CRATE_USER')
    password = wmill.get_variable('u/Alp/CRATE_PASS')
    hosts = wmill.get_variable('u/Alp/CRATE_HOSTS').split(',')
    assert user == 'goodwatch_windmill'
    endpoints = []
    for host in hosts:
        connection = client.connect([host], username=user, password=password, timeout=60)
        try:
            cursor = connection.cursor()
            cursor.execute('SELECT current_user')
            rows = cursor.fetchall()
            assert len(rows) == 1 and rows[0][0] == user
            cursor.execute('SELECT health FROM sys.health')
            assert all(row[0] == 'GREEN' for row in cursor.fetchall())
            endpoints.append(host)
        finally:
            connection.close()
    db = CrateConnector()
    try:
        assert db.select('SELECT current_user AS role')[0]['role'] == user
        db.select('SELECT * FROM doc.workflow_monitoring LIMIT 0')
        db.select('SELECT tmdb_id,title,original_title,tmdb_details_updated_at,dna_updated_at FROM doc.movie LIMIT 0')
        db.select('SELECT tmdb_id,title,original_title,tmdb_details_updated_at,dna_updated_at FROM doc.show LIMIT 0')
        digests = db.select('SELECT digest FROM blob.search_index_files LIMIT 1')
        assert digests and re.fullmatch('[0-9a-f]{40}',digests[0]['digest'])
        url = 'http://' + hosts[0] + '/_blobs/search_index_files/' + digests[0]['digest']
        auth = 'Basic ' + base64.b64encode((user+':'+password).encode()).decode()
        for attempt in range(5):
            parts=urlsplit(url)
            assert parts.hostname in ('10.0.0.11','10.0.0.12','10.0.0.13')
            conn=http.client.HTTPConnection(parts.hostname,parts.port or 4200,timeout=30)
            try:
                conn.request('HEAD',parts.path,headers={'Authorization':auth})
                response=conn.getresponse();status=response.status;location=response.getheader('Location');response.read()
            finally:conn.close()
            if status==307:url=location;continue
            assert status==200
            break
        else:raise RuntimeError('Blob redirect limit exceeded')
        return {'role':user,'driver_endpoints_verified':endpoints,'deployed_connector':True,'monitoring_read':True,'sitemap_queries':True,'blob_head':True,'production_writes':False}
    finally:
        db.con.close()
