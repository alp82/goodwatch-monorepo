import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, openSync, fsyncSync, closeSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cpus, totalmem, hostname, platform, arch } from 'node:os'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { loadProduction, hash, root } from './production.mjs'
import { compactRequest, projectCompact, validateJev, assess, vocabulary } from './contract.mjs'

// Capture at import, not between cohorts after modules are already cached.
const benchmarkSourceHashes = Object.fromEntries(readdirSync(new URL('./', import.meta.url))
  .filter(p => p.endsWith('.mjs')).map(p => [p, hash(readFileSync(new URL(p, import.meta.url)))]))

export const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] : null
const mean = values => values.reduce((s, x) => s + x, 0) / values.length
const finite = (x, min = 0) => Number.isFinite(x) && x >= min
const isLocal = m => ['local', 'decision-local'].includes(m.kind)
const isDecision = m => ['jev', 'decision-local', 'openrouter-decisions'].includes(m.kind)
export const reserveUsd = m => isLocal(m) ? 0 : m.kind === 'openrouter-decisions' ? 2 * m.maxChargePerRequestUsd :
  (m.kind === 'jev' ? 2 * 65536 * m.inputPerMillion :
    m.contextTokens * m.inputPerMillion + m.maxOutputTokens * m.outputPerMillion) / 1e6

export const compatibleEndpoint = (model, endpoint) =>
  endpoint.supported_parameters?.includes('structured_outputs') &&
  finite(Number(endpoint.pricing?.prompt)) && Number(endpoint.pricing.prompt) * 1e6 <= model.inputPerMillion + 1e-12 &&
  finite(Number(endpoint.pricing?.completion)) && Number(endpoint.pricing.completion) * 1e6 <= model.outputPerMillion + 1e-12 &&
  (!model.providers?.length || model.providers.some(p => p === endpoint.tag || p === endpoint.tag?.split('/')[0] || p === endpoint.provider_name?.toLowerCase()))

export function validateConfig(config, allowLegacy = false) {
  if (!Array.isArray(config.models) || !config.models.length) throw Error('models must be nonempty')
  const ids = new Set()
  for (const m of config.models) {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(m.id) || ids.has(m.id)) throw Error('Invalid/duplicate model id')
    ids.add(m.id)
    if (!['jev', 'decision-local', 'openrouter-decisions', ...(allowLegacy ? ['local', 'openrouter'] : [])].includes(m.kind) || typeof m.model !== 'string' || !m.model)
      throw Error(`Invalid/non-decision model: ${m.id}; chat models require explicit --legacy-chat`)
    if (isLocal(m)) {
      const u = new URL(m.baseUrl)
      if (u.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) || u.username || u.password || u.search || u.hash)
        throw Error('Local endpoint must be unauthenticated loopback HTTP; use an SSH tunnel for the VPS')
    }
    if (!isDecision(m) && (!Number.isSafeInteger(m.maxOutputTokens) || m.maxOutputTokens < 32)) throw Error('Invalid maxOutputTokens')
    if (['jev', 'openrouter'].includes(m.kind) && !finite(m.inputPerMillion, Number.MIN_VALUE)) throw Error('Paid input price must be positive')
    if (m.kind === 'openrouter-decisions' && (!finite(m.maxChargePerRequestUsd) || !m.billingBoundEvidence?.trim()))
      throw Error('Native API needs a verified per-request charge bound; context alone is not a billing bound')
    if (m.kind === 'openrouter' && (!Number.isSafeInteger(m.contextTokens) || m.contextTokens < 1024 || !finite(m.outputPerMillion, Number.MIN_VALUE)))
      throw Error('OpenRouter needs positive prices and a context token bound')
    if (isLocal(m) && (!finite(m.monthlyUsd) || !m.hardware?.trim())) throw Error('Local model needs monthlyUsd and hardware description')
  }
  for (const k of ['minQuality', 'maxErrorRate', 'maxCostRatio'])
    if (!finite(config.gates?.[k]) || config.gates[k] > 1) throw Error(`Invalid gate ${k}`)
  if (!finite(config.gates.maxP95Ms, 1)) throw Error('Invalid maxP95Ms')
  return config
}

