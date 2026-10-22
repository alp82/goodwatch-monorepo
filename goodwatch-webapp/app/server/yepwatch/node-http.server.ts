import { createServer } from 'node:http'
import { Readable } from 'node:stream'
/** Local integration adapter; production remains the existing Remix HTTP service. */
export function listenYepWatch(handler: (request: Request) => Promise<Response>, port = 0) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      // Use the actual bound loopback port, never a caller-controlled Host. The
      // central issuer checks the addressed origin on signed consent requests.
      const address = server.address() as { port: number }
      const request = new Request(`http://127.0.0.1:${address.port}${incoming.url}`, { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: 'half' } : {}) })
      const response = await handler(request)
      const headers: Record<string, string | string[]> = Object.fromEntries(response.headers)
      const cookies = response.headers.getSetCookie()
      if (cookies.length) headers['set-cookie'] = cookies
      outgoing.writeHead(response.status, headers); outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch { outgoing.writeHead(503); outgoing.end() }
  })
  return new Promise<typeof server>(resolve => server.listen(port, '127.0.0.1', () => resolve(server)))
}
