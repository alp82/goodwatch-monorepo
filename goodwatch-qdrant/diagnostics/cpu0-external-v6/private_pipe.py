"""Bounded private stream transport; only consumer public JSON reaches output.

No executable default. Root's separately authenticated outer owns remote census
and cleanup; an SSH exit alone NEVER proves a remote process or container gone.
"""
import json
import os
import selectors
import signal
import subprocess
import sys
import time
from pathlib import Path
import shlex

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from packet import canonical,hash_value,sha

PRIVATE_BUFFER=2*1024**2
PUBLIC_LINE=262144
PUBLIC_TOTAL=16*1024**2
KINDS=frozenset(('consumer-admission','baseline-batch','paired-batch','excluded',
                 'complete','failed','prepared-only'))
ROOT='/root/goodwatch-qdrant-cold-406-20261011'
STAGE=ROOT+'/pin-control-20261012-100-cpu0-v1'
PRODUCER_IMAGE='sha256:3d698950ee07437a64d9bbc8eaafe2d4638a7f90dde0e57aee133d51b6653a7f'
PRODUCER_SOURCE_SHA='7aea9823b080b8c00234c30cef5c54510193f203b59048b7a38f371f33fe2230'


def fixed_consumer_command(source_sha,external_sha,predecessor,*,raise_own_nofile=False):
    for value in (source_sha,external_sha,predecessor):hash_value(value)
    if type(raise_own_nofile) is not bool:raise RuntimeError('pipe_nofile_optin_invalid')
    consumer=['env','-i','PATH=/usr/bin:/bin','LANG=C.UTF-8',
              'DOCKER_HOST=unix:///var/run/docker.sock','QDRANT_URL=http://127.0.0.1:16333/',
              STAGE+'/node',STAGE+'/consumer_cpu0.mjs','--execute-reviewed',
              '--handoff-sha256',predecessor,'--cpu0-source-freeze-sha256',source_sha,
              '--external-manifest-sha256',external_sha]
    if raise_own_nofile:consumer.append('--raise-own-nofile')
    ssh=['/usr/bin/ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes']
    return ssh+['root@10.0.0.32',shlex.join(consumer)]


def admission_frame(value,source_sha,external_sha,predecessor):
    """Capture cannot begin until the fresh consumer preflight handoff exists."""
    if not isinstance(value,dict) or value.get('kind')!='consumer-admission' or value.get('variant')!='cpu0-owned-lifecycle.v1' or value.get('sourceFreezeSha256')!=source_sha or value.get('externalManifestSha256')!=external_sha:
        raise RuntimeError('pipe_consumer_admission_invalid')
    h=value.get('handoff')
    if not isinstance(h,dict) or set(h)!={'schema','owner','previousSha256','snapshot','sha256'} or h['schema']!='clone-lifecycle-handoff.cpu0.v1' or h['owner']!='preflight' or h['previousSha256']!=predecessor:
        raise RuntimeError('pipe_consumer_handoff_invalid')
    hash_value(h['sha256'])
    raw=canonical({key:item for key,item in h.items() if key!='sha256'})+b'\n'
    if sha(raw)!=h['sha256']:raise RuntimeError('pipe_consumer_handoff_invalid')
    return h['sha256']


def exit_evidence(child,observed):
    code=child.returncode
    return {'observed':observed,'exitCode':code if code is not None and code>=0 else None,
            'signal':signal.Signals(-code).name if code is not None and code<0 and -code in (signal.SIGTERM,signal.SIGKILL,signal.SIGINT) else ('other' if code is not None and code<0 else None),
            'remoteBirthGone':None,'remoteExitNotInferredFromSsh':True}


def close_client(child):
    """Only this direct local transport client; remote births remain unknown."""
    if child.poll() is None:
        child.terminate()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.kill()
            try:child.wait(timeout=5)
            except subprocess.TimeoutExpired:return exit_evidence(child,False)
    return exit_evidence(child,True)


