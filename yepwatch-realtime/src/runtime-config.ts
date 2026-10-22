/** Container networking is explicit; ordinary development remains loopback-only. */
export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const container = env.YEPWATCH_DEPLOYMENT === 'container'
  if (env.YEPWATCH_DEPLOYMENT && !container) throw new Error('Unknown gateway deployment mode')
  const host = env.YEPWATCH_REALTIME_HOST ?? '127.0.0.1'
  if (!container) {
    if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Development gateway must bind to loopback')
    return { host, container }
  }
  if (host !== '0.0.0.0' || env.YEPWATCH_PROPOSAL !== '1' || env.YEPWATCH_CONTINUOUS === '1')
    throw new Error('Container gateway requires explicit proposal mode and container bind')
  const origin = env.YEPWATCH_ALLOWED_ORIGINS
  if (!origin) throw new Error('Container gateway requires one explicit HTTPS origin')
  const url = new URL(origin)
  if (url.protocol !== 'https:' || origin !== url.origin) throw new Error('Container gateway requires one exact HTTPS origin')
  return { host, container }
}
