// Your taste groups as rows: a fanned stack of the group's loved posters, its name, its word dots, a bar of how much of
// this list sits in it (in the group's hue), the count, and a checkbox. Placeholder rows hold the same height while
// the groups load and for guests.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { sideHue } from "~/ui/discover/side-hues"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { TasteGroup } from "./useTasteGroups"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** A bar from the left, 0 to 1. It grows with a transform, so it never lays out again. */
export function ShareBar({
	share,
	hue,
	faint = false,
}: {
	share: number
	hue: string
	faint?: boolean
}) {
	return (
		<span className="relative block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
			{!faint && (
				<span
					className="absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none"
					style={{ transform: `scaleX(${share})`, background: hue }}
				/>
			)}
		</span>
	)
}

/** A row's count column; empty while the count is on its way. */
export function CountCell({ n }: { n: number | null }) {
	return (
		<span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-gray-400">
			{n !== null ? compactCount(n) : ""}
		</span>
	)
}

function Box({ on }: { on: boolean }) {
	return (
		<span
			aria-hidden
			className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${on ? "bg-white text-gray-950" : "ring-1 ring-inset ring-white/25"}`}
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** Up to three loved posters, overlapping by half. */
function PosterStack({
	posters,
	height,
}: {
	posters: TasteGroup["lovedPosters"]
	height: number
}) {
	const width = Math.round((height * 2) / 3)
	const shown = posters.filter((card) => card.poster_path).slice(0, 3)
	return (
		<span
			aria-hidden
			className="flex shrink-0 items-center"
			style={{ width: width * 2 }}
		>
			{shown.map((card, i) => (
				<img
					key={card.key}
					src={tmdbImageUrl(card.poster_path as string, "w92")}
					alt=""
					loading="lazy"
					decoding="async"
					className="rounded-[4px] bg-white/[0.06] object-cover ring-2 ring-gray-950"
					style={{
						height,
						width,
						marginLeft: i ? -width / 2 : 0,
						zIndex: 3 - i,
					}}
				/>
			))}
		</span>
	)
}

export function GroupRow({
	group,
	on,
	dim,
	count,
	share,
	phone,
	onToggle,
}: {
	group: TasteGroup
	on: boolean
	/** Three are picked and this one isn't. */
	dim: boolean
	count: number | null
	share: number
	phone: boolean
	onToggle: () => void
}) {
	const hue = sideHue(group.number)
	const words = group.wordDots.map((word) => word.name).join(" · ")
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a row that acts as a checkbox
			role="checkbox"
			aria-checked={on}
			aria-disabled={dim || undefined}
			whileTap={dim ? undefined : TAP}
			onClick={() => !dim && onToggle()}
			data-taste-group={group.key}
			className={`flex h-[52px] w-full min-w-0 shrink-0 items-center gap-3 rounded-xl px-2.5 text-left transition-opacity ${FOCUS} ${on ? "bg-white/[0.08] ring-1 ring-inset ring-white/25" : "hover:bg-white/[0.04]"} ${dim ? "cursor-default opacity-40" : "cursor-pointer"}`}
		>
			<PosterStack posters={group.lovedPosters} height={phone ? 34 : 40} />
			<span className={`min-w-0 ${phone ? "flex-1" : "w-[190px] shrink-0"}`}>
				<span className="block truncate text-[14px] font-semibold text-gray-100">
					{group.name}
				</span>
				<span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-gray-500">
					{group.wordDots.map((word) => (
						<span
							key={word.id}
							aria-hidden
							className="h-2 w-2 shrink-0 rounded-full"
							style={{ background: word.hue }}
						/>
					))}
					<span className="truncate">{words}</span>
				</span>
				{phone && (
					<span className="mt-1 block">
						<ShareBar share={share} hue={hue} />
					</span>
				)}
			</span>
			{!phone && <ShareBar share={share} hue={hue} />}
			<CountCell n={count} />
			<Box on={on} />
		</motion.button>
	)
}

/** A row's shape without data: while the groups load, and for guests. */
export function PlaceholderRow({ index }: { index: number }) {
	return (
		<span
			aria-hidden
			className="flex h-[52px] shrink-0 items-center gap-3 px-2.5"
		>
			<span className="h-10 w-[54px] shrink-0 rounded-[4px] bg-white/[0.04]" />
			<span className="w-[150px] shrink-0 space-y-1.5">
				<span
					className="block h-3 rounded bg-white/[0.07]"
					style={{ width: `${80 - index * 12}%` }}
				/>
				<span className="block h-2 w-20 rounded bg-white/[0.04]" />
			</span>
			<span className="h-2 flex-1 rounded-full bg-white/[0.04]" />
		</span>
	)
}

/** The titles that fit no group: a count, not a pick. */
export function NoneRow({
	count,
	faint,
}: {
	count: number | null
	faint: boolean
}) {
	return (
		<div className="flex h-10 shrink-0 items-center gap-3 px-2.5 text-[13px]">
			<span className={faint ? "text-gray-600" : "text-gray-500"}>
				In none of them
			</span>
			<span className="ml-auto flex items-center gap-3">
				<CountCell n={faint ? null : count} />
				<span className="w-5" />
			</span>
		</div>
	)
}
