// PROTOTYPE OPTIONS (member nav, round 8): the owner's View as visitor, three ways (nav-options.ts `visitor`). Every
// way is a link that adds or drops ?as=visitor and replaces the history entry, so the profile layout keeps its header
// data (its shouldRevalidate) and the tabs keep the query. Owner only, and never on Settings.
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { tastePath } from "~/domain/member-paths"
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
	if (!toVisitor && ["/seen", "/wishlist", "/shows"].includes(rest))
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

const toggle = ({ own, visitor, on }: ViewLinks) => (on ? own : visitor)

// OPTION visitor=bar
/** The eye key in the header. On, it turns amber; the bar under the site header says the rest. */
export function EyeKey(links: ViewLinks) {
	const { on } = links
	return (
		<Link
			to={toggle(links)}
			replace
			preventScrollReset
			aria-pressed={on}
			aria-label={on ? "Back to your view" : "View as visitor"}
			className={`inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold ring-1 sm:size-auto sm:min-h-10 sm:px-4 ${
				on
					? "bg-amber-400 text-gray-950 ring-amber-300"
					: "bg-white/[0.06] text-gray-100 ring-white/15 hover:bg-white/[0.1]"
			}`}
		>
			<EyeIcon className="size-5 sm:size-4" aria-hidden />
			<span className="max-sm:hidden">
				{on ? "Viewing as visitor" : "View as visitor"}
			</span>
		</Link>
	)
}

// OPTION visitor=bar
/** The amber bar right under the site header while the owner views their profile as a visitor. */
export function VisitorBar({ own }: { own: string }) {
	return (
		<div className="bg-amber-400 text-gray-950" data-visitor-bar>
			<div className={`${WRAP} flex h-11 items-center gap-3`}>
				<EyeIcon className="size-5 shrink-0" aria-hidden />
				<p className="min-w-0 flex-1 truncate text-sm font-bold">
					<span className="sm:hidden">Viewing as visitors see it</span>
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

// OPTION visitor=switch
/** A labeled toggle switch. The knob slides by transform. */
export function VisitorSwitch(links: ViewLinks) {
	const { on } = links
	return (
		<Link
			to={toggle(links)}
			replace
			preventScrollReset
			role="switch"
			aria-checked={on}
			aria-label="Visitor view"
			className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full pr-1.5 pl-2.5 text-sm font-bold ring-1 sm:pl-3.5 ${
				on
					? "bg-amber-400/15 text-amber-100 ring-amber-400/60"
					: "bg-white/[0.06] text-gray-200 ring-white/15 hover:bg-white/[0.1]"
			}`}
		>
			<EyeIcon
				className={`size-4 ${on ? "text-amber-300" : "text-gray-400"}`}
				aria-hidden
			/>
			<span className="max-sm:hidden">Visitor view</span>
			<span
				aria-hidden
				className={`relative h-6 w-10 rounded-full transition-colors ${on ? "bg-amber-400" : "bg-white/15"}`}
			>
				<span
					className={`absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform duration-200 ${
						on ? "translate-x-4 bg-gray-950" : "bg-white"
					}`}
				/>
			</span>
		</Link>
	)
}

// OPTION visitor=switch
/** Beside the handle while the switch is on. */
export function VisitorBadge() {
	return (
		<span
			data-visitor-badge
			className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-amber-400 px-1.5 text-[11px] font-black tracking-wide text-gray-950 uppercase sm:px-2"
		>
			<EyeIcon className="size-3.5" aria-hidden />
			{/* Phones keep the handle readable: the eye alone, named for screen readers. */}
			<span className="max-sm:sr-only">Visitor view</span>
		</span>
	)
}

// OPTION visitor=preview
/** The item at the Profile tab row's end, before the gear: "Preview", or "Exit preview" in amber while on. */
export function PreviewItem(links: ViewLinks) {
	const { on } = links
	const Icon = on ? EyeSlashIcon : EyeIcon
	return (
		<Link
			to={toggle(links)}
			replace
			preventScrollReset
			aria-pressed={on}
			className={`flex min-h-11 shrink-0 items-center whitespace-nowrap lg:min-h-12 ${on ? "px-1" : "px-2.5"}`}
		>
			<span
				className={`inline-flex items-center gap-1.5 text-[13px] ${
					on
						? "h-8 rounded-full bg-amber-400 px-3 font-bold text-gray-950"
						: "font-medium text-gray-400 hover:text-gray-100"
				}`}
			>
				<Icon className="size-5" aria-hidden />
				{on ? "Exit preview" : "Preview"}
			</span>
		</Link>
	)
}

/** The tab row's tint while the owner views as a visitor (switch and preview). The row is the wrapper's child. */
export const TAB_ROW_TINT =
	"[&>nav]:border-amber-400/40 [&>nav]:bg-[#1f1608]/95"
