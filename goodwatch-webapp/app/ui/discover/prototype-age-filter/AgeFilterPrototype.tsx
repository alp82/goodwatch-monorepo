// PROTOTYPE (throwaway): three variants of an age filter on the real /discover route, switchable via ?variant=A|B|C
// (the prototype is off without the parameter, and never runs in production).
//
//   A  Rating ladder     a control in the filter row: "Up to FSK 12", the country's own ladder, explicit switches for
//                        estimated and unrated titles, counts on every step.
//   B  Who's watching    a band above the grid with audience presets; no rating jargon to choose from, and unrated
//                        titles are decided by the fingerprint's suitability flags.
//   C  Content flags     no ladder: "avoid" chips for violence, sex, scary scenes, language; nothing is removed, flagged
//                        cards dim and say why.
//   D  Rating + content  A and C in one control: the ladder as a stepper, and each step turns on the content flags
//                        that go with it. The person can change any flag; the closed control stays one short button.
//   E  Sentence          D's logic as one line under the row: "Show titles rated up to FSK 12 and hide titles with
//                        violence ✕, sex & nudity ✕, + add". The line is both the summary and the control.
//   F  OK to show        D's logic as a popover with two columns: the ladder, and a checklist of what is OK to show.
//                        Unticked content is struck through. The closed button says it in words: "FSK 12 · no violence".
//                        The chosen layout, with the age limit behind a switch. L1, L2, L3 differ only in how the
//                        closed button says what is hidden (see the component).
//   G  Show / hide       D's logic as a panel under the row: the ladder, and a Show | Hide switch per kind of content.
//                        Closed, it is one removable chip like the other active filters.
//
// It filters the titles already loaded in the browser, with real ratings from Crate (see ratings.ts for the guessed
// rules). The real filter would run in the title filter with counts over the whole catalog.
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeIcon,
	EyeSlashIcon,
	NoSymbolIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { Knob, MENU, SHELL } from "~/ui/filter-bar/motion"
import {
	FLAGS,
	type FlagKey,
	type LadderRow,
	type Resolved,
	type Step,
	type TitleRating,
	flagsOf,
	resolve,
	stepsOf,
	useAgeRatings,
} from "./ratings"

const VARIANTS = [
	{ key: "A", name: "Rating ladder" },
	{ key: "B", name: "Who's watching" },
	{ key: "C", name: "Content flags" },
	{ key: "D", name: "Rating + content" },
	{ key: "E", name: "Sentence" },
	{ key: "L1", name: "Label: first +N" },
	{ key: "L2", name: "Label: count hidden" },
	{ key: "L3", name: "Label: only your changes" },
	{ key: "G", name: "Show / hide" },
] as const
type VariantKey = (typeof VARIANTS)[number]["key"]

const COUNTRIES = ["DE", "US", "GB", "FR", "NL", "AU", "ES", "BR"]

const AUDIENCES = [
	{ key: "everyone", label: "Just adults", hint: "Everything", max: null },
	{ key: "teens", label: "With teens", hint: "Up to about 16", max: 16 },
	{ key: "kids", label: "With kids", hint: "Up to about 12", max: 12 },
	{ key: "little", label: "Little ones", hint: "Up to about 6", max: 6 },
] as const
type AudienceKey = (typeof AUDIENCES)[number]["key"]

/** What the prototype needs of a card: Discover's title cards, or the mock page's. */
interface ProtoCard {
	key: number
	title: string
}

/** Made-up ratings in place of Crate's, for the mock page (no server needed). */
export interface MockRatings {
	titles: Map<number, TitleRating>
	ladders: Record<string, LadderRow[]>
}

interface Info {
	card: ProtoCard
	rating: Resolved
	flags: FlagKey[]
	advisories: string[]
	kids: boolean | null
	teens: boolean | null
}

/** Variant D: the content flags a rating step turns on by itself. A guess, to be tuned against real titles. */
const defaultAvoid = (max: number | null): FlagKey[] =>
	max === null || max > 12
		? []
		: max > 6
			? ["violence", "sex"]
			: FLAGS.map((flag) => flag.key)

/** Why a variant hides or dims a title; null when it shows. */
type Verdict = string | null

export interface AgeFilterPrototype<T extends ProtoCard> {
	rowTrail: ReactNode
	panel: ReactNode
	cards: T[]
	overlay: (card: ProtoCard) => ReactNode
	switcher: ReactNode
}

