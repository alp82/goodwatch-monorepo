// PROTOTYPE - throwaway. Round 10 of the Explorer, its reads: /prototype/rec-explorer-10/api?op=world|mix|shares with
// the map's filters; `of=mood:dark,decade:1980s` names the picked islands. Members GET, guests POST their progress,
// as the real Explorer's endpoints do. Development only.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import {
	getMix10,
	getShares10,
	getWorld10,
	refsOf,
} from "~/server/prototype-rec-explorer-10.server"

const answer = ({ request }: { request: Request }) => {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return explorerResponse(request, (ctx, params) => {
		const query = explorerQueryOf(params)
		const refs = refsOf(params.get("of"))
		const op = params.get("op")
		if (op === "world") return getWorld10(ctx, query)
		if (op === "mix") return getMix10(ctx, query, refs)
		if (op === "shares") return getShares10(ctx, query, refs)
		return Promise.resolve(null)
	})
}

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
