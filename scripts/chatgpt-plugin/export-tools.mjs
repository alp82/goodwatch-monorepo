// Serialize the actual SDK discovery contract. Calls no member data handlers.
import '../../goodwatch-webapp/app/server/title-filter/test-alias.ts'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const require = createRequire(new URL('../../goodwatch-webapp/package.json', import.meta.url))
const { createMcpHandler } = await import(require.resolve('@modelcontextprotocol/server'))
const { createToolServer } = await import('../../goodwatch-webapp/app/server/mcp/tools.server.ts')
const handler = createMcpHandler(() => createToolServer('submission-contract-only', 'https://goodwatch.app', true), { legacy: 'stateless' })
try {
  const response = await handler.fetch(new Request('https://goodwatch.app/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  }))
  if (!response.ok) throw new Error(`Discovery returned ${response.status}`)
  const text = await response.text()
  const rpc = JSON.parse(text.startsWith('event:') ? text.split('data: ')[1].split('\n')[0] : text)
  if (rpc.error || rpc.result?.tools?.length !== 25) throw new Error('Unexpected tool contract')
  await writeFile(new URL('../../docs/chatgpt-plugin/evidence/tools.json', import.meta.url), JSON.stringify({ source: 'local SDK tools/list; no production authentication', tools: rpc.result.tools }, null, 2) + '\n')
  console.log(`Exported ${rpc.result.tools.length} tool definitions`)
} finally { await handler.close() }
