// Run by grid-size.test.ts through vite-node: renders the episode grid the way the show page's server does, for
// shows shaped like the real ones, and prints each one's HTML size, the estimate of it, and what the page keeps.
import { renderToString } from "react-dom/server"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import { packEpisodeGrid } from "~/utils/episode-grid-wire"
import EpisodeGrid from "./EpisodeGrid"
import { estimateGridBytes } from "./layout"
import { GridWindowNotice, type WholeEpisodeGrid } from "./whole"
import { windowEpisodeGrid } from "./window"

const scores = {
	imdb: { score: 7.4, count: 1200 },
	tmdb: { score: 7.1, count: null },
	tomatometer: null,
	popcornmeter: null,
	metascore: null,
	metacriticUser: null,
}

/** Seasons as [episode count, highest number]; every `every`th number up to the count is rated. */
const show = (
	seasons: [number, number][],
	{
		every = 1,
		specials = 0,
		name = "Homer's Night Out at the Springfield Plant",
	} = {},
): EpisodeGridData => ({
	showId: 1,
	seasons: seasons.map(([count, max], s) => ({
		number: s + 1,
		episodes: Array.from({ length: max }, (_, e) => e + 1)
			.filter((n) => n % every === 0)
			.slice(0, count)
			.map((n) => ({
				number: n,
				name,
				score: 5 + (n % 50) / 10,
				votes: 20 + n * 7,
			})),
		maxEpisodeNumber: max,
		scores,
	})),
	specials: Array.from({ length: specials }, (_, i) => ({
		name: `Special ${i}`,
		score: 7,
		votes: 90,
	})),
	maxEpisodeNumber: Math.max(...seasons.map(([, max]) => max)),
	hasEpisodeZero: false,
	providers: ["imdb", "tmdb"],
})

const seasonsOf = (count: number, episodes: (s: number) => number) =>
	Array.from({ length: count }, (_, s): [number, number] => [
		episodes(s),
		episodes(s),
	])

const idle: WholeEpisodeGrid = {
	shown: null,
	scores: null,
	state: "idle",
	showAll: () => {},
	load: () => {},
	prefetch: () => {},
}

const shapes: Record<string, EpisodeGridData> = {
	// Scripted runs that should render whole.
	simpsons: show(
		seasonsOf(38, (s) => (s === 37 ? 2 : 20 + (s % 6))),
		{ specials: 4 },
	),
	greys: show(seasonsOf(22, (s) => 17 + (s % 9))),
	svu: show(seasonsOf(27, (s) => 22 + (s % 3))),
	ncis: show(seasonsOf(23, (s) => 20 + (s % 5))),
	// Long anime in one IMDb season.
	onePiece: show([[1180, 1180]]),
	// A daily soap: one season numbered into the thousands, a few of them rated.
	soap: show([[162, 11_599]], { every: 70 }),
	// A soap with most of its episodes rated.
	ratedSoap: show([[1572, 7_399]], { every: 4 }),
	// Late night: thirty seasons of about 160 episodes.
	lateNight: show(seasonsOf(31, () => 140)),
	// A short show with specials, kept whole.
	short: show(
		seasonsOf(5, () => 10),
		{ specials: 3 },
	),
}

const out = Object.fromEntries(
	Object.entries(shapes).map(([name, whole]) => {
		const render = (grid: EpisodeGridData) =>
			renderToString(
				<EpisodeGrid
					grid={grid}
					notice={<GridWindowNotice grid={grid} whole={idle} />}
				/>,
			)
		const part = windowEpisodeGrid(whole)
		const html = render(part)
		return [
			name,
			{
				// The whole grid's render and loader data, against the estimate of both.
				wholeBytes:
					Buffer.byteLength(render(whole)) +
					Buffer.byteLength(JSON.stringify(packEpisodeGrid(whole))),
				wholeEstimate: estimateGridBytes(whole),
				bytes: Buffer.byteLength(html),
				estimate: estimateGridBytes(part),
				kept: part === whole,
				seasons: part.seasons.map((s) => s.number),
				shownEpisodes: part.seasons.reduce((n, s) => n + s.episodes.length, 0),
				gapCells: (html.match(/not rated<\/span>/g) ?? []).length,
				notice: /Showing[^<]*/.exec(html)?.[0] ?? null,
				button: /Show all[^<]*/.exec(html)?.[0] ?? null,
			},
		]
	}),
)
console.log(`__GRID_SIZE__${JSON.stringify(out)}`)
