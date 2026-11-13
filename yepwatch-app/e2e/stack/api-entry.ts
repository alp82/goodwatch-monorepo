/**
 * E2E API process: the production release runtime (createReleaseRuntime: relational Crate store, release
 * control, member adapter, room search, readiness, repair) and the production HTTP listener (releaseHttp).
 * It differs from proposal-release-main.ts in exactly these places, all loopback:
 *  - catalog reads: a deterministic 600-title fixture through the real deck code (createContinuousCatalog +
 *    proposalCatalog + idea interleaving), instead of the GoodWatch title snapshot + catalog SQL;
 *  - the GoodWatch issuer and search role are local fakes (e2e/stack/fakes.mjs) reached over real HTTP;
 *  - the public origin is http://127.0.0.1:18480 and release limits are at the schema maxima (100/120/2400/120).
 * Bundled by up.mjs into goodwatch-webapp/build/yepwatch-e2e/api.mjs. Usage: api.mjs serve|provision|reset
 */
import { createReleaseRuntime } from "~/server/yepwatch/proposal-release-runtime.ts"
import { releaseHttp } from "~/server/yepwatch/proposal-release-http.ts"
import { createReleaseBus } from "~/server/yepwatch/proposal-release-bus.ts"
import { crateSql } from "~/server/yepwatch/repository.server.ts"
import { provisionReleaseStore } from "~/server/yepwatch/proposal-release-store.ts"
import { provisionControl } from "~/server/yepwatch/proposal-release-control.ts"
import { provisionDeletion } from "~/server/yepwatch/proposal-deletion.ts"
import { storageTables } from "~/server/yepwatch/proposal-storage-schema.ts"
import { createContinuousCatalog } from "~/server/yepwatch/continuous-catalog.ts"
import type { CatalogDisplay, CatalogReads } from "~/server/yepwatch/catalog-adapter.ts"
import { proposalCatalog } from "~/server/yepwatch/proposal-catalog.server.ts"
import { roomIntentKeys } from "~/server/yepwatch/proposal-intent.ts"
import { matchingIdeaIds } from "~/server/yepwatch/proposal-redesign.ts"
import { providerCatalog, type ProviderCatalogRow } from "~/server/yepwatch/provider-catalog.ts"
import { fixtureEpisodes } from "~/server/yepwatch/test-support.ts"
import type { ContinuousMembers } from "~/server/yepwatch/continuous-members.server.ts"
import { memberExclusions } from "~/server/yepwatch/proposal-member-exclusions.ts"
import type { ProposalCatalog, ProposalRoom } from "~/server/yepwatch/proposal-types.ts"
import { paths } from "../../../goodwatch-webapp/packages/yepwatch-contracts/proposal.ts"
import { COUNTRIES, PROVIDERS, fixtureTitles, servicesOf } from "./fixture-titles.mjs"

const env = process.env
function need(name: string) {
	const v = env[name]
	if (!v) throw new Error(`Missing ${name}`)
	return v
}
function loopback(value: string) {
	const host = new URL(value).hostname
	if (!["127.0.0.1", "localhost"].includes(host)) throw new Error(`E2E API refuses non-loopback ${value}`)
	return value
}
const publicOrigin = loopback(need("E2E_PUBLIC_ORIGIN"))
const crateOrigin = loopback(need("E2E_CRATE_ORIGIN"))
const issuerOrigin = loopback(need("E2E_ISSUER_ORIGIN"))
const imagesOrigin = loopback(need("E2E_IMAGES_ORIGIN"))
loopback(need("YEPWATCH_SEARCH_URL"))
const valkeyPort = Number(need("E2E_VALKEY_PORT"))
const secret = need("E2E_ROOM_SECRET")
const keyId = need("E2E_KEY_ID")
// Production runs 20/600/60 (admissions, commands, actor commands a minute) and 10 rooms per person, with no
// shared cap on active rooms. The harness uses the storage schema's maxima (120 admissions and 2400 commands a
// minute): a release-policy knob, raised so parallel suites aren't throttled.
const control = { admissions: 120, commands: 2400, actorCommands: 120 }
const sql = crateSql(crateOrigin, "crate", "")

async function provision() {
	await provisionReleaseStore(sql, 0, keyId, secret)
	await provisionControl(sql, control, 0)
	await provisionDeletion(sql, 0)
}

const command = process.argv[2] ?? "serve"
if (command === "provision") {
	await provision()
	console.log(JSON.stringify({ operation: "provision", ready: true }))
	process.exit(0)
}
if (command === "reset") {
	for (const table of [...storageTables].reverse()) await sql(`DROP TABLE IF EXISTS ${table.name}`)
	await sql("DROP TABLE IF EXISTS doc.yepwatch_deletion").catch(() => {})
	await provision()
	console.log(JSON.stringify({ operation: "reset", ready: true }))
	process.exit(0)
}

