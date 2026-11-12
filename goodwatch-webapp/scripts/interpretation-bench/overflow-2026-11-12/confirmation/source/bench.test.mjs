import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadProduction } from './production.mjs'
import { compactRequest, vocabulary, projectCompact, validateJev, assess } from './contract.mjs'
import { main, percentile, reserveUsd, summarize, validateConfig as validateStrictConfig, validateSuite, postJson, trial, compatibleEndpoint } from './bench.mjs'

const api = await loadProduction()
const suite = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)))
const config = JSON.parse(readFileSync(new URL('./models.chat-legacy.json', import.meta.url)))
const validateConfig = config => validateStrictConfig(config, true)
const local = { ...config.models.find(m => m.kind === 'local'), hardware: 'fixture only: no actual model inference', monthlyUsd: 12 }
const example = (text, extra = {}) => ({ flags: [], weights: [], concrete: [], phrases: vocabulary(api, text).phrases.slice(0, 1), ...extra })

test('loads production contract without stores; normalizer and all 42 case assertions remain valid', () => {
  assert.equal(api.normalize('  SLOW\n BURN  '), 'slow burn')
  assert.equal(api.model, 'jev-1.13.0')
  assert.equal(api.deadlineMs, 1500)
  assert.equal(vocabulary(api, 'movies').dimensions.length, 74)
  assert.equal(validateSuite(suite, api).cases.length, 42)
  assert.ok(Object.keys(api.sourceHashes).includes('app/server/combined-search/reading-retrieval.server.ts'))
  assert.equal(Object.keys(api.sourceHashes).some(k => k.includes('store.server') || k.includes('qdrant.ts')), false)
  assert.throws(() => validateSuite({ ...suite, cases: [{ ...suite.cases[0], expect: { weights: { fake: 1 } } }] }, api))
})

test('compact output feeds the real decoder, including its asymmetric preference thresholds', () => {
  const text = 'an animated romantic movie with no violence'
  const raw = projectCompact(api, text, example(text, {
    flags: [{ key: 'movie', value: 'required' }, { key: 'animated', value: 'required' }],
    weights: [{ key: 'romance', value: 2 }, { key: 'violence', value: -2 }, { key: 'scare', value: -1 }],
  }))
  const fields = api.readingFields(text, raw, false)
  assert.equal(fields.weights.romance, 2)
  assert.equal(fields.weights.violence, -2)
  assert.equal(fields.weights.scare, undefined) // -1 is below the production avoid threshold.
  assert.equal(fields.flags.find(f => f.id === 'animated').decision, 'required')
  assert.ok(fields.chips.some(c => c.key === 'violence' && c.kind === 'avoid'))
})

test('rejects malformed/unknown/duplicate/out-of-range output instead of repairing it', () => {
  const text = 'a romantic movie'
  for (const patch of [
    { flags: [{ key: 'invented', value: 'required' }] },
    { weights: [{ key: 'romance', value: 8 }] },
    { weights: [{ key: 'romance', value: NaN }] },
    { weights: [{ key: 'romance', value: 2 }, { key: 'romance', value: -2 }] },
    { flags: [{ key: 'movie', value: 'maybe' }] },
    { concrete: ['invented'] }, { phrases: ['invented'] }, { phrases: [] }, { extra: 'oops' },
  ]) assert.throws(() => projectCompact(api, text, example(text, patch)))
})

test('wrong-direction negation loses quality and records a critical miss', () => {
  const text = 'nothing scary'
  const fields = api.readingFields(text, projectCompact(api, text, example(text, {
    weights: [{ key: 'scare', value: 2 }, { key: 'romance', value: 2 }],
  })), false)
  const a = assess(fields, { weights: { scare: -1 } })
  assert.equal(a.score, 0)
  assert.equal(a.criticalMisses, 1)
  assert.deepEqual(a.unreviewedWeights, ['romance'])
})

