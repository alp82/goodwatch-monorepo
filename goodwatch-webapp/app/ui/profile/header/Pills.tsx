// The orbit's open pill: the viewer type in display type, families and attributes as chips,
// and for a member visitor the match as a ring that mirrors the orbit at the pill's other end and links to the
// comparison. The owner and guests see the same pill without the ring. It closes on the orbit again or Escape.
import { DISPLAY } from "~/ui/my-pages/bits"
import { FAMILY_COLOR } from "../taste/model"
import { MatchLink, type MatchView } from "./Compare"
import { Layer, PillFrame, type RevealProps } from "./Reveal"
import type { KeyFacts } from "./facts"

const SLIDE = (open: boolean) =>
	`delay-100 ${open ? "translate-x-0" : "-translate-x-4"}`

const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/** A soft tint of the match color for surfaces. */
const tint = (color: string, pct: number) =>
	`color-mix(in srgb, ${color} ${pct}%, transparent)`

export function PillBackground({ open }: { open: boolean }) {
	return (
		<PillFrame
			open={open}
			surface="bg-linear-to-r from-violet-400/[0.16] via-white/[0.07] to-white/[0.04] ring-1 ring-violet-300/20 ring-inset"
		/>
	)
}

/** Families as filled chips, then the attributes as outlined ones, on one line that hides what does not fit. */
function ChipRow({ facts }: { facts: KeyFacts }) {
	return (
		<span className="flex h-6 min-w-0 flex-wrap gap-1.5 overflow-hidden sm:h-7">
			{facts.families.map((f) => (
				<span
					key={f.id}
					className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-bold text-white sm:h-7 sm:text-sm"
					style={{
						background: `${FAMILY_COLOR[f.id]}38`,
						boxShadow: `inset 0 0 0 1px ${FAMILY_COLOR[f.id]}80`,
					}}
				>
					{f.name}
				</span>
			))}
			{facts.attributes.map((a) => (
				<span
					key={a.key}
					className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold text-gray-200 ring-1 ring-white/20 ring-inset sm:h-7 sm:text-sm"
				>
					{a.label}
				</span>
			))}
		</span>
	)
}

const RING_R = 42
const RING_C = 2 * Math.PI * RING_R

/** The match as a ring filled to the percent, round like the orbit at the pill's other end. */
function MatchRing({ handle, view }: { handle: string; view: MatchView }) {
	return (
		<MatchLink
			handle={handle}
			view={view}
			className={`group relative block size-[68px] shrink-0 rounded-full transition-transform hover:scale-[1.04] sm:size-[116px] ${FOCUS}`}
			style={{
				background: `radial-gradient(closest-side, ${tint(view.color, 22)}, transparent)`,
			}}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				className="absolute inset-0 size-full -rotate-90"
			>
				<circle
					cx="50"
					cy="50"
					r={RING_R}
					fill="none"
					stroke="rgba(255,255,255,.1)"
					strokeWidth="7"
				/>
				<circle
					cx="50"
					cy="50"
					r={RING_R}
					fill="none"
					stroke={view.color}
					strokeWidth="7"
					strokeLinecap="round"
					strokeDasharray={`${(RING_C * view.percent) / 100} ${RING_C}`}
				/>
			</svg>
			<span className="absolute inset-0 flex flex-col items-center justify-center">
				<b
					className={`${DISPLAY} text-lg leading-5 text-white tabular-nums sm:text-3xl sm:leading-8`}
				>
					{view.percent}%
				</b>
				<span
					className="max-w-[70%] text-center text-[10px] leading-3 font-bold max-sm:hidden"
					style={{ color: view.color }}
				>
					{view.tier}
				</span>
			</span>
		</MatchLink>
	)
}

export function PillFacts(props: RevealProps) {
	const { open, facts, match } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-x-0 top-4 bottom-4 flex items-center gap-1.5 pr-2.5 sm:gap-4 sm:pr-2 ${SLIDE(open)}`}
		>
			<div className="min-w-0 flex-1">
				{props.identity && (
					<p
						className={`${DISPLAY} line-clamp-2 text-base leading-5 text-white sm:line-clamp-1 sm:text-[1.75rem] sm:leading-9`}
					>
						{props.identity}
					</p>
				)}
				<div className="mt-1.5 sm:mt-2">
					<ChipRow facts={facts} />
				</div>
				<p className="mt-1.5 truncate text-xs font-semibold text-gray-400 max-sm:hidden">
					@{props.handle}
				</p>
			</div>
			{match && <MatchRing handle={props.handle} view={match} />}
		</Layer>
	)
}
