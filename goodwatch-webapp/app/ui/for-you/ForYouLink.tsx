// The way into the For you page from other pages (Taste, the taste quiz, My movies, My shows, Watch next): a quiet
// amber text link with an arrow. Kept apart from the page itself so those pages don't load it.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"

export const FOR_YOU_PATH = "/for-you"

/** The For you page, optionally opening on a recipe (a library id, or `side-N` for one of the person's taste groups). */
export const forYouHref = (recipe?: string) =>
	recipe ? `${FOR_YOU_PATH}?recipe=${encodeURIComponent(recipe)}` : FOR_YOU_PATH

/** Below this many titles on the Wishlist, My movies, My shows and Watch next point to For you. */
export const FIND_NEW_BELOW = 4

export function ForYouLink({
	recipe,
	className = "",
	children,
}: {
	recipe?: string
	className?: string
	children: ReactNode
}) {
	return (
		<Link
			to={forYouHref(recipe)}
			prefetch="intent"
			className={`inline-flex min-h-11 items-center gap-1 text-sm font-bold text-amber-300 hover:text-amber-200 md:min-h-9 ${className}`}
			data-for-you-link=""
		>
			{children}
			<ArrowRightIcon className="size-4" aria-hidden />
		</Link>
	)
}
