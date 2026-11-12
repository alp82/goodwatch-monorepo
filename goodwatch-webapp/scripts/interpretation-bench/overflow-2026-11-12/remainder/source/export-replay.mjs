// Produce matched captures for the existing ranker. Reads files only; no API calls.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { hash, loadProduction } from './production.mjs'

const { values: args } = parseArgs({ options: {
  run: { type: 'string' }, model: { type: 'string' }, captures: { type: 'string' }, out: { type: 'string' },
  concurrency: { type: 'string', default: '1' }, repeat: { type: 'string', default: '0' },
} })
if (!args.run || !args.model || !args.captures || !args.out)
  throw Error('--run, --model, --captures (frozen baseline directory), --out (new directory) required')
const manifest = JSON.parse(readFileSync(join(args.run, 'manifest.json')))
const api = await loadProduction()
const trials = readFileSync(join(args.run, 'trials.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  .filter(r => !r.warmup && r.model === args.model && r.concurrency === Number(args.concurrency) && r.repeat === Number(args.repeat))
const suite = JSON.parse(readFileSync(join(args.run, 'cases.json')))
if (!manifest.models.some(m => m.id === args.model) || trials.length !== suite.cases.length || new Set(trials.map(r => r.caseId)).size !== trials.length)
  throw Error('Missing/duplicate trials: export requires one complete matched cohort')
const entries = trials.map(r => {
  if (r.status !== 'ok') throw Error(`Failed trial ${r.caseId}; do not silently omit it from relevance comparisons`)
  const path = join(args.captures, `${r.caseId}.json`), bytes = readFileSync(path)
  const cap = JSON.parse(bytes)
  if (cap.id !== r.caseId || cap.query !== r.query || typeof cap.language?.text !== 'string' || !Array.isArray(cap.titleLookup))
    throw Error(`Capture mismatch: ${r.caseId}`)
  // A translated or preprocessed baseline is a different experiment.
  if (api.normalize(cap.language.text) !== api.normalize(r.query)) throw Error(`Reading text differs: ${r.caseId}`)
  return { id: r.caseId, baselineHash: hash(bytes), capture: { ...cap,
    reading: { ...cap.reading, raw: r.raw, model: manifest.models.find(m => m.id === r.model).model },
    interpretationBenchmark: { source: resolve(args.run), trial: r.id, baselineHash: hash(bytes) },
  } }
})
mkdirSync(args.out, { mode: 0o700 })
for (const e of entries) writeFileSync(join(args.out, `${e.id}.json`), JSON.stringify(e.capture))
writeFileSync(join(args.out, 'index.json'), JSON.stringify({ baselineCaptures: resolve(args.captures),
  entries: entries.map(({ id, baselineHash }) => ({ id, baselineHash })),
  note: 'Matched interpretation captures only. Use a pinned catalog/index and common pooled judgments for relevance scoring.' }, null, 2))
console.log(`Exported ${entries.length} matched captures; no network requests`)
