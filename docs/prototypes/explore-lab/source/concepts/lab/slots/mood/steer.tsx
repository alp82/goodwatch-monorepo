// PROTOTYPE - throwaway (prototype/explore-r6, slot "mood"). Steering: every way to tailor a mood page's list, as one
// model the sidebar variants (slot "mood-steer") draw in their own way. A way to steer is a row: a plain question, its
// value when set, and a control that fits it (a dial, the kinds as share bars, the decades as a bar strip you can
// drag across, the countries as their shapes). Whatever is set also shows as a pill over the grid, where it acts.
import { Link, useNavigate } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import {
	CalendarIcon,
	ChatBubbleBottomCenterTextIcon,
	EyeSlashIcon,
	FilmIcon,
	PlusIcon,
	TagIcon,
	TvIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useMyServices } from "~/ui/filter-bar/useFilterData"
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	forwardRef,
	useRef,
	useState,
} from "react"
import { type Address, type Family, add, kindNoun, remove } from "../../../../kit/address"
import type { PlaceRef, TraitWord as TraitWordData } from "../../../../kit/types"
import { FOCUS, PlaceMark, poster } from "../../../../kit/ui"
import { EASE, QUICK_T } from "../../../../kit/ui/motion"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import { Dial } from "../../../dials/Dial"
import type { DialSpec, Exit } from "../../../dials/tune"
import type { SteerAdd, SteerCount } from "./page.server"
import { type MoodTuner, type Props, cleared, dialParams, dialToken, said } from "./shared"

// ---------------------------------------------------------------------------------------------------------
// The model

export interface SteerRow {
	id: string
	/** "How heartwarming?", "Which kind?", "From when?" */
	question: string
	/** A small glyph that previews the control (a track with its knob, bars, a shape). */
	glyph: ReactNode
	/** What it is set to, or null: off. */
	value: string | null
	/** The value's color where it has one (a dial's trait color, a kind's mood). */
	color?: string
	/** Takes it off: a callback (a dial) or a link (a kind, a decade, a country). */
	clear?: () => void
	clearTo?: string
	/** The control that sets it. */
	control: ReactNode
	/** One quiet line under an off row's question: what it does. */
	hint: string
	/** Which group of the column it sits in. */
	group: SteerGroup
}

export type SteerGroup = "parts" | "feel" | "narrow" | "blend" | "you"

/** The column's groups, in order, with their small headings. */
export const STEER_GROUPS: { id: SteerGroup; label: string }[] = [
	{ id: "parts", label: "Blended in" },
	{ id: "feel", label: "How it feels" },
	{ id: "narrow", label: "Narrow it down" },
	{ id: "blend", label: "Blend one in" },
	{ id: "you", label: "For you" },
]

export interface SteerModel {
	rows: SteerRow[]
	/** The rows that are set, in row order. */
	on: SteerRow[]
	/** Takes everything off. */
	clearAll: () => void
	/** The page's link maker that keeps the steering (never the offset). */
	link: (a: Address, more?: Record<string, string | undefined>) => string
	/** The query the steering adds to a link. */
	keep: Record<string, string | undefined>
	/** "All cozy movies", or the kind's name. */
	listName: string
	/** Round 8: on a blend, what only the blend has ("together they come out more …"); the column's foot shows it. */
	together: { traits: TraitWordData[]; noun: string; many: boolean } | null
}

const DECADE_SHORT = (slug: string) => `’${slug.slice(2, 4)}s`

