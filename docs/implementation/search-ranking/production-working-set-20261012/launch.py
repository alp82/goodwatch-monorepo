"""Private source packet over SSH stdin; default has no connection or inspection."""
import base64,hashlib,json,shlex,subprocess,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
PRIVATE=Path('/home/alper/projects/search-production-pin-preflight-406/private-production-source-contract.json')

def main():
 if sys.argv[1:]!=['--execute-reviewed']:
  print(json.dumps({'event':'qdrant.working-set-launch-prepared.v1','execution':False}));return 0 if len(sys.argv)==1 else 1
 manifest=json.loads((HERE/'manifest.json').read_text());script=(HERE/'inspect_measure.py').read_bytes()
 if hashlib.sha256(script).hexdigest()!=manifest['inspectorSha256']:return 1
 code={n:(HERE/n).read_bytes()for n in manifest['codeFiles']}
 if any(hashlib.sha256(code[n]).hexdigest()!=h for n,h in manifest['codeFiles'].items()):return 1
 raw=PRIVATE.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=manifest['contractSha256']:return 1
 packet=json.dumps({'code':{n:base64.b64encode(v).decode()for n,v in code.items()},'contract':base64.b64encode(raw).decode()}).encode()
 # Only public reviewed inspector source is command text; no private packet
 # persistence or host file staging. Explicit OWN nofile soft raise is bounded
 # by existing hard and restored; source allocations remain unchanged.
 command=shlex.join(['python3','-I','-B','-c',script.decode(),'--execute-reviewed','--allow-own-nofile-raise'])
 process=subprocess.Popen(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','root@10.0.0.20',command],stdin=subprocess.PIPE)
 try:
  process.communicate(packet,timeout=120)
  print(json.dumps({'event':'qdrant.working-set-transport.v1','remoteExit':process.returncode,'execution':True}));return process.returncode
 except subprocess.TimeoutExpired:
  process.terminate()
  try:process.wait(timeout=3)
  except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
  print(json.dumps({'event':'qdrant.working-set-transport-failed.v1','remoteExitUnproven':True,'lockedBytes':0}));return 1
if __name__=='__main__':raise SystemExit(main())
