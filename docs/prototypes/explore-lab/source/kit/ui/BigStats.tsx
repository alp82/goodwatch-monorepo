// PROTOTYPE - throwaway (prototype/explore-r4). Three big facts about a place, each one something a viewer can act on
// (where it's nearest to, when it peaked, where to stream it), not a count. A fact with `to` is one link.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { CAPTION } from "~/ui/eyebrow"

export interface BigStat {
	/** The small label above: "NEAREST MOOD". */
	label: string
	/** The fact itself, a word or a short number: "Romantic", "1990s", "9 of 10". */
	value: ReactNode
	/** One quiet line under it. */
	sub?: ReactNode
	to?: string
	/** A mood's hue for the value. */
	hue?: string
}

export function BigStats({ items, className = "" }: { items: BigStat[]; className?: string }) {
	return (
		<dl
			className={`grid divide-white/10 max-sm:divide-y sm:grid-flow-col sm:auto-cols-fr sm:divide-x ${className}`}
		>
			{items.map((s) => {
				const body = (
					<>
						<dt className={CAPTION}>{s.label}</dt>
						<dd
							className="mt-1 font-display text-3xl leading-tight font-bold tracking-tight text-balance text-white sm:text-4xl"
							style={s.hue ? { color: s.hue } : undefined}
						>
							{s.value}
							{s.to && (
								<span
									aria-hidden
									className="ml-1.5 inline-block text-xl text-white/30 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
								>
									›
								</span>
							)}
						</dd>
						{s.sub && <dd className="mt-1 text-sm leading-snug text-gray-400">{s.sub}</dd>}
					</>
				)
				return s.to ? (
					<Link
						key={s.label}
						to={s.to}
						prefetch="intent"
						className="group block rounded-lg py-3 outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-amber-400 sm:px-5 sm:first:pl-0"
					>
						{body}
					</Link>
				) : (
					<div key={s.label} className="py-3 sm:px-5 sm:first:pl-0">
						{body}
					</div>
				)
			})}
		</dl>
	)
}
