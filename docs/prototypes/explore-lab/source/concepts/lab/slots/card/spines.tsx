// PROTOTYPE - throwaway (prototype/explore-r5). Card variant "Spines": a family stands as a row of spines and one of
// them is open. Pointing at, focusing or dragging across a spine opens it; the open one shows the place in full, with
// its posters and two ways onward. Below `lg` the row becomes a stack with one open.
//
// It is a strip, not a cell. `<Spines cards={...} />` is the strip itself. A page that renders the picked card once
// per cell still gets it: three or more spine cards in one container (as its children, or one inside each of its
// children) turn that container into the strip. That is CSS `:has`, so the server's HTML already is the strip. A page
// that needs its own cells (a lattice, a ranked grid) says so with data-cards="cells" on the container; there, and
// anywhere a spine card stands alone, it is the open card. A row that reads right to left (the decades: newest first
// in the document, earliest on the left) says data-cards="reverse", and the strip stands that way too.
//
// Motion is transform, opacity and clip only: the spines glide to their new places while the opening one is unveiled.
import { Link } from "@remix-run/react"
import type { KeyboardEvent, PointerEvent } from "react"
import type { ShowTitle } from "../../../../kit/types"
import { poster } from "../../../../kit/ui"
import type { SlotVariant } from "../../contract"
import {
	type CardViewProps,
	GoodAt,
	IDENTITY_NOTES,
	NameLink,
	ROOT,
	Small,
	Words,
	resolve,
} from "./frame"
import {
	GenreColumn,
	GenreForm,
	GenreGlyph,
	Logo,
	MoodLight,
	Numerals,
	Outline,
	PictureStyles,
	StyleFrame,
	ThemeTab,
	TimeLine,
} from "./pictures"

// The hosts. A page keeps its own cells by putting data-cards="cells" on the container.
// A: an explicit strip, or a parent of three or more spine cards. Its items are the cards themselves.
// B: a list whose items each wrap one spine card (a rail's <li>, a FlipItem). Its items are the wrappers.
const KEEP = ':not([data-cards="cells"])'
const A = `:is([data-spines],:has(>[data-spine]~[data-spine]~[data-spine])${KEEP})`
const B = `:has(>:nth-child(3)>[data-spine]:only-child)${KEEP}`
const A_OPEN = [
	`${A}>[data-spine][data-open]`,
	`${A}:not(:has(>[data-open]))>[data-spine]:nth-child(1 of [data-spine])`,
]
const A_SHUT = [
	`${A}:has(>[data-open])>[data-spine]:not([data-open])`,
	`${A}:not(:has(>[data-open]))>[data-spine]:not(:nth-child(1 of [data-spine]))`,
]
const B_OPEN = [
	`${B}>:has(>[data-spine][data-open])`,
	`${B}:not(:has(>*>[data-open]))>:first-child:has(>[data-spine])`,
]
const B_SHUT = [
	`${B}:has(>*>[data-open])>:has(>[data-spine]:not([data-open]))`,
	`${B}:not(:has(>*>[data-open]))>:not(:first-child):has(>[data-spine])`,
]
const sel = (list: string[], tail = "") => list.map((s) => `${s}${tail}`).join(",")
const HOSTS = sel([A, B])
const OPEN = sel([...A_OPEN, ...B_OPEN])
const SHUT = sel([...A_SHUT, ...B_SHUT])
// The spine cards that are shut (in B they sit inside their item).
const SHUT_CARDS = [...A_SHUT, ...B_SHUT.map((s) => `${s}>[data-spine]`)]

