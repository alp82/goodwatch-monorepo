// Watch > Length. Two blocks, Movies and Episodes, each with its count, Any, four tiles and a slider (0 to 240 min,
// step 5). Movies write `runtime`, episodes `episodeRuntime`; the two ranges are independent. A block dims while the
// type leaves its kind out.
//
// Counts sum `optionCounts.runtime` (with `counts=length`) and show only when the response has them.
import { motion } from "framer-motion"
import type { FilterRange } from "~/domain/filter-state"
import {
	EPISODE_LENGTH_PRESETS,
	LENGTH_MAX,
	LENGTH_STEP,
	MOVIE_LENGTH_PRESETS,
	type RangePreset,
	sameRange,
} from "~/domain/title-scales"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { SubTabView } from "../DiscoverControls"
import {
	type LengthKind,
	formatLength,
	kindRange,
	lengthCount,
	lengthPatch,
	lengthSpan,
	spanRange,
	toggleLengthPatch,
} from "./length-choices"
import { BlockHead, ClearLink, tabPad } from "./parts"

const BLOCKS: {
	kind: LengthKind
	type: "movie" | "show"
	label: string
	presets: readonly RangePreset[]
}[] = [
	{
		kind: "movie",
		type: "movie",
		label: "Movies",
		presets: MOVIE_LENGTH_PRESETS,
	},
	{
		kind: "episode",
		type: "show",
		label: "Episodes",
		presets: EPISODE_LENGTH_PRESETS,
	},
]

function Tile({
	preset,
	count,
	active,
	onClick,
}: {
	preset: RangePreset
	count: number | null
	active: boolean
	onClick: () => void
}) {
	const dead = !active && count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`flex h-16 min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl px-3.5 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active
					? "bg-white text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
			}`}
		>
			<span
				className={`w-full truncate text-[14px] ${active ? "font-semibold" : "font-medium"}`}
			>
				{preset.label}
			</span>
			<span className="flex w-full items-baseline gap-2">
				<span
					className={`truncate text-[12px] ${active ? "text-gray-600" : "text-gray-500"}`}
				>
					{preset.note}
				</span>
				<span
					className={`ml-auto shrink-0 text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`}
				>
					{count === null ? "" : compactCount(count)}
				</span>
			</span>
		</motion.button>
	)
}

export function LengthTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, update } = view.filters
	const runtime = view.counts?.optionCounts.runtime
	const setRange = (kind: LengthKind, range: FilterRange | undefined) =>
		update((st) => ({ ...st, ...lengthPatch(st, kind, range) }))
	return (
		<div
			className={`${tabPad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-2 gap-10"}`}
		>
			{BLOCKS.map((block) => {
				const range = kindRange(state, block.kind)
				const off = state.type !== "all" && state.type !== block.type
				const total = lengthCount(runtime, block.kind, range)
				return (
					<section
						key={block.kind}
						aria-label={`${block.label} length`}
						className={`flex min-w-0 flex-col gap-3 transition-opacity ${off ? "opacity-45" : ""}`}
					>
						<BlockHead
							note={total === null ? undefined : compactCount(total)}
							right={
								<ClearLink
									show={range !== undefined}
									onClick={() => setRange(block.kind, undefined)}
								>
									Any
								</ClearLink>
							}
						>
							{block.label}
						</BlockHead>
						<div
							className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-4"}`}
						>
							{block.presets.map((preset) => (
								<Tile
									key={preset.key}
									preset={preset}
									count={lengthCount(runtime, block.kind, preset.range)}
									active={sameRange(range, preset.range)}
									onClick={() =>
										update((st) => ({
											...st,
											...toggleLengthPatch(st, block.kind, preset.range),
										}))
									}
								/>
							))}
						</div>
						<div className="mt-1">
							<RangeSlider
								label={`${block.label} length`}
								min={0}
								max={LENGTH_MAX}
								step={LENGTH_STEP}
								value={lengthSpan(range)}
								format={formatLength}
								onCommit={(span) => setRange(block.kind, spanRange(span))}
							/>
						</div>
					</section>
				)
			})}
		</div>
	)
}
