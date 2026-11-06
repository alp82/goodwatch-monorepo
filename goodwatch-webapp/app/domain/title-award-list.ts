// A title's reported award results as its page shows them: the "N awards" link at the end of the title page's meta
// row, and At a glance's Awards row, which lists every result by body. From TVDB's display view (server/title-awards.ts
// reads it; contract in docs/tvdb-pipelines.md, "Award quality and display contract"). Results belong to the title: a
// category in a year, never a person. A title without rows shows nothing; the link counts the reported wins (the
// owner's one exception to "no totals") and is left out without a win.
import { awardPrestige, shortAwardName } from "./award-marks.ts"

/** One reported result of the title. */
export interface TitleAwardResult {
	/** The body as TVDB names it: "Academy Awards". */
	award: string
	/** The category as TVDB names it: "Directing". */
	category: string
	/** The ceremony year. */
	year: string
	/** Reported as won; otherwise reported as a nomination. */
	won: boolean
}

/** The reported wins, which the meta row's link counts. */
export const awardWinCount = (results: readonly TitleAwardResult[]) =>
	results.reduce((n, r) => n + (r.won ? 1 : 0), 0)

/** "1 award", "37 awards"; null without a win, so the link is left out. */
export const awardsLinkLabel = (wins: number) =>
	wins > 0 ? `${wins} ${wins === 1 ? "award" : "awards"}` : null

/** TVDB's categories use dashes ("Best Motion Picture – Drama"); the page uses commas. */
export const categoryLabel = (category: string) =>
	category.replace(/\s+[–—-]\s+/g, ", ")

/** How notable a category is for the title: the title's own award first, then directing, writing, acting, crafts. */
export function categoryRank(category: string) {
	const c = category.toLowerCase()
	if (
		/^(best )?(motion )?picture\b|^best film\b|international feature|^best (foreign|international)[\w\s-]*film|grand prize/.test(
			c,
		) ||
		/^(best|outstanding) (television |tv )?((drama|comedy|limited|anthology|miniseries)[\w\s,]*)?series\b/.test(
			c,
		)
	)
		return 0
	if (/direct/.test(c)) return 1
	if (/writ|screenplay/.test(c)) return 2
	if (/act(or|ress|ing)|perform|ensemble|\bcast\b/.test(c)) return 3
	return 4
}

const yearOf = (r: TitleAwardResult) => Number(r.year) || 0

export interface BodyGroup {
	award: string
	/** Wins first, then the newest year, then the more notable category. */
	results: TitleAwardResult[]
	nominations: number
	from: number
	to: number
}

/** The results by body: bodies with a win first, then by prestige; in each, wins first, then newest. */
export function byBody(results: readonly TitleAwardResult[]): BodyGroup[] {
	const groups = new Map<string, TitleAwardResult[]>()
	for (const r of results) {
		const list = groups.get(r.award)
		if (list) list.push(r)
		else groups.set(r.award, [r])
	}
	return [...groups.entries()]
		.map(([award, list]) => {
			const sorted = [...list].sort(
				(a, b) =>
					Number(b.won) - Number(a.won) ||
					yearOf(b) - yearOf(a) ||
					categoryRank(a.category) - categoryRank(b.category) ||
					a.category.localeCompare(b.category, "en"),
			)
			const years = list.map(yearOf)
			return {
				award,
				results: sorted,
				nominations: list.filter((r) => !r.won).length,
				from: Math.min(...years),
				to: Math.max(...years),
			}
		})
		.sort(
			(a, b) =>
				Number(b.results[0].won) - Number(a.results[0].won) ||
				awardPrestige(a.award) - awardPrestige(b.award) ||
				a.award.localeCompare(b.award, "en"),
		)
}

/** A body with many results (more than 4 nominations and more than 10 rows) shows its wins, then one line that opens. */
export const foldsNominations = (group: BodyGroup) =>
	group.results.length > 10 && group.nominations > 4

/** "Show 7 nominations" */
export const nominationsLabel = (n: number) =>
	`Show ${n} ${n === 1 ? "nomination" : "nominations"}`

export const yearSpan = (from: number, to: number) =>
	from === to ? String(from) : `${from} to ${to}`

/** The four major bodies: a nomination there is named in the row's line even without a win. */
const MAJOR = new Set([
	"Academy Awards",
	"Primetime Emmy Awards",
	"Golden Globe Awards",
	"BAFTA Awards",
])

/**
 * At a glance's closed Awards row: "Oscar winner, Golden Globe winner, BAFTA nominee" (the bodies won, then major
 * bodies with only nominations, at most three), or "Nominated at the Critics' Choice Awards" without either.
 */
export function awardsRowValue(results: readonly TitleAwardResult[]) {
	const bodies = [...new Set(results.map((r) => r.award))].sort(
		(a, b) => awardPrestige(a) - awardPrestige(b),
	)
	const won = new Set(results.filter((r) => r.won).map((r) => r.award))
	const signals = [
		...bodies
			.filter((b) => won.has(b))
			.map((b) => `${shortAwardName(b)} winner`),
		...bodies
			.filter((b) => !won.has(b) && MAJOR.has(b))
			.map((b) => `${shortAwardName(b)} nominee`),
	].slice(0, 3)
	return signals.length
		? signals.join(", ")
		: `Nominated at the ${bodies.slice(0, 2).join(" and ")}`
}