export function useSteer(
	{ data, address, to, viewer }: Pick<Props, "data" | "address" | "to" | "viewer">,
	tuner: MoodTuner,
): SteerModel {
	const navigate = useNavigate()
	const mine = useMyServices()
	const hasServices = viewer.hasServices || mine.ids.length > 0
	const { room, dz, steer, kinds } = data
	const what = said(room.title, room.parts)
	const keep = dialParams(dz.dials)
	const link = (a: Address, more: Record<string, string | undefined> = {}) =>
		to({ ...a, page: undefined }, { ...keep, ...more })
	// Round 9: the decade and the country are parts of the blend (title, rooms row, About). Setting one swaps the part
	// of that family that isn't the page's own lead; the list's sort and switches stay.
	const setPart = (family: "decade" | "country", slug: string | null | undefined) => {
		const current = address.parts.find((p, i) => i > 0 && p.family === family)
		let a: Address = current ? (remove(address, current) as Address) : address
		if (slug) a = add(a, { family, slug })
		return link({
			...a,
			sort: address.sort,
			mine: address.mine,
			unseen: address.unseen,
			level: a.parts[0] === address.parts[0] ? address.level : undefined,
		})
	}
	const kindOn = kinds.find((k) => k.id === address.kind_)

	// Leaving for another place (a neighbor past a dial's end, a blend) keeps what the column shows as set and that
	// still means something there: the decade, the country, my services, not seen, the sort, and the direction dials
	// other than the one that led away. Never a kind (it belongs to this place) and never anything hidden.
	const visible = (skipDial?: string): Record<string, string | undefined> => ({
		...Object.fromEntries(
			dz.dials
				.filter((d) => d.kind !== "much" && d.id !== skipDial && d.id !== "level")
				.map((d) => [d.id, d.value ?? undefined]),
		),
		sort: address.sort && address.sort !== "popular" ? address.sort : undefined,
		mine: address.mine ? "1" : undefined,
		unseen: address.unseen ? "1" : undefined,
	})
	const carry = (exit: Exit | null | undefined, dialId: string): Exit | null | undefined => {
		if (!exit) return exit
		const u = new URL(exit.to, "http://lab.local")
		for (const [k, v] of Object.entries(visible(dialId)))
			if (v != null && !u.searchParams.has(k)) u.searchParams.set(k, v)
		// The decade and the country set in the column go along as parts of the neighbor's blend.
		const along = address.parts
			.filter((p, i) => i > 0 && (p.family === "decade" || p.family === "country"))
			.map((p) => `${p.family}:${p.slug}`)
		if (along.length)
			u.searchParams.set(
				"with",
				[
					...new Set([...(u.searchParams.get("with")?.split(",").filter(Boolean) ?? []), ...along]),
				].join(","),
			)
		return { ...exit, to: `${u.pathname}${u.search}` }
	}
	const blendTo = (family: Family, slug: string) =>
		to(
			add({ ...address, sort: undefined, mine: undefined, unseen: undefined }, { family, slug }),
			visible(),
		)

	const dialRows: SteerRow[] = dz.dials.map((d) => {
		const at = tuner.settings[d.id] ?? null
		const colored = d.kind === "much" && d.color !== "#e5e7eb"
		return {
			id: `dial-${d.id}`,
			question: d.question,
			glyph: <TrackGlyph spec={d} at={at} />,
			value: at == null ? null : dialToken(d, at),
			color: colored ? d.color : undefined,
			clear: () => tuner.rest(d),
			control: (
				// The dial's own head (question and value) is the row's; the control is the track, its stops and the ways out.
				<div className="[&>div>div:first-child]:hidden">
					<Dial
						spec={{
							...d,
							lowExit: carry(d.lowExit, d.id),
							highExit: carry(d.highExit, d.id),
						}}
						at={at}
						onChange={(c) => tuner.change(d, c)}
						rest={restLine(d)}
					/>
				</div>
			),
			hint:
				d.kind === "much"
					? "A touch, plenty, or all the way."
					: `${d.low} or ${d.high.toLowerCase()}.`,
			group: "feel" as const,
		}
	})

	const kindRow: SteerRow | null =
		kinds.length > 1
			? {
					id: "kind",
					question: "Which kind?",
					glyph: (
						<KindGlyph
							shares={kinds.map((k) => k.share)}
							on={kindOn ? kinds.indexOf(kindOn) : -1}
						/>
					),
					value: kindOn?.name ?? null,
					color: kindOn?.mood?.hue,
					clearTo: link({ ...address, kind_: undefined }),
					control: (
						<KindBars
							kinds={kinds.map((k) => ({
								id: k.id,
								name: k.name,
								share: k.share,
								words: k.traits.slice(0, 2).map((t) => ({ word: t.word, color: t.color })),
								hue: k.mood?.hue,
								posters: k.titles.slice(0, 3).map((t) => t.card.poster_path),
								to: link({ ...address, kind_: address.kind_ === k.id ? undefined : k.id }),
								on: address.kind_ === k.id,
							}))}
						/>
					),
					hint: `${kinds.length} kinds inside ${what}.`,
					group: "narrow",
				}
			: null

	const whenRow: SteerRow | null =
		steer.decades.length > 1
			? {
					id: "when",
					question: "From when?",
					glyph: (
						<BarsGlyph
							values={steer.decades.map((d) => d.n)}
							on={steer.decades.findIndex((d) => d.place.slug === steer.when)}
						/>
					),
					value: steer.when
						? (steer.decades.find((d) => d.place.slug === steer.when)?.place.label ?? steer.when)
						: null,
					clearTo: setPart("decade", null),
					control: (
						<DecadeBars
							decades={steer.decades}
							on={steer.when}
							go={(slug) =>
								navigate(setPart("decade", slug), {
									replace: true,
									preventScrollReset: true,
								})
							}
							hrefOf={(slug) => setPart("decade", slug)}
						/>
					),
					hint: "Drag across the decades, or tap one.",
					group: "narrow",
				}
			: null

	const fromRow: SteerRow | null =
		steer.countries.length > 1
			? {
					id: "from",
					question: "From where?",
					glyph: (
						<ShapeGlyph
							code={steer.countries.find((c) => c.place.slug === steer.from)?.place.code}
						/>
					),
					group: "narrow",
					value: steer.from
						? (steer.countries.find((c) => c.place.slug === steer.from)?.place.label ?? steer.from)
						: null,
					clearTo: setPart("country", null),
					control: (
						<CountryPicks
							countries={steer.countries}
							on={steer.from}
							hrefOf={(slug) => setPart("country", slug === steer.from ? null : slug)}
						/>
					),
					hint: `Where ${what} come from most.`,
				}
			: null

	const watchRow: SteerRow = {
		id: "watch",
		question: "Where to watch?",
		glyph: <TvIcon className="h-4 w-4" aria-hidden />,
		value: address.mine && hasServices ? "On my services" : null,
		clearTo: link({ ...address, mine: undefined }),
		control: hasServices ? (
			<div className="space-y-2.5">
				<div className="flex flex-wrap gap-1.5">
					{mine.providers.slice(0, 8).map((p) => (
						<img
							key={p.id}
							src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
							alt=""
							className="h-8 w-8 rounded-lg ring-1 ring-white/15"
							loading="lazy"
						/>
					))}
				</div>
				<Choice
					options={[
						{ label: "Everywhere", to: link({ ...address, mine: undefined }), on: !address.mine },
						{ label: "On my services", to: link({ ...address, mine: true }), on: !!address.mine },
					]}
				/>
			</div>
		) : (
			<Link
				to="/settings/streaming"
				className={`flex h-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-bold text-white ring-1 ring-white/15 ${QUICK_T} hover:bg-white/[0.12] ${FOCUS}`}
			>
				Add my services
			</Link>
		),
		hint: hasServices
			? "Only what your services carry."
			: "Pick your services once, then steer by them.",
		group: "you",
	}
	const seenRow: SteerRow = {
		id: "seen",
		question: "Seen it already?",
		glyph: <EyeSlashIcon className="h-4 w-4" aria-hidden />,
		value: address.unseen ? "Not seen yet" : null,
		clearTo: link({ ...address, unseen: undefined }),
		control: (
			<Choice
				options={[
					{
						label: "Show everything",
						to: link({ ...address, unseen: undefined }),
						on: !address.unseen,
					},
					{ label: "Not seen yet", to: link({ ...address, unseen: true }), on: !!address.unseen },
				]}
			/>
		),
		hint: "Leave out what you have scored or watched.",
		group: "you",
	}

	// Blend one in: a genre on a mood page, a mood on a genre page. It leads to the blend, which is the same page.
	const addRows: SteerRow[] = steer.adds.map((a: SteerAdd) => ({
		id: `add-${a.family}`,
		question:
			a.family === "genre"
				? "Add a genre?"
				: a.family === "mood"
					? "Add a mood?"
					: a.family === "trope"
						? "Add a trope?"
						: "Add one?",
		glyph: <PlusIcon className="h-4 w-4" aria-hidden />,
		value: null,
		control: (
			<AddPicks
				items={a.items.map((x) => ({
					label: x.place.label,
					hue: x.place.hue,
					to: blendTo(x.place.family, x.place.slug),
				}))}
			/>
		),
		hint:
			a.family === "genre"
				? `The genres ${what} mix with most.`
				: a.family === "trope"
					? `The tropes ${what} play far more than elsewhere.`
					: `The moods ${what} lean into most.`,
		group: "blend",
	}))

	// Round 9: on a blend, every blended part is a set row of its own (the decade and the country show in their rows
	// under Narrow it down), so the column says everything that's on: the title, the row and the column agree.
	const partRows: SteerRow[] =
		room.parts.length > 1
			? data.about.parts
					.filter(
						(p, i) => !(i > 0 && (p.place.family === "decade" || p.place.family === "country")),
					)
					.map((p) => {
						const part = { family: p.place.family, slug: p.place.slug }
						return {
							id: `part-${p.place.family}-${p.place.slug}`,
							question: p.family,
							glyph: <PartGlyph place={p.place} />,
							value: p.place.label,
							color: p.place.hue,
							clearTo: to(
								{ ...(remove({ ...address, sort: undefined }, part) as Address), page: undefined },
								visible(),
							),
							control: (
								<div className="space-y-2 text-sm">
									{p.line && <p className="leading-snug text-gray-300">{p.line}</p>}
									<Link
										to={p.to}
										prefetch="intent"
										className={`inline-flex items-center gap-1 rounded-sm font-semibold text-gray-200 hover:text-white ${FOCUS}`}
									>
										{p.place.family === "trope"
											? "The trope's page"
											: `${p.place.label} on its own`}
										<span aria-hidden>›</span>
									</Link>
								</div>
							),
							hint: p.line ?? "",
							group: "parts" as const,
						}
					})
			: []

	const rows = [
		...partRows,
		dialRows[0],
		kindRow,
		...dialRows.slice(1),
		whenRow,
		fromRow,
		...addRows,
		watchRow,
		seenRow,
	].filter((r): r is SteerRow => Boolean(r))
	const on = rows.filter((r) => r.value != null)
	const clearAll = () => {
		tuner.reset()
		navigate(to(cleared(address)), { replace: true, preventScrollReset: true })
	}
	return {
		rows,
		on,
		clearAll,
		link,
		keep,
		listName: kindOn ? kindOn.name : `All ${what}`,
		together:
			room.parts.length > 1 && data.title.together.length
				? {
						traits: data.title.together,
						noun: kindNoun(address.kind),
						many: room.parts.length > 2,
					}
				: null,
	}
}

