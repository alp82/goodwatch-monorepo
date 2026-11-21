// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 cards, per family: the kit's place card (moods, countries, themes, styles),
// the Rooms genre panel, era card and service card. The baseline to beat.
import type { CardProps } from "../../../../kit/types"
import { PlaceCardPlain } from "../../../../kit/ui"
import { EraCardPlain, ServiceCardPlain } from "../../../rooms/parts"
import { GenrePanelPlain } from "../../../rooms/rooms"
import type { SlotVariant } from "../../contract"

function View({
	place,
	href,
	copy,
	titles,
	traits,
	kinds,
	kindHref,
	rose,
	goodAt,
	size,
}: CardProps) {
	if (place.family === "genre" && kinds && kindHref)
		return (
			<GenrePanelPlain
				place={place}
				line={copy?.short}
				kinds={kinds}
				titles={titles}
				href={href}
				kindHref={kindHref}
			/>
		)
	if (place.family === "service")
		return (
			<ServiceCardPlain
				place={place}
				to={href}
				line={copy?.short}
				goodAt={goodAt ?? []}
				titles={titles}
			/>
		)
	if (place.family === "decade")
		return (
			<EraCardPlain
				era={{ place, line: copy?.short, lede: copy?.lede || undefined, rose: rose ?? [], titles }}
				to={href}
				rich={size === "l"}
			/>
		)
	return (
		<PlaceCardPlain
			place={place}
			to={href}
			titles={titles}
			line={copy?.short}
			words={traits}
			size={size === "l" ? "lg" : "md"}
		/>
	)
}

export const variant: SlotVariant<never, CardProps> = {
	id: "r4",
	name: "Round 4",
	what: "Today's cards: a name, one line and three posters; a mood's color in its header; genres with their kinds.",
	View,
}
