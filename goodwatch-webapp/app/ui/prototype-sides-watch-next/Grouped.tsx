// PROTOTYPE - throwaway (#659). Variant "grouped": the hero and Then stay as today; after that, one section per side,
// each with its own steps (what fits, near misses, Not tonight). Sections come in the order of their first title in
// the personal order, so the side with tonight's best pick after the hero comes first; inside a section the order is
// the personal order. Titles that fit no side close the page under a quiet heading.
import type { WatchNextTierSize } from "~/domain/watch-next"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { MoodButton, SideFaces, Tiers, pct } from "./bits"
import type { TitleKey } from "~/utils/title-key"
import type { SwnTier, SwnView } from "./model"

// One step smaller inside a section: five sides of full-size steps would push everything else far down.
const SMALLER: Record<WatchNextTierSize, WatchNextTierSize> = { xl: "lg", lg: "md", md: "md", sm: "sm" }
// The tiers of titles that fit tonight; production cuts them across the whole list, so each side cuts its own.
const FITS = new Set(["upNext", "soon", "later", "someday"])

/** A side's steps: what fits, cut again for this side (3 large, 6 medium, the rest small), then the groups that don't. */
function sideTiers(view: SwnView, only: (k: TitleKey) => boolean): SwnTier[] {
	const fits = view.tiers.filter((t) => FITS.has(t.key)).flatMap((t) => t.keys.filter(only))
	return [
		{ key: "upNext", label: "Up next", note: null, size: "lg", keys: fits.slice(0, 3) },
		{ key: "soon", label: "Soon", note: null, size: "md", keys: fits.slice(3, 9) },
		{ key: "later", label: "Later", note: null, size: "sm", keys: fits.slice(9) },
		...view.tiers.filter((t) => !FITS.has(t.key)).map((t) => ({ ...t, size: SMALLER[t.size], keys: t.keys.filter(only) })),
	]
}

export function Grouped({ view }: { view: SwnView }) {
	const tiers: SwnTier[] = view.tiers
	const order = tiers.flatMap((t) => t.keys)
	const first = (id: string | null) => {
		const i = order.findIndex((k) => (view.sideOf[k] ?? null) === id)
		return i < 0 ? Number.POSITIVE_INFINITY : i
	}
	const sides = [...view.sides].sort((a, b) => first(a.id) - first(b.id))
	const unsided = order.filter((k) => !view.sideOf[k]).length
	return (
		<div className={`${WRAP} pt-8`}>
			<header className="mb-8 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
				<span className="hidden md:block" />
				<div>
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>After that, by side</h2>
					<p className="mt-1 text-sm text-gray-400">The rest of your {view.list === "movies" ? "movies" : "Wishlist"}, one side of you at a time, each by Best match.</p>
				</div>
			</header>
			{sides.map((side) => {
				const i = view.sides.indexOf(side)
				const n = order.filter((k) => view.sideOf[k] === side.id).length
				return (
					<section key={side.id} aria-label={view.names ? side.name : `Side ${i + 1}`} className="mb-6 border-t border-white/10 pt-6">
						<header className="mb-5 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
							<div className="flex items-center gap-3 md:justify-end">
								<span className="h-8 w-1.5 rounded-full md:order-last" style={{ background: side.color }} aria-hidden />
								<SideFaces side={side} view={view} size="md" />
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 md:mt-0">
								<div>
									<h3 className={`${DISPLAY} text-xl text-white md:text-2xl`}>{view.names ? side.name : `Side ${i + 1}`}</h3>
									<p className="text-sm text-gray-400">
										{pct(side.share)} of what you love · {n} more here, {side.fitting} fit tonight
									</p>
								</div>
								<MoodButton side={side} />
							</div>
						</header>
						{n ? (
							<Tiers view={view} tiers={sideTiers(view, (k) => view.sideOf[k] === side.id)} />
						) : (
							<p className="pb-6 text-sm text-gray-400 md:ml-[14rem]">Nothing from this side on your list yet.</p>
						)}
					</section>
				)
			})}
			{unsided > 0 && (
				<section aria-label="The rest" className="border-t border-white/10 pt-6">
					<header className="mb-5 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
						<span className="hidden md:block" />
						<p className="text-sm text-gray-400">And {unsided} more that belong to no side</p>
					</header>
					<Tiers view={view} tiers={sideTiers(view, (k) => !view.sideOf[k]).map((t) => ({ ...t, size: "sm" as const }))} />
				</section>
			)}
		</div>
	)
}
