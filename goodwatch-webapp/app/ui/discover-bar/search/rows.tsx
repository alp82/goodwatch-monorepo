// Rows the Search tab shares: a title row with its steering toggles (More like, Less like, Like this), a person row
// whose plus turns into a tick, group headings, the More line, and the picked people as face chips joined by "or".
import {
	ArrowTurnDownLeftIcon,
	CheckIcon,
	HandThumbDownIcon,
	HandThumbUpIcon,
	PlusIcon,
	Square2StackIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import { TAP } from "~/ui/filter-bar/motion"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"
import type { Steer } from "./search-tab"

const POSTER = "https://image.tmdb.org/t/p/w92"
const PROFILE = "https://image.tmdb.org/t/p/w185"

/** A title as the Search tab lists it. */
export interface TitleItem {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

export const cardItem = (card: TitleCard): TitleItem => ({
	key: card.key,
	title: card.title,
	year: card.release_year ? String(card.release_year) : "",
	poster: card.poster_path,
})

/** A person as the Search tab lists them. */
export interface PersonItem {
	id: number
	name: string
	profile: string | null
	/** What shows at the row's right: "12 titles", "Director · 20", the role. */
	note?: string
}

export const SECTION_LABEL =
	"text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500"

export function GroupHead({
	icon,
	children,
	right,
	first = false,
}: {
	icon?: ReactNode
	children: ReactNode
	right?: ReactNode
	first?: boolean
}) {
	return (
		<h3
			className={`${SECTION_LABEL} ${first ? "" : "mt-2"} flex h-6 shrink-0 items-center gap-1.5 px-3 [&>svg]:h-3.5 [&>svg]:w-3.5`}
		>
			{icon}
			{children}
			{right && (
				<span className="ml-auto font-normal tracking-normal normal-case">
					{right}
				</span>
			)}
		</h3>
	)
}

/** One selectable row of a list the bar's field drives (arrow keys and Enter). */
export function Row({
	id,
	i,
	active,
	onHover,
	onClick,
	children,
	tall = false,
}: {
	id: string
	i: number
	active: number
	onHover: (i: number) => void
	onClick: () => void
	children: ReactNode
	tall?: boolean
}) {
	const on = i === active
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the bar's field drives the keyboard (arrow keys and Enter)
		<div
			id={id}
			data-row={i}
			role="row"
			aria-selected={on}
			tabIndex={-1}
			onMouseEnter={() => onHover(i)}
			onClick={onClick}
			className={`flex min-w-0 shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3 ${tall ? "h-12" : "h-11"} ${
				on
					? "bg-white/[0.08] ring-1 ring-white/10 ring-inset"
					: "hover:bg-white/[0.04]"
			}`}
		>
			<div role="gridcell" className="contents">
				{children}
			</div>
		</div>
	)
}

export function EnterKey({ show }: { show: boolean }) {
	return (
		<kbd
			className={`hidden h-6 w-7 shrink-0 place-items-center rounded-md bg-black/30 text-amber-200/80 transition-opacity sm:grid ${show ? "opacity-100" : "opacity-0"}`}
			aria-hidden
		>
			<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" />
		</kbd>
	)
}

export function PosterThumb({
	poster,
	title,
	className = "h-[38px] w-[26px]",
}: {
	poster: string | null
	title: string
	className?: string
}) {
	return (
		<span
			className={`block shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 ${className}`}
		>
			{poster ? (
				<img
					src={`${POSTER}${poster}`}
					alt=""
					loading="lazy"
					className="h-full w-full object-cover"
				/>
			) : (
				<span className="grid h-full place-items-center p-0.5 text-center text-[8px] leading-tight text-gray-500">
					{title}
				</span>
			)}
		</span>
	)
}

export function Face({
	src,
	size,
	className = "",
}: {
	src: string | null
	size: number
	className?: string
}) {
	return (
		<span
			className={`block shrink-0 overflow-hidden rounded-full bg-white/[0.07] ${className}`}
			style={{ width: size, height: size }}
		>
			{src ? (
				<img
					src={`${PROFILE}${src}`}
					alt=""
					loading="lazy"
					className="h-full w-full object-cover"
				/>
			) : (
				<span className="grid h-full w-full place-items-center text-gray-600">
					<UserIcon style={{ width: size * 0.5, height: size * 0.5 }} />
				</span>
			)}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Steering

const STEER: Record<
	Steer,
	{ label: string; icon: ReactNode; color: string; text: string; idle: string }
> = {
	similarTo: {
		label: "Like this",
		icon: <Square2StackIcon />,
		color: "#fb7185",
		text: "text-rose-200",
		idle: "hover:text-rose-200 hover:bg-rose-400/[0.12]",
	},
	loved: {
		label: "More like",
		icon: <HandThumbUpIcon />,
		color: "#34d399",
		text: "text-emerald-200",
		idle: "hover:text-emerald-200 hover:bg-emerald-400/[0.12]",
	},
	disliked: {
		label: "Less like",
		icon: <HandThumbDownIcon />,
		color: "#f87171",
		text: "text-red-200",
		idle: "hover:text-red-200 hover:bg-red-400/[0.12]",
	},
}

const tint = (color: string) => ({
	background: `${color}26`,
	boxShadow: `inset 0 0 0 1px ${color}99`,
})

/**
 * One steering toggle for one title. Off: a quiet round thumb. On: the thumb in a colored chip with a cross, the look
 * of an active filter, so it reads as "on for this list" and not as a saved vote.
 */
function SteerToggle({
	steer,
	on,
	onToggle,
	wide = false,
	title,
}: {
	steer: Steer
	on: boolean
	onToggle: () => void
	wide?: boolean
	title: string
}) {
	const s = STEER[steer]
	if (on)
		return (
			<motion.button
				type="button"
				whileTap={TAP}
				aria-pressed
				aria-label={`${s.label} ${title}, on`}
				onClick={onToggle}
				className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-2 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.text}`}
				style={tint(s.color)}
			>
				{s.icon}
				<span className="text-white">{s.label}</span>
				<XMarkIcon className="!h-3 !w-3 text-white/60" />
			</motion.button>
		)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={false}
			aria-label={`${s.label} ${title}`}
			title={s.label}
			onClick={onToggle}
			className={`flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap text-gray-400 ring-1 ring-white/10 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.idle} ${wide ? "px-3" : "w-8"}`}
		>
			{s.icon}
			{wide && s.label}
		</motion.button>
	)
}

export interface SteerState {
	has: (steer: Steer, key: TitleKey) => boolean
	toggle: (steer: Steer, key: TitleKey) => void
}

/** A title: poster, name, year and kind, and its three steering toggles. Tapping the row toggles Like this. */
export function TitleRow({
	t,
	i,
	nav,
	steer,
	phone,
}: {
	t: TitleItem
	i: number
	nav: {
		active: number
		setActive: (i: number) => void
		rowId: (i: number) => string
	}
	steer: SteerState
	phone: boolean
}) {
	const kind = parseTitleKey(t.key).mediaType === "movie" ? "Movie" : "Show"
	return (
		<Row
			id={nav.rowId(i)}
			i={i}
			active={nav.active}
			onHover={nav.setActive}
			onClick={() => steer.toggle("similarTo", t.key)}
		>
			<PosterThumb poster={t.poster} title={t.title} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">
					{t.title}
				</span>
				<span className="block text-[12px] text-gray-500">
					{[t.year, kind].filter(Boolean).join(" · ")}
				</span>
			</span>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: only keeps the toggles' clicks from the row */}
			<span
				className="flex shrink-0 items-center gap-1.5"
				onClick={(event) => event.stopPropagation()}
			>
				{(["loved", "disliked", "similarTo"] as const).map((s) => (
					<SteerToggle
						key={s}
						steer={s}
						title={t.title}
						on={steer.has(s, t.key)}
						onToggle={() => steer.toggle(s, t.key)}
						wide={s === "similarTo" && !phone}
					/>
				))}
			</span>
			<EnterKey show={nav.active === i} />
		</Row>
	)
}

/** A person: small face, name, the note, and a plus that turns into a tick. */
export function PersonRow({
	id,
	p,
	on,
	onToggle,
	active = false,
	onHover,
	i,
}: {
	id?: string
	p: PersonItem
	on: boolean
	onToggle: () => void
	/** Highlighted by the keyboard. */
	active?: boolean
	onHover?: () => void
	/** Its place in a keyboard list. */
	i?: number
}) {
	const button = (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			data-row={i}
			onClick={onToggle}
			onMouseEnter={onHover}
			className={`group flex h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg pr-2 pl-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-purple-400/[0.13]"
					: active
						? "bg-white/[0.08]"
						: "hover:bg-white/[0.05]"
			}`}
		>
			<Face
				src={p.profile}
				size={32}
				className={on ? "ring-2 ring-purple-300/80" : ""}
			/>
			<span
				className={`min-w-0 flex-1 truncate text-[14px] ${on ? "font-semibold text-white" : "text-gray-200"}`}
			>
				{p.name}
			</span>
			{p.note && (
				<span className="shrink-0 text-[12px] text-gray-500">{p.note}</span>
			)}
			<span
				className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
					on
						? "bg-purple-300 text-gray-950"
						: "text-gray-600 group-hover:bg-white/[0.08] group-hover:text-gray-200"
				}`}
				aria-hidden
			>
				{on ? (
					<CheckIcon className="h-3.5 w-3.5" />
				) : (
					<PlusIcon className="h-3.5 w-3.5" />
				)}
			</span>
		</motion.button>
	)
	return id ? (
		<div id={id} role="row" aria-selected={active}>
			<div role="gridcell" className="grid">
				{button}
			</div>
		</div>
	) : (
		button
	)
}

