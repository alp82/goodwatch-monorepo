// Measures whether `user_watch_state.state_changed_at` can say that a member moved a show to Watching themselves
// (C3 in docs/implementation/tracking/data-model.md). Read-only: SELECT statements and nothing else, and no member
// id is printed.
//
// 1. The Watching shows, and how many of them changed state in the last 90 days (ACTIVE_DAYS).
// 2. Of those, how many have no watch activity in that time, so that only the state's time can put them in Continue,
//    and how many of them an import made Watching: the state changed no later than the show's latest imported watch
//    was recorded.
// 3. Whether one moment made many shows Watching for one member, as an import or a migration would.
// 4. The row of one show for the members who are Watching it, by its TMDB id.
// 5. What the grouped query costs with and without the time of the latest imported watch, for the largest member.
//
// Run from goodwatch-webapp:
//   node --env-file=.env scripts/measure-status-activity.mjs [tmdb id] [runs] [days]
import { createRequire } from "node:module"
import { GROUPED_QUERY } from "../app/server/tracking-sql.ts"

const showId = Number.parseInt(process.argv[2] ?? "85949", 10)
const runs = Number.parseInt(process.argv[3] ?? "15", 10)
const days = Number.parseInt(process.argv[4] ?? "90", 10)
if (!process.env.CRATE_HOSTS) throw new Error("CRATE_HOSTS is not set")

const require = createRequire(`${process.cwd()}/package.json`)
const crate = require("node-crate")
crate.connect(
	process.env.CRATE_HOSTS.split(",")
		.map(
			(host) =>
				`http://${process.env.CRATE_USER}:${process.env.CRATE_PASS}@${host}:${process.env.CRATE_PORT || 4200}`,
		)
		.join(" "),
)
// Not the driver's `json`: that turns a NULL timestamp into 1 January 1970. Timestamps stay milliseconds here.
const rows = async (sql, args = []) => {
	const result = await crate.execute(sql, args)
	return result.rows.map((row) =>
		Object.fromEntries(result.cols.map((col, i) => [col, row[i]])),
	)
}

const DAY = 86_400_000
const now = Date.now()
const since = now - days * DAY
const day = (at) =>
	at === null ? "none" : new Date(at).toISOString().slice(0, 10)
const minute = (at) => new Date(at).toISOString().slice(0, 16).replace("T", " ")
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2
}
const marks = (n) => Array.from({ length: n }, () => "?").join(", ")

// --- 1. The Watching shows ---------------------------------------------------------------------------------------

const watching = await rows(
	`SELECT user_id, tmdb_id, pass, state_changed_at FROM user_watch_state
	 WHERE media_type = 'show' AND state = 'watching' LIMIT 1000000`,
)
const log = await rows(
	`SELECT user_id, tmdb_id, pass,
	        count(DISTINCT season_number * 100000 + episode_number) FILTER (WHERE season_number > 0) AS episodes,
	        max(CASE WHEN watched_at IS NOT NULL THEN watched_at
	                 WHEN origin <> 'import' THEN created_at END) AS last_activity_at,
	        max(created_at) FILTER (WHERE origin = 'import') AS last_import_at,
	        count(*) FILTER (WHERE origin = 'import') AS imported,
	        count(*) AS watches
	 FROM user_watch_log WHERE media_type = 'show' GROUP BY user_id, tmdb_id, pass LIMIT 1000000`,
)
const largest = (a, b) => (a === null ? b : b === null ? a : Math.max(a, b))
const titles = new Map()
for (const row of log) {
	const key = `${row.user_id}|${row.tmdb_id}`
	const title = titles.get(key) ?? {
		activity: null,
		imported: null,
		importedRows: 0,
		watches: 0,
		episodes: new Map(),
	}
	titles.set(key, title)
	title.activity = largest(title.activity, row.last_activity_at)
	title.imported = largest(title.imported, row.last_import_at)
	title.importedRows += Number(row.imported)
	title.watches += Number(row.watches)
	title.episodes.set(Number(row.pass), Number(row.episodes))
}
const ids = [...new Set(watching.map((r) => Number(r.tmdb_id)))]
const aired = new Map()
for (let i = 0; i < ids.length; i += 500) {
	const batch = ids.slice(i, i + 500)
	for (const row of await rows(
		`SELECT tmdb_id, aired_episode_count FROM show WHERE tmdb_id IN (${marks(batch.length)})`,
		batch,
	))
		aired.set(Number(row.tmdb_id), row.aired_episode_count)
}

const shows = watching.map((row) => {
	const title = titles.get(`${row.user_id}|${row.tmdb_id}`)
	const count = aired.get(Number(row.tmdb_id)) ?? null
	const watched = title?.episodes.get(Number(row.pass)) ?? 0
	return {
		member: row.user_id,
		id: Number(row.tmdb_id),
		changed: Number(row.state_changed_at),
		activity: title?.activity ?? null,
		imported: title?.imported ?? null,
		importedRows: title?.importedRows ?? 0,
		watches: title?.watches ?? 0,
		// As planMyShows: a Watching show with every aired episode watched waits, and is in neither group.
		next: count === null || count - Math.min(watched, count) > 0,
	}
})
const recent = shows.filter((s) => s.changed >= since)
console.log("1. Watching shows")
console.log(
	`   ${shows.length} Watching shows of ${new Set(shows.map((s) => s.member)).size} members; ${shows.filter((s) => s.next).length} have a Next episode`,
)
console.log(
	`   state changed in the last ${days} days: ${recent.length}, of ${new Set(recent.map((s) => s.member)).size} members`,
)

