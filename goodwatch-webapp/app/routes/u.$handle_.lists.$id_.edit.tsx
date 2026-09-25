// The editor for a saved share list: /u/:handle/lists/:id/edit. Only the owner can open it; everyone else goes to
// the list page. A wrong or differently cased handle redirects to the canonical URL, and deleted lists answer 404.
// The trailing underscores keep this route out of the profile and list page layouts.
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { getList, getProfileByUserId } from "~/server/share-lists/store.server"
import {
	getQuickPicks,
	resolveCardTitles,
} from "~/server/share-lists/titles.server"
import {
	publicOrigin,
	shareListEditPath,
	shareListPath,
} from "~/ui/share-card/links"
import { cardDate, listByline } from "~/ui/share-card/model"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import { SharedNotice } from "~/ui/share-list-editor/ShareFlow"
import { ShareListEditor } from "~/ui/share-list-editor/ShareListEditor"
import { getUserIdFromRequest } from "~/utils/auth"

// A list or profile can come back (Undo, a restored account), so "not found" must never be cached.
const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } })

export { pageHeaders as headers } from "~/utils/headers"

export async function loader({ params, request }: LoaderFunctionArgs) {
	const list = await getList(params.id ?? "")
	if (!list) throw notFound()
	const owner = await getProfileByUserId(list.userId)
	if (!owner) throw notFound()

	const userId = await getUserIdFromRequest({ request })
	if (userId !== list.userId)
		return redirect(shareListPath(owner.handle, list.id))
	if (params.handle !== owner.handle)
		return redirect(shareListEditPath(owner.handle, list.id), 301)

	const [items, quickPicks] = await Promise.all([
		resolveCardTitles(list.items),
		getQuickPicks(),
	])
	const initial: ListDraft = {
		title: list.title,
		promptId: list.promptId,
		design: list.design,
		theme: list.theme,
		items,
		remixedFrom: list.remixedFrom,
	}
	return json(
		{
			id: list.id,
			handle: owner.handle,
			initial,
			quickPicks,
			date: cardDate(new Date(list.createdAt)),
		},
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `Edit ${data?.initial.title ?? "list"} · GoodWatch` },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function EditShareList() {
	const { id, handle, initial, quickPicks, date } =
		useLoaderData<typeof loader>()
	const byline = listByline(handle)
	const path = shareListPath(handle, id)
	return (
		<>
			<ShareListEditor
				initial={initial}
				quickPicks={quickPicks}
				date={date}
				byline={byline}
				saveTarget={{ kind: "list", id }}
				share={async () => {
					// Make sure the card image is current before the link gets pasted somewhere.
					navigator.sendBeacon?.(
						"/api/og-image-warm",
						new Blob([path], { type: "text/plain" }),
					)
					return `${publicOrigin()}${path}`
				}}
			/>
			<SharedNotice />
		</>
	)
}
