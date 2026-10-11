// Measures what "Waiting for episodes" on My shows has to read to say when each show's next episode airs (#442).
// Read-only: SELECT statements and nothing else, and no member id is printed.
//
// 1. How many waiting shows members have: a Seen show that is still running with nothing new, or a Watching show
//    with every aired episode watched (planMyShows in app/domain/my-shows.ts).
// 2. What the next air dates cost for the member with the most waiting shows, two ways: the whole episode list of
//    each show, one statement a show (what a cold `getEpisodeList` sends), and Q8, one statement for all of them
//    that asks only for the dated episodes to come (what My shows sends).
// 3. How often the catalog holds a dated next episode for the shows members wait for, and how often only an
//    episode without a date.
//
// Run from goodwatch-webapp:
//   node --env-file=.env scripts/measure-waiting-shows.mjs [runs]
import { createRequire } from "node:module"
import {
	EPISODE_LIST_QUERY,
	upcomingEpisodesQuery,
} from "../app/server/tracking-sql.ts"

const runs = Number.parseInt(process.argv[2] ?? "15", 10)
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
const rows = async (sql, args = []) => (await crate.execute(sql, args)).json

const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2
}
const quantile = (values, q) => {
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}
const ms = (value) => `${value.toFixed(0)} ms`
const percent = (n, of) => `${n} (${of ? Math.round((100 * n) / of) : 0}%)`
const marks = (n) => Array.from({ length: n }, () => "?").join(", ")

// --- 1. The members' shows, as My shows groups them ---------------------------------------------------------------

const states = await rows(
	`SELECT user_id, tmdb_id, state, pass FROM user_watch_state
	 WHERE media_type = 'show' AND state IN ('seen', 'watching') LIMIT 1000000`,
)
const watched = await rows(
	`SELECT user_id, tmdb_id, pass,
	        count(DISTINCT season_number * 100000 + episode_number) FILTER (WHERE season_number > 0) AS episodes
	 FROM user_watch_log WHERE media_type = 'show' GROUP BY user_id, tmdb_id, pass LIMIT 1000000`,
)
const watchedOf = new Map(
	watched.map((r) => [
		`${r.user_id}|${r.tmdb_id}|${r.pass}`,
		Number(r.episodes),
	]),
)
const showIds = [...new Set(states.map((r) => Number(r.tmdb_id)))]
const catalog = new Map()
for (let i = 0; i < showIds.length; i += 500) {
	const batch = showIds.slice(i, i + 500)
	for (const row of await rows(
		`SELECT tmdb_id, status, aired_episode_count, episodes_updated_at FROM show WHERE tmdb_id IN (${marks(batch.length)})`,
		batch,
	))
		catalog.set(Number(row.tmdb_id), row)
}
const running = (status) =>
	Boolean(status) && status !== "Ended" && status !== "Canceled"

const members = new Map()
for (const row of states) {
	const show = catalog.get(Number(row.tmdb_id))
	const member = members.get(row.user_id) ?? { waiting: [], left: 0, shows: 0 }
	members.set(row.user_id, member)
	member.shows++
	const aired = show?.aired_episode_count ?? null
	const seen = Math.min(
		watchedOf.get(`${row.user_id}|${row.tmdb_id}|${row.pass}`) ?? 0,
		aired ?? Number.MAX_SAFE_INTEGER,
	)
	const left = aired === null ? 0 : aired - seen
	if (left > 0) member.left++
	else if (
		row.state === "seen" ? running(show?.status) : aired !== null && left === 0
	)
		member.waiting.push(Number(row.tmdb_id))
}
const counts = [...members.values()].map((m) => m.waiting.length)
const withAny = counts.filter((n) => n > 0)
console.log("1. Waiting shows per member")
console.log(
	`   ${members.size} members have a Watching or Seen show; ${withAny.length} of them have a waiting show`,
)
console.log(
	`   among those: median ${median(withAny)}, 90th percentile ${quantile(withAny, 0.9)}, most ${Math.max(0, ...withAny)}`,
)
console.log(
	`   members with more than 30 waiting shows: ${counts.filter((n) => n > 30).length}; more than 100: ${counts.filter((n) => n > 100).length}`,
)