def stream(consumer_argv,producer_argv,source_sha,external_sha,predecessor,
           emit,*,validate_admission,register_consumer,register_producer,
           validate_producer_exit,producer_input=b'',timeout=7200,ready_timeout=1200,
           absolute_deadline=None,spawn=subprocess.Popen):
    """Root freezes the constructed fixed argv in the execution packet.

    Producer starts only after consumer metadata admission. Private bytes have
    no logger/file sink. EOF and a separately observed producer exit 0 precede
    the existing private-producer-complete marker and any benchmark phase.
    """
    for value in (source_sha,external_sha,predecessor):hash_value(value)
    if timeout!=7200 or ready_timeout!=1200:raise RuntimeError('pipe_budget_changed')
    consumer=None;producer=None;selector=selectors.DefaultSelector();pending=bytearray()
    public=bytearray();public_count=0;admitted=False;producer_eof=False;sent_complete=False
    producer_lines=bytearray();producer_registered=False;producer_exit_proof=None
    if not isinstance(producer_input,bytes) or len(producer_input)>8*1024**2:raise RuntimeError('pipe_public_input_bound')
    producer_control=bytearray(producer_input)
    consumer_stdout_eof=False;phase='consumer-start';started=time.monotonic();primary=None
    environment={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'}
    exits={}
    try:
        consumer=spawn(consumer_argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,close_fds=True,env=environment)
        os.set_blocking(consumer.stdout.fileno(),False);os.set_blocking(consumer.stdin.fileno(),False)
        selector.register(consumer.stdout,selectors.EVENT_READ,'public')
        while True:
            elapsed=time.monotonic()-started
            if elapsed>timeout or absolute_deadline is not None and time.monotonic()>=absolute_deadline or not admitted and elapsed>ready_timeout:
                raise RuntimeError('pipe_deadline')
            if consumer.poll() is not None and consumer_stdout_eof:
                consumer.wait();exits['consumer']=exit_evidence(consumer,True)
                if consumer.returncode!=0:raise RuntimeError('pipe_consumer_exit_failed')
                if not admitted or not sent_complete:raise RuntimeError('pipe_completion_missing')
                break
            if producer is not None and producer_eof and not sent_complete:
                status=producer.poll()
                if status is not None:
                    producer.wait();exits['producer']=exit_evidence(producer,True)
                    if status!=0:raise RuntimeError('pipe_producer_exit_failed')
                    if not producer_registered or producer_exit_proof is None:raise RuntimeError('pipe_producer_exit_proof_missing')
                    validate_producer_exit(producer_exit_proof)
                    pending.extend(b'{"kind":"private-producer-complete","exitCode":0}\n')
                    sent_complete=True
            if pending:
                try:selector.get_key(consumer.stdin)
                except KeyError:selector.register(consumer.stdin,selectors.EVENT_WRITE,'private-write')
            elif sent_complete and consumer.stdin is not None:
                try:selector.unregister(consumer.stdin)
                except KeyError:pass
                consumer.stdin.close();consumer.stdin=None
            for key,_ in selector.select(min(1,timeout-elapsed)):
                if key.data=='producer-control':
                    count=os.write(producer.stdin.fileno(),producer_control[:65536])
                    if count<=0:raise RuntimeError('pipe_producer_control_write_failed')
                    del producer_control[:count]
                    if not producer_control:
                        selector.unregister(producer.stdin);producer.stdin.close();producer.stdin=None
                elif key.data=='private-write':
                    count=os.write(consumer.stdin.fileno(),pending[:65536])
                    if count<=0:raise RuntimeError('pipe_private_write_failed')
                    del pending[:count]
                    if not pending:selector.unregister(consumer.stdin)
                    if producer is not None and not producer_eof and len(pending)<PRIVATE_BUFFER-65536:
                        try:selector.get_key(producer.stdout)
                        except KeyError:selector.register(producer.stdout,selectors.EVENT_READ,'private-read')
                elif key.data=='private-read':
                    chunk=os.read(producer.stdout.fileno(),65536)
                    if not chunk:
                        if producer_lines:raise RuntimeError('pipe_partial_producer_frame')
                        selector.unregister(producer.stdout);producer.stdout.close();producer_eof=True
                    else:
                        producer_lines.extend(chunk)
                        while b'\n' in producer_lines:
                            line,_,tail=producer_lines.partition(b'\n');producer_lines=bytearray(tail)
                            if not line or len(line)>PRIVATE_BUFFER:raise RuntimeError('pipe_private_buffer_bound')
                            value=json.loads(line)
                            if not isinstance(value,dict):raise RuntimeError('pipe_producer_frame_invalid')
                            if not producer_registered:
                                if value.get('kind')!='private-producer-registration':raise RuntimeError('pipe_producer_registration_missing')
                                proof=register_producer(value)
                                if not isinstance(proof,dict) or proof.get('registeredBeforeForwarding') is not True:raise RuntimeError('pipe_producer_registration_refused')
                                producer_registered=True
                                # Public control frames are demultiplexed; the
                                # consumer receives only frozen private grammar.
                                emit({'kind':'producer-registration','proof':proof})
                            elif value.get('kind')=='private-producer-exit-proof':
                                if producer_exit_proof is not None:raise RuntimeError('pipe_producer_exit_proof_duplicate')
                                producer_exit_proof=value.get('proof')
                            elif value.get('kind') in ('private-batch','private-excluded') and producer_exit_proof is None:
                                pending.extend(line+b'\n')
                            else:raise RuntimeError('pipe_producer_frame_invalid')
                        if len(producer_lines)>PRIVATE_BUFFER:raise RuntimeError('pipe_private_buffer_bound')
                        if len(pending)>PRIVATE_BUFFER:raise RuntimeError('pipe_private_buffer_bound')
                        if len(pending)>=PRIVATE_BUFFER-65536:selector.unregister(producer.stdout)
                elif key.data=='public':
                    chunk=os.read(consumer.stdout.fileno(),65536)
                    if not chunk:
                        selector.unregister(consumer.stdout);consumer_stdout_eof=True
                        if public:raise RuntimeError('pipe_partial_public_frame')
                        continue
                    public.extend(chunk);public_count+=len(chunk)
                    if public_count>PUBLIC_TOTAL:raise RuntimeError('pipe_public_output_bound')
                    while b'\n' in public:
                        line,_,tail=public.partition(b'\n');public=bytearray(tail)
                        if not line or len(line)>PUBLIC_LINE:raise RuntimeError('pipe_public_frame_bound')
                        value=json.loads(line)
                        if not isinstance(value,dict) or value.get('kind') not in KINDS:
                            raise RuntimeError('pipe_public_frame_invalid')
                        if not admitted:
                            admission_frame(value,source_sha,external_sha,predecessor)
                            # Full hash-bound pure contract validation precedes
                            # independent actual remote-birth registration.
                            validated=validate_admission(value)
                            registered=register_consumer(value,validated)
                            if not isinstance(registered,dict) or registered.get('registeredBeforeCapture') is not True:
                                raise RuntimeError('pipe_consumer_registration_refused')
                            admitted=True;emit(value);phase='producer-stream'
                            producer=spawn(producer_argv,stdin=subprocess.PIPE if producer_input else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,close_fds=True,env=environment)
                            os.set_blocking(producer.stdout.fileno(),False)
                            selector.register(producer.stdout,selectors.EVENT_READ,'private-read')
                            if producer_input:
                                os.set_blocking(producer.stdin.fileno(),False)
                                selector.register(producer.stdin,selectors.EVENT_WRITE,'producer-control')
                        else:emit(value)
                    if len(public)>PUBLIC_LINE:raise RuntimeError('pipe_public_frame_bound')
        return {'schema':'cpu0-private-transport.v6','status':'local-clients-exited',
                'sourceFreezeSha256':source_sha,'externalManifestSha256':external_sha,
                'exits':exits,'producerExitZeroBeforeCompletionMarker':True,
                'privatePayloadPersisted':False,'remoteCleanupRequired':True}
    except BaseException as error:
        primary=error
        error.pipeFailurePhase=phase
        raise
    finally:
        selector.close();pending.clear();public.clear();producer_lines.clear();producer_control.clear()
        for name,child in (('producer',producer),('consumer',consumer)):
            if child is None:continue
            proof=close_client(child);exits[name]=proof
            for fd in (child.stdin,child.stdout):
                if fd is not None:
                    try:fd.close()
                    except OSError:pass
        if primary is not None:
            primary.pipeExitEvidence=exits


if __name__=='__main__':
    print(json.dumps({'schema':'cpu0-private-transport.v6','status':'prepared-only',
                      'hostOperations':0,'privatePayloadPersisted':False,
                      'executionPacketReady':False}))
