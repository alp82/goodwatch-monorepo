// The head of a mood page as one band that unfolds: folded
// it is the mood's color, its name, one human line, three feel words and the lattice as a tiny glyph; unfolded it is
// the place's full introduction with the lattice the glyph grew into. Transform and opacity only.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { CAPTION } from "~/ui/eyebrow"
import { compactCount } from "~/ui/filter-bar/labels"
import { CheckBadgeIcon } from "@heroicons/react/20/solid"
import {
	FAMILY,
	familyPage,
	hub,
	kindLabel,
	kindNoun,
	place,
	top as topAddress,
} from "~/domain/browse/address"
import type { TraitWord as Trait } from "~/domain/browse/types"
import { EASE, FOCUS, PlaceMark, PosterTrio, TraitWord, WRAP } from "~/ui/browse/index"
import { BlendBar } from "~/ui/browse/blend/BlendBar"
import { DragProvider } from "~/ui/browse/blend/parts"
import { inSentence, phrase, phraseText } from "~/domain/browse/phrase"
import { lattice } from "~/ui/browse/dials/Field"
import { Onward } from "~/ui/browse/place-parts"
import type { PlaceDisplayData } from "~/server/browse/place-display.server"
import { type HeadState, type Props, asWord, cap } from "~/ui/browse/place/shared"

type FieldPlace = NonNullable<PlaceDisplayData["dz"]["field"]>[number]

const GLIDE = { duration: 0.46, ease: EASE } as const

// ---------------------------------------------------------------------------------------------------------
// The lattice: a family on lighter→darker and calmer→intense. Folded it is a glyph of dots; each dot grows into its
// cell when the head unfolds.

const dotId = (slug: string) => `lattice-${slug}`

/** The lattice as a glyph: one dot per place, the page's own lit. */
export function LatticeGlyph({ places, cols = 4 }: { places: FieldPlace[]; cols?: number }) {
	const { rows, cells } = lattice(places, cols)
	return (
		<span
			aria-hidden
			className="grid shrink-0 gap-[3px] transition-transform duration-300 ease-out group-hover/about:scale-110"
			style={{
				gridTemplateColumns: `repeat(${cols}, 7px)`,
				gridTemplateRows: `repeat(${rows}, 7px)`,
			}}
		>
			{cells.map(({ place: p, row, col }) => (
				<motion.span
					key={p.place.slug}
					layoutId={dotId(p.place.slug)}
					transition={GLIDE}
					className="block"
					style={{
						gridRow: row + 1,
						gridColumn: col + 1,
						borderRadius: 999,
						background: p.here ? "#ffffff" : (p.place.hue ?? "#9ca3af"),
						opacity: p.here ? 1 : 0.3 + (p.near ?? 0.5) * 0.4,
						boxShadow: p.here ? "0 0 0 2px rgba(255,255,255,.22)" : undefined,
					}}
				/>
			))}
		</span>
	)
}

const CARD_W = 248

type OnHot = (p: FieldPlace | null, el: HTMLElement | null) => void

