// PROTOTYPE - throwaway. Shared bits for /prototype/rec-fingerprint: words for an attribute, the diverging
// edge bar, and the attribute detail (meaning, you vs everyone, and the titles that carry it for you).
// Posters come from round 2's kit (plain <img>s, so the prototype sends no poster impressions).
import type { ReactNode } from "react"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"
import {
	AVOID,
	CROWD,
	type FpAttr,
	type FpPayload,
	SEEK,
	TIER_WORDS,
	type Title,
} from "./model"

export type ViewProps = { data: FpPayload }

export const DISPLAY =
	"'Big Shoulders Display', 'Arial Narrow', system-ui, sans-serif"
export const DISPLAY_FONT =
	"https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&display=swap"

export const itemsOf = (data: FpPayload, keys: string[]) =>
	keys.map((k) => data.items[k]).filter((t): t is Title => !!t)
export const attrOf = (data: FpPayload, key: string) =>
	data.attrs.find((a) => a.key === key) as FpAttr
export const maxEdge = (data: FpPayload) =>
	Math.max(0.01, ...data.attrs.map((a) => Math.abs(a.edge)))
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const list = (xs: string[]) =>
	xs.length > 1
		? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`
		: (xs[0] ?? "")
export const colorOf = (edge: number) => (edge >= 0 ? SEEK : AVOID)
export const firstName = (data: FpPayload) =>
	data.who.mode === "me" ? data.who.name : "The demo member"

/** How often it shows up for you against everyone, as a ratio people can say out loud. */
export function ratioWords(a: FpAttr) {
	if (a.crowdShare < 0.01 || a.n < 3) return null
	const r = a.share / a.crowdShare
	if (r >= 1.25) return `${r >= 3 ? Math.round(r) : r.toFixed(1)}× as often as most people`
	if (r >= 1.08) return "a bit more often than most people"
	if (r <= 0.92)
		return r < 0.05
			? "almost never, unlike most people"
			: `${Math.round((1 - r) * 100)}% less often than most people`
	return "about as often as most people"
}

export function liftWords(a: FpAttr) {
	if (a.lift == null) return null
	if (a.lift >= 0.2) return `you rate them ${a.lift.toFixed(1)} above your usual`
	if (a.lift <= -0.2) return `you rate them ${Math.abs(a.lift).toFixed(1)} below your usual`
	return "you rate them about as usual"
}

/** One sentence that says what the numbers mean for this person. */
export function stanceLine(a: FpAttr) {
	const ratio = ratioWords(a)
	const lift = liftWords(a)
	if (!ratio && !lift) return "Too few of your titles carry it to say more."
	if (ratio && lift) return `You watch ${a.noun} ${ratio}, and ${lift}.`
	return ratio ? `You watch ${a.noun} ${ratio}.` : `${cap(a.noun)}: ${lift}.`
}

/** A diverging bar around "as much as most people": right is more, left is less. */
export function EdgeBar({
	a,
	max,
	className = "h-2",
	muted = false,
}: { a: FpAttr; max: number; className?: string; muted?: boolean }) {
	const w = Math.min(50, (Math.abs(a.edge) / max) * 50)
	return (
		<span className={`relative block w-full ${className}`} aria-hidden>
			<span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
			<span
				className="absolute inset-y-0 rounded-full"
				style={{
					background: colorOf(a.edge),
					opacity: muted ? 0.45 : 1,
					width: `${w}%`,
					...(a.edge >= 0 ? { left: "50%" } : { right: "50%" }),
				}}
			/>
		</span>
	)
}

export function TierTag({ a }: { a: FpAttr }) {
	return (
		<span
			className="inline-flex items-center gap-1.5 text-sm font-semibold"
			style={{ color: a.tier === 0 ? CROWD : colorOf(a.edge) }}
		>
			<span
				className="h-2 w-2 rounded-full"
				style={{ background: a.tier === 0 ? CROWD : colorOf(a.edge) }}
			/>
			{TIER_WORDS[a.tier]}
		</span>
	)
}

/** Share of your titles against share of everyone's, on one 0-100% axis. */
export function ShareDumbbell({ a, max }: { a: FpAttr; max: number }) {
	const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`
	const lo = Math.min(a.share, a.crowdShare)
	const hi = Math.max(a.share, a.crowdShare)
	return (
		<span className="relative block h-4 w-full" aria-hidden>
			<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
			<span
				className="absolute top-1/2 h-0.5 -translate-y-1/2"
				style={{
					left: x(lo),
					width: `calc(${x(hi)} - ${x(lo)})`,
					background: colorOf(a.share - a.crowdShare),
					opacity: 0.5,
				}}
			/>
			<span
				className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-950"
				style={{ left: x(a.crowdShare), background: CROWD }}
			/>
			<span
				className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-950"
				style={{ left: x(a.share), background: colorOf(a.share - a.crowdShare) }}
			/>
		</span>
	)
}

export function PosterRow({
	data,
	keys,
	n = 6,
	cols = "grid-cols-3 sm:grid-cols-6",
	empty,
}: {
	data: FpPayload
	keys: string[]
	n?: number
	cols?: string
	empty?: ReactNode
}) {
	const ts = itemsOf(data, keys).slice(0, n)
	if (!ts.length)
		return empty ? <p className="text-sm text-gray-500">{empty}</p> : null
	return (
		<div className={`grid gap-2.5 ${cols}`}>
			{ts.map((t) => (
				<RatedPoster key={t.key} t={t} size="w185" />
			))}
		</div>
	)
}

/** Everything about one attribute, from plain meaning down to the titles. */
export function AttrDetail({
	data,
	a,
	compact = false,
}: { data: FpPayload; a: FpAttr; compact?: boolean }) {
	const ex = a.exception ? data.items[a.exception] : null
	const sought = a.edge >= 0
	return (
		<div>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-2xl font-bold text-white md:text-3xl">{a.label}</h3>
				<TierTag a={a} />
			</div>
			<p className="mt-1 text-gray-400">{a.meaning}</p>
			<p className="mt-3 max-w-prose text-lg text-gray-100">{stanceLine(a)}</p>
			<div className="mt-5">
				<p className="mb-2 text-sm font-semibold text-gray-300">
					{sought || !a.against.length
						? "Titles that carry it for you"
						: "Where it lost you"}
				</p>
				<PosterRow
					data={data}
					keys={sought || !a.against.length ? a.carriers : a.against}
					n={compact ? 4 : 6}
					cols={compact ? "grid-cols-4" : "grid-cols-3 sm:grid-cols-6"}
					empty="None of your rated titles carries it strongly."
				/>
			</div>
			{ex && (
				<p className="mt-4 text-sm text-gray-300">
					{sought ? "The exception: " : "Except "}
					<span className="font-semibold text-white">{ex.title}</span>
					{sought
						? `, which has plenty of it and got a ${ex.mine} from you.`
						: `, which you gave a ${ex.mine}.`}
				</p>
			)}
		</div>
	)
}

/** The page's one-line summary: what sets the person apart from everyone. */
export function headlineWords(data: FpPayload) {
	const s = data.headline.seek.slice(0, 3).map((k) => attrOf(data, k).phrase)
	const v = data.headline.avoid.slice(0, 2).map((k) => attrOf(data, k).phrase)
	return {
		seek: list(s),
		avoid: list(v),
	}
}

export function Legend({ className = "" }: { className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 ${className}`}>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-full" style={{ background: SEEK }} />
				More than most people
			</span>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-full" style={{ background: AVOID }} />
				Less than most people
			</span>
		</div>
	)
}
