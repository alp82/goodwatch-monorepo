import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"

// Bundle real loaders and aggregate reads with in-memory external services.
async function fixture(
	entry: string,
	modules: Record<string, string>,
	extraExports = "",
) {
	const app = path.resolve("app")
	const result = await build({
		stdin: {
			contents: `export * from ${JSON.stringify(
				`./${entry}`,
			)}; ${extraExports}; export { requestServerTiming } from "~/utils/request-work"`,
			resolveDir: app,
		},
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		alias: { "~": app },
		plugins: [
			{
				name: "profile-fixture",
				setup(builder) {
					builder.onResolve({ filter: /.*/ }, (args) => {
						const resolved = args.path.startsWith("~/")
							? args.path.slice(2)
							: args.path.startsWith(".")
								? path
										.relative(app, path.resolve(args.resolveDir, args.path))
										.replace(/\.ts$/, "")
								: args.path
						if (resolved in modules)
							return { path: resolved, namespace: "fixture" }
						if (resolved.startsWith("ui/") || resolved === "@remix-run/react")
							return { path: "empty", namespace: "fixture" }
					})
					builder.onLoad(
						{ filter: /.*/, namespace: "fixture" },
						({ path: name }) => ({ contents: modules[name] ?? "" }),
					)
					builder.onLoad(
						{ filter: /routes\/u\..*\.tsx$/ },
						({ path: filename }) => {
							const source = readFileSync(filename, "utf8")
							return {
								contents: source.slice(
									0,
									source.indexOf("\n", source.indexOf("export const loader =")),
								),
								loader: "tsx",
							}
						},
					)
				},
			},
		],
	})
	return import(
		`data:text/javascript;base64,${Buffer.from(
			result.outputFiles[0].text,
		).toString("base64")}`
	)
}

const services = {
	"server/userData.server": `export const getUserData = async () => ({scores: {'movie-1': {score: 9}}, watchState: {}})`,
	"utils/helpers": `export const titlePath = () => '/movie/1'`,
	"server/profile/catalog.server": `export const readProfileCatalog = async (sql) => sql.includes('unnest') ? [{name:'Fixture trope',count:1}] : sql.includes('FROM movie') ? [{tmdb_id: 1, title: 'One', tropes: []}] : []`,
	"server/profile/taste-stats-cache.server": `let saved; export const readCachedTasteStats = async () => saved && ({value:saved,fresh:true}); export const writeCachedTasteStats = async (_, value) => { saved = value }`,
	"utils/headers": `export const pageHeaders = () => ({})`,
}

test("Stats loader emits duration-only attribution and warm stats skip aggregate reads", async () => {
	const module = await fixture("routes/u.$handle.stats.($view).tsx", {
		...services,
		"server/media-payload.server": `export { withRequestTiming as presentCatalogLoader } from '~/utils/request-work'`,
		"server/profile/route.server": `export const profileLoader = async (args, load) => load({ownerId: 'private-owner', viewerId: null, shell: {}})`,
		"domain/profile": `export const seesPart = () => true`,
		"server/profile/compare.server": `export const getMemberCompare = async () => null`,
		"server/profile/portrait.server": `import { timeRequestCache } from '~/utils/request-work'; const saved = new Set(); export const getProfilePortrait = async (_, tab, options) => { await timeRequestCache(options.request, 'portrait_' + tab, async () => saved.has(tab)); saved.add(tab); return {} }`,
		"server/profile/stats-payload": `export const statsPayload = x => x; export const statsTastePayload = x => x`,
		"server/profile/taste-stats-view": `export const statsForViewer = x => x`,
		"ui/profile/taste/model": `export const buildProfileTaste = () => ({}); export const theirLine = () => ''`,
		"ui/og-image/profile-card-model": `export const PROFILE_CARD_VIEWS = []`,
		"utils/display-names": `export const languageName = x => x; export const regionName = x => x`,
	})
	const run = () =>
		module.loader({
			request: new Request("http://localhost/u/test/stats"),
			params: {},
		})
	const timing = (await run()).headers.get("Server-Timing")!
	const names = [
		"stats_details",
		"stats_tropes",
		"stats_credits",
		"stats_people",
		"stats_cache_miss",
		...["fingerprint", "sides", "everyone"].flatMap((tab) => [
			`portrait_${tab}`,
			`portrait_${tab}_cache_miss`,
		]),
	]
	for (const name of names)
		assert.match(timing, new RegExp(`(?:^|, )${name};dur=\\d+\\.\\d(?:,|$)`))
	assert.ok(
		timing
			.split(", ")
			.every((entry: string) => /^[a-z_]+;dur=\d+\.\d$/.test(entry)),
	)
	const warm = (await run()).headers.get("Server-Timing")!
	assert.match(warm, /stats_cache_hit;dur=/)
	assert.doesNotMatch(warm, /stats_(details|tropes|credits|people|cache_miss);/)
	for (const tab of ["fingerprint", "sides", "everyone"])
		assert.match(warm, new RegExp(`portrait_${tab}_cache_hit;dur=`))
})

