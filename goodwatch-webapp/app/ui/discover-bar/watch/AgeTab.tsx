// Watch > Age and content. Left: whose ratings decide ("Ratings in" flag chips and Find a country over the countries
// with ratings; its matches show in place of the ladder, so nothing moves), the ladder as one row of big steps (Off,
// then "Up to" each step with its show rating and count), and a free age ("Watching with a 12 year old") that lands
// on the ladder's step. Right: OK to show, the sheet's content checklist.
//
// The rating country is its own choice (`ratingCountry`), apart from the streaming country; picking the streaming
// country (else the viewer's) writes none.
import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { type LadderStep, MAX_AGE, ladderStepFor } from "~/domain/age-content"
import { dropFilter } from "~/domain/filter-state"
import { ContentChecklist } from "~/ui/filter-bar/AgeContent"
import { SearchField } from "~/ui/filter-bar/SheetControls"
import { radioKeys } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { SubTabView } from "../DiscoverControls"
import { CountryChip, CountryMatches, countriesOf } from "./CountryChip"
import { createAgeCommit } from "./age-commit"
import { tabPad } from "./parts"
import {
	QUICK_RATING_COUNTRIES,
	quickCountries,
	ratingCountryPatch,
	spacedAges,
} from "./watch-choices"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const LABEL = "text-[11px] font-bold tracking-wide text-gray-500 uppercase"

function useAge(view: SubTabView) {
	const { state, set, update } = view.filters
	const [pending] = useState(createAgeCommit)
	// Any external filter update invalidates the draft, even if the age is unchanged.
	useEffect(() => {
		pending.cancel()
		return pending.cancel
	}, [pending, state])
	const pick = (age: number) => {
		pending.cancel()
		set({ ageLimit: age })
	}
	const ladder = view.data.context.ladder ?? null
	const steps: readonly LadderStep[] = ladder?.steps ?? []
	const selected =
		state.ageLimit === undefined || !steps.length
			? null
			: ladderStepFor(steps, state.ageLimit)
	const counts = view.counts?.optionCounts.ageLimit
	const countries = view.counts?.ladder?.countries
	// A pick shows at once; the server keeps a country only when the snapshot has its ratings.
	const chosen = state.ratingCountry
	const country =
		chosen && (!countries || countries.includes(chosen))
			? chosen
			: (ladder?.country ?? "US")
	return {
		ladder,
		steps,
		selected,
		limit: state.ageLimit,
		country,
		/** Countries with ratings; the quick picks until the first answer names them. */
		countries: countriesOf([
			country,
			...(countries?.length ? countries : QUICK_RATING_COUNTRIES),
		]),
		stepCount: (age: number) => counts?.[String(age)] ?? null,
		pick,
		schedulePick: (age: number) => pending.schedule(age, pick),
		off: () => {
			pending.cancel()
			update((st) => dropFilter(st, "ageLimit"))
		},
		setCountry: (code: string) => {
			pending.cancel()
			set(ratingCountryPatch(state, code, view.data.context.viewerCountry))
		},
		setContent: (next: typeof state) => {
			pending.cancel()
			update(() => next)
		},
	}
}
type Age = ReturnType<typeof useAge>

/** Quick flag chips, the picked country among them, and the field that finds the others. */
function RatingCountry({
	age,
	phone,
	term,
	setTerm,
}: {
	age: Age
	phone: boolean
	term: string
	setTerm: (term: string) => void
}) {
	const quick = quickCountries(
		age.country,
		phone ? 4 : QUICK_RATING_COUNTRIES.length,
	)
	return (
		<div
			className={`flex gap-2 ${phone ? "flex-col" : "flex-wrap items-center"}`}
		>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">
				<span className="mr-1 shrink-0 text-[12px] whitespace-nowrap text-gray-500">
					Ratings in
				</span>
				{quick.map((code) => (
					<CountryChip
						key={code}
						code={code}
						short
						active={age.country === code}
						onClick={() => age.setCountry(code)}
					/>
				))}
			</div>
			<div className={phone ? "" : "ml-auto min-w-[180px] flex-[1_0_200px]"}>
				<SearchField
					value={term}
					onChange={setTerm}
					placeholder="Find a country"
				/>
			</div>
		</div>
	)
}

