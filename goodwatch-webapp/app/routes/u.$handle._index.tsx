// Public profile: /u/:handle. The person's display name, handle, and public share lists, newest first.
// A handle its owner renamed away from redirects to their current one while it's on hold; unknown, expired, and
// deleted handles answer 404. For the owner, this page is also My lists: it shows their unlisted lists too, marked,
// with Edit, Share, Delete, and a Public or Unlisted switch under each.
import { PlusIcon } from "@heroicons/react/20/solid"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData, useRevalidator } from "@remix-run/react"
import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { useShareListOwnerAction } from "~/routes/api.share-lists"
import {
	findProfileByHandle,
	listsByUser,
	publicListsByUser,
} from "~/server/share-lists/store.server"
import { entryKey, resolveCardTitles } from "~/server/share-lists/titles.server"
import { CardFonts } from "~/ui/share-card/ScaledCard"
import { newListPath, profilePath } from "~/ui/share-card/links"
import { type CardTitle, THEMES, cardDate } from "~/ui/share-card/model"
import { OwnerListControls } from "~/ui/share-lists/OwnerListControls"
import {
	type ShareListSummary,
	ShareListTile,
} from "~/ui/share-lists/ShareListTile"
import { getUserIdFromRequest } from "~/utils/auth"
import { pluralize } from "~/utils/helpers"

export { pageHeaders as headers } from "~/utils/headers"

export async function loader({ params, request }: LoaderFunctionArgs) {
	const requested = params.handle ?? ""
	const found = await findProfileByHandle(requested)
	if (!found) throw new Response("Not found", { status: 404 })
	// Temporary: the old handle stops redirecting when its hold ends.
	if ("redirectTo" in found) return redirect(profilePath(found.redirectTo), 302)
	const { profile } = found
	if (requested !== profile.handle)
		return redirect(profilePath(profile.handle), 301)

	const viewerId = await getUserIdFromRequest({ request })
	const isOwner = viewerId === profile.userId
	// Newest first for everyone, so the grid doesn't reorder when the owner changes a list.
	const lists = (
		isOwner
			? await listsByUser(profile.userId)
			: await publicListsByUser(profile.userId)
	).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	// One catalog lookup for every card on the page.
	const titles = await resolveCardTitles(lists.flatMap((list) => list.items))
	const byKey = new Map(titles.map((t) => [t.key, t]))
	const summaries: ShareListSummary[] = lists.map((list) => ({
		id: list.id,
		title: list.title,
		design: list.design,
		theme: list.theme,
		signature: list.signature,
		items: list.items
			.map((e) => byKey.get(entryKey(e)))
			.filter((t): t is CardTitle => t !== undefined),
		date: cardDate(new Date(list.createdAt)),
		...(isOwner ? { visibility: list.visibility } : {}),
	}))
	return json(
		{
			profile: { handle: profile.handle, displayName: profile.displayName },
			lists: summaries,
			isOwner,
		},
		// Never cached by shared caches: the owner's view differs from a visitor's, and an unlisted or deleted list
		// must leave the profile right away.
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data)
		return [
			{ title: "Profile not found · GoodWatch" },
			{ name: "robots", content: "noindex, nofollow" },
		]
	const { handle, displayName } = data.profile
	return [
		{
			title: `${displayName ? `${displayName} (@${handle})` : `@${handle}`} · GoodWatch`,
		},
		{ name: "description", content: `Top 5 lists by @${handle} on GoodWatch.` },
		{ name: "robots", content: "noindex, nofollow" },
	]
}

