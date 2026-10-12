"""Private packet directly over SSH stdin; default makes no connection."""
import base64,hashlib,json,shlex,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
FROZEN=Path('/home/alper/projects/search-100-evidence/production-zero-placement-review-v1-20261012')
PRIVATE=Path('/home/alper/projects/search-production-pin-preflight-406/private-production-source-contract.json')

def main():
    if sys.argv[1:]!=['--execute-reviewed']:
        print(json.dumps({'event':'qdrant.zero-placement.launch-prepared.v1','execution':False}));return 0 if len(sys.argv)==1 else 1
    raw=(ROOT/'stage_and_run.py').read_bytes();expected=(ROOT/'manifest.json').read_text();manifest=json.loads(expected)
    if hashlib.sha256(raw).hexdigest()!=manifest['stagerSha256']:return 1
    files={n:(FROZEN/n).read_bytes()for n in manifest['codeFiles']}
    contract=PRIVATE.read_bytes()
    if hashlib.sha256(contract).hexdigest()!=manifest['contractSha256']:return 1
    packet=json.dumps({'code':{n:base64.b64encode(v).decode()for n,v in files.items()},'contract':base64.b64encode(contract).decode()}).encode()
    # Public source only in command argv; private contract/code packet is stdin.
    command=shlex.join(['python3','-I','-B','-c',raw.decode(),'--execute-reviewed'])
    process=subprocess.Popen(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@10.0.0.20',command],stdin=subprocess.PIPE)
    try:
        process.communicate(packet,timeout=180);return process.returncode
    except subprocess.TimeoutExpired:
        # SSH is the only locally owned process. Remote outer owns/reaps its own
        # CLI; transport timeout is UNKNOWN, never a release-success claim.
        process.terminate()
        try:process.wait(timeout=3)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
        print(json.dumps({'event':'qdrant.zero-placement.transport-failed.v1','remoteExitUnproven':True}));return 1
if __name__=='__main__':raise SystemExit(main())
