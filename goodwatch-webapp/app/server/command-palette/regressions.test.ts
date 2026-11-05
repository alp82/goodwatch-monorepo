// Exercise real palette modules with in-memory dependencies; no ports or production services.
import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

async function fixture(
	entry: string,
	stubs: Record<string, string>,
	extra = "",
) {
	const result = await build({
		stdin: {
			contents: `export * from ${JSON.stringify(path.resolve("app/server", entry))}; ${extra}`,
			resolveDir: process.cwd(),
		},
		bundle: true,
		write: false,
		platform: "node",
		format: "esm",
		plugins: [
			{
				name: "palette-fixture",
				setup(builder) {
					builder.onResolve({ filter: /.*/ }, (args) => {
						if (args.path === path.resolve("app/server", entry)) return

						const name = args.path.replace(/^.*\//, "").replace(/\.ts$/, "")
						if (name in stubs) return { path: name, namespace: "fixture" }
					})
					builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
						contents: stubs[args.path],
					}))
				},
			},
		],
	})
	return import(
		`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${Math.random()}`
	)
}
const fold = "export const fold = text => text.toLowerCase()"

test("trope names prefer verified headings, then exact slug folds and closest names; proper aliases still match", async () => {
	const { tropeEntries, matchGroup } = await fixture(
		"command-palette/tropes.server.ts",
		{ "text-rules.server": fold },
		'export { matchGroup } from "./app/server/command-palette/matching.server.ts"',
	)
	const gun = "https://tvtropes.org/pmwiki/pmwiki.php/Main/ChekhovsGun"
	const ending = "https://tvtropes.org/pmwiki/pmwiki.php/Main/BittersweetEnding"
	const catalog = [
		["[1]", gun, null],
		["Miller's reaction to reading this will be important later...", gun, null],
		["Chekhov's Axe", gun, "Wrong row"],
		["Chekhov’s Gun", gun, "A setup pays off."],
		["Bittersweet Endings", ending, "A mixed ending."],
		["Mixed Ending", ending, null],
	]
	const counts = new Map([
		[gun, 17870],
		[ending, 11949],
	])
	const entries = tropeEntries(catalog, counts, new Map())
	assert.equal(entries[0].item.label, "Chekhov’s Gun")
	assert.equal(entries[0].item.sub, "A setup pays off. · 17,870 titles")
	assert.equal(entries[1].item.label, "Bittersweet Endings")
	assert.equal(
		entries[0].item.href,
		`/discover?${new URLSearchParams({ q: "Chekhov’s Gun" })}`,
	)
	assert.deepEqual(entries[0].names, ["Chekhov's Axe", "Chekhov’s Gun"])
	assert.equal(
		matchGroup("tropes", "Tropes", entries, "mixed").items[0].label,
		"Bittersweet Endings",
	)
	assert.equal(matchGroup("tropes", "Tropes", entries, "miller"), undefined)
	assert.deepEqual(
		tropeEntries([...catalog].reverse(), counts, new Map()),
		[...entries].reverse(),
	)

	const verified = tropeEntries(
		catalog,
		counts,
		new Map([[gun, "The Loaded Gun"]]),
	)
	assert.equal(verified[0].item.label, "The Loaded Gun")
	assert.equal(matchGroup("tropes", "Tropes", verified, "the loaded").total, 1)
	assert.equal(
		matchGroup("tropes", "Tropes", verified, "chekhov").items[0].label,
		"The Loaded Gun",
	)
})

test("trope URLs with only markers, fragments, sentences or oversized names are dropped", async () => {
	const { tropeEntries } = await fixture("command-palette/tropes.server.ts", {
		"text-rules.server": fold,
	})
	const invalid = [
		"[1]",
		"[note]",
		"This will matter later...",
		"This will matter later…",
		"Miller's reaction to reading this will be important later",
		"A".repeat(71),
		"  ",
	]
	const catalog = invalid.map((name, i) => [
		name,
		`https://tvtropes.org/pmwiki/pmwiki.php/Main/Page${i}`,
		null,
	])
	const counts = new Map(catalog.map(([, url]) => [url, 100]))
	assert.deepEqual(tropeEntries(catalog, counts, new Map()), [])
	const url = "https://tvtropes.org/pmwiki/pmwiki.php/Main/LoveIsADrug"
	assert.equal(
		tropeEntries(
			[["Love Is a Drug", url, null]],
			new Map([[url, 1]]),
			new Map(),
		)[0].item.label,
		"Love Is a Drug",
	)
	assert.deepEqual(
		tropeEntries([["Love Is a Drug", url, null]], new Map(), new Map()),
		[],
	)
})

