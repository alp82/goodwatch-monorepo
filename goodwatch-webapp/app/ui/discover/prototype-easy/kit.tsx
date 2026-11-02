// PROTOTYPE (discover-easy), throwaway: shared pieces for the easy-mode variants on /dev/discover-page.
// Easy and Advanced read and write the same URL filters, so switching modes keeps every choice.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { WORD_BY_ID } from "~/domain/taste-picker"
import { MIXES } from "~/ui/start/moods/mixes"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { EasyContext } from "../DiscoverPage"

export type { EasyContext }
export { MIXES }

// --- Words (moods, themes, styles) ---

/** The filter state's words as picker ids ("m:funny", "t:fantasy", "s:slow"). */
export const wordIds = (s: FilterState): string[] => [
	...s.moods.map((k) => `m:${k}`),
	...s.themes.map((k) => `t:${k}`),
	...s.styles.map((k) => `s:${k}`),
]

/** A patch that sets exactly these words. */
export function wordsPatch(ids: readonly string[]): Partial<FilterState> {
	const pick = (p: string) =>
		ids.filter((i) => i.startsWith(`${p}:`)).map((i) => i.slice(2)) as never[]
	return { moods: pick("m"), themes: pick("t"), styles: pick("s"), allOf: [] }
}

export const wordName = (id: string) => WORD_BY_ID[id]?.name ?? id
export const wordHue = (id: string) => WORD_BY_ID[id]?.hue ?? "#888"

/** The mix whose parts are exactly the picked words. */
export function activeMix(s: FilterState) {
	const ids = new Set(wordIds(s))
	return (
		MIXES.find((m) => m.parts.length === ids.size && m.parts.every((p) => ids.has(p))) ?? null
	)
}

// --- Pictures for mixes and words (the start page's picker pictures, backdrops) ---

let asked: Promise<Record<string, string>> | null = null
export function usePictures() {
	const [pictures, set] = useState<Record<string, string>>({})
	useEffect(() => {
		asked ??= fetch("/api/start-picker-pictures")
			.then((r) => r.json())
			.then((b) => b.pictures ?? {})
			.catch(() => ({}))
		asked.then(set)
	}, [])
	return pictures
}
export const backdrop = (path: string | undefined, size = "w780") =>
	path ? tmdbImageUrl(path, size) : undefined

// --- Quick choices shared by the variants ---

export const TIME_CHOICES: readonly {
	key: "any" | "short" | "mid" | "long"
	label: string
	runtime?: { min?: number; max?: number }
}[] = [
	{ key: "any", label: "Any length", runtime: undefined },
	{ key: "short", label: "Under 90 min", runtime: { max: 90 } },
	{ key: "mid", label: "Under 2 hours", runtime: { max: 120 } },
	{ key: "long", label: "Epic, 2 h+", runtime: { min: 120 } },
]
export const timeKey = (s: FilterState) =>
	TIME_CHOICES.find(
		(c) => c.runtime?.max === s.runtime?.max && c.runtime?.min === s.runtime?.min,
	)?.key ?? "any"

export const ERA_CHOICES = [
	{ key: "any", label: "Any time" },
	{ key: "recent", label: "Recent" },
	{ key: "2010s", label: "2010s" },
	{ key: "2000s", label: "2000s" },
	{ key: "before2000", label: "Classics" },
] as const

export const TYPE_CHOICES = [
	{ key: "all", label: "Both" },
	{ key: "movie", label: "Movies" },
	{ key: "show", label: "Shows" },
] as const

// --- Mode switch: Easy | Advanced, in the URL as mode=advanced ---

export function useMode() {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const mode = params.get("mode") === "advanced" ? "advanced" : "easy"
	const setMode = (next: "easy" | "advanced") => {
		const out = new URLSearchParams(params)
		if (next === "advanced") out.set("mode", "advanced")
		else out.delete("mode")
		navigate({ search: `?${out}` }, { replace: true, preventScrollReset: true })
	}
	return { mode, setMode }
}

