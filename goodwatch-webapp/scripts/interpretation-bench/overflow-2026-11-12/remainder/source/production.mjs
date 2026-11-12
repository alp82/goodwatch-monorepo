// Load only the production questionnaires/decoder. Backend imports are replaced
// with throwing guards: this benchmark cannot retrieve titles or open databases.
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const hash = value => createHash('sha256').update(value).digest('hex')

export async function loadProduction() {
  const result = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'node',
    format: 'esm', metafile: true, logLevel: 'silent',
    stdin: { resolveDir: root, contents: `
      export { attributeRequest, fingerprintRequest, readingFields } from './app/server/combined-search/reading-retrieval.server';
      export { FINGERPRINT_META } from './app/ui/fingerprint/fingerprintMeta';
    ` },
    plugins: [{ name: 'no-backends', setup(builder) {
      builder.onResolve({ filter: /(?:utils\/qdrant|qdrant-http\.server)$/ }, args =>
        ({ path: args.path, namespace: 'blocked' }))
      builder.onLoad({ filter: /.*/, namespace: 'blocked' }, () => ({ contents: `
        export const MEDIA_COLLECTION = 'media_fingerprint_v1';
        export function retrievePoints() { throw Error('Backend access forbidden in interpretation benchmark'); }
      ` }))
    } }],
  })
  const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
  const sourceHashes = Object.fromEntries(Object.keys(result.metafile.inputs)
    .filter(p => !p.startsWith('blocked:') && p !== '<stdin>')
    .map(p => [p, hash(readFileSync(resolve(root, p)))]))
  const runtimePath = 'app/server/search-runtime/runtime.server.ts'
  const runtime = readFileSync(resolve(root, runtimePath), 'utf8')
  sourceHashes[runtimePath] = hash(runtime)
  const model = runtime.match(/export const JEV_MODEL = "([^"]+)"/)[1]
  const deadlineMs = Number(runtime.match(/export const JEV_DEADLINE_MS = (\d+)/)[1])
  // Extract the pure normalizer instead of importing search.server's live stores.
  const searchPath = 'app/server/combined-search/search.server.ts'
  const search = readFileSync(resolve(root, searchPath), 'utf8')
  const normalizer = search.match(/export function readingText\(text: string\): string \{([\s\S]*?)\n\}/)?.[1]
  if (!normalizer) throw Error('Production readingText changed; update benchmark extraction')
  const normalize = new Function('text', normalizer)
  sourceHashes[searchPath] = hash(search)
  return { ...api, normalize, model, deadlineMs, sourceHashes }
}
