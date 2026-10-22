/** Opt-in read-only replay of PUBLIC screen/constraint config. Never accepts an invite, cookie, token or room ID. */
export {}
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import type { RoomConstraints, ScreenContext } from '../../../packages/yepwatch-contracts/index.ts'
if (process.env.YEPWATCH_DIAGNOSE_DECK !== '1' || !process.env.YEPWATCH_PUBLIC_CONFIG) throw new Error('Set YEPWATCH_DIAGNOSE_DECK=1 and YEPWATCH_PUBLIC_CONFIG to a public-only JSON config')
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === '1') process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)))
const config = JSON.parse(await readFile(process.env.YEPWATCH_PUBLIC_CONFIG, 'utf8')) as { screens: ScreenContext[]; constraints: RoomConstraints }
if (!Array.isArray(config.screens) || !config.screens.length || !config.constraints?.kinds?.length) throw new Error('Public screens/constraints required')
const [{ goodwatchReads }, { createDeckAdapter }, { getTitleSnapshot }, { MemoryRoomRepository, fixtureCatalog }, { YepWatchService }] = await Promise.all([import('./goodwatch.server.ts'), import('./catalog-adapter.ts'), import('../title-snapshot/index.server'), import('./test-support.ts'), import('./service.server.ts')])
const service = new YepWatchService(new MemoryRoomRepository(), fixtureCatalog, randomBytes(32).toString('base64url'))
const created = await service.create({ commandId: 'local_readonly_replay', admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Local read-only replay' })
const room = (await service.repository.read(created.credential.roomId))!.room
room.screens = config.screens; room.constraints = config.constraints; room.participants[0].screenId = config.screens[0].id; room.participants[0].ready = true
// Include every screen in a private local copy, without creating any real participant or touching the retained user room.
for (let i = 1; i < config.screens.length; i++) room.participants.push({ ...structuredClone(room.participants[0]), id: `local_${i}`, screenId: config.screens[i].id })
const original = structuredClone(room)
const trace = { rankedTitles: 0, displayedTitles: 0, missingDisplays: 0, episodeReads: 0, emptyEpisodeCatalogs: 0, unknownReasons: {} as Record<string, number> }
const deadline = Date.now() + 5000
while (process.env.YEPWATCH_DIAGNOSTIC_WARM_SNAPSHOT === '1' && !getTitleSnapshot() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
const reads = { ...goodwatchReads,
  async rankedKeys(r: typeof room) { const keys = await goodwatchReads.rankedKeys(r); trace.rankedTitles = keys.length; return keys },
  async displays(keys: number[]) { const found = await goodwatchReads.displays(keys); trace.displayedTitles += found.size; trace.missingDisplays += keys.length - found.size; return found },
  async episodes(showId: number) { trace.episodeReads++; const rows = await goodwatchReads.episodes(showId); if (!rows.length) trace.emptyEpisodeCatalogs++; return rows },
  async availability(...args: Parameters<typeof goodwatchReads.availability>) {
    const result = await goodwatchReads.availability(...args)
    const [{ getAvailabilityEvidenceBatch }, { evaluateAvailability }, { providerFamily }] = await Promise.all([import('../availability.server'), import('../../utils/availability-evidence'), import('../mcp/watch-links')])
    for (const screen of args[1]) {
      const unknown = args[0].filter(t => result.get(t.key)?.some(a => a.screenId === screen.id && a.state === 'unknown'))
      if (!unknown.length) continue
      const evidence = await getAvailabilityEvidenceBatch(unknown.map(t => ({ mediaType: t.mediaType, tmdbId: t.tmdbId, country: screen.country! })))
      for (const t of unknown) {
        const check = evaluateAvailability(evidence.get(`${t.mediaType}-${t.tmdbId}`), { mediaType: t.mediaType, tmdbId: t.tmdbId, country: screen.country!, serviceIds: [...new Set(screen.serviceIds.flatMap(providerFamily))] })
        trace.unknownReasons[check.reason] = (trace.unknownReasons[check.reason] ?? 0) + 1
      }
    }
    return result
  },
}
let result: { outcome: string; count?: number; kinds?: string[]; code?: string; message?: string; details?: unknown }
try { const deck = await createDeckAdapter(reads).candidates(room); result = { outcome: 'deck', count: deck.length, kinds: [...new Set(deck.map(c => c.identity.kind))] } }
catch (error) { const e = error as { code?: string; message?: string; details?: unknown }; result = { outcome: 'rejected', code: e.code ?? 'read_failed', message: e.message, details: e.details } }
assert.deepEqual(room, original)
console.log(JSON.stringify({ publicConfig: config, trace, result }))
if (process.env.YEPWATCH_EXPECT_DECK === '1' && result.outcome !== 'deck') process.exitCode = 1
setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref()