export function validateSuite(suite, api) {
  if (!Array.isArray(suite.cases) || !suite.cases.length || !suite.version) throw Error('Invalid suite')
  const ids = new Set()
  for (const c of suite.cases) {
    if (!/^[a-z0-9-]+$/.test(c.id) || ids.has(c.id) || !c.query?.trim() || !c.slice || !c.language) throw Error('Invalid/duplicate case')
    ids.add(c.id)
    const v = vocabulary(api, api.normalize(c.query))
    let n = 0
    for (const [kind, expected] of Object.entries(c.expect ?? {})) {
      if (!['flags', 'weights', 'concrete'].includes(kind)) throw Error('Unsupported expectation')
      for (const [key, value] of Object.entries(expected)) {
        n++
        if (kind === 'weights' && (!v.dimensions.includes(key) || ![-1, 0, 1].includes(value))) throw Error(`Invalid weight expectation ${c.id}/${key}`)
        if (kind === 'flags' && (!v.flags.includes(key) || ![null, 'required', 'excluded'].includes(value))) throw Error(`Invalid flag expectation ${c.id}/${key}`)
        if (kind === 'concrete' && (!v.words.includes(key) || typeof value !== 'boolean')) throw Error(`Invalid word expectation ${c.id}/${key}`)
      }
    }
    if (!n) throw Error(`No quality assertions for ${c.id}`)
  }
  return suite
}

export function summarize(rows, model, gates, monthlySearches, cacheHitRate) {
  const measured = rows.filter(r => !r.warmup)
  const groups = Object.groupBy(measured, r => r.caseId)
  const quality = mean(Object.values(groups).map(rs => mean(rs.map(r => r.assessment?.score ?? 0))))
  const p95 = percentile(measured.map(r => r.ms), 0.95)
  const errorRate = measured.filter(r => r.status !== 'ok').length / measured.length
  const criticalMisses = measured.reduce((s, r) => s + (r.assessment?.criticalMisses ?? 0), 0)
  const known = measured.every(r => r.costUsd !== null)
  const costPerSearch = known ? mean(measured.map(r => r.costUsd)) : null
  const freshMonthly = monthlySearches * (1 - cacheHitRate)
  const monthlyUsd = isLocal(model) ? model.monthlyUsd : costPerSearch === null ? null : costPerSearch * freshMonthly
  const speed = gates.maxP95Ms / (gates.maxP95Ms + p95)
  const by = field => Object.fromEntries(Object.entries(Object.groupBy(measured, r => r[field])).map(([key, rs]) => [key, {
    cases: new Set(rs.map(r => r.caseId)).size, quality: mean(rs.map(r => r.assessment?.score ?? 0)),
    errors: rs.filter(r => r.status !== 'ok').length, p95Ms: percentile(rs.map(r => r.ms), .95),
  }]))
  return {
    model: model.id, attempts: measured.length, quality, exactCaseRate: mean(measured.map(r => Number(r.assessment?.exact ?? false))),
    p50Ms: percentile(measured.map(r => r.ms), .5), p95Ms: p95, speed,
    equalWeightScore: 0.5 * quality + 0.5 * speed,
    errorRate, criticalMisses, deadlineMisses: measured.filter(r => r.ms > gates.maxP95Ms || r.status !== 'ok').length,
    binaryBrier: measured.some(r => r.assessment?.binaryBrier != null) ? mean(measured.filter(r => r.assessment?.binaryBrier != null).map(r => r.assessment.binaryBrier)) : null,
    choiceBrier: measured.some(r => r.assessment?.choiceBrier != null) ? mean(measured.filter(r => r.assessment?.choiceBrier != null).map(r => r.assessment.choiceBrier)) : null,
    costPer1000Fresh: costPerSearch === null ? null : costPerSearch * 1000,
    monthlyUsd, costKnown: known,
    screeningPass: quality >= gates.minQuality && p95 <= gates.maxP95Ms && errorRate <= gates.maxErrorRate && criticalMisses === 0,
    bySlice: by('slice'), byLanguage: by('language'),
    providers: [...new Set(measured.map(r => r.provider).filter(Boolean))],
    unreviewedPredictions: measured.reduce((s, r) => s + (r.assessment?.unreviewedWeights.length ?? 0) + (r.assessment?.unreviewedFlags.length ?? 0), 0),
  }
}

