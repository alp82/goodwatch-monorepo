import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import { counter } from "~/server/metrics/registry.server"
import { getRelatedPanel } from "~/server/related.server"
import { isValidFingerprintKey } from "~/server/utils/fingerprint"
import type { MediaType } from "~/server/utils/query-db"
import {
	type RelatedPanel,
	type RelatedPanelParams,
	relatedPanelQueryOptions,
} from "~/utils/related-panel"

export type GetRelatedPanelResult = RelatedPanel

const isMediaType = (value: string | null): value is MediaType =>
	value === "movie" || value === "show"

const relatedRequests = counter(
	"goodwatch_related_requests_total",
	"Related endpoint request variants",
	["variant"],
)

// Older pages request one media type; both variants use the same card panel.
export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const tmdbId = url.searchParams.get("tmdbId")
	const fingerprintKey = url.searchParams.get("fingerprintKey")
	const mediaType = url.searchParams.get("mediaType")
	const sourceMediaType = url.searchParams.get("sourceMediaType")
	const noStore = { "Cache-Control": "no-store" }

	if (!tmdbId || !sourceMediaType) {
		throw new Response("Missing required parameters", {
			status: 400,
			headers: noStore,
		})
	}
	if (fingerprintKey && !isValidFingerprintKey(fingerprintKey)) {
		throw new Response("Invalid fingerprint key", {
			status: 400,
			headers: noStore,
		})
	}
	if (!isMediaType(sourceMediaType) || !/^\d+$/.test(tmdbId)) {
		throw new Response("Invalid parameters", { status: 400, headers: noStore })
	}
	if (mediaType !== null && !isMediaType(mediaType)) {
		throw new Response("Invalid media type", { status: 400, headers: noStore })
	}

	relatedRequests.inc([mediaType === null ? "panel" : "legacy"])
	try {
		const panel = await getRelatedPanel({
			tmdbId: Number.parseInt(tmdbId),
			sourceMediaType,
			fingerprintKey: fingerprintKey || undefined,
		})
		const result =
			mediaType === "movie"
				? panel.movies
				: mediaType === "show"
					? panel.shows
					: panel
		return json(result, {
			headers: { "Cache-Control": PUBLIC_DATA_CACHE_CONTROL },
		})
	} catch (error) {
		console.error("Related titles lookup failed", {
			tmdbId,
			sourceMediaType,
			error,
		})
		return json(
			{ error: "Related titles temporarily unavailable" },
			{
				status: 503,
				headers: { ...noStore, "Retry-After": "5" },
			},
		)
	}
}

// Query hook

/** One panel of related titles. The default panel's data comes with the document. */
export const useRelatedPanel = (params: RelatedPanelParams) =>
	useQuery<GetRelatedPanelResult>(relatedPanelQueryOptions(params))