test("Overview and Lists prime the shell with combined list cards", async () => {
	for (const route of ["_index", "lists._index"]) {
		const module = await fixture(`routes/u.$handle.${route}.tsx`, {
			...services,
			"server/media-payload.server": `export const presentCatalogLoader = load => load`,
			"server/profile/route.server": `export const profileLoader = async (args, load, options) => options`,
			"server/profile/page.server": `export const loadProfileOverview = () => {}; export const loadProfileLists = () => {}`,
			"server/profile/portrait.server": `export const getProfilePortrait = () => {}`,
			"server/profile/compare.server": `export const getMemberCompare = () => {}`,
		})
		assert.deepEqual(
			await module.loader({
				request: new Request("http://localhost/u/test"),
				params: {},
			}),
			{ listCards: true },
		)
	}
})

test("profile portraits forward request timings to each real portrait cache lookup", async () => {
	const module = await fixture("server/profile/portrait.server.ts", {
		"server/availability-index.server": `export const isOnServices = () => true`,
		"server/personal-order/reader.server": `export const loadPersonalOrder = async () => null; export const orderPersonalOrder = () => {}`,
		"server/taste/index.server": `export const loadTaste = async () => ({})`,
		"server/title-cards.server": `export const getCardServices = async () => []; export const getServiceList = async () => []`,
		"server/title-snapshot/index.server": `export const getTitleSnapshot = () => ({})`,
		"server/viewer.server": `export const getMemberViewerContext = async () => ({ hidden: new Set(), services: [], ratings: new Map(), seen: new Set(), wishlist: new Map(), skipped: new Set(), viewer: {} }); export const getViewerContext = () => {}`,
		"utils/auth": `export const getUserIdFromRequest = () => null`,
		"server/taste-portrait/cache.server": `const saved = new Map(); export const readCachedPortrait = async (_, tab) => saved.get(tab); export const writeCachedPortrait = (_, view) => saved.set(view.tab, view); export const clearTastePortrait = () => {}`,
		"server/taste-portrait/display.server": `export const titleDisplays = async () => new Map()`,
		"server/taste-portrait/person.server": `export const readPerson = () => ({ rated: [], match: () => new Map() }); export const round1 = x => x`,
		"server/taste-portrait/fingerprint.server": `export const buildFingerprint = () => ({ tab: 'fingerprint', mostYou: [], attributes: [] })`,
		"server/taste-portrait/sides.server": `export const buildSides = () => ({ tab: 'sides', sides: [] }); export const franchiseOf = x => x`,
		"server/taste-portrait/everyone.server": `export const buildEveryone = () => ({ tab: 'everyone', higher: [], lower: [] })`,
		"server/taste-portrait/sample-context.server": `export const sampleContext = () => {}; export const guestMarksKey = () => ''`,
		"server/profile/portrait-public": `export const publicView = x => x`,
	})
	for (const tab of ["fingerprint", "sides", "everyone"]) {
		for (const outcome of ["miss", "hit"]) {
			const request = new Request("http://localhost/u/test/stats")
			await module.getProfilePortrait("private-owner", tab, { request })
			assert.match(
				module.requestServerTiming(request),
				new RegExp(
					`^portrait_${tab}_cache_${outcome};dur=\\d+\\.\\d, total;dur=`,
				),
			)
		}
	}
})

