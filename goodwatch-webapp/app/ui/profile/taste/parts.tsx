// Pieces the Taste tab's sections share: the "Your top **genres**" heading, the filter pills, and a small linked poster
// with the owner's score.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { ProfileTitle } from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { PosterImg, ScoreChip } from "../parts"

export const PANEL = "rounded-2xl bg-white/[0.035] ring-1 ring-white/10"

/** A section heading: a quiet lead-in and one amber word, as in "Your top genres". */
export function SectionHead({
	id,
	eyebrow,
	lead,
	accent,
	tail,
	sub,
	right,
}: { id: string; eyebrow?: string; lead: string; accent: string; tail?: string; sub?: ReactNode; right?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
			<div className="min-w-[min(100%,18rem)] flex-1">
				{eyebrow && <p className="mb-1 text-xs font-bold tracking-[0.18em] text-amber-400/80 uppercase">{eyebrow}</p>}
				<h2 id={id} className={`${DISPLAY} scroll-mt-44 text-3xl leading-tight text-white sm:text-4xl`}>
					<span className="font-light text-gray-300">{lead} </span>
					<span className="text-amber-400">{accent}</span>
					{tail && <span className="font-light text-gray-300">{/^[?!.,]/.test(tail) ? tail : ` ${tail}`}</span>}
				</h2>
				{sub && <p className="mt-1.5 max-w-3xl text-sm text-gray-400">{sub}</p>}
			</div>
			{right}
		</div>
	)
}

export function Pills<T extends string>({
	value,
	onChange,
	options,
	label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
	return (
		<fieldset className="flex flex-wrap gap-1.5">
			<legend className="sr-only">{label}</legend>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					aria-pressed={o.value === value}
					onClick={() => onChange(o.value)}
					className={`min-h-8 rounded-full px-3 text-xs font-bold tracking-wide uppercase ring-1 transition-colors ${
						o.value === value ? "bg-amber-400/15 text-amber-300 ring-amber-400/60" : "text-gray-400 ring-white/10 hover:text-white"
					}`}
				>
					{o.label}
					{o.count != null && <span className="ml-1 tabular-nums opacity-60">{o.count}</span>}
				</button>
			))}
		</fieldset>
	)
}

/** A poster that links to its title, the owner's score in the corner. */
export function MiniPoster({ title, className = "", score = true }: { title: ProfileTitle; className?: string; score?: boolean }) {
	return (
		<Link to={title.href} prefetch="intent" title={`${title.title}${title.year ? ` (${title.year})` : ""}`} className={`group relative block ${className}`}>
			<PosterImg title={title} className="rounded-md shadow-lg ring-1 ring-white/10 transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
			{score && title.score != null && (
				<span className="absolute -right-1 -bottom-1">
					<ScoreChip score={title.score} size="sm" />
				</span>
			)}
		</Link>
	)
}