export function useAgeFilterPrototype<T extends ProtoCard>(
	cards: T[],
	options: { country?: string; mock?: MockRatings } = {},
): AgeFilterPrototype<T> | null {
	const { mock } = options
	const [params, setParams] = useSearchParams()
	const asked = params.get("variant")?.toUpperCase()
	const requested = asked && /^F\d?$/.test(asked) ? "L1" : asked
	const variant = VARIANTS.find((v) => v.key === requested)?.key ?? null
	const active = variant !== null && process.env.NODE_ENV !== "production"

	const [countryPick, setCountryPick] = useState<string | null>(null)
	const [ceiling, setCeiling] = useState<number | null>(null)
	const [includeEstimated, setIncludeEstimated] = useState(true)
	const [includeUnrated, setIncludeUnrated] = useState(false)
	const [audience, setAudience] = useState<AudienceKey>("everyone")
	const [avoid, setAvoid] = useState<FlagKey[]>([])
	// Variant D: the flags the person set themselves, over what the rating step turns on.
	const [overrides, setOverrides] = useState<Partial<Record<FlagKey, boolean>>>({})

	const keys = useMemo(() => cards.map((card) => card.key), [cards])
	const fetched = useAgeRatings(
		mock ? [] : keys,
		countryPick ?? options.country,
		active && !mock,
	)
	const mockCountry = countryPick ?? options.country ?? "DE"
	const mockLadder = mock?.ladders[mockCountry]
	const data = useMemo(
		() =>
			mock
				? {
						titles: mock.titles,
						country: mockCountry,
						ladder: mockLadder ?? [],
						loading: false,
						failed: false,
					}
				: fetched,
		[mock, mockCountry, mockLadder, fetched],
	)
	const country = data.country || countryPick || options.country || ""
	const steps = useMemo(() => stepsOf(country, data.ladder), [country, data.ladder])

	const infos = useMemo<Info[]>(
		() =>
			cards.map((card) => {
				const rating = data.titles.get(card.key)
				return {
					card,
					rating: resolve(rating, country),
					flags: flagsOf(rating),
					advisories: rating?.advisories ?? [],
					kids: rating?.kids ?? null,
					teens: rating?.teens ?? null,
				}
			}),
		[cards, data.titles, country],
	)

	const setVariant = (key: VariantKey) =>
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.set("variant", key)
				return out
			},
			{ replace: true, preventScrollReset: true },
		)
	useEffect(() => {
		if (!active) return
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest("input, textarea, select, [contenteditable]")) return
			const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
			if (!step) return
			const at = VARIANTS.findIndex((v) => v.key === variant)
			setVariant(VARIANTS[(at + step + VARIANTS.length) % VARIANTS.length].key)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	if (!active || !variant) return null

	const ladderVerdict = (info: Info, max: number | null): Verdict => {
		if (max === null) return null
		const { source, age } = info.rating
		if (source === "none") return includeUnrated ? null : "No rating"
		if (source === "estimated" && !includeEstimated) return "No local rating"
		return (age ?? 0) > max ? "Rated above" : null
	}
	const audienceMax = AUDIENCES.find((a) => a.key === audience)?.max ?? null
	const audienceVerdict = (info: Info): Verdict => {
		if (audienceMax === null) return null
		const { source, age } = info.rating
		if (source !== "none") return (age ?? 0) > audienceMax ? "Rated above" : null
		const suitable = audienceMax <= 12 ? info.kids : info.kids || info.teens
		return suitable ? null : "No rating, content unclear"
	}
	const flagVerdict = (info: Info, list: FlagKey[] = avoid): Verdict => {
		const hit = FLAGS.filter(
			(flag) => list.includes(flag.key) && info.flags.includes(flag.key),
		)
		return hit.length ? hit.map((flag) => flag.label).join(", ") : null
	}
	const avoidAt = (max: number | null) =>
		FLAGS.map((flag) => flag.key).filter(
			(key) => overrides[key] ?? defaultAvoid(max).includes(key),
		)
	const combinedVerdict = (info: Info, max: number | null): Verdict =>
		ladderVerdict(info, max) ?? flagVerdict(info, avoidAt(max))
	const verdict = (info: Info): Verdict =>
		variant === "A"
			? ladderVerdict(info, ceiling)
			: variant === "B"
				? audienceVerdict(info)
				: variant === "C"
					? flagVerdict(info)
					: combinedVerdict(info, ceiling)

	const verdicts = new Map(infos.map((info) => [info.card.key, verdict(info)]))
	const hidden = infos.filter((info) => verdicts.get(info.card.key))
	const sources = { local: 0, estimated: 0, none: 0 }
	for (const info of infos) sources[info.rating.source]++
	const stepLabel = (max: number | null) =>
		max === null
			? null
			: ([...steps].reverse().find((step) => step.age <= max) ?? steps[0])

	const control = (
		<LadderControl
			steps={steps}
			ceiling={ceiling}
			onCeiling={setCeiling}
			count={(max) => infos.filter((info) => !ladderVerdict(info, max)).length}
			sources={sources}
			includeEstimated={includeEstimated}
			onIncludeEstimated={setIncludeEstimated}
			includeUnrated={includeUnrated}
			onIncludeUnrated={setIncludeUnrated}
			country={country}
		/>
	)

	const combined = (
		<CombinedControl
			steps={steps}
			ceiling={ceiling}
			onCeiling={setCeiling}
			count={(max) => infos.filter((info) => !combinedVerdict(info, max)).length}
			avoiding={avoidAt(ceiling)}
			defaults={defaultAvoid(ceiling)}
			onFlag={(key) =>
				setOverrides((current) => {
					const next = !avoidAt(ceiling).includes(key)
					const out = { ...current }
					// Back at what the step sets by itself: no longer an override.
					if (next === defaultAvoid(ceiling).includes(key)) delete out[key]
					else out[key] = next
					return out
				})
			}
			customised={Object.keys(overrides).length > 0}
			onReset={() => setOverrides({})}
			flagCount={(key) =>
				infos.filter(
					(info) => !ladderVerdict(info, ceiling) && info.flags.includes(key),
				).length
			}
			sources={sources}
			includeEstimated={includeEstimated}
			onIncludeEstimated={setIncludeEstimated}
			includeUnrated={includeUnrated}
			onIncludeUnrated={setIncludeUnrated}
			country={country}
			shown={infos.length - hidden.length}
			total={infos.length}
		/>
	)

	const more: MoreProps = {
		...(combined.props as CombinedProps),
		onClear: () => {
			setCeiling(null)
			setOverrides({})
		},
	}

	const checklist =
		variant === "L1" || variant === "L2" || variant === "L3" ? (
			<ChecklistControl
				{...more}
				any="switch"
				summary={variant === "L1" ? "first" : variant === "L2" ? "count" : "changes"}
			/>
		) : null

	const panel =
		variant === "A" || variant === "D" ? (
			<div className="mt-4 lg:hidden">{variant === "A" ? control : combined}</div>
		) : variant === "E" ? (
			<SentenceControl {...more} />
		) : checklist ? (
			<div className="mt-4 lg:hidden">{checklist}</div>
		) : variant === "G" ? (
			<ShowHidePanel {...more} />
		) : variant === "B" ? (
			<AudienceBand
				audience={audience}
				onAudience={setAudience}
				step={stepLabel(audienceMax)}
				country={country}
				hidden={hidden}
				verdicts={verdicts}
				shown={infos.length - hidden.length}
			/>
		) : (
			<FlagsBar
				avoid={avoid}
				onToggle={(key) =>
					setAvoid((list) =>
						list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
					)
				}
				count={(key) => infos.filter((info) => info.flags.includes(key)).length}
				noInfo={infos.filter((info) => !info.advisories.length).length}
				dimmed={hidden.length}
				total={infos.length}
			/>
		)

	const byKey = new Map(infos.map((info) => [info.card.key, info]))
	const overlay = (card: ProtoCard) => {
		const info = byKey.get(card.key)
		if (!info) return null
		return (
			<CardOverlay
				info={info}
				dimmed={variant === "C" ? (verdicts.get(card.key) ?? null) : null}
				showFlags={variant === "C"}
				friendly={variant === "B" && info.rating.source === "none" && Boolean(info.kids)}
			/>
		)
	}

	const vocabulary = [...new Set(infos.flatMap((info) => info.advisories))].sort()
	const at = VARIANTS.findIndex((v) => v.key === variant)
	const switcher = (
		<div className="fixed top-2 left-1/2 z-[1100] -translate-x-1/2 lg:top-auto lg:bottom-4">
			<div className="flex items-center gap-1 rounded-full bg-fuchsia-600 px-1.5 py-1 text-sm font-bold text-white shadow-2xl ring-2 ring-white/40">
				<button
					type="button"
					aria-label="Previous variant"
					onClick={() =>
						setVariant(VARIANTS[(at - 1 + VARIANTS.length) % VARIANTS.length].key)
					}
					className="grid h-8 w-8 place-items-center rounded-full cursor-pointer hover:bg-white/20"
				>
					<ChevronLeftIcon className="h-5 w-5" />
				</button>
				<span className="px-1 whitespace-nowrap">
					{variant} ({VARIANTS[at].name})
				</span>
				<button
					type="button"
					aria-label="Next variant"
					onClick={() => setVariant(VARIANTS[(at + 1) % VARIANTS.length].key)}
					className="grid h-8 w-8 place-items-center rounded-full cursor-pointer hover:bg-white/20"
				>
					<ChevronRightIcon className="h-5 w-5" />
				</button>
				<select
					aria-label="Country for ratings"
					value={country}
					onChange={(event) => setCountryPick(event.target.value)}
					className="h-8 rounded-full border-0 bg-white/20 py-0 pr-7 pl-3 text-sm font-bold text-white"
				>
					{[...new Set([country, ...COUNTRIES])].filter(Boolean).map((cc) => (
						<option key={cc} value={cc} className="text-black">
							{cc}
						</option>
					))}
				</select>
				<details className="relative">
					<summary className="grid h-8 cursor-pointer list-none place-items-center rounded-full px-3 hover:bg-white/20">
						State
					</summary>
					<div
						className={`absolute right-0 bottom-10 max-h-[60vh] w-80 overflow-y-auto p-4 text-xs font-normal max-lg:top-10 max-lg:bottom-auto ${MENU}`}
					>
						<p className="font-bold text-white">
							{infos.length} loaded titles, rated for {country || "?"}
							{data.loading ? " (loading…)" : ""}
							{data.failed ? " (request failed)" : ""}
						</p>
						<ul className="mt-2 space-y-1">
							<li>{sources.local} rated in this country</li>
							<li>{sources.estimated} rated elsewhere only (estimated)</li>
							<li>{sources.none} with no rating anywhere</li>
							<li>
								{infos.filter((info) => !info.advisories.length).length} without
								content advisories
							</li>
							<li>{hidden.length} hidden or dimmed by this variant</li>
						</ul>
						<p className="mt-3 font-bold text-white">Ladder steps</p>
						<p className="mt-1">
							{steps.map((step) => `${step.label} (${step.age})`).join(" · ")}
						</p>
						<p className="mt-3 font-bold text-white">
							Advisory wording in these titles
						</p>
						<p className="mt-1">{vocabulary.join(" · ") || "none"}</p>
					</div>
				</details>
			</div>
		</div>
	)

	return {
		rowTrail:
			variant === "A" ? (
				control
			) : variant === "D" ? (
				combined
			) : (
				checklist
			),
		panel,
		cards:
			variant === "C"
				? cards
				: cards.filter((card) => !verdicts.get(card.key)),
		overlay,
		switcher,
	}
}

