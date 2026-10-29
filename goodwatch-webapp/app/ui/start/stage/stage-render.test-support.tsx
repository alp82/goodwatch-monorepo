// Run by stage-render.test.ts through vite-node: renders the start page's stage the way the server does, for a guest
// and a member (as routes/_index.tsx does: the opening for guests only), and prints the HTML.
import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { StartLedge } from "../ledge/StartLedge"
import { guestLedge } from "../ledge/ledge-models"
import { OpeningBoot, OpeningCover } from "../opening/OpeningBoot"
import { StartStage } from "./StartStage"
import { DIM_NIGHT } from "./room-steps"
import { EMPTY_QUERY, IDLE_RESULTS } from "./start-query"

const titles: StartTitle[] = Array.from({ length: 16 }, (_, i) => ({
	media_type: i % 2 ? "show" : "movie",
	tmdb_id: 100 + i,
	title: `Title ${i + 1}`,
	release_year: 2000 + i,
	poster_path: `/poster${i}.jpg`,
	goodwatch_overall_score_normalized_percent: 70 + i,
}))

const ledge = guestLedge({
	query: EMPTY_QUERY,
	results: IDLE_RESULTS,
	view: "empty",
	loved: [],
	pick: null,
	fan: titles,
})

const render = (member: boolean) =>
	renderToString(
		<MemoryRouter>
			<StartStage
				shelf={titles}
				night={DIM_NIGHT}
				open={false}
				card={
					<StartLedge open={false} ledge={ledge} onOpen={() => {}}>
						<button type="button">The card</button>
					</StartLedge>
				}
				opening={member ? undefined : <OpeningBoot />}
			/>
			{member ? null : <OpeningCover />}
		</MemoryRouter>,
	)

console.log(
	`__START_STAGE_RENDER__${JSON.stringify({ guest: render(false), member: render(true) })}`,
)