test('Jev distribution and complete contract are validated beyond answer types', () => {
  const requests = [api.attributeRequest('a movie'), api.fingerprintRequest('a movie')]
  const raw = requests.map(r => ({ model: api.model, usage: { input_tokens: 100 }, answers:
    Object.fromEntries(Object.entries(r.questions).map(([key, q]) => [key, q.type === 'noul' ? { type: 'noul', noul: .5 } :
      { type: 'choice', choice: Object.keys(q.criteria)[0], probabilities: Object.fromEntries(Object.keys(q.criteria).map((k, i) => [k, Number(i === 0)])) }])) }))
  validateJev(requests, raw, api.model)
  const wrong = structuredClone(raw); wrong[1].answers['want:romance'].noul = 1.1
  assert.throws(() => validateJev(requests, wrong, api.model))
  delete wrong[1].answers['want:romance']
  assert.throws(() => validateJev(requests, wrong, api.model))
  const invalid = structuredClone(raw); invalid[0].answers.movie.probabilities.required = .7
  assert.throws(() => validateJev(requests, invalid, api.model))
})

test('generation pins schema, disables fallbacks and caps provider prices', () => {
  const m = config.models.find(m => m.kind === 'openrouter')
  const r = compactRequest(api, 'romantic movies', m)
  assert.equal(r.max_tokens, 512)
  assert.equal(r.response_format.json_schema.strict, true)
  assert.deepEqual(r.provider.max_price, { prompt: m.inputPerMillion, completion: m.outputPerMillion, request: 0 })
  assert.equal(r.provider.allow_fallbacks, false)
  assert.equal(r.provider.require_parameters, true)
  assert.deepEqual(compactRequest(api, 'movies', { ...m, disableReasoning: true }).reasoning, { enabled: false })
  assert.equal(compactRequest(api, 'movies', local).chat_template_kwargs.enable_thinking, false)
})

test('failures count as zero quality, warmups are excluded, and p95 uses nearest rank', () => {
  const base = { warmup: false, slice: 'negation', language: 'en', costUsd: .001, provider: 'test' }
  const rows = [
    { ...base, caseId: 'a', ms: 100, status: 'ok', assessment: { score: 1, exact: true, criticalMisses: 0, unreviewedWeights: [], unreviewedFlags: [] } },
    { ...base, caseId: 'b', ms: 1500, status: 'provider-error', costUsd: null },
    { ...base, caseId: 'a', ms: 60000, status: 'provider-error', warmup: true },
  ]
  const s = summarize(rows, local, config.gates, 100000, .5)
  assert.equal(s.quality, .5)
  assert.equal(s.p95Ms, 1500)
  assert.equal(s.errorRate, .5)
  assert.equal(s.costPer1000Fresh, null)
  assert.equal(s.monthlyUsd, 12)
  assert.equal(s.screeningPass, false)
  assert.equal(percentile([1, 2, 3, 4], .95), 4)
  assert.equal(s.equalWeightScore, .5) // quality .5, speed .5
})

test('monthly cost reflects cache misses and never turns missing billing into zero', () => {
  const row = { warmup: false, caseId: 'a', ms: 500, slice: 'explicit', language: 'en', status: 'ok', costUsd: .0001,
    assessment: { score: 1, exact: true, criticalMisses: 0, unreviewedWeights: [], unreviewedFlags: [] } }
  const m = config.models.find(m => m.kind === 'openrouter')
  assert.equal(summarize([row], m, config.gates, 100000, .5).monthlyUsd, 5)
  assert.equal(summarize([{ ...row, costUsd: null }], m, config.gates, 100000, .5).monthlyUsd, null)
  assert.ok(reserveUsd(m) > .002)
})

test('configuration prevents remote local endpoints, duplicate ids and invalid prices', () => {
  validateConfig(config)
  for (const patch of [{ baseUrl: 'https://other.example/v1' }, { baseUrl: 'http://127.0.0.1.evil/v1' }, { baseUrl: 'http://secret@127.0.0.1/v1' }, { monthlyUsd: -1 }])
    assert.throws(() => validateConfig({ ...config, models: [{ ...local, ...patch }] }))
  assert.throws(() => validateConfig({ ...config, models: [local, local] }))
  assert.throws(() => validateConfig({ ...config, models: [{ ...config.models[0], inputPerMillion: -1 }] }))
})

