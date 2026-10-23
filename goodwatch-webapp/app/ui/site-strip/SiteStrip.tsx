// The site's one style for notices and onboarding under the header: a thin full-width strip on a warm gradient. One
// strip at a time: account transfer first, then onboarding (a drawer on phones), then announcements such as
// "GoodWatch has profiles now" (ui/onboarding/AccountTransfer.tsx picks). Guests get theirs from app.tsx.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"

/** The strip's surface, for strips that hold more than one line (onboarding's steps on desktop). */
export const STRIP_SURFACE =
	"border-b border-amber-300/20 bg-linear-to-r from-amber-500/20 via-rose-500/10 to-violet-500/20 text-white"
export const STRIP_INNER =
	"mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-4"
export const STRIP_BUTTON =
	"inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-full bg-amber-400 px-4 text-sm font-black whitespace-nowrap text-gray-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
export const STRIP_QUIET =
	"inline-flex min-h-9 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-white/75 hover:bg-white/10 hover:text-white"

/** A "New" pill for announcements. */
export function NewPill() {
	return (
		<span className="mr-2 inline-flex -translate-y-px items-center rounded-full bg-amber-400 px-1.5 py-px align-middle text-[10px] font-black tracking-wide text-gray-950 uppercase">
			New
		</span>
	)
}

/**
 * A strip with its own buttons. `title` is the bold lead-in, `children` the rest of the sentence. `className` places
 * it (strips outside `<main>` need `mt-16 -mb-16` to sit under the fixed header).
 */
export function SiteStrip({
	label,
	lead,
	title,
	children,
	actions,
	className = "",
	role,
}: {
	label: string
	lead?: ReactNode
	title: ReactNode
	children?: ReactNode
	actions?: ReactNode
	className?: string
	role?: "status" | "alert"
}) {
	return (
		<aside
			aria-label={label}
			role={role}
			className={`${STRIP_SURFACE} ${className}`}
		>
			<div className={`${STRIP_INNER} flex-wrap sm:flex-nowrap`}>
				{lead}
				<p className="min-w-0 flex-1 basis-56 text-sm leading-snug">
					<b>{title}</b>{" "}
					{children && <span className="text-white/75">{children}</span>}
				</p>
				{actions && (
					<div className="flex shrink-0 items-center gap-1">{actions}</div>
				)}
			</div>
		</aside>
	)
}

/** A strip that is one link as a whole: the lead, the sentence, and a call to action with a chevron. */
export function SiteStripLink({
	to,
	lead,
	title,
	children,
	cta,
	className = "",
}: {
	to: string
	lead?: ReactNode
	title: ReactNode
	children?: ReactNode
	cta: string
	className?: string
}) {
	return (
		<Link to={to} className={`group block ${STRIP_SURFACE} ${className}`}>
			<span className={STRIP_INNER}>
				{lead}
				<span className="min-w-0 flex-1 text-sm leading-snug">
					{title}
					{children && <span className="text-white/75"> {children}</span>}
				</span>
				<span className="hidden shrink-0 items-center gap-1 text-sm font-black text-amber-300 group-hover:text-amber-200 sm:inline-flex">
					{cta}
					<ChevronRightIcon
						className="size-5 transition-transform group-hover:translate-x-0.5"
						aria-hidden
					/>
				</span>
				<ChevronRightIcon
					className="size-5 shrink-0 text-amber-300 sm:hidden"
					aria-hidden
				/>
			</span>
		</Link>
	)
}
