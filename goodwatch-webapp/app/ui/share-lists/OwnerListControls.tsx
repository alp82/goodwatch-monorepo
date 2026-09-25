// The owner's controls under one of their lists on their profile: Edit, Share (copy the link), a Public or Unlisted
// switch, and Delete with a confirmation. The profile applies each change to its grid right away.
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useState } from "react"
import { toast } from "react-toastify"
import { useShareListOwnerAction } from "~/routes/api.share-lists"
import {
	publicOrigin,
	shareListEditPath,
	shareListPath,
} from "~/ui/share-card/links"
import { DialogShell } from "~/ui/share-list-editor/ShareFlow"
import type { ShareListSummary } from "~/ui/share-lists/ShareListTile"

type Visibility = "public" | "unlisted"

export function OwnerListControls({
	list,
	handle,
	onVisibility,
	onDeleted,
}: {
	list: ShareListSummary
	handle: string
	onVisibility: (visibility: Visibility) => void
	onDeleted: () => void
}) {
	const action = useShareListOwnerAction()
	const [copied, setCopied] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const visibility = list.visibility ?? "public"
	const path = shareListPath(handle, list.id)

	const share = async () => {
		// Make sure the card image is current before the link gets pasted somewhere.
		navigator.sendBeacon?.(
			"/api/og-image-warm",
			new Blob([path], { type: "text/plain" }),
		)
		const url = `${publicOrigin()}${path}`
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			window.prompt("Copy this link", url)
		}
	}

	const toggleVisibility = async () => {
		const next: Visibility = visibility === "public" ? "unlisted" : "public"
		onVisibility(next)
		try {
			await action.mutateAsync({
				intent: "visibility",
				id: list.id,
				visibility: next,
			})
		} catch (error) {
			onVisibility(visibility)
			toast.error(
				error instanceof Error
					? error.message
					: "Changing who can see the list failed.",
			)
		}
	}

	const remove = async () => {
		try {
			await action.mutateAsync({ intent: "delete", id: list.id })
			setConfirming(false)
			onDeleted()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Deleting the list failed.",
			)
		}
	}

	const button =
		"flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-gray-100 transition hover:bg-white/15"
	return (
		<div className="mt-3 flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Link to={shareListEditPath(handle, list.id)} className={button}>
					<PencilSquareIcon className="size-4" aria-hidden />
					Edit
				</Link>
				<button
					type="button"
					onClick={share}
					className={`${button} w-32 justify-center`}
				>
					{copied ? "Link copied ✓" : "Share"}
				</button>
				<button
					type="button"
					onClick={() => setConfirming(true)}
					className={`${button} hover:bg-red-600`}
					aria-label={`Delete ${list.title}`}
				>
					<TrashIcon className="size-4" aria-hidden />
				</button>
			</div>
			<div className="flex items-center gap-3 text-sm">
				<button
					type="button"
					role="switch"
					aria-checked={visibility === "public"}
					aria-label={`Show ${list.title} on your profile`}
					aria-describedby={`visibility-${list.id}`}
					onClick={toggleVisibility}
					className={`relative h-6 w-11 shrink-0 rounded-full transition ${visibility === "public" ? "bg-emerald-500" : "bg-white/15"}`}
				>
					<span
						className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${visibility === "public" ? "translate-x-5" : ""}`}
					/>
				</button>
				<span id={`visibility-${list.id}`} className="text-gray-300">
					{visibility === "public"
						? "Public: shown on your profile"
						: "Unlisted: only people with the link"}
				</span>
			</div>

			{confirming && (
				<DialogShell label="Delete list" onClose={() => setConfirming(false)}>
					<h2 className="text-2xl font-black">Delete this list?</h2>
					<p className="text-neutral-300">
						“{list.title}” will disappear from your profile, and its link will
						stop working. You can undo this for a few minutes.
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setConfirming(false)}
							className="flex-1 rounded-full bg-white/10 py-2.5 font-bold hover:bg-white/15"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={remove}
							disabled={action.isPending}
							className="flex-1 rounded-full bg-red-600 py-2.5 font-black text-white hover:bg-red-500 disabled:opacity-60"
						>
							{action.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</DialogShell>
			)}
		</div>
	)
}
