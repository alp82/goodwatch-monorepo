// PROTOTYPE OPTIONS (round 15, nav option `pill`): five designs of the orbit's open pill. Each draws the pill's surface
// (behind the picture) and its contents (in the content column), and for a member visitor holds the match badge, which
// links to the comparison. The owner and guests see the same pill without the badge.
//   1 Refined: a brighter surface, the viewer type as the headline, families as labeled strength bars, a match chip.
//   2 Two zones: the fingerprint facts left, the match as a bold tinted block filling the pill's round end.
//   3 Spectrum: every family as one stacked bar across the pill, the attributes under it, a match gauge at the end.
//   4 Headline + ring: the viewer type in display type, families and attributes as chips, the match as a ring that
//     mirrors the orbit at the pill's other end.
//   5 Unrolled orbit: the orbit's track runs out of the picture across the pill with the top attributes as its dots,
//     and ends in a node that is you: the match.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useNavOptions } from "~/ui/navigation/nav-options"
import { FAMILY_COLOR } from "../taste/model"
import { MatchLink, type MatchView } from "./Compare"
import {
	AttributeLine,
	CloseKey,
	FamilyChips,
	Layer,
	PillFrame,
	type RevealProps,
} from "./Reveal"
import type { KeyFacts } from "./facts"

const SLIDE = (open: boolean) =>
	`delay-100 ${open ? "translate-x-0" : "-translate-x-4"}`

const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/** A soft tint of the match color for surfaces. */
const tint = (color: string, pct: number) =>
	`color-mix(in srgb, ${color} ${pct}%, transparent)`

// ---------- Surfaces ----------

export function PillBackground({
	open,
	facts,
}: { open: boolean; facts: KeyFacts }) {
	const { pill } = useNavOptions()
	const top = facts.families[0]
	switch (pill) {
		case "2":
			return (
				<PillFrame
					open={open}
					surface="bg-gray-900 bg-linear-to-r from-white/[0.08] to-white/[0.02] ring-1 ring-white/10 ring-inset"
				/>
			)
		case "3":
			return (
				<PillFrame
					open={open}
					surface="ring-1 ring-white/10 ring-inset"
					style={{
						backgroundImage: `linear-gradient(90deg, ${top ? `${FAMILY_COLOR[top.id]}2e` : "rgba(255,255,255,.1)"}, rgba(255,255,255,.06) 45%, rgba(255,255,255,.03))`,
					}}
				/>
			)
		case "4":
			return (
				<PillFrame
					open={open}
					surface="bg-linear-to-r from-violet-400/[0.16] via-white/[0.07] to-white/[0.04] ring-1 ring-violet-300/20 ring-inset"
				/>
			)
		case "5":
			return (
				<PillFrame
					open={open}
					surface="bg-linear-to-r from-white/[0.1] via-white/[0.05] to-white/[0.03] ring-1 ring-white/[0.07] ring-inset"
				/>
			)
		default:
			return (
				<PillFrame
					open={open}
					surface="bg-linear-to-r from-white/[0.16] via-white/[0.1] to-white/[0.06] ring-1 ring-white/15 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,.16)]"
				/>
			)
	}
}

export function PillFacts(props: RevealProps) {
	const { pill } = useNavOptions()
	switch (pill) {
		case "2":
			return <TwoZones {...props} />
		case "3":
			return <Spectrum {...props} />
		case "4":
			return <HeadlineRing {...props} />
		case "5":
			return <Unrolled {...props} />
		default:
			return <Refined {...props} />
	}
}

const Handle = ({
	handle,
	className = "",
}: { handle: string; className?: string }) => (
	<span
		className={`shrink-0 text-[11px] leading-4 font-semibold text-gray-400 sm:text-xs ${className}`}
	>
		@{handle}
	</span>
)

// ---------- 1 Refined ----------

/** Each family as its name over a bar as long as its pull. */
function FamilyBars({ facts }: { facts: KeyFacts }) {
	return (
		<span className="flex min-w-0 gap-2.5 overflow-hidden sm:gap-5">
			{facts.families.map((f) => (
				<span key={f.id} className="w-12 shrink-0 sm:w-24">
					<span className="block truncate text-[10px] leading-3 font-bold tracking-wide text-gray-200 uppercase sm:text-[11px] sm:leading-4">
						{f.name}
					</span>
					<span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10 sm:h-1.5">
						<span
							className="block h-full rounded-full"
							style={{
								width: `${Math.round(24 + f.strength * 76)}%`,
								background: FAMILY_COLOR[f.id],
							}}
						/>
					</span>
				</span>
			))}
		</span>
	)
}

