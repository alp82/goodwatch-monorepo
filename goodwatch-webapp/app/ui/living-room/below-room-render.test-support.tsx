// Run by below-room.test.ts through vite-node: renders the section below the room the way the server does and
// prints the HTML.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { TalkedRow } from "~/domain/talked-about-now"
import { BelowRoom } from "./BelowRoom"
import type { StartTitle } from "./living-room-data"

const titles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 4 === 0 ? "movie" : "show",
	tmdb_id: 100 + i,
	title: i === 2 ? "Law & Order: Special Victims Unit" : `Title ${i + 1}`,
	release_year: i === 5 ? null : 1990 + i,
	poster_path: i === 7 ? null : `/poster${i}.jpg`,
	goodwatch_overall_score_normalized_percent: i === 3 ? null : 60 + i,
}))

const talked: TalkedRow = {
	day: "2026-10-22",
	titles: [
		{
			mediaType: "movie",
			tmdbId: 603,
			title: "The Matrix",
			year: 1999,
			poster: null,
			backdrop: null,
			rank: 1,
			lift: 3,
			views: 300,
			usual: 100,
			curve: [100, 200, 300],
			reason: null,
			move: "new",
			items: [
				{
					id: "news-1",
					source: "rss",
					url: "https://example.com/matrix",
					author: "Writer",
					publisher: "Movie News",
					at: "2026-10-22T12:00:00Z",
					text: "The Matrix returns to cinemas",
					sourceId: null,
					english: true,
					image: null,
				},
			],
		},
	],
}
const render = (list: StartTitle[], row?: TalkedRow) =>
	renderToStaticMarkup(
		// The poster cards read the viewer's marks through React Query, which the root provides on the page.
		<QueryClientProvider client={new QueryClient()}>
			<MemoryRouter>
				<BelowRoom titles={list} talked={row} />
			</MemoryRouter>
		</QueryClientProvider>,
	)

console.log(
	`__BELOW_ROOM_RENDER__${JSON.stringify({
		full: render(titles),
		social: render(titles, talked),
		noRanking: render(titles, { day: talked.day, titles: [] }),
		again: render(titles),
		empty: render([]),
	})}`,
)
