/** Opt-in real catalog READS; room state stays in memory. No production DDL/DML/history writes. */
export {}
if (process.env.YEPWATCH_READ_ONLY_CATALOG !== '1') throw new Error('Set YEPWATCH_READ_ONLY_CATALOG=1 explicitly')
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === '1') process.loadEnvFile('.env')
const { goodwatchCatalog, goodwatchReads } = await import('./goodwatch.server.ts')
const { YepWatchService } = await import('./service.server.ts')
const { MemoryRoomRepository } = await import('./test-support.ts')
const { randomBytes } = await import('node:crypto')
try {
  const metadata = await goodwatchCatalog.metadata(null)
  console.log(JSON.stringify({ check: 'real_metadata', countries: metadata.countries.length, services: metadata.services.length }))
  const shows = await goodwatchCatalog.searchShows(process.env.YEPWATCH_SMOKE_SHOW ?? 'Breaking Bad')
  console.log(JSON.stringify({ check: 'real_show_search', results: shows.shows.length }))
  const show = shows.shows.find(s => s.title.toLowerCase() === (process.env.YEPWATCH_SMOKE_SHOW ?? 'Breaking Bad').toLowerCase()) ?? shows.shows[0]; if (!show) throw new Error('No catalog show found')
  const episodes = await goodwatchCatalog.episodes(show.tmdbId)
  console.log(JSON.stringify({ check: 'real_episode_catalog', episodes: episodes.length, presentationLabels: episodes.some(e => e.displaySeason != null) }))
  const service = new YepWatchService(new MemoryRoomRepository(), goodwatchCatalog, randomBytes(32).toString('base64url'))
  const admission = await service.create({ commandId: 'readonly_smoke', admissionSecret: randomBytes(32).toString('base64url'), nickname: 'Local smoke' })
  const id = admission.credential.roomId; const actor = { participantId: admission.credential.participantId, token: admission.credential.token }
  const country = process.env.YEPWATCH_SMOKE_COUNTRY ?? 'DE'; const services = (process.env.YEPWATCH_SMOKE_SERVICES ?? '8,9,337').split(',').map(Number)
  await service.command(id, actor, { commandId: 'setup', sequence: 1, command: { type: 'setup', expectedContextVersion: 1, screens: [{ id: 'local', label: 'Local', country, serviceIds: services, confirmed: true }], constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] }, screenId: 'local' } })
  if (process.env.YEPWATCH_SMOKE_CONTINUATION === '1') {
    const episode = episodes[0]; if (!episode) throw new Error('No regular aired episode')
    await service.command(id, actor, { commandId: 'continue_setup', sequence: 2, command: { type: 'setup', expectedContextVersion: 2, screens: [{ id: 'local', label: 'Local', country, serviceIds: services, confirmed: true }], constraints: { kinds: ['show_continue'], maxMinutes: null, moods: [] }, screenId: 'local' } })
    await service.command(id, actor, { commandId: 'public_episode', sequence: 3, command: { type: 'propose_episode', expectedContextVersion: 3, showId: show.tmdbId, episodeId: episode.tmdbId } })
    await service.command(id, actor, { commandId: 'progress', sequence: 4, command: { type: 'show_progress', showId: show.tmdbId, input: { state: 'continue', nextEpisodeId: episode.tmdbId }, approvedEpisodeId: episode.tmdbId } })
  }
  const { getTitleSnapshot } = await import('../title-snapshot/index.server')
  const waitUntil = Date.now() + 20_000
  while (process.env.YEPWATCH_SMOKE_CONTINUATION !== '1' && !getTitleSnapshot() && Date.now() < waitUntil) await new Promise(resolve => setTimeout(resolve, 250))
  const room = (await service.repository.read(id))!.room; const key = 2_000_000_000_000 + show.tmdbId
  const displays = await goodwatchReads.displays([key]); const evidence = await goodwatchReads.availability([...displays.values()], room.screens, true)
  console.log(JSON.stringify({ check: 'real_country_evidence', states: (evidence.get(key) ?? []).map(a => ({ state: a.state, scope: a.scope, offers: a.offers.length })) }))
  const deck = await goodwatchCatalog.candidates(room)
  console.log(JSON.stringify({ check: 'real_deck', count: deck.length, kinds: [...new Set(deck.map(c => c.identity.kind))] }))
  const final = await goodwatchCatalog.recheck(room, deck[0]); console.log(JSON.stringify({ check: 'real_final_watchability', states: final.map(a => a.state), scopes: final.map(a => a.scope) }))
} catch (error) {
  console.log(JSON.stringify({ check: 'unavailable', code: error instanceof Error && 'code' in error ? error.code : 'read_failed', message: error instanceof Error ? error.message : 'Read failed' })); process.exitCode = 1
} finally { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref() }
