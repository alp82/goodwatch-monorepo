import { captureProductEvent } from "~/telemetry/product-analytics.server"
import {
	AVAILABILITY_MAX_AGE_MS,
	type AvailabilityEvidence,
	evaluateAvailability,
} from "../../utils/availability-evidence"
import { query } from "../../utils/crate"
import { getAvailabilityEvidence } from "../availability.server"
import { getServiceList } from "../title-cards.server"
import type { ViewerContext } from "../viewer.server"
import type { CatalogTitle } from "./data.server.ts"
import { linkedAvailability, providerFamily } from "./watch-links.ts"

export async function watchAvailability(
	title: CatalogTitle,
	ctx: ViewerContext,
	evidence?: AvailabilityEvidence | null,
) {
	const scope = {
		mediaType: title.media_type,
		tmdbId: title.tmdb_id,
		country: ctx.country,
	}
	const raw =
		evidence === undefined ? await getAvailabilityEvidence(scope) : evidence
	const evaluated = evaluateAvailability(raw, {
		...scope,
		serviceIds: ctx.services,
	})
	if (ctx.viewer.kind === "member")
		captureProductEvent(ctx.viewer.userId, "availability checked", {
			source: "mcp",
			tmdb_id: title.tmdb_id,
			media_type: title.media_type,
			country: ctx.country,
			result_count: evaluated.offers.length,
		})
	if (!evaluated.offers.length)
		return linkedAvailability(evaluated, title, ctx.country, new Map(), [])
	const ids = [
		...new Set(
			evaluated.offers.flatMap((offer) => providerFamily(offer.service_id)),
		),
	]
	const [services, rows] = await Promise.all([
		getServiceList(ids).catch(() => []),
		query<{
			service_id: number
			offer_type: string
			stream_url: string | null
		}>(
			`SELECT streaming_service_id AS service_id, streaming_type AS offer_type, stream_url FROM streaming_availability WHERE media_type = ? AND media_tmdb_id = ? AND country_code = ? AND streaming_service_id IN (${ids.map(() => "?").join(",")}) AND updated_at > ? AND updated_at <= ?`,
			[
				title.media_type,
				title.tmdb_id,
				ctx.country,
				...ids,
				Date.now() - AVAILABILITY_MAX_AGE_MS,
				Date.now(),
			],
		).catch(() => []),
	])
	return linkedAvailability(
		evaluated,
		title,
		ctx.country,
		new Map(services.map((service) => [service.id, service.name])),
		rows,
		new Map(services.map((service) => [service.id, service.logo_path])),
	)
}
