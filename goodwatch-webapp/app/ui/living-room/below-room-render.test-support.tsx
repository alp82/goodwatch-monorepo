// Run by below-room.test.ts through vite-node: renders the section below the room the way the server does and
// prints the HTML.
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { BelowRoom } from "./BelowRoom"
import type { StartTitle } from "./living-room-data"

const titles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 4 === 0 ? "movie" : "show",
	tmdb_id: 100 + i,
	title: i === 2 ? "Law & Order: Special Victims Unit" : `Title ${i + 1}`,
	release_year: i === 5 ? null : 1990 + i,
	poster_path: i === 7 ? null : `/poster${i}.jpg`,
}))

const render = (list: StartTitle[], docked = false) =>
	renderToStaticMarkup(
		<MemoryRouter>
			<BelowRoom titles={list} docked={docked} />
		</MemoryRouter>,
	)

console.log(
	`__BELOW_ROOM_RENDER__${JSON.stringify({
		full: render(titles),
		again: render(titles),
		empty: render([]),
		docked: render(titles, true),
	})}`,
)
