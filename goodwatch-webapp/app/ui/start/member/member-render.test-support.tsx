// Run by member-render.test.ts through vite-node: renders a member's start the way the server does, for members with
// more and less on their lists, and prints the HTML.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { MemberStart } from "./MemberStart"
import { MEMBERS } from "./member-fixtures.test-support"

const shelf: StartTitle[] = Array.from({ length: 12 }, (_, i) => ({
	media_type: i % 2 ? "show" : "movie",
	tmdb_id: 900 + i,
	title: `Shelf ${i + 1}`,
	release_year: 2000 + i,
	poster_path: `/shelf${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 70 + i,
}))

const render = (data: (typeof MEMBERS)[keyof typeof MEMBERS]) =>
	renderToString(
		<QueryClientProvider client={new QueryClient()}>
			<MemoryRouter>
				<MemberStart shelf={shelf} data={data} />
			</MemoryRouter>
		</QueryClientProvider>,
	)

console.log(
	`__MEMBER_START_RENDER__${JSON.stringify(
		Object.fromEntries(
			Object.entries(MEMBERS).map(([name, data]) => [name, render(data)]),
		),
	)}`,
)
