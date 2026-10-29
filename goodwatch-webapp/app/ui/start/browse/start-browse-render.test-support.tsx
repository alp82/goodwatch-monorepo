// Run by start-browse.test.ts through vite-node: renders the Where to start section the way the server does, with a
// full set of rails and with none, and prints the HTML and the size of the data.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import {
	BROWSE_GENRES,
	BROWSE_MOODS,
	EMPTY_BROWSE,
	type StartBrowseData,
} from "./browse-data"
import { StartBrowse } from "./StartBrowse"

// Poster paths as long as TMDB's, so the sizes printed are the real ones.
const poster = (i: number) =>
	`/${String(i).padStart(4, "0")}qJ2tW6WMUDux911r6m7h.jpg`

const titles = (
	from: number,
	count: number,
	kind?: "movie" | "show",
): StartTitle[] =>
	Array.from({ length: count }, (_, i) => ({
		media_type: kind ?? (i % 2 ? "show" : "movie"),
		tmdb_id: from + i,
		title:
			i === 1
				? "Law & Order: Special Victims Unit"
				: `A Title Number ${from + i}`,
		release_year: 1990 + i,
		poster_path: poster(from + i),
		goodwatch_overall_score_normalized_percent: 80 + (i % 10),
	}))

const full: StartBrowseData = {
	top: { movie: titles(100, 10, "movie"), show: titles(200, 10, "show") },
	arrivals: titles(300, 12),
	moods: BROWSE_MOODS.map((mood, i) => ({
		path: mood.path,
		posters: [poster(400 + i * 3), poster(401 + i * 3), poster(402 + i * 3)],
	})),
	services: [
		"Netflix",
		"Amazon Prime Video",
		"Disney+",
		"HBO Max",
		"Apple TV",
		"Hulu",
	].map((name, i) => ({
		name,
		href: i < 3 ? `/shows/streaming/s${i}` : `/new/us/s${i}`,
		logo: `/logo${i}.jpg`,
		posters: [0, 1, 2, 3].map((j) => poster(500 + i * 4 + j)),
	})),
	genres: {
		movie: BROWSE_GENRES.movie.map((path, i) => ({
			name: path.replace(/-/g, " "),
			path,
			titles: [0, 1, 2].map((j) => ({
				title: `Genre Title ${i}${j}`,
				poster_path: poster(600 + i * 3 + j),
			})),
		})),
		show: BROWSE_GENRES.show.map((path, i) => ({
			name: path.replace(/-/g, " "),
			path,
			titles: [0, 1, 2].map((j) => ({
				title: `Genre Show ${i}${j}`,
				poster_path: poster(700 + i * 3 + j),
			})),
		})),
	},
}

const render = (data: StartBrowseData) =>
	renderToString(
		// The poster cards read the viewer's marks through React Query, which the root provides on the page.
		<QueryClientProvider client={new QueryClient()}>
			<MemoryRouter>
				<StartBrowse data={data} />
			</MemoryRouter>
		</QueryClientProvider>,
	)

console.log(
	`__START_BROWSE_RENDER__${JSON.stringify({
		full: render(full),
		again: render(full),
		empty: render(EMPTY_BROWSE),
		dataBytes: JSON.stringify(full).length,
	})}`,
)
