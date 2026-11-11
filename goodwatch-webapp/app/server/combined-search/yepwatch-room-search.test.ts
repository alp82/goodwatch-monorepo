import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'
import { roomSearch } from '../yepwatch/proposal-intent.ts'

test('a capped mood search is a definitive refusal, not a saved connection retry', async () => {
  const exports: { searchYepWatchRoom?: (request: Request) => Promise<Response> } = {}
  const source = readFileSync(new URL('./yepwatch.server.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const secret = 'test-search-secret-at-least-32-characters'
  const batch = { rows: [], reading: [], errors: ['Showing basic search results'], readingUnavailable: 'budget' }
  let viewer: any
  let calls = 0
  runInNewContext(code, { exports, Request, Response, Buffer, process: { env: { YEPWATCH_SEARCH_SECRET: secret } }, require: (name: string) => {
    if (name === '@remix-run/node') return { json: (body: unknown, init: ResponseInit) => Response.json(body, init) }
    if (name === 'zod') return { z }
    if (name.endsWith('crypto.server')) return { equal: (a: string, b: string) => a === b }
    if (name.endsWith('search.server')) return { combinedSearch: async (_q: unknown, _policy: unknown, visitor: unknown) => { viewer = visitor; calls++; return batch } }
    if (name.endsWith('admission.server')) return { searchAdmission: { enter: () => () => {} } }
    if (name.endsWith('role.server')) return { runsSearch: () => true }
    if (name.endsWith('search-filters')) return { titlePointId: () => 1 }
    throw new Error(`Unexpected dependency: ${name}`)
  } })
  const transport: typeof fetch = async (input, init) => exports.searchYepWatchRoom!(new Request(input, init))
  const interpret = roomSearch({ YEPWATCH_SEARCH_SECRET: secret }, transport)!
  await assert.rejects(interpret('dark and funny', 'DE', [8]), (error: unknown) => {
    const e = error as { code: string; retryable: boolean; message: string }
    assert.equal(e.code, 'catalog_unavailable')
    assert.equal(e.retryable, false)
    assert.match(e.message, /start without an idea/i)
    return true
  })
  assert.equal(viewer.attribution.actor, 'unknown', 'old API clients are not misclassified as guests')
  for (const actor of ['member', 'guest'] as const) {
    await assert.rejects(interpret('dark and funny', 'DE', [8], actor))
    assert.deepEqual({ ...viewer.attribution }, { consumer: 'yepwatch', surface: 'yepwatch', trigger: 'api', reported_by: 'server', actor })
  }
  const before = calls
  const unauthorized = await exports.searchYepWatchRoom!(new Request('https://search.invalid/api/combined-search', { method: 'POST', body: JSON.stringify({ prompt: 'dark and funny', country: 'DE', serviceIds: [], actor: 'member' }) }))
  assert.equal(unauthorized.status, 403)
  assert.equal(calls, before, 'no identity is accepted before the integration secret is verified')
})
