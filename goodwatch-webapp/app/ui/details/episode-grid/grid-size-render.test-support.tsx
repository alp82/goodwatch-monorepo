// Run by grid-size.test.ts through vite-node: renders the episode grid the way the show page's server does, for
// long shows shaped like the real ones, and prints each one's HTML size and notice.
import { renderToStaticMarkup } from "react-dom/server"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import EpisodeGrid from "./EpisodeGrid"
import { GridWindowNotice, type WholeEpisodeGrid } from "./whole"
import { windowEpisodeGrid } from "./window"

const scores = {
	imdb: { score: 7.4, count: 1200 },
	tmdb: null,
	tomatometer: null,
	popcornmeter: null,
	metascore: null,
	metacriticUser: null,
}

/** `seasons` seasons of `width` episode numbers, every `every`th of them rated, with long names as IMDb has them. */
const show = (seasons: number, width: number, every = 1): EpisodeGridData => ({
	showId: 1,
	seasons: Array.from({ length: seasons }, (_, s) => ({
		number: s + 1,
		episodes: Array.from({ length: width }, (_, e) => e + 1)
			.filter((n) => n % every === 0)
			.map((n) => ({
				number: n,
				name: `Episode dated ${n} with a guest list`,
				score: 5 + (n % 50) / 10,
				votes: 40 + n,
			})),
		maxEpisodeNumber: width,
		scores,
	})),
	specials: Array.from({ length: 30 }, (_, i) => ({
		name: `Special ${i}`,
		score: 7,
		votes: 90,
	})),
	maxEpisodeNumber: width,
	hasEpisodeZero: false,
	providers: ["imdb"],
})

const idle: WholeEpisodeGrid = {
	shown: null,
	scores: null,
	state: "idle",
	showAll: () => {},
	load: () => {},
	prefetch: () => {},
}

const shapes = {
	// A daily soap: one IMDb season numbered into the thousands, a few rated.
	soap: show(1, 11_599, 70),
	// A soap with most episodes rated.
	ratedSoap: show(1, 7_399, 5),
	// A late-night show: thirty seasons of about 160 episodes.
	lateNight: show(31, 163),
	// A long cartoon: 38 seasons of about 22.
	cartoon: show(38, 25),
	// A short show, kept whole.
	short: show(5, 10),
}

const out = Object.fromEntries(
	Object.entries(shapes).map(([name, whole]) => {
		const part = windowEpisodeGrid(whole)
		const html = renderToStaticMarkup(
			<EpisodeGrid
				grid={part}
				notice={<GridWindowNotice grid={part} whole={idle} />}
			/>,
		)
		return [
			name,
			{
				bytes: Buffer.byteLength(html),
				kept: part === whole,
				seasons: part.seasons.map((s) => s.number),
				notice: /Showing[^<]*/.exec(html)?.[0] ?? null,
				button: /Show all[^<]*/.exec(html)?.[0] ?? null,
			},
		]
	}),
)
console.log(`__GRID_SIZE__${JSON.stringify(out)}`)