export function ModeSwitch({ className = "" }: { className?: string }) {
	const { mode, setMode } = useMode()
	return (
		<div
			role="radiogroup"
			aria-label="Discover mode"
			className={`inline-flex rounded-full bg-gray-900 p-1 ring-1 ring-white/10 ${className}`}
		>
			{(["easy", "advanced"] as const).map((m) => (
				<button
					key={m}
					type="button"
					role="radio"
					aria-checked={mode === m}
					onClick={() => setMode(m)}
					className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
						mode === m ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"
					}`}
				>
					{m === "easy" ? "Easy" : "Advanced"}
				</button>
			))}
		</div>
	)
}

// --- Small controls ---

export function Segmented<K extends string>({
	value,
	options,
	onChange,
	label,
	size = "md",
}: {
	value: K
	options: readonly { key: K; label: string }[]
	onChange: (key: K) => void
	label: string
	size?: "md" | "lg"
}) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className="inline-flex rounded-xl bg-gray-900/80 p-1 ring-1 ring-white/10"
		>
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					role="radio"
					aria-checked={value === o.key}
					onClick={() => onChange(o.key)}
					className={`cursor-pointer rounded-lg font-semibold transition ${
						size === "lg" ? "px-5 py-2.5 text-base" : "px-3 py-1.5 text-sm"
					} ${value === o.key ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"}`}
				>
					{o.label}
				</button>
			))}
		</div>
	)
}

