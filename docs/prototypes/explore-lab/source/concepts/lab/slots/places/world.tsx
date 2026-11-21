// PROTOTYPE - throwaway (prototype/explore-r7, slot "places"). The world map as the whole page: the map fills the
// screen and the plain wheel zooms it. Beside it, a panel that follows the map: a search, the country you point at
// (its card), and the countries in view, biggest first. Pan to Africa and the panel lists Africa. The dials sit under
// the map and light it as on Dials on the map.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useMemo, useState } from "react"
import { ing, kindLabel, kindNoun, place } from "../../../../kit/address"
import { FOCUS, WRAP } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import { type Box, SHAPE_BY_CODE } from "../../../../kit/world-map/geometry"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import { TunerRow, tunedLine, useTuner } from "../../../dials/Tuner"
import { settingsOf } from "../../../dials/tune"
import type { PageViewProps, SlotVariant } from "../../contract"
import { Part } from "../../lab"
import { AtlasMap, WORLD } from "./AtlasMap"
import { matches } from "./CountryIndex"
import { boxAround } from "./geo"
import { PlacesHead } from "./pieces"
import type { TunedData, TunedPlace } from "./tuned.server"
import { ranked } from "./tuned"

/** Inside the view: the country's label point lies in the box. */
const inView = (code: string, box: Box | null) => {
	if (!box) return true
	const at = SHAPE_BY_CODE.get(code.toUpperCase())?.at
	return Boolean(at && at[0] >= box[0] && at[0] <= box[2] && at[1] >= box[1] && at[1] <= box[3])
}