/** The lattice's cells at one width. `grown`: the cells arrive from the glyph's dots. */
function Cells({
	places,
	cols,
	grown,
	onHot,
	className = "",
}: {
	places: FieldPlace[]
	cols: number
	grown: boolean
	onHot: OnHot
	className?: string
}) {
	const reduce = useReducedMotion()
	const { rows, cells } = lattice(places, cols)
	const flat = rows <= 2
	return (
		<div
			className={`grid gap-x-2.5 gap-y-2 ${flat ? "grid-cols-[3.6rem_minmax(0,1fr)]" : "grid-cols-[1rem_minmax(0,1fr)]"} ${className}`}
		>
			<span />
			<div className={`flex items-center gap-2.5 ${CAPTION} !tracking-[0.1em]`}>
				<span>Lighter</span>
				<span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/30 to-white/10" />
				<span aria-hidden className="-ml-3 text-white/30">
					›
				</span>
				<span>Darker</span>
			</div>
			{flat ? (
				<div
					className={`grid gap-1.5 ${CAPTION} !tracking-[0.1em]`}
					style={{ gridTemplateRows: "repeat(2, 2.4rem)" }}
				>
					<span className="flex items-center">Calmer</span>
					<span className="flex items-center">Intense</span>
				</div>
			) : (
				<div className={`relative ${CAPTION} !tracking-[0.1em]`}>
					<div className="absolute inset-0 flex items-center gap-2.5 [writing-mode:vertical-rl]">
						<span>Calmer</span>
						<span aria-hidden className="w-px flex-1 bg-gradient-to-b from-white/30 to-white/10" />
						<span>Intense</span>
					</div>
				</div>
			)}
			<div
				className="grid gap-1.5"
				style={{
					gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
					gridTemplateRows: `repeat(${Math.max(rows, 2)}, 2.4rem)`,
				}}
			>
				{cells.map(({ place: p, row, col }, i) => {
					const near = p.near ?? 0.5
					return (
						<Link
							key={p.place.slug}
							to={p.to}
							prefetch="intent"
							aria-current={p.here ? "page" : undefined}
							onMouseEnter={(e) => onHot(p, e.currentTarget)}
							onMouseLeave={() => onHot(null, null)}
							onFocus={(e) => onHot(p, e.currentTarget)}
							onBlur={() => onHot(null, null)}
							style={{
								gridRow: row + 1,
								gridColumn: col + 1,
								color: p.here ? undefined : `rgba(255,255,255,${0.42 + near * 0.58})`,
							}}
							className={`group/cell relative flex min-w-0 items-center rounded-full text-[12px] font-bold sm:text-[13px] ${FOCUS} ${p.here ? "!text-gray-950" : "hover:!text-white"}`}
						>
							<motion.span
								layoutId={grown ? dotId(p.place.slug) : undefined}
								transition={GLIDE}
								aria-hidden
								className={`absolute inset-0 transition-[background-color,box-shadow] duration-200 ${
									p.here
										? "bg-white shadow-[0_0_0_4px_rgba(255,255,255,.12)]"
										: "bg-white/[0.05] ring-1 ring-white/10 group-hover/cell:bg-white/[0.14] group-hover/cell:ring-white/30"
								}`}
								style={{ borderRadius: 999 }}
							/>
							<motion.span
								initial={grown && !reduce ? { opacity: 0 } : false}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.24, delay: grown ? 0.2 + i * 0.012 : 0 }}
								className="relative flex min-w-0 items-center gap-1.5 px-2.5"
							>
								<PlaceMark place={p.place} size={13} />
								{/* A long name takes two short lines on a phone, never an ellipsis. */}
								<span className="leading-[1.08] max-sm:line-clamp-2 sm:truncate sm:leading-none">
									{p.place.label}
								</span>
							</motion.span>
						</Link>
					)
				})}
			</div>
		</div>
	)
}

/**
 * The lattice in full. Every cell is a link; pointing at one shows its posters and the word that sets it apart. With
 * `grown` the cells arrive from the glyph's dots. Three columns on a phone, four from there, `cols` from desktop
 * width.
 */
