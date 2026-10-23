import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node"
import type { getList, listsByUser, getProfileByUserId } from "./store.server"
import type { resolveCardTitles } from "./titles.server"
import type { getUserIdFromRequest } from "~/utils/auth"
export function createCollectionPageLoader(deps: {
	getList: typeof getList
	resolveCardTitles: typeof resolveCardTitles
	getUserIdFromRequest: typeof getUserIdFromRequest
}) {
	return async ({ params, request }: LoaderFunctionArgs) => {
		const list = await deps.getList(params.id ?? "")
		const userId = await deps.getUserIdFromRequest({ request })
		if (!list || (list.visibility === "private" && userId !== list.userId))
			throw new Response("Not found", {
				status: 404,
				headers: { "Cache-Control": "private, no-store" },
			})
		const titles = await deps.resolveCardTitles(list.items)
		return json(
			{
				list: {
					id: list.id,
					title: list.title,
					collection: list.collection,
					items: list.items,
					visibility: list.visibility,
				},
				titles,
				isOwner: userId === list.userId,
			},
			{ headers: { "Cache-Control": "private, no-store" } },
		)
	}
}

export function createMyListsPageLoader(deps: {
	getUserIdFromRequest: typeof getUserIdFromRequest
	getProfileByUserId: typeof getProfileByUserId
	listsByUser: typeof listsByUser
}) {
	return async ({ request }: LoaderFunctionArgs) => {
		const userId = await deps.getUserIdFromRequest({ request })
		const headers = { "Cache-Control": "private, no-store" }
		if (!userId) return redirect("/lists/new", { headers })
		const profile = await deps.getProfileByUserId(userId)
		if (profile) return redirect(`/u/${profile.handle}/lists`, { headers })
		const lists = await deps.listsByUser(userId)
		if (!lists.length) return redirect("/lists/new", { headers })
		return json(
			{
				lists: lists.map((list) => ({
					id: list.id,
					title: list.title,
					count: list.items.length,
					visibility: list.visibility,
				})),
			},
			{ headers },
		)
	}
}
