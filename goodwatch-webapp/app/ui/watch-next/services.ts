// Where a title streams, as the Watch next page words it: the viewer's own services first.
import type { CardService, TitleCard } from "~/server/title-cards.server"
import { brandName, getShorterProviderLabel } from "~/utils/streaming-links"

export interface ServiceOffer extends CardService {
	owned: boolean
}

/** A service's name as the title page shows it: "Prime", "Disney+". */
export const serviceLabel = (name: string) =>
	brandName(getShorterProviderLabel(name))

/** The title's services, the viewer's own first and marked, with short names; null while availability loads. */
export function offersOf(
	title: Pick<TitleCard, "services">,
	mine: readonly CardService[],
): ServiceOffer[] | null {
	if (!title.services) return null
	const own = new Set(mine.map((service) => service.name))
	const seen = new Set<string>()
	return title.services
		.filter((service) => {
			if (seen.has(service.name)) return false
			seen.add(service.name)
			return true
		})
		.map((service) => ({
			...service,
			name: serviceLabel(service.name),
			owned: own.has(service.name),
		}))
		.sort((a, b) => Number(b.owned) - Number(a.owned))
}

/** "On Netflix", "On Netflix, not yours", or "Not streaming here". */
export function watchLine(offers: ServiceOffer[] | null): string {
	if (!offers) return ""
	const first = offers[0]
	if (!first) return "Not streaming here"
	return first.owned ? `On ${first.name}` : `On ${first.name}, not yours`
}