/** A blended part's glyph: a mood's color, a country's flag, otherwise its family's sign. */
function PartGlyph({ place: p }: { place: PlaceRef }) {
	if (p.family === "mood" || p.family === "country") return <PlaceMark place={p} size={16} />
	const Icon =
		p.family === "genre"
			? FilmIcon
			: p.family === "trope"
				? ChatBubbleBottomCenterTextIcon
				: p.family === "decade"
					? CalendarIcon
					: p.family === "service"
						? TvIcon
						: TagIcon
	return <Icon aria-hidden className="h-4 w-4" style={p.hue ? { color: p.hue } : undefined} />
}

const restLine = (d: DialSpec) =>
	d.home !== null && d.homeLabel
		? `The ringed knob is ${d.homeLabel.charAt(0).toLowerCase()}${d.homeLabel.slice(1)}.`
		: undefined

// ---------------------------------------------------------------------------------------------------------
// Glyphs: a row's control in miniature, so an off row already says what it will do.

function TrackGlyph({ spec, at }: { spec: DialSpec; at: number | null }) {
	const colored = spec.kind === "much" && spec.color !== "#e5e7eb"
	const x = 3 + (at ?? spec.home ?? 0.5) * 22
	const color = colored ? spec.color : "#e5e7eb"
	return (
		<svg viewBox="0 0 28 14" className="h-3.5 w-7 shrink-0" aria-hidden>
			<rect x="2" y="6" width="24" height="2" rx="1" fill="currentColor" opacity={0.25} />
			{at != null && colored && <rect x="2" y="6" width={x - 2} height="2" rx="1" fill={color} />}
			<circle
				cx={x}
				cy="7"
				r={at == null ? 3.2 : 3.6}
				fill={at == null ? "transparent" : color}
				stroke={at == null ? (colored ? color : "currentColor") : "none"}
				strokeOpacity={at == null ? 0.7 : 1}
				strokeWidth="1.4"
			/>
		</svg>
	)
}