// ---- fixture catalog through the real deck code -------------------------------------------------------
const TITLES = fixtureTitles(imagesOrigin) as CatalogDisplay[]
const byKey = new Map(TITLES.map((t) => [t.key, t]))
const rows: ProviderCatalogRow[] = PROVIDERS.map(([id, name], i) => ({
	tmdb_id: id as number,
	name: name as string,
	logo_path: null,
	order_by_country: Object.fromEntries(COUNTRIES.map((c) => [c.code, i])),
	order_default: i,
}))
const reads: CatalogReads = {
	async rankedKeys() {
		return TITLES.map((t) => t.key)
	},
	async displays(keys) {
		return new Map(keys.flatMap((k) => (byKey.has(k) ? [[k, byKey.get(k)!] as const] : [])))
	},
	async episodes() {
		return fixtureEpisodes
	},
	async availability(titles, screens) {
		return new Map(
			titles.map((t) => [
				t.key,
				screens.map((s) => {
					const offered = servicesOf(t).filter((id: number) => s.serviceIds.includes(id))
					return {
						screenId: s.id,
						state: offered.length ? "watchable" : "no_match",
						scope: "title",
						checkedAt: Date.now(),
						offers: offered.map((id: number) => ({
							serviceId: id,
							name: PROVIDERS.find(([p]) => p === id)![1],
							url: `https://example.invalid/watch/${id}/${t.tmdbId}`,
							kind: "provider",
							offerType: "flatrate",
						})),
					}
				}),
			])
		) as Awaited<ReturnType<CatalogReads["availability"]>>
	},
}
async function metadata(country?: string | null) {
	return {
		countries: COUNTRIES,
		...providerCatalog(rows, country && /^[A-Z]{2}$/.test(country) ? country : "US"),
		moods: [],
	}
}
const keyName = (key: number) => `${key >= 2_000_000_000_000 ? "show" : "movie"}_${key % 1_000_000_000_000}`
function fixtureCatalog(members?: ContinuousMembers): ProposalCatalog {
	// Members' seen titles as production reads them (proposal-guest-catalog.server.ts): best effort in deck builds,
	// the stored copy at Start, refreshed by room changes in setup.
	const exclusions = members ? memberExclusions(members) : null
	const base = createContinuousCatalog(reads, metadata, {
		rank: async (room, keys) => {
			const excluded = new Set(exclusions ? await exclusions.excludedKeys(room as ProposalRoom) : [])
			return roomIntentKeys(room as ProposalRoom, keys).filter((k) => !excluded.has(keyName(k)))
		},
	})
	const catalog = proposalCatalog(base)
	return {
		...catalog,
		async page(room) {
			const page = await catalog.page(room)
			return { ...page, candidates: page.candidates.map((c) => ({ ...c, ideaIds: matchingIdeaIds(room, c) })) }
		},
		...(exclusions ?? { excludedKeys: async () => [] }),
	}
}

// ---- release runtime -----------------------------------------------------------------------------------
const config = {
	origin: crateOrigin,
	username: "crate",
	password: "",
	secret,
	keyId,
	control,
	publicOrigin,
	member: {
		resource: `${publicOrigin}/api/yepwatch`,
		clientId: need("E2E_CLIENT_ID"),
		redirectUris: [`${publicOrigin}${paths.memberCallback}`],
		issuerOrigin,
		callbackUrl: `${publicOrigin}${paths.memberCallback}`,
		publicOrigin,
	},
	gatewaySecret: need("E2E_GATEWAY_SECRET"),
	revisionUrl: undefined,
	redisNodes: [{ host: "127.0.0.1", port: valkeyPort }],
	redisUsername: undefined,
	redisPassword: undefined,
	host: "127.0.0.1",
	port: Number(need("E2E_API_PORT")),
	sourceCommit: env.E2E_SOURCE_COMMIT ?? "e2e",
	probeMs: 1000,
	shutdownDelayMs: 0,
	drainMs: 500,
	roomRetentionDays: 30,
}
const bus = createReleaseBus(config)
bus.on("error", () => {})
void bus.connect().catch(() => {})
const runtime = createReleaseRuntime(config as Parameters<typeof createReleaseRuntime>[0], {
	sql,
	catalog: fixtureCatalog(),
	memberCatalog: (members) => fixtureCatalog(members),
	bus,
	snapshot: () => ({ count: TITLES.length, version: "e2e-fixture" }),
	async catalogProbe() {},
})
const server = await releaseHttp(runtime.handler, config.host, config.port)
await runtime.probe()
console.info(JSON.stringify({ event: "yepwatch_e2e_api_listening", port: config.port, ready: runtime.readiness() }))
let stopping = false
for (const signal of ["SIGTERM", "SIGINT"] as const)
	process.once(signal, () => {
		if (stopping) return
		stopping = true
		runtime.drain()
		runtime.stop()
		server.closeAllConnections()
		server.close(() => process.exit(0))
		bus.disconnect()
		setTimeout(() => process.exit(0), 1000).unref()
	})
