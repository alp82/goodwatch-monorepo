import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	branchingOf,
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getIsland } from "~/server/explorer/index.server"

// One island's tree: GET /api/explorer/island?grouping=mood&id=scary[&branching=6,2,2] (members), or POST with the
// guest progress (guests). Takes the map's filters. Returns ExplorerIslandTree.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getIsland(ctx, {
			...explorerQueryOf(params),
			id: params.get("id") ?? "",
			branching: branchingOf(params.get("branching")),
		}),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