// Variant A: a control like the row's others, opening the country's ladder.
function LadderControl(props: {
	steps: Step[]
	ceiling: number | null
	onCeiling: (age: number | null) => void
	count: (max: number | null) => number
	sources: { local: number; estimated: number; none: number }
	includeEstimated: boolean
	onIncludeEstimated: (on: boolean) => void
	includeUnrated: boolean
	onIncludeUnrated: (on: boolean) => void
	country: string
}) {
	const [open, setOpen] = useState(false)
	const current = props.steps.find((step) => step.age === props.ceiling)
	return (
		<div className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={`flex h-12 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer ${SHELL} ${current ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{current ? (
					<>
						<span className="text-gray-400">Up to</span>
						<RatingBadge label={current.label} tone="local" />
					</>
				) : (
					"Any age rating"
				)}
				<ChevronDownIcon className="h-4 w-4 text-gray-500" />
			</button>
			{open && (
				<div className={`absolute right-0 z-50 mt-2 w-80 p-4 max-lg:left-0 ${MENU}`}>
					<p className="text-xs text-gray-400">
						Show titles rated up to… ({props.country} ratings)
					</p>
					<div className="mt-3 flex flex-col gap-1">
						{[null, ...props.steps.map((step) => step.age)].map((age) => {
							const step = props.steps.find((s) => s.age === age)
							const on = props.ceiling === age
							return (
								<button
									key={age ?? "any"}
									type="button"
									aria-pressed={on}
									onClick={() => props.onCeiling(age)}
									className={`flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm cursor-pointer ${on ? "bg-white font-bold text-gray-950" : "text-gray-200 hover:bg-white/10"}`}
								>
									{step ? (
										<>
											{step.label}
											{step.sub && (
												<span className={on ? "text-gray-500" : "text-gray-500"}>
													{step.sub} for shows
												</span>
											)}
										</>
									) : (
										"Any rating"
									)}
									<span className="ml-auto text-xs tabular-nums text-gray-500">
										{on ? <CheckIcon className="h-4 w-4" /> : props.count(age)}
									</span>
								</button>
							)
						})}
					</div>
					<div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
						<SwitchRow
							on={props.includeEstimated}
							onChange={props.onIncludeEstimated}
							label={`Include titles not rated in ${props.country}`}
							note={`${props.sources.estimated} of the loaded titles. Placed by their ratings in other countries, marked with ~.`}
						/>
						<SwitchRow
							on={props.includeUnrated}
							onChange={props.onIncludeUnrated}
							label="Include unrated titles"
							note={`${props.sources.none} of the loaded titles have no rating anywhere.`}
						/>
					</div>
				</div>
			)}
		</div>
	)
}

function SwitchRow({
	on,
	onChange,
	label,
	note,
}: {
	on: boolean
	onChange: (on: boolean) => void
	label: string
	note: string
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			onClick={() => onChange(!on)}
			className="flex items-start gap-3 text-left cursor-pointer"
		>
			<span className="flex-1">
				<span className="block text-sm font-bold text-white">{label}</span>
				<span className="block text-xs text-gray-500">{note}</span>
			</span>
			<Knob on={on} />
		</button>
	)
}

// Variant D: one control for the rating and the content. Closed, it is the rating badge and how many kinds of content
// are avoided; open, the ladder is a stepper and the flags are chips the step sets and the person can change.
function CombinedControl(props: {
	steps: Step[]
	ceiling: number | null
	onCeiling: (age: number | null) => void
	count: (max: number | null) => number
	avoiding: FlagKey[]
	defaults: FlagKey[]
	onFlag: (key: FlagKey) => void
	customised: boolean
	onReset: () => void
	flagCount: (key: FlagKey) => number
	sources: { local: number; estimated: number; none: number }
	includeEstimated: boolean
	onIncludeEstimated: (on: boolean) => void
	includeUnrated: boolean
	onIncludeUnrated: (on: boolean) => void
	country: string
	shown: number
	total: number
}) {
	const [open, setOpen] = useState(false)
	const current = props.steps.find((step) => step.age === props.ceiling)
	const active = Boolean(current) || props.avoiding.length > 0
	const names = (keys: FlagKey[]) =>
		FLAGS.filter((flag) => keys.includes(flag.key))
			.map((flag) => flag.label.toLowerCase())
			.join(", ")
	const changed = FLAGS.map((flag) => flag.key).filter(
		(key) => props.avoiding.includes(key) !== props.defaults.includes(key),
	)
	return (
		<div className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={`flex h-12 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer ${SHELL} ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{current ? (
					<>
						<span className="text-gray-400">Up to</span>
						<RatingBadge label={current.label} tone="local" />
					</>
				) : props.avoiding.length ? (
					"Avoiding"
				) : (
					"Age & content"
				)}
				{props.avoiding.length > 0 && (
					<span
						title={`Avoiding ${names(props.avoiding)}`}
						className="flex h-6 items-center gap-0.5 rounded-md bg-rose-500/20 px-1.5 text-xs font-black text-rose-200 ring-1 ring-rose-400/40"
					>
						<NoSymbolIcon className="h-3.5 w-3.5" />
						{props.avoiding.length}
						{changed.length > 0 && (
							<span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
						)}
					</span>
				)}
				<ChevronDownIcon className="h-4 w-4 text-gray-500" />
			</button>
			{open && (
				<div
					className={`absolute right-0 z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] p-4 max-lg:left-0 ${MENU}`}
				>
					<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
						Rated up to · {props.country}
					</p>
					<div className="mt-2 flex gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
						{[null, ...props.steps.map((step) => step.age)].map((age) => {
							const step = props.steps.find((s) => s.age === age)
							const on = props.ceiling === age
							return (
								<button
									key={age ?? "any"}
									type="button"
									aria-pressed={on}
									title={step?.sub ? `${step.sub} for shows` : undefined}
									onClick={() => props.onCeiling(age)}
									className={`flex min-w-0 flex-1 flex-col items-center rounded-lg py-1.5 cursor-pointer ${on ? "bg-white text-gray-950" : "text-gray-200 hover:bg-white/10"}`}
								>
									<span className="text-xs font-bold whitespace-nowrap">
										{step ? step.label.replace(/^FSK /, "") : "Any"}
									</span>
									<span className={`text-[11px] tabular-nums ${on ? "text-gray-500" : "text-gray-500"}`}>
										{props.count(age)}
									</span>
								</button>
							)
						})}
					</div>
					{current?.sub && (
						<p className="mt-1.5 text-xs text-gray-500">
							{current.label} for movies, {current.sub} for shows
						</p>
					)}

					<div className="mt-4 flex items-baseline gap-2">
						<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
							Avoid
						</p>
						{props.customised && (
							<button
								type="button"
								onClick={props.onReset}
								className="ml-auto text-xs font-bold text-amber-400 hover:underline cursor-pointer"
							>
								Reset to {current ? current.label : "none"}
							</button>
						)}
					</div>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{FLAGS.map((flag) => {
							const on = props.avoiding.includes(flag.key)
							const mine = changed.includes(flag.key)
							return (
								<button
									key={flag.key}
									type="button"
									aria-pressed={on}
									onClick={() => props.onFlag(flag.key)}
									className={`flex h-8 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-[13px] whitespace-nowrap cursor-pointer ${on ? "bg-rose-500 font-bold text-white" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"} ${mine ? "outline outline-2 outline-offset-1 outline-amber-400" : ""}`}
								>
									{flag.label}
									<span className={`text-[11px] tabular-nums ${on ? "text-rose-100" : "text-gray-500"}`}>
										{props.flagCount(flag.key)}
									</span>
								</button>
							)
						})}
					</div>
					<p className="mt-2 text-xs text-gray-500">
						{current && props.defaults.length > 0
							? `${current.label} avoids ${names(props.defaults)} by itself. `
							: current
								? `${current.label} avoids nothing by itself. `
								: "Pick any to hide titles with that content. "}
						{changed.length > 0 && (
							<span className="text-amber-300">
								You changed {names(changed)}.
							</span>
						)}
					</p>

					<details className="mt-4 border-t border-white/10 pt-3">
						<summary className="cursor-pointer text-xs font-bold text-gray-300">
							Titles without a {props.country} rating (
							{props.sources.estimated + props.sources.none})
						</summary>
						<div className="mt-3 flex flex-col gap-3">
							<SwitchRow
								on={props.includeEstimated}
								onChange={props.onIncludeEstimated}
								label="Include titles rated elsewhere"
								note={`${props.sources.estimated} of the loaded titles. Placed by their ratings in other countries, marked with ~.`}
							/>
							<SwitchRow
								on={props.includeUnrated}
								onChange={props.onIncludeUnrated}
								label="Include unrated titles"
								note={`${props.sources.none} of the loaded titles have no rating anywhere. The content flags still apply to them.`}
							/>
						</div>
					</details>

					<div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
						<span className="text-sm text-gray-300">
							<b className="text-white tabular-nums">{props.shown}</b> of{" "}
							{props.total} titles
						</span>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="ml-auto h-9 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white cursor-pointer hover:bg-amber-500"
						>
							Done
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

type CombinedProps = Parameters<typeof CombinedControl>[0]
interface MoreProps extends CombinedProps {
	/** Any rating, and no flags. */
	onClear: () => void
}

const SHORT: Record<FlagKey, string> = {
	violence: "violence",
	sex: "sex & nudity",
	scary: "scary scenes",
	language: "strong language",
	drugs: "drugs",
}
const shortList = (keys: FlagKey[]) =>
	FLAGS.filter((flag) => keys.includes(flag.key))
		.map((flag) => SHORT[flag.key])
		.join(", ")

const UNRATED = [
	["none", "Hide"],
	["elsewhere", "Show if rated elsewhere"],
	["all", "Show all"],
] as const

/** E, F, G: the two unrated switches as one choice of three. */
function UnratedPick(props: MoreProps) {
	const value = props.includeUnrated
		? "all"
		: props.includeEstimated
			? "elsewhere"
			: "none"
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			<span className="text-xs text-gray-400">
				Titles without a {props.country} rating (
				{props.sources.estimated + props.sources.none})
			</span>
			<div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
				{UNRATED.map(([key, label]) => (
					<button
						key={key}
						type="button"
						aria-pressed={value === key}
						onClick={() => {
							props.onIncludeEstimated(key !== "none")
							props.onIncludeUnrated(key === "all")
						}}
						className={`rounded-md px-2 py-1 text-xs whitespace-nowrap cursor-pointer ${value === key ? "bg-white font-bold text-gray-950" : "text-gray-300 hover:bg-white/10"}`}
					>
						{label}
					</button>
				))}
			</div>
		</div>
	)
}

/** A word in a sentence that opens a small menu. */
function Pop({
	label,
	children,
}: {
	label: ReactNode
	children: (close: () => void) => ReactNode
}) {
	const [open, setOpen] = useState(false)
	return (
		<span className="relative inline-block">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.07] pr-1.5 pl-2.5 text-sm font-bold text-white ring-1 ring-white/15 cursor-pointer hover:bg-white/10"
			>
				{label}
				<ChevronDownIcon className="h-4 w-4 text-gray-500" />
			</button>
			{open && (
				<span
					className={`absolute left-0 z-50 mt-1 flex min-w-52 flex-col gap-0.5 p-1.5 ${MENU}`}
				>
					{children(() => setOpen(false))}
				</span>
			)}
		</span>
	)
}

const MENU_ROW =
	"flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm whitespace-nowrap cursor-pointer text-gray-200 hover:bg-white/10"

// Variant E: the filter as a sentence. Every underlined part is a control; nothing else opens.
function SentenceControl(props: MoreProps) {
	const current = props.steps.find((step) => step.age === props.ceiling)
	const off = FLAGS.filter((flag) => !props.avoiding.includes(flag.key))
	const unrated = props.includeUnrated
		? "all"
		: props.includeEstimated
			? "elsewhere"
			: "none"
	return (
		<div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-gray-400">
			<span>Show titles rated</span>
			<Pop
				label={
					current ? (
						<>
							up to <RatingBadge label={current.label} tone="local" />
						</>
					) : (
						"any age"
					)
				}
			>
				{(close) =>
					[null, ...props.steps.map((step) => step.age)].map((age) => {
						const step = props.steps.find((s) => s.age === age)
						return (
							<button
								key={age ?? "any"}
								type="button"
								onClick={() => {
									props.onCeiling(age)
									close()
								}}
								className={`${MENU_ROW} ${props.ceiling === age ? "bg-white/10 font-bold" : ""}`}
							>
								{step ? `up to ${step.label}` : "any age"}
								{step?.sub && <span className="text-gray-500">{step.sub}</span>}
								<span className="ml-auto pl-4 text-xs tabular-nums text-gray-500">
									{props.count(age)}
								</span>
							</button>
						)
					})
				}
			</Pop>
			<span>and hide titles with</span>
			{props.avoiding.length === 0 && (
				<span className="font-bold text-gray-200">nothing</span>
			)}
			{FLAGS.filter((flag) => props.avoiding.includes(flag.key)).map((flag) => {
				const auto = props.defaults.includes(flag.key)
				return (
					<button
						key={flag.key}
						type="button"
						onClick={() => props.onFlag(flag.key)}
						aria-label={`Stop hiding ${SHORT[flag.key]}`}
						title={auto && current ? `Hidden because of ${current.label}` : "Hidden by you"}
						className={`flex h-8 items-center gap-1.5 rounded-lg pr-1.5 pl-2 text-sm font-bold text-white cursor-pointer hover:bg-white/10 ${auto ? "border border-dashed border-white/30" : "bg-white/[0.07] ring-1 ring-white/15"}`}
					>
						<EyeSlashIcon className="h-4 w-4 text-gray-400" />
						{SHORT[flag.key]}
						<XMarkIcon className="h-4 w-4 text-gray-500" />
					</button>
				)
			})}
			{off.length > 0 && (
				<Pop
					label={
						<>
							<PlusIcon className="h-4 w-4" /> add
						</>
					}
				>
					{(close) =>
						off.map((flag) => (
							<button
								key={flag.key}
								type="button"
								onClick={() => {
									props.onFlag(flag.key)
									close()
								}}
								className={MENU_ROW}
							>
								{SHORT[flag.key]}
								<span className="ml-auto pl-4 text-xs tabular-nums text-gray-500">
									hides {props.flagCount(flag.key)}
								</span>
							</button>
						))
					}
				</Pop>
			)}
			<span>. Titles without a {props.country} rating:</span>
			<Pop
				label={
					unrated === "all"
						? "shown"
						: unrated === "elsewhere"
							? "shown if rated elsewhere"
							: "hidden"
				}
			>
				{(close) =>
					UNRATED.map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								props.onIncludeEstimated(key !== "none")
								props.onIncludeUnrated(key === "all")
								close()
							}}
							className={`${MENU_ROW} ${unrated === key ? "bg-white/10 font-bold" : ""}`}
						>
							{label}
						</button>
					))
				}
			</Pop>
			{props.customised && (
				<button
					type="button"
					onClick={props.onReset}
					className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
				>
					Reset to {current ? current.label : "none"}
				</button>
			)}
			<span className="ml-auto text-gray-300">
				<b className="text-white tabular-nums">{props.shown}</b> of {props.total}
			</span>
		</div>
	)
}

