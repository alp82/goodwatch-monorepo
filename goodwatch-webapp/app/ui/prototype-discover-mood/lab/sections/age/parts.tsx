// PROTOTYPE (Discover lab): the age and content filter as the real AgeContent controls write it (~/domain/age-content):
// the age limit is a step of the viewer's ladder, content choices are overrides kept as given.
import { CheckIcon, MinusIcon, PlusIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { CONTENT_KINDS, type ContentKind, type LadderStep, MAX_AGE, changedContent, hiddenKinds, ladderStepFor, withContentChoice } from "~/domain/age-content"
import { dropFilter } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { CONTENT_LABELS, compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { SearchField } from "~/ui/filter-bar/SheetControls"
import type { ProtoDiscover } from "../../../kit"
import type { Pieces } from "../../types"
import { type Country, CountryChip, CountryMatches } from "../origin/country-find"

export function useAge(d: ProtoDiscover, pieces: Pieces) {
	const s = d.filters.state
	const ladder = pieces.groups.ladder ?? null
	const steps: readonly LadderStep[] = ladder?.steps ?? []
	const selected = s.ageLimit === undefined || !steps.length ? null : ladderStepFor(steps, s.ageLimit)
	const hidden = hiddenKinds(s.ageLimit, s.content)
	const changed = changedContent(s.ageLimit, s.content) ?? {}
	const touched = useRef(false)
	return {
		ladder,
		/** The age limit as given (may sit between steps), undefined when off. */
		limit: s.ageLimit,
		/** FreeAge only: set once the person moves it, so Off isn't overwritten on mount. */
		touched,
		steps,
		selected,
		hidden,
		changed,
		stepCount: (age: number) => d.counts?.optionCounts.ageLimit?.[String(age)] ?? null,
		offCount: d.counts?.optionCounts.ageLimit?.off ?? null,
		kindCount: (k: ContentKind) => d.counts?.optionCounts.content?.[k] ?? null,
		/** Content choices stay as they are, also the ones the new limit sets anyway (like the real control). */
		pick: (age: number) => d.filters.set({ ageLimit: age }),
		off: () => {
			touched.current = false
			d.filters.update((st) => dropFilter(st, "ageLimit"))
		},
		setKind: (k: ContentKind, show: boolean) =>
			d.filters.update((st) => ({ ...st, content: withContentChoice(st.ageLimit, st.content, k, show ? "show" : "hide") })),
		resetContent: () => d.filters.set({ content: undefined }),
	}
}
export type Age = ReturnType<typeof useAge>

export const KINDS = CONTENT_KINDS
const kindLabel = (k: ContentKind) => CONTENT_LABELS[k].full

/** One kind of content as a checklist row: ticked shows, unticked is struck through with how many it hides. */
export function KindRow({ age, k, roomy }: { age: Age; k: ContentKind; roomy?: boolean }) {
	const hides = age.hidden.includes(k)
	const mine = Boolean(age.changed[k])
	const n = age.kindCount(k)
	return (
		<motion.button
			type="button"
			role="checkbox"
			aria-checked={!hides}
			whileTap={TAP}
			onClick={() => age.setKind(k, hides)}
			className={`flex w-full items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400 ${roomy ? "h-12" : "h-10"}`}
		>
			<span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${hides ? "ring-1 ring-white/25" : "bg-emerald-500 text-white"}`}>
				{!hides && <CheckIcon className="h-4 w-4" />}
			</span>
			<span className={`truncate text-[14px] ${hides ? "text-gray-500 line-through" : "text-gray-100"}`}>{kindLabel(k)}</span>
			{mine && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
			{n !== null && (
				<span className="ml-auto shrink-0 text-[12px] tabular-nums text-gray-500">
					{compactCount(n)}
					{hides && " hidden"}
				</span>
			)}
		</motion.button>
	)
}

export function NoLadder() {
	return <div className="px-7 py-6 text-[14px] text-gray-500">No age ratings for this country</div>
}

// ---------------------------------------------------------------------------------------------------------------
// Round 7: whose ratings, and a free age.
//
// The API has no rating-country parameter of its own: the ladder is the one of the request's viewing country, which is
// the viewer's country or `streamingCountry` when set (filterTitles). So the switcher writes `streamingCountry`, which
// also moves the streaming offers to that country, as the Services card's "Streaming in…" does.

/** Countries with a ladder of their own in the title snapshot (checked against the live results, 2026-10-28). */
const LADDER_COUNTRIES = [
	"US", "GB", "DE", "FR", "ES", "IT", "NL", "IN", "JP", "KR", "BR", "CA", "AU", "SE", "TR", "AR", "AT", "BE", "BG",
	"CH", "CL", "CZ", "DK", "FI", "GR", "HK", "HU", "ID", "IE", "IL", "LT", "LU", "LV", "MX", "MY", "NO", "NZ", "PH",
	"PL", "PT", "RO", "RU", "SG", "SK", "TH", "TW", "UA", "ZA",
]
const QUICK_COUNTRIES = ["US", "GB", "DE", "FR", "IN", "JP"]

function useRatingCountry(d: ProtoDiscover, age: Age) {
	const country = d.filters.state.streamingCountry ?? age.ladder?.country ?? "US"
	return { country, set: (code: string) => d.filters.set({ streamingCountry: code }) }
}

/** Every ladder country by name, the current one always in. */
const ratingCountries = (current: string): Country[] =>
	[...new Set([current, ...LADDER_COUNTRIES])].map((code) => ({ code, name: productionCountryName(code) })).sort((a, b) => a.name.localeCompare(b.name))

/**
 * Quick flag chips (the current country first when it isn't one, so the row keeps its length) and Made in's "Find a
 * country" field. Its matches show in place of the ladder (CountryFound), not in a popup.
 */
export function CountrySwitch({
	d,
	age,
	phone,
	term,
	setTerm,
}: { d: ProtoDiscover; age: Age; phone: boolean; term: string; setTerm: (t: string) => void }) {
	const { country, set } = useRatingCountry(d, age)
	const n = phone ? 4 : QUICK_COUNTRIES.length
	const quick = (QUICK_COUNTRIES.includes(country) ? QUICK_COUNTRIES : [country, ...QUICK_COUNTRIES]).slice(0, n)
	return (
		<div className={`flex gap-1.5 ${phone ? "flex-col" : "items-center"}`}>
			<div className="flex items-center gap-1.5">
				<span className="mr-1 shrink-0 text-[12px] whitespace-nowrap text-gray-500">Ratings in</span>
				{quick.map((code) => (
					<CountryChip key={code} code={code} short active={country === code} onClick={() => set(code)} />
				))}
			</div>
			<div className={phone ? "" : "w-[190px]"}>
				<SearchField value={term} onChange={setTerm} placeholder="Find a country" />
			</div>
		</div>
	)
}

/** The ladder countries the search matches; a pick sets the country and ends the search. */
export function CountryFound({ d, age, term, setTerm }: { d: ProtoDiscover; age: Age; term: string; setTerm: (t: string) => void }) {
	const { country, set } = useRatingCountry(d, age)
	return (
		<CountryMatches
			list={ratingCountries(country)}
			term={term}
			isOn={(c) => c === country}
			onPick={(c) => {
				set(c)
				setTerm("")
			}}
			className="absolute inset-0 flex flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain"
		/>
	)
}

/**
 * A free age, 0 to 18, written as the age limit as given: the filter stands it for the highest step at or below it on
 * the chosen ladder (ladderStepFor), and content defaults go by the age itself, both like a shared link's age.
 */
export function FreeAge({ age, phone }: { age: Age; phone: boolean }) {
	const limit = age.limit
	const [v, setV] = useState(limit ?? 12)
	useEffect(() => {
		if (limit !== undefined) setV(limit)
	}, [limit])
	useEffect(() => {
		if (limit === v) return
		if (limit === undefined && !age.touched.current) return
		const id = setTimeout(() => age.pick(v), 300)
		return () => clearTimeout(id)
	})
	const set = (n: number) => {
		age.touched.current = true
		setV(Math.min(MAX_AGE, Math.max(0, n)))
	}
	const step = age.steps.length ? ladderStepFor(age.steps, v) : null
	const pct = (x: number) => (x / MAX_AGE) * 100
	const on = limit !== undefined
	const btn =
		"grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-gray-200 cursor-pointer outline-none hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-30"
	return (
		<div className={`flex ${phone ? "flex-col gap-3" : "items-center gap-5"}`}>
			<div className="flex shrink-0 items-center gap-2">
				<span className="text-[14px] text-gray-300">Watching with a</span>
				<motion.button type="button" whileTap={TAP} aria-label="Younger" disabled={v <= 0} onClick={() => set(v - 1)} className={btn}>
					<MinusIcon className="h-4 w-4" />
				</motion.button>
				<span className={`w-8 text-center text-[22px] font-bold tabular-nums ${on ? "text-white" : "text-gray-400"}`}>{v}</span>
				<motion.button type="button" whileTap={TAP} aria-label="Older" disabled={v >= MAX_AGE} onClick={() => set(v + 1)} className={btn}>
					<PlusIcon className="h-4 w-4" />
				</motion.button>
				<span className="text-[14px] text-gray-300">year old</span>
			</div>
			<div className="min-w-0 flex-1">
				<div className="relative h-6">
					<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-white/10" />
					<div className={`absolute top-[10px] left-0 h-1 rounded-full ${on ? "bg-amber-400" : "bg-white/25"}`} style={{ width: `${pct(v)}%` }} />
					{age.steps.map((s) => (
						<span key={s.age} className="absolute top-[7px] h-2.5 w-[2px] -translate-x-1/2 rounded bg-white/30" style={{ left: `${pct(s.age)}%` }} />
					))}
					<input
						type="range"
						aria-label="Age"
						min={0}
						max={MAX_AGE}
						step={1}
						value={v}
						onChange={(e) => set(Number(e.target.value))}
						className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent outline-none [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,.6)]"
					/>
				</div>
				<div className="relative mt-1 h-4 text-[11px] text-gray-500">
					{age.steps.map((s) => (
						<span key={s.age} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(s.age)}%` }}>
							{s.label}
						</span>
					))}
				</div>
			</div>
			<span className={`shrink-0 text-[13px] ${phone ? "" : "w-[150px] text-right"} ${on ? "text-gray-200" : "text-gray-500"}`}>
				{step ? `Up to ${step.label}${step.show ? ` · ${step.show}` : ""}` : ""}
			</span>
		</div>
	)
}
