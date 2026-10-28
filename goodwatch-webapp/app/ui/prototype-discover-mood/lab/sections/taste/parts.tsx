// PROTOTYPE - throwaway. Shared pieces of the Your taste section: Loved and Disliked as one set of titles that steer
// the list (a title is in one or the other), a title search with both actions on every match, poster shelves, and
// Taste match for a member or the one sign-up way in for a guest.
import { HandThumbDownIcon, HandThumbUpIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { MIN_MATCHES, type MinMatch } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { useAuthHref } from "~/utils/auth-href"
import type { TitleKey } from "~/utils/title-key"
import type { ProtoDiscover } from "../../../kit"
import { PRIVATE, useQuickTitles } from "../../shell-parts"

export const POSTER = "https://image.tmdb.org/t/p/w154"
export type Steer = "loved" | "disliked"

// ---------------------------------------------------------------------------------------------------------------
// Loved and disliked

export interface SteerTitle {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

export function useSteer(d: ProtoDiscover) {
	const loved = d.filters.state.loved ?? []
	const disliked = d.filters.state.disliked ?? []
	const names = useTitleNames([...loved, ...disliked], "")
	// What a pick already told us, so its poster shows at once.
	const [seen, setSeen] = useState(() => new Map<TitleKey, SteerTitle>())
	const known = (key: TitleKey): SteerTitle | undefined => {
		const n = names.byKey.get(key)
		return seen.get(key) ?? (n ? { key, title: n.title, year: String(n.year ?? ""), poster: n.poster } : undefined)
	}
	const stateOf = (key: TitleKey): Steer | null => (loved.includes(key) ? "loved" : disliked.includes(key) ? "disliked" : null)
	const set = (t: SteerTitle, to: Steer | null) => {
		setSeen((m) => new Map(m).set(t.key, t))
		const nextLoved = loved.filter((k) => k !== t.key)
		const nextDisliked = disliked.filter((k) => k !== t.key)
		if (to === "loved") nextLoved.push(t.key)
		if (to === "disliked") nextDisliked.push(t.key)
		d.filters.set({ loved: nextLoved.length ? nextLoved : undefined, disliked: nextDisliked.length ? nextDisliked : undefined })
	}
	const flip = (t: SteerTitle, to: Steer) => set(t, stateOf(t.key) === to ? null : to)
	return { loved, disliked, known, stateOf, set, flip }
}
export type SteerApi = ReturnType<typeof useSteer>

/** Titles in the current list, as picks, for steering without typing. */
export function listPicks(d: ProtoDiscover, n: number): SteerTitle[] {
	return d.cards.slice(0, n).map((c) => ({ key: c.key, title: c.title, year: c.release_year ? String(c.release_year) : "", poster: c.poster_path }))
}

export function useTitleSearch(text: string) {
	const { found, loading } = useQuickTitles(text)
	const picks: SteerTitle[] = found.map((t) => ({ key: t.key, title: t.title, year: t.year, poster: t.poster }))
	return { picks, loading }
}

/** Two small round buttons: loved (green) and disliked (red). */
export function SteerButtons({ steer, t, size = "md" }: { steer: SteerApi; t: SteerTitle; size?: "sm" | "md" }) {
	const at = steer.stateOf(t.key)
	const btn = (to: Steer) => {
		const on = at === to
		const Icon = to === "loved" ? HandThumbUpIcon : HandThumbDownIcon
		return (
			<motion.button
				key={to}
				type="button"
				whileTap={TAP}
				aria-pressed={on}
				aria-label={`${to === "loved" ? "Loved" : "Disliked"}: ${t.title}`}
				title={to === "loved" ? "Loved" : "Disliked"}
				onClick={() => steer.flip(t, to)}
				className={`grid shrink-0 place-items-center rounded-full cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${size === "sm" ? "h-7 w-7" : "h-8 w-8"} ${
					on
						? to === "loved"
							? "bg-emerald-500 text-white"
							: "bg-rose-500 text-white"
						: `bg-white/[0.07] text-gray-300 ring-1 ring-inset ring-white/10 ${to === "loved" ? "hover:bg-emerald-500/25 hover:text-emerald-200" : "hover:bg-rose-500/25 hover:text-rose-200"}`
				}`}
			>
				<Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
			</motion.button>
		)
	}
	return (
		<span className="flex shrink-0 items-center gap-1.5">
			{btn("loved")}
			{btn("disliked")}
		</span>
	)
}

export function Thumb({ t, className = "h-[51px] w-[34px]" }: { t?: SteerTitle; className?: string }) {
	return (
		<span className={`block shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 ${className}`}>
			{t?.poster ? (
				<img src={`${POSTER}${t.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />
			) : (
				<span className="grid h-full place-items-center p-0.5 text-center text-[8px] leading-tight text-gray-500">{t?.title}</span>
			)}
		</span>
	)
}

/** A title line: poster, name and year, both actions. */
export function SteerRow({ steer, t }: { steer: SteerApi; t: SteerTitle }) {
	const at = steer.stateOf(t.key)
	return (
		<div className="flex h-[58px] min-w-0 items-center gap-3 rounded-xl px-2 hover:bg-white/[0.04]">
			<Thumb t={t} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
				<span className={`block text-[12px] ${at === "loved" ? "text-emerald-300" : at === "disliked" ? "text-rose-300" : "text-gray-500"}`}>
					{at === "loved" ? "More like this" : at === "disliked" ? "Less like this" : t.year}
				</span>
			</span>
			<SteerButtons steer={steer} t={t} />
		</div>
	)
}

export function RowsLoading({ n = 4 }: { n?: number }) {
	return (
		<div aria-busy="true">
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
				<div key={i} className="flex h-[58px] items-center gap-3 px-2">
					<span className="h-[51px] w-[34px] animate-pulse rounded-md bg-white/[0.06] motion-reduce:animate-none" />
					<span className="h-3 w-32 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
				</div>
			))}
		</div>
	)
}

/** The chosen titles of one side as posters with a remove mark; empty slots keep the height. */
export function Shelf({ steer, group, slots = 5, size = "md" }: { steer: SteerApi; group: Steer; slots?: number; size?: "sm" | "md" }) {
	const keys = group === "loved" ? steer.loved : steer.disliked
	const ring = group === "loved" ? "ring-emerald-400" : "ring-rose-400"
	const dim = size === "sm" ? "h-[66px] w-11" : "h-[84px] w-14"
	return (
		<div className="flex gap-2.5 overflow-x-auto pt-1 pb-1 pl-1 [scrollbar-width:none]">
			{keys.map((k) => {
				const t = steer.known(k)
				return (
					<motion.button
						key={k}
						type="button"
						whileTap={TAP}
						title={t ? `${t.title}: take off` : undefined}
						aria-label={t ? `Take ${t.title} off ${group === "loved" ? "Loved" : "Disliked"}` : "Take off"}
						onClick={() => t && steer.set(t, null)}
						className={`group relative shrink-0 rounded-lg ring-2 ${ring} ring-offset-2 ring-offset-gray-950 cursor-pointer outline-none focus-visible:ring-amber-400`}
					>
						<Thumb t={t} className={`${dim} rounded-lg`} />
						<span
							className={`absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full text-white ${group === "loved" ? "bg-emerald-500" : "bg-rose-500"}`}
						>
							<XMarkIcon className="h-3 w-3" aria-hidden />
						</span>
					</motion.button>
				)
			})}
			{Array.from({ length: Math.max(0, slots - keys.length) }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: empty slots
				<span key={i} className={`${dim} shrink-0 rounded-lg border border-dashed border-white/[0.09]`} />
			))}
		</div>
	)
}

export function SteerLabel({ group, n }: { group: Steer; n: number }) {
	const Icon = group === "loved" ? HandThumbUpIcon : HandThumbDownIcon
	return (
		<span className="flex items-center gap-2">
			<span className={`grid h-6 w-6 place-items-center rounded-full ${group === "loved" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
				<Icon className="h-3.5 w-3.5" aria-hidden />
			</span>
			<span className="text-[14px] font-semibold text-gray-100">{group === "loved" ? "Loved" : "Disliked"}</span>
			<span className="text-[12px] text-gray-500">{n ? n : group === "loved" ? "More like these" : "Less like these"}</span>
		</span>
	)
}

/** The search field for titles. Starts from the bar's text. */
export function TitleField({ value, onChange, loading }: { value: string; onChange: (v: string) => void; loading?: boolean }) {
	return (
		<label className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] pr-1.5 pl-3 ring-1 ring-white/[0.06] focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Add a movie or show"
				aria-label="Add a movie or show"
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400 motion-reduce:animate-none" />}
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-white"
				>
					<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
					Clear
				</button>
			)}
		</label>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Taste match

const MATCH_STEPS = MIN_MATCHES as readonly MinMatch[]
const matchLabel = (v: number) => (v ? `${v}%+` : "Any")

/** A member's control: an amber "and up" scale with what each step leaves. */
export function MatchScale({ d, tall = false }: { d: ProtoDiscover; tall?: boolean }) {
	const value = d.filters.state.minMatch
	return (
		<div role="radiogroup" aria-label="Taste match" className="grid grid-cols-4 gap-1.5">
			{MATCH_STEPS.map((v) => {
				const on = v === value
				const lit = value !== 0 && v >= value
				const n = d.counts?.optionCounts.minMatch?.[String(v)] ?? null
				return (
					<motion.button
						key={v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => d.filters.set({ minMatch: v })}
						className={`flex flex-col items-start justify-between rounded-xl px-3 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${tall ? "h-[76px] py-2.5" : "h-14 py-2"} ${
							on ? "ring-2 ring-inset ring-amber-200" : ""
						} ${lit ? (on ? "bg-amber-500/55" : "bg-amber-500/25") : on ? "bg-white/[0.1]" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}
					>
						<span className={`font-bold tabular-nums leading-none ${tall ? "text-[22px]" : "text-[16px]"} ${lit || on ? "text-white" : "text-gray-300"}`}>
							{matchLabel(v)}
						</span>
						{n != null && !on && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>}
					</motion.button>
				)
			})}
		</div>
	)
}

/** A faint copy of the scale, for the guest state. */
export function MatchPreview() {
	return (
		<span aria-hidden className="grid grid-cols-4 gap-1.5">
			{MATCH_STEPS.map((v, i) => (
				<span key={v} className="flex flex-col gap-1">
					<span className="h-2 rounded-full bg-amber-400" style={{ opacity: 0.12 + (0.38 * i) / 3 }} />
					<span className="text-[11px] text-amber-200/40">{matchLabel(v)}</span>
				</span>
			))}
		</span>
	)
}

/** What a guest gets with an account, and the one way in. */
export function SignUpBlock({ layout = "panel", items }: { layout?: "panel" | "strip" | "wide"; items?: ReactNode[] }) {
	const authHref = useAuthHref()
	const button = (
		<Link
			to={authHref("sign-up")}
			rel="nofollow"
			className="flex h-9 shrink-0 items-center justify-center rounded-full bg-amber-400 px-4 text-[13px] font-bold text-gray-950 cursor-pointer outline-none transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200"
		>
			Sign up free
		</Link>
	)
	if (layout === "strip")
		return (
			<div className="flex h-14 items-center gap-3 rounded-xl bg-amber-500/[0.07] px-3 ring-1 ring-inset ring-amber-500/25">
				<FingerPrintIcon className="h-6 w-6 shrink-0 text-amber-500" aria-hidden />
				<span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-amber-50">Taste match on every title</span>
				<span className="hidden w-[220px] shrink-0 sm:block">
					<MatchPreview />
				</span>
				{button}
			</div>
		)
	return (
		<div className={`rounded-2xl bg-amber-500/[0.07] ring-1 ring-inset ring-amber-500/25 ${layout === "wide" ? "flex items-center gap-6 p-4" : "p-4"}`}>
			<div className={layout === "wide" ? "flex min-w-0 flex-1 items-center gap-4" : ""}>
				<span className={`flex items-center gap-3 ${layout === "wide" ? "shrink-0" : "mb-3"}`}>
					<FingerPrintIcon className="h-9 w-9 shrink-0 text-amber-500" aria-hidden />
					<span>
						<span className="block text-[15px] font-semibold text-amber-50">See how well every title fits you</span>
						<span className="block text-[12px] text-amber-200/60">From your ratings</span>
					</span>
				</span>
				<span className={layout === "wide" ? "block w-[260px] shrink-0" : "mb-3 block"}>
					<MatchPreview />
				</span>
				{items && (
					<ul className={`text-[12px] text-amber-100/75 ${layout === "wide" ? "flex min-w-0 flex-wrap gap-x-4 gap-y-1" : "mb-4 space-y-1.5"}`}>
						{items.map((it, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed list
							<li key={i} className="flex items-center gap-2">
								<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
								{it}
							</li>
						))}
					</ul>
				)}
			</div>
			{button}
		</div>
	)
}

export const SIGN_UP_ITEMS = ["A match on every poster", "Best match order", "Your ratings steer every list"]

export function Head({ children, right }: { children: ReactNode; right?: ReactNode }) {
	return (
		<div className="mb-2.5 flex min-h-7 items-center gap-2">
			{children}
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

export function ClearButton({ onClick, label = "Clear" }: { onClick: () => void; label?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{label}
		</button>
	)
}

export const clearSteer = (d: ProtoDiscover, group: Steer) => d.filters.set({ [group]: undefined })
