import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getExplorerWorld } from "~/server/explorer/world.server"

// Every grouping's islands, the Explorer's one map: GET /api/explorer/world?services=mine|all&unseen=0|1 (members), or
// POST with the guest progress (guests). Returns ExplorerWorld.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getExplorerWorld(ctx, explorerQueryOf(params)),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