test("descriptions match only their opening; plain punctuation survives excerpt cleanup", async () => {
	const { excerpt, matchGroup } = await fixture(
		"command-palette/matching.server.ts",
		{ "text-rules.server": fold },
	)
	assert.equal(
		excerpt("#1 is Dr. X* and A_B, with <3 fans."),
		"#1 is Dr. X* and A_B, with <3 fans.",
	)
	assert.equal(
		excerpt("<b>Bold</b> and **strong**, [[url|label]]."),
		"Bold and strong, label.",
	)
	const entries = [
		{
			names: ["A post"],
			textPrefix: "Opening description with zebra",
			popularity: 1,
			item: { key: "post", label: "A post", href: "/blog/post" },
		},
	]
	assert.equal(matchGroup("blog", "Blog", entries, "ze"), undefined)
	assert.equal(
		matchGroup(
			"blog",
			"Blog",
			[{ ...entries[0], names: ["A postscript"] }],
			"osts",
		),
		undefined,
	)
	assert.equal(matchGroup("blog", "Blog", entries, "op").total, 1)
	assert.equal(matchGroup("blog", "Blog", entries, "po").total, 1)
})

test("background queue delays startup, runs serially, and backs off failed refreshes", async (t) => {
	const { scheduleCatalog } = await fixture(
		"command-palette/background.server.ts",
		{
			undici:
				"export const fetch = () => { throw Error('unexpected network') }",
			crate:
				"export class CrateAuthenticationError extends Error {}; export const isCrateRecoveryError = () => false; export const toCrateError = e => e",
		},
	)
	t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 })
	t.mock.method(console, "warn", () => {})
	const calls: string[] = []
	let release: () => void = () => {}
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	scheduleCatalog("first", 3_600_000, async () => {
		calls.push("first")
		await held
	})
	scheduleCatalog("failed", 3_600_000, async () => {
		calls.push("failed")
		throw Error("offline")
	})
	t.mock.timers.tick(4999)
	assert.deepEqual(calls, [])
	t.mock.timers.tick(1)
	assert.deepEqual(calls, ["first"])
	release()
	for (let i = 0; i < 10; i++) await Promise.resolve()
	assert.deepEqual(calls, ["first", "failed"])
	t.mock.timers.tick(59_999)
	assert.equal(calls.length, 2)
	t.mock.timers.tick(1)
	for (let i = 0; i < 10; i++) await Promise.resolve()
	assert.equal(calls.length, 3)
	t.mock.timers.tick(119_999)
	assert.equal(calls.length, 3)
	t.mock.timers.tick(1)
	for (let i = 0; i < 10; i++) await Promise.resolve()
	assert.equal(calls.length, 4)
})

test("background reads give each host sixty seconds and never retry a host", async (t) => {
	const { backgroundStatement, probe } = await fixture(
		"command-palette/background.server.ts",
		{
			undici: `export const probe = []; export const fetch = async (url, options) => { probe.push({url, signal: options.signal}); throw Object.assign(Error('offline'), {code:'ECONNREFUSED'}) }`,
			crate:
				"export class CrateAuthenticationError extends Error {}; export const isCrateRecoveryError = () => true; export const toCrateError = e => e",
		},
	)
	const timeouts: number[] = []
	t.mock.method(AbortSignal, "timeout", (ms: number) => {
		timeouts.push(ms)
		return new AbortController().signal
	})
	const old = process.env.CRATE_HOSTS
	process.env.CRATE_HOSTS = "one,two"
	try {
		await assert.rejects(
			backgroundStatement("SELECT name FROM genre"),
			/offline/,
		)
	} finally {
		if (old === undefined) Reflect.deleteProperty(process.env, "CRATE_HOSTS")
		else process.env.CRATE_HOSTS = old
	}
})