function MatchChipBadge({
	handle,
	view,
	compact,
}: { handle: string; view: MatchView; compact: boolean }) {
	return (
		<MatchLink
			handle={handle}
			view={view}
			className={`inline-flex shrink-0 items-center rounded-full bg-gray-950/80 font-bold whitespace-nowrap ring-1 transition-colors hover:bg-gray-950 ${FOCUS} ${compact ? "h-6 gap-1 px-2 text-xs" : "h-10 gap-2 pr-4 pl-3 text-sm"}`}
			style={{ boxShadow: `inset 0 0 0 1px ${tint(view.color, 55)}` }}
		>
			<span
				aria-hidden
				className={`rounded-full ${compact ? "size-1.5" : "size-2.5"}`}
				style={{
					background: view.color,
					boxShadow: `0 0 10px ${view.color}`,
				}}
			/>
			<b
				className={`font-black tabular-nums ${compact ? "" : "text-lg"}`}
				style={{ color: view.color }}
			>
				{view.percent}%
			</b>
			{!compact && <span className="text-gray-100">{view.tier}</span>}
			{!compact && (
				<ArrowRightIcon aria-hidden className="size-4 text-gray-400" />
			)}
		</MatchLink>
	)
}

function Refined(props: RevealProps) {
	const { open, facts, match } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-x-0 top-4 bottom-4 flex items-center gap-2 pr-1 sm:gap-4 sm:pr-4 ${SLIDE(open)}`}
		>
			<div className="min-w-0 flex-1">
				<Handle handle={props.handle} className="block max-sm:hidden" />
				{props.identity && (
					<p className="truncate text-sm leading-5 font-bold text-white sm:text-xl sm:leading-7">
						{props.identity}
					</p>
				)}
				<div className="mt-1.5 sm:mt-2.5">
					<FamilyBars facts={facts} />
				</div>
				<AttributeLine
					facts={facts}
					className="mt-1.5 text-xs sm:mt-2 sm:text-sm"
				/>
			</div>
			{match && (
				<>
					<span className="sm:hidden">
						<MatchChipBadge handle={props.handle} view={match} compact />
					</span>
					<span className="max-sm:hidden">
						<MatchChipBadge
							handle={props.handle}
							view={match}
							compact={false}
						/>
					</span>
				</>
			)}
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}

// ---------- 2 Two zones ----------

/** "● Story  ● Craft  ● World" as colored words. */
function FamilyWords({ facts }: { facts: KeyFacts }) {
	return (
		<span className="flex h-4 min-w-0 flex-wrap gap-x-2.5 overflow-hidden text-xs leading-4 font-bold sm:h-5 sm:text-sm sm:leading-5">
			{facts.families.map((f) => (
				<span key={f.id} className="inline-flex shrink-0 items-center gap-1">
					<span
						aria-hidden
						className="size-1.5 rounded-full sm:size-2"
						style={{ background: FAMILY_COLOR[f.id] }}
					/>
					<span style={{ color: FAMILY_COLOR[f.id] }}>{f.name}</span>
				</span>
			))}
		</span>
	)
}

function TwoZones(props: RevealProps) {
	const { open, facts, match } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-x-0 top-4 bottom-4 flex items-center gap-1 pr-1.5 sm:gap-3 sm:pr-2 ${SLIDE(open)}`}
		>
			<div className="min-w-0 flex-1">
				<Handle handle={props.handle} className="block" />
				{props.identity && (
					<p className="line-clamp-2 text-xs leading-4 font-bold text-violet-100 sm:line-clamp-1 sm:text-lg sm:leading-7">
						{props.identity}
					</p>
				)}
				<div className="mt-1 sm:mt-1.5">
					<FamilyWords facts={facts} />
				</div>
				<AttributeLine
					facts={facts}
					className="mt-0.5 text-xs max-sm:hidden sm:mt-1 sm:text-sm"
				/>
			</div>
			<CloseKey onClose={props.onClose} />
			{match && (
				<MatchLink
					handle={props.handle}
					view={match}
					className={`group relative flex h-[76px] w-[78px] shrink-0 flex-col justify-center rounded-l-[22px] rounded-r-[38px] pr-2 pl-2.5 transition-[filter] hover:brightness-125 sm:h-[116px] sm:w-52 sm:rounded-l-[34px] sm:rounded-r-[58px] sm:pr-10 sm:pl-6 ${FOCUS}`}
					style={{
						background: `linear-gradient(120deg, ${tint(match.color, 34)}, ${tint(match.color, 12)})`,
						boxShadow: `inset 0 0 0 1px ${tint(match.color, 60)}`,
					}}
				>
					<b
						className={`${DISPLAY} text-xl leading-6 tabular-nums sm:text-5xl sm:leading-none`}
						style={{ color: match.color }}
					>
						{match.percent}%
					</b>
					<span className="mt-0.5 text-[10px] leading-3 font-bold text-white sm:mt-1.5 sm:text-sm sm:leading-5">
						{match.tier}
					</span>
					<span className="mt-1 inline-flex items-center gap-1 text-xs text-gray-200 max-sm:hidden">
						Compare tastes
						<ArrowRightIcon
							aria-hidden
							className="size-3.5 transition-transform group-hover:translate-x-0.5"
						/>
					</span>
				</MatchLink>
			)}
		</Layer>
	)
}

