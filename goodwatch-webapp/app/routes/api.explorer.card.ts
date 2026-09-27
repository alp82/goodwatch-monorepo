import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { explorerResponse } from "~/server/explorer/http.server"
import { getNearCard } from "~/server/explorer/index.server"

// The near card of one title: GET /api/explorer/card?key=1000000000550 (members), or POST with the guest progress
// (guests). The key is the title key (movie 1e12 + tmdb_id, show 2e12 + tmdb_id). Returns ExplorerCard.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) => {
		const key = Number(params.get("key"))
		return Number.isSafeInteger(key) && key > 0
			? getNearCard(ctx, key)
			: Promise.resolve(null)
	})

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
