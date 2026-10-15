#!/usr/bin/env python3
"""Read-only snapshot benchmark for the production private network.

ssh root@10.0.0.21 python3 - < goodwatch-flows/tools/bench_buzz.py
Set CRATE_USER and CRATE_PASSWORD_FILE (or CRATE_PASS) for password enforcement.
No application server, cookies or Valkey access.
"""
import base64
import os
from pathlib import Path
import http.client
import json
import socket
import statistics
import time

headers = {'Content-Type': 'application/json'}
user = os.environ.get('CRATE_USER', '')
password = (Path(os.environ['CRATE_PASSWORD_FILE']).read_text().removesuffix('\n')
            if os.environ.get('CRATE_PASSWORD_FILE') else os.environ.get('CRATE_PASS', ''))
if user:
    headers['Authorization'] = 'Basic ' + base64.b64encode(f'{user}:{password}'.encode()).decode()
connection = http.client.HTTPConnection('10.0.0.11', 4200, timeout=30)
body = json.dumps({'stmt': "SELECT day, generated_at, payload FROM doc.buzz_snapshot WHERE snapshot_key = 'current'", 'args': []})
roundtrips, executions, sizes = [], [], []
for _ in range(50):
    started = time.perf_counter()
    connection.request('POST', '/_sql', body=body, headers=headers)
    response = connection.getresponse()
    envelope = json.loads(response.read())
    if response.status != 200 or not envelope.get('rows'):
        raise RuntimeError('Snapshot SELECT failed or returned no row')
    payload = json.loads(envelope['rows'][0][2])
    roundtrips.append(1000 * (time.perf_counter() - started))
    executions.append(envelope['duration'])
    sizes.append(len(envelope['rows'][0][2].encode()))
    if len(payload['top20']) != 20:
        raise RuntimeError('Snapshot does not contain 20 titles')
connection.close()
print(json.dumps(dict(host=socket.gethostname(), samples=50, includes_payload_decode=True,
                      first_read_ms=roundtrips[0], roundtrip_ms_min=min(roundtrips),
                      roundtrip_ms_median=statistics.median(roundtrips), roundtrip_ms_p95=sorted(roundtrips)[47],
                      roundtrip_ms_max=max(roundtrips), crate_ms_median=statistics.median(executions),
                      payload_bytes=sizes[0], score_day=payload['day']), indent=2))
