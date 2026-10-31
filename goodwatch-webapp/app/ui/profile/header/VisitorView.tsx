// The owner's View as visitor: a link that adds or drops ?as=visitor and replaces the history entry, so the profile
// layout keeps its header data (its shouldRevalidate) and the tabs keep the query. While it is on, the amber bar sticks
// right under the site header on every profile tab, and the profile layout sets --visitor-bar-h to its height so the
// tab row and the sticky rows under it sit below it. Owner only, and never on Settings.
import { EyeIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import { tastePath } from "~/domain/member-paths"
import { FOLLOW_PHONE_BAR, STICKY_BAR } from "~/ui/layers"
import { WRAP } from "~/ui/my-pages/bits"

/**
 * Where the view switch leads from this page. The owner-only pages (Not rated, Rate more) have no visitor view, so
 * they switch to Scores; the visitors-only tabs (Seen, Wishlist, Shows) switch back to the profile.
 */
export function viewSwitchHref(
	handle: string,
	pathname: string,
	toVisitor: boolean,
) {
	const query = toVisitor ? { as: "visitor" } : undefined
	if (!/^\/u\/[^/]+/.test(pathname)) return tastePath(handle, "profile", query)
	const rest = pathname.replace(/^\/u\/[^/]+/, "").replace(/\/$/, "")
	if (toVisitor && rest.startsWith("/scores/"))
		return tastePath(handle, "scores", query)
	if (!toVisitor && ["/seen", "/want", "/shows"].includes(rest))
		return tastePath(handle)
	return `/u/${handle}${rest}${toVisitor ? "?as=visitor" : ""}`
}

export interface ViewLinks {
	/** The owner's own view of this page. */
	own: string
	/** This page as visitors see it. */
	visitor: string
	on: boolean
}

/** The visitor bar's height: the profile layout sets --visitor-bar-h to it while the bar shows. */
export const VISITOR_BAR_H = "2.75rem"

/** The style for the profile layout's wrapper: the bar's height while it shows, else 0px. */
export const visitorBarStyle = (on: boolean) =>
	({ "--visitor-bar-h": on ? VISITOR_BAR_H : "0px" }) as CSSProperties

export const toggleView = ({ own, visitor, on }: ViewLinks) =>
	on ? own : visitor

/** The amber bar right under the site header while the owner views their profile as a visitor. */
export function VisitorBar({ own }: { own: string }) {
	return (
		<div
			className={`sticky top-16 ${STICKY_BAR} ${FOLLOW_PHONE_BAR} bg-amber-400 text-gray-950`}
			style={{ height: VISITOR_BAR_H }}
			data-visitor-bar
		>
			<div className={`${WRAP} flex h-full items-center gap-3`}>
				<EyeIcon className="size-5 shrink-0" aria-hidden />
				<p className="min-w-0 flex-1 truncate text-sm font-bold">
					<span className="sm:hidden">Visitor view</span>
					<span className="max-sm:hidden">
						You're viewing your profile as visitors see it
					</span>
				</p>
				<Link
					to={own}
					replace
					preventScrollReset
					className="inline-flex h-8 shrink-0 items-center rounded-full bg-gray-950 px-3.5 text-[13px] font-bold text-amber-200 hover:bg-gray-900"
				>
					Back to your view
				</Link>
			</div>
		</div>
	)
}
