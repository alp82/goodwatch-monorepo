import type * as F from "~/ui/fingerprint/fingerprintText"
import { AREA_COLOR } from "./areas"
import { type Scale, readScale } from "./scales"
import { type AreaSelection, highlightHandlers } from "./selection"

/** The track of a scale with its dot. When its area is highlighted, the fill glows and a halo grows around the dot. */
function ScaleTrack({
	sc,
	position,
	word,
	highlighted,
}: {
	sc: Scale
	position: number
	word: string
	highlighted: boolean
}) {
	const color = AREA_COLOR[sc.area]
	const from = sc.fromMiddle ? 0.5 : 0
	const lo = Math.min(from, position)
	const hi = Math.max(from, position)
	const direction = position >= from ? "90deg" : "270deg"
	const fill = { left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }
	const dot = `calc(6px + ${position} * (100% - 12px))`
	return (
		<span
			role="img"
			aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
			className="relative block h-1.5 rounded-full bg-white/[.07]"
		>
			{sc.fromMiddle && (
				<span
					aria-hidden="true"
					className="absolute -inset-y-0.5 left-1/2 w-px bg-white/20"
				/>
			)}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 rounded-full"
				style={{
					...fill,
					background: `linear-gradient(${direction}, color-mix(in srgb, ${color} 10%, transparent), color-mix(in srgb, ${color} 55%, transparent))`,
				}}
			/>
			<span
				aria-hidden="true"
				className={`absolute inset-y-0 rounded-full transition-opacity duration-200 motion-reduce:transition-none ${highlighted ? "opacity-100" : "opacity-0"}`}
				style={{
					...fill,
					background: `linear-gradient(${direction}, color-mix(in srgb, ${color} 30%, transparent), ${color})`,
					boxShadow: `0 0 10px -1px ${color}`,
				}}
			/>
			<span
				aria-hidden="true"
				className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
					highlighted ? "scale-[2.4] opacity-100" : "scale-100 opacity-0"
				}`}
				style={{
					left: dot,
					background: `color-mix(in srgb, ${color} 28%, transparent)`,
				}}
			/>
			<span
				aria-hidden="true"
				className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
				style={{ left: dot, background: color }}
			/>
		</span>
	)
}

/**
 * One scale as a button that selects its area. "stacked": name and word above the track, for the all-areas grid.
 * "row": name, track, and word on one line, under an area's lines.
 */
export default function ScaleSlider({
	sc,
	t,
	selection: x,
	layout = "stacked",
}: {
	sc: Scale
	t: F.TitleInput
	selection: AreaSelection
	layout?: "stacked" | "row"
}) {
	const { position, word } = readScale(sc, t)
	const highlighted = x.highlighted === sc.area
	const name = (
		<span className={highlighted ? "text-white" : "text-gray-400"}>
			{sc.name}
		</span>
	)
	const reading = (
		<span
			className="font-semibold"
			style={{ color: highlighted ? AREA_COLOR[sc.area] : "#fff" }}
		>
			{word}
		</span>
	)
	const track = (
		<ScaleTrack
			sc={sc}
			position={position}
			word={word}
			highlighted={highlighted}
		/>
	)
	return (
		<button
			type="button"
			{...highlightHandlers(x, sc.area)}
			onClick={() => x.toggle(sc.area)}
			aria-pressed={x.selected === sc.area}
			className={`-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left hover:bg-white/[.035] focus-visible:outline-2 focus-visible:outline-amber-300 ${
				layout === "row"
					? "grid grid-cols-[4.75rem_minmax(0,1fr)_6.75rem] items-center gap-x-3 py-[5px] text-[13px]"
					: "pb-2.5 pt-1.5"
			}`}
		>
			{layout === "row" ? (
				<>
					{name}
					{track}
					<span className="truncate text-right">{reading}</span>
				</>
			) : (
				<>
					<span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
						{name}
						<span className="text-sm">{reading}</span>
					</span>
					<span className="mt-2 block">{track}</span>
				</>
			)}
		</button>
	)
}
