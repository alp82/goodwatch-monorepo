// Drives the season, episode and part score controls (EpisodeScore.tsx) in a DOM, for EpisodeScore.test.ts: what
// they show unscored and scored, the picker they open, what they send, and that a press in the season's picker never
// closes the season. Prints one JSON line after __EPISODE_SCORE_UI__.
import { Window } from "happy-dom"
const window = new Window({ url: "https://goodwatch.app/show/1-slow-horses" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLButtonElement",
	"Element",
	"Node",
	"Event",
	"MouseEvent",
	"KeyboardEvent",
	"getComputedStyle",
	"matchMedia",
	"ResizeObserver",
	"requestAnimationFrame",
	"cancelAnimationFrame",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
// The dialog fades in; the DOM stand-in has no animations to run.
;(
	window.HTMLElement.prototype as unknown as { animate: () => object }
).animate = () => ({ cancel() {}, finished: Promise.resolve() })
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { EpisodeScoreFrame, SeasonScoreButton, PartScoreLine } = await import(
	"./EpisodeScore"
)
const { EpisodeScoreStore } = await import("./episode-score-store")
import type { MemberEpisodeScore } from "~/domain/episode-scores"

const sent: unknown[] = []
const store = new EpisodeScoreStore(async (body) => {
	sent.push(body)
	const request = body as {
		scope: string
		season?: number
		episodeId?: number
		score: number | null
	}
	const at = "2026-10-01T00:00:00.000Z"
	return {
		status: request.score === null ? "cleared" : "saved",
		previous: null,
		score:
			request.score === null
				? null
				: request.scope === "season"
					? {
							scope: "season",
							season: request.season ?? 0,
							key: `s${request.season}`,
							score: request.score,
							label: null,
							updatedAt: at,
						}
					: {
							scope: "episode",
							season: 1,
							episode: 3,
							episodeTmdbId: request.episodeId ?? 0,
							key: `e${request.episodeId}`,
							score: request.score,
							label: null,
							updatedAt: at,
						},
	}
})
const part: MemberEpisodeScore = {
	scope: "part",
	season: 1,
	ranges: [{ season: 1, firstEpisode: 1, lastEpisode: 12 }],
	key: "p:s1e1-12",
	score: 8,
	label: "Spy x Family",
	updatedAt: "2026-10-01T00:00:00.000Z",
}
store.seed([part])
let closes = 0
const container = document.createElement("div")
document.body.append(container)
const root = createRoot(container)
const draw = () =>
	root.render(
		createElement(
			"div",
			null,
			createElement(EpisodeScoreFrame, {
				store,
				target: {
					scope: "episode",
					season: 1,
					episode: 3,
					episodeTmdbId: 62087,
				},
				scoreKey: "e62087",
				name: "S1 E3",
				title: "S1 E3 · Bad Tradecraft",
				ask: "Rate this episode",
			}),
			// The season head closes the season on any press inside it.
			createElement(
				"div",
				{ "data-head": true, onClick: () => closes++ },
				createElement(SeasonScoreButton, {
					store,
					target: { scope: "season", season: 2 },
					scoreKey: "s2",
					name: "Season 2",
					title: "Season 2 · Slow Horses",
					onPress: (event: { stopPropagation: () => void }) =>
						event.stopPropagation(),
				}),
			),
			createElement(PartScoreLine, {
				store,
				target: part,
				scoreKey: part.key,
				part,
				name: "S1 E1–12",
				title: "S1 E1–12 · Spy x Family",
			}),
		),
	)
store.subscribe(() => draw())
await act(async () => draw())
const settle = async () => {
	for (let i = 0; i < 5; i++)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
}
const text = (el: Element | null) =>
	el?.textContent?.replace(/\s+/g, " ").trim()
const frame = () => container.querySelector("[data-episode-score]")
const result: Record<string, unknown> = {}
result.unscored = {
	frame: frame()?.getAttribute("data-episode-score"),
	text: text(frame()),
	label: frame()?.querySelector("button")?.getAttribute("aria-label"),
	season: container
		.querySelector("[data-season-own-score]")
		?.getAttribute("aria-label"),
	part: text(container.querySelector("[data-part-score]")),
}
// Rate the episode 9 through the picker.
await act(async () => frame()?.querySelector("button")?.click())
await settle()
const dialog = () => document.querySelector("[data-score-dialog]")
result.dialogTitle = text(dialog()?.querySelector("h2") ?? null)
await act(async () =>
	dialog()?.querySelector<HTMLButtonElement>('[data-give="9"]')?.click(),
)
await settle()
result.scored = {
	frame: frame()?.getAttribute("data-episode-score"),
	text: text(frame()),
	dialogOpen: Boolean(dialog()),
}
// Clear it again.
await act(async () => frame()?.querySelector("button")?.click())
await settle()
await act(async () =>
	dialog()?.querySelector<HTMLButtonElement>("[data-clear-score]")?.click(),
)
await settle()
result.cleared = frame()?.getAttribute("data-episode-score")
// The season: a score given in its picker doesn't close the season.
await act(async () =>
	container
		.querySelector<HTMLButtonElement>("[data-season-own-score]")
		?.click(),
)
await settle()
await act(async () =>
	dialog()?.querySelector<HTMLButtonElement>('[data-give="7"]')?.click(),
)
await settle()
result.season = {
	shown: container
		.querySelector("[data-season-own-score]")
		?.getAttribute("data-season-own-score"),
	closes,
}
result.sent = sent
process.stdout.write(`__EPISODE_SCORE_UI__${JSON.stringify(result)}`)
process.exit(0)
