import datetime
import hashlib
import json
import os
import pathlib
import selectors
import shlex
import subprocess
import time

HERE = pathlib.Path(__file__).resolve().parent
PREP = HERE.parent / 'offline-bm25-reader-20261013'
DRIVER_SHA = '81edd90eb4f51344269a1070a5f17fc7c2bcd3b4c14b50973b6a82999a3f8cad'
READER_SHA = 'c42fad2c9d2cc9c7a2b707d261bdc1a54c8ef9b0ce72b2663a6c4fc165ae5774'
PLAN_SHA = 'a7264d2519d7a68275c4600fc57c48eda93896c389cf6432efb6c087cefc3600'
CONTAINER = '9de6d8c048ccf99644cffe43066ca74193f82d345538263ffd281229be58a326'
COMMIT = '927d38b2cca815f02a0b1636ec06f63c24603396'
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()

def physical(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}

def exclusive(path, binary=False):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    return os.fdopen(fd, 'wb' if binary else 'w')

driver = (PREP / 'eval-driver.mjs').read_bytes()
reader = (PREP / 'reader.mjs').read_bytes()
plan = (PREP / 'PLAN-v2.json').read_bytes()
assert sha(driver) == DRIVER_SHA and sha(reader) == READER_SHA and sha(plan) == PLAN_SHA
# A child-owned watchdog prevents a transport timeout from leaving Node running in Docker.
# Only public source goes in argv; the existing role's credentials stay in its environment.
prefix = "const taskWatchdog=setTimeout(()=>process.exit(1),620000);\n"
prefix += "if(process.env.SOURCE_COMMIT!==" + json.dumps(COMMIT) + "||process.env.WEBAPP_ROLE!=='search'){process.stderr.write('{\"kind\":\"refusal\",\"reason\":\"role_source_mismatch\",\"complete\":false}\\n');process.exit(1);}\n"
executed = prefix.encode() + driver + b'\nclearTimeout(taskWatchdog);\n'
remote = ['/usr/bin/timeout', '--signal=TERM', '--kill-after=5s', '630s',
          '/usr/bin/docker', 'exec', '-i', CONTAINER,
          '/usr/local/bin/node', '--input-type=module', '-e', executed.decode()]
argv = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
        '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
        'root@10.0.0.20', shlex.join(remote)]
prepared = {'schema': 'root-readonly-bm25-acquisition.v1',
            'wrapperSha256': sha(pathlib.Path(__file__).read_bytes()),
            'readerSha256': READER_SHA, 'driverSha256': DRIVER_SHA,
            'executedSourceSha256': sha(executed), 'planSha256': PLAN_SHA,
            'planBytes': len(plan), 'container': CONTAINER, 'requiredCommit': COMMIT,
            'nodeLifetimeMs': 620000, 'remoteTimeoutSeconds': 630,
            'transportTimeoutSeconds': 650, 'requestsMax': 88,
            'outputBytesMax': 2147483648, 'stderrBytesMax': 1048576,
            'authorization': 'existing task scope: fixed public catalog vector retrieval; no production writes or searches',
            'retries': 0, 'started': now()}
with exclusive(HERE / 'prepared.json') as f:
    json.dump(prepared, f, indent=2)
output_path, stderr_path = HERE / 'actual.ndjson', HERE / 'actual.stderr'
with exclusive(output_path, True) as output, exclusive(stderr_path, True) as err:
    process = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=output, stderr=err)
    reason = None
    started = time.monotonic()
    offset = 0
    input_closed = False
    os.set_blocking(process.stdin.fileno(), False)
    selector = selectors.DefaultSelector()
    selector.register(process.stdin, selectors.EVENT_WRITE)
    try:
        while process.poll() is None:
            if time.monotonic() - started > 650:
                reason = 'transport_timeout'
            elif output_path.stat().st_size > 2147483648:
                reason = 'outer_output_bound'
            elif stderr_path.stat().st_size > 1048576:
                reason = 'outer_stderr_bound'
            if reason:
                process.kill()
                break
            if not input_closed:
                for key, _ in selector.select(timeout=0.2):
                    try:
                        offset += os.write(key.fd, memoryview(plan)[offset:offset + 32768])
                    except BlockingIOError:
                        continue
                    if offset == len(plan):
                        selector.unregister(process.stdin)
                        process.stdin.close()
                        input_closed = True
            else:
                time.sleep(0.2)
    except BrokenPipeError:
        reason = 'input_closed'
    finally:
        selector.close()
        if not input_closed:
            process.stdin.close()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
            reason = reason or 'transport_wait_timeout'
    if not input_closed:
        reason = reason or 'input_incomplete'
    if output_path.stat().st_size > 2147483648:
        reason = reason or 'outer_output_bound'
    if stderr_path.stat().st_size > 1048576:
        reason = reason or 'outer_stderr_bound'
record = {**prepared, 'finished': now(), 'elapsedSeconds': time.monotonic() - started,
          'sshDockerNodeExitCode': process.returncode, 'outerRefusal': reason,
          'output': physical(output_path), 'privateStderr': physical(stderr_path),
          'terminalValidationPending': True}
with exclusive(HERE / 'actual-invocation.json') as f:
    json.dump(record, f, indent=2)
print(json.dumps(record, indent=2))
