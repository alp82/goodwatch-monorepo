import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getIslandPairs } from "~/server/explorer/index.server"

// What every pair of islands shares: GET /api/explorer/pairs?grouping=genre (members), or POST with the guest progress
// (guests). Takes the map's filters. Returns ExplorerPairs.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getIslandPairs(ctx, explorerQueryOf(params)),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