// ---------- 3 Spectrum ----------

/** Every family's pull as one stacked bar, the strongest ones named under their part. */
function StackedFamilies({ facts }: { facts: KeyFacts }) {
	const named = new Set(facts.families.map((f) => f.id))
	const share = (s: number) => Math.max(0.06, s)
	return (
		<div className="min-w-0">
			<div className="flex h-2 gap-0.5 overflow-hidden rounded-full sm:h-3">
				{facts.pulls.map((f) => (
					<span
						key={f.id}
						className="h-full first:rounded-l-full last:rounded-r-full"
						style={{
							flexGrow: share(f.strength),
							flexBasis: 0,
							background: FAMILY_COLOR[f.id],
							opacity: named.has(f.id) ? 1 : 0.35,
						}}
					/>
				))}
			</div>
			<div className="mt-1 flex gap-0.5 max-sm:hidden">
				{facts.pulls.map((f) => (
					<span
						key={f.id}
						className="min-w-0 truncate text-[10px] leading-3 font-bold sm:text-xs sm:leading-4"
						style={{
							flexGrow: share(f.strength),
							flexBasis: 0,
							color: named.has(f.id) ? FAMILY_COLOR[f.id] : "transparent",
						}}
					>
						{named.has(f.id) ? f.name : ""}
					</span>
				))}
			</div>
		</div>
	)
}

/** The match as a gauge: a vertical bar filled to the percent, the number and tier beside it. */
function MatchGauge({ handle, view }: { handle: string; view: MatchView }) {
	return (
		<MatchLink
			handle={handle}
			view={view}
			className={`group flex shrink-0 items-stretch gap-2 rounded-2xl py-1 pr-1 pl-1 transition-colors hover:bg-white/[0.06] sm:gap-3 sm:pr-3 ${FOCUS}`}
		>
			<span
				aria-hidden
				className="relative w-1.5 overflow-hidden rounded-full bg-white/10 sm:w-2"
			>
				<span
					className="absolute inset-x-0 bottom-0 origin-bottom rounded-full"
					style={{ height: `${view.percent}%`, background: view.color }}
				/>
			</span>
			<span className="flex flex-col justify-center">
				<b
					className={`${DISPLAY} text-xl leading-6 tabular-nums sm:text-4xl sm:leading-10`}
					style={{ color: view.color }}
				>
					{view.percent}%
				</b>
				<span className="max-w-16 text-[10px] leading-3 font-bold text-gray-100 sm:max-w-none sm:text-sm sm:leading-5">
					{view.tier}
				</span>
				<span className="text-xs text-gray-400 group-hover:text-gray-200 max-sm:hidden">
					match with you
				</span>
			</span>
		</MatchLink>
	)
}

