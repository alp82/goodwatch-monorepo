// PROTOTYPE - throwaway (prototype/explore-r6, slot "country"; round 7 a part of "next-door"). The band under a
// country's list, "Where to go from Japan": make it more specific (six pairings across families) and countries like it.
// It replaces both "Goes well with" (often a single card) and "Close to". Next door has its own band under the head
// (next-door.tsx), so a country that lies next door is not repeated here.
import { count } from "../../../../kit/count"
import { Link } from "@remix-run/react"
import { FAMILY, type Kind, ing, kindNoun, place } from "../../../../kit/address"
import type { PlaceRef } from "../../../../kit/types"
import { FOCUS, poster } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps } from "../../contract"
import { hasCountryShape } from "../../../../kit/world-map/CountryShape"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import type { NextDoorData } from "./next-door.server"

const FAMILY_TONE: Partial<Record<string, string>> = {
	genre: "#7dd3fc",
	decade: "#fcd34d",
	theme: "#c4b5fd",
	style: "#f0abfc",
}
const toneOf = (p: PlaceRef) =>
	p.family === "mood" && p.hue ? p.hue : (FAMILY_TONE[p.family] ?? "#d1d5db")
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function ColumnHead({ title, line }: { title: string; line: string }) {
	return (
		<div className="mb-3">
			<h3 className="font-display text-lg font-bold tracking-tight text-white">{title}</h3>
			<p className="text-sm text-gray-400">{line}</p>
		</div>
	)
}

export function Onward({
	data,
	to,
	kind,
}: {
	data: NextDoorData
	to: PageViewProps<NextDoorData>["to"]
	kind: Kind
}) {
	const lead = data.page.parts[0]
	const here = lead.label
	const noun = kindNoun(kind)
	const blendTo = (p: PlaceRef) =>
		to(place(kind, [ing("country", lead.slug), ing(p.family, p.slug)]))
	const countryTo = (p: PlaceRef) => to(place(kind, [ing("country", p.slug)]))
	const alike = data.alike
	if (!data.pairings.length && !alike.length) return null
	return (
		<section aria-labelledby="onward-title" className="space-y-5">
			<div>
				<h2 id="onward-title" className="font-display text-2xl font-bold tracking-tight text-white">
					Where to go from {here}
				</h2>
				<p className="mt-1 text-gray-400">
					Narrow it with one more ingredient, or move to a country that feels alike.
				</p>
			</div>
			{/* With only one of the two columns, that one takes the whole width (Cuba has no pairings). */}
			<div
				className={`grid gap-x-8 gap-y-8 ${data.pairings.length > 0 && alike.length > 0 ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}
			>
				{data.pairings.length > 0 && (
					<div>
						<ColumnHead
							title="Make it more specific"
							line={`${cap(noun)} from ${here}, and one thing more.`}
						/>
						<ul className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
							{data.pairings.map((p) => (
								<li key={`${p.place.family}-${p.place.slug}`}>
									<Link
										to={blendTo(p.place)}
										prefetch="intent"
										className={`group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] ${QUICK_T} ${FOCUS}`}
									>
										<span
											aria-hidden
											className="h-9 w-1 shrink-0 rounded-full"
											style={{ background: toneOf(p.place) }}
										/>
										<span className="min-w-0 flex-1">
											<span
												className="block text-[11px] font-bold tracking-wider uppercase"
												style={{ color: toneOf(p.place) }}
											>
												+ {p.place.label}
												<span className="ml-1.5 font-semibold text-gray-500 normal-case tracking-normal">
													{FAMILY[p.place.family].one.toLowerCase()}
												</span>
											</span>
											<span className="line-clamp-2 font-semibold text-gray-100 group-hover:text-white">
												{p.name}
											</span>
											<span className="block text-xs text-gray-500 tabular-nums">
												{count(p.count)} titles
											</span>
										</span>
										<span aria-hidden className="flex shrink-0 -space-x-3">
											{p.titles
												.slice(0, 3)
												.map((t, i) =>
													t.card.poster_path ? (
														<img
															key={t.card.key}
															src={poster(t.card.poster_path, "w92")}
															alt=""
															loading="lazy"
															decoding="async"
															className={`h-12 w-8 rounded-[4px] object-cover shadow-md ring-1 shadow-black/50 ring-black/40 ${QUICK_T} group-hover:-translate-y-0.5`}
															style={{ transitionDelay: `${i * 30}ms`, zIndex: 3 - i }}
														/>
													) : null,
												)}
										</span>
										<span
											aria-hidden
											className={`text-white/30 group-hover:translate-x-0.5 group-hover:text-white/70 ${QUICK_T}`}
										>
											›
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				)}
				{alike.length > 0 && (
					<div>
						<ColumnHead
							title={`Countries like ${here}`}
							line="Alike in feel, and how each differs."
						/>
						<CountryList
							items={alike.map((n) => ({
								place: n.place,
								differs: n.differs,
								color: n.trait?.color,
								size: 44,
							}))}
							hrefOf={countryTo}
							wide={!data.pairings.length}
						/>
					</div>
				)}
			</div>
		</section>
	)
}

function CountryList({
	items,
	hrefOf,
	wide = false,
}: {
	items: { place: PlaceRef; differs: string; color?: string; size: number }[]
	hrefOf: (p: PlaceRef) => string
	wide?: boolean
}) {
	return (
		<ul className={wide ? "grid gap-1 sm:grid-cols-2 lg:grid-cols-4" : "space-y-1"}>
			{items.map((it) => (
				<li key={it.place.slug}>
					<Link
						to={hrefOf(it.place)}
						prefetch="intent"
						className={`group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04] ${QUICK_T} ${FOCUS}`}
					>
						<span
							className={`grid h-11 w-12 shrink-0 place-items-center group-hover:-translate-y-0.5 ${QUICK_T}`}
						>
							<FlagShape
								code={it.place.code ?? ""}
								size={hasCountryShape(it.place.code) ? it.size : 30}
							/>
						</span>
						<span className="min-w-0">
							<span className="block truncate font-semibold text-gray-100 group-hover:text-white">
								{it.place.label}
							</span>
							{it.differs && (
								<span className="block truncate text-sm font-semibold" style={{ color: it.color }}>
									{cap(it.differs)}
								</span>
							)}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}
