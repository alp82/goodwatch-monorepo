// Small pieces the About and How it works pages share, in the site's existing look: the amber kicker, the amber
// "→" link and the call-to-action buttons /use-with-ai and /support use. /discord and /use-with-ai share the section
// heading and the FAQ question.
import { ChevronDownIcon } from "@heroicons/react/24/outline"
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

/** A page section's h2 with an optional lead paragraph. */
export function SectionHeading({
	id,
	title,
	children,
}: { id?: string; title: string; children?: ReactNode }) {
	return (
		<div className="flex max-w-2xl flex-col gap-3">
			<h2
				id={id}
				className="scroll-mt-24 text-3xl font-bold tracking-tight text-white sm:text-4xl"
			>
				{title}
			</h2>
			{children && (
				<p className="text-lg leading-relaxed text-gray-300">{children}</p>
			)}
		</div>
	)
}

/** One FAQ entry: the question opens its answer. */
export function Question({ q, children }: { q: string; children: ReactNode }) {
	return (
		<details className="group px-5 py-4">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white [&::-webkit-details-marker]:hidden">
				{q}
				<ChevronDownIcon
					className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
					aria-hidden="true"
				/>
			</summary>
			<p className="pt-3 leading-relaxed text-gray-300">{children}</p>
		</details>
	)
}
