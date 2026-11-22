// The tropes index: the named indexes as rails of trope cards (each card is the trope's color, a fan of its
// best-known titles, our one-liner, and a real write-up as a teaser), with a trope in the spotlight up front.
// "Surprise me" swaps the spotlight in place; the card has one fixed height at each width and only takes tropes that
// fit it whole (`fitsSpotlight`), so a swap never moves the page.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { type Address, type Kind, ing, kindNoun, place } from "~/domain/browse/address"
import {
	type GroupBlock,
	type TropeRow,
	type TropesIndexData,
	fitsSpotlight,
} from "~/domain/tropes/pages"
import { WRAP } from "~/ui/browse/base"
import { FOCUS, QUICK_T } from "~/ui/browse/motion"
import { NamePlate, PosterFan, TropeCard, TvTropesCredit } from "~/ui/browse/tropes/parts"
import { REPLAY_TAP_SCRIPT } from "~/utils/replay-tap"
import { useReplayedTap } from "~/utils/useReplayedTap"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import { RowArrows, useStepRow } from "~/ui/row-arrows"

type To = (a: Address, extra?: Record<string, string | undefined>) => string

const tropeHref = (to: To, kind: Kind, slug: string) => to(place(kind, [ing("trope", slug)]))

/** The spotlight's state: the server's pick first, "Surprise me" swaps it for another one (never the same twice). */
function useSpotlight(data: TropesIndexData) {
	const [t, setT] = useState<TropeRow | null>(data.feature)
	const pool = data.groups.flatMap((g) => g.tropes).filter(fitsSpotlight)
	const next = () => {
		const others = pool.filter((r) => r.id !== t?.id)
		if (others.length) setT(others[Math.floor(Math.random() * others.length)])
	}
	return { t, next, can: pool.length > 1 }
}

function Surprise({ onPick }: { onPick: () => void }) {
	useReplayedTap("trope-surprise")
	return (
		<button
			type="button"
			onClick={onPick}
			data-replay-tap="trope-surprise"
			className={`inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 ${QUICK_T} hover:bg-white/[0.12] active:scale-[0.98] ${FOCUS}`}
		>
			<svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-amber-300" fill="currentColor">
				<path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
			</svg>
			Surprise me
		</button>
	)
}

function IndexHead({
	data,
	noun,
	action,
}: {
	data: TropesIndexData
	noun: string
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

function FeatureCard({ t, to, kind }: { t: TropeRow; to: To; kind: Kind }) {
	return (
		<Link
			to={tropeHref(to, kind, t.slug)}
			prefetch="intent"
			aria-labelledby={`spotlight-${t.id}`}
			className={`group relative isolate grid overflow-hidden rounded-3xl ring-1 ring-white/10 max-sm:h-[44rem] sm:h-[27rem] ${QUICK_T} hover:ring-white/20 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] ${FOCUS}`}
			style={{
				background: `radial-gradient(90% 120% at 18% 100%, color-mix(in oklab, ${t.color} 30%, transparent), transparent 65%), #121826`,
			}}
		>
			<span className="flex items-center justify-center overflow-hidden py-8 max-sm:h-64 max-sm:items-end max-sm:pb-0">
				<PosterFan
					titles={t.posters}
					width={150}
					spotlight
					className="max-sm:mb-[-10%] max-sm:scale-90"
				/>
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

/** The spotlight, large. Swaps in place with a short eased cross-fade. */
function Feature({ t, to, kind }: { t: TropeRow; to: To; kind: Kind }) {
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

function Rail({ g, to, kind, noun }: { g: GroupBlock; to: To; kind: Kind; noun: string }) {
	const row = useStepRow<HTMLUListElement>([g.tropes.length])
	return (
		<section id={`index-${g.id}`} aria-labelledby={`index-${g.id}-name`} className="scroll-mt-32">
			<header className="flex items-end justify-between gap-4">
				<div className="flex items-start gap-3">
					<span
						aria-hidden
						className="mt-2 h-3 w-3 shrink-0 rounded-[3px]"
						style={{ background: g.color }}
					/>
					<div>
						<h2 id={`index-${g.id}-name`} className="font-display text-2xl font-bold text-white">
							{g.name}
						</h2>
						<p className="mt-0.5 text-[15px] text-gray-400">{g.line}</p>
					</div>
				</div>
				<RowArrows row={row} label={`tropes in ${g.name}`} />
			</header>
			<ul
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0"
			>
				{g.tropes.map((t) => (
					<li key={t.id} className="w-[15.5rem] shrink-0 snap-start sm:w-[16.5rem]">
						<TropeCard t={t} href={tropeHref(to, kind, t.slug)} noun={noun} />
					</li>
				))}
			</ul>
		</section>
	)
}

export function TropesIndex({ data, to }: { data: TropesIndexData; to: To }) {
	const kind = data.kind
	const noun = kindNoun(kind)
	const spot = useSpotlight(data)
	return (
		<div className={`${WRAP} pt-6 pb-24 sm:pt-10`}>
			{/* oxlint-disable-next-line react/no-danger -- The tap recorder is static application code. */}
			{spot.can && <script dangerouslySetInnerHTML={{ __html: REPLAY_TAP_SCRIPT }} />}
			<IndexHead
				data={data}
				noun={noun}
				action={spot.can ? <Surprise onPick={spot.next} /> : undefined}
			/>
			{spot.t && (
				<div className="mt-8">
					<Feature t={spot.t} to={to} kind={kind} />
				</div>
			)}
			<nav
				aria-label="Indexes"
				className="-mx-4 mt-10 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
			>
				<ul className="flex gap-1.5 sm:flex-wrap">
					{data.groups.map((g) => (
						<li key={g.id}>
							<a
								href={`#index-${g.id}`}
								className={`flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-gray-200 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS}`}
							>
								<span
									aria-hidden
									className="h-2 w-2 rounded-[2px]"
									style={{ background: g.color }}
								/>
								{g.name}
							</a>
						</li>
					))}
				</ul>
			</nav>
			<div className="mt-8 space-y-14">
				{data.groups.map((g) => (
					<Rail key={g.id} g={g} to={to} kind={kind} noun={noun} />
				))}
			</div>
			<TvTropesCredit className="mt-16 border-t border-white/[0.07] pt-6" />
		</div>
	)
}
