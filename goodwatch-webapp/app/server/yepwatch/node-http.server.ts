import { createServer } from 'node:http'
import { Readable } from 'node:stream'
/** Local integration adapter; production remains the existing Remix HTTP service. */
export function listenYepWatch(handler: (request: Request) => Promise<Response>, port = 0) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = new Request(`http://127.0.0.1${incoming.url}`, { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body: Readable.toWeb(incoming) as ReadableStream, duplex: 'half' } : {}) })
      const response = await handler(request); outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch { outgoing.writeHead(503); outgoing.end() }
  })
  return new Promise<typeof server>(resolve => server.listen(port, '127.0.0.1', () => resolve(server)))
}