const CSS = `
[data-spine]>.sp-face{display:none}
${HOSTS}{display:flex!important;flex-direction:column;gap:6px!important;overflow:visible!important;margin-inline:0!important;padding-inline:0!important;scroll-snap-type:none!important}
${A}>[data-spine],${B}>:has(>[data-spine]){width:auto!important;min-width:0;height:auto}
${B}>*>[data-spine]{height:100%}
${sel(SHUT_CARDS, ">.sp-body")}{display:none}
${sel(SHUT_CARDS, ">.sp-face")}{display:flex}
${SHUT}{flex:none;height:3.25rem;cursor:pointer}
${OPEN}{flex:none}
@media (min-width:1024px){
${HOSTS}{flex-direction:row;flex-wrap:nowrap;height:19rem;touch-action:pan-y}
${sel([A, B], '[data-cards="reverse"]')}{flex-direction:row-reverse}
${SHUT}{flex:1 1 0;height:auto;min-width:1.75rem}
${OPEN}{flex:2.4 1 22rem;max-width:34rem}
}
`

const isSpine = (el: Element | null | undefined): el is HTMLElement =>
	Boolean(el?.hasAttribute("data-spine"))
const keeps = (host: Element) => host.getAttribute("data-cards") === "cells"

/** The strip a spine card stands in (the same test as the stylesheet's), or null when it is a card on its own. */
function stripOf(el: HTMLElement): { items: HTMLElement[]; cards: HTMLElement[] } | null {
	const parent = el.parentElement
	if (!parent) return null
	const direct = Array.from(parent.children).filter(isSpine)
	if (parent.hasAttribute("data-spines") || (direct.length >= 3 && !keeps(parent)))
		return { items: direct, cards: direct }
	const host = parent.parentElement
	const wraps = (item: Element | undefined) =>
		Boolean(item && item.children.length === 1 && isSpine(item.firstElementChild))
	if (!host || keeps(host) || !wraps(parent) || !wraps(host.children[2])) return null
	const items = (Array.from(host.children) as HTMLElement[]).filter(wraps)
	return { items, cards: items.map((item) => item.firstElementChild as HTMLElement) }
}
const openOf = (cards: HTMLElement[]) => cards.find((s) => s.hasAttribute("data-open")) ?? cards[0]

/** Opens one spine of a strip: every spine glides to its new place while the opening one is unveiled. */
function open(el: HTMLElement) {
	const strip = stripOf(el)
	if (!strip) return
	const { items, cards } = strip
	const was = openOf(cards)
	if (was === el) {
		if (!el.hasAttribute("data-open")) el.setAttribute("data-open", "")
		return
	}
	const first = items.map((s) => s.getBoundingClientRect())
	for (const s of cards) s.toggleAttribute("data-open", s === el)
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
	const timing: KeyframeAnimationOptions = {
		duration: 340,
		easing: "cubic-bezier(0.22, 1, 0.36, 1)",
	}
	items.forEach((item, i) => {
		const card = cards[i]
		for (const a of item.getAnimations()) a.cancel()
		const last = item.getBoundingClientRect()
		const dx = first[i].left - last.left
		const dy = first[i].top - last.top
		const frames: Keyframe[] = [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }]
		if (card === el) {
			// Unveil: from the spine it was to the card it is.
			const right = Math.max(0, last.width - first[i].width)
			const bottom = Math.max(0, last.height - first[i].height)
			frames[0].clipPath = `inset(0 ${right}px ${bottom}px 0 round 16px)`
			frames[1].clipPath = "inset(0 0 0 0 round 16px)"
			card.querySelector(".sp-body")?.animate([{ opacity: 0 }, { opacity: 1 }], {
				...timing,
				duration: 420,
			})
		} else if (card === was) {
			card.querySelector(".sp-face")?.animate([{ opacity: 0 }, { opacity: 1 }], timing)
		}
		if (dx || dy || card === el) item.animate(frames, timing)
	})
}

let intent: ReturnType<typeof setTimeout> | undefined

