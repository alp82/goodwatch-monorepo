import { BookmarkIcon, EyeIcon, ForwardIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { useIsOnWishlist, useIsSkipped, useIsWatched } from "~/hooks/useUserDataAccessors"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import SkippedAction from "~/ui/user/actions/SkippedAction"
import ToWatchAction from "~/ui/user/actions/ToWatchAction"
import WatchHistoryAction from "~/ui/user/actions/WatchHistoryAction"
import { useUser } from "~/utils/auth"

const ACTIONS = {
	want: { Icon: BookmarkIcon, short: "Want", on: "Want to See", off: "Want to See", active: "bg-amber-500 text-black", tint: "text-amber-300" },
	seen: { Icon: EyeIcon, short: "Seen", on: "Seen", off: "Mark as Seen", active: "bg-green-500 text-black", tint: "text-green-300" },
	skip: { Icon: ForwardIcon, short: "Skip", on: "Skipped", off: "Skip", active: "bg-pink-500 text-black", tint: "text-pink-300" },
} as const

// The action wrappers clone their child and pass onClick, disabled, and style.
function ActionButton({ kind, active, ...rest }: { kind: keyof typeof ACTIONS; active: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const a = ACTIONS[kind]
	return (
		<button
			type="button"
			aria-pressed={active}
			className={`inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4 sm:text-sm ${
				active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"
			}`}
			{...rest}
		>
			<a.Icon className={`h-4 w-4 shrink-0 ${active ? "" : a.tint}`} />
			<span className="sm:hidden">{active ? a.on : a.short}</span>
			<span className="hidden truncate sm:inline">{active ? a.on : a.off}</span>
		</button>
	)
}

// Want to See, Mark as Seen, and (for guests) Skip, in equal columns.
export default function ListActions({ media }: { media: MovieResult | ShowResult }) {
	const { user } = useUser()
	const { mediaType, details } = media
	const want = useIsOnWishlist(mediaType, details.tmdb_id)
	const seen = useIsWatched(mediaType, details.tmdb_id)
	const skipped = useIsSkipped(mediaType, details.tmdb_id)
	return (
		<div className="flex items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1">
			<ToWatchAction media={media}>
				<ActionButton kind="want" active={!!want} />
			</ToWatchAction>
			<WatchHistoryAction media={media}>
				<ActionButton kind="seen" active={!!seen} />
			</WatchHistoryAction>
			{!user && (
				<SkippedAction media={media}>
					<ActionButton kind="skip" active={!!skipped} />
				</SkippedAction>
			)}
		</div>
	)
}
