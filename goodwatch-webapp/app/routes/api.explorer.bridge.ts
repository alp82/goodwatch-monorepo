import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	branchingOf,
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getBridge } from "~/server/explorer/index.server"

// The bridge between two islands: GET /api/explorer/bridge?grouping=genre&a=horror&b=comedy[&branching=6,2,2]
// (members), or POST with the guest progress (guests). Takes the map's filters. Returns ExplorerBridge.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getBridge(ctx, {
			...explorerQueryOf(params),
			a: params.get("a") ?? "",
			b: params.get("b") ?? "",
			branching: branchingOf(params.get("branching")),
		}),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