// --- 2. What the next air dates cost -----------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10)
const midnight = Date.parse(`${today}T00:00:00Z`)
const largest = [...members.values()].sort(
	(a, b) => b.waiting.length - a.waiting.length,
)[0]
const typical = [...members.values()]
	.filter((m) => m.waiting.length === Math.round(median(withAny)))
	.at(0)

async function time(label, shows) {
	if (!shows.length) return
	const perShow = []
	const together = []
	let listRows = 0
	let upcomingRows = 0
	for (let i = 0; i <= runs; i++) {
		let started = performance.now()
		const lists = await Promise.all(
			shows.map((id) => rows(EPISODE_LIST_QUERY, [id])),
		)
		const a = performance.now() - started
		started = performance.now()
		const upcoming = await rows(upcomingEpisodesQuery(shows.length), [
			...shows,
			midnight,
		])
		const b = performance.now() - started
		// The first run warms up.
		if (i === 0) continue
		perShow.push(a)
		together.push(b)
		listRows = lists.reduce((n, list) => n + list.length, 0)
		upcomingRows = upcoming.length
	}
	console.log(`   ${label}: ${shows.length} waiting shows, ${runs} runs`)
	console.log(
		`     one episode list a show, all at once: median ${ms(median(perShow))}, slowest ${ms(Math.max(...perShow))}, ${listRows} rows`,
	)
	console.log(
		`     one statement for all:                median ${ms(median(together))}, slowest ${ms(Math.max(...together))}, ${upcomingRows} rows`,
	)
}
console.log("2. Reading the next air dates, as the client sees it")
await time("the member with the most", largest.waiting)
if (typical) await time("a typical member", typical.waiting)

// --- 3. How often the catalog knows the next episode's date --------------------------------------------------------

const waitingShows = [
	...new Set([...members.values()].flatMap((m) => m.waiting)),
]
const firstUpcoming = new Map()
for (let i = 0; i < waitingShows.length; i += 500) {
	const batch = waitingShows.slice(i, i + 500)
	// Q8 leaves out the episodes without a date; here they are counted.
	for (const row of await rows(
		`SELECT show_id, air_date FROM episode
		 WHERE show_id IN (${marks(batch.length)}) AND season_number > 0 AND removed_at IS NULL
		   AND (air_date > ? OR air_date IS NULL) LIMIT 100000`,
		[...batch, midnight],
	)) {
		const id = Number(row.show_id)
		const dated = row.air_date !== null
		const known = firstUpcoming.get(id)
		// A dated episode is the answer; an undated one only says that something is listed.
		if (!known || (dated && !known.dated))
			firstUpcoming.set(id, { dated, at: row.air_date })
		else if (dated && known.dated && row.air_date < known.at)
			firstUpcoming.set(id, { dated, at: row.air_date })
	}
}
const dated = [...firstUpcoming.values()].filter((u) => u.dated)
const undated = [...firstUpcoming.values()].filter((u) => !u.dated)
const days = dated.map((u) => Math.round((Number(u.at) - midnight) / 86_400_000))
const visits = [...members.values()].flatMap((m) => m.waiting)
const visitsDated = visits.filter((id) => firstUpcoming.get(id)?.dated).length
const stale = waitingShows.filter((id) => {
	const at = catalog.get(id)?.episodes_updated_at
	return !at || midnight - Number(at) > 7 * 86_400_000
}).length
console.log("3. The next episode in the catalog, for the shows members wait for")
console.log(`   ${waitingShows.length} different waiting shows`)
console.log(
	`   a dated episode to come: ${percent(dated.length, waitingShows.length)}`,
)
console.log(
	`   only an episode without a date: ${percent(undated.length, waitingShows.length)}`,
)
console.log(
	`   no episode to come listed: ${percent(waitingShows.length - firstUpcoming.size, waitingShows.length)}`,
)
if (days.length)
	console.log(
		`   the dated ones air in: median ${median(days)} days, within 7 days ${days.filter((d) => d <= 7).length}, within 30 days ${days.filter((d) => d <= 30).length}`,
	)
console.log(
	`   of all waiting rows across members (${visits.length}), rows with a date: ${percent(visitsDated, visits.length)}`,
)
console.log(
	`   waiting shows whose episodes were last copied more than 7 days ago, or never: ${percent(stale, waitingShows.length)}`,
)
process.exit(0)
