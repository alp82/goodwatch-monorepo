// Collects every test's gate failures and timing samples into one machine-readable file
// (E2E_REPORT, default artifacts/report-raw.json). e2e/run.mjs merges phases, applies the p95 budgets
// and writes report.json + summary.md.
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

interface Row {
  journey: string;
  file: string;
  fault: string;
  status: string;
  durationMs: number;
  error: string | null;
  gates: unknown[];
  timings: unknown[];
  artifacts: string[];
  screens: Record<string, string>;
}

export default class GateReporter implements Reporter {
  private rows: Row[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const read = (name: string) => {
      const a = result.attachments.find((x) => x.name === name);
      if (!a?.body) return [];
      try { return JSON.parse(a.body.toString('utf8')); } catch { return []; }
    };
    const project = test.parent.project()?.name ?? '';
    this.rows.push({
      journey: test.titlePath().slice(3).join(' › ') || test.title,
      file: path.basename(test.location.file),
      fault: project,
      status: result.status,
      durationMs: result.duration,
      error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 2000) ?? null,
      gates: read('gates'),
      timings: read('timings'),
      artifacts: result.attachments.filter((a) => a.path).map((a) => a.path!),
      screens: Object.fromEntries(result.attachments.filter((a) => a.name.startsWith('screen ') && a.contentType === 'text/plain' && a.body).map((a) => [a.name.slice(7), a.body!.toString('utf8').slice(0, 4000)])),
    });
  }
  onEnd(result: FullResult) {
    const file = process.env.E2E_REPORT ?? path.resolve('artifacts/report-raw.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ status: result.status, durationMs: result.duration, tests: this.rows }, null, 1));
  }
}
