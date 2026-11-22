// The identity card: one frame for every family, whose picture is what
// the place is (pictures.tsx). The whole card is one link (the name's link is stretched over it); a genre's kinds are
// links of their own on top. Posters, when a card shows them, are support: small, cropped by the card's edge, never
// tinted, never a click target.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { CardProps, PlaceRef, ShowTitle } from "~/domain/browse/types"
import { TmdbImage } from "~/ui/TmdbImage"
import type { MarkWord, Marks } from "~/server/browse/card-marks.server"
import {
	GenreForm,
	GenreGlyph,
	Logo,
	MoodLight,
	Numerals,
	Outline,
	PictureStyles,
	type Size,
	StyleFrame,
	ThemeTab,
	TimeLine,
} from "~/ui/browse/cards/pictures"

export type CardViewProps = CardProps & { data?: unknown }

/** What a card shows, from the page's props first and every place's identity data second. */
export function resolve(props: CardViewProps) {
	const { place, href } = props
	const marks = props.data as Marks | undefined
	const id = `${place.family}:${place.slug}`
	const words: MarkWord[] = props.traits?.length
		? props.traits.slice(0, 3).map((t) => ({ key: t.key, word: t.word, color: t.color }))
		: (marks?.words[id] ?? [])
	return {
		marks,
		words,
		line: props.copy?.short || marks?.lines[id] || "",
		lede: props.copy?.lede || props.copy?.short || marks?.lines[id] || "",
		kinds: place.family === "genre" ? (props.kinds ?? marks?.kinds[place.slug] ?? []) : [],
		kindHref:
			props.kindHref ?? ((kind: string) => `${href}${href.includes("?") ? "&" : "?"}k=${kind}#all`),
		rose: props.rose ?? marks?.rose[place.slug] ?? [],
		goodAt: props.goodAt ?? marks?.goodAt[place.slug] ?? [],
		deltas: place.family === "genre" ? marks?.genres[place.slug] : undefined,
		mood: place.family === "mood" ? marks?.moods[place.slug] : undefined,
	}
}

export const ROOT =
	"group/card @container relative isolate flex h-full min-w-0 overflow-hidden rounded-2xl bg-[#141a27] ring-1 ring-white/10 transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:ring-white/25 active:scale-[0.985] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-amber-400 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"

/** The name as the card's one link, stretched over the whole card. */
export function NameLink({
	href,
	className = "",
	children,
	label,
}: {
	href: string
	className?: string
	children: ReactNode
	label?: string
}) {
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-label={label}
			className={`outline-none after:absolute after:inset-0 after:content-[''] ${className}`}
		>
			{children}
		</Link>
	)
}

export function Words({
	words,
	className = "",
	stacked = false,
	hue,
}: {
	words: MarkWord[]
	className?: string
	stacked?: boolean
	/** One color for every word (a mood's card speaks in the mood's color). */
	hue?: string
}) {
	if (!words.length) return null
	const color = (w: MarkWord) => (hue ? `color-mix(in oklab, ${hue} 62%, white)` : w.color)
	if (stacked)
		return (
			<span className={`flex flex-col gap-0.5 text-[13px] font-semibold leading-snug ${className}`}>
				{words.map((w) => (
					<span key={w.key} className="truncate" style={{ color: color(w) }}>
						{w.word}
					</span>
				))}
			</span>
		)
	return (
		<span className={`block text-[13px] font-semibold leading-snug ${className}`}>
			{words.map((w, i) => (
				<span key={w.key}>
					<span className="whitespace-nowrap" style={{ color: color(w) }}>
						{w.word}
					</span>
					{i < words.length - 1 && <span className="font-normal text-white/35">, </span>}
				</span>
			))}
		</span>
	)
}

const lower = (label: string) => (label === "TV Movie" ? "TV movies" : label.toLowerCase())

/** A service's strengths as words in the color of the mood, theme or style they are (a genre stays white). */
export function GoodAt({ places, className = "" }: { places: PlaceRef[]; className?: string }) {
	if (!places.length) return null
	return (
		<span className={`block text-[13px] leading-snug text-gray-400 ${className}`}>
			Strong on{" "}
			{places.map((p, i) => (
				<span key={`${p.family}:${p.slug}`}>
					{i > 0 && (i === places.length - 1 ? " and " : ", ")}
					<span className="font-semibold" style={{ color: p.hue ?? "#e5e7eb" }}>
						{lower(p.label)}
					</span>
				</span>
			))}
		</span>
	)
}

