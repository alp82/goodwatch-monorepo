// PROTOTYPE OPTIONS (member nav, round 10): the profile header's four layouts (nav-options.ts `layout`), each built
// round the fingerprint ring (Ring.tsx, nav-options `ring`) with Share, View as visitor and Edit profile as part of it
// (Controls.tsx). Each layout has one height per width (BOX) on every profile tab, list page and Settings page, and
// the handle strip uses the same one. Each shows a count line and three facts (facts.ts), and for a member on someone
// else's profile, their match with you.
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { HeaderMatch } from "~/server/profile/header.server"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { profileTabPath } from "../paths"
import type { WhorlAttribute } from "../taste/Whorl"
import {
	ClusterControls,
	type ControlsProps,
	CornerControls,
	PillControls,
	TOOLBAR_CELL,
	ToolbarControls,
} from "./Controls"
import { PrintRing, type RingLook } from "./Ring"
import type { HeaderFact, HeaderFacts } from "./facts"

export type HeaderLayout = NavOptions["layout"]

/** Each layout's one height: phones, then from sm up. */
export const BOX: Record<HeaderLayout, string> = {
	inline: "h-[120px] sm:h-[164px]", // OPTION layout=inline
	centered: "h-[256px] sm:h-[296px]", // OPTION layout=centered
	split: "h-[212px] sm:h-[188px]", // OPTION layout=split
	stacked: "h-[230px] sm:h-[268px]", // OPTION layout=stacked
}

export interface HeaderProps {
	/** The shell as the viewer sees it (for the owner's visitor view, `asGuestSees`). */
	shell: ProfileShell
	identity: string | null
	print: WhorlAttribute[] | null
	ringLook: RingLook
	facts: HeaderFacts
	controls: ControlsProps
	/** The signed-in visitor's match, on someone else's profile. */
	match: HeaderMatch | null
	/** The amber ring while the owner views as a visitor. */
	ring: boolean
}

/** Header chrome every layout shares: the fixed height and the visitor ring. */
export function Frame({
	layout,
	ring,
	children,
	strip = false,
}: {
	layout: HeaderLayout
	ring: boolean
	children: ReactNode
	strip?: boolean
}) {
	return (
		<header
			className={`relative isolate shrink-0 ${BOX[layout]}`}
			data-profile-header={layout}
			data-handle-strip={strip || undefined}
		>
			<div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute inset-0 bg-linear-to-b from-gray-900/70 to-gray-950" />
			</div>
			{ring && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 z-10 ring-2 ring-amber-400 ring-inset"
				/>
			)}
			{children}
		</header>
	)
}

const Handle = ({
	shell,
	className,
}: { shell: ProfileShell; className: string }) => (
	<h1 className={`${DISPLAY} min-w-0 truncate text-white ${className}`}>
		@{shell.handle}
	</h1>
)

const Identity = ({
	identity,
	className = "",
}: { identity: string | null; className?: string }) =>
	identity ? (
		<p className={`truncate font-semibold text-violet-200/75 ${className}`}>
			{identity}
		</p>
	) : null

const compareHref = (handle: string) =>
	`${profileTabPath(handle, "stats")}#compare`

