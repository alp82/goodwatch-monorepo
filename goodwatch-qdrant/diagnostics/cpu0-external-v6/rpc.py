"""Bounded fixed-host public SSH stdin RPC; direct local clients only."""
import base64
import json
import os
from pathlib import Path
import selectors
import shlex
import signal
import subprocess
import time

from packet import canonical,hash_value,sha
from bootstrap import MODULES

ROOT='/root/goodwatch-qdrant-cold-406-20261011'
HOSTS={'setup-recover-never-started':'root@10.0.0.32','setup':'root@10.0.0.32','preflight':'root@10.0.0.32','stage':'root@10.0.0.32',
       'turnover':'root@10.0.0.32','outer-admit':'root@10.0.0.32',
       'register-consumer':'root@10.0.0.32','cleanup':'root@10.0.0.32',
       'producer-stream':'root@10.0.0.21','producer-cleanup':'root@10.0.0.21',
       'producer-confirm':'root@10.0.0.21'}
MAX_PUBLIC=16*1024**2


class Rpc:
    def __init__(self,bootstrap_raw,bootstrap_sha,closure_files,closure_sha):
        hash_value(bootstrap_sha);hash_value(closure_sha)
        if not isinstance(bootstrap_raw,bytes) or len(bootstrap_raw)>262144 or sha(bootstrap_raw)!=bootstrap_sha:raise RuntimeError('rpc_bootstrap_changed')
        if set(closure_files)!={name+'.py' for name in MODULES}:raise RuntimeError('rpc_closure_invalid')
        self.manifest={'schema':'cpu0-ssh-closure.v6','files':{name:sha(raw) for name,raw in closure_files.items()}}
        if sha(canonical(self.manifest)+b'\n')!=closure_sha:raise RuntimeError('rpc_closure_changed')
        self.code=bootstrap_raw.decode('utf-8');self.closure_sha=closure_sha;self.files=closure_files

    def command(self,operation):
        if operation not in HOSTS:raise RuntimeError('rpc_operation_invalid')
        remote=['env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8',
                'DOCKER_HOST=unix:///var/run/docker.sock','/usr/bin/python3','-I','-B','-c',self.code,self.closure_sha]
        return ['/usr/bin/ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',HOSTS[operation],shlex.join(remote)]

    def envelope(self,operation,arguments):
        if operation not in HOSTS:raise RuntimeError('rpc_operation_invalid')
        raw=canonical({'manifest':self.manifest,'files':{name:base64.b64encode(value).decode('ascii') for name,value in self.files.items()},'operation':operation,'arguments':arguments})
        if len(raw)>8*1024**2:raise RuntimeError('rpc_input_bound')
        return raw

    def call(self,operation,arguments,*,timeout=1200,absolute_deadline=None):
        if timeout not in (1200,60):raise RuntimeError('rpc_timeout_policy_changed')
        argv=self.command(operation);payload=self.envelope(operation,arguments)
        child=None;output=bytearray();pending=memoryview(payload);primary=None;started=time.monotonic();selector=selectors.DefaultSelector()
        deadline=min(started+timeout,absolute_deadline) if absolute_deadline is not None else started+timeout
        try:
            child=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,close_fds=True,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
            os.set_blocking(child.stdin.fileno(),False);os.set_blocking(child.stdout.fileno(),False)
            selector.register(child.stdin,selectors.EVENT_WRITE,'input');selector.register(child.stdout,selectors.EVENT_READ,'output')
            eof=False
            while not eof:
                remaining=deadline-time.monotonic()
                if remaining<=0:raise RuntimeError('rpc_deadline')
                for key,_ in selector.select(min(1,remaining)):
                    if key.data=='input':
                        count=os.write(child.stdin.fileno(),pending[:65536]);pending=pending[count:]
                        if not pending:selector.unregister(child.stdin);child.stdin.close()
                    else:
                        chunk=os.read(child.stdout.fileno(),65536)
                        if not chunk:selector.unregister(child.stdout);eof=True;break
                        output.extend(chunk)
                        if len(output)>MAX_PUBLIC:raise RuntimeError('rpc_output_bound')
            remaining=deadline-time.monotonic()
            if remaining<=0:raise RuntimeError('rpc_deadline')
            child.wait(timeout=remaining)
            value=json.loads(output)
            if not isinstance(value,dict):raise RuntimeError('rpc_public_result_invalid')
            if child.returncode!=0:
                error=RuntimeError('rpc_remote_refused');error.remoteFailureEvidence=value;raise error
            return {'schema':'cpu0-public-rpc.v6','operation':operation,'result':value,
                    'localClientExit':{'observed':True,'exitCode':child.returncode,'signal':None,
                                       'remoteStateNotInferredFromSsh':True}}
        except BaseException as error:
            primary=error;raise
        finally:
            selector.close();output.clear()
            if child is not None:
                if child.poll() is None:
                    child.terminate()
                    try:child.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        try:child.wait(timeout=5)
                        except subprocess.TimeoutExpired:pass
                proof={'observed':child.poll() is not None,'exitCode':child.returncode if child.returncode is not None and child.returncode>=0 else None,
                       'signal':'SIGTERM' if child.returncode==-signal.SIGTERM else 'SIGKILL' if child.returncode==-signal.SIGKILL else None,
                       'remoteStateNotInferredFromSsh':True}
                for stream in (child.stdin,child.stdout):
                    if stream is not None:stream.close()
                if primary is not None:primary.rpcExitEvidence=proof
