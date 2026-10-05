// PROTOTYPE - throwaway. Shared pieces for the round-2 Explorer variants, built from the existing components and
// round 1's kit: the peek card (score ring, match, services, Want to See / Watch next / Seen it), the shared
// filter chips, zoom controls, breadcrumbs, and the toast.
import {
	MinusIcon,
	PlusIcon,
	ViewfinderCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import type { Score } from "~/server/scores.server"
import {
	ActionButton,
	ExplorerStyles,
	Filters,
} from "~/ui/prototype-rec-explorer/kit"
import {
	MatchText,
	Ring,
	ServiceLogos,
	href,
} from "~/ui/prototype-rec-taste/kit"
import type { PoolItem } from "~/ui/prototype-rec-taste/model"
import { getVibeColorValue } from "~/utils/ratings"
import { GENERATED_CSS_2 } from "./generated-css"
import type { Item } from "./store"
import type { Ex, PeekInfo } from "./useExplorer2"

const TMDB = "https://image.tmdb.org/t/p"
export const asPool = (it: Item) =>
	({
		key: it.k,
		type: it.k.startsWith("show") ? "show" : "movie",
		id: Number(it.k.split("-")[1]),
		title: it.t,
		year: it.yr,
		score: it.s,
		services: it.a,
		poster: "",
		backdrop: "",
		genres: it.g,
		fp: [],
		directors: [],
		synopsis: "",
		tags: [],
	}) as PoolItem

export function Actions({ ex, it }: { ex: Ex; it: Item }) {
	return (
		<div className="grid grid-cols-3 gap-1.5">
			<ActionButton
				compact
				kind="want"
				active={!!(it.f & 4)}
				onClick={() => ex.actions.want(it)}
			/>
			<ActionButton
				compact
				kind="next"
				active={ex.queue.has(it.k)}
				onClick={() => ex.actions.next(it)}
			/>
			<ActionButton
				compact
				kind="seen"
				active={!!(it.f & 2)}
				onClick={() => ex.actions.seen(it)}
			/>
		</div>
	)
}

/** The peek card: poster, score ring, match with a reason, who made it, services, and the three actions. */
export function Peek({
	ex,
	it,
	onClose,
	extra,
	wide = false,
}: {
	ex: Ex
	it: Item
	onClose: () => void
	extra?: ReactNode
	wide?: boolean
}) {
	const [info, setInfo] = useState<PeekInfo | null>(null)
	useEffect(() => {
		let live = true
		setInfo(null)
		ex.peekInfo(it.k).then((x) => live && setInfo(x))
		return () => {
			live = false
		}
	}, [it.k])
	const pi = asPool(it)
	return (
		<div
			className={`relative overflow-hidden rounded-2xl border border-white/10 rx-card shadow-2xl backdrop-blur ${wide ? "w-full" : "rx-peek"}`}
		>
			{it.b && (
				<img
					src={`${TMDB}/w780${it.b}`}
					alt=""
					className="absolute inset-x-0 top-0 h-28 w-full object-cover opacity-30 rx-fade-top"
				/>
			)}
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-gray-300 hover:text-white"
			>
				<XMarkIcon className="h-4 w-4" />
			</button>
			<div className="relative flex gap-3 p-3">
				<Link to={href(pi)} className="shrink-0">
					<img
						src={`${TMDB}/w185${it.p}`}
						alt={`Poster for ${it.t}`}
						className="h-36 w-24 rounded-md border-2 border-gray-800 object-cover"
					/>
				</Link>
				<div className="min-w-0 flex-1 pt-1">
					<Link
						to={href(pi)}
						className="block pr-6 text-lg font-bold leading-tight text-white hover:underline"
					>
						{it.t}
					</Link>
					<p className="text-xs text-gray-400">
						{it.yr} {pi.type === "show" ? "series" : "film"}
						{it.g.length
							? `, ${it.g.slice(0, 2).join(", ").toLowerCase()}`
							: ""}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<Ring item={pi} size={40} />
						{it.r ? (
							<span
								className="text-sm font-bold"
								style={{ color: getVibeColorValue(it.r as Score) }}
							>
								You rated it {it.r}
							</span>
						) : (
							<MatchText match={it.m} className="text-sm" />
						)}
					</div>
					<p className="mt-1.5 line-clamp-2 min-h-8 text-xs text-gray-300">
						{info ? info.why : " "}
					</p>
					{info?.people.length ? (
						<p className="text-xs text-gray-400">
							{info.role} {info.people.join(" and ")}
						</p>
					) : null}
				</div>
			</div>
			<div className="relative flex flex-col gap-2 px-3 pb-3">
				<ServiceLogos item={pi} services={ex.services} size="w-6 h-6" />
				<Actions ex={ex} it={it} />
				{extra}
			</div>
		</div>
	)
}

/** Desktop: a card at the top right. Phone: a sheet above the switcher. */
export function PeekDock({
	ex,
	it,
	onClose,
	extra,
}: { ex: Ex; it: Item | null; onClose: () => void; extra?: ReactNode }) {
	if (!it) return null
	return (
		<>
			<div className="absolute right-4 top-4 z-20 hidden md:block">
				<Peek ex={ex} it={it} onClose={onClose} extra={extra} />
			</div>
			<div className="absolute inset-x-3 bottom-16 z-20 md:hidden">
				<Peek ex={ex} it={it} wide onClose={onClose} extra={extra} />
			</div>
		</>
	)
}

export function FilterChips({
	ex,
	className = "",
}: { ex: Ex; className?: string }) {
	return (
		<Filters
			ex={{ ...ex, filterMode: "hide", setFilterMode: () => {} } as never}
			showMode={false}
			className={className}
		/>
	)
}

export function WhoNote({
	ex,
	className = "",
	extra,
}: { ex: Ex; className?: string; extra?: string }) {
	const [params] = useSearchParams()
	const w = ex.who
	const other = new URLSearchParams(params)
	other.set("as", w.mode === "me" ? "demo" : "me")
	return (
		<p className={`text-xs text-gray-400 ${className}`}>
			{w.mode === "me"
				? `Your ${w.rated} ratings`
				: `Demo member with ${w.rated} ratings`}
			{w.demoServices ? ", demo services" : ", your services"} in {w.country}.{" "}
			{extra}
			{w.signedIn && (
				<Link
					to={`?${other}`}
					reloadDocument
					className="rx-ml underline underline-offset-2 hover:text-white"
				>
					{w.mode === "me" ? "Switch to the demo member" : "Use my profile"}
				</Link>
			)}
		</p>
	)
}

/** The atlas header: title, one line of help, the two filter chips, who it's for. */
export function Header({
	ex,
	title,
	sub,
	note,
	children,
}: {
	ex: Ex
	title: string
	sub: ReactNode
	note?: string
	children?: ReactNode
}) {
	return (
		<div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-4 pb-10 pt-3 md:px-8 md:pt-4">
			<h1 className="text-2xl font-bold tracking-tight md:text-5xl">{title}</h1>
			<p className="mt-1 max-w-xl text-sm text-gray-300 md:text-base">{sub}</p>
			<div className="pointer-events-auto mt-3">
				<FilterChips ex={ex} />
				<WhoNote ex={ex} className="mt-2" extra={note} />
				{children}
			</div>
		</div>
	)
}

export function ZoomControls({
	onIn,
	onOut,
	onYou,
	youLabel = "Back to you",
	className = "",
}: {
	onIn: () => void
	onOut: () => void
	onYou?: () => void
	youLabel?: string
	className?: string
}) {
	const btn =
		"flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-white/15"
	return (
		<div className={`flex flex-col items-end gap-2 ${className}`}>
			{onYou && (
				<button
					type="button"
					onClick={onYou}
					className="flex h-10 items-center gap-2 rounded-full border rx-you-btn bg-black/70 px-3 text-sm font-semibold backdrop-blur"
				>
					<ViewfinderCircleIcon className="h-5 w-5" />
					{youLabel}
				</button>
			)}
			<div className="flex gap-2">
				<button
					type="button"
					aria-label="Zoom out"
					onClick={onOut}
					className={btn}
				>
					<MinusIcon className="h-5 w-5" />
				</button>
				<button
					type="button"
					aria-label="Zoom in"
					onClick={onIn}
					className={btn}
				>
					<PlusIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}

export function Toast({ ex }: { ex: Ex }) {
	if (!ex.toast) return null
	return (
		<div
			role="status"
			className="pointer-events-none fixed left-1/2 top-20 rx-toast -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-2xl"
		>
			{ex.toast}
		</div>
	)
}

/** A trail of small posters or names you can jump back to. */
export function Crumbs({
	items,
	onPick,
	label,
	className = "",
}: {
	items: { key: string; poster?: string; name: string; current?: boolean }[]
	onPick: (k: number) => void
	label: string
	className?: string
}) {
	if (!items.length) return null
	return (
		<nav
			aria-label={label}
			className={`flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-black/70 p-1.5 backdrop-blur ${className}`}
		>
			{items.map((c, k) => (
				<button
					key={c.key}
					type="button"
					onClick={() => onPick(k)}
					title={c.name}
					aria-current={c.current ? "step" : undefined}
					className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full pr-3 text-xs font-semibold ${c.poster ? "pl-0.5" : "pl-3"} ${c.current ? "bg-amber-500 text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`}
				>
					{c.poster && (
						<img
							src={c.poster}
							alt=""
							className="h-8 w-6 rounded-sm object-cover"
						/>
					)}
					<span className="max-w-28 truncate">{c.name}</span>
				</button>
			))}
		</nav>
	)
}

const CSS = `
.rx2-stage{position:relative;height:calc(100vh - 8rem);overflow:hidden}
@media (min-width:1024px){.rx2-stage{height:calc(100vh - 4rem)}}
.rx2-display{font-family:'Big Shoulders Display','Gabarito',system-ui,sans-serif;letter-spacing:.01em}
.rx2-bottom{bottom:5.25rem}
@media (min-width:768px){.rx2-bottom{bottom:4.5rem}}
@media (min-width:1024px){.rx2-bottom{bottom:4.5rem}}
.rx2-scroll-x{scrollbar-width:none}
.rx2-scroll-x::-webkit-scrollbar{display:none}
`
export function Styles() {
	return (
		<>
			<ExplorerStyles />
			<style dangerouslySetInnerHTML={{ __html: CSS + GENERATED_CSS_2 }} />
		</>
	)
}