function View({ data, address, to }: PageViewProps<TunedData>) {
	const kind = address.kind
	const reduce = useReducedMotion()
	const tuner = useTuner(data.dials)
	const [hot, setHot] = useState<string | null>(null)
	const [picked, setPicked] = useState<string | null>(null)
	const [query, setQuery] = useState("")
	const [view, setView] = useState<Box | null>(null)
	const hrefOf = (c: TunedPlace) => to(place(kind, [ing("country", c.place.slug)]))
	const live = useMemo(
		() => ranked(data.countries, data.dials, tuner.settings),
		[data.countries, data.dials, tuner.settings],
	)
	const byCode = useMemo(
		() => new Map(data.countries.map((c) => [c.place.code ?? "", c])),
		[data.countries],
	)
	const found = query.trim()
		? data.countries.filter((c) =>
				matches({ code: c.place.code ?? "", name: c.place.label, href: "" }, query),
			)
		: null
	const quiet = useMemo(
		() =>
			found
				? new Set(data.countries.filter((c) => !found.includes(c)).map((c) => c.place.code ?? ""))
				: null,
		[found, data.countries],
	)
	const dialTarget = useMemo(() => {
		const at = ranked(data.countries, data.dials, settingsOf(data.dials))
		return at.fit ? boxAround(at.order.slice(0, 6).map((c) => c.place.code ?? "")) : boxAround([])
	}, [data.countries, data.dials])
	const target =
		found && found.length > 0 && found.length <= 6
			? boxAround(found.map((c) => c.place.code ?? ""))
			: dialTarget
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
	// The panel's list: what the map shows (or what the search finds), in the dials' order when one is set.
	const list = (found ?? live.order.filter((c) => inView(c.place.code ?? "", view))).slice(0, 40)
	const focus = byCode.get(hot ?? picked ?? "") ?? (tuner.tuned ? live.order[0] : undefined)

	return (
		<>
			<PlacesHead
				kicker={kindLabel(kind)}
				title={`${kindLabel(kind)} around the world`}
				lede="Zoom with the wheel, a pinch, or the buttons, and drag to move. The list beside the map follows it."
			/>
			<div className={`${WRAP} space-y-3 pb-4`}>
				{/* Round 8: the map's frame has the world's own proportions, so land fills it edge to edge (no empty sea
				    bands), and the list beside it is laid over its cell so it never makes the row taller. */}
				<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<section
						aria-label="The map"
						className="overflow-hidden rounded-2xl ring-1 ring-white/[0.08]"
						style={{ aspectRatio: `${WORLD[2] - WORLD[0]} / ${WORLD[3] - WORLD[1]}` }}
					>
						<AtlasMap
							countries={mapCountries}
							target={target}
							docked={focus?.place.code ?? null}
							hot={hot}
							onHot={setHot}
							onDock={setPicked}
							fit={live.fit}
							flags
							zoom
							wheel="free"
							quiet={quiet}
							onView={setView}
							ranks={
								live.fit
									? live.order.slice(0, 6).flatMap((c) => (c.place.code ? [c.place.code] : []))
									: undefined
							}
							legend={{ low: "Fits less", high: "Fits best" }}
							className="h-full w-full"
							label={`Map of the world: ${kindNoun(kind)} by country`}
						/>
					</section>
					<div className="relative min-h-0">
						<aside
							aria-label="Countries in view"
							className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] max-lg:max-h-[32rem] lg:absolute lg:inset-0"
						>
							<div className="border-b border-white/[0.07] p-3">
								<label className="relative block">
									<span className="sr-only">Find a country</span>
									<svg
										aria-hidden
										viewBox="0 0 16 16"
										className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500"
										fill="none"
										stroke="currentColor"
										strokeWidth={1.8}
										strokeLinecap="round"
									>
										<circle cx="7" cy="7" r="4.5" />
										<path d="m10.5 10.5 3 3" />
									</svg>
									<input
										type="search"
										value={query}
										onChange={(e) => setQuery(e.currentTarget.value)}
										placeholder={`Find one of ${data.countries.length} countries`}
										className={`w-full rounded-full bg-white/[0.06] py-2 pr-3 pl-9 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 hover:ring-white/20 focus:ring-amber-400/70 focus:outline-none ${QUICK_T}`}
									/>
								</label>
							</div>
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
								<AnimatePresence initial={false} mode="wait">
									{focus && (
										<motion.div
											key={focus.place.slug}
											initial={reduce ? false : { opacity: 0, scale: 0.98 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, transition: { duration: 0.1 } }}
											transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
											className="border-b border-white/[0.07] p-3"
										>
											<Part slot="card" {...focus} href={hrefOf(focus)} size="s" />
										</motion.div>
									)}
								</AnimatePresence>
								<p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
									{found
										? `${found.length} found`
										: tuner.tuned
											? `In view, best fit first`
											: `In view, biggest first`}
								</p>
								<ul className="px-1.5 pb-2">
									{list.map((c) => {
										const code = c.place.code ?? ""
										return (
											<li key={c.place.slug}>
												<Link
													to={hrefOf(c)}
													prefetch="intent"
													onPointerEnter={(e) => e.pointerType === "mouse" && setHot(code)}
													onPointerLeave={(e) => e.pointerType === "mouse" && setHot(null)}
													onFocus={() => setHot(code)}
													onBlur={() => setHot(null)}
													className={`group flex items-center gap-3 rounded-lg px-2.5 py-1.5 ${QUICK_T} ${FOCUS} ${
														hot === code ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
													}`}
												>
													<span className="grid h-7 w-8 shrink-0 place-items-center">
														<FlagShape code={code} size={26} state={hot === code ? "on" : "hint"} />
													</span>
													<span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-200">
														{c.place.label}
													</span>
												</Link>
											</li>
										)
									})}
									{list.length === 0 && (
										<li className="px-3 py-4 text-sm text-gray-500">
											{found ? "No country matches." : "No country with a page in view."}
										</li>
									)}
								</ul>
							</div>
						</aside>
					</div>
				</div>
				<TunerRow dials={data.dials} tuner={tuner} />
				{tuner.tuned && (
					<p aria-live="polite" className="text-sm text-gray-400">
						{tunedLine(data.dials, tuner.settings)}. The warmer a country, the better it fits.
					</p>
				)}
			</div>
		</>
	)
}

export const variant: SlotVariant<TunedData> = {
	id: "world",
	name: "World map",
	what: "The map is the page: it fills the screen and zooms with the wheel, and a side panel lists the countries in view.",
	order: 3,
	View,
	notes: () => [
		{
			term: "The map",
			means:
				"Every country with a page in its flag. Scroll to zoom, drag to move, or use the buttons. The dials under it light the countries that fit.",
			isNew: true,
		},
		{
			term: "The panel",
			means:
				"Follows the map: the countries in view, biggest first (best fit first with a dial set), and the card of the one you point at. A search finds any country and flies the map there.",
			isNew: true,
		},
	],
}
