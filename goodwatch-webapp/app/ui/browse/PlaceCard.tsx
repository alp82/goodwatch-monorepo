// A place as a card that is ONE link: its name, a short human line and
// three distinct posters (never tinted). A mood's card carries the mood's hue in its header; other families stay
// neutral and show their own mark. Hover lifts the card and raises the posters one after the other.
import { Link } from "@remix-run/react"
import type { CardProps, PlaceRef, ShowTitle, TraitWord } from "~/domain/browse/types"
import { wash } from "~/ui/browse/base"
import { PlaceMark } from "~/ui/browse/PlaceMark"
import { PosterTrio } from "~/ui/browse/Posters"
import { PeekCard } from "~/ui/browse/cards/PeekCard"

interface PlaceCardProps {
	place: PlaceRef
	to: string
	/** Three distinct titles (atlas.showcase keeps them distinct across the page). */
	titles: ShowTitle[]
	/** One short human line: the copy deck's `short`. */
	line?: string
	/** Up to two trait words, in their family colors, when there is no line. */
	words?: TraitWord[]
	size?: "md" | "lg"
	/** More of the place for the identity card. */
	lede?: string
	more?: Partial<CardProps>
}

/** A place card: the place's identity card with its posters peeking (PeekCard). */
export function PlaceCard(props: PlaceCardProps) {
	return (
		<PeekCard
			place={props.place}
			href={props.to}
			copy={props.line ? { short: props.line, lede: props.lede ?? "" } : null}
			titles={props.titles}
			traits={props.words ?? []}
			size={props.size === "lg" ? "l" : "m"}
			{...props.more}
		/>
	)
}

/** The plain card: a header with the place's mark, a line, and three posters. */
export function PlaceCardPlain({ place, to, titles, line, words, size = "md" }: PlaceCardProps) {
	const hue = place.family === "mood" ? place.hue : undefined
	return (
		<Link
			to={to}
			prefetch="intent"
			className="group relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 outline-none transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:ring-white/25 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-amber-400 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
			style={{
				background: hue
					? `linear-gradient(180deg, ${wash(hue, 30)} 0%, ${wash(hue, 9)} 46%, #151b28 100%)`
					: "#151b28",
			}}
		>
			<span className={`block ${size === "lg" ? "px-5 pt-5" : "px-4 pt-4"}`}>
				<span className="flex items-center gap-2">
					<PlaceMark place={place} size={size === "lg" ? 20 : 16} />
					<span
						className={`font-display font-bold tracking-tight text-white ${size === "lg" ? "text-2xl" : "text-xl"}`}
					>
						{place.label}
					</span>
					<span
						aria-hidden
						className="ml-auto translate-x-0 text-lg text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
					>
						›
					</span>
				</span>
				{line ? (
					<span className="mt-1 block text-sm leading-snug text-gray-300 sm:min-h-[2.5rem]">
						{line}
					</span>
				) : words?.length ? (
					<span className="mt-1 block text-sm leading-snug text-gray-400 sm:min-h-[2.5rem]">
						{words.slice(0, 2).map((w, i) => (
							<span key={w.key}>
								{i > 0 && " · "}
								<span className="font-semibold" style={{ color: w.color }}>
									{w.word}
								</span>
							</span>
						))}
					</span>
				) : null}
			</span>
			<PosterTrio
				titles={titles.slice(0, 3)}
				className={size === "lg" ? "mt-4 px-5 pb-5" : "mt-3 px-4 pb-4"}
			/>
		</Link>
	)
}

/**
 * A family as a grid of cards: four across on a desktop, two on a tablet, one on a phone (two across would shrink the
 * posters to stamps).
 */
export const PLACE_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
/**
 * The same cards as one sideways strip on a phone (each most of the screen wide, snapping), and the grid from `sm` up.
 * For a hub, where a family is one module among several.
 */
export const PLACE_STRIP =
	"-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] *:w-[78%] *:shrink-0 *:snap-start sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:*:w-auto lg:grid-cols-4"
