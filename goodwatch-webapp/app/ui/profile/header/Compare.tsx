// PROTOTYPE OPTIONS (member nav, round 11): how a signed-in visitor sees their match with the profile in the header
// (nav-options.ts `compare`): chip (the percent and the tier in one chip), gauge (a small arc filled to the percent,
// the tier under it), overlap (your print and theirs as two small family glyphs overlapping, shared families in color,
// the percent where they meet) and halves (the orbit itself split: their half and yours, with the match under the
// picture; Ring.tsx draws the ring). Overlap and halves name the families you share. Each links to the comparison on
// the Taste tab. `Slot` is the desktop block beside the name, `Row` the phone line under it.
import { Link } from "@remix-run/react"
import { useId } from "react"
import { tastePath } from "~/domain/member-paths"
import type { HeaderMatch } from "~/server/profile/header.server"
import type { NavOptions } from "~/ui/navigation/nav-options"
import type { WhorlAttribute } from "../taste/Whorl"
import { FAMILY_COLOR, FAMILY_ORDER } from "../taste/model"
import { type FamilyPull, andList, familyPulls, sharedFamilies } from "./facts"

export type CompareLook = NavOptions["compare"]

export interface CompareProps {
	look: CompareLook
	handle: string
	match: HeaderMatch
	/** Their print; null when you may not see their taste. */
	theirs: WhorlAttribute[] | null
}

// The comparison sits at the top of the Taste tab.
const compareHref = (handle: string) => `${tastePath(handle)}#compare`

const shared = ({ theirs, match }: CompareProps) =>
	theirs && match.yours ? sharedFamilies(theirs, match.yours) : []

const Percent = ({ match }: { match: HeaderMatch }) => (
	<b className="font-black text-amber-100 tabular-nums">{match.percent}%</b>
)

/** The families as small colored dots with their names. */
function FamilyDots({
	families,
	className = "",
}: { families: FamilyPull[]; className?: string }) {
	return (
		<span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
			{families.map((f) => (
				<span key={f.id} className="inline-flex items-center gap-1">
					<span
						aria-hidden
						className="size-2 shrink-0 rounded-full"
						style={{ background: FAMILY_COLOR[f.id] }}
					/>
					<span className="font-semibold text-gray-200">{f.name}</span>
				</span>
			))}
		</span>
	)
}

const LINK = "rounded-xl focus-visible:outline-2 focus-visible:outline-white"

