// PROTOTYPE - throwaway. Shared pieces for the round-3 Explorer variants, built from round 2's kit and the existing
// components: the peek card (score ring, match, reason, services, Want to See / Seen it, and "Go this way"), the
// header with the two shared filter chips, a poster, and the compact path.
import { ArrowRightIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import type { Score } from "~/server/scores.server"
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import { FilterChips, Styles, WhoNote } from "~/ui/prototype-rec-explorer-2/kit2"
import type { Ex } from "~/ui/prototype-rec-explorer-2/useExplorer2"
import { ActionButton } from "~/ui/prototype-rec-explorer/kit"
import {
	MatchText,
	Ring,
	ServiceLogos,
	href,
} from "~/ui/prototype-rec-taste/kit"
import type { PoolItem } from "~/ui/prototype-rec-taste/model"
import { getVibeColorValue } from "~/utils/ratings"
import { GENERATED_CSS_3 } from "./generated-css"
import type { Ex3, Step } from "./useExplorer3"
import type { PeekInfo, W } from "./wire"

export const TMDB = "https://image.tmdb.org/t/p"
export const heat = (m: number) => HEAT[m] ?? HEAT[50]

export const asPool = (it: W) =>
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

// Round 2's filter chips and who-note read the same fields this page's state has.
const as2 = (ex: Ex3) => ex as unknown as Ex

/** Want to See and Seen it. Want to See is the only interest signal. */
export function Actions({ ex, it }: { ex: Ex3; it: W }) {
	return (
		<div className="grid grid-cols-2 gap-1.5">
			<ActionButton
				compact
				kind="want"
				active={!!(it.f & 4)}
				onClick={() => ex.actions.want(it)}
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

/** The peek card: poster, score ring, match with a reason, who made it, services, the actions, and where it leads. */
export function Peek({
	ex,
	it,
	onClose,
	go,
	wide = false,
}: {
	ex: Ex3
	it: W
	onClose: () => void
	go?: { label: string; line?: string; onGo: () => void }
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
						{info ? info.why : " "}
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
				{go && (
					<button
						type="button"
						onClick={go.onGo}
						className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 text-sm font-bold text-black hover:bg-amber-300"
					>
						{go.label}
						<ArrowRightIcon className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	)
}

/** Desktop: a card at the top right. Phone: a sheet above the switcher. */
export function PeekDock({
	ex,
	it,
	onClose,
	go,
}: {
	ex: Ex3
	it: W | null
	onClose: () => void
	go?: { label: string; onGo: () => void }
}) {
	if (!it) return null
	return (
		<>
			<div className="fixed right-4 top-20 z-40 hidden md:block">
				<Peek ex={ex} it={it} onClose={onClose} go={go} />
			</div>
			<div className="fixed inset-x-3 bottom-20 z-40 md:hidden">
				<Peek ex={ex} it={it} wide onClose={onClose} go={go} />
			</div>
		</>
	)
}

/** Title, one line, the two filter chips, who it's for. */
export function Top({
	ex,
	title,
	sub,
	bold = false,
	children,
	className = "",
}: {
	ex: Ex3
	title: ReactNode
	sub: ReactNode
	bold?: boolean
	children?: ReactNode
	className?: string
}) {
	return (
		<header className={`relative z-10 ${className}`}>
			<h1
				className={
					bold
						? "rx2-display text-5xl font-black leading-none text-amber-400 md:text-6xl"
						: "text-3xl font-bold tracking-tight md:text-5xl"
				}
			>
				{title}
			</h1>
			<p className="mt-2 max-w-xl text-sm text-gray-300 md:text-base">{sub}</p>
			<div className="mt-3">
				<FilterChips ex={as2(ex)} />
				<WhoNote ex={as2(ex)} className="mt-2" />
			</div>
			{children}
		</header>
	)
}

/** A poster you can tap for the peek. Rings: your rating in its vibe color, Want to See amber. */
export function Poster({
	it,
	onPeek,
	size = "w-28",
	className = "",
	src = "w342",
	eager = false,
}: {
	it: W
	onPeek?: (it: W) => void
	size?: string
	className?: string
	src?: "w154" | "w185" | "w342" | "w500"
	eager?: boolean
}) {
	const ring = it.r
		? getVibeColorValue(it.r as Score)
		: it.f & 4
			? "#f59e0b"
			: "transparent"
	return (
		<button
			type="button"
			onClick={() => onPeek?.(it)}
			aria-label={`${it.t}, ${it.yr}`}
			className={`group relative block shrink-0 overflow-hidden rounded-md bg-stone-800 ${size} ${className}`}
			style={{ aspectRatio: "2 / 3", boxShadow: `0 0 0 2px ${ring}` }}
		>
			{it.p && (
				<img
					src={`${TMDB}/${src}${it.p}`}
					alt=""
					loading={eager ? "eager" : "lazy"}
					decoding="async"
					className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
				/>
			)}
		</button>
	)
}

/** Title, year, and match under a poster. */
export function Caption({ it, className = "" }: { it: W; className?: string }) {
	return (
		<div className={`min-w-0 ${className}`}>
			<p className="truncate text-sm font-semibold text-stone-100">{it.t}</p>
			<p className="flex items-center gap-2 text-xs">
				<span className="font-bold" style={{ color: heat(it.m) }}>
					{it.m}% your taste
				</span>
				<span className="text-stone-400">{it.yr || ""}</span>
			</p>
		</div>
	)
}

/** The path so far, compact: small posters joined by the turn that led there. Tap one to stand there again. */
export function PathStrip({
	path,
	onPick,
	className = "",
	start = "Your taste",
}: {
	path: Step[]
	onPick?: (n: number) => void
	className?: string
	start?: string | null
}) {
	if (!path.length) return null
	return (
		<nav
			aria-label="Your path"
			className={`rx2-scroll-x flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/75 py-1.5 pl-3 pr-1.5 backdrop-blur ${className}`}
		>
			{start && (
				<span className="shrink-0 pr-1 text-xs font-semibold text-amber-300">
					{start}
				</span>
			)}
			{path.map((s, n) => {
				const current = n === path.length - 1
				return (
					<span key={`${s.w.k}-${n}`} className="flex shrink-0 items-center gap-1">
						{(n > 0 || start) && (
							<span className="max-w-24 truncate text-xs text-stone-400" title={s.label}>
								{s.label ? `${s.label} →` : "→"}
							</span>
						)}
						<button
							type="button"
							onClick={() => onPick?.(n)}
							aria-current={current ? "step" : undefined}
							title={s.w.t}
							className={`flex h-9 items-center gap-1.5 rounded-full pl-0.5 pr-2.5 text-xs font-semibold ${current ? "bg-amber-400 text-black" : "bg-white/10 text-stone-200 hover:bg-white/20"}`}
						>
							<img
								src={`${TMDB}/w92${s.w.p}`}
								alt=""
								className="h-8 w-6 rounded-sm object-cover"
							/>
							<span className="max-w-28 truncate">{s.w.t}</span>
						</button>
					</span>
				)
			})}
		</nav>
	)
}

export function Toast3({ ex }: { ex: Ex3 }) {
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

/** Shown while the next turn loads, or when filters leave nothing. */
export function Empty({ ex, busy }: { ex: Ex3; busy: boolean }) {
	if (busy)
		return <p className="py-10 text-center text-sm text-stone-400">Finding the next turns…</p>
	return (
		<div className="py-10 text-center text-sm text-stone-300">
			<p>Nothing new this way with these filters.</p>
			{ex.onlyMine && (
				<button
					type="button"
					onClick={() => ex.setOnlyMine(false)}
					className="mt-2 underline underline-offset-2 hover:text-white"
				>
					Look beyond your services
				</button>
			)}
		</div>
	)
}

const CSS3 = `
.rx3-page{position:relative;min-height:calc(100vh - 8rem);overflow-x:hidden}
@media (min-width:1024px){.rx3-page{min-height:calc(100vh - 4rem)}}
.rx3-in{animation:rx3in .45s cubic-bezier(.2,.7,.2,1) both}
.rx3-in-2{animation-delay:.07s}.rx3-in-3{animation-delay:.14s}.rx3-in-4{animation-delay:.21s}
@keyframes rx3in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.rx3-atlas{background:radial-gradient(ellipse at 50% 30%,#1c1917 0%,#0c0a09 55%,#000 100%)}
.rx3-veil{background:linear-gradient(to bottom,rgba(12,10,9,.35),rgba(12,10,9,.75) 45%,#0c0a09 92%)}
.rx3-veil-x{background:linear-gradient(to right,#0c0a09 0%,rgba(12,10,9,.85) 40%,rgba(12,10,9,.2) 100%)}
.rx3-pb{padding-bottom:9rem}
@media (min-width:1024px){.rx3-pb{padding-bottom:5.5rem}}
.rx3-zoom{transition:transform .6s cubic-bezier(.3,.7,.2,1),opacity .6s ease}
@media (prefers-reduced-motion:reduce){.rx3-in{animation:none}.rx3-zoom{transition:none}}
`
export function Styles3() {
	return (
		<>
			<Styles />
			<style dangerouslySetInnerHTML={{ __html: CSS3 + GENERATED_CSS_3 }} />
		</>
	)
}
