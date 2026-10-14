import { presentCatalogLoader } from "~/server/media-payload.server"
// The start page's pool (server/living-room/pool.server.ts), for the TV's first interaction: GET ?view=pool, or
// POST the same URL with { guest: { interactions, country, services } } to use browser-owned progress. `country=`
// sets a guest's country without progress.
// Members always use their authenticated account; guest input cannot select or override an account.
// Returns { member, suggestions, savedServices, choiceArt }. Without `view=pool` it answers 404.
// Retry a 503 with Retry-After: 2 when the snapshot or availability is still loading.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { livingRoomPicksResponse } from "~/server/living-room/request.server"

const canonicalLoader = ({ request }: LoaderFunctionArgs) =>
	livingRoomPicksResponse(request)
const canonicalAction = ({ request }: ActionFunctionArgs) =>
	livingRoomPicksResponse(request)

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export const action = presentCatalogLoader(canonicalAction, { live: true })
