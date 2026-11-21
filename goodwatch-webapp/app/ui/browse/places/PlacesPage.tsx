// The places index: the countries page with the
// map across the full width and the dials right under it. Turn a dial and the map lights the countries that fit; the
// cards below fall into the same order.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useState } from "react"
import { ing, kindLabel, kindNoun, place } from "~/domain/browse/address"
import { PANEL, PLACE_STRIP, WRAP } from "~/ui/browse/index"
import { TunerRow, tunedLine, useSteps, useTuner } from "~/ui/browse/dials/Tuner"
import { type DialSpec, type Settings, settingsOf } from "~/domain/browse/tune"
import type { BrowseViewProps } from "~/ui/browse/view"
import { PeekCard } from "~/ui/browse/cards/PeekCard"
import { AtlasMap } from "~/ui/browse/places/AtlasMap"
import { CountryIndex, type IndexCountry, matches } from "~/ui/browse/places/CountryIndex"
import { type RegionId, boxAround, regionBox, regionOf } from "~/ui/browse/places/geo"
import { PlacesHead } from "~/ui/browse/places/pieces"
import type { TunedData, TunedPlace } from "~/server/browse/places-page.server"
// the map's warm fit scale with numbered places, and colors that glide while a knob moves.
// countries wear their flags (and keep them, dimmed, while a dial lights the ones that fit); the map zooms
// and pans; every country with a page is listed, findable by search and by region.

const CARDS = 8
/** How many countries carry their place on the map, and where the camera moves in. */
const LIT = 6
/** How far down the order the warm scale reaches; the rest step back. */
const GRADED = 14

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** The countries, the best fit for the dials first. With no dial set: their own order (the biggest first). */
export function ranked(countries: TunedPlace[], dials: DialSpec[], settings: Settings) {
	const active = dials.filter((d) => settings[d.id] != null)
	if (!active.length) return { order: countries, fit: null as Record<string, number> | null }
	// with every country listed, a country with a handful of titles would win on a lucky average; how much
	// there is to see counts a little, so the first places go to countries you can actually spend evenings in.
	const heaviest = Math.max(1, ...countries.map((c) => c.weight ?? 0))
	const scored = countries.map((c, index) => {
		const share = (c.weight ?? 0) / heaviest
		// A few titles say less about where a country sits: its place is pulled toward the middle by how little there is.
		const sure = clamp01(share ** 0.2 * 1.6)
		let cost = index * 0.0005 + 0.6 * (1 - share ** 0.25)
		for (const d of active) {
			const at = 0.5 + (c.at[d.col] - 0.5) * Math.max(0.25, sure)
			cost += Math.abs(at - (settings[d.id] as number))
		}
		return { c, cost }
	})
	scored.sort((a, b) => a.cost - b.cost)
	const fit: Record<string, number> = {}
	scored.forEach(({ c }, rank) => {
		if (c.place.code) fit[c.place.code] = rank < GRADED ? (1 - rank / GRADED) ** 1.15 : 0
	})
	return { order: scored.map((s) => s.c), fit }
}