test("public Stats portraits skip discarded lookups and warm hits skip member context", async () => {
	const calls = { context: 0, taste: 0 }
	;(
		globalThis as unknown as { statsPortraitCalls: typeof calls }
	).statsPortraitCalls = calls
	const module = await fixture(
		"server/profile/portrait.server.ts",
		{
			"server/availability-index.server": `export const isOnServices = () => true`,
			"server/personal-order/reader.server": `export const loadPersonalOrder = () => { throw Error('personal order') }; export const orderPersonalOrder = () => {}`,
			"server/taste/index.server": `export const loadTaste = async () => { globalThis.statsPortraitCalls.taste++; return {} }`,
			"server/title-cards.server": `export const getCardServices = () => { throw Error('card services') }; export const getServiceList = () => { throw Error('service list') }`,
			"server/title-snapshot/index.server": `export const getTitleSnapshot = () => ({facts: () => ({score:80})})`,
			"server/viewer.server": `export const getMemberViewerContext = async () => { globalThis.statsPortraitCalls.context++; return { hidden: new Set(), services: [], ratings: new Map([[2,9],[4,8]]), seen: new Set(), wishlist: new Map(), skipped: new Set(), viewer: {} } }; export const getViewerContext = () => {}`,
			"utils/auth": `export const getUserIdFromRequest = () => null`,
			"server/profile/summary-cache.server": `const saved = new Map(); export const readSummary = async (kind) => saved.has(kind) ? {value:saved.get(kind),fresh:true} : null; export const writeSummary = async (kind,_,view) => saved.set(kind,view)`,
			"server/taste-portrait/cache.server": `export const readCachedPortrait = () => { throw Error('full portrait cache') }; export const writeCachedPortrait = () => {}; export const clearTastePortrait = () => {}`,
			"server/taste-portrait/display.server": `export const titleDisplays = async keys => { if ([...keys].includes(6)) throw Error('discarded title'); return new Map([...keys].map(k => [k,{title:'Title',poster:null,backdrop:null,year:2000}])) }`,
			"server/taste-portrait/person.server": `export const readPerson = () => ({ rated: [], match: () => { throw Error('matches') } }); export const round1 = x => x`,
			"server/taste-portrait/fingerprint.server": `export const buildFingerprint = () => ({ tab: 'fingerprint', status:'ready', mostYou: [2], attributes: [{carriers:[2],against:[],exception:null,defining:[6]}] })`,
			"server/taste-portrait/sides.server": `export const buildSides = () => ({ tab: 'sides', status:'ready', sides: [{here:[2],image:2,moreOfThis:[6],edges:[{rated:[4],suggestions:[6],image:6}]}] }); export const franchiseOf = x => x`,
			"server/taste-portrait/everyone.server": `export const buildEveryone = () => ({ tab: 'everyone', status:'ready', higher: [{key:2}], lower: [] })`,
			"server/taste-portrait/sample-context.server": `export const sampleContext = () => {}; export const guestMarksKey = () => ''`,
		},
		'export { refreshStatsPortraits } from "./server/taste-portrait/index.server.ts"',
	)
	const refresh = () =>
		module.refreshStatsPortraits("owner", async () => {
			calls.context++
			return {
				services: [],
				ratings: new Map([
					[2, 9],
					[4, 8],
				]),
				seen: new Set(),
				wishlist: new Map(),
				skipped: new Set(),
				hidden: new Set(),
			}
		})
	await refresh()
	assert.deepEqual(
		calls,
		{ context: 0, taste: 0 },
		"unviewed summaries do no work",
	)
	for (const scores of [true, false]) {
		for (const tab of ["fingerprint", "sides", "everyone"]) {
			const request = new Request("http://localhost/u/test/stats")
			const view = await module.getProfilePortrait("owner", tab, {
				summary: true,
				scores,
				request,
			})
			if (scores && tab === "fingerprint") {
				await refresh()
				assert.deepEqual(
					calls,
					{ context: 2, taste: 0 },
					"refresh only the retained fingerprint",
				)
			}
			if (!scores)
				for (const title of Object.values(view.titles) as {
					mine: number | null
				}[])
					assert.equal(title.mine, null)
			if (!scores && tab === "everyone") assert.deepEqual(view.higher, [])
			assert.match(
				module.requestServerTiming(request),
				new RegExp(`portrait_${tab}_cache_${scores ? "miss" : "hit"}`),
			)
		}
	}
	assert.equal(calls.context, 4)
	assert.equal(calls.taste, 1, "only edge qualification needs the taste vector")
	await refresh()
	assert.deepEqual(
		calls,
		{ context: 7, taste: 2 },
		"refresh every retained tab",
	)
})