// OPTION compare=chip
/** "84% · Like-minded" in a chip with a soft amber-to-violet wash and two linked rings. */
export function MatchChip({
	handle,
	match,
	className = "",
}: {
	handle: string
	match: HeaderMatch
	className?: string
}) {
	return (
		<Link
			to={compareHref(handle)}
			prefetch="intent"
			className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-linear-to-r from-amber-400/20 to-violet-400/15 pr-3 pl-1.5 text-xs font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/35 transition-colors hover:from-amber-400/30 hover:to-violet-400/25 ${className}`}
			data-header-match="chip"
		>
			<svg aria-hidden="true" viewBox="0 0 24 16" className="h-4 w-6 shrink-0">
				<circle
					cx={8}
					cy={8}
					r={6}
					fill="none"
					stroke="#fcd34d"
					strokeWidth={1.6}
				/>
				<circle
					cx={16}
					cy={8}
					r={6}
					fill="none"
					stroke="#c4b5fd"
					strokeWidth={1.6}
				/>
			</svg>
			<Percent match={match} />
			<span className="text-amber-200/50">·</span>
			<span>{match.tier}</span>
		</Link>
	)
}

// OPTION compare=gauge
/** A half-circle gauge filled to the percent. */
function GaugeArc({
	percent,
	className,
	text = true,
}: { percent: number; className: string; text?: boolean }) {
	const gradient = `gw-gauge${useId().replace(/:/g, "")}`
	return (
		<svg aria-hidden="true" viewBox="-50 -48 100 54" className={className}>
			<path
				d="M-42 0A42 42 0 0 1 42 0"
				fill="none"
				stroke="rgba(255,255,255,.1)"
				strokeWidth={9}
				strokeLinecap="round"
			/>
			<path
				d="M-42 0A42 42 0 0 1 42 0"
				fill="none"
				stroke={`url(#${gradient})`}
				strokeWidth={9}
				strokeLinecap="round"
				pathLength={100}
				strokeDasharray={`${percent} 100`}
			/>
			<defs>
				<linearGradient id={gradient} x1="0" x2="1">
					<stop offset="0" stopColor="#a78bfa" />
					<stop offset="1" stopColor="#fbbf24" />
				</linearGradient>
			</defs>
			{text && (
				<text
					x={0}
					y={-2}
					textAnchor="middle"
					className="fill-white font-black"
					style={{ fontSize: 22 }}
				>
					{percent}%
				</text>
			)}
		</svg>
	)
}

/**
 * Their taste and yours as two overlapping circles: the families only they lean toward sit in their crescent, the
 * ones only you lean toward in yours, and the shared ones in the amber lens where the circles meet.
 */
function OverlapGlyphs({
	theirs,
	yours,
	className,
}: {
	theirs: WhorlAttribute[]
	yours: WhorlAttribute[]
	className: string
}) {
	const clip = `gw-overlap${useId().replace(/:/g, "")}`
	const both = new Set(sharedFamilies(theirs, yours).map((f) => f.id))
	const leans = (print: WhorlAttribute[]) =>
		familyPulls(print).filter((f) => f.strength >= 0.5 && !both.has(f.id))
	const column = (ids: FamilyPull[], x: number, r: number) =>
		ids.map((f, i) => (
			<circle
				key={`${x}-${f.id}`}
				cx={x}
				cy={Math.round((i - (ids.length - 1) / 2) * 13 * 10) / 10}
				r={r}
				fill={FAMILY_COLOR[f.id]}
			>
				<title>{f.name}</title>
			</circle>
		))
	return (
		<svg aria-hidden="true" viewBox="-74 -36 148 72" className={className}>
			<defs>
				<clipPath id={clip}>
					<circle cx={20} cy={0} r={34} />
				</clipPath>
			</defs>
			<circle
				cx={-20}
				cy={0}
				r={34}
				fill="rgba(255,255,255,.04)"
				stroke="rgba(255,255,255,.3)"
				strokeWidth={1.2}
			/>
			<circle
				cx={20}
				cy={0}
				r={34}
				fill="rgba(255,255,255,.04)"
				stroke="rgba(196,181,253,.5)"
				strokeWidth={1.2}
			/>
			<circle
				cx={-20}
				cy={0}
				r={34}
				clipPath={`url(#${clip})`}
				fill="rgba(251,191,36,.2)"
				stroke="#fbbf24"
				strokeWidth={1.4}
			/>
			{column(leans(theirs), -36, 4)}
			{column(
				familyPulls(theirs).filter((f) => both.has(f.id)),
				0,
				5.5,
			)}
			{column(leans(yours), 36, 4)}
		</svg>
	)
}

/** The desktop block beside the name (chip draws next to the handle instead). */
export function CompareSlot(props: CompareProps) {
	const { look, handle, match, theirs } = props
	const both = shared(props)
	if (look === "chip") return null
	if (look === "gauge")
		return (
			<Link
				to={compareHref(handle)}
				prefetch="intent"
				className={`${LINK} flex shrink-0 flex-col items-center px-2 text-center`}
				data-header-match="gauge"
			>
				<GaugeArc percent={match.percent} className="h-[58px] w-[108px]" />
				<span className="mt-1 text-sm font-bold text-amber-200">
					{match.tier}
				</span>
				<span className="text-[11px] text-gray-500">match with you</span>
			</Link>
		)
	if (look === "overlap")
		return (
			<Link
				to={compareHref(handle)}
				prefetch="intent"
				className={`${LINK} flex w-[17rem] shrink-0 flex-col items-center px-2 text-center`}
				data-header-match="overlap"
			>
				<span className="flex items-center gap-2">
					<span className="w-12 truncate text-right text-[11px] font-semibold text-gray-400">
						@{handle}
					</span>
					{theirs && match.yours ? (
						<OverlapGlyphs
							theirs={theirs}
							yours={match.yours}
							className="h-[72px] w-[148px]"
						/>
					) : (
						<GaugeArc percent={match.percent} className="h-12 w-24" />
					)}
					<span className="w-12 text-left text-[11px] font-semibold text-violet-200/80">
						You
					</span>
				</span>
				<span className="mt-0.5 text-xs text-gray-400">
					<b className="font-black text-amber-100 tabular-nums">
						{match.percent}%
					</b>{" "}
					· {both.length ? "you both lean" : match.tier}{" "}
					{both.length > 0 && <FamilyDots families={both.slice(0, 3)} />}
				</span>
			</Link>
		)
	// halves: the ring shows both halves; the slot reads them.
	return (
		<Link
			to={compareHref(handle)}
			prefetch="intent"
			className={`${LINK} flex w-[15rem] shrink-0 flex-col px-2`}
			data-header-match="halves"
		>
			<span className="flex items-baseline gap-2">
				<span className="font-['Gabarito'] text-3xl font-black text-amber-100 tabular-nums">
					{match.percent}%
				</span>
				<span className="text-sm font-bold text-amber-200">{match.tier}</span>
			</span>
			<span className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
				<span className="inline-flex items-center gap-1">
					<span aria-hidden className="h-0.5 w-3 rounded bg-white/40" />
					Left: @{handle}
				</span>
				<span className="inline-flex items-center gap-1">
					<span aria-hidden className="h-0.5 w-3 rounded bg-amber-300/60" />
					Right: you
				</span>
			</span>
			<SharedLine families={both} tier={null} align="start" />
		</Link>
	)
}

/** "You both lean ● Feel ● Story", or the tier when no family is shared. */
function SharedLine({
	families,
	tier,
	align = "center",
}: {
	families: FamilyPull[]
	tier: string | null
	align?: "center" | "start"
}) {
	return (
		<span
			className={`mt-1 flex w-full min-w-0 flex-wrap items-center gap-x-2 overflow-hidden text-xs text-gray-400 ${align === "center" ? "justify-center" : ""} h-4`}
		>
			{families.length ? (
				<>
					<span>You both lean</span>
					<FamilyDots families={families.slice(0, 3)} />
				</>
			) : (
				<span>{tier ?? "No family in common yet"}</span>
			)}
		</span>
	)
}

/** The phone line under the name. */
export function CompareRow(props: CompareProps) {
	const { look, handle, match, theirs } = props
	const both = shared(props)
	if (look === "chip")
		return <MatchChip handle={handle} match={match} className="h-6!" />
	const names = andList(both.slice(0, 2).map((f) => f.name))
	return (
		<Link
			to={compareHref(handle)}
			prefetch="intent"
			className="flex h-6 min-w-0 items-center gap-1.5 text-xs text-amber-200"
			data-header-match={look}
		>
			{look === "gauge" && (
				<GaugeArc
					percent={match.percent}
					text={false}
					className="h-4 w-8 shrink-0"
				/>
			)}
			{look === "overlap" && theirs && match.yours && (
				<OverlapGlyphs
					theirs={theirs}
					yours={match.yours}
					className="h-6 w-12 shrink-0"
				/>
			)}
			{look !== "halves" && <Percent match={match} />}
			<span className="truncate">
				{look === "gauge" || !names ? match.tier : `You both lean ${names}`}
			</span>
		</Link>
	)
}

/** halves: the match under the picture, on the ring. */
export function HalvesBadge({ match }: { match: HeaderMatch }) {
	return (
		<span
			className="pointer-events-none absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gray-950 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/40 sm:text-xs"
			data-header-match-badge
		>
			<Percent match={match} />
		</span>
	)
}
