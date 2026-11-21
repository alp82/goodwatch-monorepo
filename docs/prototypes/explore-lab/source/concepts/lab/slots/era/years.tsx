// PROTOTYPE - throwaway (prototype/explore-r5). Era page, variant "years": the Rooms decade page, with the decade's
// years on a dial that is the page's main control. At rest it is the whole decade; drag to a year and the stage
// beside it shows that year's best. Push past either end and you keep going into the next decade.
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { best, ing, kindNoun, place } from "../../../../kit/address"
import { EASE, PANEL, ShowMark, isMixed } from "../../../../kit/ui"
import { Dial } from "../../../dials/Dial"
import { type DialSpec, nearestStop } from "../../../dials/tune"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { MoreLink } from "../../../rooms/parts"
import { PlacePage } from "../../../rooms/place"
import { roomsNotes } from "../../baselines"
import type { PageViewProps, SlotVariant } from "../../contract"
import { ObsessionLink, Odometer, joined } from "../eras/bits"
import type { EraYearsData } from "./years.server"

const RISE = {
	out: { opacity: 0, y: 10 },
	in: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
	gone: { opacity: 0, transition: { duration: 0.14, ease: EASE } },
}

function View(props: PageViewProps<EraYearsData>) {
	const { data, address, to } = props
	const kind = address.kind
	const noun = kindNoun(kind)
	const { years, decade } = data
	const last = Math.max(1, years.length - 1)
	const spec = useMemo((): DialSpec => {
		const here = (year?: number) => to({ ...address, year, page: undefined })
		const exit = (p: EraYearsData["before"]) =>
			p ? { place: p, to: to(place(kind, [ing("decade", p.slug)])) } : null
		return {
			id: "year",
			kind: "year",
			question: "Which year?",
			color: "#e5e7eb",
			col: 0,
			lo: 0,
			hi: 1,
			stops: years.map((y, i) => ({
				id: String(y.year),
				name: String(y.year),
				at: i / last,
				blurb: y.titles[0] ? `The year of ${y.titles[0].card.title}.` : "",
				to: here(y.year),
			})),
			home: null,
			restName: "All of them",
			value: data.year ? String(data.year) : null,
			off: here(),
			low: String(years[0]?.year ?? ""),
			high: String(years[years.length - 1]?.year ?? ""),
			lowExit: exit(data.before),
			highExit: exit(data.after),
		}
	}, [address, data.after, data.before, data.year, kind, last, to, years])

	const [at, setAt] = useState<number | null>(() => {
		const i = years.findIndex((y) => y.year === data.year)
		return i < 0 ? null : i / last
	})
	const stop = at === null ? null : nearestStop(spec, at)
	const year = stop ? years[spec.stops.indexOf(stop)] : null
	const titles = year ? year.titles : data.top

	const [lead, ...rest] = titles
	const mixed = isMixed(titles)
	const label = year ? String(year.year) : decade.label
	const ranking = to(year ? best(kind, [], year.year) : best(kind, [ing("decade", decade.slug)]))

	// One stage: the dial runs across the top as the page's main control; under it the year (or the decade) in big
	// numerals with what it was about, its best title large with its sentence, and four more beside it.
	const stage = (
		<section
			aria-label={`The best of the ${decade.label}, by year`}
			className={`${PANEL} overflow-hidden`}
		>
			<div className="flex items-baseline gap-3 px-4 pt-4 sm:px-6">
				<h2 className={CAPTION}>Travel the {decade.label}</h2>
				<p className="truncate text-xs text-gray-500 max-sm:hidden">
					Drag the knob or tap a year. Past either end is the next decade.
				</p>
				<span className="ml-auto shrink-0">
					<MoreLink to={ranking}>The full ranking</MoreLink>
				</span>
			</div>
			<div className="px-4 pt-2 sm:px-6">
				<Dial
					spec={spec}
					at={at}
					rest="The whole decade. Drag to one of its years."
					onChange={(c) => {
						setAt(c.at)
						if (!c.final) return
						const s = c.at === null ? null : nearestStop(spec, c.at)
						// The address keeps the year, so a link opens the decade on it.
						window.history.replaceState(window.history.state, "", s ? s.to : spec.off)
					}}
				/>
			</div>
			<div className="mt-4 grid gap-x-8 gap-y-6 border-t border-white/[0.07] px-4 pt-6 pb-6 sm:px-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
				<div className="min-w-0">
					<p className="font-display font-extrabold tracking-tight text-white">
						<span className="sr-only" aria-live="polite">
							{label}
						</span>
						<Odometer value={label} className="text-6xl sm:text-7xl" />
					</p>
					<p className="mt-3 text-lg leading-snug font-semibold text-balance text-white">
						{year ? (
							<>
								<span className="text-gray-400">
									The best {noun} of {year.year},{" "}
								</span>
								led by {lead?.card.title}.
							</>
						) : (
							<>
								<span className="text-gray-400">The whole decade. </span>
								The {noun} people love most from it.
							</>
						)}
					</p>
					{data.obsessions.length > 0 && (
						<p className="mt-4 text-[15px] leading-relaxed text-gray-400">
							The {decade.label} couldn't stop making {noun} about{" "}
							{joined(
								data.obsessions.map((o) => (
									<ObsessionLink
										key={o.key}
										noun={o.noun}
										color={o.color}
										to={to(place(kind, [ing("decade", decade.slug), ing("trait", o.slug)]))}
									/>
								)),
							)}
							.
						</p>
					)}
				</div>
				<div className="relative min-w-0">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.div
							key={year?.year ?? "decade"}
							initial="out"
							animate="in"
							exit="gone"
							variants={{ in: { transition: { staggerChildren: 0.035 } } }}
							className="grid grid-cols-4 items-start gap-2.5 sm:grid-cols-[minmax(0,12.5rem)_repeat(4,minmax(0,1fr))] sm:gap-4"
						>
							{lead && (
								<motion.div
									variants={RISE}
									className="relative col-span-4 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-start gap-4 sm:col-span-1 sm:block"
								>
									<div className="relative">
										<ShowMark title={lead} mixed={mixed} />
										<TitlePosterCard card={lead.card} posterPriority="high" />
									</div>
									{lead.line && (
										<p className="text-sm leading-snug text-pretty text-gray-300 sm:mt-3 sm:line-clamp-5">
											{lead.line}
										</p>
									)}
								</motion.div>
							)}
							{rest.slice(0, 4).map((t) => (
								<motion.div key={t.card.key} variants={RISE} className="relative min-w-0">
									<ShowMark title={t} mixed={mixed} />
									<TitlePosterCard card={t.card} posterPriority="high" />
								</motion.div>
							))}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</section>
	)

	return <PlacePage {...props} data={data.rooms} stage={{ years: null, essentials: stage }} />
}

export const variant: SlotVariant<EraYearsData> = {
	id: "years",
	name: "Year dial",
	what: "The Rooms decade page with the years on a dial: rest is the whole decade, a year shows its best, past the end leads to the next decade.",
	order: 1,
	View,
	notes: (props) => [
		{
			term: "The year dial",
			means:
				"The same dial as on a mood's page, along time. At rest the stage shows the best of the whole decade; on a year, the best of that year. Drag, tap a stop or use the arrow keys.",
			isNew: true,
		},
		{
			term: "Keep going",
			means:
				"The decades on both sides sit at the dial's ends. Push the knob past the last year and you land in the next decade.",
		},
		{
			term: "The year of ...",
			means: "The line under the dial names the year's best-loved title.",
		},
		...roomsNotes({ ...props, data: props.data.rooms }).filter((n) =>
			["After the decade before", "Kinds", "Goes well with"].includes(n.term),
		),
	],
}