export function Lattice({
	places,
	here,
	familyNoun,
	cols = 4,
	grown = false,
	className = "",
}: {
	places: FieldPlace[]
	here: string
	familyNoun: string
	cols?: number
	grown?: boolean
	className?: string
}) {
	const [hot, setHot] = useState<{
		p: FieldPlace
		left: number
		top: number
		below: boolean
	} | null>(null)
	const [shown, setShown] = useState(false)
	// Which of the widths is on screen: only that one takes the glyph's dots.
	const [small, setSmall] = useState(false)
	useEffect(() => {
		const q = window.matchMedia("(max-width: 639px)")
		const read = () => setSmall(q.matches)
		read()
		q.addEventListener("change", read)
		return () => q.removeEventListener("change", read)
	}, [])
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const onHot: OnHot = (p, el) => {
		clearTimeout(timer.current)
		if (!p || !el || p.here || !p.titles.length) {
			timer.current = setTimeout(() => setShown(false), 60)
			return
		}
		const r = el.getBoundingClientRect()
		const left = Math.min(
			Math.max(8, r.left + r.width / 2 - CARD_W / 2),
			window.innerWidth - CARD_W - 8,
		)
		const below = r.top < 300
		setHot({ p, left, top: below ? r.bottom + 10 : r.top - 10, below })
		setShown(true)
	}
	useEffect(() => {
		if (!shown) return
		const away = () => setShown(false)
		window.addEventListener("scroll", away, { passive: true, capture: true })
		return () => window.removeEventListener("scroll", away, { capture: true })
	}, [shown])

	return (
		<div className={className}>
			<p className={CAPTION}>
				Where {here} sits among the {familyNoun}
			</p>
			<Cells
				places={places}
				cols={3}
				grown={grown && small}
				onHot={onHot}
				className="mt-3 sm:hidden"
			/>
			<Cells
				places={places}
				cols={4}
				grown={grown && !small}
				onHot={onHot}
				className={`mt-3 max-sm:hidden ${cols === 4 ? "" : "lg:hidden"}`}
			/>
			{cols !== 4 && (
				<Cells
					places={places}
					cols={cols}
					grown={false}
					onHot={onHot}
					className="mt-3 max-lg:hidden"
				/>
			)}
			{hot && (
				<div
					aria-hidden
					className={`pointer-events-none fixed z-50 rounded-xl bg-gray-900 p-3 shadow-2xl shadow-black/60 ring-1 ring-white/15 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
						shown ? "opacity-100" : "opacity-0"
					}`}
					style={{
						width: CARD_W,
						left: hot.left,
						top: hot.top,
						transform: `translateY(${hot.below ? (shown ? "0" : "-4px") : shown ? "-100%" : "calc(-100% + 4px)"})`,
					}}
				>
					<p className="flex items-center gap-1.5 text-sm font-bold text-white">
						<PlaceMark place={hot.p.place} size={13} />
						{hot.p.place.label}
						{hot.p.differs && <span className="font-medium text-gray-400">· {hot.p.differs}</span>}
					</p>
					{hot.p.line && (
						<p className="mt-1 text-[13px] leading-snug text-gray-300">{hot.p.line}</p>
					)}
					<PosterTrio titles={hot.p.titles} className="mt-2.5" />
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What sets it apart, as one strip: the word is the message, the steps say how strongly, the value waits behind the
// word.

/** A trait as a feel word: "situationally funny" is just "Funny" (its card says the rest). */
const feel = (t: Trait) => cap(t.word === "situationally funny" ? "funny" : t.word)

function Steps({ t }: { t: Trait }) {
	const steps = Math.max(0, Math.min(5, Math.round(t.value / 2)))
	const usual = Math.max(0, Math.min(5, t.base / 2))
	return (
		<span className="relative flex shrink-0 gap-[2px]" aria-label={`${steps} of 5`}>
			{[1, 2, 3, 4, 5].map((n) => (
				<span
					key={n}
					className="h-3 w-[11px] rounded-[2px]"
					style={{ background: n <= steps ? t.color : "rgba(255,255,255,0.1)" }}
				/>
			))}
			<span
				aria-hidden
				title="What's usual"
				className="absolute -bottom-[5px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/60"
				style={{ left: `${(usual / 5) * 100}%` }}
			/>
		</span>
	)
}

export function MeterStrip({
	more,
	less,
	noun,
	className = "",
}: {
	more: Trait[]
	less: Trait[]
	noun: string
	className?: string
}) {
	if (!more.length) return null
	const item = (t: Trait) => (
		<span key={t.key} className="flex items-center gap-2 text-[15px] font-semibold">
			<TraitWord trait={t} noun={noun}>
				{feel(t)}
			</TraitWord>
			<Steps t={t} />
		</span>
	)
	const group = "flex flex-wrap items-center gap-x-6 gap-y-2.5"
	return (
		<div className={`flex flex-wrap items-center gap-x-10 gap-y-2.5 ${className}`}>
			<div className={group}>
				<span className={CAPTION}>What sets it apart</span>
				{more.map(item)}
			</div>
			{less.length > 0 && (
				<div className={group}>
					<span className={CAPTION}>Rarely</span>
					{less.map(item)}
				</div>
			)}
		</div>
	)
}

/** Three feel words in their colors: "Heartwarming · Hopeful · Funny". */
export function FeelWords({
	traits,
	noun,
	className = "",
}: {
	traits: Trait[]
	noun: string
	className?: string
}) {
	if (!traits.length) return null
	return (
		<p className={`flex flex-wrap items-center gap-x-2 text-sm font-semibold ${className}`}>
			{traits.slice(0, 3).map((t, i) => (
				<span key={t.key} className="flex items-center gap-2">
					{i > 0 && (
						<span aria-hidden className="text-gray-600">
							·
						</span>
					)}
					<TraitWord trait={t} noun={noun}>
						{feel(t)}
					</TraitWord>
				</span>
			))}
		</p>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The ways onward of the head: what it pairs with, what is closest, the one to start with.

export function onwardItems(data: PlaceDisplayData, address: Props["address"], to: Props["to"]) {
	const { room } = data
	const kind = address.kind
	const items: { label: string; value: string; sub?: string; to: string; hue?: string }[] = []
	const [pair] = room.goesWith
	if (pair)
		items.push({
			label: "Pairs well with",
			value: pair.place.label,
			hue: pair.place.hue,
			sub: `${pair.name}.`,
			to: to(place(kind, [...address.parts, { family: pair.place.family, slug: pair.place.slug }])),
		})
	const [near] = room.neighbors
	if (near)
		items.push({
			label: "Close to it",
			value: near.place.label,
			hue: near.place.hue,
			sub: `${cap(near.differs)}.`,
			to: to(place(kind, [{ family: near.place.family, slug: near.place.slug }])),
		})
	if (room.bestOne)
		items.push({
			label: "The one to start with",
			value: room.bestOne.card.title,
			sub: `${room.bestOne.card.release_year ?? ""} · the best-loved of them all.`,
			to: room.bestOne.to,
		})
	return items
}

export function crumbsOf(data: PlaceDisplayData, address: Props["address"], to: Props["to"]) {
	const lead = data.room.parts[0]
	const family = lead.family === "theme" || lead.family === "style" ? "genre" : lead.family
	const top = { label: kindLabel(address.kind), to: to(hub(address.kind)) }
	if (data.room.parts.length > 1) return [top, { label: data.room.title }]
	return [
		top,
		{
			label:
				lead.family === "mood" || lead.family === "genre" ? FAMILY[lead.family].many : "Genres",
			to: to(familyPage(address.kind, family, address.country)),
		},
		{ label: lead.label },
	]
}

/** A blend's own line: what only the blend has, as words ("more war-focused and political than either alone"). */
export function Together({ traits, noun, many }: { traits: Trait[]; noun: string; many: boolean }) {
	if (!traits.length) return null
	return (
		<p className="text-[15px] leading-snug text-gray-200">
			Together they come out{" "}
			{traits.map((t, i) => (
				<span key={t.key}>
					{i > 0 && (i === traits.length - 1 ? " and " : ", ")}
					{t.dir === "less" ? "less " : "more "}
					<TraitWord trait={t} noun={noun} />
				</span>
			))}{" "}
			than {many ? "any of them" : "either"} alone.
		</p>
	)
}

/** One click back to each part on its own, and the best of the blend. */
function BlendWays({ data, address, to }: Pick<Props, "data" | "address" | "to">) {
	const { room, title } = data
	const said = inSentence(phrase(address.kind, room.parts))
	return (
		<div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-gray-400">
			<span>Each on its own:</span>
			{room.parts.map((p) => (
				<Link
					key={`${p.family}-${p.slug}`}
					to={to(place(address.kind, [p], address.country))}
					prefetch="intent"
					className={`flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 font-semibold text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-white ${FOCUS}`}
				>
					<PlaceMark place={p} size={13} />
					{cap(phraseText(phrase(address.kind, [p])))}
				</Link>
			))}
			{title.hasBest && (
				<Link
					to={to(topAddress(address.kind, address.parts))}
					prefetch="intent"
					className={`group ml-2 inline-flex items-center gap-1.5 rounded-sm font-semibold text-gray-200 hover:text-white ${FOCUS}`}
				>
					<CheckBadgeIcon aria-hidden className="h-4.5 w-4.5 text-amber-400" />
					<span className="underline decoration-white/25 underline-offset-4 group-hover:decoration-white/70">
						Only the best {said}, ranked
					</span>
				</Link>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// About this selection: every part in one line, then how they combine.

const FAMILY_ORDER = [
	"mood",
	"genre",
	"theme",
	"style",
	"trait",
	"trope",
	"decade",
	"country",
	"service",
]

function SelectionAbout({ data, address }: Pick<Props, "data" | "address" | "to">) {
	const { about, title } = data
	const noun = kindNoun(address.kind)
	const parts = [...about.parts].sort(
		(a, b) => FAMILY_ORDER.indexOf(a.place.family) - FAMILY_ORDER.indexOf(b.place.family),
	)
	const n = parts.length
	return (
		<section aria-label="About this selection">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 className="text-[11px] font-bold tracking-[0.12em] text-gray-500 uppercase">
					{n === 2 ? "Two parts" : n === 3 ? "Three parts" : `${n} parts`}, one list
				</h2>
				<p className="text-sm text-gray-400">
					{about.count > 0
						? `About ${compactCount(about.count)} well-known ${noun} have all of them.`
						: `No well-known ${noun} have all of them yet.`}
				</p>
			</div>
			<ol
				className={`mt-4 grid gap-3 ${n >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : n === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
			>
				{parts.map((p) => (
					<li
						key={`${p.place.family}-${p.place.slug}`}
						className="relative flex min-w-0 flex-col rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]"
					>
						<span
							aria-hidden
							className="absolute top-4 bottom-4 left-0 w-[3px] rounded-full"
							style={{ background: p.place.hue ?? "rgba(255,255,255,.35)" }}
						/>
						<span className="text-[10.5px] font-bold tracking-[0.12em] text-gray-500 uppercase">
							{p.family}
						</span>
						<span className="mt-1 flex items-center gap-2 text-[17px] leading-tight font-bold text-white">
							<PlaceMark place={p.place} size={15} />
							<span className="truncate">{p.place.label}</span>
						</span>
						{p.line && <span className="mt-1.5 text-sm leading-snug text-gray-300">{p.line}</span>}
						<Link
							to={p.to}
							prefetch="intent"
							className={`mt-auto inline-flex items-center gap-1 self-start rounded-sm pt-3 text-sm font-semibold text-gray-300 hover:text-white ${FOCUS}`}
						>
							{p.place.family === "trope"
								? "The trope's page"
								: `${cap(asWord(p.place))} on its own`}
							<span aria-hidden>›</span>
						</Link>
					</li>
				))}
			</ol>
			{title.together.length > 0 && (
				<div className="mt-4">
					<Together traits={title.together} noun={noun} many={n > 2} />
				</div>
			)}
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The band

export function PlaceHead({
	data,
	address,
	to,
	state,
	onState,
	aboutTo,
}: Pick<Props, "data" | "address" | "to"> & {
	state: HeadState
	/** Folds and unfolds. Without it the band doesn't unfold (the Tabs layout: About is its own tab). */
	onState?: (next: HeadState) => void
	/** Where "About cozy" leads when the band doesn't unfold. */
	aboutTo?: string
}) {
	const reduce = useReducedMotion()
	const { room, dz, title } = data
	const lead = room.parts[0]
	const isBlend = room.parts.length > 1
	const noun = kindNoun(address.kind)
	const hues = room.parts.map((p) => p.hue).filter((h): h is string => Boolean(h))
	const hue = room.parts.find((p) => p.family === "mood")?.hue ?? hues[0]
	const field = dz.field && dz.field.length > 1 ? dz.field : null
	const open = state === "open" && !!onState
	const word = asWord(lead)
	const lede = room.copy?.lede
	const onward = onwardItems(data, address, to)
	const toggle = () => onState?.(open ? "folded" : "open")

	// the control is about the whole selection. Its glyph is always the 16 moods (the selection's own lit, the
	// rest by how much the selection leans to them), whatever the page's family.
	const aboutWord = isBlend ? "About this selection" : `About ${word}`
	const aboutLabel = (
		<>
			{!open && <LatticeGlyph places={data.about.moods} />}
			<span className="whitespace-nowrap">{open ? "Fold away" : aboutWord}</span>
			<ChevronDownIcon
				aria-hidden
				className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""} ${onState ? "" : "-rotate-90"}`}
			/>
		</>
	)
	const aboutClass = `flex h-11 max-lg:order-3 lg:ml-auto shrink-0 items-center gap-3 rounded-full bg-white/[0.05] pr-3 pl-4 text-sm font-bold text-gray-100 ring-1 ring-white/10 transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.1] hover:ring-white/25 ${FOCUS}`

	return (
		<header className="relative isolate">
			{hue && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
					style={{
						background: [
							`radial-gradient(120% 140% at 12% 0%, color-mix(in oklab, ${hue} 24%, transparent) 0%, transparent 60%)`,
							hues.find((h) => h !== hue)
								? `radial-gradient(80% 120% at 70% 0%, color-mix(in oklab, ${hues.find((h) => h !== hue)} 16%, transparent) 0%, transparent 60%)`
								: "",
						]
							.filter(Boolean)
							.join(", "),
					}}
				/>
			)}
			<div className={`${WRAP} relative pt-5 pb-5 sm:pt-6 sm:pb-6`}>
				<div className="flex flex-wrap items-center gap-x-8 gap-y-3 lg:flex-nowrap">
					{/* The title is the blend: each part underlined in its color (click to swap or take out), Add for one
					more. A single mood reads the same way, so every page can grow into a blend from its title. */}
					<div data-head-title="" className="min-w-0 max-lg:basis-full lg:max-w-[62%]">
						<DragProvider>
							<BlendBar
								kind={address.kind}
								address={address}
								parts={room.parts}
								shorts={title.shorts}
								swaps={title.swaps}
								pantry={title.pantry}
								to={to}
							/>
						</DragProvider>
					</div>
					<AnimatePresence initial={false}>
						{!open && (
							<motion.div
								key="gist"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.16 } }}
								exit={{ opacity: 0, transition: { duration: 0.1 } }}
								className="min-w-0 flex-1 max-lg:order-2 max-lg:basis-full"
							>
								{state === "folded" && !isBlend && room.copy?.short && (
									<p className="text-[15px] leading-snug text-gray-200 lg:line-clamp-2">
										{room.copy.short}
									</p>
								)}
								{/* A blend's "together they come out more …" lives at the foot of the steering column,
								where a blend has room to spare; the head keeps its pitch only. */}
								{isBlend && title.pitch && (
									<p className="text-[15px] leading-snug text-gray-200 lg:line-clamp-2">
										{title.pitch}
									</p>
								)}
								{isBlend && !title.pitch && (
									<div className="lg:hidden">
										<Together traits={title.together} noun={noun} many={room.parts.length > 2} />
									</div>
								)}
								{!isBlend && <FeelWords traits={room.more} noun={noun} className="mt-1" />}
							</motion.div>
						)}
					</AnimatePresence>
					{onState ? (
						<motion.button
							layout={reduce ? false : "position"}
							transition={GLIDE}
							type="button"
							onClick={toggle}
							aria-expanded={open}
							aria-controls="mood-room"
							className={`group/about ${aboutClass}`}
						>
							{aboutLabel}
						</motion.button>
					) : aboutTo ? (
						<Link to={aboutTo} prefetch="intent" preventScrollReset className={aboutClass}>
							{aboutLabel}
						</Link>
					) : null}
				</div>

				{isBlend && <BlendWays data={data} address={address} to={to} />}

				{state === "peek" && lede && (
					<p className="mt-4 line-clamp-3 max-w-3xl text-[17px] leading-relaxed text-pretty text-gray-200">
						{lede}
					</p>
				)}

				<AnimatePresence initial={false} mode="popLayout">
					{open && (
						<motion.div
							key="room"
							id="mood-room"
							initial={reduce ? false : { opacity: 0, y: -10 }}
							animate={{
								opacity: 1,
								y: 0,
								transition: { duration: 0.36, delay: 0.14, ease: EASE },
							}}
							exit={{ opacity: 0, transition: { duration: 0.12 } }}
							className="w-full pt-5"
						>
							{isBlend && <SelectionAbout data={data} address={address} to={to} />}
							<div
								className={`grid items-start gap-x-12 gap-y-7 ${field ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,37rem)]" : ""} ${isBlend ? "mt-6" : ""}`}
							>
								<div className="min-w-0">
									{lede && (
										<p className="max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
											{lede}
										</p>
									)}
									<div className="[&>ul]:mt-5">
										<Onward items={onward} />
									</div>
								</div>
								{field && (
									<Lattice
										places={field}
										here={lead.label}
										familyNoun={FAMILY[lead.family].many.toLowerCase()}
										grown
									/>
								)}
							</div>
							<MeterStrip
								more={room.more}
								less={room.less}
								noun={noun}
								className="mt-6 border-t border-white/10 pt-4"
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</header>
	)
}
