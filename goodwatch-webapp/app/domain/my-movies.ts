// My movies (#385): the Want to See movies under the sort, the moods, On my services and the time the person has.
// This is what the page adds to Watch next's rules (domain/watch-next.ts): "How long?", the fourth choice of the
// control strip, and the one group for what does not fit tonight. Pure and shared by the server and the browser.

/** The limits "How long?" offers, in minutes. The URL carries one as `time=120`; without it any length fits. */
export const TIME_CHOICES = [90, 120, 150] as const
export type TimeChoice = (typeof TIME_CHOICES)[number]

export function timeOf(value: string | null | undefined): TimeChoice | null {
	const minutes = Number(value)
	return (TIME_CHOICES as readonly number[]).includes(minutes)
		? (minutes as TimeChoice)
		: null
}

/** "2h 12m", "2h", "45 min". */
export function durationWords(minutes: number): string {
	if (minutes < 60) return `${minutes} min`
	const rest = minutes % 60
	return rest
		? `${Math.floor(minutes / 60)}h ${rest}m`
		: `${minutes / 60}h`
}

/** "Any length", "Up to 1h 30". */
export const timeLabel = (minutes: number | null) =>
	minutes === null
		? "Any length"
		: `Up to ${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}` : ""}`

/** By how many minutes a movie runs over the time the person has; 0 when it fits or its runtime is unknown. */
export const minutesOver = (runtime: number | null, limit: number | null) =>
	runtime && limit !== null && runtime > limit ? runtime - limit : 0

/** Why a movie is in "Not tonight's fit". */
export type Misfit =
	| { why: "time"; over: number }
	| { why: "mood" }
	| { why: "services" }

/** The first reason a movie does not fit tonight: the time, then the moods, then the services. Null: it fits. */
export function misfitOf(movie: {
	over: number
	inMood: boolean
	onServices: boolean
}): Misfit | null {
	if (movie.over > 0) return { why: "time", over: movie.over }
	if (!movie.inMood) return { why: "mood" }
	if (!movie.onServices) return { why: "services" }
	return null
}

export const misfitWords = (misfit: Misfit) =>
	misfit.why === "time"
		? `${durationWords(misfit.over)} over`
		: misfit.why === "mood"
			? "Another mood"
			: "Not on your services"