export async function postJson(url, body, key, timeoutMs, fetcher = fetch, nativeLocal = false) {
  const response = await fetcher(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
  })
  // Never persist error bodies: providers can echo auth headers or other secrets.
  if (!response.ok) {
    const error = new Error(`Provider HTTP ${response.status}`)
    error.name = 'ProviderHttpError'
    error.httpStatus = response.status
    // This bridge runs only on loopback and receives no credential. Its bounded
    // compatibility reason is useful; remote authenticated error bodies stay private.
    if (nativeLocal && !key) {
      const detail = await response.json().catch(() => ({}))
      error.nativeFailure = String(detail.message ?? detail.error ?? '').slice(0, 200)
    }
    throw error
  }
  const result = await response.json()
  if (result.error) throw Error('Provider returned an error payload')
  return result
}

export async function infer(api, model, text, timeoutMs, fetcher = fetch) {
  if (isDecision(model)) {
    const requests = [api.attributeRequest(text), api.fingerprintRequest(text)]
    const url = model.kind === 'jev' ? 'https://api.typesafe.ai/v1/systemone' : model.kind === 'openrouter-decisions' ?
      'https://openrouter.ai/api/alpha/decisions' : `${model.baseUrl.replace(/\/$/, '')}/systemone`
    const key = model.kind === 'jev' ? process.env.TYPESAFE_API_KEY : model.kind === 'openrouter-decisions' ? process.env.OPENROUTER_API_KEY : null
    // Both are awaited even if one fails; no hidden request carries into the next trial.
    const settled = await Promise.allSettled(requests.map(r => postJson(url,
      { ...r, model: model.model, ...(model.kind === 'decision-local' ? { benchmarkDeadlineMs: timeoutMs } : {}), ...(model.kind === 'openrouter-decisions' ? { provider: { allow_fallbacks: false,
        ...(model.providers?.length ? { only: model.providers } : {}) } } : {}) }, key, timeoutMs, fetcher, model.kind === 'decision-local')))
    const responses = settled.map(r => r.status === 'fulfilled' ? r.value : null)
    const costUsd = isLocal(model) ? 0 : model.kind === 'openrouter-decisions' ?
      responses.every(r => finite(r?.usage?.cost)) ? responses.reduce((s, r) => s + r.usage.cost, 0) : null :
      responses.every(r => Number.isSafeInteger(r?.usage?.input_tokens) && r.usage.input_tokens >= 0 && r.usage.input_tokens <= 65536) ?
        responses.reduce((s, r) => s + r.usage.input_tokens, 0) * model.inputPerMillion / 1e6 : null
    return { raw: responses, costUsd, validate: () => validateJev(requests, responses, model.responseModel ?? model.model, {
      requireUsage: model.kind !== 'decision-local', maxInputTokens: model.kind === 'jev' ? 65536 : Infinity,
    }), provider: model.kind === 'jev' ? 'typesafe' : model.kind === 'decision-local' ? 'local-native' : responses.map(r => r?.provider ?? 'unreported').join(','), usage: responses.map(r => r?.usage ?? null),
      nativeFailures: settled.map(r => r.status === 'rejected' ? r.reason.nativeFailure ?? null : null),
      httpStatuses: settled.map(r => r.status === 'rejected' ? r.reason.httpStatus ?? null : 200),
      failure: settled.some(r => r.status === 'rejected') ? 'provider-error' : null }
  }
  const request = compactRequest(api, text, model)
  const response = await postJson(model.kind === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
    `${model.baseUrl.replace(/\/$/, '')}/chat/completions`, request,
    model.kind === 'openrouter' ? process.env.OPENROUTER_API_KEY : null, timeoutMs, fetcher)
  const cost = response.usage?.cost
  const costUsd = model.kind === 'local' ? 0 : finite(cost) ? cost : null
  return {
    costUsd, provider: response.provider ?? (model.kind === 'local' ? 'local' : 'unreported'), usage: response.usage ?? null,
    generationId: response.id ?? null, returnedModel: response.model ?? null,
    responseText: response.choices?.[0]?.message?.content ?? null,
    validate() {
      if (response.choices?.[0]?.finish_reason !== 'stop') throw Error('Incomplete/refused output')
      this.compact = JSON.parse(response.choices[0].message.content)
      this.raw = projectCompact(api, text, this.compact)
    },
  }
}