test('aggregated schema support cannot admit a cheap endpoint that lacks it', () => {
  const model = { inputPerMillion: .02, outputPerMillion: .04 }
  const cheap = { tag: 'cheap/fp8', supported_parameters: ['response_format'], pricing: { prompt: '0.00000002', completion: '0.00000004' } }
  const strict = { tag: 'strict/bf16', supported_parameters: ['structured_outputs'], pricing: { prompt: '0.00000022', completion: '0.00000022' } }
  assert.equal(Boolean(compatibleEndpoint(model, cheap)), false)
  assert.equal(Boolean(compatibleEndpoint(model, strict)), false)
  assert.equal(Boolean(compatibleEndpoint({ inputPerMillion: .22, outputPerMillion: .22 }, strict)), true)
  assert.equal(Boolean(compatibleEndpoint({ inputPerMillion: .22, outputPerMillion: .22, providers: ['other'] }, strict)), false)
})

test('zero budget rejects a paid run before dispatch or directory creation', async () => {
  const path = join(tmpdir(), `must-not-create-benchmark-${process.pid}`)
  await assert.rejects(main(['--legacy-chat', '--models=jev', '--execute', `--out=${path}`, '--budget=0']), /exceeds/)
  assert.equal(existsSync(path), false)
})

test('partial Jev failure drains both parallel calls and preserves unknown charges', async () => {
  let completed = 0
  const c = suite.cases[0]
  const r = await trial(api, config.models[0], c, 100, async (_url, options) => {
    const body = JSON.parse(options.body)
    if (Object.keys(body.questions).some(k => k.startsWith('want:'))) {
      await new Promise(resolve => setTimeout(resolve, 15)); completed++
      return new Response(JSON.stringify({ model: api.model, usage: { input_tokens: 100 }, answers: {} }))
    }
    completed++; throw Error('secret that must not appear in evidence')
  })
  assert.equal(completed, 2)
  assert.equal(r.status, 'provider-error')
  assert.equal(r.costUsd, null)
  assert.equal(JSON.stringify(r).includes('secret'), false)
})

test('OpenRouter missing costs, truncation and malformed output remain observable', async () => {
  const m = config.models.find(m => m.kind === 'openrouter'), c = suite.cases[0]
  const content = JSON.stringify(example(api.normalize(c.query), { weights: [{ key: 'scare', value: 2 }] }))
  const mock = patch => async () => new Response(JSON.stringify({ provider: 'fixture', choices: [{ finish_reason: 'stop', message: { content } }], ...patch }))
  const good = await trial(api, m, c, 100, mock({}))
  assert.equal(good.status, 'ok'); assert.equal(good.costUsd, null)
  const cut = await trial(api, m, c, 100, mock({ usage: { cost: .00001 }, choices: [{ finish_reason: 'length', message: { content } }] }))
  assert.equal(cut.status, 'invalid-output'); assert.equal(cut.costUsd, .00001)
})

test('HTTP errors omit response bodies and abort signals enforce deadlines', async () => {
  await assert.rejects(postJson('http://127.0.0.1', {}, null, 50, async () => new Response('secret API-key echo', { status: 429 })), /Provider HTTP 429/)
  const rejected = await trial(api, config.models.find(m => m.kind === 'openrouter'), suite.cases[0], 50,
    async () => new Response('do not persist this body', { status: 404 }))
  assert.equal(rejected.httpStatus, 404)
  assert.equal(rejected.error, 'ProviderHttpError')
  await assert.rejects(postJson('http://127.0.0.1', {}, null, 10, async (_url, opts) => {
    await new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true }))
  }), /timeout/i)
})

