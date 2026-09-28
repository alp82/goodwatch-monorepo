// GET ?mood=crime&from=auto|wishlist|new&service=Netflix&country=DE.
// POST the same URL with { guest: { interactions, country, services } } to use browser-owned progress.
// Members always use their authenticated account; guest input cannot select or override an account.
// Returns { titles, pickKeys, source }; titles have numeric catalog keys and movie-N/show-N tvKeys.
// Retry a 503 with Retry-After: 2 when the snapshot or availability is still loading.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { livingRoomPicksResponse } from "~/server/living-room/request.server"

export const loader = ({ request }: LoaderFunctionArgs) =>
	livingRoomPicksResponse(request)
export const action = ({ request }: ActionFunctionArgs) =>
	livingRoomPicksResponse(request)