export async function trial(api, model, c, timeoutMs, fetcher = fetch) {
  const start = performance.now()
  let response
  try {
    response = await infer(api, model, api.normalize(c.query), timeoutMs, fetcher)
    response.validate()
    const fields = api.readingFields(api.normalize(c.query), response.raw, false)
    return { status: 'ok', ms: performance.now() - start, raw: response.raw, compact: response.compact,
      fields, assessment: assess(fields, c.expect, response.raw), costUsd: response.costUsd,
      usage: response.usage, provider: response.provider, returnedModel: response.returnedModel, generationId: response.generationId,
      responseText: response.responseText }
  } catch (error) {
    return { status: response?.failure ?? (response ? 'invalid-output' : 'provider-error'),
      ms: performance.now() - start, costUsd: response?.costUsd ?? (isLocal(model) ? 0 : null),
      // Only our own validation text or exception class is retained, never an arbitrary fetch error message.
      error: response && !response.failure ? String(error.message).slice(0, 180) : error.name,
      httpStatus: error.httpStatus ?? null,
      httpStatuses: response?.httpStatuses ?? null,
      nativeFailure: error.nativeFailure ?? response?.nativeFailures ?? null,
      usage: response?.usage ?? null, provider: response?.provider ?? null,
      responseText: response?.responseText ?? null }
  }
}

function durableAppend(path, value) {
  appendFileSync(path, JSON.stringify(value) + '\n', { mode: 0o600 })
  const fd = openSync(path, 'r'); fsyncSync(fd); closeSync(fd)
}