test('CLI completes concurrent loopback fixture run with durable reservations and truthful reports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-interpretation-test-'))
  const server = createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk
    const body = JSON.parse(text), query = JSON.parse(body.messages[1].content).request
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ model: 'fixture', choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify(example(query, { weights: [{ key: 'scare', value: -2 }] })),
    } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const model = { ...local, baseUrl: `http://127.0.0.1:${server.address().port}/v1` }
  const cases = [{ id: 'no-scare', query: 'nothing scary', slice: 'negation', language: 'en', expect: { weights: { scare: -1 } } }]
  const cfgPath = join(dir, 'config.json'), casesPath = join(dir, 'cases.json'), out = join(dir, 'run')
  writeFileSync(cfgPath, JSON.stringify({ ...config, models: [model] }))
  writeFileSync(casesPath, JSON.stringify({ version: 'fixture', reviewStatus: 'test-only', cases }))
  try {
    const report = await main(['--legacy-chat', `--config=${cfgPath}`, `--cases=${casesPath}`, '--execute', `--out=${out}`, '--budget=0', '--repeats=2', '--concurrency=1,2'])
    assert.equal(report.summaries.length, 2)
    assert.equal(report.summaries[0].quality, 1)
    assert.equal(report.summaries[0].monthlyUsd, 12)
    assert.equal(report.knownActualUsd, 0)
    assert.equal(report.unknownCostAttempts, 0)
    const trials = readFileSync(join(out, 'trials.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    const ledger = readFileSync(join(out, 'ledger.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(trials.length, 6) // 2 loads x (2 measured + 1 warmup).
    assert.equal(ledger.length, 12)
    assert.equal(trials.filter(r => r.warmup).length, 2)
    assert.ok(readFileSync(join(out, 'report.md'), 'utf8').includes('human quality/relevance review'))
    const frozen = join(dir, 'captures'), replay = join(dir, 'replay')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(frozen)
    const capture = { id: 'no-scare', query: 'nothing scary', policy: { includeAdult: false, lesserKnown: false },
      language: { text: 'nothing scary', detectedNonEnglish: false, vectorOnly: false },
      titleLookup: [{ id: 1, title: 'Frozen title', type: 'movie', eligible: true }], reading: { raw: [] } }
    writeFileSync(join(frozen, 'no-scare.json'), JSON.stringify(capture))
    const exporter = new URL('./export-replay.mjs', import.meta.url).pathname
    execFileSync(process.execPath, [exporter, `--run=${out}`, `--model=${model.id}`, `--captures=${frozen}`, `--out=${replay}`])
    const exported = JSON.parse(readFileSync(join(replay, 'no-scare.json')))
    assert.deepEqual(exported.titleLookup, capture.titleLookup)
    assert.deepEqual(exported.policy, capture.policy)
    assert.deepEqual(exported.reading.raw, trials.find(r => !r.warmup).raw)
    writeFileSync(join(frozen, 'no-scare.json'), JSON.stringify({ ...capture, query: 'different query' }))
    assert.throws(() => execFileSync(process.execPath, [exporter, `--run=${out}`, `--model=${model.id}`,
      `--captures=${frozen}`, `--out=${join(dir, 'bad-replay')}`], { stdio: 'pipe' }))
    assert.equal(existsSync(join(dir, 'bad-replay')), false)
    await assert.rejects(main(['--legacy-chat', `--config=${cfgPath}`, `--cases=${casesPath}`, '--execute', `--out=${out}`, '--concurrency=1']), /EEXIST/)
  } finally {
    await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true })
  }
})

test('default lineup contains at least 20 local decision models and rejects generic chat entries', () => {
  const native = JSON.parse(readFileSync(new URL('./models.example.json', import.meta.url)))
  validateStrictConfig(native)
  assert.ok(native.models.filter(m => m.kind === 'decision-local').length >= 20)
  assert.ok(native.models.every(m => ['jev', 'decision-local', 'openrouter-decisions'].includes(m.kind)))
  assert.throws(() => validateStrictConfig(config), /non-decision/)
})

