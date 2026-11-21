// PROTOTYPE - throwaway (prototype/explore-r9). The round 9 mood card the three "mix" variants share: Title card's
// large type and rule, Swatch's mood-color overlay, and optionally a film still behind it (full, faint, or none).
//
// Two states that never mix, because the owner asked for it:
// - Fit to the dials (`tuned`) drives the compatibility strip on the left edge and a clear fits / doesn't fit look:
//   a mood that fits keeps its color, one that doesn't drains to slate. Pointing at moods never changes it.
// - Pointing (`pointed`) only answers "this one": the rule runs out to full width, an arrow slides in, the still
//   pushes in a little.
import { poster } from "../../../../kit/ui"
import { GLIDE_T, MOVE_T } from "../../../../kit/ui/motion"
import { CardLink, type MoodCardProps } from "./core"

export type Backdrop = "full" | "faint" | "none"

/** Fits the dials: the top part of the spread (1 is the best fit, 0 the worst). */
export const FITS = 0.55

const SLATE = "rgb(100 116 139)"

export function MixCard({
	mood,
	tuned,
	pointed,
	size,
	backdrop,
}: MoodCardProps & { backdrop: Backdrop }) {
	const hue = mood.place.hue ?? "#94a3b8"
	const dialed = tuned != null
	const fits = !dialed || tuned >= FITS
	const frame =
		backdrop === "none"
			? undefined
			: (mood.titles.find((t) => t.card.backdrop_path) ?? mood.titles[0])
	const src = frame
		? frame.card.backdrop_path
			? poster(frame.card.backdrop_path, "w780")
			: poster(frame.card.poster_path, "w342")
		: ""
	const still = backdrop === "full" ? 0.62 : 0.2
	const m = size === "m"
	return (
		<CardLink
			mood={mood}
			className={`group relative h-full overflow-hidden rounded-xl bg-[#0f1420] ring-1 ring-white/[0.06] ${m ? "min-h-[10.5rem]" : "min-h-[8rem]"}`}
		>
			{src && (
				<img
					src={src}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover transition-[transform,opacity,filter] duration-[380ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
					style={{
						opacity: fits ? still : still * 0.3,
						filter: fits ? "none" : "grayscale(1)",
						transform: `scale(${pointed ? 1.05 : 1})`,
					}}
				/>
			)}
			{/* Over a still: the mood's hue tints the frame (color blend), so every still reads as its mood. */}
			{src && (
				<span
					aria-hidden
					className={`absolute inset-0 ${GLIDE_T}`}
					style={{ background: hue, mixBlendMode: "color", opacity: fits ? 0.75 : 0 }}
				/>
			)}
			{/* Swatch's color: a field of the mood's color, lit when it fits, drained when it doesn't. */}
			<span
				aria-hidden
				className={`absolute inset-0 ${GLIDE_T}`}
				style={{
					background: `linear-gradient(140deg, color-mix(in oklab, ${hue} 62%, #131926) 0%, color-mix(in oklab, ${hue} 22%, #131926) 80%)`,
					opacity: fits ? (backdrop === "none" ? 0.85 : backdrop === "faint" ? 0.72 : 0.42) : 0.08,
				}}
			/>
			{backdrop !== "none" && (
				<span
					aria-hidden
					className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent"
				/>
			)}
			{/* The compatibility strip: how well this mood fits the dials, from the bottom up. */}
			<span aria-hidden className="absolute top-0 bottom-0 left-0 w-1 bg-white/[0.07]">
				<span
					className={`absolute inset-0 origin-bottom ${MOVE_T}`}
					style={{
						background: fits ? hue : SLATE,
						transform: `scaleY(${dialed ? Math.max(0.04, tuned) : 0})`,
					}}
				/>
			</span>
			<span
				className={`relative flex h-full flex-col ${m ? "py-5 pr-5 pl-6" : "py-3.5 pr-3.5 pl-4"}`}
			>
				<span
					className={`flex items-baseline gap-2 leading-[1.05] font-bold tracking-tight text-balance ${GLIDE_T} ${m ? "text-[1.75rem]" : "text-[1.3rem]"}`}
					style={{ color: fits ? "white" : SLATE }}
				>
					<span className="min-w-0">{mood.place.label}</span>
					<span
						aria-hidden
						className={`text-[0.6em] ${MOVE_T}`}
						style={{
							color: hue,
							opacity: pointed ? 1 : 0,
							transform: `translateX(${pointed ? 0 : -8}px)`,
						}}
					>
						→
					</span>
				</span>
				<span aria-hidden className="mt-3 block h-px w-full bg-white/[0.12]">
					<span
						className={`block h-px origin-left ${MOVE_T}`}
						style={{
							background: fits ? `color-mix(in oklab, ${hue} 70%, white)` : SLATE,
							transform: `scaleX(${pointed ? 1 : 0.22})`,
						}}
					/>
				</span>
				<span
					className={`mt-2.5 block text-[13px] leading-snug ${GLIDE_T} ${m ? "truncate" : "line-clamp-2"}`}
					style={{ color: fits ? "rgb(255 255 255 / 0.8)" : SLATE }}
				>
					{mood.traits.map((t) => t.word).join(" · ")}
				</span>
				{dialed && (
					<span
						className={`mt-auto pt-3 text-[11px] font-semibold tracking-[0.08em] uppercase ${GLIDE_T}`}
						style={{ color: fits ? `color-mix(in oklab, ${hue} 55%, white)` : SLATE }}
					>
						{fits ? (tuned >= 0.85 ? "Fits best" : "Fits") : "Doesn't fit"}
					</span>
				)}
				{m && frame && backdrop === "full" && (
					<span
						className={`absolute right-3 bottom-3 max-w-[50%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/75 uppercase ${GLIDE_T}`}
						style={{ opacity: pointed ? 1 : 0 }}
					>
						{frame.card.title}
					</span>
				)}
			</span>
		</CardLink>
	)
}

export const MIX_NOTE = {
	term: "Fit and pointing",
	means:
		"Turn a dial and every mood says plainly whether it fits: in color with a full strip on its left edge, or drained to slate. Pointing at a mood never changes that; it only runs the rule out and slides in an arrow.",
	isNew: true,
}
