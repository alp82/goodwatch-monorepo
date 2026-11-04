// The fingerprint sub-page's content, in reading order:
// - the effect lines across the whole column, with their values; pointing at a line lights its mix on the print and
//   explains it;
// - the print with the detail beside it: the section, line or scale pointed at (the strongest section when nothing
//   is), its value on a 0-10 track and where that ranks among popular titles (ranks.server.ts, "Stronger than 9 in 10
//   popular movies"; nothing when the ranks aren't there), and a section's effects. The detail's box is as tall as the
//   tallest thing it can show, so pointing never moves the page;
// - the twelve scales in their groups, which answer a pointer the way the lines do;
// - for a signed-in member, where it sits in their taste.
// Pointing works by mouse, focus and tap. Find in this title can point at a line, a section or a scale
// (find/landing.ts).
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type EffectReading,
	strengthWord,
} from "~/domain/fingerprint-effects/effects"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import type { TitleSides } from "~/server/title-sides.server"
import type { CoreScores } from "~/server/utils/fingerprint"
import { bridges } from "~/ui/details/find/landing"
import {
	RidgeSprite,
	printGeometry,
} from "~/ui/details/fingerprint-section/Shape"
import { TasteCard } from "~/ui/details/fingerprint-section/TasteCard"
import {
	type Reading,
	type ScaleReading,
	phraseOf,
	printAttributes,
	readTitle,
} from "~/ui/details/fingerprint-section/reading"
import {
	byId,
	dialLight,
	lightOf,
} from "~/ui/details/fingerprint-section/selection"
import { SECTION_STYLE } from "~/ui/details/fingerprint-section/styles"
import { SCALE_GROUPS } from "~/ui/details/fingerprint/scales"
import { CAPTION } from "~/ui/details/page-ui"
import { fingerprintInput } from "~/ui/details/title-words"
import { useHydrated } from "~/utils/hydrated"
import { Lines, NotFor, StaticDial } from "./EffectLines"
import { Print } from "./Print"
import {
	type FpRanks,
	type Media,
	SECTION_MEANING,
	type SectionView,
	notForLine,
	rankLine,
	readSections,
	sectionRankKey,
} from "./print-model"

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'

export function FingerprintPage({
	media,
	sides,
	ranks,
}: {
	media: Media
	sides: TitleSides | null
	/** Where its feelings rank among popular titles (ranks.server.ts), or null. */
	ranks: FpRanks | null
}) {
	const t = useMemo(() => fingerprintInput(media), [media])
	const reading = useMemo(() => (t ? readTitle(t) : null), [t])
	if (!t || !reading) return null
	const type = media.mediaType
	return (
		<div
			data-feedback-area="analysis"
			data-fingerprint-section=""
			className="@container/deep flex flex-col gap-16"
		>
			<style>{SECTION_STYLE}</style>
			<FeelingAndPrint
				reading={reading}
				type={type}
				scores={t.fingerprint.scores}
				ranks={ranks}
			/>
			{sides && (
				<Part
					id="fp-taste"
					title="In your taste"
					line="Where it sits among the titles you love."
					className="[&:not(:has(section))]:hidden"
				>
					<TasteCard
						sides={sides}
						mediaType={type}
						tmdbId={media.details.tmdb_id}
					/>
				</Part>
			)}
		</div>
	)
}

