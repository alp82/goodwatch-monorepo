import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getShares, refsOf } from "~/server/explorer/world.server"

// What the picked islands would hold with each other island added: GET /api/explorer/shares?of=mood:funny (members),
// or POST with the guest progress (guests). Takes the map's filters. Returns ExplorerShares.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getShares(ctx, explorerQueryOf(params), refsOf(params.get("of"))),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
