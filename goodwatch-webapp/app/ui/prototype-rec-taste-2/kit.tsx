// PROTOTYPE - throwaway. Shared bits for /prototype/rec-taste-2, on top of round 1's kit (poster card,
// score ring, service logos). Posters stay plain <img>s so the prototype sends no poster impressions.
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import {
	MatchText,
	PosterCard,
	Ring,
	ServiceLogos,
	href,
} from "~/ui/prototype-rec-taste/kit"
import type { Attr, Payload, Ref, Report, Service, Title } from "./model"

export { MatchText, PosterCard, Ring, ServiceLogos, href }

export type ViewProps = { data: Payload }

export const vibe = (score10: number) =>
	`var(--color-vibe-${Math.max(0, Math.min(100, Math.round(score10) * 10))})`

export const poster = (
	t: Title,
	size: "w185" | "w342" | "w500" | "w780" = "w342",
) => t.poster.replace("/w342/", `/${size}/`)
export const backdrop = (t: Title, size: "w780" | "w1280" = "w1280") =>
	t.backdrop.replace("/w1280/", `/${size}/`)

export const itemsOf = (data: Payload, keys: string[]) =>
	keys.map((k) => data.items[k]).filter((t): t is Title => !!t)
export const attrOf = (data: Payload, key: string) =>
	data.report.vector.find((a) => a.key === key) as Attr

/** Your own score as the app draws a rating: a vibe-colored tile with the number. */
export function YourScore({
	score,
	size = "md",
	label,
}: { score: number; size?: "sm" | "md" | "lg"; label?: string }) {
	const dim =
		size === "lg"
			? "h-12 min-w-12 text-2xl"
			: size === "sm"
				? "h-6 min-w-6 text-xs"
				: "h-9 min-w-9 text-base"
	return (
		<span className="inline-flex items-center gap-2">
			<span
				className={`inline-flex items-center justify-center rounded-md px-1.5 font-extrabold tabular-nums text-white ${dim}`}
				style={{ background: vibe(score) }}
			>
				{score}
			</span>
			{label && (
				<span className="text-xs leading-tight text-gray-300">{label}</span>
			)}
		</span>
	)
}

/** Which data the page is showing, with a one-tap switch between your real data and the demo member. */
export function DataBadge({ who }: { who: Report["who"] }) {
	const [params] = useSearchParams()
	const other = new URLSearchParams(params)
	other.set("as", who.mode === "me" ? "demo" : "me")
	return (
		<div className="fixed right-2 top-16 z-40 max-w-[60vw] rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs text-gray-200 backdrop-blur lg:bottom-3 lg:left-3 lg:right-auto lg:top-auto">
			{who.mode === "me" ? (
				<>
					Your real data, read-only: {who.rated} ratings.{" "}
					<Link
						to={`?${other}`}
						className="font-semibold text-amber-300 underline underline-offset-2"
					>
						Show demo
					</Link>
				</>
			) : (
				<>
					{who.fellBack
						? "Not signed in, so this is the demo member."
						: "Demo member."}{" "}
					<Link
						to={`?${other}`}
						className="font-semibold text-amber-300 underline underline-offset-2"
					>
						Use my data
					</Link>
				</>
			)}
		</div>
	)
}

/** "On my services" on by default, one tap to everywhere. Local state only. */
export function useOnMine(data: Payload) {
	const [onlyMine, setOnlyMine] = useState(true)
	const mine = data.services.filter((s) => s.mine).map((s) => s.id)
	const filter = (refs: Ref[]) =>
		onlyMine
			? refs.filter((r) =>
					data.items[r.key]?.services.some((s) => mine.includes(s)),
				)
			: refs
	return {
		onlyMine,
		toggle: () => setOnlyMine((v) => !v),
		filter,
		services: data.services,
	}
}

export function ServicesSwitch({
	state,
	className = "",
}: { state: ReturnType<typeof useOnMine>; className?: string }) {
	const mine = state.services.filter((s) => s.mine)
	return (
		<button
			type="button"
			onClick={state.toggle}
			aria-pressed={state.onlyMine}
			className={`inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${state.onlyMine ? "border-amber-600/70 bg-amber-900/30 text-amber-100" : "border-gray-700 bg-gray-900 text-gray-300"} ${className}`}
		>
			<span className="flex -space-x-1.5">
				{mine.slice(0, 4).map((s) => (
					<img
						key={s.id}
						src={s.logo}
						alt=""
						className={`h-5 w-5 rounded-md ring-2 ring-gray-950 ${state.onlyMine ? "" : "opacity-60 grayscale"}`}
					/>
				))}
			</span>
			{state.onlyMine ? "On my services" : "Everywhere"}
		</button>
	)
}

