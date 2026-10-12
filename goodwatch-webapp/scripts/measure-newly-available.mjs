// Measures what "newly available on your services" (#456) has to read to say when a member's title first appeared
// on one of their services. Read-only: SELECT statements and nothing else, and no member id is printed.
//
// 1. How many titles members have that can arrive: Want to See titles, and shows they are Watching or have On hold.
// 2. What reading the first-appearance times costs at request time, for the member with the most such titles: one
//    statement for all of them, in three shapes.
// 3. What carrying those times in the in-memory availability index costs instead: the index's load statement as it
//    is, and the shapes that add `created_at`, by the time Crate takes, the bytes sent and the time `JSON.parse`
//    holds the event loop.
// 4. How many offers first appeared a day, and how many arrivals members would have been told about.
//
// Run from goodwatch-webapp:
//   node --env-file=.env scripts/measure-newly-available.mjs [runs]
const runs = Number.parseInt(process.argv[2] ?? "15", 10)
if (!process.env.CRATE_HOSTS) throw new Error("CRATE_HOSTS is not set")

const host = process.env.CRATE_HOSTS.split(",")[0]
const endpoint = `http://${host}:${process.env.CRATE_PORT || 4200}/_sql`
const authorization = `Basic ${Buffer.from(`${process.env.CRATE_USER}:${process.env.CRATE_PASS}`).toString("base64")}`

