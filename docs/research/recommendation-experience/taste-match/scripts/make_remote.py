"""Print the remote benchmark script with config injected, for piping into ssh python3 -."""
import base64, json, sys
import numpy as np
from gw import ENV, QD
cat = np.load('catalog.npz')
ids, votes, poster = cat['ids'], cat['votes'], cat['poster']
cand = ids[(votes >= 1000) & poster]
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
runs = int(sys.argv[1])
sets = [[int(x) for x in rng.choice(cand, 100, replace=False)] for _ in range(runs)]
cfg = {'qdrant': QD, 'qkey': ENV.get('QDRANT_API_KEY', ''), 'crate': f"http://{ENV['CRATE_HOSTS'].split(',')[0]}:{ENV['CRATE_PORT']}/_sql",
       'cuser': ENV['CRATE_USER'], 'cpass': ENV['CRATE_PASS'], 'rhost': ENV['REDIS_HOST'], 'rport': int(ENV['REDIS_PORT']),
       'rpass': ENV['REDIS_PASS'], 'sets': sets}
tpl = open('remote_bench_template.py').read()
sys.stdout.write(tpl.replace('__CFG__', base64.b64encode(json.dumps(cfg).encode()).decode()))