/** A row of unseen picks as poster cards with taste match. */
export function PickRow({
	data,
	refs,
	n = 6,
	empty = "Nothing on your services here yet. Switch to Everywhere.",
	cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
}: { data: Payload; refs: Ref[]; n?: number; empty?: string; cols?: string }) {
	const shown = refs.slice(0, n)
	if (!shown.length)
		return <p className="py-6 text-sm text-gray-400">{empty}</p>
	return (
		<div className={`grid gap-3 ${cols}`}>
			{shown.map((r) => {
				const t = data.items[r.key]
				return t ? (
					<Link key={r.key} to={href(t)} className="block">
						<PosterCard item={t} services={data.services} match={r.match} />
					</Link>
				) : null
			})}
		</div>
	)
}

/** A plain poster with the person's own score in the corner, for titles they have rated. */
export function RatedPoster({
	t,
	className = "",
	size = "w342",
	showScore = true,
}: {
	t: Title
	className?: string
	size?: "w185" | "w342" | "w500"
	showScore?: boolean
}) {
	return (
		<Link
			to={href(t)}
			className={`relative block overflow-hidden rounded-md border-2 border-gray-800 bg-gray-900 ${className}`}
			title={t.title}
		>
			<img
				src={poster(t, size)}
				alt={`Poster for ${t.title}`}
				className="block aspect-[2/3] w-full object-cover"
				loading="lazy"
				draggable={false}
			/>
			{showScore && t.mine != null && (
				<span className="absolute right-1 top-1">
					<YourScore score={t.mine} size="sm" />
				</span>
			)}
		</Link>
	)
}

/** The fingerprint as a signature: 74 thin bars in fingerprint order, above the line for more, below for less. */
export function Signature({
	vector,
	other,
	height = 120,
	selected,
	onSelect,
	className = "",
}: {
	vector: Attr[]
	other?: number[]
	height?: number
	selected?: string | null
	onSelect?: (key: string) => void
	className?: string
}) {
	const max = Math.max(
		0.01,
		...vector.map((a) => Math.abs(a.value)),
		...(other ?? []).map(Math.abs),
	)
	const half = height / 2
	return (
		<div
			className={`flex w-full items-stretch gap-[2px] ${className}`}
			style={{ height }}
			role="group"
			aria-label="Your taste signature"
		>
			{vector.map((a, i) => {
				const h = (Math.abs(a.value) / max) * (half - 2)
				const oh = other ? (Math.abs(other[i]) / max) * (half - 2) : 0
				const on = selected === a.key
				return (
					<button
						key={a.key}
						type="button"
						onClick={() => onSelect?.(a.key)}
						title={`${a.label}: ${a.value > 0 ? "more" : "less"} than most titles`}
						aria-label={a.label}
						aria-pressed={on}
						className="relative min-w-0 flex-1 cursor-pointer"
					>
						<span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
						{other && (
							<span
								className="absolute inset-x-0 rounded-sm border border-white/50"
								style={
									other[i] >= 0
										? { bottom: half, height: oh }
										: { top: half, height: oh }
								}
							/>
						)}
						<span
							className="absolute inset-x-0 rounded-sm transition-all"
							style={{
								...(a.value >= 0
									? { bottom: half, height: h }
									: { top: half, height: h }),
								background: a.color.replace(/[\d.]+\)$/, on ? "1)" : "0.85)"),
								outline: on ? "2px solid white" : undefined,
								opacity: selected && !on ? 0.45 : 1,
							}}
						/>
					</button>
				)
			})}
		</div>
	)
}

/** Labels under a Signature, sized to the fingerprint's five groups (13, 7, 20, 19 and 15 attributes). */
export function SignatureGroups({ className = "" }: { className?: string }) {
	const groups: [string, number][] = [
		["Feelings", 13],
		["Humor", 7],
		["Worlds and themes", 20],
		["Story", 19],
		["Craft and style", 15],
	]
	return (
		<div
			className={`mt-2 flex gap-[2px] text-[11px] text-gray-500 ${className}`}
		>
			{groups.map(([name, n]) => (
				<span
					key={name}
					className="min-w-0 truncate border-t border-white/15 pt-1"
					style={{ flex: n }}
				>
					{name}
				</span>
			))}
		</div>
	)
}

export function Section({
	title,
	sub,
	right,
	children,
	className = "",
}: {
	title: ReactNode
	sub?: ReactNode
	right?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<section className={`mx-auto max-w-7xl px-4 md:px-8 ${className}`}>
			<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
					{sub && <p className="mt-1 text-gray-400">{sub}</p>}
				</div>
				{right}
			</div>
			{children}
		</section>
	)
}

export const list = (xs: string[]) =>
	xs.length > 1
		? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`
		: (xs[0] ?? "")
export type { Service }

/** Where the variant switcher sits: above the app's mobile bottom nav below lg, at the bottom on desktop. */
export const SWITCHER_POSITION =
	"bottom-20 lg:bottom-3 left-1/2 -translate-x-1/2 scale-90 origin-bottom"