// Variant F (the chosen layout): a popover with the ladder beside a checklist of what is OK to show. Ticked is shown,
// unticked is struck through. The closed button says the result in words. Titles without a local rating always show
// when they are rated elsewhere (marked ~ on the card), with no control for it.
//
// `any` is where "no rating limit" lives, the open question:
//   bottom  after the highest step, under a divider: the ladder reads from strictest to no limit
//   top     the same order upside down: no limit first, then 18 down to 0
//   switch  not a step at all: a switch on the column turns the rating limit on and off
//
// `summary` is how the closed button says what is hidden, the second open question:
//   first    the first kind in words, the rest as a number: "FSK 12 · no violence +1"
//   count    only how many: "FSK 12 · 2 hidden"
//   changes  only what differs from the age limit's own setting: "FSK 12", "FSK 12 · no scary scenes",
//            "FSK 12 · violence OK", "FSK 12 · 2 changes"
function ChecklistControl(
	props: MoreProps & {
		any: "bottom" | "top" | "switch"
		summary: "first" | "count" | "changes"
	},
) {
	const [open, setOpen] = useState(false)
	// The step to come back to when the switch turns the limit on again.
	const [last, setLast] = useState<number | null>(null)
	const current = props.steps.find((step) => step.age === props.ceiling)
	const active = Boolean(current) || props.avoiding.length > 0
	const ages = props.steps.map((step) => step.age)
	const rows: (number | null)[] =
		props.any === "bottom"
			? [...ages, null]
			: props.any === "top"
				? [null, ...[...ages].reverse()]
				: ages
	const limited = props.ceiling !== null
	const fallback = last ?? ages[Math.floor(ages.length / 2)] ?? null
	const hiddenKeys = FLAGS.map((flag) => flag.key).filter((key) =>
		props.avoiding.includes(key),
	)
	const changedKeys = FLAGS.map((flag) => flag.key).filter(
		(key) => props.avoiding.includes(key) !== props.defaults.includes(key),
	)
	const firstOf = (keys: FlagKey[]) => (
		<>
			no {SHORT[keys[0]]}
			{keys.length > 1 && (
				<span className="ml-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-bold text-gray-200">
					+{keys.length - 1}
				</span>
			)}
		</>
	)
	const summary: ReactNode =
		props.summary === "count" ? (
			hiddenKeys.length > 0 && (
				<span className="flex items-center gap-1">
					<EyeSlashIcon className="h-3.5 w-3.5 text-gray-400" />
					{hiddenKeys.length} hidden
				</span>
			)
		) : props.summary === "first" || !current ? (
			hiddenKeys.length > 0 && firstOf(hiddenKeys)
		) : changedKeys.length === 0 ? null : changedKeys.length > 1 ? (
			`${changedKeys.length} changes`
		) : hiddenKeys.includes(changedKeys[0]) ? (
			`no ${SHORT[changedKeys[0]]}`
		) : (
			`${SHORT[changedKeys[0]]} OK`
		)
	return (
		<div className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				title={
					hiddenKeys.length ? `Hiding ${shortList(hiddenKeys)}` : undefined
				}
				className={`flex h-12 max-w-80 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer ${SHELL} ${active ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
			>
				{current && <RatingBadge label={current.label} tone="local" />}
				{summary ? (
					<span className="flex items-center truncate font-normal text-gray-300">
						{current && <span className="mr-2 text-gray-600">·</span>}
						{summary}
					</span>
				) : (
					!current && "Age & content"
				)}
				<ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" />
			</button>
			{open && (
				<div
					className={`absolute right-0 z-50 mt-2 w-[30rem] max-w-[calc(100vw-2rem)] p-4 max-lg:left-0 ${MENU}`}
				>
					<div className="flex gap-4">
						<div className="w-36 shrink-0">
							{props.any === "switch" ? (
								<button
									type="button"
									role="switch"
									aria-checked={limited}
									aria-label="Limit by rating"
									onClick={() => {
										if (limited) setLast(props.ceiling)
										props.onCeiling(limited ? null : fallback)
									}}
									className="flex w-full items-center cursor-pointer"
								>
									<span className="flex-1 text-left text-xs font-bold tracking-wide text-gray-400 uppercase">
										Age limit
									</span>
									<Knob on={limited} />
								</button>
							) : (
								<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
									Age limit
								</p>
							)}
							<div className="mt-2 flex flex-col gap-0.5">
								{rows.map((age) => {
									const step = props.steps.find((s) => s.age === age)
									const on = props.ceiling === age
									return (
										<button
											key={age ?? "any"}
											type="button"
											aria-pressed={on}
											onClick={() => props.onCeiling(age)}
											className={`flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm cursor-pointer ${on ? "bg-white font-bold text-gray-950" : "text-gray-200 hover:bg-white/10"} ${props.any === "switch" && !limited ? "opacity-45" : ""} ${age === null && props.any === "bottom" ? "mt-1.5 border-t border-white/10 pt-0.5 rounded-t-none" : ""} ${age === null && props.any === "top" ? "mb-1.5" : ""}`}
										>
											<span
												className={`h-2 w-2 rounded-full ${on ? "bg-gray-950" : "ring-1 ring-white/30"}`}
											/>
											{step ? step.label : "No limit"}
											<span className="ml-auto text-xs tabular-nums text-gray-500">
												{props.count(age)}
											</span>
										</button>
									)
								})}
							</div>

						</div>
						<div className="min-w-0 flex-1 border-l border-white/10 pl-4">
							<div className="flex items-baseline">
								<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
									OK to show
								</p>
								{props.customised && (
									<button
										type="button"
										onClick={props.onReset}
										className="ml-auto text-xs font-bold text-amber-400 hover:underline cursor-pointer"
									>
										Reset
									</button>
								)}
							</div>
							<div className="mt-2 flex flex-col gap-0.5">
								{FLAGS.map((flag) => {
									const hidden = props.avoiding.includes(flag.key)
									const mine = hidden !== props.defaults.includes(flag.key)
									return (
										<button
											key={flag.key}
											type="button"
											role="checkbox"
											aria-checked={!hidden}
											onClick={() => props.onFlag(flag.key)}
											className="flex h-8 items-center gap-2.5 rounded-lg px-1.5 text-sm cursor-pointer hover:bg-white/10"
										>
											<span
												className={`grid h-5 w-5 place-items-center rounded-md ${hidden ? "ring-1 ring-white/25" : "bg-emerald-500 text-white"}`}
											>
												{!hidden && <CheckIcon className="h-4 w-4" />}
											</span>
											<span
												className={hidden ? "text-gray-500 line-through" : "text-gray-100"}
											>
												{flag.label}
											</span>
											{mine && (
												<span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
											)}
											<span className="ml-auto text-xs tabular-nums text-gray-500">
												{hidden
													? `${props.flagCount(flag.key)} hidden`
													: props.flagCount(flag.key)}
											</span>
										</button>
									)
								})}
							</div>
						</div>
					</div>
					<div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
						<span className="text-sm text-gray-300">
							<b className="text-white tabular-nums">{props.shown}</b> of{" "}
							{props.total} titles
						</span>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="ml-auto h-9 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white cursor-pointer hover:bg-amber-500"
						>
							Done
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

// Variant G: closed, one removable chip; open, a panel under the row with the ladder and a Show | Hide switch per
// kind of content.
function ShowHidePanel(props: MoreProps) {
	const [open, setOpen] = useState(false)
	const current = props.steps.find((step) => step.age === props.ceiling)
	const active = Boolean(current) || props.avoiding.length > 0
	if (!open)
		return (
			<div className="mt-3 flex items-center gap-2">
				{active ? (
					<span className="flex h-8 items-center rounded-full bg-white/[0.07] text-sm text-gray-100 ring-1 ring-white/10">
						<button
							type="button"
							onClick={() => setOpen(true)}
							className="flex h-8 items-center gap-1.5 pr-1 pl-3 cursor-pointer"
						>
							{current && <>Up to {current.label}</>}
							{current && props.avoiding.length > 0 && (
								<span className="text-gray-600">·</span>
							)}
							{props.avoiding.length > 0 && (
								<>
									<EyeSlashIcon className="h-3.5 w-3.5 text-gray-400" />
									Hiding {shortList(props.avoiding)}
								</>
							)}
						</button>
						<button
							type="button"
							aria-label="Remove the age and content filter"
							onClick={props.onClear}
							className="grid h-8 w-8 place-items-center cursor-pointer"
						>
							<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
						</button>
					</span>
				) : (
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-white/20 pr-3 pl-2.5 text-sm text-gray-400 cursor-pointer hover:text-gray-200"
					>
						<PlusIcon className="h-4 w-4" /> Age & content
					</button>
				)}
			</div>
		)
	return (
		<section className={`mt-3 p-4 ${SHELL}`}>
			<div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
				<div className="lg:w-80 lg:shrink-0">
					<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
						Rated up to · {props.country}
					</p>
					<div className="mt-2 flex gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
						{[null, ...props.steps.map((step) => step.age)].map((age) => {
							const step = props.steps.find((s) => s.age === age)
							const on = props.ceiling === age
							return (
								<button
									key={age ?? "any"}
									type="button"
									aria-pressed={on}
									onClick={() => props.onCeiling(age)}
									className={`flex min-w-0 flex-1 flex-col items-center rounded-lg py-1.5 cursor-pointer ${on ? "bg-white text-gray-950" : "text-gray-200 hover:bg-white/10"}`}
								>
									<span className="text-xs font-bold whitespace-nowrap">
										{step ? step.label.replace(/^FSK /, "") : "Any"}
									</span>
									<span className="text-[11px] tabular-nums text-gray-500">
										{props.count(age)}
									</span>
								</button>
							)
						})}
					</div>
					<p className="mt-2 text-xs text-gray-500">
						{current && props.defaults.length > 0
							? `${current.label} sets ${shortList(props.defaults)} to Hide.`
							: "A lower rating also hides some content by itself."}
					</p>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline">
						<p className="text-xs font-bold tracking-wide text-gray-400 uppercase">
							Content
						</p>
						{props.customised && (
							<button
								type="button"
								onClick={props.onReset}
								className="ml-auto text-xs font-bold text-amber-400 hover:underline cursor-pointer"
							>
								Reset to {current ? current.label : "none"}
							</button>
						)}
					</div>
					<div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
						{FLAGS.map((flag) => {
							const hidden = props.avoiding.includes(flag.key)
							const mine = hidden !== props.defaults.includes(flag.key)
							return (
								<div key={flag.key} className="flex h-9 items-center gap-2 text-sm">
									<span className={hidden ? "text-gray-400" : "text-gray-100"}>
										{flag.label}
									</span>
									{mine && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
									<span className="ml-auto flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
										{([false, true] as const).map((hide) => (
											<button
												key={String(hide)}
												type="button"
												aria-pressed={hidden === hide}
												onClick={() => hidden !== hide && props.onFlag(flag.key)}
												className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs cursor-pointer ${hidden === hide ? "bg-white font-bold text-gray-950" : "text-gray-400 hover:text-gray-200"}`}
											>
												{hide ? (
													<EyeSlashIcon className="h-3.5 w-3.5" />
												) : (
													<EyeIcon className="h-3.5 w-3.5" />
												)}
												{hide ? "Hide" : "Show"}
											</button>
										))}
									</span>
								</div>
							)
						})}
					</div>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
				<UnratedPick {...props} />
				<span className="ml-auto text-sm text-gray-300">
					<b className="text-white tabular-nums">{props.shown}</b> of {props.total}{" "}
					titles
				</span>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="h-9 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white cursor-pointer hover:bg-amber-500"
				>
					Done
				</button>
			</div>
		</section>
	)
}

