// PROTOTYPE OPTIONS (member nav, round 9): the profile header's four fingerprint layouts (nav-options.ts `header`).
// Each has one height per width (BOX) on every profile tab, list page and Settings page, and the handle strip uses
// the same one. Each shows the profile's essence: one count (Scores, or Seen) and a few facts (facts.ts). The viewer
// type is a side note at most: ring shows it as a small line, backdrop as a small caption on desktop, emblem only
// as the emblem's label, beside not at all.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../ProfileFrame"
import { count as formatCount } from "../parts"
import { Whorl, type WhorlAttribute } from "../taste/Whorl"
import { type HeaderCount, type HeaderFact, phoneFacts } from "./facts"

export type HeaderLook = NavOptions["header"]

/** Each layout's one height: phones, then from sm up. */
export const BOX: Record<HeaderLook, string> = {
	ring: "h-[104px] sm:h-[144px]", // OPTION header=ring
	beside: "h-[136px] sm:h-[188px]", // OPTION header=beside
	backdrop: "h-[120px] sm:h-[168px]", // OPTION header=backdrop
	emblem: "h-[84px] sm:h-[108px]", // OPTION header=emblem
}

export interface HeaderProps {
	/** The shell as the viewer sees it (for the owner's visitor view, `asGuestSees`). */
	shell: ProfileShell
	identity: string | null
	print: WhorlAttribute[] | null
	/** The one count: Scores, or Seen when the scores are hidden. */
	count: HeaderCount | null
	/** The facts the viewer may see, best first. */
	facts: HeaderFact[]
	/** Share, View as visitor and Edit profile, as the controls option draws them in the header. */
	controls: ReactNode
	/** The amber ring while the owner views as a visitor. */
	ring: boolean
}