test("taste writes refresh retained Stats and leave unviewed Stats for the next view", async () => {
	const module = await fixture("server/profile/taste-stats.server.ts", {
		...services,
		"server/profile/taste-stats-cache.server": `let saved = null; export const readCachedTasteStats = async () => saved; export const writeCachedTasteStats = async (_, value) => { saved = {value, fresh:false} }`,
		"server/userData.server": `export const getUserData = async () => { globalThis.statsRefreshReads++; return { scores: {}, watchState: {} } }`,
	})
	const counts = globalThis as unknown as { statsRefreshReads: number }
	counts.statsRefreshReads = 0
	await module.refreshTasteStats("owner")
	assert.equal(counts.statsRefreshReads, 0)
	await module.getTasteStats("owner")
	assert.equal(counts.statsRefreshReads, 1, "first view computes")
	await module.refreshTasteStats("owner")
	assert.equal(
		counts.statsRefreshReads,
		2,
		"retained stale entry refreshes on write",
	)
	delete (globalThis as unknown as { statsRefreshReads?: number })
		.statsRefreshReads
})

test("readSummary requires a computation after touched plus the settle window", async () => {
	const module = await fixture("server/profile/summary-cache.server.ts", {
		"utils/cache": `export const getRedisCluster = () => ({get: async key => key.startsWith('taste:touched:') ? globalThis.summaryFreshness.touched : globalThis.summaryFreshness.raw})`,
	})
	const state = { touched: "", raw: "" }
	;(
		globalThis as unknown as { summaryFreshness: typeof state }
	).summaryFreshness = state
	const now = Date.now()
	const touched = now - 10_000
	state.touched = String(touched)
	const value = { titles: ["synthetic"] }
	const payload = gzipSync(JSON.stringify(value)).toString("base64")
	for (const [readFrom, fresh] of [
		[touched - 1, false],
		[touched, false],
		[touched + 1_499, false],
		[touched + 1_500, true],
		[touched + 1_501, true],
	] as const) {
		state.raw = JSON.stringify({ readFrom, payload })
		assert.deepEqual(await module.readSummary("stats", "owner"), {
			value,
			fresh,
		})
	}
	state.touched = ""
	state.raw = JSON.stringify({ readFrom: now - 10 * 60_000, payload })
	assert.deepEqual(await module.readSummary("stats", "owner"), {
		value,
		fresh: false,
	})
	state.raw = JSON.stringify({ readFrom: now, payload })
	assert.deepEqual(await module.readSummary("stats", "owner"), {
		value,
		fresh: true,
	})
	delete (globalThis as unknown as { summaryFreshness?: typeof state })
		.summaryFreshness
})