// Variant B: a band above the grid. The person says who is watching; the band says what that meant.
function AudienceBand(props: {
	audience: AudienceKey
	onAudience: (key: AudienceKey) => void
	step: Step | null
	country: string
	hidden: Info[]
	verdicts: Map<number, Verdict>
	shown: number
}) {
	const [showHidden, setShowHidden] = useState(false)
	const reasons = new Map<string, number>()
	for (const info of props.hidden) {
		const reason = props.verdicts.get(info.card.key) ?? ""
		reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
	}
	return (
		<section className={`mt-5 p-4 lg:p-5 ${SHELL}`}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
				<h2 className="w-full text-base font-bold text-white sm:w-auto">Who's watching?</h2>
				<div className="grid w-full flex-1 grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
					{AUDIENCES.map((a) => {
						const on = props.audience === a.key
						return (
							<button
								key={a.key}
								type="button"
								aria-pressed={on}
								onClick={() => props.onAudience(a.key)}
								className={`rounded-xl px-3 py-2.5 text-left cursor-pointer ${on ? "bg-white text-gray-950" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"}`}
							>
								<span className="block text-sm font-bold">{a.label}</span>
								<span className={`block text-xs ${on ? "text-gray-600" : "text-gray-500"}`}>
									{a.hint}
								</span>
							</button>
						)
					})}
				</div>
			</div>
			{props.step && (
				<p className="mt-4 text-sm text-gray-300">
					Showing {props.shown} titles rated{" "}
					<RatingBadge label={props.step.label} tone="local" /> or lower in{" "}
					{props.country}. Titles without a rating show only when their content
					looks suitable.{" "}
					{props.hidden.length > 0 && (
						<button
							type="button"
							onClick={() => setShowHidden(!showHidden)}
							className="font-bold text-amber-400 underline-offset-2 hover:underline cursor-pointer"
						>
							{props.hidden.length} hidden
							{[...reasons].map(([reason, n]) => ` · ${n} ${reason.toLowerCase()}`)}
						</button>
					)}
				</p>
			)}
			{showHidden && props.hidden.length > 0 && (
				<ul className="mt-3 flex flex-wrap gap-1.5">
					{props.hidden.map((info) => (
						<li
							key={info.card.key}
							className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-400"
						>
							{info.card.title}
							<span className="ml-1.5 text-gray-600">
								{info.rating.label ?? "no rating"}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

// Variant C: avoid chips. Nothing leaves the grid; flagged cards dim.
function FlagsBar(props: {
	avoid: FlagKey[]
	onToggle: (key: FlagKey) => void
	count: (key: FlagKey) => number
	noInfo: number
	dimmed: number
	total: number
}) {
	return (
		<div className="mt-5 flex flex-wrap items-center gap-2">
			<span className="mr-1 text-sm font-bold text-white">I'd rather avoid</span>
			{FLAGS.map((flag) => {
				const on = props.avoid.includes(flag.key)
				return (
					<button
						key={flag.key}
						type="button"
						aria-pressed={on}
						onClick={() => props.onToggle(flag.key)}
						className={`flex h-9 items-center gap-2 rounded-full pr-2.5 pl-3 text-sm whitespace-nowrap cursor-pointer ${on ? "bg-rose-500 font-bold text-white" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"}`}
					>
						{flag.label}
						<span className={`text-xs tabular-nums ${on ? "text-rose-100" : "text-gray-500"}`}>
							{props.count(flag.key)}
						</span>
					</button>
				)
			})}
			<span className="ml-auto text-xs text-gray-500">
				{props.dimmed} of {props.total} dimmed · {props.noInfo} without content
				info stay as they are
			</span>
		</div>
	)
}

function RatingBadge({
	label,
	tone,
}: {
	label: string
	tone: Resolved["source"]
}) {
	return (
		<span
			className={`inline-flex h-6 items-center rounded-md px-1.5 text-xs font-black whitespace-nowrap ${
				tone === "local"
					? "bg-gray-950/85 text-white ring-1 ring-white/40"
					: tone === "estimated"
						? "bg-gray-950/85 text-gray-300 border border-dashed border-white/40"
						: "bg-gray-950/70 text-gray-500 ring-1 ring-white/10"
			}`}
		>
			{label}
		</span>
	)
}

// Over a card, inside its resting scale like the grid's move marks.
function CardOverlay({
	info,
	dimmed,
	showFlags,
	friendly,
}: {
	info: Info
	dimmed: Verdict
	showFlags: boolean
	friendly: boolean
}) {
	const { rating } = info
	return (
		<div className="pointer-events-none absolute inset-0 scale-95">
			{dimmed && (
				<div className="absolute inset-0 flex items-end rounded-xl bg-gray-950/75 p-2">
					<span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
						{dimmed}
					</span>
				</div>
			)}
			<div className="absolute top-2 right-2 flex flex-col items-end gap-1">
				<RatingBadge
					label={
						rating.source === "none"
							? friendly
								? "Looks kid-friendly"
								: "No rating"
							: (rating.label ?? "")
					}
					tone={rating.source}
				/>
				{showFlags &&
					!dimmed &&
					info.flags.map((key) => (
						<span
							key={key}
							className="rounded-md bg-gray-950/80 px-1.5 py-0.5 text-[10px] text-gray-300"
						>
							{FLAGS.find((flag) => flag.key === key)?.label}
						</span>
					))}
			</div>
		</div>
	)
}
