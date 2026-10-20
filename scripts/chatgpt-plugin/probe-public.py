#!/usr/bin/env python3
"""Read-only HTTPS and unauthenticated MCP smoke test; never accepts credentials."""
import concurrent.futures
import datetime
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
PATHS = ['/', '/support', '/privacy', '/terms', '/use-with-ai', '/mcp-icons/goodwatch-512.png', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server/api/auth', '/mcp']

def probe(path):
    req = Request('https://goodwatch.app'+path, headers={'User-Agent':'GoodWatch-submission-readiness/1.0'})
    try:
        response = urlopen(req, timeout=25)
    except HTTPError as e:
        response = e
    except OSError as e:
        return {'path':path,'error':str(e)}
    with response:
        result = {'path':path,'status':response.status,'final_url':response.url}
        for header in ['Content-Type','Cache-Control','WWW-Authenticate']:
            if response.headers.get(header): result[header.lower()] = response.headers[header]
        # Only public metadata. No cookies, private account data, or tokens.
        if path.startswith('/.well-known/'):
            result['metadata'] = json.load(response)
        return result

results = list(concurrent.futures.ThreadPoolExecutor(max_workers=5).map(probe,PATHS))
report = {'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authentication':'none; authenticated production calls not tested','results':results}
(ROOT/'docs/chatgpt-plugin/evidence/public-endpoint.json').write_text(json.dumps(report,indent=2)+'\n')
for result in results:
    print(result['path'], result.get('status', result.get('error')))
