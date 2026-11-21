// PROTOTYPE - throwaway (prototype/explore-r7). Pieces the tropes index shares: the page head, the spotlight card, and
// "Surprise me".
//
// Round 10: "Surprise me" no longer leaves the page. It swaps the spotlight card in place (a short eased cross-fade)
// for another trope with a teaser; the card is "In the spotlight", not "of the day".
// Round 11: the card has one fixed height at each width and only takes tropes that fit it whole (`fitsSpotlight`), so
// a swap never moves the page; the "See every example" button sits at the card's foot.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import { type Kind, ing, place } from "../../../../kit/address"
import { FOCUS } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps } from "../../contract"
import { type TropeRow, type TropesIndexData, fitsSpotlight } from "./model"
import { NamePlate, PosterFan } from "./parts"

type To = PageViewProps["to"]

export const tropeHref = (to: To, kind: Kind, slug: string) => to(place(kind, [ing("trope", slug)]))

/** The tropes that can stand in the spotlight: a teaser to read and a full fan of posters. */
export const spotlightable = (data: TropesIndexData): TropeRow[] =>
	data.groups.flatMap((g) => g.tropes).filter(fitsSpotlight)

/** The spotlight's state: the server's pick first, "Surprise me" swaps it for another one (never the same twice). */
export function useSpotlight(data: TropesIndexData) {
	const [t, setT] = useState<TropeRow | null>(data.feature)
	const pool = spotlightable(data)
	const next = () => {
		const others = pool.filter((r) => r.id !== t?.id)
		if (others.length) setT(others[Math.floor(Math.random() * others.length)])
	}
	return { t, next, can: pool.length > 1 }
}

/** "Surprise me": swaps the spotlight card for another trope, in place. */
export function Surprise({ onPick, className = "" }: { onPick: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onPick}
			className={`inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 ${QUICK_T} hover:bg-white/[0.12] active:scale-[0.98] ${FOCUS} ${className}`}
		>
			<svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-amber-300" fill="currentColor">
				<path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
			</svg>
			Surprise me
		</button>
	)
}

export function IndexHead({
	data,
	noun,
	action,
}: {
	data: TropesIndexData
	noun: string
	/** Beside the title: "Surprise me". */
	action?: ReactNode
}) {
	const count = data.groups.reduce((n, g) => n + g.tropes.length, 0)
	return (
		<header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
			<div className="max-w-2xl">
				<Kicker>Tropes</Kicker>
				<PageTitle className="mt-2 text-4xl text-white sm:text-5xl">
					The tricks stories play
				</PageTitle>
				<p className="mt-3 text-lg text-gray-300">
					{count} moves you've seen a hundred times, named. Pick one and see which {noun} pull it
					off, and which ones twist it.
				</p>
			</div>
			{action}
		</header>
	)
}

/** The spotlight, large: its fan of titles, the name, our one-liner, and one write-up as a teaser. Swaps in place. */
export function Feature({ t, to, kind }: { t: TropeRow; to: To; kind: Kind }) {
	const reduce = useReducedMotion()
	return (
		<div className="grid">
			<AnimatePresence initial={false} mode="popLayout">
				<motion.div
					key={t.id}
					className="col-start-1 row-start-1"
					initial={{ opacity: 0, scale: 0.985 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.985 }}
					transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
				>
					<FeatureCard t={t} to={to} kind={kind} />
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function FeatureCard({ t, to, kind }: { t: TropeRow; to: To; kind: Kind }) {
	const href = tropeHref(to, kind, t.slug)
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-labelledby={`spotlight-${t.id}`}
			className={`group relative isolate grid overflow-hidden rounded-3xl max-sm:h-[44rem] sm:h-[27rem] ring-1 ring-white/10 ${QUICK_T} hover:ring-white/20 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] ${FOCUS}`}
			style={{
				background: `radial-gradient(90% 120% at 18% 100%, color-mix(in oklab, ${t.color} 30%, transparent), transparent 65%), #121826`,
			}}
		>
			<span className="flex items-center justify-center overflow-hidden py-8 max-sm:h-64 max-sm:items-end max-sm:pb-0">
				<PosterFan titles={t.posters} width={150} className="max-sm:mb-[-10%] max-sm:scale-90" />
			</span>
			<span className="flex min-h-0 min-w-0 flex-col p-5 sm:p-8 sm:pl-2">
				<span
					id={`spotlight-${t.id}`}
					className="text-xs font-bold tracking-[0.18em] uppercase"
					style={{ color: t.color }}
				>
					In the spotlight
				</span>
				<span className="mt-3 block">
					<NamePlate label={t.label} color={t.color} size="lg" />
				</span>
				<span className="mt-4 max-w-xl text-xl leading-snug text-gray-100 sm:text-2xl">
					{t.line}
				</span>
				{t.teaser && (
					<span className="mt-5 mb-5 block max-w-xl rounded-2xl bg-black/25 p-4 text-[15px] leading-relaxed text-gray-300 ring-1 ring-white/10">
						<span className="block text-xs font-bold tracking-wide text-gray-500 uppercase">
							In {t.teaser.title.card.title}
							{t.teaser.title.card.release_year ? ` · ${t.teaser.title.card.release_year}` : ""}
						</span>
						<span className="mt-1.5 block">{t.teaser.text}</span>
					</span>
				)}
				<span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-950 transition-colors group-hover:bg-amber-300">
					See every example <span aria-hidden>›</span>
				</span>
			</span>
		</Link>
	)
}
