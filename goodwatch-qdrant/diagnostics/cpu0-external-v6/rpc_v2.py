"""Distinct closed v2 operations using the unchanged bounded SSH client."""
import base64
import shlex

from packet import canonical,hash_value,sha
from bootstrap_v2 import MODULES
from rpc import Rpc

HOSTS={'adopt-running-clone':'root@10.0.0.32','preflight':'root@10.0.0.32',
       'stage':'root@10.0.0.32','turnover':'root@10.0.0.32',
       'outer-admit':'root@10.0.0.32','register-consumer':'root@10.0.0.32',
       'cleanup':'root@10.0.0.32','producer-stream':'root@10.0.0.21',
       'producer-confirm':'root@10.0.0.21','producer-cleanup':'root@10.0.0.21'}


class RpcV2(Rpc):
    def __init__(self,bootstrap_raw,bootstrap_sha,closure_files,closure_sha):
        hash_value(bootstrap_sha);hash_value(closure_sha)
        if type(bootstrap_raw)is not bytes or len(bootstrap_raw)>262144 or sha(bootstrap_raw)!=bootstrap_sha:
            raise RuntimeError('rpc_bootstrap_changed')
        if (type(closure_files)is not dict or set(closure_files)!={name+'.py' for name in MODULES}
                or any(type(raw)is not bytes or len(raw)>262144 for raw in closure_files.values())
                or sum(map(len,closure_files.values()))>2*1024**2):
            raise RuntimeError('rpc_closure_invalid')
        self.manifest={'schema':'cpu0-ssh-closure.v7',
                       'files':{name:sha(raw) for name,raw in closure_files.items()}}
        if sha(canonical(self.manifest)+b'\n')!=closure_sha:
            raise RuntimeError('rpc_closure_changed')
        self.code=bootstrap_raw.decode('utf-8');self.closure_sha=closure_sha;self.files=closure_files

    def command(self,operation):
        if operation not in HOSTS:raise RuntimeError('rpc_operation_invalid')
        remote=['env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8',
                'DOCKER_HOST=unix:///var/run/docker.sock','/usr/bin/python3','-I','-B',
                '-c',self.code,self.closure_sha]
        return ['/usr/bin/ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
                HOSTS[operation],shlex.join(remote)]

    def envelope(self,operation,arguments):
        if operation not in HOSTS or type(arguments)is not dict:
            raise RuntimeError('rpc_operation_invalid')
        raw=canonical({'manifest':self.manifest,
            'files':{name:base64.b64encode(value).decode('ascii') for name,value in self.files.items()},
            'operation':operation,'arguments':arguments})
        if len(raw)>8*1024**2:raise RuntimeError('rpc_input_bound')
        return raw

    def call(self,*args,**kwargs):
        result=super().call(*args,**kwargs)
        return {**result,'schema':'cpu0-public-rpc.v7'}
