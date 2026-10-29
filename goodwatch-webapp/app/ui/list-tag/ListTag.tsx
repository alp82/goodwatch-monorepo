// The tag that says which of the member's lists a title comes from ("Continue", "Wishlist", "For you"), with one
// color per list everywhere it shows: My shows' rows and the start page's "this or that". A new place that names a
// list on a title uses this tag, and a new list gets its color here, distinct from the others.
import type { ReactNode } from "react"

/** Each list's colors: a solid fill with dark text, readable over any poster or backdrop. */
export const LIST_TAG_TONE = {
	/** A show to continue: its next episode. */
	continue: "bg-amber-400 text-black",
	/** A finished show with new episodes. */
	newEpisodes: "bg-amber-400 text-black",
	/** A show to start. */
	start: "bg-emerald-400 text-black",
	wishlist: "bg-sky-400 text-black",
	forYou: "bg-violet-400 text-black",
	hot: "bg-rose-400 text-black",
} as const

export type ListTagKind = keyof typeof LIST_TAG_TONE

const SIZE = {
	/** In a list row (My shows). */
	sm: "rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide",
	/** Over a picture (the start page's "this or that"). */
	md: "rounded-md px-2 py-0.5 text-xs font-bold lg:text-sm",
} as const

export function ListTag({
	kind,
	size = "sm",
	className = "",
	children,
}: {
	kind: ListTagKind
	size?: keyof typeof SIZE
	className?: string
	children: ReactNode
}) {
	return (
		<span
			className={`inline-block whitespace-nowrap ${SIZE[size]} ${LIST_TAG_TONE[kind]} ${className}`}
		>
			{children}
		</span>
	)
}
