import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
	classAllowlist,
	contexts,
	emptyLoaderLists,
	failures,
	filterClasses,
	manifestDiff,
	manifestPaths,
	manifestRoutes,
	normalize,
	structure,
} from "./core.mjs"
import { validate } from "./run.mjs"

function document(data = { title: "Complete title", score: 80 }) {
	return `<html><head><meta name="description" content="Full movie"><link rel="preload" href="/assets/entry-abcdefgh.js"></head><body><main><section id="details">Complete title</section><a href="/movie/2">Next</a></main><script type="application/ld+json">{"@type":"Movie","name":"Complete title"}</script><script>window.__remixContext = JSON.parse(${JSON.stringify(JSON.stringify({ state: { loaderData: { movie: data } } }))});</script></body></html>`
}
const response = (body) => ({
	status: 200,
	cacheControl: "public, max-age=60",
	redirects: [],
	body,
})

test("normalization ignores only asset hashes and CSP nonce values", () => {
	assert.equal(
		normalize(document()),
		normalize(document().replace("abcdefgh", "12345678")),
	)
	assert.equal(
		normalize('<script nonce="aaa"></script>'),
		normalize('<script nonce="bbb"></script>'),
	)
	assert.notEqual(
		normalize(document()),
		normalize(document().replace('rel="preload"', 'rel="prefetch"')),
	)
	assert.notEqual(
		normalize(document()),
		normalize(document().replace("/assets/entry-", "/assets/other-")),
	)
})

test("every loader value and catalog timestamp survives", () => {
	const html = normalize(
		document({
			score: 80,
			updated_at: "2026-10-23",
			datePublished: "2020-01-01",
		}),
	)
	assert.equal(
		contexts(html)[0].state.loaderData.movie.updated_at,
		"2026-10-23",
	)
	assert.notEqual(
		html,
		normalize(
			document({
				score: 81,
				updated_at: "2026-10-23",
				datePublished: "2020-01-01",
			}),
		),
	)
	assert.notEqual(
		html,
		normalize(
			document({
				score: 80,
				updated_at: "2026-10-24",
				datePublished: "2020-01-01",
			}),
		),
	)
})

test("generated Remix imports are ignored; other inline code is retained", () => {
	const script = (hash) =>
		`<script type="module">import * as route from "/assets/root-${hash}.js"; window.__remixManifest = {}; window.__remixRouteModules = {route};</script>`
	assert.equal(normalize(script("abcdefgh")), normalize(script("12345678")))
	assert.notEqual(
		normalize("<script>important()</script>"),
		normalize("<script>missing()</script>"),
	)
})

test("missing section, meta, link, JSON-LD and loader keys fail", () => {
	const html = document()
	for (const removed of [
		'<section id="details">Complete title</section>',
		'<meta name="description" content="Full movie">',
		'<a href="/movie/2">Next</a>',
		'<script type="application/ld+json">{"@type":"Movie","name":"Complete title"}</script>',
	]) {
		assert.ok(
			failures(
				response(normalize(html)),
				response(normalize(html.replace(removed, ""))),
			).includes("document HTML changed"),
		)
	}
	assert.ok(
		failures(
			response(normalize(html)),
			response(normalize(document({ title: "Complete title" }))),
		).length,
	)
})

test("matching server errors and incomplete documents still fail", () => {
	assert.ok(
		failures(
			{ ...response(document()), status: 503 },
			{ ...response(document()), status: 503 },
		).length,
	)
	assert.ok(failures(response("<html>"), response("<html>")).length)
	assert.ok(
		failures(response(document()), {
			...response(document()),
			cacheControl: "private, no-store",
		}).includes("no-store on one side only"),
	)
})

