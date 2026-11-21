// PROTOTYPE - throwaway (prototype/explore-r4). The head of a place: a kicker naming the page type, the title, a
// human lede, and the place's character as one sentence of trait words. A mood's hue washes the head (never a poster).
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import type { TraitWord } from "../types"
import { WRAP } from "./base"
import { TraitSentence } from "./TraitWord"

export function PlaceLede({
	kicker,
	title,
	lede,
	more,
	less,
	traitTo,
	noun,
	hue,
	crumbs,
	aside,
	children,
}: {
	kicker: ReactNode
	title: ReactNode
	/** The copy deck's lede: a film lover talking to a friend. */
	lede?: ReactNode
	more?: TraitWord[]
	less?: TraitWord[]
	traitTo?: (t: TraitWord) => string
	noun?: string
	/** A mood's hue. */
	hue?: string
	crumbs?: ReactNode
	/** The right column from `lg` up; under the text on a phone. */
	aside?: ReactNode
	children?: ReactNode
}) {
	return (
		<header className="relative isolate">
			{hue && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
					style={{
						background: `radial-gradient(120% 100% at 15% 0%, color-mix(in oklab, ${hue} 26%, transparent) 0%, transparent 62%)`,
					}}
				/>
			)}
			<div className={`${WRAP} pt-6 pb-8 sm:pt-8 sm:pb-10`}>
				{crumbs}
				<div
					className={`grid items-end gap-8 ${aside ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : ""} ${crumbs ? "mt-5" : ""}`}
				>
					<div className="min-w-0">
						<Kicker className="flex items-center gap-2">
							{hue && (
								<span
									aria-hidden
									className="h-2 w-2 rounded-full"
									style={{ background: hue, boxShadow: `0 0 12px ${hue}` }}
								/>
							)}
							{kicker}
						</Kicker>
						<PageTitle className="mt-2 text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
							{title}
						</PageTitle>
						{lede && (
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
								{lede}
							</p>
						)}
						{more && more.length > 0 && (
							<TraitSentence
								more={more}
								less={less}
								to={traitTo}
								noun={noun}
								className="mt-3 max-w-2xl"
							/>
						)}
						{children}
					</div>
					{aside && <div className="min-w-0">{aside}</div>}
				</div>
			</div>
		</header>
	)
}

/** Breadcrumbs for a place's head: the last crumb is where you are. */
export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
	return (
		<nav
			aria-label="Breadcrumb"
			className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-400"
		>
			{items.map((c, i) => (
				<span key={c.to ?? c.label} className="flex items-center gap-1.5">
					{i > 0 && (
						<span aria-hidden className="text-gray-600">
							›
						</span>
					)}
					{c.to ? (
						<Link
							to={c.to}
							prefetch="intent"
							className="rounded-sm outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{c.label}
						</Link>
					) : (
						<span className="text-gray-200">{c.label}</span>
					)}
				</span>
			))}
		</nav>
	)
}