function Spectrum(props: RevealProps) {
	const { open, facts, match } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-x-0 top-4 bottom-4 flex items-center gap-2 pr-1 sm:gap-5 sm:pr-4 ${SLIDE(open)}`}
		>
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-baseline gap-2">
					<Handle handle={props.handle} className="max-sm:hidden" />
					{props.identity && (
						<span className="min-w-0 truncate text-xs font-bold text-white sm:text-base">
							{props.identity}
						</span>
					)}
				</p>
				<div className="mt-1.5 sm:mt-2.5">
					<StackedFamilies facts={facts} />
				</div>
				<div className="mt-1 sm:hidden">
					<FamilyWords facts={facts} />
				</div>
				<AttributeLine
					facts={facts}
					className="mt-1 text-xs sm:mt-1.5 sm:text-sm"
				/>
			</div>
			{match && (
				<>
					<span
						aria-hidden
						className="h-12 w-px shrink-0 bg-white/10 sm:h-20"
					/>
					<MatchGauge handle={props.handle} view={match} />
				</>
			)}
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}

// ---------- 4 Headline + ring ----------

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

function HeadlineRing(props: RevealProps) {
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
				<p className="mt-1.5 truncate text-xs text-gray-400 max-sm:hidden">
					<span className="font-semibold">@{props.handle}</span>
					{match && (
						<span>
							{" "}
							· <span style={{ color: match.color }}>{match.tier}</span> with
							you
						</span>
					)}
				</p>
			</div>
			<CloseKey onClose={props.onClose} />
			{match && <MatchRing handle={props.handle} view={match} />}
		</Layer>
	)
}

// ---------- 5 Unrolled orbit ----------

/** The orbit's dotted track running across the pill: the top attributes as its dots, the match as the last node. */
const Segment = ({ grow = true }: { grow?: boolean }) => (
	<span
		aria-hidden
		className={`h-0 min-w-2 border-t-2 border-dotted border-white/25 ${grow ? "flex-1" : "w-3 shrink-0"}`}
	/>
)

function Track({
	facts,
	handle,
	match,
}: { facts: KeyFacts; handle: string; match: MatchView | null }) {
	const max = Math.max(...facts.attributes.map((a) => a.edge), 0.01)
	return (
		<div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
			<Segment grow={false} />
			{facts.attributes.map((a, i) => {
				const size = Math.round(6 + (Math.max(0, a.edge) / max) * 6)
				return (
					<span key={a.key} className="contents">
						{i > 0 && <Segment />}
						<span className="inline-flex min-w-0 items-center gap-1.5">
							<span
								aria-hidden
								className="shrink-0 rounded-full"
								style={{
									width: size,
									height: size,
									background: FAMILY_COLOR[a.family],
									boxShadow: `0 0 8px ${FAMILY_COLOR[a.family]}99`,
								}}
							/>
							<span className="truncate text-sm font-semibold text-gray-100 max-sm:hidden">
								{a.label}
							</span>
						</span>
					</span>
				)
			})}
			<Segment />
			{match && (
				<MatchLink
					handle={handle}
					view={match}
					className={`group inline-flex shrink-0 items-center gap-2 rounded-full sm:pr-1 ${FOCUS}`}
				>
					<span
						className="inline-flex size-9 items-center justify-center rounded-full text-[11px] font-black text-white tabular-nums transition-transform group-hover:scale-110 sm:size-12 sm:text-sm"
						style={{
							background: tint(match.color, 28),
							boxShadow: `inset 0 0 0 2px ${match.color}, 0 0 16px ${tint(match.color, 50)}`,
						}}
					>
						{match.percent}%
					</span>
					<span className="flex flex-col text-left max-sm:hidden">
						<span className="text-[10px] leading-3 font-semibold text-gray-400 uppercase">
							You
						</span>
						<span
							className="text-sm leading-5 font-bold whitespace-nowrap"
							style={{ color: match.color }}
						>
							{match.tier}
						</span>
					</span>
				</MatchLink>
			)}
		</div>
	)
}

function Unrolled(props: RevealProps) {
	const { open, facts, match } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-x-0 top-4 bottom-4 flex items-center gap-1 pr-0 sm:gap-3 sm:pr-3 ${SLIDE(open)}`}
		>
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-baseline gap-2">
					<Handle handle={props.handle} className="max-sm:hidden" />
					{props.identity && (
						<span className="min-w-0 truncate text-xs font-bold text-violet-200 sm:text-base">
							{props.identity}
						</span>
					)}
				</p>
				<div className="mt-1.5 sm:mt-2.5">
					<Track facts={facts} handle={props.handle} match={match} />
				</div>
				<FamilyChips
					families={facts.families}
					className="mt-2.5 max-sm:hidden"
				/>
				<AttributeLine facts={facts} className="mt-1.5 text-xs sm:hidden" />
			</div>
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}