test("production reports distinguish text changes from missing structure", () => {
	const original = structure(document())
	const text = structure(
		document().replaceAll("Complete title", "Changed title"),
	)
	assert.deepEqual(original.landmarks, text.landmarks)
	assert.deepEqual(original.loaderDataKeys, text.loaderDataKeys)
	assert.deepEqual(original.jsonLd, text.jsonLd)
	assert.notEqual(original.text, text.text)
	const missing = structure(
		document().replace('<section id="details">Complete title</section>', ""),
	)
	assert.notDeepEqual(original.landmarks, missing.landmarks)
	assert.notDeepEqual(
		original.loaderDataKeys,
		structure(document({ title: "Complete title" })).loaderDataKeys,
	)
	assert.notDeepEqual(
		original.jsonLd,
		structure(
			document().replace(
				'type="application/ld+json"',
				'type="application/json"',
			),
		).jsonLd,
	)
})

test("launcher refuses external endpoints and unpinned keys", () => {
	assert.throws(
		() => validate({ CRATE_HOSTS: "production.example.com" }),
		/not loopback/,
	)
	assert.throws(() => validate({ TMDB_API_KEY: "secret" }), /pinned empty/)
	assert.throws(() => validate({}), /pinned empty/)
})

test("direct Remix JSON is parsed without executing code", () => {
	const data = {
		state: { loaderData: { title: { text: 'a }; bracket \\" and <tag>' } } },
	}
	const direct = `<script>window.__remixContext = ${JSON.stringify(data)};</script>`
	assert.deepEqual(contexts(normalize(direct)), [data])
	assert.throws(
		() => normalize("<script>window.__remixContext = malicious();</script>"),
		/Unsupported/,
	)
})

test("only TanStack Query timestamps are normalized inside loaderData", () => {
	const html = (time) =>
		document({
			dataUpdatedAt: time,
			state: { dataUpdatedAt: time },
			dehydratedState: {
				mutations: [],
				queries: [
					{
						state: {
							dataUpdatedAt: time,
							errorUpdatedAt: time,
							data: { updated_at: time },
						},
					},
				],
			},
		})
	const data = contexts(normalize(html(123)))[0].state.loaderData.movie
	assert.equal(data.dataUpdatedAt, 123)
	assert.equal(data.state.dataUpdatedAt, 123)
	assert.equal(data.dehydratedState.queries[0].state.dataUpdatedAt, 0)
	assert.equal(data.dehydratedState.queries[0].state.data.updated_at, 123)
})

test("start page bootstrap keeps scheduling code but ignores generated imports", () => {
	const script = (name, delay = 5000) =>
		`<script>(function(code,preloads,fallback){schedule(code,fallback)})("import x from '${name}'; window.__remixRouteModules = {x}",[],${delay})</script>`
	assert.equal(normalize(script("one")), normalize(script("two")))
	assert.notEqual(normalize(script("one")), normalize(script("one", 10000)))
})

test("standalone Remix manifest is build-only", () => {
	assert.equal(
		normalize('<script>window.__remixManifest = {version:"one"};</script>'),
		normalize('<script>window.__remixManifest = {version:"two"};</script>'),
	)
})