/** One statement: its rows as arrays, the time until the answer was here, its size, and the time to parse it. */
async function sql(stmt, args = []) {
	if (!/^\s*SELECT\b/i.test(stmt)) throw new Error("Read-only: SELECT only")
	const started = performance.now()
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: authorization,
		},
		body: JSON.stringify({ stmt, args }),
	})
	const text = await response.text()
	const ms = performance.now() - started
	if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 400)}`)
	const parseStarted = performance.now()
	const body = JSON.parse(text)
	return {
		rows: body.rows,
		ms,
		bytes: text.length,
		parseMs: performance.now() - parseStarted,
	}
}

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
const marks = (n) => Array.from({ length: n }, () => "?").join(", ")
const TYPES = ["flatrate", "free", "ads"]
// utils/streaming-links.ts, duplicateProviderMapping: a saved service stands for its duplicates.
const DUPLICATES = { 2: [350], 9: [10, 119] }
const expand = (ids) => [
	...new Set(ids.flatMap((id) => [id, ...(DUPLICATES[id] ?? [])])),
]

async function timed(label, stmt, args, times = runs) {
	const took = []
	const parsed = []
	let last
	for (let i = 0; i < times; i++) {
		last = await sql(stmt, args)
		took.push(last.ms)
		parsed.push(last.parseMs)
	}
	console.log(
		`  ${label}: median ${median(took).toFixed(0)} ms (${Math.min(...took).toFixed(0)} to ${Math.max(...took).toFixed(0)}), ` +
			`${last.rows.length} rows, ${(last.bytes / 1024).toFixed(1)} KB, parse ${median(parsed).toFixed(1)} ms`,
	)
	return last
}

// --- 0. The table ---------------------------------------------------------------------------------------------------

const columns = await sql(
	`SELECT column_name, data_type FROM information_schema.columns
	 WHERE table_name = 'streaming_availability' ORDER BY ordinal_position`,
)
console.log("streaming_availability:")
console.log(
	`  ${columns.rows.map(([name, type]) => `${name} ${type}`).join(", ")}`,
)
const [[total, subscription, withoutTime]] = (
	await sql(
		`SELECT count(*), count(*) FILTER (WHERE streaming_type IN ('flatrate', 'free', 'ads')),
		        count(*) FILTER (WHERE created_at IS NULL)
		 FROM streaming_availability`,
	)
).rows
console.log(
	`  ${total} rows, ${subscription} of them flatrate, free or ads, ${withoutTime} without created_at`,
)

// --- 1. The members' titles -----------------------------------------------------------------------------------------

const wishlist = (
	await sql(
		"SELECT user_id, media_type, tmdb_id, created_at FROM user_wishlist LIMIT 1000000",
	)
).rows
const states = (
	await sql(
		`SELECT user_id, tmdb_id, state FROM user_watch_state
		 WHERE media_type = 'show' AND state IN ('watching', 'on_hold') LIMIT 1000000`,
	)
).rows
const settings = (
	await sql(
		`SELECT user_id, key, value FROM user_setting
		 WHERE key IN ('country_default', 'streaming_providers_default') LIMIT 1000000`,
	)
).rows

/** Per member: the titles that can arrive, with when a Want to See title was added. */
const members = new Map()
const memberOf = (id) => {
	let member = members.get(id)
	if (!member) {
		member = { titles: new Map(), country: null, services: [] }
		members.set(id, member)
	}
	return member
}
for (const [user, type, id, added] of wishlist)
	memberOf(user).titles.set(
		`${type === "show" ? "show" : "movie"}-${id}`,
		added,
	)
for (const [user, id] of states) {
	const titles = memberOf(user).titles
	// A Watching or On hold show counts from the start: it has no time it was added.
	titles.set(`show-${id}`, 0)
}
for (const [user, key, value] of settings) {
	const member = members.get(user)
	if (!member) continue
	if (key === "country_default") {
		const code = String(value ?? "")
			.trim()
			.toUpperCase()
		member.country = /^[A-Z]{2}$/.test(code) ? code : null
	} else
		member.services = expand(
			String(value ?? "")
				.split(",")
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0),
		)
}
const all = [...members.values()].filter((member) => member.titles.size)
const reachable = all.filter(
	(member) => member.country && member.services.length,
)
const sizes = (list) => list.map((member) => member.titles.size)
const spread = (list) =>
	list.length
		? `median ${median(sizes(list))}, 90th percentile ${quantile(sizes(list), 0.9)}, most ${Math.max(...sizes(list))}`
		: "none"
console.log(
	"\nMembers with a Want to See title, or a Watching or On hold show:",
)
console.log(`  ${all.length} members: ${spread(all)}`)
console.log(
	`  ${reachable.length} of them have a country and a saved service: ${spread(reachable)}`,
)
console.log(
	`  without a saved country: ${all.filter((m) => !m.country).length}, without a saved service: ${all.filter((m) => !m.services.length).length}`,
)
const countries = new Map()
for (const member of reachable)
	countries.set(member.country, (countries.get(member.country) ?? 0) + 1)
const byMembers = [...countries].sort((a, b) => b[1] - a[1])
console.log(
	`  countries: ${byMembers.length}; ${byMembers
		.slice(0, 6)
		.map(([country, n]) => `${country} ${n}`)
		.join(", ")}`,
)

// --- 2. At request time: one statement for all of a member's titles -------------------------------------------------

const largest = [...reachable].sort((a, b) => b.titles.size - a.titles.size)[0]
const idsOf = (member, type) =>
	[...member.titles.keys()]
		.filter((key) => key.startsWith(`${type}-`))
		.map((key) => Number(key.split("-")[1]))
const titlesWhere = (movies, shows) =>
	[
		movies.length
			? `(media_type = 'movie' AND media_tmdb_id IN (${marks(movies.length)}))`
			: null,
		shows.length
			? `(media_type = 'show' AND media_tmdb_id IN (${marks(shows.length)}))`
			: null,
	]
		.filter(Boolean)
		.join(" OR ")

async function requestTime(label, member, services) {
	const movies = idsOf(member, "movie")
	const shows = idsOf(member, "show")
	const where = `country_code = ? AND streaming_type IN (?, ?, ?)
		 AND streaming_service_id IN (${marks(services.length)})
		 AND (${titlesWhere(movies, shows)})`
	const args = [member.country, ...TYPES, ...services, ...movies, ...shows]
	console.log(
		`\n${label}: ${movies.length} movies, ${shows.length} shows, ${services.length} service ids (duplicates included)`,
	)
	await timed(
		"a statement that returns one row (the round trip)",
		"SELECT 1",
		[],
	)
	await timed(
		"every qualifying row",
		`SELECT media_type, media_tmdb_id, streaming_service_id, created_at
		 FROM streaming_availability WHERE ${where} LIMIT 20000`,
		args,
	)
	await timed(
		"the earliest time per title and service",
		`SELECT media_type, media_tmdb_id, streaming_service_id, min(created_at)
		 FROM streaming_availability WHERE ${where}
		 GROUP BY media_type, media_tmdb_id, streaming_service_id LIMIT 20000`,
		args,
	)
	return timed(
		"the earliest time per title",
		`SELECT media_type, media_tmdb_id, min(created_at)
		 FROM streaming_availability WHERE ${where}
		 GROUP BY media_type, media_tmdb_id LIMIT 20000`,
		args,
	)
}

if (largest) {
	await requestTime(
		"At request time, the member with the most titles",
		largest,
		largest.services,
	)
	// The same list with the services most members have saved, should the largest member have saved few.
	const common = new Map()
	for (const member of reachable)
		for (const service of member.services)
			common.set(service, (common.get(service) ?? 0) + 1)
	const top = [...common]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 12)
		.map(([service]) => service)
	await requestTime(
		"The same titles with the 12 service ids most members saved",
		largest,
		top,
	)
}

// --- 3. In the availability index: what its load would read ---------------------------------------------------------

const DAY_MS = 86_400_000
const now = Date.now()
for (const country of [
	"US",
	...(largest && largest.country !== "US" ? [largest.country] : []),
]) {
	console.log(`\nThe index's load for ${country} (3 runs each):`)
	const base = [country, ...TYPES]
	const current = await timed(
		"as it is, services per title",
		`SELECT media_type, media_tmdb_id, collect_set(streaming_service_id)
		 FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN (?, ?, ?)
		 GROUP BY media_type, media_tmdb_id`,
		base,
		3,
	)
	const entries = current.rows.reduce((sum, row) => sum + row[2].length, 0)
	console.log(`    ${entries} entries of a title and a service`)
	await timed(
		"with the times, two lists per title",
		`SELECT media_type, media_tmdb_id, array_agg(streaming_service_id), array_agg(created_at)
		 FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN (?, ?, ?)
		 GROUP BY media_type, media_tmdb_id`,
		base,
		3,
	)
	await timed(
		"with the times, one row per title and service",
		`SELECT media_type, media_tmdb_id, streaming_service_id, min(created_at)
		 FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN (?, ?, ?)
		 GROUP BY media_type, media_tmdb_id, streaming_service_id`,
		base,
		3,
	)
	for (const days of [7, 30, 90]) {
		await timed(
			`beside it, only the rows of the last ${days} days`,
			`SELECT media_type, media_tmdb_id, streaming_service_id, min(created_at)
			 FROM streaming_availability
			 WHERE country_code = ? AND streaming_type IN (?, ?, ?) AND created_at > ?
			 GROUP BY media_type, media_tmdb_id, streaming_service_id`,
			[...base, now - days * DAY_MS],
			3,
		)
	}
	// As built (app/server/availability-first-seen.server.ts), for the last seven days: the titles with an offer
	// that first appeared since, then every subscription offer of those titles, a thousand titles a statement.
	const recent = await timed(
		"as built, 1: the titles with an offer of the last 7 days",
		`SELECT DISTINCT media_type, media_tmdb_id
		 FROM streaming_availability
		 WHERE country_code = ? AND streaming_type IN (?, ?, ?) AND created_at > ?
		 LIMIT 20001`,
		[...base, now - 7 * DAY_MS],
		5,
	)
	for (const type of ["movie", "show"]) {
		const ids = recent.rows
			.filter((row) => row[0] === type)
			.map((row) => row[1])
		for (let i = 0; i < ids.length; i += 1000) {
			const batch = ids.slice(i, i + 1000)
			await timed(
				`as built, 2: every offer of ${batch.length} of those ${type}s`,
				`SELECT media_tmdb_id, streaming_service_id, min(created_at)
				 FROM streaming_availability
				 WHERE country_code = ? AND streaming_type IN (?, ?, ?) AND media_type = ?
				   AND media_tmdb_id IN (${marks(batch.length)})
				 GROUP BY media_tmdb_id, streaming_service_id
				 LIMIT 1000000`,
				[...base, type, ...batch],
				5,
			)
		}
	}
}

