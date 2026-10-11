// Run on the Docker host. Reads container logs; writes only its own sanitized evidence directory.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openSync, mkdirSync, readFileSync, existsSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { parseDockerLine, iso, commit } from './events.mjs';
const exec = promisify(execFile);
export class Journal {
  constructor(directory) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, 'events.ndjson');
    this.seen = new Set();
    if (existsSync(this.path)) {
      const text = readFileSync(this.path, 'utf8');
      // A partial durable record is an evidence failure, not something to silently truncate.
      if (text && !text.endsWith('\n')) throw new Error('Evidence journal has an incomplete final record');
      for (const line of text.split('\n').filter(Boolean)) {
        const item = JSON.parse(line);
        if (item.key) this.seen.add(item.key);
      }
    }
    this.fd = openSync(this.path, 'a', 0o600);
  }
  append(record) {
    if (record.key && this.seen.has(record.key)) return false;
    const bytes = Buffer.from(JSON.stringify(record) + '\n');
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset);
    fsyncSync(this.fd);
    if (record.key) this.seen.add(record.key);
    return true;
  }
  close() { closeSync(this.fd); }
}
const inspectFormat = '{"containerId":"{{.Id}}","startedAt":"{{.State.StartedAt}}","running":{{.State.Running}},"commit":"{{range .Config.Env}}{{if eq (index (split . "=") 0) "SOURCE_COMMIT"}}{{index (split . "=") 1}}{{end}}{{end}}"}';
export async function collect(directory, since, { pollMs = 10000 } = {}) {
  if (!iso(since) || !since.endsWith('Z')) throw new Error('Supply an explicit UTC deployment boundary ending Z');
  const journal = new Journal(directory), followers = new Map(), children = new Set();
  let stopped = false;
  const note = (type, fields = {}) => journal.append({ type, at: new Date().toISOString(), ...fields });
  note('collector.started', { since });
  const follow = source => {
    const child = spawn('docker', ['logs', '--timestamps', '--follow', '--since', since, source.containerId], { stdio: ['ignore', 'pipe', 'pipe'] });
    const entry = { source, child, closed: false };
    followers.set(source.role, entry);
    children.add(child);
    note('collector.source', source);
    for (const stream of [child.stdout, child.stderr]) {
      const lines = createInterface({ input: stream });
      lines.on('line', line => {
        const parsed = parseDockerLine(line, source);
        if (parsed.record) journal.append(parsed.record);
        else if (parsed.malformed) note('collector.problem', { kind: 'malformed_telemetry', role: source.role, containerId: source.containerId });
      });
    }
    child.on('error', () => note('collector.problem', { kind: 'docker_logs_spawn', role: source.role, containerId: source.containerId }));
    child.on('close', code => {
      entry.closed = true;
      children.delete(child);
      note('collector.source_closed', { role: source.role, containerId: source.containerId, code });
      if (!stopped && code !== 0) note('collector.problem', { kind: 'docker_logs_exit', role: source.role, containerId: source.containerId });
    });
  };
  let runningPoll;
  const poll = async () => {
    if (stopped || runningPoll) return;
    runningPoll = true;
    const roles = [];
    try {
      for (const role of ['a', 'b']) {
        try {
          const { stdout } = await exec('docker', ['inspect', '--format', inspectFormat, `goodwatch-search-${role}`], { timeout: 5000, maxBuffer: 4096 });
          const raw = JSON.parse(stdout.trim());
          if (!/^[a-f0-9]{64}$/.test(raw.containerId) || !iso(raw.startedAt) || typeof raw.running !== 'boolean' || !commit(raw.commit)) throw new Error();
          const source = { role, containerId: raw.containerId, startedAt: raw.startedAt, commit: raw.commit, running: raw.running };
          roles.push(source);
          const prior = followers.get(role);
          if (source.running && prior?.closed && prior.source.containerId === source.containerId)
            note('collector.problem', { kind: 'log_stream_restart', role, containerId: source.containerId });
          if (source.running && (!prior || prior.source.containerId !== source.containerId || prior.closed)) follow(source);
          // Existing followers continue draining replaced containers until Docker closes them.
        } catch {
          note('collector.problem', { kind: 'docker_inspect', role });
          roles.push({ role, running: false });
        }
      }
      note('collector.heartbeat', { roles });
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
  const [directory, since] = process.argv.slice(2);
  if (!directory) { process.stderr.write('Usage: node collect.mjs EVIDENCE_DIRECTORY DEPLOYMENT_UTC\n'); process.exitCode = 2; }
  else collect(directory, since).catch(() => { process.stderr.write('Collector failed; coverage is incomplete. No raw logs emitted.\n'); process.exitCode = 2; });
}
