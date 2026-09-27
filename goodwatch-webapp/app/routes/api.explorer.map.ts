import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getExplorerMap } from "~/server/explorer/index.server"

// The islands of a grouping: GET /api/explorer/map?grouping=mood&services=mine|all&unseen=0|1 (members), or POST with
// the guest progress (guests). Returns ExplorerMap.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getExplorerMap(ctx, explorerQueryOf(params)),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