// --- 4. How much is new ---------------------------------------------------------------------------------------------

const perDay = (
	await sql(
		`SELECT date_trunc('day', created_at) AS day, count(*), count(DISTINCT media_tmdb_id)
		 FROM streaming_availability
		 WHERE streaming_type IN ('flatrate', 'free', 'ads') AND created_at > ?
		 GROUP BY 1 ORDER BY 1`,
		[now - 45 * DAY_MS],
	)
).rows
console.log(
	"\nSubscription offers by the day they first appeared, last 45 days (rows, titles):",
)
for (const [day, rows, titles] of perDay)
	console.log(
		`  ${new Date(day).toISOString().slice(0, 10)}  ${rows}  ${titles}`,
	)

// What members would have been told: per member, the earliest time among the title's qualifying rows on their
// services, read with one statement per country for all members' titles of that country.
const arrivals = []
for (const [country] of byMembers) {
	const inCountry = reachable.filter((member) => member.country === country)
	const movies = [...new Set(inCountry.flatMap((m) => idsOf(m, "movie")))]
	const shows = [...new Set(inCountry.flatMap((m) => idsOf(m, "show")))]
	const first = new Map()
	for (const [type, ids] of [
		["movie", movies],
		["show", shows],
	])
		for (let i = 0; i < ids.length; i += 2000) {
			const batch = ids.slice(i, i + 2000)
			const { rows } = await sql(
				`SELECT media_tmdb_id, streaming_service_id, min(created_at)
				 FROM streaming_availability
				 WHERE country_code = ? AND streaming_type IN (?, ?, ?) AND media_type = ?
				   AND media_tmdb_id IN (${marks(batch.length)})
				 GROUP BY media_tmdb_id, streaming_service_id LIMIT 1000000`,
				[country, ...TYPES, type, ...batch],
			)
			for (const [id, service, at] of rows) {
				const key = `${type}-${id}`
				if (!first.has(key)) first.set(key, new Map())
				first.get(key).set(service, at)
			}
		}
	for (const member of inCountry)
		for (const [key, added] of member.titles) {
			const offers = first.get(key)
			if (!offers) continue
			let earliest = null
			for (const service of member.services) {
				const at = offers.get(service)
				if (at !== undefined && (earliest === null || at < earliest))
					earliest = at
			}
			if (earliest !== null) arrivals.push({ at: earliest, added: added ?? 0 })
		}
}
console.log(
	`\nTitles of members that are on one of their services today: ${arrivals.length}`,
)
const weeks = new Map()
for (const { at, added } of arrivals) {
	if (at < now - 56 * DAY_MS) continue
	const week = new Date(at - ((new Date(at).getUTCDay() + 6) % 7) * DAY_MS)
		.toISOString()
		.slice(0, 10)
	const entry = weeks.get(week) ?? { landed: 0, afterAdding: 0 }
	entry.landed++
	// An arrival is news only for a title the member already had.
	if (at > added) entry.afterAdding++
	weeks.set(week, entry)
}
console.log(
	"By the week (from Monday) their first offer appeared, last 8 weeks:",
)
console.log("  week         landed  of them after the member had the title")
for (const [week, { landed, afterAdding }] of [...weeks].sort())
	console.log(
		`  ${week}   ${String(landed).padStart(5)}  ${String(afterAdding).padStart(5)}`,
	)
