// Small pieces the About and How it works pages share, in the site's existing look: the amber kicker, the amber
// "→" link and the call-to-action buttons /use-with-ai and /support use.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"

export const Kicker = ({
	children,
	className = "",
}: { children: ReactNode; className?: string }) => (
	<p
		className={`text-xs font-bold uppercase tracking-[0.18em] text-amber-400 ${className}`}
	>
		{children}
	</p>
)

/** An amber text link with an arrow; links that leave the site open in a new tab. */
export function MoreLink({
	to,
	children,
	className = "",
}: { to: string; children: ReactNode; className?: string }) {
	const cls = `inline-flex w-fit items-center gap-1 font-semibold text-amber-500 transition hover:text-amber-400 ${className}`
	return to.startsWith("http") ? (
		<a href={to} className={cls} target="_blank" rel="noreferrer">
			{children} <span aria-hidden="true">→</span>
		</a>
	) : (
		<Link to={to} prefetch="intent" className={cls}>
			{children} <span aria-hidden="true">→</span>
		</Link>
	)
}

/** A button-sized link: amber for the main action, quiet for the other. */
export function ActionLink({
	to,
	primary = false,
	children,
}: { to: string; primary?: boolean; children: ReactNode }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={
				primary
					? "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					: "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-5 py-3 font-semibold text-gray-100 ring-1 ring-white/10 transition hover:bg-white/10"
			}
		>
			{children}
		</Link>
	)
}