function Part({
	id,
	title,
	line,
	children,
	className = "",
}: {
	id: string
	title: string
	line?: string
	children: ReactNode
	className?: string
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-h`}
			className={`min-w-0 scroll-mt-32 ${className}`}
		>
			<h2
				id={`${id}-h`}
				className="text-[19px] font-semibold tracking-tight text-white sm:text-xl"
			>
				{title}
			</h2>
			{line && (
				<p className="mt-1 max-w-[46rem] text-[15px] text-gray-400">{line}</p>
			)}
			<div className="mt-5">{children}</div>
		</section>
	)
}

// --- The lines, then the print with its explanation ------------------------------------------------------------

type Shown =
	| { kind: "section"; sec: SectionView }
	| { kind: "effect"; r: EffectReading }
	| { kind: "scale"; s: ScaleReading }

function FeelingAndPrint({
	reading,
	type,
	scores,
	ranks,
}: {
	reading: Reading
	type: "movie" | "show"
	scores: CoreScores
	ranks: FpRanks | null
}) {
	const sections = useMemo(() => readSections(reading, type), [reading, type])
	const strongest = useMemo(
		() => [...sections].sort((a, b) => b.strength - a.strength)[0],
		[sections],
	)
	const [row, setRow] = useState<string | null>(null)
	const [hover, setHover] = useState<string | null>(null)
	const [pin, setPin] = useState<string | null>(null)
	// A scale pointed at works like a line: the others dim, the print lights what it's read from, the detail explains it.
	const [scaleName, setScale] = useState<string | null>(null)
	const printBox = useRef<HTMLDivElement>(null)

	// A tap or click anywhere but the print and its explanation lets a pinned section go.
	useEffect(() => {
		if (!pin) return
		const off = (e: PointerEvent) => {
			if (printBox.current?.contains(e.target as Node)) return
			setPin(null)
		}
		document.addEventListener("pointerdown", off)
		return () => document.removeEventListener("pointerdown", off)
	}, [pin])

	// Find in this title points at a line, a section or a scale (find/landing.ts).
	useEffect(() => {
		bridges.fp = (p) => {
			setHover(null)
			setPin(p.kind === "section" ? p.id : null)
			setRow(p.kind === "effect" ? p.id : null)
			setScale(p.kind === "scale" ? p.id : null)
		}
		return () => {
			bridges.fp = null
		}
	}, [])

	const scale = scaleName
		? (reading.scales.find((s) => s.sc.name === scaleName) ?? null)
		: null
	const rowEffect = !scale && row ? byId(reading, row) : null
	const pointed = rowEffect || scale ? null : (hover ?? pin)
	const focus = pointed ? sections.find((s) => s.id === pointed) : undefined
	// The detail never stands empty: with nothing pointed at, the strongest section is explained (unlit on the print).
	const shown: Shown | null = scale
		? { kind: "scale", s: scale }
		: rowEffect
			? { kind: "effect", r: rowEffect }
			: focus
				? { kind: "section", sec: focus }
				: strongest
					? { kind: "section", sec: strongest }
					: null
	const light = scale
		? dialLight(scale, scores)
		: rowEffect
			? lightOf([rowEffect.effect.id], reading)
			: null
	// Every explanation the detail can show, laid in one grid cell unseen: the panel takes the tallest one's height, so
	// pointing at another part never moves the page.
	const candidates = useMemo<Shown[]>(
		() => [
			...sections.map((sec) => ({ kind: "section" as const, sec })),
			...reading.rows.map((p) => ({ kind: "effect" as const, r: p.r })),
			...reading.scales.map((s) => ({ kind: "scale" as const, s })),
		],
		[sections, reading],
	)

	// The print's ridges are drawn once the page is up: they have no words, and their coordinates would be a large
	// share of the page's HTML.
	const hydrated = useHydrated()
	const geo = useMemo(
		() =>
			hydrated
				? printGeometry(printAttributes(scores, POPULATION_MEDIANS[type]))
				: null,
		[hydrated, scores, type],
	)
	const ridges = `fp-deep-${useId().replace(/:/g, "")}`
	const label = `The print, on eight feelings: ${reading.axes.map((a) => `${a.axis.label} ${a.strength.toFixed(1)}`).join(", ")}.`

	const print = (
		<Print
			reading={reading}
			geo={geo}
			ridges={ridges}
			light={light}
			focus={focus?.id ?? null}
			sections={sections}
			onPoint={setHover}
			onPick={(axis, touch) => {
				if (touch) setHover(null)
				setPin(!axis || pin === axis ? null : axis)
			}}
			label={label}
			W={240}
			H={196}
		/>
	)

	return (
		<>
			{geo && <RidgeSprite id={ridges} geo={geo} />}
			<section
				id="fp-effects"
				aria-label="What it does to you"
				className="min-w-0"
			>
				<Lines
					rows={reading.rows}
					size="lg"
					values
					active={row}
					onHover={setRow}
				/>
				<NotFor line={notForLine(reading.not)} className="mt-3" />
			</section>
			<section
				id="fp-print"
				aria-label="The print"
				className="min-w-0 scroll-mt-32"
			>
				<div ref={printBox}>
					<div className="grid items-center gap-x-10 gap-y-8 @min-[760px]/deep:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<div className="mx-auto w-full max-w-[30rem]">{print}</div>
						<div aria-live="polite" className="grid min-w-0">
							{candidates.map((c) => (
								<div
									key={shownKey(c)}
									aria-hidden="true"
									className="invisible pointer-events-none [grid-area:1/1]"
								>
									<Detail shown={c} type={type} ranks={ranks} still />
								</div>
							))}
							{shown && (
								<div data-fp-shown="" className="self-start [grid-area:1/1]">
									<Detail
										key={shownKey(shown)}
										shown={shown}
										type={type}
										ranks={ranks}
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			</section>
			<section
				id="fp-scales"
				aria-label="Twelve scales"
				className="min-w-0 scroll-mt-32"
			>
				<Scales scales={reading.scales} active={scaleName} onHover={setScale} />
			</section>
		</>
	)
}

const shownKey = (x: Shown) =>
	x.kind === "section"
		? `sec-${x.sec.id}`
		: x.kind === "effect"
			? `fx-${x.r.effect.id}`
			: `sc-${x.s.sc.name}`

// --- Shared pieces ---------------------------------------------------------------------------------------------

interface Explained {
	name: string
	color: string
	value: number
	word: string
	meaning: string
	effects: EffectReading[]
}

function explain(shown: Exclude<Shown, { kind: "scale" }>): Explained {
	if (shown.kind === "section") {
		const { sec } = shown
		return {
			name: sec.label,
			color: sec.color,
			value: sec.strength,
			word: sec.word,
			meaning: SECTION_MEANING[sec.id] ?? "",
			effects: sec.members.map((m) => m.r),
		}
	}
	const { r } = shown
	return {
		name: r.effect.name,
		color: phraseOf(r).color,
		value: r.strength,
		word: strengthWord(r),
		meaning: r.effect.meaning,
		effects: [],
	}
}

// --- The detail beside the print -------------------------------------------------------------------------------

function Detail({
	shown,
	type,
	ranks,
	still = false,
}: {
	shown: Shown
	type: "movie" | "show"
	ranks: FpRanks | null
	still?: boolean
}) {
	if (shown.kind === "scale") return <ScaleDetail s={shown.s} still={still} />
	const x = explain(shown)
	const rank = rankLine(
		ranks?.ranks[
			shown.kind === "section"
				? sectionRankKey(shown.sec.id)
				: shown.r.effect.id
		],
		type,
	)
	return (
		<div className={`${still ? "" : "fp-in "}grid gap-7`}>
			<div>
				<div className="flex flex-wrap items-baseline gap-x-3">
					<span
						className="text-[34px] leading-none font-bold tracking-[-0.02em]"
						style={{ color: x.color, fontFamily: DISPLAY }}
					>
						{x.name}
					</span>
					<span
						className="text-[28px] leading-none font-bold text-white tabular-nums"
						style={{ fontFamily: DISPLAY }}
					>
						{x.value.toFixed(1)}
					</span>
					<span className="text-[14px] font-medium text-gray-400">
						{x.word}
					</span>
				</div>
				<p className="mt-2 text-[15px] text-gray-300">{x.meaning}</p>
				<Track value={x.value} color={x.color} rank={rank} />
			</div>
			{x.effects.length > 0 && (
				<div>
					<h3 className={`${CAPTION} mb-2`}>Effects</h3>
					<Lines rows={x.effects.map(phraseOf)} size="sm" values />
				</div>
			)}
		</div>
	)
}

/** A scale pointed at: its word, where the title sits between the two ends, and the scores it's read from. */
function ScaleDetail({ s, still }: { s: ScaleReading; still: boolean }) {
	const at = s.position * 100
	return (
		<div className={`${still ? "" : "fp-in "}grid gap-7`}>
			<div>
				<div className="flex flex-wrap items-baseline gap-x-3">
					<span
						className="text-[34px] leading-none font-bold tracking-[-0.02em]"
						style={{ color: s.color, fontFamily: DISPLAY }}
					>
						{s.word}
					</span>
					<span className="text-[14px] font-medium text-gray-400">
						{s.sc.name}
					</span>
				</div>
				<p className="mt-2 text-[15px] text-gray-300">
					On the scale from {s.sc.left.toLowerCase()} to{" "}
					{s.sc.right.toLowerCase()}.
				</p>
				<div className="mt-4 max-w-[34rem]">
					<div
						className="relative h-2 rounded-full bg-white/[0.07]"
						aria-hidden="true"
					>
						<span
							className="absolute inset-y-0 rounded-full"
							style={{
								left: `${s.sc.fromMiddle ? Math.min(50, at) : 0}%`,
								width: `${s.sc.fromMiddle ? Math.abs(at - 50) : at}%`,
								background: s.color,
								opacity: 0.8,
							}}
						/>
						{s.sc.fromMiddle && (
							<span className="absolute -top-1 -bottom-1 left-1/2 w-px bg-white/30" />
						)}
						<span
							className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
							style={{
								left: `${at}%`,
								background: s.color,
								boxShadow: `0 0 16px ${s.color}`,
							}}
						/>
					</div>
					<div className="mt-1.5 flex justify-between text-[11px] text-gray-500">
						<span>{s.sc.left}</span>
						<span>{s.sc.right}</span>
					</div>
				</div>
			</div>
		</div>
	)
}

/** 0-10 with this title's value as a glowing dot; under it, where that ranks among popular titles (when known). */
function Track({
	value,
	color,
	rank,
}: { value: number; color: string; rank: string | null }) {
	return (
		<div className="mt-4 max-w-[34rem]">
			<div
				className="relative h-2 rounded-full bg-white/[0.07]"
				aria-hidden="true"
			>
				<span
					className="absolute inset-y-0 left-0 rounded-full"
					style={{
						width: `${value * 10}%`,
						background: `linear-gradient(90deg, color-mix(in srgb, ${color} 25%, transparent), ${color})`,
					}}
				/>
				<span
					className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
					style={{
						left: `${value * 10}%`,
						background: color,
						boxShadow: `0 0 16px ${color}`,
					}}
				/>
			</div>
			<div
				className="mt-1.5 flex justify-between text-[11px] text-gray-500"
				aria-hidden="true"
			>
				<span>0</span>
				<span>10</span>
			</div>
			{rank && (
				<p className="mt-2 text-[14px] font-medium text-gray-300">{rank}.</p>
			)}
		</div>
	)
}

// --- The twelve scales ---------------------------------------------------------------------------------------

/** The dials in their groups; pointing at one works the way pointing at an effect line does (Lines). */
function Scales({
	scales,
	active,
	onHover,
}: {
	scales: ScaleReading[]
	active: string | null
	onHover: (name: string | null) => void
}) {
	const byName = new Map(scales.map((s) => [s.sc.name, s]))
	const groups = SCALE_GROUPS.map((g) => ({
		name: g.name,
		dials: [
			...g.scales.map((sc) => sc.name),
			...(g.name === "Look" ? ["Originality"] : []),
		]
			.map((n) => byName.get(n))
			.filter((s): s is ScaleReading => !!s),
	}))
	return (
		// The dials tile their grid (padding inside each, no gaps), and only leaving the whole grid lets go, so
		// moving from one to the next never passes through nothing pointed at (no flicker).
		<div
			className="grid gap-6 @min-[860px]/deep:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] @min-[860px]/deep:gap-10"
			onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
		>
			{groups.map((g) => (
				<div key={g.name} className="min-w-0">
					<h3 className={`${CAPTION} mb-1.5`}>{g.name}</h3>
					<ul
						className={`-mx-2 grid grid-cols-2 ${g.dials.length > 3 ? "@min-[560px]/deep:grid-cols-3 @min-[860px]/deep:grid-cols-2" : "@min-[860px]/deep:grid-cols-1"}`}
						aria-label={`${g.name} scales`}
					>
						{g.dials.map((s) => {
							const id = s.sc.name
							return (
								<li
									key={id}
									data-fp-scale={id}
									className="fp-fade min-w-0"
									style={{ opacity: active && active !== id ? 0.45 : 1 }}
								>
									<button
										type="button"
										onPointerEnter={(e) =>
											e.pointerType === "mouse" && onHover(id)
										}
										onFocus={() => onHover(id)}
										onBlur={() => onHover(null)}
										onClick={() => onHover(active === id ? null : id)}
										aria-pressed={active === id}
										className="block h-full w-full cursor-default rounded-lg px-2 py-0.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-amber-300"
									>
										<StaticDial s={s} ends />
									</button>
								</li>
							)
						})}
					</ul>
				</div>
			))}
		</div>
	)
}
