// PROTOTYPE - throwaway. Shared bits for /prototype/rec-taste-3, on top of round 2's kit.
import { Link } from "@remix-run/react"
import { createContext, type ReactNode, useContext } from "react"
import {
	PosterCard,
	RatedPoster,
	href,
	itemsOf,
	poster,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Frontier, Payload3, Ref, Side, Title } from "./model"

export * from "~/ui/prototype-rec-taste-2/kit"

export type View3Props = { data: Payload3 }

/** The condensed display face the bolder variants use; loaded once by the route. */
export const CONDENSED = {
	fontFamily: "'Archivo', sans-serif",
	fontStretch: "68%",
} as const

/** Which shell the page sits in, so a section's heading can take the shell's voice. */
export const ShellContext = createContext<string>("tabs")
export const useShell = () => useContext(ShellContext)

/** Jump to a section of the Taste page, however the current shell navigates. */
export const GoContext = createContext<(section: string) => void>(() => {})
export const useGo = () => useContext(GoContext)

/** Unseen picks with the ones on the person's services first. */
export function mineFirst(data: Payload3, refs: Ref[]) {
	const mine = new Set(data.services.filter((s) => s.mine).map((s) => s.id))
	const on = (r: Ref) =>
		data.items[r.key]?.services.some((id) => mine.has(id)) ? 1 : 0
	return [...refs].sort((a, b) => on(b) - on(a))
}

export type SideView = {
	side: Side
	loved: Title[]
	heart: Title | undefined
	edge: Payload3["edges"][string]
	edgePicks: (Title & { match: number })[]
	further: Frontier[]
}

/** Everything a Sides variant needs about one side: what you love there, and what's just past it. */
export function sideViews(data: Payload3): SideView[] {
	return data.report.sides.map((side) => {
		const loved = itemsOf(data, side.titles)
		const edge = data.edges[side.id] ?? null
		const refs = edge ? mineFirst(data, edge.picks) : []
		return {
			side,
			loved,
			heart: loved[0],
			edge,
			edgePicks: refs
				.map((r) => data.items[r.key] && { ...data.items[r.key], match: r.match })
				.filter((t): t is Title & { match: number } => !!t),
			further: (data.further[side.id] ?? [])
				.map((id) => data.report.frontiers.find((f) => f.id === id))
				.filter((f): f is Frontier => !!f),
		}
	})
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

/** One unseen pick as the app's poster card, linked to its page. */
export function Pick({
	data,
	t,
	match,
	className = "",
}: { data: Payload3; t: Title; match?: number; className?: string }) {
	return (
		<Link to={href(t)} className={`block ${className}`}>
			<PosterCard item={t} services={data.services} match={match} />
		</Link>
	)
}

/** A plain poster without chrome, for dense or decorative rows. */
export function Plain({
	t,
	className = "",
	size = "w342",
	linked = true,
}: {
	t: Title
	className?: string
	size?: "w185" | "w342" | "w500"
	linked?: boolean
}) {
	const img = (
		<img
			src={poster(t, size)}
			alt={`Poster for ${t.title}`}
			className="block aspect-[2/3] w-full rounded-md object-cover"
			loading="lazy"
			draggable={false}
		/>
	)
	return linked ? (
		<Link to={href(t)} className={`block ${className}`} title={t.title}>
			{img}
		</Link>
	) : (
		<div className={className}>{img}</div>
	)
}

export { RatedPoster }

/** A section's heading: one line of title, one of context. */
export function Head({
	title,
	sub,
	right,
	className = "",
}: {
	title: ReactNode
	sub?: ReactNode
	right?: ReactNode
	className?: string
}) {
	const big = useShell() === "chapters"
	return (
		<div
			className={`flex flex-wrap items-end justify-between gap-4 ${className}`}
		>
			<div className="min-w-0 max-w-4xl">
				<h2
					className={
						big
							? "text-5xl font-extrabold leading-[0.95] text-white md:text-7xl"
							: "text-3xl font-bold leading-tight text-white md:text-4xl"
					}
					style={big ? CONDENSED : undefined}
				>
					{title}
				</h2>
				{sub && <p className="mt-2 text-lg text-gray-400">{sub}</p>}
			</div>
			{right}
		</div>
	)
}

/** The frame every section sits in: centered, generous vertical rhythm. */
export function Frame({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	return (
		<div className={`mx-auto w-full max-w-7xl px-4 md:px-8 ${className}`}>
			{children}
		</div>
	)
}

/** "You're here" and "Just past it" read the same way in every Sides variant: amber home, sky edge. */
export const HOME = "text-amber-300"
export const EDGE = "text-sky-300"
