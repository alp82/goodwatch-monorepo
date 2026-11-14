// Optional on-device system trace (Perfetto) around a measured step: YW_E2E_TRACE=<comma list of step names> or 1
// for every traced step. The trace lands next to the run's videos (<step>.perfetto-trace) for ui.perfetto.dev or
// trace_processor. Diagnostics only: tracing adds load, so a traced run's timings aren't gate numbers.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdirp, run, sleep, toolEnv, tools } from './env.mjs';
import { PACKAGE } from './build.mjs';

const wanted = (process.env.YW_E2E_TRACE ?? '').split(',').filter(Boolean);
export const tracing = name => wanted.includes('1') || wanted.includes(name);

const config = ms => `
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch" ftrace_events: "sched/sched_wakeup" ftrace_events: "sched/sched_waking" ftrace_events: "power/cpu_frequency"
  ftrace_events: "task/task_newtask" ftrace_events: "task/task_rename"
  atrace_categories: "view" atrace_categories: "gfx" atrace_categories: "input" atrace_categories: "am" atrace_categories: "wm" atrace_categories: "dalvik" atrace_categories: "res" atrace_categories: "binder_driver"
  atrace_apps: "${PACKAGE}" atrace_apps: "com.google.android.webview" } } }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true proc_stats_poll_ms: 250 } } }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
duration_ms: ${ms}
`;

/** Starts a trace of `ms` on the phone; returns stop(), which waits for it and pulls it into `dir`. */
export async function startTrace(phone, name, dir, ms = 8000) {
  const remote = `/data/misc/perfetto-traces/yw-${name}.perfetto-trace`;
  const child = spawn(tools.adb, ['-s', phone.serial, 'shell', `perfetto --txt -c - -o ${remote}`], { env: toolEnv(), stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.end(config(ms));
  const done = new Promise(resolve => child.on('exit', resolve));
  await sleep(600); // perfetto arms its data sources
  return async () => {
    await done;
    const local = path.join(mkdirp(dir), `${name}-${phone.name}.perfetto-trace`);
    run(tools.adb, ['-s', phone.serial, 'pull', remote, local]);
    return local;
  };
}
