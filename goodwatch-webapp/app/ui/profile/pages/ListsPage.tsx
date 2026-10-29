// The profile's Lists tab: the member's share lists, newest first. For the owner it is also My lists: unlisted lists
// too, marked, with Edit, Share, Delete and a Public or Unlisted switch under each, and Undo after a delete.
import { PlusIcon } from "@heroicons/react/20/solid"
import { Link, useRevalidator } from "@remix-run/react"
import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import type { ProfileShell } from "~/domain/profile"
import { useShareListOwnerAction } from "~/routes/api.share-lists"
import { CardFonts } from "~/ui/share-card/ScaledCard"
import { newListPath } from "~/ui/share-card/links"
import { OwnerListControls } from "~/ui/share-lists/OwnerListControls"
import {
	type ShareListSummary,
	ShareListTile,
} from "~/ui/share-lists/ShareListTile"
import { AMBER_BUTTON } from "../parts"

export function ListsPage({
	shell,
	lists: loaded,
}: { shell: ProfileShell; lists: ShareListSummary[] }) {
	const owner = shell.viewer === "owner"
	const { lists, patch, removed } = useOwnerLists(loaded)
	return (
		<>
			<CardFonts />
			{owner && (
				<div className="flex">
					<Link to={newListPath()} className={AMBER_BUTTON}>
						<PlusIcon className="size-5" aria-hidden />
						New list
					</Link>
				</div>
			)}
			{lists.length ? (
				<ul className="grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{lists.map((list, index) => (
						<ShareListTile
							imagePriority={index < 2 ? "high" : "lazy"}
							key={list.id}
							list={list}
							handle={shell.handle}
						>
							{owner && (
								<OwnerListControls
									list={list}
									handle={shell.handle}
									onVisibility={(visibility) => patch(list.id, { visibility })}
									onDeleted={() => removed(list)}
								/>
							)}
						</ShareListTile>
					))}
				</ul>
			) : (
				<div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
					<p className="text-lg font-bold text-gray-100">
						{owner
							? "You haven't shared a list yet."
							: `@${shell.handle} hasn't shared a list yet.`}
					</p>
					{owner ? (
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
		</>
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