test("slow legacy titles survive group timeout; failed targets stay uncached and hits skip vocabulary matching", async () => {
	const { getPaletteAnswer, probe } = await fixture(
		"command-palette.server.ts",
		{
			probe:
				"export const probe = { displayMs: 300, timeout: true, vocabulary: 0, stored: [] }",
			"catalog.server": `export const catalogVersion = () => 'same'; export const startPaletteCatalog = () => {}`,
			"groups.server": `import {probe} from 'probe';
		 export const indexGroups = async () => probe.timeout ? new Promise(() => {}) : [];
		 export const ordered = groups => groups;
		 export const vocabularyGroups = () => { probe.vocabulary++; return [] };
		 export const titleGroups = (_q, titles) => [{key:'movies', total:titles.length, items:titles.map(title=>({title}))}];`,
			"failures.server": "export const paletteFailure = () => {}",
			"aliases.server": "export const matchedAlias = () => ({})",
			"name-prefix.server":
				"export const matchingRows = () => ({rows:[0],total:3,aliases:new Map()}); export const paletteCacheEntry = () => ({params:{}})",
			"search-index.server":
				"export const getSearchIndex = async () => ({ titleTable:{ pointIds:[1] } }); export const loadedAliasVersion = () => 1; export const loadedSearchIndexBuild = () => 1; export const startSearchIndex = () => {}",
			"text-rules.server": fold,
			"search.server": "export const getSearchResults = async () => []",
			"title-cards.server": `import {probe} from 'probe'; export const getDisplayFields = async () => {
		 await new Promise(resolve=>setTimeout(resolve,probe.displayMs));
		 return new Map([[1,{media_type:'movie',tmdb_id:1,title:'Title',release_year:2000,poster_path:'/poster',goodwatch_overall_score_normalized_percent:87}]]);
		}`,
			"index.server": "export const getTitleSnapshot = () => null",
			cache: `import {probe} from 'probe'; const values = new Map(); export const cached = async ({name,target}) => {
		 if(values.has(name)) return values.get(name);
		 const value = await target(); values.set(name,value); probe.stored.push(name); return value;
		}`,
			"command-palette":
				"export const MIN_PREFIX_CHARS=2; export const normalizePrefix=q=>q.trim().toLowerCase()",
			"title-key": "export const titleKey = () => 1",
			"role.server": "export const runsSearch = () => true",
		},
		'export { probe } from "probe"',
	)
	const slow = await getPaletteAnswer("title")
	assert.equal(slow.titles[0].score, 87)
	assert.equal(slow.more, 2)
	assert.equal(slow.groups[0].estimated, true)
	assert.ok(!probe.stored.includes("command-palette-answer-v7"))
	probe.timeout = false
	probe.displayMs = 0
	await getPaletteAnswer("title")
	assert.ok(probe.stored.includes("command-palette-answer-v7"))
	const matches = probe.vocabulary
	await getPaletteAnswer("title")
	assert.equal(probe.vocabulary, matches)
})