/** Header chrome every layout shares: the fixed height and the visitor ring. An open menu lifts it over the tab row. */
export function Frame({
	look,
	ring,
	background,
	children,
	strip = false,
}: {
	look: HeaderLook
	ring: boolean
	/** Drawn behind the content and clipped to the header; the content itself may overflow (the menu). */
	background?: ReactNode
	children: ReactNode
	strip?: boolean
}) {
	return (
		<header
			className={`relative isolate shrink-0 has-[[data-header-menu]]:z-40 ${BOX[look]}`}
			data-profile-header={look}
			data-handle-strip={strip || undefined}
		>
			<div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute inset-0 bg-linear-to-b from-gray-900/70 to-gray-950" />
				{background}
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

function CountItem({ item }: { item: HeaderCount }) {
	const body = (
		<>
			<b className="font-bold text-gray-100 tabular-nums">
				{formatCount(item.n)}
			</b>{" "}
			{item.label}
		</>
	)
	return item.to ? (
		<Link
			to={item.to}
			prefetch="intent"
			preventScrollReset
			className="whitespace-nowrap hover:text-white"
		>
			{body}
		</Link>
	) : (
		<span className="whitespace-nowrap">{body}</span>
	)
}

const FactItem = ({ fact }: { fact: HeaderFact }) => (
	<span className="whitespace-nowrap" data-header-fact={fact.key}>
		{fact.lead && `${fact.lead} `}
		<b className="font-bold text-gray-100">{fact.value}</b>
		{fact.tail && ` ${fact.tail}`}
	</span>
)

/**
 * "1,234 scores · drawn to the surreal · 7.4 usual score" on one line. Items that don't fit wrap onto a hidden second
 * line, so the row keeps its height. `phone` and `desktop` are how many facts follow the count; phones take the short
 * ones first.
 */
function FactRow({
	count,
	facts,
	phone,
	desktop,
	className = "",
}: {
	count: HeaderCount | null
	facts: HeaderFact[]
	phone: number
	desktop: number
	className?: string
}) {
	if (!count && !facts.length) return null
	const row = (shown: HeaderFact[], width: string) => (
		<p
			className={`${width} flex-wrap overflow-hidden text-gray-400 [&>*+*]:before:mx-2 [&>*+*]:before:text-gray-600 [&>*+*]:before:content-['·'] ${className}`}
		>
			{count && <CountItem item={count} />}
			{shown.map((fact) => (
				<FactItem key={fact.key} fact={fact} />
			))}
		</p>
	)
	return (
		<>
			{row(phoneFacts(facts).slice(0, phone), "flex sm:hidden")}
			{row(facts.slice(0, desktop), "flex max-sm:hidden")}
		</>
	)
}

/** The print drawn as a ring round the picture: the ring layout. An empty ring of the same size without one. */
function PrintRing({ shell, print }: Pick<HeaderProps, "shell" | "print">) {
	return (
		<div className="relative size-[88px] shrink-0 sm:size-32">
			<span
				aria-hidden
				className="absolute inset-[18%] rounded-full bg-white/[0.04] shadow-[0_0_40px_rgba(167,139,250,0.18)]"
			/>
			{print ? (
				<Whorl
					attributes={print}
					turns={11}
					rim={false}
					markers={false}
					animate={false}
					label={`@${shell.handle}'s taste print`}
					className="absolute inset-0 size-full"
				/>
			) : (
				<span
					aria-hidden
					className="absolute inset-1.5 rounded-full ring-1 ring-white/10 ring-dashed"
				/>
			)}
			<span className="absolute inset-0 flex items-center justify-center">
				<span className="sm:hidden">
					<ProfileAvatar
						handle={shell.handle}
						avatar={shell.avatar}
						size="sm"
					/>
				</span>
				<span className="max-sm:hidden">
					<ProfileAvatar
						handle={shell.handle}
						avatar={shell.avatar}
						size="md"
					/>
				</span>
			</span>
		</div>
	)
}

// OPTION header=ring
/** Today's print, refined: the fingerprint round the picture, the handle, the viewer type as a small line, the facts. */
export function RingHeader(props: HeaderProps) {
	const { shell, identity, print } = props
	return (
		<Frame look="ring" ring={props.ring}>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-5`}>
				<PrintRing shell={shell} print={print} />
				<div className="min-w-0 flex-1">
					<Handle
						shell={shell}
						className="text-xl leading-7 sm:text-3xl sm:leading-10"
					/>
					{identity && (
						<p className="truncate text-xs font-semibold text-violet-200/75 sm:text-sm">
							{identity}
						</p>
					)}
					<FactRow
						count={props.count}
						facts={props.facts}
						phone={1}
						desktop={3}
						className="mt-1 h-4 text-xs leading-4 sm:mt-2 sm:h-5 sm:text-sm sm:leading-5"
					/>
				</div>
				{props.controls}
			</div>
		</Frame>
	)
}

/** A fact as a small tile: the value over what it is. */
function Tile({
	value,
	label,
	to,
	className = "",
}: { value: string; label: string; to?: string; className?: string }) {
	const body = (
		<>
			<span className="block truncate text-base leading-6 font-black text-white sm:text-xl sm:leading-7">
				{value}
			</span>
			<span className="block truncate text-[11px] leading-4 text-gray-400 sm:text-xs">
				{label}
			</span>
		</>
	)
	const cls = `min-w-0 max-w-56 shrink-0 border-l border-white/10 pl-3 first:border-0 first:pl-0 sm:pl-4 ${className}`
	return to ? (
		<Link
			to={to}
			prefetch="intent"
			preventScrollReset
			className={`${cls} hover:[&>span:first-child]:text-amber-200`}
		>
			{body}
		</Link>
	) : (
		<span className={cls}>{body}</span>
	)
}

// OPTION header=beside
/** The fingerprint large, the picture small at its corner, the handle and the facts as tiles beside it. No viewer type. */
export function BesideHeader(props: HeaderProps) {
	const { shell, print, count, facts } = props
	return (
		<Frame look="beside" ring={props.ring}>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-7`}>
				<div className="relative size-[112px] shrink-0 sm:size-[164px]">
					{print ? (
						<Whorl
							attributes={print}
							labels={false}
							label={`@${shell.handle}'s taste print`}
							className="absolute inset-0 size-full"
						/>
					) : (
						<span
							aria-hidden
							className="absolute inset-3 rounded-full ring-1 ring-white/10 ring-dashed"
						/>
					)}
					<span className="absolute right-0 bottom-0 *:size-9! *:text-base! *:ring-[3px]! sm:*:size-12! sm:*:text-xl!">
						<ProfileAvatar
							handle={shell.handle}
							avatar={shell.avatar}
							size="sm"
						/>
					</span>
				</div>
				<div className="min-w-0 flex-1">
					<Handle
						shell={shell}
						className="text-xl leading-7 sm:text-4xl sm:leading-tight"
					/>
					<div className="mt-1.5 flex h-10 gap-3 overflow-hidden sm:mt-3 sm:h-11 sm:gap-4">
						{count && (
							<Tile
								value={formatCount(count.n)}
								label={count.label}
								to={count.to}
							/>
						)}
						{phoneFacts(facts)
							.slice(0, 1)
							.map((fact) => (
								<Tile
									key={fact.key}
									value={fact.value}
									label={fact.lead ?? fact.tail ?? ""}
									className="sm:hidden"
								/>
							))}
						{facts.slice(0, 3).map((fact, i) => (
							<Tile
								key={fact.key}
								value={fact.value}
								label={fact.lead ?? fact.tail ?? ""}
								className={`max-sm:hidden ${i >= 2 ? "max-lg:hidden" : ""}`}
							/>
						))}
					</div>
				</div>
				<div className="self-start pt-4 sm:self-center sm:pt-0">
					{props.controls}
				</div>
			</div>
		</Frame>
	)
}

// OPTION header=backdrop
/** The fingerprint very large and faint behind the whole header, the picture in front, the viewer type a small caption. */
export function BackdropHeader(props: HeaderProps) {
	const { shell, identity, print } = props
	const background = print ? (
		<div className="absolute top-1/2 left-[-90px] size-[360px] -translate-y-1/2 opacity-[0.16] [mask-image:radial-gradient(closest-side,black_35%,transparent)] sm:left-[max(-200px,calc(50%-840px))] sm:size-[720px]">
			<Whorl
				attributes={print}
				rim={false}
				markers={false}
				animate={false}
				label=""
				className="size-full"
			/>
		</div>
	) : null
	return (
		<Frame look="backdrop" ring={props.ring} background={background}>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-5`}>
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="lg" />
				<div className="min-w-0 flex-1">
					{identity && (
						<p className="truncate text-[11px] font-semibold tracking-wide text-violet-200/70 uppercase max-sm:hidden">
							{identity}
						</p>
					)}
					<Handle
						shell={shell}
						className="text-2xl leading-8 sm:text-5xl sm:leading-tight"
					/>
					<FactRow
						count={props.count}
						facts={props.facts}
						phone={1}
						desktop={3}
						className="mt-1 h-4 text-xs leading-4 sm:mt-1.5 sm:h-5 sm:text-sm sm:leading-5"
					/>
				</div>
				{props.controls}
			</div>
		</Frame>
	)
}

// OPTION header=emblem
/** The plainest: a normal picture with a small fingerprint emblem on its corner, the handle and a short fact line. */
export function EmblemHeader(props: HeaderProps) {
	const { shell, identity, print } = props
	const name = identity
		? `@${shell.handle}'s taste print: ${identity}`
		: `@${shell.handle}'s taste print`
	return (
		<Frame look="emblem" ring={props.ring}>
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-4`}>
				<span className="relative shrink-0">
					<ProfileAvatar
						handle={shell.handle}
						avatar={shell.avatar}
						size="lg"
					/>
					{print && (
						<span
							title={identity ?? undefined}
							className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-gray-950 ring-2 ring-gray-950 sm:size-9"
						>
							<Whorl
								attributes={print}
								turns={7}
								rim={false}
								markers={false}
								animate={false}
								label={name}
								className="size-full"
							/>
						</span>
					)}
				</span>
				<div className="min-w-0 flex-1">
					<Handle
						shell={shell}
						className="text-lg leading-6 sm:text-2xl sm:leading-8"
					/>
					<FactRow
						count={props.count}
						facts={props.facts}
						phone={1}
						desktop={2}
						className="h-4 text-xs leading-4 sm:h-5 sm:text-sm sm:leading-5"
					/>
				</div>
				{props.controls}
			</div>
		</Frame>
	)
}

export const LAYOUTS: Record<HeaderLook, (props: HeaderProps) => ReactNode> = {
	ring: RingHeader,
	beside: BesideHeader,
	backdrop: BackdropHeader,
	emblem: EmblemHeader,
}
