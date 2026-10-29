// Watch > Made in. "Find a country" and Any country on top; then Popular countries as flag chips, Film industries
// (Rest of the world last) and Regions, each with its count. A set reads on when all its countries are picked; a
// partly picked region says how many. Find's matches show in place of the columns, so nothing moves.
//
// Counts come with `counts=origin` (optionCounts.productionCountries: `<code>`, `set:<id>`, `world`) and show only
// when the response has them.
import { GlobeAltIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { BIG_EIGHT, INDUSTRIES, REGIONS } from "~/domain/film-industries"
import { productionCountryName } from "~/domain/production-country"
import { Chip, SearchField } from "~/ui/filter-bar/SheetControls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { countryFlagUrl } from "~/utils/country-flag"
import type { SubTabView } from "../DiscoverControls"
import { CountryChip, CountryMatches, countriesOf } from "./CountryChip"
import {
	anyCountry,
	anyCountryPatch,
	findableCodes,
	originCount,
	picked,
	popularCountries,
	setOn,
	setPicked,
	toggleCountryPatch,
	toggleRestOfWorldPatch,
	toggleSetPatch,
} from "./made-in-choices"
import { tabPad } from "./parts"

const LABEL = "text-[11px] font-bold tracking-wide text-gray-500 uppercase"
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

function Flag({ code, className }: { code: string; className: string }) {
	return (
		<img
			src={countryFlagUrl(code)}
			alt=""
			loading="lazy"
			className={`shrink-0 rounded-[3px] object-cover ring-2 ring-gray-950 ${className}`}
		/>
	)
}

function ColumnHead({ children, note }: { children: string; note?: string }) {
	return (
		<div className="mb-2 flex h-5 items-center gap-2">
			<span className={LABEL}>{children}</span>
			{note && <span className="text-[11px] text-gray-500">{note}</span>}
		</div>
	)
}

/** A set as one row: its flags, its name, "N picked" while partly picked, and its count. */
function SetRow({
	name,
	on,
	some,
	count,
	art,
	tall,
	className = "",
	onClick,
}: {
	name: string
	on: boolean
	some: number
	count: number | null
	art: ReactNode
	tall: boolean
	className?: string
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={onClick}
			className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left text-[13px] cursor-pointer ${FOCUS} ${tall ? "h-9" : "h-8"} ${className} ${
				on
					? "bg-white font-semibold text-gray-950"
					: "bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]"
			}`}
		>
			{art}
			<span className="min-w-0 flex-1 truncate">{name}</span>
			{some > 0 && (
				<span className="shrink-0 text-[11px] text-amber-300/90">
					{some} picked
				</span>
			)}
			<span
				className={`shrink-0 text-[12px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}
			>
				{count === null ? "" : compactCount(count)}
			</span>
		</motion.button>
	)
}

const flags = (codes: readonly string[], max: number, size: string) => (
	<span className={`flex shrink-0 ${max > 3 ? "-space-x-1.5" : "-space-x-2"}`}>
		{codes.slice(0, max).map((code) => (
			<Flag key={code} code={code} className={size} />
		))}
	</span>
)

export function MadeInTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, set, update } = view.filters
	const [term, setTerm] = useState("")
	const counts = view.counts?.optionCounts.productionCountries
	const count = (key: string) => originCount(counts, key)
	const chosen = picked(state)
	const popular = popularCountries(state)
	const finding = term.trim() !== ""
	const none = anyCountry(state)

	const scroll = phone
		? ""
		: "-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1"
	const columns = (
		<div
			className={
				phone
					? "flex flex-col gap-5"
					: "grid h-full min-h-0 grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,0.85fr)] gap-7"
			}
		>
			<section className="flex min-h-0 flex-col">
				<ColumnHead
					note={popular.more ? `${popular.more} more picked` : undefined}
				>
					Popular
				</ColumnHead>
				<div className={`flex flex-wrap content-start gap-1.5 ${scroll}`}>
					{popular.codes.map((code) => (
						<CountryChip
							stableWidth
							key={code}
							code={code}
							active={chosen.includes(code)}
							count={count(code)}
							onClick={() => set(toggleCountryPatch(state, code))}
						/>
					))}
				</div>
			</section>
			<section className="flex min-h-0 flex-col">
				<ColumnHead>Film industries</ColumnHead>
				<div className={`grid grid-cols-2 content-start gap-1 ${scroll}`}>
					{INDUSTRIES.map((industry) => (
						<SetRow
							key={industry.id}
							name={industry.name}
							on={setOn(state, industry.codes)}
							some={0}
							count={count(`set:${industry.id}`)}
							art={flags(industry.codes, 3, "h-3.5 w-5")}
							tall={false}
							onClick={() => set(toggleSetPatch(state, industry.codes))}
						/>
					))}
					<SetRow
						name="Rest of the world"
						className={phone ? "col-span-2" : ""}
						on={Boolean(state.restOfWorld)}
						some={0}
						count={count("world")}
						art={
							<GlobeAltIcon
								aria-label={`Any country but ${BIG_EIGHT.map(productionCountryName).join(", ")}`}
								className={`h-4 w-5 shrink-0 ${state.restOfWorld ? "text-gray-700" : "text-gray-400"}`}
							/>
						}
						tall={false}
						onClick={() => set(toggleRestOfWorldPatch(state))}
					/>
				</div>
			</section>
			<section className="flex min-h-0 flex-col">
				<ColumnHead>Regions</ColumnHead>
				<div className={`flex flex-col gap-1 ${scroll}`}>
					{REGIONS.map((region) => {
						const on = setOn(state, region.codes)
						return (
							<SetRow
								key={region.id}
								name={region.name}
								on={on}
								some={on ? 0 : setPicked(state, region.codes)}
								count={count(`set:${region.id}`)}
								art={flags(region.codes, 4, "h-4 w-6")}
								tall
								onClick={() => set(toggleSetPatch(state, region.codes))}
							/>
						)
					})}
				</div>
			</section>
		</div>
	)

	return (
		<div className={`${tabPad(phone)} flex flex-col gap-4`}>
			<div
				className={phone ? "flex flex-col gap-2" : "flex items-center gap-3"}
			>
				<div className={phone ? "" : "w-[420px]"}>
					<SearchField
						value={term}
						onChange={setTerm}
						placeholder="Find a country"
					/>
				</div>
				<div className="flex">
					<Chip
						o={{
							id: "any",
							label: "Any country",
							active: none,
							count: none ? (view.counts?.total ?? null) : null,
							toggle: () => update((st) => ({ ...st, ...anyCountryPatch() })),
						}}
					/>
				</div>
			</div>
			{/* Find's matches take the columns' place, so nothing below the field moves. */}
			<div className={`relative ${phone ? "" : "min-h-0 flex-1"}`}>
				<div
					className={`${phone ? "" : "h-full"} ${finding ? "invisible" : ""}`}
					aria-hidden={finding || undefined}
				>
					{columns}
				</div>
				{finding && (
					<CountryMatches
						stableWidth
						list={countriesOf(findableCodes(state, counts))}
						term={term}
						isOn={(code) => chosen.includes(code)}
						countOf={count}
						onPick={(code) => set(toggleCountryPatch(state, code))}
						className="absolute inset-0 flex flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain"
					/>
				)}
			</div>
		</div>
	)
}
