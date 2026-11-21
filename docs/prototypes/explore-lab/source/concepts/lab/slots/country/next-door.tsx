// PROTOTYPE - throwaway (prototype/explore-r5, slot "country"; round 7). The round 4 country page with two bands: under
// its head, the countries next door on the real map (each its flag-filled shape and how its titles differ); under the
// list, "Where to go from here" (six ways to narrow it and the countries alike in feel, onward.tsx), in place of "Goes
// well with" and "Close to". The owner liked both round 6 variants: "lets include both but avoid obvious duplication",
// so a country next door is never listed again as alike. No link to the Map for now (owner).
import { Link } from "@remix-run/react"
import { Caption } from "~/ui/eyebrow"
import { ing, kindNoun, place } from "../../../../kit/address"
import { FOCUS, WRAP } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import { hasCountryShape } from "../../../../kit/world-map/CountryShape"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import { PlacePage } from "../../../rooms/place"
import { roomsNotes } from "../../baselines"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { NextDoorData } from "./next-door.server"
import { Onward } from "./onward"

function NextDoor({
	data,
	hrefOf,
	noun,
}: {
	data: NextDoorData
	hrefOf: (slug: string) => string
	noun: string
}) {
	if (!data.doors.length) return null
	const here = data.page.parts[0]?.label ?? "here"
	return (
		<nav aria-label="Countries next door" className={`${WRAP} pb-8`}>
			<div className="flex items-baseline justify-between gap-4 border-t border-white/[0.07] pt-5">
				<Caption as="h2">{data.adjacent ? "Next door" : "Closest on the map"}</Caption>
			</div>
			<ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-4">
				{data.doors.map((d) => (
					<li key={d.place.slug} className="min-w-0">
						<Link
							to={hrefOf(d.place.slug)}
							prefetch="intent"
							title={`${d.place.label}: ${d.differs || "next door"} than ${noun} from ${here}`}
							className={`group flex items-center gap-3.5 rounded-xl py-2 pr-2 ${FOCUS}`}
						>
							<span
								className={`grid h-14 w-16 shrink-0 place-items-center group-hover:-translate-y-0.5 motion-reduce:transform-none ${QUICK_T}`}
							>
								<FlagShape
									code={d.place.code ?? ""}
									size={hasCountryShape(d.place.code) ? Math.max(40, d.size) : 34}
								/>
							</span>
							<span className="min-w-0">
								<span className="flex items-baseline gap-1.5">
									<span className="truncate font-display text-lg leading-tight font-bold tracking-tight text-white transition-colors group-hover:text-amber-200">
										{d.place.label}
									</span>
									<span
										aria-hidden
										className="text-white/35 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
									>
										›
									</span>
								</span>
								{d.differs && (
									<span
										className="block truncate text-sm font-semibold"
										style={{ color: d.trait?.color }}
									>
										{d.differs.charAt(0).toUpperCase() + d.differs.slice(1)}
									</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	)
}

function View({ data, lab: _lab, ...page }: PageViewProps<NextDoorData>) {
	const kind = page.address.kind
	return (
		<PlacePage
			{...page}
			data={data.page}
			afterHead={
				<NextDoor
					data={data}
					hrefOf={(slug) => page.to(place(kind, [ing("country", slug)]))}
					noun={kindNoun(kind)}
				/>
			}
			stage={{ onward: <Onward data={data} to={page.to} kind={kind} /> }}
		/>
	)
}

export const variant: SlotVariant<NextDoorData> = {
	id: "next-door",
	name: "Next door",
	what: "The round 4 page with the countries next door under the head, and one band under the list: six ways to narrow it and the countries alike in feel (never one already next door).",
	order: 1,
	View,
	notes: (props) => [
		{
			term: "Next door",
			means:
				"The countries that lie closest on the real map (not the ones most alike: those are under the list). Each is its flag-filled shape; the colored word says how its titles differ from this country's. A country far from every other one says 'Closest on the map' instead.",
			isNew: true,
		},
		{
			term: "Where to go from here",
			means:
				"Under the list: six ways to narrow the country (two genres, two moods, a decade, a theme or style; never two that cover the same titles), and countries alike in feel. A country already next door isn't repeated.",
			isNew: true,
		},
		...roomsNotes({ ...props, data: props.data.page }),
	],
}
