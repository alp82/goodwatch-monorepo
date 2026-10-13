import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getCombination, refsOf } from "~/server/explorer/world.server"

// The combination of two to five islands: GET /api/explorer/combination?of=mood:funny,theme:crime,decade:1990s
// (members), or POST with the guest progress (guests). Takes the map's filters. Returns ExplorerCombination.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getCombination(ctx, explorerQueryOf(params), refsOf(params.get("of"))),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