test("member snapshots batch avatar reads, retain content revisions, and expire stale privacy decisions", async (t) => {
	const { catalogEntries, catalogVersion, popularTropes, probe } =
		await fixture(
			"command-palette/catalog.server.ts",
			{
				probe:
					"export const probe = { jobs: new Map(), queries: [], fail: false }",
				"background.server": `import {probe} from 'probe';
		 export const scheduleCatalog = (key, interval, load) => { if(!probe.jobs.has(key)) probe.jobs.set(key,{interval,load}) };
		 export const backgroundStatement = async sql => {
		 probe.queries.push(sql); if(probe.fail) throw Error('offline');
		 const rows = sql.includes('FROM user_profile WHERE') && sql.startsWith('SELECT user_id, handle') ? [['id','member',0]]
		 : sql.includes('FROM user_setting') ? [['id','profile_avatar','{"kind":"initial","color":"teal"}']]
		 : sql.includes('FROM user_score') ? [['id',20]] : sql.includes('FROM doc.user_avatar') ? [['id','version']]
		 : sql.includes('FROM trope_catalog_page') ? [['https://tvtropes.org/pmwiki/pmwiki.php/Main/Gun','Verified Gun']]
		 : sql.includes('FROM trope_catalog') ? [['[1]','https://tvtropes.org/pmwiki/pmwiki.php/Main/Gun',null],['Gun','https://tvtropes.org/pmwiki/pmwiki.php/Main/Gun',null]]
		 : sql.includes('FROM trope WHERE') ? [['https://tvtropes.org/pmwiki/pmwiki.php/Main/Gun',17870]] : [];
		 return {rows};
		 }`,
				"new-on-services": "export const BRANDS = []",
				profile: "export const parseVisibility = v => v",
				"profile-settings":
					"export const parseAvatarChoice = v => v; export const asMediaKey = v => v",
				"user-data":
					"export const parseMediaKey = () => ({mediaType:'movie',tmdbId:1})",
				"catalog.server":
					"export const searchStatement = async () => ({rows:[]})",
				"avatar-choice.server":
					"export const resolveAvatar = async (_id,_handle,choice,_photo,loaded) => { if(!loaded) throw Error('unbatched'); return {url:null,color:choice.color} }",
				"search-eligibility.server":
					"export const publicProfileSearchable = () => true",
				"role.server": "export const runsSearch = () => true",
				"people.server":
					"export const palettePeopleSnapshot = () => []; export const startPeopleIndex = () => {}",
				"matching.server":
					"export const discover = () => '/discover'; export const excerpt = text => text",
			},
			'export { probe } from "probe"',
		)
	let now = 100_000
	t.mock.method(Date, "now", () => now)
	const members = probe.jobs.get("members")
	assert.equal(members.interval, 5 * 60_000)
	assert.equal(probe.jobs.get("genres").interval, 60 * 60_000)
	assert.equal(probe.jobs.get("tropes").interval, 6 * 60 * 60_000)
	await probe.jobs.get("tropes").load()
	assert.equal(popularTropes()[0].label, "Verified Gun")
	assert.deepEqual(catalogEntries("tropes")[0].names, ["Gun", "Verified Gun"])
	await members.load()
	assert.deepEqual(catalogEntries("members")[0].item.image, {
		kind: "avatar",
		path: undefined,
		hue: "teal",
		initial: "M",
	})
	assert.equal(
		probe.queries.filter((sql: string) => sql.includes("FROM doc.user_avatar"))
			.length,
		1,
	)
	assert.ok(
		probe.queries.some((sql: string) =>
			sql.includes(
				"WHERE user_id IN (SELECT user_id FROM user_profile WHERE handle IS NOT NULL)",
			),
		),
	)
	const revision = catalogVersion()
	now += 5 * 60_000
	await members.load()
	assert.equal(catalogVersion(), revision)
	probe.fail = true
	await assert.rejects(members.load(), /offline/)
	assert.equal(catalogEntries("members").length, 1)
	now += 10 * 60_000 + 1
	assert.equal(catalogEntries("members").length, 0)
	assert.notEqual(catalogVersion(), revision)
})

test("start response includes scored trending and popular tropes; failed picks are unavailable", async () => {
	const { getPaletteStart } = await fixture("command-palette/start.server.ts", {
		contract: "export const decodeFingerprints = v => v",
		rail: "export const DESK_SIZE = 3; export const drawerOrder = () => []",
		rank: "export const poolStats = () => ({}); export const rankPool = () => []",
		"recipe-fit":
			"export const recipeFitCounts = () => ({}); export const recipeFitScores = () => ({})",
		recipes:
			"export const LIBRARY = []; export const MIN_FIT = 1; export const ownRecipes = () => []",
		shape:
			"export const FLAT = {}; export const familyPushes = () => ({}); export const steerOf = () => ({})",
		"page.server":
			"export const loadForYouPage = async () => { throw Error('unavailable') }",
		"title-cards.server":
			"export const getDisplayFields = async () => new Map([[1,{media_type:'movie',tmdb_id:1,title:'Trending',poster_path:'/poster',goodwatch_overall_score_normalized_percent:91}]])",
		auth: "export const getUserIdFromRequest = async () => 'member'",
		cache: "export const cached = async ({target}) => target()",
		"title-key": "export const titleKey = () => 1",
		"catalog.server":
			"export const rows = async () => [['movie',1]]; export const popularTropes = () => [{key:'trope',label:'Popular',sub:'Description · 500 titles',href:'/discover',match:1}]",
		"failures.server": "export const paletteFailure = () => {}",
	})
	const answer = await getPaletteStart(
		new Request("https://goodwatch.test/api/command-palette-start"),
	)
	assert.equal(answer.forYou.state, "unavailable")
	assert.equal(answer.trending[0].score, 91)
	assert.equal(answer.tropes[0].sub, "Description · 500 titles")
})