test("production CLI saves separate structure and text reports", () => {
	const cache = process.env.GW_HTML_CHECK_CACHE || path.join(os.homedir(), ".cache/gw753-html-check")
	mkdirSync(cache, { recursive: true })
	const directory = mkdtempSync(path.join(cache, "report-test-"))
	try {
		const base = path.join(directory, "base")
		const candidate = path.join(directory, "candidate")
		for (const [dir, html] of [
			[base, document()],
			[
				candidate,
				document({ title: "Changed" }).replace(
					'<section id="details">Complete title</section>',
					"<p>Changed title</p>",
				),
			],
		]) {
			mkdirSync(dir)
			writeFileSync(path.join(dir, "000.raw.html"), html)
			writeFileSync(
				path.join(dir, "snapshot.json"),
				JSON.stringify({
					entries: [
						{
							...response(undefined),
							path: "/movie/1",
							client: "googlebot",
							file: "000.html",
						},
					],
				}),
			)
		}
		const result = spawnSync(
			process.execPath,
			[
				fileURLToPath(new URL("./run.mjs", import.meta.url)),
				"prod",
				"compare",
				base,
				candidate,
			],
			{ encoding: "utf8" },
		)
		assert.equal(result.status, 1, result.stderr)
		assert.match(
			result.stdout,
			/STRUCTURE: landmarks, loaderDataKeys; TEXT: changed/,
		)
		const report = JSON.parse(
			readFileSync(path.join(candidate, "diff-0/structure.json"), "utf8"),
		)
		assert.notDeepEqual(
			report.base.loaderDataKeys,
			report.candidate.loaderDataKeys,
		)
		assert.match(
			readFileSync(path.join(candidate, "diff-0/difference.diff"), "utf8"),
			/section id="details"/,
		)
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})

test("class allowlist removes only whole tokens in double-quoted class attributes", () => {
	const patterns = classAllowlist(["scroll-.*", "reviewed"])
	const html = `<html><body class="scroll-smooth reviewed keep"><p class="reviewed">reviewed scroll-smooth</p><i class="unreviewed"></i></body></html>`
	const filtered = filterClasses(html, patterns)
	assert.equal(filtered.removed, 3)
	assert.equal(
		filtered.html,
		`<html><body class="keep"><p class="">reviewed scroll-smooth</p><i class="unreviewed"></i></body></html>`,
	)
	assert.deepEqual(filterClasses(html), { html, removed: 0 })
	const opaque = `<p data-class="reviewed" title='class="reviewed"' class='reviewed'>reviewed</p><!-- class="reviewed" --><script>const x = '<p class="reviewed">';</script><style>/* class="reviewed" */</style><textarea><p class="reviewed"></textarea>`
	assert.deepEqual(filterClasses(opaque, patterns), {
		html: opaque,
		removed: 0,
	})
	for (const tag of ["script", "style", "textarea", "title", "xmp", "iframe"]) {
		const text = `<${tag}><p class="reviewed">`
		assert.deepEqual(filterClasses(text, patterns), { html: text, removed: 0 })
	}
	assert.throws(() => classAllowlist(["["]), SyntaxError)
})

test("class allowlist keeps unreviewed visibility tokens and text differences failing", () => {
	const patterns = classAllowlist(["scroll-.*"])
	const base = '<html><body class="keep">scroll-smooth</body></html>'
	const allowed = base.replace('class="keep"', 'class="scroll-smooth keep"')
	assert.deepEqual(
		failures(
			response(filterClasses(base, patterns).html),
			response(filterClasses(allowed, patterns).html),
		),
		[],
	)
	assert.ok(failures(response(base), response(allowed)).length)
	for (const token of ["hidden", "sr-only", "invisible"])
		assert.ok(
			failures(
				response(filterClasses(base, patterns).html),
				response(
					filterClasses(allowed.replace("keep", `keep ${token}`), patterns)
						.html,
				),
			).length,
		)
	assert.ok(
		failures(
			response(filterClasses(base, patterns).html),
			response(
				filterClasses(
					base.replace(">scroll-smooth<", ">scroll-auto<"),
					patterns,
				).html,
			),
		).length,
	)
})

test("manifest report shows flags, module paths and added or removed routes, ignoring hashes", () => {
	const route = {
		module: "/assets/movies-abcdefgh.js",
		hasLoader: true,
		hasClientLoader: false,
		hasAction: false,
		hasErrorBoundary: false,
	}
	const parse = (routes) =>
		manifestRoutes(`window.__remixManifest = ${JSON.stringify({ routes })};`)
	const base = parse({ movies: route, removed: route })
	const candidate = parse({
		movies: {
			...route,
			module: "/assets/movies-12345678.js",
			hasClientLoader: true,
		},
		added: route,
	})
	const changes = manifestDiff(base, candidate)
	assert.deepEqual(
		changes.map(({ route, kind }) => [route, kind]),
		[
			["added", "added"],
			["movies", "changed"],
			["removed", "removed"],
		],
	)
	assert.deepEqual(changes[1].fields, {
		hasClientLoader: { base: false, candidate: true },
	})
	assert.deepEqual(
		manifestDiff(
			parse({ movies: route }),
			parse({ movies: { ...route, module: "/assets/movies-12345678.js" } }),
		),
		[],
	)
	for (const key of ["hasLoader", "hasAction", "hasErrorBoundary", "module"]) {
		assert.ok(
			manifestDiff(
				parse({ movies: route }),
				parse({
					movies: {
						...route,
						[key]: key === "module" ? "/assets/other-12345678.js" : !route[key],
					},
				}),
			)[0].fields[key],
		)
	}
	assert.deepEqual(
		manifestPaths(
			'<script src="/assets/manifest-1234abcd.js"></script> import "/assets/manifest-1234abcd.js"',
		),
		["/assets/manifest-1234abcd.js"],
	)
	assert.throws(() => manifestRoutes("window.__remixManifest = malicious();"))
	assert.throws(() => manifestRoutes("window.__remixManifest = {};"), /routes/)
})

test("empty loader lists report only route data and its immediate fields", () => {
	assert.deepEqual(
		emptyLoaderLists(
			document({
				results: [],
				nested: { results: [] },
				nonempty: [1],
				emptyObject: {},
			}),
		),
		["movie.results"],
	)
	assert.deepEqual(emptyLoaderLists(document([])), ["movie"])
	assert.deepEqual(emptyLoaderLists(document({ results: [1] })), [])
})

test("CLI records repeated allowlist rules, per-side counts and empty data without hiding failures", () => {
	const cache = process.env.GW_HTML_CHECK_CACHE || path.join(os.homedir(), ".cache/gw753-html-check")
	mkdirSync(cache, { recursive: true })
	const directory = mkdtempSync(path.join(cache, "allowlist-test-"))
	try {
		const base = path.join(directory, "base")
		const candidate = path.join(directory, "candidate")
		for (const dir of [base, candidate]) {
			mkdirSync(dir)
			writeFileSync(
				path.join(dir, "snapshot.json"),
				JSON.stringify({
					entries: [
						{
							...response(undefined),
							path: "/movies",
							client: "googlebot",
							file: "000.html",
						},
					],
				}),
			)
		}
		const html = document({ results: [] }).replace(
			"<main>",
			'<main class="keep">',
		)
		writeFileSync(
			path.join(base, "000.raw.html"),
			html.replace('class="keep"', 'class="reviewed keep"'),
		)
		const cli = (...options) =>
			spawnSync(
				process.execPath,
				[
					fileURLToPath(new URL("./run.mjs", import.meta.url)),
					"prod",
					"compare",
					base,
					candidate,
					...options,
				],
				{ encoding: "utf8" },
			)
		const allowed = html.replace(
			'class="keep"',
			'class="scroll-smooth reviewed keep"',
		)
		writeFileSync(path.join(candidate, "000.raw.html"), allowed)
		assert.equal(cli().status, 1)
		const options = ["--allow-class", "scroll-.*", "--allow-class", "reviewed"]
		const result = cli(...options)
		assert.equal(result.status, 0, result.stderr)
		assert.match(result.stdout, /removed tokens: base 1, candidate 2/)
		assert.match(result.stdout, /empty on both sides: movie.results/)
		const report = JSON.parse(
			readFileSync(path.join(candidate, "comparison-review.json"), "utf8"),
		)
		assert.deepEqual(report.allowClass, ["scroll-.*", "reviewed"])
		assert.deepEqual(report.removed, { base: 1, candidate: 2 })
		assert.deepEqual(report.documents[0].removed, report.removed)
		assert.deepEqual(report.emptyOnBothSides, [
			{ path: "/movies", client: "googlebot", lists: ["movie.results"] },
		])
		for (const broken of [
			allowed.replace('keep"', 'keep hidden"'),
			allowed.replace("Complete title</section>", "scroll-smooth</section>"),
		]) {
			writeFileSync(path.join(candidate, "000.raw.html"), broken)
			assert.equal(cli(...options).status, 1)
		}
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})
