import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import {
	explorerQueryOf,
	explorerResponse,
} from "~/server/explorer/http.server"
import { getParts, refsOf } from "~/server/explorer/world.server"

// What each picked island does to the combination, as the count the others hold without it: GET
// /api/explorer/parts?of=mood:funny,theme:crime (members), or POST with the guest progress (guests). Takes the map's
// filters. Returns ExplorerParts.

const answer = ({ request }: { request: Request }) =>
	explorerResponse(request, (ctx, params) =>
		getParts(ctx, explorerQueryOf(params), refsOf(params.get("of"))),
	)

export const loader = (args: LoaderFunctionArgs) => answer(args)
export const action = (args: ActionFunctionArgs) => answer(args)
