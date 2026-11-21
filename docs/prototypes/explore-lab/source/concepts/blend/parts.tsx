// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). Small pieces every Blend page shares: how an
// ingredient is marked, a blend's name with its ingredients underlined, the two card kinds (a blend, and "add this"),
// and the drag state between a card and the headline.
import { Link } from "@remix-run/react"
import { PlusIcon } from "@heroicons/react/20/solid"
import { type DragEvent, type ReactNode, createContext, useContext, useMemo, useState } from "react"
import type { Kind } from "../../kit/address"
import type { PlaceRef, ShowTitle } from "../../kit/types"
import { PlaceMark, PosterTrio, wash } from "../../kit/ui"
import { type Seg, phrase } from "./phrase"

/** An ingredient's color: a mood's hue, a subject's or style's color; the other families stay neutral. */
export const NEUTRAL = "rgba(255,255,255,0.34)"
export const colorOf = (p: PlaceRef) => p.hue ?? NEUTRAL
export const BEST_COLOR = "#fbbf24"
export const idOf = (p: { family: string; slug: string }) => `${p.family}:${p.slug}`
/** A place's name as people say it ("Hong Kong", not "Hong Kong SAR China"). */
export const nice = (p: PlaceRef) => p.label.replace(/ SAR China$/, "")

/** The two hues of a blend's moods, for a card's or a page head's wash. */
export const moodHues = (parts: PlaceRef[]) =>
	parts.filter((p) => p.family === "mood" && p.hue).map((p) => p.hue as string)

/**
 * A blend's name as running text, each ingredient underlined in its color. Not interactive: for cards and headings
 * that are links as a whole.
 */
export function PhraseText({ segs, className = "" }: { segs: Seg[]; className?: string }) {
	return (
		<span className={className}>
			{segs.map((s, i) => (
				// oxlint-disable-next-line react/no-array-index-key -- a phrase's words don't reorder
				<span key={i}>
					{i > 0 && " "}
					{s.t === "text" ? (
						s.text
					) : (
						<span
							className="underline decoration-[0.09em] underline-offset-[0.16em]"
							style={{
								textDecorationColor:
									s.t === "part" ? colorOf(s.part) : s.t === "best" ? BEST_COLOR : NEUTRAL,
							}}
						>
							{s.text}
						</span>
					)}
				</span>
			))}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Dragging an ingredient onto the headline

interface Drag {
	dragged: PlaceRef | null
	set: (p: PlaceRef | null) => void
}
const DragCtx = createContext<Drag>({ dragged: null, set: () => {} })
export const DRAG_TYPE = "application/x-goodwatch-ingredient"

export function DragProvider({ children }: { children: ReactNode }) {
	const [dragged, set] = useState<PlaceRef | null>(null)
	const value = useMemo(() => ({ dragged, set }), [dragged])
	return <DragCtx.Provider value={value}>{children}</DragCtx.Provider>
}
export const useDrag = () => useContext(DragCtx)

/** Props that let a link be dragged onto the headline as an ingredient. A click still follows the link. */
export function useDragSource(place: PlaceRef) {
	const { set } = useDrag()
	return {
		draggable: true,
		onDragStart: (e: DragEvent) => {
			e.dataTransfer.setData(DRAG_TYPE, idOf(place))
			e.dataTransfer.effectAllowed = "copy"
			set(place)
		},
		onDragEnd: () => set(null),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Cards

/**
 * "Add this": one link that adds an ingredient to the current blend. It names the ingredient, says what the blend
 * becomes, and shows three posters of what you would get. Can be dragged onto the headline too.
 */
export function SuggestCard({
	kind,
	place,
	becomes,
	titles,
	to,
	className = "",
}: {
	kind: Kind
	place: PlaceRef
	/** The blend this makes, as segments. */
	becomes: Seg[]
	titles: ShowTitle[]
	to: string
	className?: string
}) {
	const drag = useDragSource(place)
	void kind
	return (
		<Link
			to={to}
			prefetch="intent"
			{...drag}
			className={`group relative flex flex-col overflow-hidden rounded-2xl bg-[#151b28] p-3.5 ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-amber-400 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
		>
			<span className="flex items-center gap-2">
				<span
					aria-hidden
					className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-gray-200 ring-1 ring-white/15 transition-[background-color,color,transform] duration-200 group-hover:rotate-90 group-hover:bg-white group-hover:text-gray-950 motion-reduce:group-hover:rotate-0"
				>
					<PlusIcon className="h-4 w-4" />
				</span>
				<PlaceMark place={place} size={15} />
				<span className="truncate text-base leading-tight font-bold text-white">{nice(place)}</span>
			</span>
			<span className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-gray-400">
				{becomes.map((s, i) => (
					// oxlint-disable-next-line react/no-array-index-key -- a phrase's words don't reorder
					<span key={i}>
						{i > 0 && " "}
						{s.t === "part" && idOf(s.part) === idOf(place) ? (
							<span className="font-semibold text-white">{s.text}</span>
						) : (
							s.text
						)}
					</span>
				))}
			</span>
			<PosterTrio titles={titles.slice(0, 3)} className="mt-2.5" />
		</Link>
	)
}

/** A whole blend as one link: its name the way a person says it, one human line, three posters. */
export function BlendCard({
	kind,
	parts,
	pitch,
	titles,
	to,
	label,
	opts,
}: {
	kind: Kind
	parts: PlaceRef[]
	pitch?: string
	titles: ShowTitle[]
	to: string
	/** A small line above the name ("Without Netflix"). */
	label?: ReactNode
	opts?: { best?: boolean; year?: number }
}) {
	const hues = moodHues(parts)
	const background = hues.length
		? `linear-gradient(165deg, ${wash(hues[0], 30)} 0%, ${wash(
				hues[1] ?? hues[0],
				hues[1] ? 22 : 9,
			)} 48%, #151b28 100%)`
		: "#151b28"
	return (
		<Link
			to={to}
			prefetch="intent"
			className="group relative flex flex-col overflow-hidden rounded-2xl p-4 ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-amber-400 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
			style={{ background }}
		>
			{label && (
				<span className="mb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
					{label}
				</span>
			)}
			<span className="flex items-start gap-2">
				<span className="font-display text-xl leading-snug font-bold tracking-tight text-balance text-white">
					<PhraseText segs={phrase(kind, parts, opts)} />
				</span>
				<span
					aria-hidden
					className="mt-0.5 ml-auto text-lg text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
				>
					›
				</span>
			</span>
			{pitch && <span className="mt-1 block text-sm leading-snug text-gray-300">{pitch}</span>}
			<PosterTrio titles={titles.slice(0, 3)} className="mt-auto pt-3.5" />
		</Link>
	)
}

/**
 * Blend cards as one sideways strip on a phone (each most of the screen wide, snapping) and four across from `lg`.
 */
export const BLEND_CARDS =
	"-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] *:w-[78%] *:shrink-0 *:snap-start sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:*:w-auto lg:grid-cols-4"
