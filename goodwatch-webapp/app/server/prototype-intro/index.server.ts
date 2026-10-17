// PROTOTYPE - throwaway. The intro lab's data: the start page's, plus each clip group's extras.
import { loadLandingCards } from "~/server/prototype-landing.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { IntroData } from "~/ui/prototype-intro/clip"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { TvService } from "~/ui/living-room/tv/tv-home"
import * as explorertrack from "~/server/prototype-intro/explorertrack.server"
import * as feel from "~/server/prototype-intro/feel.server"
import * as problem from "~/server/prototype-intro/problem.server"
import * as scorestream from "~/server/prototype-intro/scorestream.server"
import * as searchfilter from "~/server/prototype-intro/searchfilter.server"
import * as r5open from "~/server/prototype-intro/r5open.server"
import * as r5score from "~/server/prototype-intro/r5score.server"
import * as r5feel from "~/server/prototype-intro/r5feel.server"
import * as r5filter from "~/server/prototype-intro/r5filter.server"
import * as r5map from "~/server/prototype-intro/r5map.server"
import * as r5track from "~/server/prototype-intro/r5track.server"
import * as r6open from "~/server/prototype-intro/r6open.server"
import * as r6score from "~/server/prototype-intro/r6score.server"
import * as r6feel from "~/server/prototype-intro/r6feel.server"
import * as r6filter from "~/server/prototype-intro/r6filter.server"
import * as r6map from "~/server/prototype-intro/r6map.server"
import * as r6track from "~/server/prototype-intro/r6track.server"
import * as r7open from "~/server/prototype-intro/r7open.server"
import * as r7feel from "~/server/prototype-intro/r7feel.server"
import * as r7filter from "~/server/prototype-intro/r7filter.server"
import * as r7map from "~/server/prototype-intro/r7map.server"
import * as r7track from "~/server/prototype-intro/r7track.server"
import * as r10b from "~/server/prototype-intro/r10b.server"
import * as r8filter from "~/server/prototype-intro/r8filter.server"
import * as r8map from "~/server/prototype-intro/r8map.server"
import * as r8track from "~/server/prototype-intro/r8track.server"

const GROUPS = { r10b, problem, scorestream, feel, searchfilter, explorertrack, r5open, r5score, r5feel, r5filter, r5map, r5track, r6open, r6score, r6feel, r6filter, r6map, r6track, r7open, r7feel, r7filter, r7map, r7track, r8filter, r8map, r8track }

export async function loadIntroData(
	request: Request,
	home: { startTitles: StartTitle[]; services: TvService[]; landing?: IntroData["landing"] },
): Promise<IntroData> {
	const [landing, pool] = await Promise.all([
		home.landing ?? loadLandingCards(request, home.startTitles),
		loadPool(request).catch((e) => {
			console.error("intro pool", e)
			return []
		}),
	])
	const extra: Record<string, unknown> = {}
	await Promise.all(
		Object.entries(GROUPS).map(async ([name, g]) => {
			extra[name] = await g.load(request, landing).catch((e) => {
				console.error(`intro extra ${name}`, e)
				return null
			})
		}),
	)
	return { startTitles: home.startTitles, landing, pool, services: home.services, extra }
}
