// Local HTTPS stand-in for TMDB and the Plex discover API, used only by the
// harness. Seerr reaches it through Docker network aliases on an internal
// network, so no request leaves the machine.
//
// The Plex responses follow the shape Seerr's parser expects
// (server/api/plextv.ts). They are not recorded Plex responses.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createServer } from "node:https"

const [certPath, keyPath] = process.argv.slice(2)
const log = []

// A Plex watchlist item. `flag` controls what the metadata endpoint returns.
const item = (tmdbId, type, flag = "ok") => ({
	ratingKey: `rk-${type}-${tmdbId}-${flag}`,
})
const range = (from, count, type, flag) =>
	Array.from({ length: count }, (_, index) => item(from + index, type, flag))

// One scenario per fake token. `etag`: "page" gives each page its own tag,
// "list" gives every page the same tag and answers 304 to a match.
const scenarios = {
	"plex-normal": { items: [...range(5000, 13, "movie"), ...range(6000, 12, "show")], etag: "page" },
	"plex-normal-v2": { items: [...range(5000, 13, "movie"), ...range(6000, 12, "show")], etag: "page" },
	"plex-missing-guid": {
		items: [...range(5100, 20, "movie"), ...range(5200, 3, "movie", "noguid"), ...range(6100, 2, "show")],
		etag: "page",
	},
	"plex-meta-404": {
		items: [...range(5300, 22, "movie"), ...range(5400, 3, "show", "404")],
		etag: "page",
	},
	"plex-meta-500": { items: [...range(5500, 10, "movie"), ...range(5600, 1, "movie", "500")], etag: "page" },
	"plex-list-500": { items: range(5700, 5, "movie"), etag: "page", failList: "all" },
	"plex-expired": { items: range(5800, 5, "movie"), etag: "page", failList: "401" },
	"plex-fail-page-2": { items: range(5900, 30, "movie"), etag: "page", failList: "after-first" },
	"plex-list-etag": { items: range(6200, 30, "movie"), etag: "list" },
	"plex-empty": { items: [], etag: "page" },
	"plex-switch": { items: range(6300, 25, "movie"), etag: "page" },
	"plex-other-type": { items: [...range(7000, 3, "movie"), ...range(7100, 2, "episode")], etag: "page" },
	// Metadata succeeds once per item, then fails: Seerr's background refresh.
	refresh: { items: range(7200, 5, "movie", "refresh"), etag: "page" },
	// Plex answers that repeat the token in their bodies.
	echo: { items: [...range(7300, 2, "movie", "echo"), ...range(7310, 1, "movie", "echo401")], etag: "page", echo: true },
	// The list endpoint redirects to another host.
	redirect: { items: range(7400, 3, "movie"), etag: "page", redirect: true },
}
// The token in every form a careless server might echo it.
const echoes = (token) => [
	token,
	encodeURIComponent(token),
	Buffer.from(token).toString("base64"),
	JSON.stringify(token).slice(1, -1).replaceAll("/", "\\/"),
	[...token].map((c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join(""),
]
// Raw JSON text, so escaped forms survive as written.
const echoJson = (token) => echoes(token).map((form, index) => `"echo${index}":"${form}"`).join(",")
// Synthetic secrets from the harness select the refresh scenario. Tokens that
// start with gw712-dryrun-owner- stand in for an owner's token in the
// owner-plex-check dry run.
const scenarioFor = (token = "") =>
	token.startsWith("gw712-synthetic-secret-")
		? scenarios.refresh
		: token.startsWith("gw712-dryrun-owner-echo-")
			? scenarios.echo
			: token.startsWith("gw712-dryrun-owner-redirect-")
				? scenarios.redirect
				: token.startsWith("gw712-dryrun-owner-")
					? scenarios["plex-normal"]
					: scenarios[token]
const metadataServed = new Set()

function send(res, status, body, headers = {}) {
	res.writeHead(status, { "content-type": "application/json", ...headers })
	res.end(body === undefined ? "" : JSON.stringify(body))
}

function plexList(req, res, url) {
	const token = req.headers["x-plex-token"]
	const scenario = scenarioFor(token)
	if (!scenario) return send(res, 401, { error: "unknown token" })
	if (scenario.failList === "401") return send(res, 401, { error: "expired" })
	if (scenario.failList === "all") return send(res, 500, { error: "upstream" })
	const start = Number(url.searchParams.get("X-Plex-Container-Start") ?? 0)
	const size = Number(url.searchParams.get("X-Plex-Container-Size") ?? 20)
	if (scenario.failList === "after-first" && start > 0)
		return send(res, 500, { error: "upstream" })
	if (scenario.redirect && req.headers.host !== "gw712-redirect-target") {
		res.writeHead(302, { location: `https://gw712-redirect-target${req.url}` })
		return res.end()
	}
	// ETags come from a hash of the token, never the token itself.
	const tag = createHash("sha256").update(token).digest("hex").slice(0, 16)
	const etag = scenario.etag === "list" ? `"${tag}-list"` : `"${tag}-${start}"`
	if (scenario.echo && req.headers["if-none-match"] !== etag) {
		const body = JSON.stringify({ MediaContainer: { offset: start, size, totalSize: scenario.items.length, Metadata: scenario.items.slice(start, start + size) } })
		res.writeHead(200, { "content-type": "application/json", etag })
		return res.end(`{${echoJson(token)},${body.slice(1, -2)},${echoJson(token)}}}`)
	}
	if (req.headers["if-none-match"] === etag) return send(res, 304, undefined, { etag })
	send(
		res,
		200,
		{
			MediaContainer: {
				offset: start,
				size,
				totalSize: scenario.items.length,
				Metadata: scenario.items.slice(start, start + size),
			},
		},
		{ etag },
	)
}

function plexMetadata(req, res, ratingKey, entry) {
	const match = /^rk-(movie|show|episode)-(\d+)-(\w+)$/.exec(ratingKey)
	if (!match) return send(res, 404, {})
	const [, type, tmdbId, flag] = match
	const token = req.headers["x-plex-token"] ?? ""
	if (flag === "echo401") {
		res.writeHead(401, { "content-type": "application/json" })
		return res.end(`{"error":"bad token",${echoJson(token)}}`)
	}
	if (flag === "echo") {
		res.writeHead(200, { "content-type": "application/json" })
		return res.end(
			`{${echoJson(token)},"MediaContainer":{${echoJson(token)},"Metadata":[{"ratingKey":"${ratingKey}","type":"${type}","title":"Plex ${type} ${tmdbId}",${echoJson(token)},"Guid":[{"id":"tmdb://${tmdbId}"}]}]}}`,
		)
	}
	if (flag === "404") return send(res, 404, {})
	if (flag === "500") return send(res, 500, {})
	if (flag === "refresh") {
		if (metadataServed.has(ratingKey)) {
			entry.injectedFailure = true
			return send(res, 500, {})
		}
		metadataServed.add(ratingKey)
	}
	const Guid = flag === "noguid" ? [{ id: "imdb://tt0000001" }] : [{ id: `tmdb://${tmdbId}` }]
	send(res, 200, {
		MediaContainer: {
			Metadata: [{ ratingKey, type, title: `Plex ${type} ${tmdbId}`, Guid }],
		},
	})
}

function tmdb(res, kind, id) {
	const numeric = Number(id)
	const base = { id: numeric, external_ids: { tvdb_id: null, imdb_id: null }, videos: { results: [] } }
	if (kind === "movie")
		return send(res, 200, { ...base, title: `Movie ${id}`, release_date: "2001-01-01" })
	send(res, 200, {
		...base,
		name: `Show ${id}`,
		first_air_date: "2001-01-01",
		number_of_seasons: 1,
		seasons: [{ id: numeric * 10, season_number: 1, episode_count: 1, name: "Season 1" }],
	})
}

createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, (req, res) => {
	const url = new URL(req.url, `https://${req.headers.host}`)
	if (url.pathname === "/__log") return send(res, 200, log)
	const entry = { host: req.headers.host, path: url.pathname, start: url.searchParams.get("X-Plex-Container-Start"), withToken: !!req.headers["x-plex-token"] }
	log.push(entry)
	const plexMeta = /^\/library\/metadata\/([^/]+)$/.exec(url.pathname)
	const tmdbItem = /^\/3\/(movie|tv)\/(\d+)$/.exec(url.pathname)
	if (url.pathname === "/library/sections/watchlist/all") return plexList(req, res, url)
	if (plexMeta) return plexMetadata(req, res, plexMeta[1], entry)
	if (tmdbItem) return tmdb(res, tmdbItem[1], tmdbItem[2])
	send(res, 404, { error: "not mocked" })
}).listen(443, () => console.log("mock upstream ready"))