/** Posters held like a hand of cards behind the card's lower edge; they rise and open on hover and focus. */
export function PosterFan({
	titles,
	className = "",
	width = 56,
}: {
	titles: ShowTitle[]
	className?: string
	width?: number
}) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, 3)
	if (!shown.length) return null
	const mid = (shown.length - 1) / 2
	return (
		<span aria-hidden className={`pointer-events-none flex items-start ${className}`}>
			{shown.map((t, i) => {
				const off = i - mid
				return (
					<span
						key={t.card.key}
						className="block shrink-0 [transform:translateY(var(--ry))_rotate(var(--rr))] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover/card:[transform:translate(var(--fx),var(--fy))_rotate(var(--fr))] group-has-[a:focus-visible]/card:[transform:translate(var(--fx),var(--fy))_rotate(var(--fr))] motion-reduce:transition-none"
						style={
							{
								width,
								marginLeft: i === 0 ? 0 : -width * 0.3,
								zIndex: off === 0 ? 2 : 1,
								transitionDelay: `${i * 30}ms`,
								// At rest, and risen (on hover and focus).
								"--ry": `${Math.abs(off) * 7}px`,
								"--rr": `${off * 5}deg`,
								"--fx": `${off * 9}px`,
								"--fy": `${Math.abs(off) * 5 - 14}px`,
								"--fr": `${off * 9}deg`,
							} as React.CSSProperties
						}
					>
						<TmdbImage
							kind="poster"
							path={t.card.poster_path}
							width={width}
							alt=""
							className="block aspect-[2/3] w-full rounded-md bg-gray-800 object-cover shadow-lg shadow-black/50 ring-1 ring-white/15"
						/>
					</span>
				)
			})}
		</span>
	)
}

const Arrow = ({ className = "" }: { className?: string }) => (
	<span
		aria-hidden
		className={`text-white/35 transition-[transform,color] duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-amber-300 ${className}`}
	>
		›
	</span>
)

const SHADOW = "[text-shadow:0_1px_12px_rgba(10,14,24,0.55)]"

/** The first of a place's words that fits a narrow row whole (else the shortest). */
const shortest = (words: MarkWord[]): MarkWord[] => {
	const top = words.slice(0, 3)
	const fits = top.find((w) => w.word.length <= 13)
	return fits ? [fits] : top.sort((a, b) => a.word.length - b.word.length).slice(0, 1)
}

/**
 * A hero's posters: a real row along the card's foot, whole and upright. Only a lead card that is wide enough gets
 * it (from the `@2xl` container width); the card stays the one link.
 */
export function PosterRow({ titles, className = "" }: { titles: ShowTitle[]; className?: string }) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, 5)
	if (!shown.length) return null
	return (
		<span aria-hidden className={`pointer-events-none flex items-end gap-2.5 ${className}`}>
			{shown.map((t, i) => (
				<TmdbImage
					key={t.card.key}
					kind="poster"
					path={t.card.poster_path}
					width={96}
					alt=""
					style={{ transitionDelay: `${i * 25}ms` }}
					className="block aspect-[2/3] w-[6rem] rounded-lg bg-gray-800 object-cover shadow-lg shadow-black/50 ring-1 ring-white/15 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:-translate-y-1 group-has-[a:focus-visible]/card:-translate-y-1 motion-reduce:transition-none"
				/>
			))}
		</span>
	)
}

