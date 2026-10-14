import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { loadTaste } from "~/server/taste/index.server"
import {
	type TitleCardsRequest,
	titleCardsResponse,
} from "~/server/title-cards-request.server"
import {
	MAX_KEYS,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getViewerContext } from "~/server/viewer.server"

// The cards of up to 60 titles by key, for the viewer: what the new TV's title screen shows of a title
// (server/title-cards-request.server.ts).
// - Members: GET /api/title-cards?keys=1000000000603
// - Guests: POST to the same address with { guest: { interactions, country, services } }.

const cards: TitleCardsRequest = {
	max: MAX_KEYS,
	read: async (request, guest, keys) => {
		const ctx = await getViewerContext(request, guest)
		const taste = await loadTaste(ctx.viewer)
		const [titles, services] = await Promise.all([
			getTitleCards(keys, ctx, taste),
			getServiceCards(ctx.services),
		])
		return { cards: titles, services }
	},
}

export const loader = ({ request }: LoaderFunctionArgs) =>
	titleCardsResponse(request, cards)

export const action = ({ request }: ActionFunctionArgs) =>
	titleCardsResponse(request, cards)
