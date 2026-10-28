// Run by stage-render.test.ts through vite-node: renders the start page's stage the way the server does, for a guest
// and a member, and prints the HTML.
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { StartStage } from "./StartStage"

const titles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 2 ? "show" : "movie",
	tmdb_id: 100 + i,
	title: `Title ${i + 1}`,
	release_year: 2000 + i,
	poster_path: `/poster${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 70 + i,
}))

const render = (member: boolean) =>
	renderToString(
		<MemoryRouter>
			<StartStage
				shelf={titles}
				night={member ? 0 : 0.9}
				camera={member ? 1 : 1.12}
				centered={!member}
				cardHidden={!member}
			/>
		</MemoryRouter>,
	)

console.log(
	`__START_STAGE_RENDER__${JSON.stringify({ guest: render(false), member: render(true) })}`,
)
