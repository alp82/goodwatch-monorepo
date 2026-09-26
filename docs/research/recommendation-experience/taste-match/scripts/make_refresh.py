import base64, json, sys
from gw import ENV, sql
users = {}
for label, prefix in (('990_ratings', '3a8e67d6'), ('200_ratings', '2774c415'), ('75_ratings', '8473d80e')):
    users[label] = [r['user_id'] for r in sql('select distinct user_id from user_score') if r['user_id'].startswith(prefix)][0]
cfg = {'crate': f"http://{ENV['CRATE_HOSTS'].split(',')[0]}:{ENV['CRATE_PORT']}/_sql", 'cuser': ENV['CRATE_USER'],
       'cpass': ENV['CRATE_PASS'], 'users': users}
sys.stdout.write(open('remote_refresh_template.py').read().replace('__CFG__', base64.b64encode(json.dumps(cfg).encode()).decode()))
