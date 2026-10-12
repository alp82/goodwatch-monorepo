"""Offline strict audit of a combined numeric window transport journal."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

AUDITOR_SHA='bbc3bd993fce1e6151a570e9d81d81603c730361618d438cea6758f9202261bf'

def load():
    path=Path(__file__).with_name('audit_window.py')
    if hashlib.sha256(path.read_bytes()).hexdigest()!=AUDITOR_SHA:raise ValueError('auditor_hash')
    spec=importlib.util.spec_from_file_location('reviewed_auditor',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def audit(rows):
    module=load();born=[r for r in rows if r.get('event')=='resource-window.reader-born.v1'];exits=[r for r in rows if r.get('event')=='resource-window.reader-exit.v1']
    numeric=[r for r in rows if r.get('event')in('resource-window.started.v1','resource-window.sample.v1','resource-window.complete.v1','resource-window.failed.v1')]
    receipt=exits[0]if len(exits)==1 else{}
    result=module.audit(numeric,receipt);problems=result['problems']
    def require(value,reason):
        if not value and reason not in problems:problems.append(reason)
    require(len(born)==1 and len(exits)==1,'transport_lifecycle_count')
    require(len(numeric)+len(born)+len(exits)==len(rows),'unknown_transport_event')
    require(bool(rows)and rows[0].get('event')=='resource-window.reader-born.v1'and rows[-1].get('event')=='resource-window.reader-exit.v1','transport_lifecycle_order')
    if len(born)==1:
        require(module.identity(born[0].get('pid'))and module.identity(born[0].get('startTicks')),'transport_birth_invalid')
        require(born[0].get('pid')==receipt.get('pid')and born[0].get('startTicks')==receipt.get('startTicks')and born[0].get('sourceSha256')==module.SHA,'transport_birth_mismatch')
    result['coverage']='UNKNOWN'if problems else'complete';return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('journal');args=parser.parse_args();data=Path(args.journal).read_bytes()
    if len(data)>16*1024**2+16384:raise ValueError('journal_bound')
    lines=data.splitlines()
    if len(lines)>1504 or any(len(line)>8192 for line in lines):raise ValueError('journal_bound')
    result=audit([json.loads(line)for line in lines]);result['journalSha256']=hashlib.sha256(data).hexdigest();print(json.dumps(result,separators=(',',':')))

if __name__=='__main__':main()