export function PlacesPage({ data, address, to }: BrowseViewProps<TunedData>) {
	const kind = address.kind
	const reduce = useReducedMotion()
	const tuner = useTuner(data.dials)
	const [hot, setHot] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [region, setRegion] = useState<RegionId | null>(null)
	const hrefOf = (c: TunedPlace) => to(place(kind, [ing("country", c.place.slug)]))
	// The map follows the knob as it moves; the cards take a step a few times a second so they never blur.
	const live = useMemo(
		() => ranked(data.countries, data.dials, tuner.settings),
		[data.countries, data.dials, tuner.settings],
	)
	const stepped = useSteps(tuner.settings)
	const settled = useMemo(
		() => ranked(data.countries, data.dials, stepped),
		[data.countries, data.dials, stepped],
	)
	const best = tuner.tuned ? (live.order[0]?.place.code ?? null) : null
	const index: IndexCountry[] = useMemo(
		() =>
			data.countries.flatMap((c) =>
				c.place.code
					? [
							{
								code: c.place.code,
								name: c.place.label,
								href: to(place(kind, [ing("country", c.place.slug)])),
								line: c.copy?.short ?? null,
							},
						]
					: [],
			),
		// biome-ignore lint/correctness/useExhaustiveDependencies: `to` is stable per page
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- `to` is stable per page
		[data.countries, kind],
	)
	// A search quiets the countries it leaves out; a region (or a search with a handful of matches) moves the map there.
	const found = query.trim() ? index.filter((c) => matches(c, query)) : null
	const quiet = useMemo(
		() => (found ? new Set(index.filter((c) => !found.includes(c)).map((c) => c.code)) : null),
		[found, index],
	)
	// Once a dial is let go (its stop is in the address), the map moves in on the countries it lit, when they lie
	// close enough together to come closer.
	const dialTarget = useMemo(() => {
		const at = ranked(data.countries, data.dials, settingsOf(data.dials))
		return at.fit ? boxAround(at.order.slice(0, LIT).map((c) => c.place.code ?? "")) : boxAround([])
	}, [data.countries, data.dials])
	const target = useMemo(() => {
		if (found && found.length > 0 && found.length <= 6) return boxAround(found.map((c) => c.code))
		if (region)
			return regionBox(index.filter((c) => regionOf(c.code) === region).map((c) => c.code))
		return dialTarget
	}, [found, region, index, dialTarget])
	const mapCountries = useMemo(
		() =>
			data.countries.map((c) => ({
				code: c.place.code ?? "",
				name: c.place.label,
				href: to(place(kind, [ing("country", c.place.slug)])),
				weight: c.weight,
			})),
		// biome-ignore lint/correctness/useExhaustiveDependencies: `to` is stable per page
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- `to` is stable per page
		[data.countries, kind],
	)
	const cards = settled.order.slice(0, CARDS)
	const said = tunedLine(data.dials, tuner.settings)

	return (
		<>
			<PlacesHead
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} by country`}
				lede={data.lede}
			/>
			<div className={`${WRAP} space-y-12 pb-4`}>
				<div className="space-y-3">
					<section aria-label="The map" className={`${PANEL} overflow-hidden !bg-white/[0.03]`}>
						<AtlasMap
							countries={mapCountries}
							target={target}
							docked={best}
							hot={hot}
							onHot={setHot}
							fit={live.fit}
							flags
							zoom
							quiet={quiet}
							named={best ? [best] : found?.length === 1 ? [found[0].code] : undefined}
							ranks={
								live.fit
									? live.order.slice(0, LIT).flatMap((c) => (c.place.code ? [c.place.code] : []))
									: undefined
							}
							legend={{ low: "Fits less", high: "Fits best" }}
							className="aspect-[16/10] sm:aspect-[2.6/1]"
							label={`Map of the world: ${kindNoun(kind)} by country`}
						/>
					</section>
					<TunerRow dials={data.dials} tuner={tuner} />
				</div>

				<section aria-label={tuner.tuned ? "The countries that fit" : "The biggest"}>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 className="font-display text-2xl font-bold tracking-tight text-white">
							{tuner.tuned ? "Best fits" : "Most titles"}
						</h2>
						{tuner.tuned && (
							<p aria-live="polite" className="text-sm text-gray-400">
								{said}
							</p>
						)}
					</div>
					<div className={`mt-5 ${PLACE_STRIP}`}>
						<AnimatePresence initial={false} mode="popLayout">
							{cards.map((c) => (
								<motion.div
									key={c.place.slug}
									layout={reduce ? false : "position"}
									initial={reduce ? false : { opacity: 0, scale: 0.97 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, transition: { duration: 0.12 } }}
									transition={{
										layout: { duration: 0.38, ease: [0.65, 0, 0.35, 1] },
										opacity: { duration: 0.22 },
									}}
									onPointerEnter={(e) => e.pointerType === "mouse" && setHot(c.place.code ?? null)}
									onPointerLeave={(e) => e.pointerType === "mouse" && setHot(null)}
									className={`rounded-2xl transition-shadow duration-200 ${
										hot === c.place.code ? "ring-2 ring-white/40" : ""
									}`}
								>
									<PeekCard {...c} href={hrefOf(c)} />
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</section>
				{/* the cards that answer the dials sit right under the map again; every country follows. */}
				<CountryIndex
					countries={index}
					query={query}
					onQuery={setQuery}
					region={region}
					onRegion={setRegion}
					hot={hot}
					onHot={setHot}
				/>
			</div>
		</>
	)
}