function KindGlyph({ shares, on }: { shares: number[]; on: number }) {
	const total = shares.reduce((s, x) => s + x, 0) || 1
	let x = 1
	return (
		<svg viewBox="0 0 28 14" className="h-3.5 w-7 shrink-0" aria-hidden>
			{shares.map((s, i) => {
				const w = Math.max(2, (s / total) * 26 - 1.5)
				const r = (
					<rect
						// oxlint-disable-next-line react/no-array-index-key -- fixed order
						key={i}
						x={x}
						y="4"
						width={w}
						height="6"
						rx="1.5"
						fill="currentColor"
						opacity={on < 0 ? 0.35 : i === on ? 1 : 0.15}
					/>
				)
				x += w + 1.5
				return r
			})}
		</svg>
	)
}

function BarsGlyph({ values, on }: { values: number[]; on: number }) {
	const max = Math.max(1, ...values)
	const w = 26 / values.length
	return (
		<svg viewBox="0 0 28 14" className="h-3.5 w-7 shrink-0" aria-hidden>
			{values.map((v, i) => {
				const h = Math.max(1.5, Math.sqrt(v / max) * 12)
				return (
					<rect
						// oxlint-disable-next-line react/no-array-index-key -- fixed order
						key={i}
						x={1 + i * w}
						y={13 - h}
						width={Math.max(1, w - 0.8)}
						height={h}
						rx="0.6"
						fill="currentColor"
						opacity={on < 0 ? 0.4 : i === on ? 1 : 0.15}
					/>
				)
			})}
		</svg>
	)
}

