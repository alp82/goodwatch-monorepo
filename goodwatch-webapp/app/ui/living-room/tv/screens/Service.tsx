import { copyMediaPresentation } from "~/utils/media-presentation"
// "On <service>": titles to watch on one streaming service. A streaming key of the Remote opens it, from any
// screen, and so does the service's tile on home. The service's own mark leads the top bar, with a line of its
// colour along the top edge; under it the list every app shows its titles in (../TitleList.tsx), in a row that
// pages. A title leads to its title screen. The Expand key leads to Discover with that one service
// (`/discover?services=<id>`). A chunk the TV asks for on first use (screen-code.tsx).
//
// The mark is the Remote's own drawn one for Netflix and Prime Video and the catalog's logo for any other
// (`ServiceMark`, ../../Remote.tsx). A service nobody has a mark for is named in words alone.
import { ServiceMark, hasDrawnMark, serviceColor } from "../../Remote"
import { TitleList, type TvListTitle } from "../TitleList"
import { useReport, useTvView } from "../kit"
import { type TvService, tvTitleKey } from "../tv-home"
import type { TvScreen } from "../tv-machine"
import {
	serviceEmptyLine,
	serviceFacts,
	serviceOnScreen,
	serviceWords,
} from "../tv-service"
import { type TvServiceReport, useTvService } from "../use-tv-service"

/**
 * The titles of the service on screen (use-tv-service.ts). Draws nothing. The scene mounts it once while the
 * address names a service, and gets what it holds through `report`. It is in this chunk, so the list's data costs
 * no request for code of its own and nothing in the page's first view.
 */
export function ServiceData({
	report,
	...on
}: Parameters<typeof useTvService>[0] & {
	report: (list: TvServiceReport | null) => void
}) {
	useReport<TvServiceReport | null>(report, useTvService(on))
	return null
}

/** A service without a colour of its own has a quiet line. */
const QUIET_EDGE = "rgba(255,255,255,.3)"

export default function Service({
	items,
	screen,
	own,
	list,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	screen: Extract<TvScreen, { name: "service" }>
	/** The person's own two services: the screen names one of them at once. */
	own: readonly TvService[]
	/** The titles to watch there; null until their data component has reported. */
	list: TvServiceReport | null
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	// Another service's titles are not this screen's: the report follows the address a moment later.
	const mine = list?.id === screen.service ? list : null
	const cards = mine?.cards ?? []
	const service = serviceOnScreen(screen.service, own, cards)
	const drawn = Boolean(service && hasDrawnMark(service))
	const titles: TvListTitle[] = cards.map((card) => ({
		key: tvTitleKey(card),
		...copyMediaPresentation(card),
		title: card.title,
		poster: card.poster_path,
		backdrop: card.backdrop_path,
		facts: serviceFacts(card),
	}))
	const mark = !service ? undefined : drawn ? (
		// The drawn mark on a dark plate, so it reads on any picture.
		<span
			data-tv-service-mark={service.id}
			className={`flex shrink-0 items-center rounded-[10px] bg-black/55 ${P ? "h-[46px] px-3" : "h-[64px] px-5"}`}
		>
			<ServiceMark service={service} height={P ? 20 : 28} />
		</span>
	) : service.logo_path ? (
		<span data-tv-service-mark={service.id} className="flex shrink-0">
			<ServiceMark service={service} height={P ? 46 : 64} />
		</span>
	) : undefined
	return (
		<TitleList
			{...serviceWords({
				service,
				total: mine?.total ?? null,
				phone: P,
				drawn,
			})}
			items={items}
			titles={titles}
			empty={serviceEmptyLine(mine?.waiting ?? true, service)}
			mark={mark}
			edge={(service && serviceColor(service)) ?? QUIET_EDGE}
		/>
	)
}