export function Toggle({
	on,
	onChange,
	children,
}: {
	on: boolean
	onChange: (on: boolean) => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => onChange(!on)}
			className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-1 transition ${
				on
					? "bg-amber-400/15 text-amber-200 ring-amber-400/50"
					: "bg-gray-900/80 text-gray-300 ring-white/10 hover:text-white"
			}`}
		>
			<span
				className={`h-4 w-7 rounded-full p-0.5 transition ${on ? "bg-amber-400" : "bg-gray-600"}`}
			>
				<span
					className={`block h-3 w-3 rounded-full bg-white transition ${on ? "translate-x-3" : ""}`}
				/>
			</span>
			{children}
		</button>
	)
}

/** On my services + Not seen yet, the two essentials the owner wants within reach. */
export function Essentials({ ctx }: { ctx: EasyContext }) {
	const s = ctx.filters.state
	return (
		<>
			<Toggle on={s.onMyServices} onChange={(on) => ctx.filters.set({ onMyServices: on })}>
				On my services
			</Toggle>
			<Toggle
				on={s.notSeenYet}
				onChange={(on) => ctx.filters.set({ notSeenYet: on, seenBefore: undefined })}
			>
				Not seen yet
			</Toggle>
		</>
	)
}

/** The big search field: Enter searches; clearing ends the search. */
export function BigSearch({
	ctx,
	placeholder = "Describe a mood, a plot, or a title…",
	size = "lg",
	autoFocus,
}: {
	ctx: EasyContext
	placeholder?: string
	size?: "lg" | "xl"
	autoFocus?: boolean
}) {
	const [draft, setDraft] = useState(ctx.q ?? "")
	useEffect(() => setDraft(ctx.q ?? ""), [ctx.q])
	return (
		<form
			role="search"
			onSubmit={(e) => {
				e.preventDefault()
				const t = draft.trim()
				t ? ctx.onSearch(t) : ctx.clearSearch()
			}}
			className={`group relative flex items-center rounded-2xl bg-white/[0.06] ring-1 ring-white/15 transition focus-within:bg-white/[0.09] focus-within:ring-2 focus-within:ring-amber-400/70 ${
				size === "xl" ? "h-16 lg:h-[72px]" : "h-14"
			}`}
		>
			<svg aria-hidden viewBox="0 0 20 20" className="ml-5 h-5 w-5 shrink-0 fill-gray-400">
				<path d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z" />
			</svg>
			<input
				aria-label="Search by mood, plot, or title"
				value={draft}
				autoFocus={autoFocus}
				onChange={(e) => setDraft(e.target.value)}
				placeholder={placeholder}
				className={`h-full min-w-0 flex-1 bg-transparent px-3 text-white placeholder:text-gray-500 focus:outline-none ${
					size === "xl" ? "text-lg lg:text-xl" : "text-base"
				}`}
			/>
			{ctx.q && (
				<button
					type="button"
					onClick={() => {
						setDraft("")
						ctx.clearSearch()
					}}
					className="mr-2 cursor-pointer rounded-lg px-2 py-1 text-sm text-gray-400 hover:text-white"
				>
					Clear
				</button>
			)}
			<button
				type="submit"
				className="mr-2 cursor-pointer rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-300"
			>
				Search
			</button>
		</form>
	)
}

/** "1,234 titles", or a placeholder while counting. */
export function Count({ ctx, className = "" }: { ctx: EasyContext; className?: string }) {
	return (
		<span className={`tabular-nums ${className}`} aria-live="polite">
			{ctx.total === null ? "Counting…" : `${ctx.total.toLocaleString("en-US")} titles`}
		</span>
	)
}

/** Every easy choice as a removable chip, plus Start over. */
export function ChoiceChips({ ctx }: { ctx: EasyContext }) {
	const s = ctx.filters.state
	const chips: { key: string; label: string; drop: () => void; hue?: string }[] = []
	if (ctx.q) chips.push({ key: "q", label: `“${ctx.q}”`, drop: ctx.clearSearch })
	const mix = activeMix(s)
	if (mix) chips.push({ key: "mix", label: mix.name, drop: () => ctx.filters.set(wordsPatch([])) })
	else
		for (const id of wordIds(s))
			chips.push({
				key: id,
				label: wordName(id),
				hue: wordHue(id),
				drop: () => ctx.filters.set(wordsPatch(wordIds(s).filter((w) => w !== id))),
			})
	if (s.type !== "all")
		chips.push({ key: "type", label: s.type === "movie" ? "Movies" : "Shows", drop: () => ctx.filters.set({ type: "all" }) })
	const t = TIME_CHOICES.find((c) => c.key === timeKey(s))
	if (t && t.key !== "any") chips.push({ key: "time", label: t.label, drop: () => ctx.filters.set({ runtime: undefined }) })
	if (s.released !== "any")
		chips.push({
			key: "era",
			label: ERA_CHOICES.find((e) => e.key === s.released)?.label ?? s.released,
			drop: () => ctx.filters.set({ released: "any" }),
		})
	if (s.minScore) chips.push({ key: "score", label: `Score ${s.minScore}+`, drop: () => ctx.filters.set({ minScore: 0 }) })
	if (!chips.length) return null
	const startOver = () => {
		ctx.clearSearch()
		ctx.filters.set({ ...wordsPatch([]), type: "all", runtime: undefined, released: "any", minScore: 0 })
	}
	return (
		<div className="flex flex-wrap items-center gap-2">
			{chips.map((c) => (
				<button
					key={c.key}
					type="button"
					onClick={c.drop}
					aria-label={`Remove ${c.label}`}
					className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-3 pr-2 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/[0.12]"
				>
					{c.hue && <span className="h-2 w-2 rounded-full" style={{ background: c.hue }} />}
					{c.label}
					<span className="text-gray-400 group-hover:text-white">✕</span>
				</button>
			))}
			<button type="button" onClick={startOver} className="cursor-pointer px-2 text-sm text-gray-400 underline-offset-4 hover:text-white hover:underline">
				Start over
			</button>
		</div>
	)
}

/** True when the visitor has chosen anything at all. */
export const hasChoice = (ctx: EasyContext) => {
	const s = ctx.filters.state
	return Boolean(
		ctx.q || wordIds(s).length || s.type !== "all" || s.runtime || s.released !== "any" || s.minScore,
	)
}

/** A link-like button that opens Advanced with the same choices. */
export function FineTune({ label = "Fine-tune →" }: { label?: string }) {
	const { setMode } = useMode()
	return (
		<button type="button" onClick={() => setMode("advanced")} className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300">
			{label}
		</button>
	)
}