/** The compact row: the family's mark, the name, its words on one line. */
export function Small(props: CardViewProps) {
	const { place, href } = props
	const r = resolve(props)
	const hue = place.hue ?? "#94a3b8"
	const decade = place.family === "decade"
	return (
		<div data-card={place.family} className={`${ROOT} !h-14 items-center gap-3 px-3.5`}>
			{place.family === "mood" && <MoodLight hue={hue} at={r.mood} corner="l" />}
			{(place.family === "theme" || place.family === "trait") && <ThemeTab hue={hue} />}
			{place.family === "style" && <StyleFrame hue={hue} />}
			{place.family === "mood" && <span aria-hidden className="w-7 shrink-0" />}
			{place.family === "genre" && r.deltas && r.marks && (
				<GenreGlyph deltas={r.deltas} bars={r.marks.bars} size={34} />
			)}
			{place.family === "country" && place.code && (
				<span className="grid w-11 shrink-0 place-items-center">
					<Outline place={place} px={38} />
				</span>
			)}
			{place.family === "service" && <Logo place={place} px={36} glow={false} />}
			<span className="relative min-w-0 flex-1">
				{decade ? (
					<NameLink href={href} label={place.label} className="flex items-end gap-3">
						<Numerals place={place} px={30} />
						{r.marks && <TimeLine slug={place.slug} decades={r.marks.decades} className="mb-0.5" />}
					</NameLink>
				) : (
					<>
						<NameLink
							href={href}
							className={`block truncate font-display text-base font-bold leading-tight tracking-tight text-white ${place.family === "mood" ? SHADOW : ""}`}
						>
							{place.label}
						</NameLink>
						{/* Two words where they fit; in a narrow row the one that fits whole. */}
						<span className="hidden @[17rem]:block">
							<Words
								words={r.words.slice(0, 2)}
								hue={place.family === "mood" ? hue : undefined}
								className="mt-0.5 truncate !text-xs"
							/>
						</span>
						<span className="@[17rem]:hidden">
							<Words
								words={shortest(r.words)}
								hue={place.family === "mood" ? hue : undefined}
								className="mt-0.5 truncate !text-xs"
							/>
						</span>
					</>
				)}
			</span>
			<Arrow className="relative text-base" />
		</div>
	)
}

/**
 * The identity card at "m" and "l". `posters: "peek"` holds the place's posters behind the lower edge; "none" shows
 * no poster at all.
 */