export async function main(argv = process.argv.slice(2)) {
  const { values: args } = parseArgs({ args: argv, options: {
    config: { type: 'string', default: new URL('./models.example.json', import.meta.url).pathname },
    'legacy-chat': { type: 'boolean', default: false },
    cases: { type: 'string', default: new URL('./cases.json', import.meta.url).pathname },
    models: { type: 'string' }, out: { type: 'string' }, execute: { type: 'boolean', default: false },
    repeats: { type: 'string', default: '3' }, concurrency: { type: 'string', default: '1,4' },
    warmups: { type: 'string', default: '1' }, budget: { type: 'string', default: '0' },
    timeout: { type: 'string', default: '30000' }, 'monthly-searches': { type: 'string', default: '100000' },
    'cache-hit-rate': { type: 'string', default: '0' },
  } })
  const configText = readFileSync(args.config, 'utf8'), suiteText = readFileSync(args.cases, 'utf8')
  const config = validateConfig(JSON.parse(configText), args['legacy-chat']), api = await loadProduction()
  const suite = validateSuite(JSON.parse(suiteText), api)
  const selected = args.models?.split(',')
  const models = config.models.filter(m => !selected || selected.includes(m.id))
  if (!models.length || selected?.some(id => !models.some(m => m.id === id))) throw Error('Unknown/empty model selection')
  const repeats = Number(args.repeats), warmups = Number(args.warmups), timeoutMs = Number(args.timeout)
  const concurrency = args.concurrency.split(',').map(Number), budget = Number(args.budget)
  const monthlySearches = Number(args['monthly-searches']), cacheHitRate = Number(args['cache-hit-rate'])
  for (const n of [repeats, timeoutMs, ...concurrency]) if (!Number.isSafeInteger(n) || n < 1) throw Error('Invalid positive integer option')
  if (!Number.isSafeInteger(warmups) || warmups < 0 || !finite(budget) || !finite(monthlySearches) || !finite(cacheHitRate) || cacheHitRate > 1 || new Set(concurrency).size !== concurrency.length)
    throw Error('Invalid run/budget/scenario options')
  for (const m of models) if (m.kind === 'jev' && m.model !== api.model) throw Error('Jev control must match the production model')
  const callsPerModel = concurrency.length * (suite.cases.length * repeats + warmups)
  const reservationUsd = models.reduce((s, m) => s + reserveUsd(m) * callsPerModel, 0)
  const plan = { mode: args.execute ? 'execute' : 'plan', suite: suite.version, cases: suite.cases.length,
    models: models.map(m => ({ id: m.id, interpretationAttempts: callsPerModel,
      httpRequests: callsPerModel * (isDecision(m) ? 2 : 1), reservationUsd: reserveUsd(m) * callsPerModel })),
    repeats, warmups, concurrency, timeoutMs, reservationUsd, budgetUsd: budget,
    scenario: { monthlySearches, cacheHitRate }, sourceHashes: api.sourceHashes,
    suiteHash: hash(suiteText), configHash: hash(configText) }
  if (!args.execute) { console.log(JSON.stringify(plan, null, 2)); return plan }
  if (!args.out) throw Error('--out must be a new directory')
  if (reservationUsd > budget + 1e-12) throw Error(`Worst-case reservation $${reservationUsd.toFixed(4)} exceeds --budget=${budget}; no requests sent`)
  for (const m of models) {
    const key = m.kind === 'jev' ? 'TYPESAFE_API_KEY' : ['openrouter', 'openrouter-decisions'].includes(m.kind) ? 'OPENROUTER_API_KEY' : null
    if (key && !process.env[key]) throw Error(`Missing ${key}; .env is never loaded automatically`)
    if (isLocal(m) && m.hardware.startsWith('UNMEASURED')) throw Error(`Fill in hardware/build/model provenance for ${m.id} before execution`)
    if (m.kind === 'decision-local' && m.admission && !m.admission.startsWith('native-sdk-admitted'))
      throw Error(`Native runtime/source not admitted for ${m.id}: ${m.admission}`)
  }
  // Public metadata preflight: verify availability/context before creating any paid request.
  let catalog = null
  const endpointCatalogs = {}
  if (models.some(m => m.kind === 'openrouter')) {
    const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw Error('OpenRouter catalog unavailable')
    catalog = await response.json()
    for (const m of models.filter(m => m.kind === 'openrouter')) {
      const entry = catalog.data?.find(x => x.id === m.model)
      if (!entry || entry.context_length > m.contextTokens || !entry.supported_parameters?.includes('structured_outputs'))
        throw Error(`OpenRouter identity/context/structured-output support changed: ${m.id}`)
      const endpoints = await fetch(`https://openrouter.ai/api/v1/models/${m.model}/endpoints`, { signal: AbortSignal.timeout(10000) })
      if (!endpoints.ok) throw Error(`OpenRouter endpoints unavailable: ${m.id}`)
      const details = await endpoints.json()
      endpointCatalogs[m.id] = details
      const compatible = details.data?.endpoints?.some(e => compatibleEndpoint(m, e))
      if (!compatible) throw Error(`No structured-output endpoint at configured price/provider ceiling: ${m.id}; no inference sent`)
    }
  }
  const out = resolve(args.out)
  mkdirSync(out, { mode: 0o700 }) // Exclusive directory: prevents reuse or concurrent budget ledgers.
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ ...plan, startedAt: new Date().toISOString(),
    benchmarkSourceHashes,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    host: { hostname: hostname(), platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length,
      totalMemoryBytes: totalmem(), node: process.version }, models, gates: config.gates,
    qualityStatus: suite.reviewStatus, questionVersion: 'production-accepted-d4-corrected-v1',
    mode: args['legacy-chat'] ? 'legacy-chat-control' : 'native-decisions',
    note: 'Interpreter-only, closed-loop load; no production end-to-end latency or relevance verdict.' }, null, 2))
  writeFileSync(join(out, 'cases.json'), suiteText)
  if (catalog) writeFileSync(join(out, 'openrouter-catalog.json'), JSON.stringify(catalog))
  if (catalog) writeFileSync(join(out, 'openrouter-endpoints.json'), JSON.stringify(endpointCatalogs))
  const ledger = join(out, 'ledger.jsonl'), resultsPath = join(out, 'trials.jsonl')
  const all = [], summaries = []
  let reserved = 0
  for (const load of concurrency) {
    // Rotate order between load cohorts so the baseline isn't always first.
    const offset = concurrency.indexOf(load) % models.length
    for (const model of [...models.slice(offset), ...models.slice(0, offset)]) {
      const rows = []
      const run = async (c, repeat, warmup) => {
        const reservation = reserveUsd(model)
        if (reserved + reservation > budget + 1e-12) throw Error('Budget exhausted before dispatch')
        reserved += reservation
        const id = `${model.id}/${load}/${warmup ? 'warmup' : repeat}/${c.id}`
        durableAppend(ledger, { id, at: new Date().toISOString(), reserveUsd: reservation, cumulativeReservedUsd: reserved })
        const r = { id, model: model.id, caseId: c.id, query: c.query, slice: c.slice, language: c.language,
          concurrency: load, repeat, warmup, ...await trial(api, model, c, timeoutMs) }
        durableAppend(resultsPath, r)
        durableAppend(ledger, { id, status: r.status, actualUsd: r.costUsd, reservationRetainedUsd: reservation })
        rows.push(r); all.push(r)
        if (r.costUsd !== null && r.costUsd > reservation + 1e-12)
          throw Error('Reported charge exceeds reservation; stopping. See durable ledger.')
      }
      // Warmups are serial, recorded and billed; never mixed into measured percentiles.
      for (let i = 0; i < warmups; i++) await run(suite.cases[i % suite.cases.length], i, true)
      const jobs = []
      for (let repeat = 0; repeat < repeats; repeat++) {
        // Deterministic rotation avoids always timing the same query first.
        const offset = repeat % suite.cases.length
        for (const c of [...suite.cases.slice(offset), ...suite.cases.slice(0, offset)]) jobs.push({ c, repeat })
      }
      let cursor = 0
      const started = performance.now()
      await Promise.all(Array.from({ length: Math.min(load, jobs.length) }, async () => {
        while (cursor < jobs.length) { const job = jobs[cursor++]; await run(job.c, job.repeat, false) }
      }))
      const elapsedMs = performance.now() - started
      const summary = { concurrency: load, ...summarize(rows, model, config.gates, monthlySearches, cacheHitRate),
        closedLoopSuccessfulPerSecond: rows.filter(r => !r.warmup && r.status === 'ok').length / (elapsedMs / 1000) }
      summaries.push(summary)
      console.log(`${model.id} c=${load}: quality=${summary.quality.toFixed(3)}, p95=${summary.p95Ms.toFixed(0)}ms, errors=${(100 * summary.errorRate).toFixed(1)}%`)
    }
  }
  for (const s of summaries) {
    const base = summaries.find(b => b.concurrency === s.concurrency && models.find(m => m.id === b.model)?.kind === 'jev')
    s.monthlyCostRatioToJev = base?.monthlyUsd > 0 && s.monthlyUsd !== null ? s.monthlyUsd / base.monthlyUsd : null
    s.significantlyCheaper = s.monthlyCostRatioToJev !== null && s.monthlyCostRatioToJev <= config.gates.maxCostRatio
  }
  const report = { status: 'screening-only; human quality/relevance review and VPS measurements required', summaries,
    reservedUsd: reserved, knownActualUsd: all.reduce((s, r) => s + (r.costUsd ?? 0), 0), unknownCostAttempts: all.filter(r => r.costUsd === null).length }
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
  const table = ['| Model | Concurrency | Quality | p95 ms | Errors | 50/50 score | $/1k fresh | Monthly $ | ≥50% cheaper |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
    ...summaries.map(s => `| ${s.model} | ${s.concurrency} | ${s.quality.toFixed(3)} | ${s.p95Ms.toFixed(0)} | ${(100*s.errorRate).toFixed(1)}% | ${s.equalWeightScore.toFixed(3)} | ${s.costPer1000Fresh?.toFixed(4) ?? 'unknown'} | ${s.monthlyUsd?.toFixed(2) ?? 'unknown'} | ${s.significantlyCheaper ? 'yes' : 'no/unknown'} |`)]
  writeFileSync(join(out, 'report.md'), `${report.status}\n\n${table.join('\n')}\n\nReservations: $${reserved.toFixed(4)}. Known charges: $${report.knownActualUsd.toFixed(4)}; unknown-cost attempts: ${report.unknownCostAttempts}.\n`)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