const handlers = {
	onPointerEnter: (e: PointerEvent<HTMLElement>) => {
		if (e.pointerType !== "mouse") return
		const el = e.currentTarget
		clearTimeout(intent)
		// A short wait, so sweeping across the row doesn't open every spine on the way.
		intent = setTimeout(() => open(el), 70)
	},
	onPointerLeave: () => clearTimeout(intent),
	// Dragging a finger or pen along the row opens the spine under it.
	onPointerMove: (e: PointerEvent<HTMLElement>) => {
		if (e.pointerType === "mouse" || !e.buttons) return
		const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-spine]")
		if (isSpine(under) && stripOf(e.currentTarget)?.cards.includes(under)) open(under)
	},
	// Tabbing onto a shut spine opens it and hands the focus to the open card's link.
	onFocus: (e: React.FocusEvent<HTMLElement>) => {
		const el = e.currentTarget
		if (!stripOf(el)) return
		open(el)
		if ((e.target as HTMLElement).classList.contains("sp-face"))
			el.querySelector<HTMLElement>(".sp-body a")?.focus({ preventScroll: true })
	},
	// A tap on a shut spine opens it; the open one is the link.
	onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
		const el = e.currentTarget
		const strip = stripOf(el)
		if (!strip || openOf(strip.cards) === el) return
		e.preventDefault()
		e.stopPropagation()
		open(el)
	},
	onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
		const step =
			e.key === "ArrowRight" || e.key === "ArrowDown"
				? 1
				: e.key === "ArrowLeft" || e.key === "ArrowUp"
					? -1
					: 0
		const strip = step ? stripOf(e.currentTarget) : null
		const next = strip?.cards[strip.cards.indexOf(e.currentTarget) + step]
		if (!next) return
		e.preventDefault()
		open(next)
		// The opened card's own link takes the focus.
		next.querySelector<HTMLElement>(".sp-body a")?.focus({ preventScroll: true })
	},
}

/** Where the Best list of a place lives, from the place's own address. */
function bestOf(href: string, family: string, slug: string) {
	const m = /^(\/prototype\/explore\/[^/]+\/[^/?#]+)/.exec(href)
	return m ? `${m[1]}/best?with=${family}:${slug}` : null
}

function Posters({ titles, big = false }: { titles: ShowTitle[]; big?: boolean }) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, big ? 5 : 4)
	if (!shown.length) return null
	return (
		<span aria-hidden className={`flex ${big ? "gap-1.5 @2xl:gap-2.5" : "gap-1.5"}`}>
			{shown.map((t, i) => (
				<img
					key={t.card.key}
					src={poster(t.card.poster_path, "w154")}
					alt=""
					loading="lazy"
					decoding="async"
					className={`aspect-[2/3] rounded-md bg-gray-800 object-cover shadow-md shadow-black/40 ring-1 ring-white/10 ${big ? "w-11 @md:w-[3.75rem] @2xl:w-[5.25rem] @2xl:rounded-lg" : "w-11 @md:w-[3.75rem]"} ${i === 3 ? "hidden @sm:block" : ""} ${i === 4 ? "hidden @2xl:block" : ""}`}
				/>
			))}
		</span>
	)
}