// --- 2. What the rule moves --------------------------------------------------------------------------------------

const older = (s) => s.next && (s.activity === null || s.activity < since)
const byImport = (s) => s.imported !== null && s.changed <= s.imported
const olderToday = shows.filter(older)
const moved = olderToday.filter((s) => s.changed >= since)
console.log(
	`2. No watch activity in the last ${days} days, with a Next episode`,
)
console.log(
	`   ${olderToday.length} shows of ${new Set(olderToday.map((s) => s.member)).size} members`,
)
console.log(
	`   of them, state changed in the last ${days} days: ${moved.length}, of ${new Set(moved.map((s) => s.member)).size} members`,
)
console.log(
	`   of those, an import made the show Watching: ${moved.filter(byImport).length}; the member did: ${moved.filter((s) => !byImport(s)).length}`,
)
for (const s of moved)
	console.log(
		`     show ${s.id}: state changed ${minute(s.changed)}, last watch activity ${day(s.activity)}, latest imported watch recorded ${s.imported === null ? "none" : minute(s.imported)}, ${s.watches} watches (${s.importedRows} imported)`,
	)
const everByImport = shows.filter(byImport)
console.log(
	`   over all Watching shows, an import made the show Watching: ${everByImport.length}; of them in the last ${days} days: ${everByImport.filter((s) => s.changed >= since).length}`,
)
const withImports = shows.filter((s) => s.imported !== null)
console.log(
	`   Watching shows with an imported watch: ${withImports.length}; the member changed the state after the latest of them: ${withImports.filter((s) => !byImport(s)).length}`,
)

// --- 3. Many shows at one moment ---------------------------------------------------------------------------------

const moments = new Map()
for (const s of shows) {
	const key = `${s.member}|${Math.floor(s.changed / 60_000)}`
	moments.set(key, [...(moments.get(key) ?? []), s])
}
const bulk = [...moments.values()].filter((group) => group.length >= 5)
console.log("3. One member, one minute, five or more shows made Watching")
console.log(`   ${bulk.length} such moments`)
for (const group of bulk.sort((a, b) => b[0].changed - a[0].changed))
	console.log(
		`     ${minute(group[0].changed)}: ${group.length} shows, ${group.filter(byImport).length} by an import by the rule, ${group.filter((s) => s.importedRows > 0).length} with imported watches`,
	)
const months = new Map()
for (const s of shows) {
	const month = new Date(s.changed).toISOString().slice(0, 7)
	months.set(month, (months.get(month) ?? 0) + 1)
}
console.log(
	`   Watching shows by the month the state changed: ${[...months]
		.sort()
		.map(([month, n]) => `${month} ${n}`)
		.join(", ")}`,
)

// --- 4. One show -------------------------------------------------------------------------------------------------

const one = shows.filter((s) => s.id === showId)
console.log(`4. Show ${showId}, Watching for ${one.length} member(s)`)
for (const s of one) {
	const origins = await rows(
		`SELECT origin, pass, count(*) AS n, min(created_at) AS first_recorded, max(created_at) AS last_recorded,
		        max(watched_at) AS last_dated
		 FROM user_watch_log WHERE user_id = ? AND tmdb_id = ? AND media_type = 'show'
		 GROUP BY origin, pass ORDER BY origin, pass`,
		[s.member, s.id],
	)
	console.log(
		`   state changed ${minute(s.changed)}, last watch activity ${day(s.activity)}, Next episode ${s.next ? "yes" : "no"}`,
	)
	for (const row of origins)
		console.log(
			`     ${row.n} watches of origin ${row.origin}, pass ${row.pass}: recorded ${day(row.first_recorded)} to ${day(row.last_recorded)}, latest date ${day(row.last_dated)}`,
		)
	console.log(
		`   by its watches alone: ${older(s) ? "Pick up" : s.next ? "Continue" : "Waiting for episodes"}; with the member's move to Watching: ${
			s.next
				? (s.activity !== null && s.activity >= since) ||
					(s.changed >= since && !byImport(s))
					? "Continue"
					: "Pick up"
				: "Waiting for episodes"
		}`,
	)
}

// --- 5. The grouped query ----------------------------------------------------------------------------------------

const [most] = await rows(
	"SELECT user_id, count(*) AS n FROM user_watch_log GROUP BY user_id ORDER BY n DESC LIMIT 1",
)
const BEFORE = GROUPED_QUERY.replace(
	/,\s*max\(created_at\) FILTER \(WHERE origin = 'import'\) AS last_import_at/,
	"",
)
const WITH = BEFORE.replace(
	"AS last_activity_at",
	"AS last_activity_at,\n       max(created_at) FILTER (WHERE origin = 'import') AS last_import_at",
)
const timings = { before: [], with: [] }
let groups = 0
for (let i = 0; i <= runs; i++) {
	for (const [name, sql] of [
		["before", BEFORE],
		["with", WITH],
	]) {
		const started = performance.now()
		groups = (await rows(sql, [most.user_id])).length
		// The first run warms up.
		if (i > 0) timings[name].push(performance.now() - started)
	}
}
console.log(
	`5. The grouped query for the member with the most watches (${most.n} watches, ${groups} groups), ${runs} runs`,
)
console.log(
	`   as it was: median ${median(timings.before).toFixed(0)} ms, slowest ${Math.max(...timings.before).toFixed(0)} ms`,
)
console.log(
	`   with the latest imported watch: median ${median(timings.with).toFixed(0)} ms, slowest ${Math.max(...timings.with).toFixed(0)} ms`,
)
process.exit(0)
