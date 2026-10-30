// PROTOTYPE OPTIONS (member nav, round 8): the profile header's four layouts (nav-options.ts `header`). Each has one
// height per width (BOX), on every profile tab, list page and Settings page, and the handle strip uses the same one.
// The only links out of the profile are Share and Edit profile; the counts lead to profile tabs.
import { PencilSquareIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { EDIT_PROFILE_PATH, tastePath } from "~/domain/member-paths"
import { type ProfileShell, seesPart } from "~/domain/profile"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../ProfileFrame"
import { QUIET_BUTTON, ShareButton, count, posterUrl } from "../parts"
import { Whorl, type WhorlAttribute } from "../taste/Whorl"

export type HeaderLook = NavOptions["header"]

/** Each layout's one height: phones, then from sm up. */
export const BOX: Record<HeaderLook, string> = {
	slim: "h-16 sm:h-[72px]", // OPTION header=slim
	cover: "h-[164px] sm:h-[216px]", // OPTION header=cover
	print: "h-[112px] sm:h-[152px]", // OPTION header=print
	card: "h-[168px] sm:h-[144px]", // OPTION header=card
}

export interface HeaderProps {
	/** The shell as the viewer sees it (for the owner's visitor view, `asGuestSees`). */
	shell: ProfileShell
	identity: string | null
	print: WhorlAttribute[] | null
	posters: string[]
	/** ?as=visitor while the owner views as a visitor, for the count links. */
	query: { as: string } | undefined
	/** The owner's visitor control (bar and switch), or null. */
	control: ReactNode
	/** Edit profile: the card layout, for the owner in their own view. */
	edit: boolean
	/** The "Visitor view" badge beside the handle (switch, while on). */
	badge: ReactNode
	/** The amber ring while the owner views as a visitor (bar). */
	ring: boolean
	/** The amber tint while the owner views as a visitor (switch). */
	tint: boolean
}

interface Count {
	key: string
	n: number
	label: string
	to?: string
}

function countsOf(shell: ProfileShell, query: HeaderProps["query"]): Count[] {
	const c = shell.counts
	const see = (part: Parameters<typeof seesPart>[1]) => seesPart(shell, part)
	const out: Count[] = []
	if (see("seen")) out.push({ key: "seen", n: c.seen, label: "seen" })
	if (see("scores"))
		out.push({
			key: "scores",
			n: c.rated,
			label: c.rated === 1 ? "score" : "scores",
			to: tastePath(shell.handle, "scores", query),
		})
	if (see("lists"))
		out.push({
			key: "lists",
			n: c.lists,
			label: c.lists === 1 ? "list" : "lists",
			to: tastePath(shell.handle, "lists", query),
		})
	if (see("hours")) {
		const days = Math.round(c.hours / 24)
		out.push({
			key: "days",
			n: days,
			label: days === 1 ? "day watched" : "days watched",
		})
	}
	return out
}

function CountLink({
	item,
	className,
	children,
}: { item: Count; className: string; children: ReactNode }) {
	return item.to ? (
		<Link
			to={item.to}
			prefetch="intent"
			preventScrollReset
			className={`${className} hover:text-white`}
		>
			{children}
		</Link>
	) : (
		<span className={className}>{children}</span>
	)
}

/** "1,234 seen · 980 scores": the slim and print layouts. */
function InlineCounts({
	items,
	className = "",
}: { items: Count[]; className?: string }) {
	return (
		<p className={`flex gap-x-3 overflow-hidden text-gray-400 ${className}`}>
			{items.map((item) => (
				<CountLink key={item.key} item={item} className="whitespace-nowrap">
					<b className="font-bold text-gray-100 tabular-nums">
						{count(item.n)}
					</b>{" "}
					{item.label}
				</CountLink>
			))}
		</p>
	)
}

/** Small pills: the cover layout. */
function CountPills({ items }: { items: Count[] }) {
	return (
		<p className="flex gap-1.5 overflow-hidden max-sm:[&>*:nth-child(n+4)]:hidden">
			{items.map((item) => (
				<CountLink
					key={item.key}
					item={item}
					className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs whitespace-nowrap text-gray-400 ring-1 ring-white/10"
				>
					<b className="font-bold text-gray-100 tabular-nums">
						{count(item.n)}
					</b>
					{item.label}
				</CountLink>
			))}
		</p>
	)
}

/** Share for everyone, Edit profile for the owner in their own view, then the visitor control. */
function Actions({
	shell,
	edit,
	control,
}: Pick<HeaderProps, "shell" | "edit" | "control">) {
	return (
		<div className="flex shrink-0 items-center gap-2">
			<ShareButton
				handle={shell.handle}
				label="Share"
				name="Share profile"
				className={QUIET_BUTTON}
				compact
			/>
			{edit && (
				<Link
					to={EDIT_PROFILE_PATH}
					prefetch="intent"
					aria-label="Edit profile"
					className={`${QUIET_BUTTON} max-sm:size-10 max-sm:justify-center max-sm:px-0`}
				>
					<PencilSquareIcon className="size-4" aria-hidden />
					<span className="max-sm:hidden">Edit profile</span>
				</Link>
			)}
			{control}
		</div>
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

/** Header chrome every layout shares: the fixed height, the switch tint and the bar ring. */
function Frame({
	look,
	ring,
	tint,
	children,
	className = "",
}: {
	look: HeaderLook
	ring: boolean
	tint: boolean
	children: ReactNode
	className?: string
}) {
	return (
		<header
			className={`relative isolate shrink-0 overflow-hidden ${BOX[look]} ${ring ? "ring-2 ring-amber-400 ring-inset" : ""} ${className}`}
			data-profile-header={look}
		>
			{tint && (
				<span
					aria-hidden
					className="absolute inset-0 -z-10 bg-amber-400/[0.09]"
				/>
			)}
			{children}
		</header>
	)
}

// OPTION header=slim
/** One compact row: picture, handle and viewer type, the counts, the keys. */
export function SlimHeader(props: HeaderProps) {
	const { shell, identity, query, badge } = props
	const items = countsOf(shell, query)
	return (
		<Frame look="slim" ring={props.ring} tint={props.tint}>
			<div className="absolute inset-0 -z-20 bg-linear-to-b from-gray-900/80 to-gray-950" />
			<div className={`${WRAP} flex h-full items-center gap-3`}>
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-baseline gap-x-2.5 max-sm:items-center">
						<Handle shell={shell} className="text-lg leading-5 sm:text-2xl" />
						{badge}
						{identity && (
							<span className="truncate text-sm font-semibold text-violet-200 max-sm:hidden">
								{identity}
							</span>
						)}
					</div>
					{identity && (
						<p className="truncate text-[13px] leading-4 font-semibold text-violet-200 sm:hidden">
							{identity}
						</p>
					)}
					<InlineCounts
						items={items}
						className="text-xs leading-4 sm:hidden [&>*:nth-child(n+3)]:hidden"
					/>
				</div>
				<InlineCounts
					items={items}
					className="shrink-0 text-sm max-sm:hidden max-lg:[&>*:nth-child(n+3)]:hidden"
				/>
				<Actions shell={shell} edit={props.edit} control={props.control} />
			</div>
		</Frame>
	)
}

// OPTION header=cover
/** A band of the member's best scored posters, the picture over its lower edge, the counts as pills. */
export function CoverHeader(props: HeaderProps) {
	const { shell, identity, query, badge, posters } = props
	// Enough posters to fill a wide screen: the list repeats when it is short.
	const strip = posters.length
		? Array.from({ length: 20 }, (_, i) => posters[i % posters.length])
		: []
	const backdrop = !strip.length && shell.cover ? shell.cover.backdrop : null
	return (
		<Frame look="cover" ring={props.ring} tint={props.tint}>
			<div
				aria-hidden
				className="absolute inset-x-0 top-0 -z-10 h-[88px] overflow-hidden bg-gray-900 sm:h-32"
			>
				{strip.length > 0 && (
					<div className="flex h-full justify-center gap-1 opacity-45">
						{strip.map((path, i) => (
							<img
								// biome-ignore lint/suspicious/noArrayIndexKey: the strip repeats titles
								key={i}
								src={posterUrl(path, "w154") ?? ""}
								alt=""
								decoding="async"
								className="aspect-[2/3] h-full shrink-0 rounded-[3px] object-cover"
							/>
						))}
					</div>
				)}
				{backdrop && (
					<img
						src={posterUrl(backdrop, "w780") ?? ""}
						alt=""
						className="h-full w-full object-cover object-[center_30%] opacity-40"
					/>
				)}
				<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/40 to-gray-950/10" />
			</div>
			<div
				className={`${WRAP} flex h-full flex-col justify-end gap-2 pb-3 sm:gap-3 sm:pb-4`}
			>
				<div className="flex items-end gap-3 sm:gap-4">
					<ProfileAvatar
						handle={shell.handle}
						avatar={shell.avatar}
						size="lg"
					/>
					<div className="min-w-0 flex-1 pb-0.5">
						<div className="flex min-w-0 items-center gap-2">
							<Handle
								shell={shell}
								className="text-xl leading-7 sm:text-3xl sm:leading-9"
							/>
							{badge}
						</div>
						<p className="h-5 truncate text-sm font-semibold text-violet-200">
							{identity}
						</p>
					</div>
					<Actions shell={shell} edit={props.edit} control={props.control} />
				</div>
				<CountPills items={countsOf(shell, query)} />
			</div>
		</Frame>
	)
}

/** The print with the picture at its core; an empty ring of the same size without one. */
function PrintMark({ shell, print }: Pick<HeaderProps, "shell" | "print">) {
	return (
		<div className="relative size-24 shrink-0 sm:size-[136px]">
			{print ? (
				<Whorl
					attributes={print}
					turns={12}
					rim={false}
					markers={false}
					animate={false}
					label={`@${shell.handle}'s taste print`}
					className="absolute inset-0 size-full"
				/>
			) : (
				<span
					aria-hidden
					className="absolute inset-2 rounded-full ring-1 ring-white/10 ring-dashed"
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

// OPTION header=print
/** The taste print round the picture, the viewer type large beside it, the counts small. */
export function PrintHeader(props: HeaderProps) {
	const { shell, identity, query, badge, print } = props
	return (
		<Frame look="print" ring={props.ring} tint={props.tint}>
			<div className="absolute inset-0 -z-20 bg-linear-to-b from-gray-900/70 to-gray-950" />
			<div className={`${WRAP} flex h-full items-center gap-3 sm:gap-6`}>
				<PrintMark shell={shell} print={print} />
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<Handle
							shell={shell}
							className="text-sm font-bold tracking-normal text-gray-300 sm:text-lg"
						/>
						{badge}
					</div>
					<p
						className={`${DISPLAY} line-clamp-2 text-lg leading-[1.15] text-violet-100 sm:line-clamp-1 sm:text-4xl sm:leading-tight`}
					>
						{identity ?? (
							<span className="text-gray-500">Taste still forming</span>
						)}
					</p>
					<InlineCounts
						items={countsOf(shell, query)}
						className="mt-1 text-xs sm:mt-2 sm:text-sm max-sm:[&>*:nth-child(n+3)]:hidden"
					/>
				</div>
				<div className="self-start pt-3 sm:self-center sm:pt-0">
					<Actions shell={shell} edit={props.edit} control={props.control} />
				</div>
			</div>
		</Frame>
	)
}

// OPTION header=card
/** A rounded card in the page width: picture, handle, viewer type, a grid of counts and the profile's keys. */
export function CardHeader(props: HeaderProps) {
	const { shell, identity, query, badge } = props
	const items = countsOf(shell, query)
	const grid = (
		<div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl bg-white/10 sm:w-[min(26rem,40vw)] sm:shrink-0">
			{items.map((item) => (
				<CountLink
					key={item.key}
					item={item}
					className="flex flex-col items-center justify-center bg-gray-950/80 px-1 py-2 sm:py-2.5"
				>
					<span className="text-base font-black text-white tabular-nums sm:text-xl">
						{count(item.n)}
					</span>
					<span className="truncate text-[11px] text-gray-400 sm:text-xs">
						{item.label}
					</span>
				</CountLink>
			))}
		</div>
	)
	return (
		<Frame look="card" ring={false} tint={false}>
			<div className={`${WRAP} h-full py-3`}>
				<div
					className={`relative isolate flex h-full flex-col justify-center gap-3 overflow-hidden rounded-3xl bg-white/[0.04] p-4 ring-1 sm:flex-row sm:items-center sm:gap-5 sm:px-5 ${
						props.ring ? "ring-2 ring-amber-400" : "ring-white/10"
					}`}
				>
					{props.tint && (
						<span
							aria-hidden
							className="absolute inset-0 -z-10 bg-amber-400/[0.1]"
						/>
					)}
					<div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
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
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 items-center gap-2">
								<Handle
									shell={shell}
									className="text-lg leading-6 sm:text-2xl sm:leading-8"
								/>
								{badge}
							</div>
							<p className="h-5 truncate text-sm font-semibold text-violet-200">
								{identity}
							</p>
						</div>
						<span className="sm:hidden">
							<Actions
								shell={shell}
								edit={props.edit}
								control={props.control}
							/>
						</span>
					</div>
					{items.length > 0 && grid}
					<span className="max-sm:hidden">
						<Actions shell={shell} edit={props.edit} control={props.control} />
					</span>
				</div>
			</div>
		</Frame>
	)
}

export const LAYOUTS: Record<HeaderLook, (props: HeaderProps) => ReactNode> = {
	slim: SlimHeader,
	cover: CoverHeader,
	print: PrintHeader,
	card: CardHeader,
}
