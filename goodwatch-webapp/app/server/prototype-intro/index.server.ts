// PROTOTYPE - throwaway. The intro lab's data: the start page's, plus each clip group's extras.
import { loadLandingCards } from "~/server/prototype-landing.server"
import type { IntroData } from "~/ui/prototype-intro/clip"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { TvService } from "~/ui/living-room/tv/tv-home"
import * as explorertrack from "~/server/prototype-intro/explorertrack.server"
import * as feel from "~/server/prototype-intro/feel.server"
import * as problem from "~/server/prototype-intro/problem.server"
import * as scorestream from "~/server/prototype-intro/scorestream.server"
import * as searchfilter from "~/server/prototype-intro/searchfilter.server"

const GROUPS = { problem, scorestream, feel, searchfilter, explorertrack }

export async function loadIntroData(
	request: Request,
	home: { startTitles: StartTitle[]; services: TvService[]; landing?: IntroData["landing"] },
): Promise<IntroData> {
	const landing = home.landing ?? (await loadLandingCards(request, home.startTitles))
	const extra: Record<string, unknown> = {}
	await Promise.all(
		Object.entries(GROUPS).map(async ([name, g]) => {
			extra[name] = await g.load(request, landing).catch((e) => {
				console.error(`intro extra ${name}`, e)
				return null
			})
		}),
	)
	return { startTitles: home.startTitles, landing, services: home.services, extra }
}