/** The ladder: Off, then one tile per step. */
function Ladder({ age, phone }: { age: Age; phone: boolean }) {
	const tile = (active: boolean) =>
		`flex flex-col items-center justify-center gap-0.5 rounded-2xl cursor-pointer transition-colors ${FOCUS} ${phone ? "h-20" : "h-[104px]"} ${
			active
				? "bg-white text-gray-950"
				: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
		}`
	const choices = [null, ...age.steps]
	return (
		<div
			role="radiogroup"
			aria-label={`Age limit, ratings in ${age.country}`}
			onKeyDown={(event) =>
				radioKeys(event, (index) => {
					const step = choices[index]
					step ? age.pick(step.age) : age.off()
				})
			}
			className="grid gap-2"
			style={{
				gridTemplateColumns: `repeat(${phone ? 3 : choices.length}, minmax(0, 1fr))`,
			}}
		>
			<motion.button
				// biome-ignore lint/a11y/useSemanticElements: a ladder of steps; the buttons carry the radio role
				type="button"
				role="radio"
				aria-checked={!age.selected}
				tabIndex={age.selected ? -1 : 0}
				whileTap={TAP}
				onClick={age.off}
				className={tile(!age.selected)}
			>
				<span className="text-[20px] font-semibold">Off</span>
				<span
					className={`text-[11px] ${age.selected ? "text-gray-500" : "text-gray-600"}`}
				>
					Every rating
				</span>
			</motion.button>
			{age.steps.map((step) => {
				const on = age.selected === step
				const n = age.stepCount(step.age)
				return (
					<motion.button
						key={step.age}
						// biome-ignore lint/a11y/useSemanticElements: a ladder of steps; the buttons carry the radio role
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={`Up to ${step.label}${step.show ? ` or ${step.show}` : ""}${n === null ? "" : `, ${n.toLocaleString("en")} titles`}`}
						tabIndex={on ? 0 : -1}
						whileTap={TAP}
						onClick={() => age.pick(step.age)}
						className={tile(on)}
					>
						<span
							className={`text-[11px] ${on ? "text-gray-600" : "text-gray-500"}`}
						>
							Up to
						</span>
						<span
							className={`max-w-full truncate px-1 font-semibold ${phone ? "text-[17px]" : "text-[20px]"}`}
						>
							{step.label}
						</span>
						<span
							className={`h-4 text-[12px] ${on ? "text-gray-600" : "text-gray-400"}`}
						>
							{step.show ?? ""}
						</span>
						<span
							className={`h-4 text-[11px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}
						>
							{n === null ? "" : compactCount(n)}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

/**
 * A free age, 0 to 18, written as the age limit as given: it stands for the highest step at or below it on the
 * ladder (ladderStepFor), and the content defaults go by the age itself, like a shared link's age.
 */
function FreeAge({ age, phone }: { age: Age; phone: boolean }) {
	const { limit } = age
	const [value, setValue] = useState(limit ?? 12)
	useEffect(() => {
		if (limit !== undefined) setValue(limit)
	}, [limit])
	const set = (next: number) => {
		const clamped = Math.min(MAX_AGE, Math.max(0, next))
		setValue(clamped)
		age.schedulePick(clamped)
	}
	const step = age.steps.length ? ladderStepFor(age.steps, value) : null
	// Phones label the ticks with ages, desktop with the ratings; labels that would touch are left out.
	const labeled = spacedAges(
		age.steps.map((s) => s.age),
		phone ? 2 : 4,
	)
	const pct = (x: number) => (x / MAX_AGE) * 100
	const on = limit !== undefined
	const button = `grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-gray-200 cursor-pointer hover:bg-white/[0.11] disabled:opacity-30 ${FOCUS}`
	return (
		<div
			className={`flex ${phone ? "flex-col gap-3" : "flex-wrap items-center gap-x-5 gap-y-3"}`}
		>
			<div className="flex shrink-0 items-center gap-2">
				<span className="text-[14px] text-gray-300">Watching with a</span>
				<motion.button
					type="button"
					whileTap={TAP}
					aria-label="Younger"
					disabled={value <= 0}
					onClick={() => set(value - 1)}
					className={button}
				>
					<MinusIcon className="h-4 w-4" />
				</motion.button>
				<span
					className={`w-8 text-center text-[22px] font-bold tabular-nums ${on ? "text-white" : "text-gray-400"}`}
				>
					{value}
				</span>
				<motion.button
					type="button"
					whileTap={TAP}
					aria-label="Older"
					disabled={value >= MAX_AGE}
					onClick={() => set(value + 1)}
					className={button}
				>
					<PlusIcon className="h-4 w-4" />
				</motion.button>
				<span className="text-[14px] text-gray-300">year old</span>
			</div>
			<div className="min-w-[180px] flex-1">
				<div className="relative h-6">
					<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-white/10" />
					<div
						className={`absolute top-[10px] left-0 h-1 w-full origin-left rounded-full transition-colors ${on ? "bg-amber-400" : "bg-white/25"}`}
						style={{ transform: `scaleX(${value / MAX_AGE})` }}
					/>
					{age.steps.map((s) => (
						<span
							key={s.age}
							className="absolute top-[7px] h-2.5 w-[2px] -translate-x-1/2 rounded bg-white/30"
							style={{ left: `${pct(s.age)}%` }}
						/>
					))}
					<input
						type="range"
						aria-label="Age"
						aria-valuetext={`${value} years${step ? `, up to ${step.label}` : ""}`}
						min={0}
						max={MAX_AGE}
						step={1}
						value={value}
						onChange={(event) => set(Number(event.target.value))}
						className="absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-amber-400 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,.6)]"
					/>
				</div>
				<div className="relative mt-1 h-4 text-[11px] text-gray-500">
					{age.steps
						.filter((s) => labeled.has(s.age))
						.map((s) => (
							<span
								key={s.age}
								className="absolute -translate-x-1/2 whitespace-nowrap"
								style={{ left: `${pct(s.age)}%` }}
							>
								{phone ? s.age : s.label}
							</span>
						))}
				</div>
			</div>
			<span
				className={`shrink-0 truncate text-[13px] ${phone ? "" : "w-[150px] text-right"} ${on ? "text-gray-200" : "text-gray-500"}`}
			>
				{step ? `Up to ${step.label}${step.show ? ` · ${step.show}` : ""}` : ""}
			</span>
		</div>
	)
}

export function AgeTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const age = useAge(view)
	const [term, setTerm] = useState("")
	if (!age.ladder) return null
	const finding = term.trim() !== ""
	return (
		<div
			className={`${tabPad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-[1.35fr_1fr] gap-10"}`}
		>
			<div className="min-w-0">
				<RatingCountry age={age} phone={phone} term={term} setTerm={setTerm} />
				<div
					className={`mt-4 mb-2 flex h-5 items-center gap-2 ${finding ? "invisible" : ""}`}
				>
					<span className={LABEL}>Age limit</span>
					{!age.ladder.local && (
						<span className="text-[12px] text-gray-500">Plain ages</span>
					)}
				</div>
				{/* Country matches take the ladder's place, so nothing below moves. */}
				<div className="relative">
					<div
						className={finding ? "invisible" : ""}
						aria-hidden={finding || undefined}
					>
						<Ladder age={age} phone={phone} />
						<div className={phone ? "mt-5" : "mt-6"}>
							<FreeAge age={age} phone={phone} />
						</div>
					</div>
					{finding && (
						<CountryMatches
							list={age.countries}
							term={term}
							isOn={(code) => code === age.country}
							onPick={(code) => {
								age.setCountry(code)
								setTerm("")
							}}
							className="absolute inset-0 flex flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain"
						/>
					)}
				</div>
			</div>
			<div className="min-w-0">
				<ContentChecklist
					state={view.filters.state}
					counts={view.counts}
					onChange={age.setContent}
					roomy
				/>
			</div>
		</div>
	)
}
