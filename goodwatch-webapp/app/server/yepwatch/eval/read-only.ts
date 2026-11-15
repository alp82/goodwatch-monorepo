/** Operator supplied read-only COPY credentials. Never loads .env or app database configuration. */
export function readOnlyCrate(env: NodeJS.ProcessEnv = process.env) {
  if (env.YEPWATCH_EVAL_READ_ONLY_COPY !== '1') throw new Error('Set YEPWATCH_EVAL_READ_ONLY_COPY=1 for an isolated read-only copy')
  const origin = new URL(env.YEPWATCH_EVAL_CRATE_ORIGIN ?? '')
  if (origin.pathname !== '/' || origin.username || origin.password) throw new Error('Use a plain copy origin')
  return async function select<T extends Record<string, unknown>>(stmt: string, args: unknown[] = []): Promise<T[]> {
    if (!/^SELECT\s/i.test(stmt) || /;|\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|COPY|REFRESH)\b/i.test(stmt)) throw new Error('Evaluation permits SELECT only')
    const response = await fetch(new URL('/_sql', origin), { method: 'POST', headers: { 'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(`${env.YEPWATCH_EVAL_CRATE_USERNAME ?? ''}:${env.YEPWATCH_EVAL_CRATE_PASSWORD ?? ''}`).toString('base64')}` },
      body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`Read-only evaluation query failed (${response.status})`)
    const data = await response.json() as { cols: string[]; rows: unknown[][]; error?: unknown }
    if (data.error || !Array.isArray(data.rows)) throw new Error('Read-only evaluation query failed')
    return data.rows.map(row => Object.fromEntries(data.cols.map((c, i) => [c, row[i]])) as T)
  }
}