export function RowsLoading({
	n,
	poster = false,
}: { n: number; poster?: boolean }) {
	return (
		<>
			{Array.from({ length: n }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
					key={i}
					className="flex h-11 items-center gap-2.5 px-3"
					aria-hidden
				>
					<span
						className={`shrink-0 animate-pulse bg-white/[0.06] motion-reduce:animate-none ${poster ? "h-[38px] w-[26px] rounded-md" : "h-8 w-8 rounded-full"}`}
					/>
					<span className="h-3 w-28 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
				</div>
			))}
		</>
	)
}

/**
 * Under a group: "More titles" with "4 of 13" grows the group in place, and `right` sits quietly at the line's end.
 * Nothing while every row shows and there is nothing on the right.
 */
export function MoreLine({
	label,
	count,
	onMore,
	right,
}: {
	label: string
	count: string | null
	onMore: () => void
	right?: ReactNode
}) {
	if (!count && !right) return null
	return (
		<div className="flex h-9 min-w-0 items-center gap-2 px-3">
			{count && (
				<motion.button
					type="button"
					whileTap={TAP}
					onClick={onMore}
					className="flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-gray-200 ring-1 ring-white/10 outline-none ring-inset hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" aria-hidden />
					{label}
					<span className="font-normal text-gray-500 tabular-nums">
						{count}
					</span>
				</motion.button>
			)}
			{right && <span className="ml-auto flex min-w-0">{right}</span>}
		</div>
	)
}