export function IdentityCard(props: CardViewProps & { posters: "none" | "peek" }) {
	const { place, href, titles, posters } = props
	const size: Size = props.size ?? "m"
	if (size === "s") return <Small {...props} />
	const r = resolve(props)
	const big = size === "l"
	const hue = place.hue ?? "#94a3b8"
	const family = place.family
	const peek = posters === "peek" && titles.some((t) => t.card.poster_path)
	const wordHue = family === "mood" ? hue : undefined
	const pad = big ? "px-6" : "px-4"
	const name = `font-display font-bold tracking-tight text-white ${big ? "text-3xl @2xl:text-4xl" : "text-xl"} leading-tight`
	// A mood's light and a theme's or style's mark are the card's ground, not a picture beside the text: only a real
	// picture (a genre's form, a country's outline, a service's logo) takes a column of its own in a wide lead card.
	const ground = family === "mood" || family === "theme" || family === "style" || family === "trait"
	const split = big && !ground
	// In a wide lead card the posters are a real row, and the words stand beside it.
	const row = big && peek
	const wordsBeside = family !== "genre" && family !== "service"
	// A lead card with no posters is a poster of its light: the text stands at the foot, the light has the rest.
	const sink = big && ground && !peek

	// The picture, per family. A mood's light and a theme's or style's mark are the card's ground; the others stand
	// in the card's upper part.
	const picture =
		family === "genre" && r.deltas && r.marks ? (
			<span className={`block ${big ? "px-6 pt-6" : "px-4 pt-4"}`}>
				<GenreForm
					deltas={r.deltas}
					bars={r.marks.bars}
					lit={r.words.map((w) => w.key)}
					height={big ? 104 : 72}
					per={big ? 1 : 2}
				/>
				<Words words={r.words} className="mt-2" />
			</span>
		) : family === "country" && place.code ? (
			<span className={`flex items-start ${big ? "px-6 pt-6" : "px-4 pt-4"}`}>
				<Outline place={place} px={big ? 136 : 88} />
			</span>
		) : family === "service" ? (
			<span className={`block ${big ? "px-6 pt-6" : "px-4 pt-4"}`}>
				<Logo place={place} px={big ? 72 : 52} />
			</span>
		) : family === "decade" ? null : (
			// Room for the light, or for the mark's air.
			<span
				aria-hidden
				className={`block ${family === "mood" ? (big ? "h-24 @2xl:h-16" : "h-14") : big ? "h-10" : "h-5"}`}
			/>
		)

	return (
		<div data-card={family} className={`${ROOT} flex-col`}>
			<PictureStyles />
			{family === "mood" && <MoodLight hue={hue} at={r.mood} />}
			{(family === "theme" || family === "trait") && <ThemeTab hue={hue} />}
			{family === "style" && <StyleFrame hue={hue} />}
			<span
				className={`relative flex min-h-0 flex-1 flex-col ${split ? "@2xl:flex-row @2xl:items-stretch" : ""}`}
			>
				{picture && (
					<span
						className={`relative block ${split ? "shrink-0 @2xl:w-[44%]" : sink ? "min-h-0 flex-1" : "shrink-0"}`}
					>
						{picture}
					</span>
				)}
				<span
					className={`relative flex min-w-0 flex-col ${sink ? "flex-none" : "flex-1"} ${pad} ${picture ? (big ? "pt-4 @2xl:pt-6" : "pt-3") : big ? "pt-6" : "pt-4"} ${peek ? "pb-0" : big ? "pb-6" : "pb-4"}`}
				>
					{family === "decade" ? (
						<>
							<span className="flex items-start justify-between gap-3">
								<NameLink href={href} label={place.label}>
									<Numerals place={place} px={big ? 116 : 72} />
								</NameLink>
								{r.marks && (
									<TimeLine slug={place.slug} decades={r.marks.decades} className="mt-1.5" />
								)}
							</span>
							<span aria-hidden className={big ? "h-3" : "h-2"} />
						</>
					) : (
						<span className="flex items-baseline gap-2">
							<NameLink href={href} className={`${name} ${family === "mood" ? SHADOW : ""}`}>
								{place.label}
							</NameLink>
							<Arrow className={big ? "text-2xl" : "text-lg"} />
						</span>
					)}
					{(big ? r.lede : r.line) && (
						<span
							className={`mt-1 block text-gray-300 ${big ? "line-clamp-4 max-w-prose text-[15px] leading-relaxed" : "line-clamp-2 text-sm leading-snug"}`}
						>
							{big ? r.lede : r.line}
						</span>
					)}
					{family === "service" && <GoodAt places={r.goodAt} className="mt-2" />}
					{family === "decade" && big && r.rose.length > 0 && (
						<span className="mt-2 block text-[13px] leading-snug text-gray-400">
							More{" "}
							{r.rose.map((x, i) => (
								<span key={x.label}>
									{i > 0 && (i === r.rose.length - 1 ? " and " : ", ")}
									<span className="font-semibold" style={{ color: x.hue ?? "#e5e7eb" }}>
										{x.label.toLowerCase()}
									</span>
								</span>
							))}{" "}
							than the decade before.
						</span>
					)}
					{family === "genre" && r.kinds.length > 0 && (
						<span
							className={`relative z-10 mt-3 grid gap-x-4 gap-y-1 ${big ? "grid-cols-2" : "grid-cols-1 @sm:grid-cols-2"} ${peek ? "@lg:max-w-[70%]" : ""}`}
						>
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
					)}
					{/* The words: beside the posters when they peek, else a line of their own. A genre's words sit under its form. */}
					{/* In a narrow card three stacked words don't fit beside the posters: there they are a line above them. */}
					{peek && wordsBeside && !big && (
						<span className="mt-2 block @[18rem]:hidden">
							<Words words={r.words} hue={wordHue} />
						</span>
					)}
					{peek ? (
						<span
							className={`relative mt-auto flex items-center ${
								!wordsBeside
									? big
										? "h-16 @lg:h-4"
										: "h-14 @lg:h-3"
									: big
										? `h-24 pt-3 ${row ? "@2xl:h-44 @2xl:items-end @2xl:pb-6" : ""}`
										: "h-[4.5rem] pt-2"
							}`}
						>
							{wordsBeside && (
								<span
									className={`min-w-0 ${big ? "max-w-[calc(100%-11.5rem)] @2xl:max-w-[13rem]" : "hidden max-w-[calc(100%-8.75rem)] @[18rem]:block"}`}
								>
									<Words
										words={r.words}
										stacked
										hue={wordHue}
										className={`pb-2 ${row ? "@2xl:pb-0" : ""}`}
									/>
								</span>
							)}
						</span>
					) : (
						family !== "genre" &&
						family !== "service" &&
						family !== "decade" && <Words words={r.words} hue={wordHue} className="mt-2" />
					)}
				</span>
			</span>
			{peek && (
				<PosterFan
					titles={titles}
					width={big ? 68 : 54}
					className={`absolute bottom-0 ${big ? "right-6 h-[5.25rem]" : "right-4 h-16"} ${row && wordsBeside ? "@2xl:hidden" : ""}`}
				/>
			)}
			{row && wordsBeside && (
				<PosterRow titles={titles} className="absolute right-6 bottom-6 hidden @2xl:flex" />
			)}
		</div>
	)
}
