// PROTOTYPE - throwaway. The watch model of /prototype/watch-log: one record per watch, as ADR 0008 stores it, kept in
// the browser. Nothing here reads or writes a server.

export type Precision = "moment" | "day" | "unknown"

export interface Watch {
	id: string
	/** "moment": an ISO time. "day": YYYY-MM-DD. "unknown": null. */
	at: string | null
	precision: Precision
	origin: "manual" | "import"
	/** The import source, for an imported watch. */
	source?: string
	/** When the watch was recorded here (ms). */
	created: number
}

export interface Film {
	id: string
	title: string
	year: number
	poster: string
	backdrop?: string
	/** What state the sample starts in. */
	sample: string
}

export type When = { precision: "moment" } | { precision: "day"; day: string } | { precision: "unknown" }

export type VariantKey = "A" | "B" | "C"
export type RemoveMode = "latest" | "all" | "log"
export type OrderMode = "dated" | "recorded"

export const FILMS: Film[] = [
	{ id: "dune2", title: "Dune: Part Two", year: 2024, poster: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", sample: "Never watched" },
	{ id: "parasite", title: "Parasite", year: 2019, poster: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", sample: "Watched once, today" },
	{ id: "matrix", title: "The Matrix", year: 1999, poster: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", sample: "Watched once, date unknown (imported)" },
	{
		id: "interstellar",
		title: "Interstellar",
		year: 2014,
		poster: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
		backdrop: "/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
		sample: "Watched three times: a moment, a day, unknown",
	},
]
/** The title at the top of Watch next. */
export const NEXT_FILM: Film = { id: "oppenheimer", title: "Oppenheimer", year: 2023, poster: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", sample: "On the Wishlist" }

const pad = (n: number) => String(n).padStart(2, "0")
export const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const today = () => dayOf(new Date())
export const daysAgo = (n: number) => dayOf(new Date(Date.now() - n * 86400000))

let serial = 0
export const newId = () => `w${Date.now().toString(36)}${serial++}`

export function makeWatch(when: When, origin: Watch["origin"] = "manual", source?: string): Watch {
	const at = when.precision === "moment" ? new Date().toISOString() : when.precision === "day" ? when.day : null
	return { id: newId(), at, precision: when.precision, origin, source, created: Date.now() }
}

export function seed(): Record<string, Watch[]> {
	const now = Date.now()
	const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString()
	const nineDaysAgo = new Date(now - 9 * 86400000)
	nineDaysAgo.setHours(21, 40, 0, 0)
	return {
		dune2: [],
		parasite: [{ id: "s1", at: hoursAgo(2), precision: "moment", origin: "manual", created: now - 2 * 3600000 }],
		matrix: [{ id: "s2", at: null, precision: "unknown", origin: "import", source: "IMDb", created: now - 20 * 86400000 }],
		interstellar: [
			{ id: "s3", at: nineDaysAgo.toISOString(), precision: "moment", origin: "manual", created: nineDaysAgo.getTime() },
			{ id: "s4", at: "2019-03-12", precision: "day", origin: "import", source: "Letterboxd", created: now - 20 * 86400000 },
			{ id: "s5", at: null, precision: "unknown", origin: "import", source: "IMDb", created: now - 20 * 86400000 - 1 },
		],
		oppenheimer: [],
	}
}

/** The watch's day as a sortable number; null when the date is unknown. */
const timeOf = (watch: Watch) => (watch.at == null ? null : watch.precision === "day" ? new Date(`${watch.at}T23:59:59`).getTime() : new Date(watch.at).getTime())

/**
 * "dated": watches with a date, newest first, then the ones without, in the order they were recorded.
 * "recorded": in the order they were recorded here, newest first, whatever their date.
 */
export function ordered(watches: Watch[], order: OrderMode): Watch[] {
	const byRecorded = (a: Watch, b: Watch) => b.created - a.created
	if (order === "recorded") return [...watches].sort(byRecorded)
	const dated = watches.filter((watch) => watch.at != null).sort((a, b) => (timeOf(b) ?? 0) - (timeOf(a) ?? 0) || byRecorded(a, b))
	return [...dated, ...watches.filter((watch) => watch.at == null).sort(byRecorded)]
}

/** The watch that pressing Seen again takes away in the "latest" mode: the one recorded last. */
export const lastRecorded = (watches: Watch[]) => [...watches].sort((a, b) => b.created - a.created)[0]

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

function dayLabel(day: string) {
	if (day === today()) return "Today"
	if (day === daysAgo(1)) return "Yesterday"
	return DAY.format(new Date(`${day}T12:00:00`))
}

/** The date as a row of the log shows it; the time only for a watch that has one. */
export function dateLabel(watch: Watch): { day: string; time?: string } {
	if (watch.at == null) return { day: "Date unknown" }
	if (watch.precision === "day") return { day: dayLabel(watch.at) }
	const at = new Date(watch.at)
	return { day: dayLabel(dayOf(at)), time: TIME.format(at) }
}

export function whenText(watch: Watch) {
	const label = dateLabel(watch)
	if (watch.at == null) return "date unknown"
	const day = label.day === "Today" || label.day === "Yesterday" ? label.day.toLowerCase() : `on ${label.day}`
	return label.time ? `${day}, ${label.time}` : day
}

/** "Watched 3 times, last on 27 Sep 2026" */
export function summary(watches: Watch[]) {
	if (!watches.length) return "Not watched yet"
	const dated = ordered(watches, "dated").find((watch) => watch.at != null)
	const count = watches.length === 1 ? "Watched once" : `Watched ${watches.length} times`
	if (!dated) return `${count}, date unknown`
	return `${count}, ${watches.length === 1 ? "" : "last "}${whenText(dated).replace(/, \d\d:\d\d$/, "")}`
}

export const TMDB = "https://image.tmdb.org/t/p"