/** The picked people as removable face chips joined by "or" (the filter keeps titles with any of them). */
export function PickedPeople({
	ids,
	known,
	onRemove,
	lead,
	wrap = false,
}: {
	ids: readonly number[]
	known: (id: number) => { name: string; profile: string | null } | undefined
	onRemove: (id: number) => void
	lead?: string
	wrap?: boolean
}) {
	if (!ids.length) return null
	return (
		<div
			className={`flex min-w-0 items-center gap-2 ${wrap ? "flex-wrap" : "overflow-hidden"}`}
		>
			{lead && (
				<span className="shrink-0 text-[13px] text-gray-500">{lead}</span>
			)}
			{ids.map((id, i) => {
				const p = known(id)
				return (
					<span key={id} className="flex shrink-0 items-center gap-2">
						{i > 0 && (
							<span className="text-[13px] font-semibold text-purple-200/70">
								or
							</span>
						)}
						<span className="inline-flex h-9 shrink-0 items-center rounded-full bg-purple-400/[0.14] pl-1 text-[13px] font-semibold whitespace-nowrap text-white ring-1 ring-purple-300/50 ring-inset">
							<Face src={p?.profile ?? null} size={28} />
							<span className="pl-2">{p?.name ?? "…"}</span>
							<button
								type="button"
								onClick={() => onRemove(id)}
								aria-label={`Remove ${p?.name ?? "person"}`}
								className="grid h-full w-8 cursor-pointer place-items-center rounded-r-full text-purple-200/70 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-3.5 w-3.5" />
							</button>
						</span>
					</span>
				)
			})}
		</div>
	)
}