/** One spine card: the spine (shut, in a strip) and the full card (open, or on its own). */
export function SpineCard(props: CardViewProps) {
	const { place, href, titles } = props
	const r = resolve(props)
	const family = place.family
	const hue = place.hue ?? "#94a3b8"
	const decade = family === "decade"
	const best = bestOf(href, family, place.slug)
	const ground = (
		<>
			{(family === "theme" || family === "trait") && <ThemeTab hue={hue} />}
			{family === "style" && <StyleFrame hue={hue} />}
		</>
	)
	const lit = r.words.map((w) => w.key)
	// The mark of a row in the stack (below `lg`).
	const mark =
		family === "genre" && r.deltas && r.marks ? (
			<GenreGlyph deltas={r.deltas} bars={r.marks.bars} size={26} />
		) : family === "country" && place.code ? (
			<Outline place={place} px={30} />
		) : family === "service" ? (
			<Logo place={place} px={30} glow={false} />
		) : null
	// What a standing spine carries at its foot (from `lg`): the place's picture, as large as the spine allows.
	const foot =
		family === "genre" && r.deltas && r.marks ? (
			<>
				<GenreColumn
					deltas={r.deltas}
					bars={r.marks.bars}
					lit={lit}
					className="h-36 @[7rem]:hidden"
				/>
				<span className="hidden w-full @[7rem]:block">
					<GenreForm deltas={r.deltas} bars={r.marks.bars} lit={lit} height={72} />
				</span>
			</>
		) : family === "country" && place.code ? (
			<>
				<span className="@[3.25rem]:hidden">
					<Outline place={place} px={24} />
				</span>
				<span className="hidden @[3.25rem]:block @[7rem]:hidden">
					<Outline place={place} px={40} />
				</span>
				<span className="hidden @[7rem]:block">
					<Outline place={place} px={96} />
				</span>
			</>
		) : family === "service" ? (
			<>
				<span className="@[7rem]:hidden">
					<Logo place={place} px={28} />
				</span>
				<span className="hidden @[7rem]:block">
					<Logo place={place} px={56} />
				</span>
			</>
		) : decade && r.marks ? (
			<TimeLine slug={place.slug} decades={r.marks.decades} className="scale-90" />
		) : null
	if (props.size === "s") return <Small {...props} />
	// A lead card (in a page's own cell): a larger name, the place's own paragraph, a larger row of posters.
	const big = props.size === "l"
	return (
		<div data-spine="" data-card={family} className={`${ROOT} flex-col`} {...handlers}>
			{/* oxlint-disable-next-line react/no-danger -- a constant stylesheet; as text React would escape its ">" */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<PictureStyles />

			{/* The spine: a row in the stack; standing in the strip, its name down the spine and its picture at the foot. */}
			<Link
				to={href}
				prefetch="intent"
				aria-label={place.label}
				className="sp-face relative h-full w-full items-center gap-3 px-3.5 outline-none lg:flex-col lg:gap-3 lg:px-2 lg:py-4 lg:@[7rem]:items-start lg:@[7rem]:p-4"
			>
				{family === "mood" && (
					<>
						<span className="lg:hidden">
							<MoodLight hue={hue} at={r.mood} corner="l" />
						</span>
						<span className="max-lg:hidden">
							<MoodLight hue={hue} at={r.mood} corner="b" strength={0.9} />
						</span>
						<span aria-hidden className="w-7 shrink-0 lg:hidden" />
					</>
				)}
				{ground}
				{mark && (
					<span className="relative grid w-10 shrink-0 place-items-center lg:hidden">{mark}</span>
				)}
				{decade ? (
					<span className="relative font-display text-xl font-black tracking-tight text-white lg:text-2xl lg:[writing-mode:vertical-rl] lg:@[7rem]:text-4xl lg:@[7rem]:[writing-mode:horizontal-tb]">
						{place.label}
					</span>
				) : (
					<span className="relative min-w-0 font-display text-base font-bold tracking-tight whitespace-nowrap text-white [text-shadow:0_1px_10px_rgba(10,14,24,0.6)] lg:text-[15px] lg:[writing-mode:vertical-rl] lg:@[7rem]:text-xl lg:@[7rem]:[writing-mode:horizontal-tb]">
						{place.label}
					</span>
				)}
				<Words
					words={r.words.slice(0, 2)}
					hue={family === "mood" ? hue : undefined}
					className="relative min-h-0 min-w-0 truncate !text-xs max-lg:ml-auto lg:[writing-mode:vertical-rl] lg:@[7rem]:[writing-mode:horizontal-tb] lg:@[7rem]:whitespace-normal"
				/>
				{foot && (
					<span className="relative mt-auto flex w-full shrink-0 justify-center max-lg:hidden lg:@[7rem]:justify-start">
						{foot}
					</span>
				)}
			</Link>

			{/* The open card. */}
			<span className="sp-body relative flex h-full min-h-0 flex-1 flex-col">
				{family === "mood" && <MoodLight hue={hue} at={r.mood} />}
				{ground}
				<span className="relative flex min-h-0 flex-1 flex-col p-5">
					{family === "genre" && r.deltas && r.marks ? (
						<span className="block">
							<GenreForm
								deltas={r.deltas}
								bars={r.marks.bars}
								lit={r.words.map((w) => w.key)}
								height={48}
							/>
							<Words words={r.words} className="mt-1.5" />
						</span>
					) : family === "country" && place.code ? (
						<Outline place={place} px={72} />
					) : family === "service" ? (
						<Logo place={place} px={48} />
					) : decade ? null : (
						<span aria-hidden className={family === "mood" ? "block h-12" : "block h-3"} />
					)}
					{decade ? (
						<span className="flex items-start justify-between gap-3">
							<NameLink href={href} label={place.label}>
								<Numerals place={place} px={76} />
							</NameLink>
							{r.marks && (
								<TimeLine slug={place.slug} decades={r.marks.decades} className="mt-1.5" />
							)}
						</span>
					) : (
						<span className="mt-3 flex items-baseline gap-2">
							<NameLink
								href={href}
								className={`font-display leading-tight font-bold tracking-tight text-white [text-shadow:0_1px_12px_rgba(10,14,24,0.55)] ${big ? "text-3xl @2xl:text-4xl" : "text-2xl"}`}
							>
								{place.label}
							</NameLink>
							<span
								aria-hidden
								className="text-xl text-white/35 transition-[transform,color] duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-amber-300"
							>
								›
							</span>
						</span>
					)}
					{big && r.lede ? (
						<span className="mt-1.5 line-clamp-4 block max-w-prose text-[15px] leading-relaxed text-gray-300">
							{r.lede}
						</span>
					) : (
						r.line && (
							<span className="mt-1 line-clamp-2 block max-w-md text-sm leading-snug text-gray-300">
								{r.line}
							</span>
						)
					)}
					{family === "service" ? (
						<GoodAt places={r.goodAt} className="mt-2" />
					) : family === "genre" ? (
						<span className="relative z-10 mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
							{r.kinds.slice(0, 4).map((k) => (
								<Link
									key={k.id}
									to={r.kindHref(k.id)}
									prefetch="intent"
									className="group/kind flex items-baseline gap-1.5 rounded-sm text-sm font-semibold text-gray-200 outline-none transition-colors duration-[160ms] hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<span
										aria-hidden
										className="text-xs text-white/30 group-hover/kind:text-amber-300"
									>
										›
									</span>
									<span className="truncate">{k.name}</span>
								</Link>
							))}
						</span>
					) : (
						<Words words={r.words} hue={family === "mood" ? hue : undefined} className="mt-2" />
					)}
					<span className="mt-auto flex items-end justify-between gap-3 pt-3">
						<Posters titles={titles} big={big} />
						{best && (
							<Link
								to={best}
								prefetch="intent"
								className="relative z-10 shrink-0 rounded-sm text-right text-[13px] font-semibold whitespace-nowrap text-amber-300 outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								The best ›
							</Link>
						)}
					</span>
				</span>
			</span>
		</div>
	)
}

/** The strip itself, for a page that wants it as one piece. */
export function Spines({
	cards,
	data,
	className = "",
}: {
	cards: CardViewProps[]
	data?: unknown
	className?: string
}) {
	return (
		<div data-spines="" className={className}>
			{cards.map((c) => (
				<SpineCard key={`${c.place.family}:${c.place.slug}`} {...c} data={c.data ?? data} />
			))}
		</div>
	)
}

export const variant: SlotVariant<never, CardViewProps> = {
	id: "spines",
	name: "Spines",
	what: "A family stands as a row of spines with one open. Point, drag or use the arrow keys to open another.",
	order: 3,
	View: SpineCard,
	notes: () => [
		{
			term: "Spine",
			means:
				"A place standing shut: its name down the spine and its picture at the foot (a mood's light, a genre's form, a country's outline). Point at it, tab to it, or drag across the row to open it.",
			isNew: true,
		},
		{
			term: "Open card",
			means:
				"The one place in focus: its line, its words, a few of its titles, and two ways onward (the place itself, and the best of it).",
		},
		...IDENTITY_NOTES,
	],
}
