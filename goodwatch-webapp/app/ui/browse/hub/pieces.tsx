// Pieces the hub shares:
//   - `Pair`: a blend drawn as its ingredients meeting (overlapping rings, each wearing its ingredient's own mark).
//   - `BlendRow`: a hand-picked blend as one link.
import { Link } from "@remix-run/react"
import { useId } from "react"
import type { Kind } from "~/domain/browse/address"
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"
import { FOCUS, PosterTrio, poster } from "~/ui/browse/index"
import { PhraseText } from "~/ui/browse/blend/parts"
import { phrase } from "~/domain/browse/phrase"
import { FlagShape } from "~/ui/browse/world-map/FlagShape"

/** A place's name as people say it. */
export const nice = (p: PlaceRef) => p.label.replace(/ SAR China$/, "")
const NEUTRAL = "#cbd5e1"
const colorOf = (p: PlaceRef) => p.hue ?? NEUTRAL

// ---------------------------------------------------------------------------------------------------------
// A blend as its ingredients meeting

/** What an ingredient wears inside its ring: a decade its two digits, a country its flag-filled shape, a service its logo. */
function RingMark({ part, size }: { part: PlaceRef; size: number }) {
	if (part.family === "decade")
		return (
			<span
				className="font-display leading-none font-bold tracking-tight text-white tabular-nums"
				style={{ fontSize: size * 0.3 }}
			>
				{part.label.slice(2, 4)}s
			</span>
		)
	if (part.family === "country" && part.code)
		return <FlagShape code={part.code} size={size * 0.5} />
	if (part.family === "service" && part.logo)
		return (
			<img
				src={poster(part.logo, "w92")}
				alt=""
				loading="lazy"
				className="rounded-[24%] ring-1 ring-white/15"
				style={{ width: size * 0.42, height: size * 0.42 }}
			/>
		)
	return null
}

/**
 * The ingredients of a blend as rings that overlap: a mood's ring is filled with its color, the others stay quiet and
 * wear their own mark. Where two rings meet is the blend; inside a `group` that lens lights up on hover.
 */
export function Pair({ parts, size = 56 }: { parts: PlaceRef[]; size?: number }) {
	const uid = useId()
	const shown = parts.slice(0, 3)
	const r = size / 2
	const step = size * 0.6
	const width = size + step * (shown.length - 1)
	const mid = (shown.length - 1) / 2
	const cx = (i: number) => r + i * step
	return (
		<span aria-hidden className="relative block shrink-0" style={{ width, height: size }}>
			<svg
				viewBox={`0 0 ${width} ${size}`}
				width={width}
				height={size}
				className="absolute inset-0 overflow-visible"
			>
				<defs>
					{shown.map((p, i) => (
						<clipPath key={`${p.family}:${p.slug}`} id={`${uid}-${i}`}>
							<circle cx={cx(i)} cy={r} r={r - 1} />
						</clipPath>
					))}
				</defs>
				{shown.map((p, i) => {
					const color = colorOf(p)
					return (
						<circle
							key={`${p.family}:${p.slug}`}
							cx={cx(i)}
							cy={r}
							r={r - 1}
							fill={color}
							fillOpacity={p.hue ? 0.34 : 0.09}
							stroke={color}
							strokeOpacity={p.hue ? 1 : 0.5}
							strokeWidth={1.5}
							style={
								p.hue
									? {
											filter: `drop-shadow(0 0 7px color-mix(in oklab, ${color} 55%, transparent))`,
										}
									: undefined
							}
						/>
					)
				})}
				{/* The lens: where a ring meets the one before it. */}
				{shown.slice(1).map((p, i) => {
					const hue = shown[i].hue ?? p.hue
					return (
						<circle
							key={`lens-${p.family}:${p.slug}`}
							cx={cx(i + 1)}
							cy={r}
							r={r - 1}
							clipPath={`url(#${uid}-${i})`}
							fill={hue ?? "#ffffff"}
							className={`transition-opacity duration-300 motion-reduce:transition-none ${hue ? "opacity-60 group-hover:opacity-100" : "opacity-[0.16] group-hover:opacity-[0.34]"}`}
						/>
					)
				})}
			</svg>
			{shown.map((p, i) => (
				<span
					key={`${p.family}:${p.slug}`}
					className="absolute top-0 grid place-items-center"
					style={{
						left: i * step + Math.sign(i - mid) * (size - step) * 0.5,
						width: size,
						height: size,
					}}
				>
					<RingMark part={p} size={size} />
				</span>
			))}
		</span>
	)
}

/** A hand-picked blend as one link: the rings, its name the way a person says it, one human line, three posters. */
export function BlendRow({
	kind,
	parts,
	pitch,
	titles,
	to,
}: {
	kind: Kind
	parts: PlaceRef[]
	pitch?: string
	titles: ShowTitle[]
	to: string
}) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group flex items-center gap-3.5 rounded-2xl bg-white/[0.035] py-3.5 pr-3.5 pl-3.5 ring-1 ring-white/10 transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.06] hover:ring-white/25 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-5 sm:pl-5 ${FOCUS}`}
		>
			<span className="max-sm:hidden">
				<Pair parts={parts} />
			</span>
			<span className="sm:hidden">
				<Pair parts={parts} size={44} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-display text-lg leading-snug font-bold tracking-tight text-balance text-white sm:text-xl">
					<PhraseText segs={phrase(kind, parts)} />
				</span>
				{pitch && (
					<span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-gray-400">
						{pitch}
					</span>
				)}
			</span>
			{titles.length > 0 && (
				<PosterTrio titles={titles.slice(0, 3)} className="w-[8.75rem] shrink-0 max-sm:hidden" />
			)}
		</Link>
	)
}