export default function PublicProfile() {
	const { profile, lists: loaded, isOwner } = useLoaderData<typeof loader>()
	const owner = useOwnerLists(loaded)
	const lists = owner.lists
	const lead = lists[0]
	const accent = THEMES[lead?.theme ?? "ember"]
	const backdrop = lead?.items.find((t) => t.backdrop)?.backdrop ?? null
	const name = profile.displayName || `@${profile.handle}`
	return (
		<main className="min-h-screen pb-24">
			<CardFonts />
			<header className="relative isolate overflow-hidden">
				{backdrop && (
					<img
						src={backdrop}
						alt=""
						className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
					/>
				)}
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/75 to-transparent" />
				<div className="mx-auto flex max-w-7xl flex-wrap items-end gap-x-6 gap-y-4 px-4 pt-16 pb-8 sm:pt-20">
					<div
						aria-hidden
						className="flex size-20 shrink-0 items-center justify-center rounded-full text-4xl font-black text-black shadow-2xl sm:size-24 sm:text-5xl"
						style={{
							backgroundImage: `linear-gradient(135deg, ${accent.accent}, ${accent.accent2})`,
						}}
					>
						{(profile.displayName || profile.handle).charAt(0).toUpperCase()}
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="text-3xl font-black break-words text-white sm:text-5xl">
							{name}
						</h1>
						<p className="mt-1 text-gray-300">
							{profile.displayName && (
								<span className="mr-2 font-semibold text-gray-200">
									@{profile.handle}
								</span>
							)}
							<span className="text-gray-400">
								{lists.length
									? pluralize(lists.length, "list")
									: "No lists yet"}
							</span>
						</p>
					</div>
					{isOwner && (
						<div className="flex gap-2">
							<Link
								to="/settings/profile"
								className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-gray-100 hover:bg-white/15"
							>
								Edit profile
							</Link>
							<Link
								to={newListPath()}
								className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black text-black hover:brightness-110"
								style={{
									backgroundImage: `linear-gradient(90deg, ${accent.accent}, ${accent.accent2})`,
								}}
							>
								<PlusIcon className="size-5" aria-hidden />
								New list
							</Link>
						</div>
					)}
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-4 pt-4">
				{lists.length ? (
					<ul className="grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{lists.map((list) => (
							<ShareListTile key={list.id} list={list} handle={profile.handle}>
								{isOwner && (
									<OwnerListControls
										list={list}
										handle={profile.handle}
										onVisibility={(visibility) =>
											owner.patch(list.id, { visibility })
										}
										onDeleted={() => owner.removed(list)}
									/>
								)}
							</ShareListTile>
						))}
					</ul>
				) : (
					<div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
						<p className="text-lg font-bold text-gray-100">
							{isOwner
								? "You haven't shared a list yet."
								: `${name} hasn't shared a list yet.`}
						</p>
						{isOwner ? (
							<Link
								to={newListPath()}
								className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 font-black text-black hover:bg-gray-200"
							>
								Make your first list
							</Link>
						) : (
							<p className="mt-2 text-gray-400">
								Rank your own favorite movies and shows.{" "}
								<Link
									to={newListPath()}
									className="font-semibold text-gray-100 underline underline-offset-4 hover:text-white"
								>
									Make a list
								</Link>
							</p>
						)}
					</div>
				)}
			</div>
		</main>
	)
}

// The owner's changes show in the grid right away; the loader data catches up after each write. A delete offers Undo
// in a toast for as long as the server allows it.
function useOwnerLists(loaded: ShareListSummary[]) {
	const [lists, setLists] = useState(loaded)
	const revalidator = useRevalidator()
	const action = useShareListOwnerAction()
	useEffect(() => setLists(loaded), [loaded])

	const patch = (id: string, change: Partial<ShareListSummary>) =>
		setLists((all) => all.map((l) => (l.id === id ? { ...l, ...change } : l)))

	const removed = (list: ShareListSummary) => {
		const at = lists.findIndex((l) => l.id === list.id)
		setLists((all) => all.filter((l) => l.id !== list.id))
		revalidator.revalidate()
		const undo = async () => {
			try {
				await action.mutateAsync({ intent: "restore", id: list.id })
				setLists((all) => {
					const rest = all.filter((l) => l.id !== list.id)
					rest.splice(Math.max(0, Math.min(at, rest.length)), 0, list)
					return rest
				})
				revalidator.revalidate()
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Restoring the list failed.",
				)
			}
		}
		toast(
			({ closeToast }) => (
				<div className="flex items-center justify-between gap-4">
					<span>List deleted.</span>
					<button
						type="button"
						onClick={() => {
							closeToast?.()
							undo()
						}}
						className="rounded-full bg-white px-3 py-1 text-sm font-black text-black"
					>
						Undo
					</button>
				</div>
			),
			{ autoClose: 8000 },
		)
	}

	return { lists, patch, removed }
}