function nativeResponse(request, model) {
  const answers = Object.fromEntries(Object.entries(request.questions).map(([key, q]) => {
    if (q.type === 'noul') return [key, { type: 'noul', noul: key === 'want:romance' ? .9 : key === 'avoid:romance' ? .1 : .4 }]
    const keys = Object.keys(q.criteria), best = key === 'movie' ? 'required' : keys.includes('not_mentioned') ? 'not_mentioned' : keys[0]
    const probabilities = Object.fromEntries(keys.map(k => [k, k === best ? .8 : .2 / (keys.length - 1)]))
    return [key, { type: 'choice', choice: best, probabilities }]
  }))
  return { model, answers, usage: { input_tokens: 2000, output_tokens: 0 } }
}

test('native local adapter sends unchanged JEV questions and retains real probabilities', async () => {
  const m = { id: 'native-fixture', model: 'native-fixture', kind: 'decision-local', baseUrl: 'http://127.0.0.1:8942/v1', monthlyUsd: 0, hardware: 'fixture' }
  const c = { id: 'romance', query: 'a romantic movie', expect: { weights: { romance: 1 }, flags: { movie: 'required' } } }
  const bodies = []
  const result = await trial(api, m, c, 100, async (url, opts) => {
    assert.equal(url, 'http://127.0.0.1:8942/v1/systemone')
    const body = JSON.parse(opts.body); bodies.push(body)
    assert.equal(body.messages, undefined)
    return new Response(JSON.stringify(nativeResponse(body, m.model)))
  })
  assert.equal(result.status, 'ok')
  assert.deepEqual(bodies[0].questions, api.attributeRequest(api.normalize(c.query)).questions)
  assert.deepEqual(bodies[1].questions, api.fingerprintRequest(api.normalize(c.query)).questions)
  assert.equal(result.raw[1].answers['want:romance'].noul, .9)
  assert.ok(Math.abs(result.fields.weights.romance - 1.6) < 1e-12)
  assert.equal(result.assessment.score, 1)
  assert.ok(Math.abs(result.assessment.binaryBrier - .01) < 1e-12)
  assert.equal(result.costUsd, 0)
})

test('native response can omit usage locally, but cannot truncate questions silently', () => {
  const requests = [api.attributeRequest('a movie'), api.fingerprintRequest('a movie')]
  const raw = requests.map(r => nativeResponse(r, 'fixture'))
  raw.forEach(r => delete r.usage)
  validateJev(requests, raw, 'fixture', { requireUsage: false, maxInputTokens: Infinity })
  assert.throws(() => validateJev(requests, raw, 'fixture'))
  raw[1].warnings = [{ code: 'state_truncated' }]
  assert.throws(() => validateJev(requests, raw, 'fixture', { requireUsage: false }), /truncated/)
  delete raw[1].warnings
  raw[0].usage = { options: { phrase: { total: 58, distinct: 42 } } }
  assert.throws(() => validateJev(requests, raw, 'fixture', { requireUsage: false }), /truncated/)
})

test('OpenRouter decision adapter uses alpha/decisions, genuine typed answers and actual billing', async () => {
  const m = { id: 'native-api', kind: 'openrouter-decisions', model: 'vendor/decision', providers: ['vendor'],
    maxChargePerRequestUsd: .01, billingBoundEvidence: 'fixture bound' }
  const result = await trial(api, m, suite.cases[1], 100, async (url, opts) => {
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions')
    const body = JSON.parse(opts.body)
    assert.equal(body.messages, undefined)
    assert.equal(body.provider.allow_fallbacks, false)
    return new Response(JSON.stringify({ ...nativeResponse(body, m.model), usage: { input_tokens: 2000, output_tokens: 70, cost: .00001 } }))
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.costUsd, .00002)
  assert.equal(reserveUsd(m), .02)
  assert.throws(() => validateStrictConfig({ ...config, models: [{ ...m, billingBoundEvidence: '' }] }), /verified/)
})