function ShapeGlyph({ code }: { code?: string }) {
	if (code)
		return (
			<span className="grid h-3.5 w-7 shrink-0 place-items-center">
				<FlagShape code={code} size={18} />
			</span>
		)
	return (
		<svg viewBox="0 0 28 14" className="h-3.5 w-7 shrink-0" aria-hidden>
			<circle
				cx="14"
				cy="7"
				r="5.5"
				fill="none"
				stroke="currentColor"
				strokeOpacity="0.6"
				strokeWidth="1.3"
			/>
			<path
				d="M8.5 7h11M14 1.5c-2.4 2.8-2.4 8.2 0 11M14 1.5c2.4 2.8 2.4 8.2 0 11"
				fill="none"
				stroke="currentColor"
				strokeOpacity="0.6"
				strokeWidth="1"
			/>
		</svg>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Controls

/** Two or three plain options side by side; the picked one is lit. */
function Choice({ options }: { options: { label: string; to: string; on: boolean }[] }) {
	return (
		<div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/[0.07]">
			{options.map((o) => (
				<Link
					key={o.label}
					to={o.to}
					replace
					preventScrollReset
					prefetch="intent"
					aria-current={o.on ? "true" : undefined}
					className={`flex h-9 items-center justify-center rounded-lg px-2 text-[13px] font-bold whitespace-nowrap ${QUICK_T} ${FOCUS} ${
						o.on
							? "bg-white text-gray-950 shadow"
							: "text-gray-400 hover:bg-white/[0.06] hover:text-white"
					}`}
				>
					{o.label}
				</Link>
			))}
		</div>
	)
}

interface KindItem {
	id: string
	name: string
	share: number
	words: { word: string; color: string }[]
	hue?: string
	posters: (string | null)[]
	to: string
	on: boolean
}

/**
 * The kinds as share bars: each kind's bar is as long as its share of the place, in the color of the mood most of its
 * titles share, with two words that set it apart. Three small posters stand at its end as support.
 */
export function KindBars({ kinds }: { kinds: KindItem[] }) {
	const max = Math.max(...kinds.map((k) => k.share), 0.01)
	const any = kinds.some((k) => k.on)
	return (
		<ul className="space-y-1.5" aria-label="Kinds">
			{kinds.map((k) => (
				<li key={k.id}>
					<Link
						to={k.to}
						replace
						preventScrollReset
						prefetch="intent"
						aria-current={k.on ? "true" : undefined}
						className={`group/kind relative flex min-h-14 items-center gap-3 overflow-hidden rounded-xl px-3 py-2 ring-1 ${QUICK_T} ${FOCUS} ${
							k.on
								? "bg-white/[0.09] ring-white/40"
								: any
									? "opacity-55 ring-white/[0.06] hover:opacity-100 hover:ring-white/20"
									: "ring-white/[0.06] hover:bg-white/[0.04] hover:ring-white/20"
						}`}
					>
						{/* The share, as a bar behind the words. */}
						<span
							aria-hidden
							className={`absolute inset-y-0 left-0 origin-left ${QUICK_T}`}
							style={{
								width: `${(k.share / max) * 100}%`,
								background: `linear-gradient(90deg, ${k.hue ?? "#9ca3af"}${k.on ? "40" : "26"}, ${k.hue ?? "#9ca3af"}08)`,
							}}
						/>
						<span className="relative min-w-0 flex-1">
							<span className="flex items-baseline gap-2">
								<span className="truncate text-[14px] leading-tight font-bold text-white">
									{k.name}
								</span>
							</span>
							<span className="mt-0.5 block truncate text-xs font-semibold">
								{k.words.map((w, i) => (
									<span key={w.word} style={{ color: w.color }}>
										{i > 0 && <span className="text-gray-600"> · </span>}
										{w.word}
									</span>
								))}
							</span>
						</span>
						<span aria-hidden className="relative flex shrink-0 -space-x-3">
							{k.posters.map((p, i) => (
								<span
									// oxlint-disable-next-line react/no-array-index-key -- fixed trio
									key={i}
									className={`block h-9 w-6 overflow-hidden rounded-[3px] bg-gray-800 ring-1 ring-black/50 ${QUICK_T} group-hover/kind:translate-y-[-1px]`}
									style={{ transform: `rotate(${(i - 1) * 5}deg)` }}
								>
									{p && (
										<img
											src={poster(p, "w92")}
											alt=""
											className="h-full w-full object-cover"
											loading="lazy"
										/>
									)}
								</span>
							))}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * The decades as a bar strip, each bar as tall as the decade's share of the list. Tap a bar, or press and drag across
 * the strip: the lit bar follows the finger, and letting go picks it. Arrow keys step, Escape lets go of the decade.
 */
export function DecadeBars({
	decades,
	on,
	go,
	hrefOf,
}: {
	decades: SteerCount[]
	on: string | null
	go: (slug: string | null) => void
	hrefOf: (slug: string) => string
}) {
	const strip = useRef<HTMLDivElement>(null)
	const [hover, setHover] = useState<number | null>(null)
	const [dragging, setDragging] = useState(false)
	const max = Math.max(1, ...decades.map((d) => d.n))
	const onIndex = decades.findIndex((d) => d.place.slug === on)
	const lit = hover ?? onIndex
	const indexAt = (e: PointerEvent) => {
		const r = strip.current?.getBoundingClientRect()
		if (!r) return -1
		const i = Math.floor(((e.clientX - r.left) / r.width) * decades.length)
		return Math.max(0, Math.min(decades.length - 1, i))
	}
	const down = (e: PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return
		e.preventDefault()
		e.currentTarget.setPointerCapture(e.pointerId)
		setDragging(true)
		setHover(indexAt(e))
	}
	const up = (e: PointerEvent<HTMLDivElement>) => {
		if (!dragging) return
		setDragging(false)
		const i = indexAt(e)
		setHover(null)
		const slug = decades[i]?.place.slug
		if (slug) go(slug === on ? null : slug)
	}
	const key = (e: KeyboardEvent<HTMLDivElement>) => {
		const last = decades.length - 1
		let next: number | null = null
		if (e.key === "ArrowRight") next = onIndex < 0 ? last : Math.min(last, onIndex + 1)
		else if (e.key === "ArrowLeft") next = onIndex < 0 ? last : Math.max(0, onIndex - 1)
		else if (e.key === "Escape" || e.key === "Backspace") {
			e.preventDefault()
			go(null)
			return
		} else return
		e.preventDefault()
		go(decades[next].place.slug)
	}
	const shown = lit >= 0 ? decades[lit] : null
	return (
		<div>
			<div className="flex h-5 items-baseline justify-between text-xs font-semibold">
				<span className={shown ? "text-white" : "text-gray-500"}>
					{shown ? shown.place.label : "Every decade"}
				</span>
				<span className="text-gray-500">{shown ? shareWord(shown.n, decades) : "Tap or drag"}</span>
			</div>
			<div
				ref={strip}
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a bar strip you drag across, as the dials
				role="slider"
				tabIndex={0}
				aria-label="From when"
				aria-valuemin={0}
				aria-valuemax={decades.length - 1}
				aria-valuenow={Math.max(0, onIndex)}
				aria-valuetext={on ? (decades[onIndex]?.place.label ?? on) : "Every decade"}
				onPointerDown={down}
				onPointerMove={(e) => {
					if (dragging) setHover(indexAt(e))
					else if (e.pointerType === "mouse") setHover(indexAt(e))
				}}
				onPointerLeave={() => !dragging && setHover(null)}
				onPointerUp={up}
				onPointerCancel={() => {
					setDragging(false)
					setHover(null)
				}}
				onKeyDown={key}
				className={`mt-1.5 flex h-16 touch-none items-end gap-[3px] rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-400 ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
			>
				{decades.map((d, i) => (
					<a
						key={d.place.slug}
						href={hrefOf(d.place.slug)}
						tabIndex={-1}
						draggable={false}
						onClick={(e) => e.preventDefault()}
						aria-label={d.place.label}
						className="flex h-full flex-1 flex-col justify-end"
					>
						<span
							className={`block w-full origin-bottom rounded-t-[3px] ${QUICK_T} ${
								i === lit
									? "bg-amber-300"
									: i === onIndex
										? "bg-amber-300/70"
										: lit >= 0
											? "bg-white/15"
											: "bg-white/30"
							}`}
							style={{
								height: `${Math.max(4, (d.n / max) * 100)}%`,
								transform: i === lit ? "scaleY(1.04)" : undefined,
							}}
						/>
					</a>
				))}
			</div>
			<div aria-hidden className="mt-1 flex gap-[3px] text-[10px] font-semibold text-gray-500">
				{decades.map((d, i) => (
					<span
						key={d.place.slug}
						className={`flex-1 text-center ${i === lit ? "text-amber-200" : ""} ${decades.length > 8 && i % 2 ? "invisible" : ""}`}
					>
						{DECADE_SHORT(d.place.slug)}
					</span>
				))}
			</div>
		</div>
	)
}

/** How big a decade is next to the others, as a word: no counts (people don't steer by them). */
function shareWord(n: number, decades: SteerCount[]): string {
	const max = Math.max(1, ...decades.map((d) => d.n))
	const r = n / max
	return r > 0.75
		? "Where most of them are"
		: r > 0.4
			? "Plenty"
			: r > 0.15
				? "A good few"
				: "Rare finds"
}

const COUNTRY_FIRST = 9

/**
 * Every country with a fair number of titles here, as its shape filled with its flag. The nine with the most come
 * first; "Every country" opens the rest as a compact list, so Africa and South America are a tap away too.
 */
export function CountryPicks({
	countries,
	on,
	hrefOf,
}: {
	countries: SteerCount[]
	on: string | null
	hrefOf: (slug: string) => string
}) {
	const [all, setAll] = useState(false)
	const first = countries.slice(0, COUNTRY_FIRST)
	const onLater = on && !first.some((c) => c.place.slug === on)
	const rest = countries.slice(COUNTRY_FIRST)
	const tile = (c: SteerCount) => {
		const lit = c.place.slug === on
		return (
			<li key={c.place.slug}>
				<Link
					to={hrefOf(c.place.slug)}
					replace
					preventScrollReset
					prefetch="intent"
					aria-current={lit ? "true" : undefined}
					className={`group/c flex h-[4.4rem] flex-col items-center justify-center gap-1.5 rounded-xl px-1 ring-1 ${QUICK_T} ${FOCUS} ${
						lit
							? "bg-white/[0.1] text-white ring-white/45"
							: on
								? "text-gray-400 opacity-60 ring-white/[0.06] hover:opacity-100 hover:ring-white/20"
								: "text-gray-300 ring-white/[0.06] hover:bg-white/[0.05] hover:text-white hover:ring-white/20"
					}`}
				>
					<span className={`grid h-8 place-items-center ${QUICK_T} group-hover/c:scale-105`}>
						{c.place.code ? (
							<FlagShape code={c.place.code} size={32} />
						) : (
							<span className="text-xs font-bold">{c.place.label.slice(0, 2)}</span>
						)}
					</span>
					<span className="max-w-full truncate text-[11px] leading-none font-bold">
						{c.place.label}
					</span>
				</Link>
			</li>
		)
	}
	return (
		<div>
			<ul className="grid grid-cols-3 gap-1.5" aria-label="Countries">
				{first.map(tile)}
				{onLater && tile(countries.find((c) => c.place.slug === on) as SteerCount)}
			</ul>
			{rest.length > 0 && (
				<>
					<button
						type="button"
						aria-expanded={all}
						onClick={() => setAll((x) => !x)}
						className={`mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-gray-300 ring-1 ring-white/[0.08] ${QUICK_T} hover:bg-white/[0.05] hover:text-white ${FOCUS}`}
					>
						{all ? "Fewer countries" : `Every country (${countries.length})`}
					</button>
					<Reveal open={all}>
						<ul className="mt-1.5 grid grid-cols-2 gap-x-1 gap-y-0.5" aria-label="More countries">
							{rest.map((c) => {
								const lit = c.place.slug === on
								return (
									<li key={c.place.slug}>
										<Link
											to={hrefOf(c.place.slug)}
											replace
											preventScrollReset
											prefetch="intent"
											aria-current={lit ? "true" : undefined}
											className={`flex h-8 items-center gap-2 rounded-lg px-2 text-[12px] font-semibold ${QUICK_T} ${FOCUS} ${
												lit
													? "bg-white/[0.1] text-white"
													: "text-gray-300 hover:bg-white/[0.05] hover:text-white"
											}`}
										>
											{c.place.code && <FlagShape code={c.place.code} size={16} />}
											<span className="truncate">{c.place.label}</span>
										</Link>
									</li>
								)
							})}
						</ul>
					</Reveal>
				</>
			)}
		</div>
	)
}

/** Ingredients to blend in, as chips in their own color: each leads to the blend (the same page, one part more). */
function AddPicks({ items }: { items: { label: string; hue?: string; to: string }[] }) {
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="Blend one in">
			{items.map((x) => (
				<li key={x.label}>
					<Link
						to={x.to}
						prefetch="intent"
						className={`group/add flex h-9 items-center gap-1.5 rounded-full bg-white/[0.04] pr-3 pl-2 text-[13px] font-bold text-gray-200 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/[0.1] hover:text-white hover:ring-white/30 ${FOCUS}`}
					>
						<span
							aria-hidden
							className={`grid h-5 w-5 place-items-center rounded-full ${QUICK_T} group-hover/add:rotate-90`}
							style={{
								background: x.hue ? `${x.hue}33` : "rgba(255,255,255,0.08)",
								color: x.hue ?? "#e5e7eb",
							}}
						>
							<PlusIcon className="h-3.5 w-3.5" />
						</span>
						{x.label}
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * Opens and closes with a smooth eased height (the one place this page animates a size: a disclosure has to make
 * room). No springs, nothing overshoots.
 */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
	return (
		<AnimatePresence initial={false}>
			{open && (
				<motion.div
					key="reveal"
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: "auto", opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={{
						height: { duration: 0.34, ease: [0.65, 0, 0.35, 1] },
						opacity: { duration: 0.22, ease: EASE },
					}}
					style={{ overflow: "hidden" }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Pills over the grid: what is set, where it acts

export const Token = forwardRef<
	HTMLSpanElement,
	{
		children: ReactNode
		onRemove?: () => void
		removeTo?: string
		/** What taking it off is called for a screen reader: "Take off Romantic comfort watches". */
		label: string
		color?: string
	}
>(function Token({ children, onRemove, removeTo, label, color }, ref) {
	const x = (
		<XMarkIcon
			aria-hidden
			className="h-4 w-4 transition-transform duration-150 group-hover/x:scale-110"
		/>
	)
	const xClass = `group/x grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-950/50 ${QUICK_T} hover:bg-gray-950/10 hover:text-gray-950 ${FOCUS}`
	return (
		<motion.span
			ref={ref}
			layout="position"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
			transition={{ duration: 0.2, ease: EASE }}
			data-token=""
			className="flex h-8 max-w-full items-center gap-1.5 rounded-full bg-white pr-0.5 pl-3 text-[13px] font-bold whitespace-nowrap text-gray-950"
		>
			{color && (
				<span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
			)}
			<span className="truncate">{children}</span>
			{removeTo ? (
				<Link
					to={removeTo}
					replace
					preventScrollReset
					prefetch="intent"
					aria-label={label}
					title={label}
					className={xClass}
				>
					{x}
				</Link>
			) : (
				<button
					type="button"
					onClick={onRemove}
					aria-label={label}
					title={label}
					className={xClass}
				>
					{x}
				</button>
			)}
		</motion.span>
	)
})
