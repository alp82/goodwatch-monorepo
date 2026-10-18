import type { StreamingType } from "~/server/types/details-types"
import {
	OFFER_TABS,
	type OfferSource,
	TAB_TYPES,
	streamingLinks,
	tmdbWatchUrl,
} from "~/utils/streaming-links"

/** Google's Media Actions names for who may watch an offer. */
const ACCESS_CATEGORY: Record<StreamingType, string> = {
	flatrate: "subscription",
	flatrate_and_buy: "subscription",
	free: "free",
	ads: "free",
	rent: "rental",
	buy: "purchase",
}

// Every link opens a web page that works on desktop and phone browsers.
const WEB_PLATFORMS = [
	"http://schema.org/DesktopWebPlatform",
	"http://schema.org/MobileWebPlatform",
]

/** An absolute https address, never the TMDB watch page that stands in for an offer without a link. */
const watchLink = (url: string, media: OfferSource, country: string) => {
	if (url === tmdbWatchUrl(media.mediaType, media.details.tmdb_id, country))
		return null
	try {
		return new URL(url).protocol === "https:" ? url : null
	} catch {
		return null
	}
}

/**
 * A title's offers in one country as schema.org WatchActions: the services the where-to-watch block shows a guest,
 * stream first, then rent and buy, each with the link its tile opens. An offer without a link of its own is left
 * out, so a title without any has no WatchAction at all. Prices are left out: the stored price has no currency.
 */
export function watchActions(media: OfferSource, country: string) {
	const region = { "@type": "Country", name: country.toUpperCase() }
	return OFFER_TABS.flatMap((tab) =>
		streamingLinks(media, country, TAB_TYPES[tab]).flatMap((link) => {
			const url = watchLink(link.url, media, country)
			if (!url) return []
			const category = ACCESS_CATEGORY[link.type]
			return [
				{
					"@type": "WatchAction",
					provider: { "@type": "Organization", name: link.name },
					target: {
						"@type": "EntryPoint",
						urlTemplate: url,
						actionPlatform: WEB_PLATFORMS,
					},
					actionAccessibilityRequirement: {
						"@type": "ActionAccessSpecification",
						category,
						eligibleRegion: region,
					},
					// A free offer asks nothing of the viewer, so it has no Offer to accept.
					...(category === "free"
						? {}
						: {
								expectsAcceptanceOf: {
									"@type": "Offer",
									category,
									eligibleRegion: region,
								},
							}),
				},
			]
		}),
	)
}
