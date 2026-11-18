// Pieces the Stats tab's sections share: the "Your top **genres**" heading, the filter pills, and the poster card with
// the owner's score.
import type { ReactNode } from "react"
import type { ProfileTitle } from "~/domain/profile"
import type { PosterProps } from "~/ui/Poster"
import { ProfilePoster } from "../parts"
import { useTaste } from "./model"
import { SectionHeading } from "~/ui/heading"
import { SELECTED_QUIET } from "~/ui/selection/selected"

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
}: {
	id: string
	eyebrow?: string
	lead: string
	accent: string
	tail?: string
	sub?: ReactNode
	right?: ReactNode
}) {
	return (
		<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
			<div className="min-w-[min(100%,18rem)] flex-1">
				{eyebrow && (
					<p className="mb-1 text-xs font-bold tracking-[0.18em] text-amber-400/80 uppercase">
						{eyebrow}
					</p>
				)}
				<SectionHeading id={id} className="scroll-mt-44">
					<span className="font-light text-gray-300">{lead} </span>
					<span className="text-amber-400">{accent}</span>
					{tail && (
						<span className="font-light text-gray-300">
							{/^[?!.,]/.test(tail) ? tail : ` ${tail}`}
						</span>
					)}
				</SectionHeading>
				{sub && <p className="mt-1.5 max-w-3xl text-sm text-gray-400">{sub}</p>}
			</div>
			{right}
		</div>
	)
}

/** A section's pill (D2: a choice that switches one section, so the quiet tab when picked). */
export const sectionPillClass = (on: boolean) =>
	`min-h-8 cursor-pointer rounded-full px-3 text-xs font-bold tracking-wide uppercase ring-1 transition-colors ${
		on ? `${SELECTED_QUIET} ring-white/20` : "text-gray-400 ring-white/10 hover:text-white"
	}`

export function Pills<T extends string>({
	value,
	onChange,
	options,
	label,
}: {
	value: T
	onChange: (v: T) => void
	options: { value: T; label: string; count?: number }[]
	label: string
}) {
	return (
		<fieldset className="flex flex-wrap gap-1.5">
			<legend className="sr-only">{label}</legend>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					aria-pressed={o.value === value}
					onClick={() => onChange(o.value)}
					className={sectionPillClass(o.value === value)}
				>
					{o.label}
					{o.count != null && <span className="ml-1 tabular-nums opacity-60">{o.count}</span>}
				</button>
			))}
		</fieldset>
	)
}

/**
 * A scored poster on the Stats tab: the site's poster card, with the owner's score as its filled square when someone
 * else looks. `sizes`: the poster's displayed widths.
 */
export function TastePoster({
	title,
	sizes,
}: {
	title: ProfileTitle
	sizes: PosterProps["sizes"]
}) {
	const { owner, handle } = useTaste()
	return <ProfilePoster title={title} owner={owner ? null : handle} sizes={sizes} />
}
