#!/usr/bin/env python3
"""Seal existing audit artifacts and snapshot archive; no source mutations."""
import datetime as dt
import gzip
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path
B=Path(__file__).resolve().parent
M=json.loads((B/'manifest.json').read_text());R=Path(M['repository_root'])
def git(*args):return subprocess.check_output(['git','-C',str(R),*args],text=True)
end={'captured_at':dt.datetime.now(dt.timezone.utc).isoformat(),'root':str(R),'branch':git('branch','--show-current').strip(),'head':git('rev-parse','HEAD').strip(),'status_porcelain_v1':git('status','--porcelain=v1','--untracked-files=normal'),'staged_diff_empty':subprocess.run(['git','-C',str(R),'diff','--cached','--quiet']).returncode==0}
(B/'captures/checkout-end.json').write_text(json.dumps(end,indent=2)+'\n')
with (B/'snapshots.tar.gz').open('wb') as raw:
    with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as zipped:
        with tarfile.open(fileobj=zipped,mode='w|') as tar:
            for f in sorted((B/'snapshots').rglob('*')):
                if not f.is_file():continue
                info=tar.gettarinfo(str(f),arcname=f.relative_to(B).as_posix())
                info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
                with f.open('rb') as content:tar.addfile(info,content)
entries=[]
for p in sorted(B.rglob('*')):
    if not p.is_file() or p.name in ['SHA256SUMS','verification.json'] or '__pycache__' in p.parts:continue
    entries.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(B).as_posix())
(B/'SHA256SUMS').write_text('\n'.join(entries)+'\n')
print(json.dumps({'sealed_files':len(entries),'snapshot_archive_bytes':(B/'snapshots.tar.gz').stat().st_size,'sha256sums_sha256':hashlib.sha256((B/'SHA256SUMS').read_bytes()).hexdigest()}))