/** "84% match": the visitor's match, linking to the comparison on Stats. */
function MatchChip({
	shell,
	match,
	long = false,
	className = "",
}: {
	shell: ProfileShell
	match: HeaderMatch
	/** "84% match with you" in place of "84% match". */
	long?: boolean
	className?: string
}) {
	return (
		<Link
			to={compareHref(shell.handle)}
			prefetch="intent"
			title={`${match.tier}: compare your tastes`}
			className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-amber-400/12 px-2.5 text-xs font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/30 hover:bg-amber-400/20 ${className}`}
			data-header-match
		>
			<b className="font-black text-amber-100 tabular-nums">{match.percent}%</b>
			{long ? "match with you" : "match"}
		</Link>
	)
}

/** The fact as inline text: "**344 days** watch time", or "favorite director **Agnès Varda**". */
function FactText({ fact }: { fact: HeaderFact }) {
	const value = <b className="font-bold text-gray-100">{fact.value}</b>
	// "879 movies · 120 shows seen" on a phone: the movies' "seen" waits for the shows'.
	const label =
		fact.key === "movies" ? (
			<span className="max-sm:hidden">{fact.label}</span>
		) : (
			fact.label
		)
	const body = fact.labelFirst ? (
		<>
			{label} {value}
		</>
	) : (
		<>
			{value} {label}
		</>
	)
	return fact.to ? (
		<Link
			to={fact.to}
			prefetch="intent"
			preventScrollReset
			className="whitespace-nowrap hover:text-white"
			data-header-fact={fact.key}
		>
			{body}
		</Link>
	) : (
		<span className="whitespace-nowrap" data-header-fact={fact.key}>
			{body}
		</span>
	)
}

/** "**1,003** movies · **210** shows seen", or nothing when the set shows them already. */
function CountText({ count }: { count: HeaderFact[] }) {
	if (!count.length) return null
	const [movies, shows] = count
	const num = (fact: HeaderFact) => {
		const [n, ...rest] = fact.value.split(" ")
		return (
			<>
				<b className="font-bold text-gray-100 tabular-nums">{n}</b>{" "}
				{rest.join(" ")}
			</>
		)
	}
	const body = (
		<>
			{num(movies)}
			{shows && <> · {num(shows)}</>} seen
		</>
	)
	return movies.to ? (
		<Link
			to={movies.to}
			prefetch="intent"
			preventScrollReset
			className="whitespace-nowrap hover:text-white"
			data-header-count
		>
			{body}
		</Link>
	) : (
		<span className="whitespace-nowrap" data-header-count>
			{body}
		</span>
	)
}

/**
 * The count and the facts on one line. Items that don't fit wrap onto a hidden second line, so the row keeps its height
 * and phones keep the first ones.
 */
function FactLine({
	facts,
	className = "",
}: { facts: HeaderFacts; className?: string }) {
	if (!facts.count.length && !facts.facts.length) return null
	return (
		<p
			className={`flex flex-wrap overflow-hidden text-gray-400 [&>*+*]:before:mx-2 [&>*+*]:before:text-gray-600 [&>*+*]:before:content-['·'] ${className}`}
		>
			{facts.count.length > 0 && <CountText count={facts.count} />}
			{facts.facts.map((fact) => (
				<FactText key={fact.key} fact={fact} />
			))}
		</p>
	)
}

/** A fact as a stat: the value over its label. */
function Stat({
	fact,
	className = "",
	valueClass = "text-base leading-6 sm:text-xl sm:leading-7",
}: { fact: HeaderFact; className?: string; valueClass?: string }) {
	// Phones take the short words when there are any.
	const both = (full: string, short?: string) =>
		short && short !== full ? (
			<>
				<span className="sm:hidden">{short}</span>
				<span className="max-sm:hidden">{full}</span>
			</>
		) : (
			full
		)
	const body = (
		<>
			<span
				className={`block truncate font-black text-white tabular-nums ${valueClass}`}
			>
				{both(fact.value, fact.short?.value)}
			</span>
			<span className="block truncate text-[11px] leading-4 text-gray-400 sm:text-xs">
				{both(fact.label, fact.short?.label)}
			</span>
		</>
	)
	const cls = `min-w-0 ${className}`
	return fact.to ? (
		<Link
			to={fact.to}
			prefetch="intent"
			preventScrollReset
			className={`${cls} hover:[&>span:first-child]:text-amber-200`}
			data-header-fact={fact.key}
		>
			{body}
		</Link>
	) : (
		<span className={cls} data-header-fact={fact.key}>
			{body}
		</span>
	)
}

// OPTION layout=inline
/** Today's row, rethought: the ring, the handle with the viewer type and the facts, and one control cluster. */
export function InlineHeader(props: HeaderProps) {
	const { shell, match } = props
	return (
		<Frame layout="inline" ring={props.ring}>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-6`}>
				<div className="relative shrink-0">
					<PrintRing
						look={props.ringLook}
						shell={shell}
						print={props.print}
						yours={match?.yours}
						className="size-[88px] sm:size-[132px]"
					/>
					{match && (
						<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 sm:hidden">
							<MatchChip shell={shell} match={match} className="h-6! px-2!" />
						</span>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-3">
						<Handle
							shell={shell}
							className="text-xl leading-7 sm:text-[2.125rem] sm:leading-10"
						/>
						{match && (
							<MatchChip
								shell={shell}
								match={match}
								long
								className="max-sm:hidden"
							/>
						)}
					</div>
					<Identity identity={props.identity} className="text-xs sm:text-sm" />
					<FactLine
						facts={props.facts}
						className="mt-1 h-4 text-xs leading-4 sm:mt-2.5 sm:h-5 sm:text-sm sm:leading-5"
					/>
				</div>
				<ClusterControls {...props.controls} />
			</div>
		</Frame>
	)
}

// OPTION layout=centered
/** Centered like a portrait: the ring, the handle, the facts as a centered row, the controls as a pill group. */
export function CenteredHeader(props: HeaderProps) {
	const { shell, match } = props
	return (
		<Frame layout="centered" ring={props.ring}>
			<div
				aria-hidden
				className="pointer-events-none absolute top-0 left-1/2 -z-10 h-56 w-[36rem] max-w-full -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(167,139,250,0.10),transparent)]"
			/>
			<div
				className={`${WRAP} flex h-full flex-col items-center justify-center text-center`}
			>
				<div className="relative">
					<PrintRing
						look={props.ringLook}
						shell={shell}
						print={props.print}
						yours={match?.yours}
						className="size-[84px] sm:size-[108px]"
					/>
					{match && (
						<span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
							<MatchChip shell={shell} match={match} className="bg-gray-950!" />
						</span>
					)}
				</div>
				<Handle
					shell={shell}
					className="mt-3 max-w-full text-2xl leading-8 sm:mt-3.5 sm:text-4xl sm:leading-10"
				/>
				<Identity
					identity={props.identity}
					className="max-w-full text-xs leading-4 sm:text-sm sm:leading-5"
				/>
				<FactLine
					facts={props.facts}
					className="mt-1.5 h-4 max-w-full justify-center text-xs leading-4 sm:mt-2 sm:h-5 sm:text-sm sm:leading-5"
				/>
				<div className="mt-3.5 sm:mt-4">
					<PillControls {...props.controls} />
				</div>
			</div>
		</Frame>
	)
}

// OPTION layout=split
/** Identity on the left; on the right, a small panel of three facts with the controls in its corner. */
export function SplitHeader(props: HeaderProps) {
	const { shell, match, facts } = props
	const caption = match ? (
		<Link
			to={compareHref(shell.handle)}
			prefetch="intent"
			className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold text-amber-200 hover:text-amber-100"
			data-header-match
		>
			<b className="font-black text-amber-100 tabular-nums">{match.percent}%</b>
			match with you
			<span className="font-semibold text-amber-200/60 max-sm:hidden">
				· {match.tier}
			</span>
		</Link>
	) : (
		<span className="truncate text-[11px] font-bold tracking-wider text-gray-500 uppercase">
			In numbers
		</span>
	)
	return (
		<Frame layout="split" ring={props.ring}>
			<div
				className={`${WRAP} flex h-full flex-col justify-center gap-3 sm:flex-row sm:items-center sm:gap-8`}
			>
				<div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-5">
					<PrintRing
						look={props.ringLook}
						shell={shell}
						print={props.print}
						yours={match?.yours}
						className="size-16 sm:size-[124px]"
					/>
					<div className="min-w-0 flex-1">
						<Handle
							shell={shell}
							className="text-xl leading-7 sm:text-[2.125rem] sm:leading-10"
						/>
						<Identity
							identity={props.identity}
							className="text-xs sm:text-sm"
						/>
						{facts.count.length > 0 && (
							<p className="mt-0.5 truncate text-xs text-gray-400 sm:mt-2 sm:text-sm">
								<CountText count={facts.count} />
							</p>
						)}
					</div>
				</div>
				<div className="rounded-2xl bg-white/[0.035] px-3.5 pt-1.5 pb-3 ring-1 ring-white/[0.08] sm:w-[27rem] sm:shrink-0 sm:px-4 sm:pt-2 sm:pb-3.5">
					<div className="flex h-8 items-center justify-between gap-2">
						{caption}
						<CornerControls {...props.controls} />
					</div>
					<div className="mt-1 grid grid-cols-3 gap-3 sm:mt-1.5 sm:gap-4">
						{facts.facts.map((fact) => (
							<Stat
								key={fact.key}
								fact={fact}
								valueClass="text-sm leading-5 sm:text-lg sm:leading-7"
							/>
						))}
					</div>
				</div>
			</div>
		</Frame>
	)
}

// OPTION layout=stacked
/** A compact card: the ring and the handle on top, the facts as stat tiles, the controls as its bottom toolbar. */
export function StackedHeader(props: HeaderProps) {
	const { shell, match, facts } = props
	return (
		<Frame layout="stacked" ring={props.ring}>
			<div className={`${WRAP} flex h-full items-center`}>
				<div className="w-full overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.08] sm:max-w-3xl">
					<div className="flex items-center gap-3 px-3.5 pt-3.5 sm:gap-4 sm:px-5 sm:pt-5">
						<PrintRing
							look={props.ringLook}
							shell={shell}
							print={props.print}
							yours={match?.yours}
							className="size-14 sm:size-[76px]"
						/>
						<div className="min-w-0 flex-1">
							<Handle
								shell={shell}
								className="text-lg leading-6 sm:text-[1.75rem] sm:leading-9"
							/>
							<p className="flex min-w-0 gap-2 truncate text-xs text-gray-400 sm:text-sm">
								{props.identity && (
									<span className="truncate font-semibold text-violet-200/75">
										{props.identity}
									</span>
								)}
								{props.identity && facts.count.length > 0 && (
									<span aria-hidden className="text-gray-600 max-sm:hidden">
										·
									</span>
								)}
								{facts.count.length > 0 && (
									<span className="max-sm:hidden">
										<CountText count={facts.count} />
									</span>
								)}
							</p>
						</div>
					</div>
					<div className="grid grid-cols-3 gap-2 px-3.5 py-3 sm:gap-2.5 sm:px-5 sm:py-4">
						{facts.facts.map((fact) => (
							<Stat
								key={fact.key}
								fact={fact}
								className="rounded-xl bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/[0.05] sm:px-3.5 sm:py-2.5"
								valueClass="text-sm leading-5 sm:text-lg sm:leading-7"
							/>
						))}
					</div>
					<ToolbarControls
						{...props.controls}
						extra={
							match && (
								<Link
									to={compareHref(shell.handle)}
									prefetch="intent"
									className={`${TOOLBAR_CELL} text-amber-200! hover:text-amber-100!`}
									data-header-match
								>
									<ArrowsRightLeftIcon
										className="size-[18px] shrink-0"
										aria-hidden
									/>
									<span className="truncate">
										<b className="font-black tabular-nums">{match.percent}%</b>{" "}
										match
										<span className="max-sm:hidden"> with you</span>
									</span>
								</Link>
							)
						}
					/>
				</div>
			</div>
		</Frame>
	)
}

export const LAYOUTS: Record<HeaderLayout, (props: HeaderProps) => ReactNode> =
	{
		inline: InlineHeader,
		centered: CenteredHeader,
		split: SplitHeader,
		stacked: StackedHeader,
	}
