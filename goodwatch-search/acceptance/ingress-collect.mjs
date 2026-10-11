// Run on the Docker host. Reads container logs; writes only its own sanitized evidence directory.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { iso } from './events.mjs';
import { parseIngressLine, hosts } from './ingress-events.mjs';
import { Journal } from './collect.mjs';
import { approvedLogging, inspectIngressFormat, loggingReady, imageId } from './ingress-config.mjs';
const exec = promisify(execFile);
export async function collectIngress(directory, since, host, { pollMs = 10000, expectedImageId } = {}) {
  if (!imageId(expectedImageId)) throw new Error('Expected tested proxy image digest required');
  if (!hosts.includes(host)) throw new Error('Use fixed host abio or vector1');
  if (!iso(since) || !since.endsWith('Z')) throw new Error('Supply an explicit UTC deployment boundary ending Z');
  const journal = new Journal(directory), followers = new Map(), children = new Set();
  let stopped = false;
  const note = (type, fields = {}) => journal.append({ type, at: new Date().toISOString(), host, ...fields });
  note('collector.started', { since });
  const follow = source => {
    const child = spawn('docker', ['logs', '--timestamps', '--follow', '--since', since, source.containerId], { stdio: ['ignore', 'pipe', 'pipe'] });
    const entry = { source, child, closed: false };
    followers.set(host, entry);
    children.add(child);
    note('collector.source', source);
    for (const stream of [child.stdout, child.stderr]) {
      const lines = createInterface({ input: stream });
      lines.on('line', line => {
        const parsed = parseIngressLine(line, source);
        if (parsed.record) journal.append(parsed.record);
        else if (parsed.malformed) note('collector.problem', { kind: 'malformed_telemetry', host: source.host, containerId: source.containerId });
      });
    }
    child.on('error', () => note('collector.problem', { kind: 'docker_logs_spawn', host: source.host, containerId: source.containerId }));
    child.on('close', code => {
      entry.closed = true;
      children.delete(child);
      note('collector.source_closed', { host: source.host, containerId: source.containerId, code });
      if (!stopped && code !== 0) note('collector.problem', { kind: 'docker_logs_exit', host: source.host, containerId: source.containerId });
    });
  };
  let runningPoll;
  const poll = async () => {
    if (stopped || runningPoll) return;
    runningPoll = true;
    const sources = [];
    try {
      try {
        const { stdout } = await exec('docker', ['inspect', '--format', inspectIngressFormat(host), 'coolify-proxy'], { timeout: 5000, maxBuffer: 4096 });
        const raw = JSON.parse(stdout.trim());
        if (!/^[a-f0-9]{64}$/.test(raw.containerId) || !iso(raw.startedAt) || typeof raw.running !== 'boolean') throw new Error();
        const accessLoggingReady = loggingReady(raw, host, expectedImageId);
        const source = { host, containerId: raw.containerId, startedAt: raw.startedAt, running: raw.running, imageId: imageId(raw.imageId) ? raw.imageId : null, accessLoggingReady, loggingFingerprint: accessLoggingReady ? approvedLogging(host).fingerprint : null };
        if (!accessLoggingReady) note('collector.problem', { kind: 'logging_configuration', containerId: raw.containerId });
        sources.push(source);
        const prior = followers.get(host);
        if (source.running && prior?.closed && prior.source.containerId === source.containerId)
          note('collector.problem', { kind: 'log_stream_restart', host, containerId: source.containerId });
        if (source.running && (!prior || prior.source.containerId !== source.containerId || prior.closed)) follow(source);
        // Existing followers continue draining replaced containers until Docker closes them.
      } catch {
        note('collector.problem', { kind: 'docker_inspect', host });
        sources.push({ host, running: false });
      }
      note('collector.heartbeat', { sources });
    } finally { runningPoll = false; }
  };
  await poll();
  const timer = setInterval(poll, pollMs);
  return new Promise(resolve => {
    const stop = async () => {
      if (stopped) return;
      stopped = true; clearInterval(timer);
      while (runningPoll) await new Promise(done => setTimeout(done, 10));
      const exits = [...children].map(child => new Promise(done => {
        child.once('close', done);
        child.kill('SIGTERM');
        const kill = setTimeout(() => child.kill('SIGKILL'), 2000);
        kill.unref();
      }));
      await Promise.all(exits);
      note('collector.stopped'); journal.close(); resolve();
    };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, since, host, expectedImageId] = process.argv.slice(2);
  if (!directory) { process.stderr.write('Usage: node ingress-collect.mjs EVIDENCE_DIRECTORY DEPLOYMENT_UTC HOST EXPECTED_IMAGE_ID\n'); process.exitCode = 2; }
  else collectIngress(directory, since, host, { expectedImageId }).catch(() => { process.stderr.write('Collector failed; coverage is incomplete. No raw logs emitted.\n'); process.exitCode = 2; });
}
