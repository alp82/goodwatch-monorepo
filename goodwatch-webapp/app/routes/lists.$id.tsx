import type { MetaFunction } from "@remix-run/node"
import { Link, useFetcher, useLoaderData } from "@remix-run/react"
import { useState } from "react"
import { createCollectionPageLoader } from "~/server/share-lists/collection-page.server"
import { getList } from "~/server/share-lists/store.server"
import { resolveCardTitles } from "~/server/share-lists/titles.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { HandlePicker } from "~/ui/share-lists/HandlePicker"
export const loader = createCollectionPageLoader({
	getList,
	resolveCardTitles,
	getUserIdFromRequest,
})
export { pageHeaders as headers } from "~/utils/headers"
export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.list.title ?? "List not found"} · GoodWatch` },
	{ name: "robots", content: "noindex, nofollow" },
]
export default function CollectionList() {
	const { list, titles, isOwner } = useLoaderData<typeof loader>()
	const action = useFetcher<{
		error?: string
		code?: string
		deleted?: boolean
	}>()
	const [copied, setCopied] = useState(false)
	const [claimed, setClaimed] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const write = (body: Record<string, string>) =>
		action.submit(
			{ ...body, id: list.id },
			{
				method: "POST",
				encType: "application/json",
				action: "/api/share-lists",
			},
		)
	const share = () => write({ intent: "visibility", visibility: "unlisted" })
	const catalog = new Map(titles.map((title) => [title.key, title]))
	return (
		<main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-gray-100">
			<Link className="text-indigo-300 underline" to="/lists/mine">
				My lists
			</Link>
			<h1 className="break-words text-3xl font-bold">{list.title}</h1>
			<p className="text-gray-400">
				{list.items.length} titles ·{" "}
				{list.visibility === "private"
					? "Private: only you can see this list"
					: list.visibility === "unlisted"
						? "Unlisted: anyone with the link can see this list"
						: "Public"}
			</p>
			{list.collection?.description && (
				<p className="whitespace-pre-wrap break-words">
					{list.collection.description}
				</p>
			)}
			{isOwner && (
				<div className="space-y-3">
					<div className="flex flex-wrap gap-3">
						{list.visibility === "private" ? (
							<button
								className="rounded bg-indigo-700 px-4 py-2 font-semibold"
								type="button"
								disabled={action.state !== "idle"}
								onClick={share}
							>
								Share list
							</button>
						) : (
							<>
								<button
									className="rounded bg-indigo-700 px-4 py-2 font-semibold"
									type="button"
									onClick={async () => {
										await navigator.clipboard.writeText(window.location.href)
										setCopied(true)
									}}
								>
									{copied ? "Link copied" : "Copy share link"}
								</button>
								<button
									className="rounded bg-slate-700 px-4 py-2"
									type="button"
									onClick={() =>
										write({ intent: "visibility", visibility: "private" })
									}
								>
									Make private
								</button>
							</>
						)}
						<button
							className="rounded bg-slate-700 px-4 py-2"
							type="button"
							onClick={() => setConfirmDelete(true)}
						>
							Delete list
						</button>
					</div>
					{confirmDelete && (
						<div role="alert" className="space-y-2">
							<p>Delete “{list.title}”? Its link will stop working.</p>
							<button
								type="button"
								className="rounded bg-red-700 px-4 py-2"
								onClick={() => write({ intent: "delete" })}
							>
								Confirm delete
							</button>
							<button
								type="button"
								className="px-4 py-2"
								onClick={() => setConfirmDelete(false)}
							>
								Cancel
							</button>
						</div>
					)}
					{action.data?.error && <p role="alert">{action.data.error}</p>}
					{action.data?.code === "handle_required" && !claimed && (
						<HandlePicker
							onClaimed={() => {
								setClaimed(true)
								share()
							}}
						/>
					)}
				</div>
			)}
			<ol className="space-y-3">
				{list.items.map((entry, index) => {
					const key = `${entry.media_type}:${entry.tmdb_id}`,
						title = catalog.get(key)
					const note =
						list.collection?.entryNotes?.[index] ??
						list.collection?.notes?.[key]
					return (
						<li
							key={`${key}:${index}`}
							className="rounded-lg border border-slate-700 p-4"
						>
							<div className="flex gap-3">
								<span>{index + 1}.</span>
								{title ? (
									<Link
										className="font-semibold text-indigo-300 underline"
										to={`/${entry.media_type}/${entry.tmdb_id}`}
									>
										{title.title}
										{title.year ? ` (${title.year})` : ""}
									</Link>
								) : (
									<span>Title unavailable</span>
								)}
							</div>
							{note && (
								<p className="mt-2 whitespace-pre-wrap break-words text-gray-300">
									{note}
								</p>
							)}
						</li>
					)
				})}
			</ol>
		</main>
	)
}
