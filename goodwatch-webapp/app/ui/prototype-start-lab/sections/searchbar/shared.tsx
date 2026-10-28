// PROTOTYPE (start page lab, round 12): what search bars b, c and d share: typing that searches after a pause, Enter
// or the button at once, the field's input (DiscoverHeading's look), the ↵ key cap, and the one chip row that shows the
// "Try" presets until a search is on and Discover's "Read as" chips while it is (same box, crossfade, no shift).
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { ReadAsChips, readAsChips } from "~/ui/discover/ReadAsChips"
import { DEFAULTS } from "../../lab/choice"
import { PRESET_SHORT, TYPED_READING_MS } from "../../lab/fixture-search"
import { useLab } from "../../lab/types"
import { PRIVATE, readingChips } from "../hero/shared"
import { moodHue, type StageFlow } from "../stage/ab-shared"
import { vocabOf } from "../stage/hi-vocab"
import { DChip } from "../stage/jk-chips"
import { VARIANTS } from "./index"

/** Typing searches once it pauses this long (Discover waits 800 ms). */
export const DEBOUNCE_MS = 500

/** The window event a bar fires on Enter or its button, so the module comes into view even when nothing changed. */
export const JK_REVEAL = "start-lab:jk-reveal"

/** The chosen search bar: the URL's, else the round's default, else "a"; an unknown key falls back to "a". */
export function useSearchbarKey(): string {
	const { choice } = useLab()
	const want = choice.searchbar ?? DEFAULTS[choice.round].searchbar ?? "a"
	return VARIANTS.some((v) => v.key === want) ? want : "a"
}

/** A search is on: typed text that was sent, or an example prompt (not a More moods choice, which only looks like one). */
export const searchActive = (f: StageFlow) => f.source.kind === "typed" || (f.source.kind === "prompt" && !vocabOf(f.source))

/**
 * The field's behavior: every keystroke sets the draft and (re)starts the pause timer; when it runs out the text is
 * searched, unless the draft changed under it (a mood chip, a preset, Clear). Emptying the field clears the search.
 * `submit` (Enter, the button) searches at once, or only brings the results into view when that text is already on.
 */
export function useBarSearch(f: StageFlow, input: RefObject<HTMLInputElement>) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const latest = useRef(f)
	latest.current = f
	const cancel = useCallback(() => {
		if (timer.current) clearTimeout(timer.current)
		timer.current = null
	}, [])
	useEffect(() => cancel, [cancel])
	const sentQ = (fl: StageFlow) => (fl.source.kind === "typed" || fl.source.kind === "prompt" ? fl.source.q : null)
	const onChange = useCallback(
		(v: string) => {
			const fl = latest.current
			fl.setDraft(v)
			cancel()
			if (!v.trim()) {
				if (fl.source.kind === "typed" || (fl.source.kind === "prompt" && !vocabOf(fl.source))) fl.clear()
				return
			}
			timer.current = setTimeout(() => {
				timer.current = null
				const now = latest.current
				if (now.draft !== v) return
				if (sentQ(now) === v.trim()) return
				now.typed(v)
			}, DEBOUNCE_MS)
		},
		[cancel],
	)
	const submit = useCallback(() => {
		cancel()
		const fl = latest.current
		const q = fl.draft.trim()
		input.current?.blur()
		if (!q) return
		if (sentQ(fl) === q) window.dispatchEvent(new Event(JK_REVEAL))
		else fl.typed(q)
	}, [cancel, input])
	const clear = useCallback(() => {
		cancel()
		latest.current.clear()
		input.current?.focus()
	}, [cancel, input])
	return { onChange, submit, clear }
}

/** The input in DiscoverHeading's look: magnifier, the query in the heading font, Clear. Search text is private. */
export function BarInput({
	f,
	inputRef,
	onChange,
	onClear,
	text,
	className = "",
	onFocusChange,
	after,
	placeholder = "A cozy mystery, a funny show…",
}: {
	f: StageFlow
	inputRef: RefObject<HTMLInputElement>
	onChange: (v: string) => void
	onClear: () => void
	/** The query's type size. */
	text: string
	className?: string
	onFocusChange?: (on: boolean) => void
	/** Drawn inside the text box, over the input (c's inline suggestions). */
	after?: ReactNode
	placeholder?: string
}) {
	const has = f.draft.length > 0 || f.source.kind === "typed" || f.source.kind === "prompt"
	return (
		<div className={`flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3 ${PRIVATE} ${className}`}>
			<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${f.draft ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
			<div className="relative h-full min-w-0 flex-1">
				<input
					ref={inputRef}
					type="search"
					aria-label="Search by mood or anything"
					value={f.draft}
					autoComplete="off"
					enterKeyHint="search"
					maxLength={200}
					data-ph-no-capture
					data-jk-bar-input=""
					placeholder={placeholder}
					onChange={(e) => onChange(e.target.value)}
					onFocus={() => onFocusChange?.(true)}
					onBlur={() => onFocusChange?.(false)}
					className={`brand-header h-full w-full min-w-0 border-0 bg-transparent p-0 leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${text}`}
				/>
				{after}
			</div>
			<button
				type="button"
				onMouseDown={(e) => e.preventDefault()}
				onClick={onClear}
				aria-label="Clear the search"
				tabIndex={has ? 0 : -1}
				className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 outline-none transition-[colors,opacity] cursor-pointer hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 ${has ? "opacity-100" : "pointer-events-none opacity-0"}`}
			>
				<XMarkIcon className="h-4 w-4" aria-hidden />
				<span className="hidden lg:inline">Clear</span>
			</button>
		</div>
	)
}

/** The ↵ key cap: a small raised key. `tone` "on-amber" for inside the amber button, "dark" elsewhere. */
export function EnterKey({ tone = "on-amber", label = false, className = "" }: { tone?: "on-amber" | "dark"; label?: boolean; className?: string }) {
	return (
		<kbd
			aria-hidden
			className={`inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1.5 font-sans text-[13px] font-bold leading-none ${
				tone === "on-amber"
					? "bg-gray-950/15 text-gray-950 shadow-[inset_0_-2px_0_rgb(0_0_0/.22),inset_0_0_0_1px_rgb(0_0_0/.18)]"
					: "bg-white/10 text-gray-100 shadow-[inset_0_-2px_0_rgb(0_0_0/.45),inset_0_0_0_1px_rgb(255_255_255/.14)]"
			} ${className}`}
		>
			<span className="text-[15px]">↵</span>
			{label ? <span className="text-[11px] font-semibold tracking-wide">Enter</span> : null}
		</kbd>
	)
}

export { PRESET_SHORT } from "../../lab/fixture-search"

/** Round 13: d's placeholder, which repeats no preset: the long one on desktop, a short one on phones. */
export const PLACEHOLDER_LONG = "Describe a mood, a plot, or a title…"
export const PLACEHOLDER_SHORT = "Mood, plot, title…"

/** The long placeholder from 640 px up (the server renders it; phones switch after hydration, no layout change). */
export function usePlaceholder() {
	const [ph, setPh] = useState(PLACEHOLDER_LONG)
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 640px)")
		const on = () => setPh(mq.matches ? PLACEHOLDER_LONG : PLACEHOLDER_SHORT)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [])
	return ph
}

/** The example searches as small chips (Discover's option chip, without the backing it needs over the room). */
export function BarPresets({ f, lead = true, ghost = false, compact = false }: { f: StageFlow; lead?: boolean; ghost?: boolean; compact?: boolean }) {
	const prompts = f.data.guest.prompts.slice(0, compact ? 6 : 3)
	if (compact)
		// Round 13 (d): six short chips, no per-chip icon, one row on desktop; the row scrolls sideways on phones.
		return (
			<div className="flex w-max items-center gap-1.5">
				{lead ? (
					<span className="flex shrink-0 items-center gap-1 pr-0.5 text-[13px] text-gray-400">
						<MagnifyingGlassIcon className="h-3.5 w-3.5 text-amber-400" aria-hidden />
						Try
					</span>
				) : null}
				{prompts.map((p) => (
					<button
						key={p.q}
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						// Round 14: the field shows and searches the exact short phrase.
						onClick={() => f.prompt(PRESET_SHORT[p.q] ?? p.q)}
						className="inline-flex h-7 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 text-[13px] text-gray-200 outline-none ring-1 ring-inset ring-white/10 transition-colors hover:bg-amber-400/10 hover:text-white hover:ring-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{PRESET_SHORT[p.q] ?? p.q}
					</button>
				))}
			</div>
		)
	return (
		<div className="flex w-max items-center gap-1.5">
			{lead ? <span className="shrink-0 pr-0.5 text-[13px] text-gray-400 sm:text-sm">Try</span> : null}
			{prompts.map((p) =>
				ghost ? (
					<button
						key={p.q}
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => f.prompt(p.q)}
						className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-white/20 px-3 text-sm text-gray-300 outline-none transition-colors hover:border-amber-400/60 hover:bg-amber-400/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-hidden />
						{p.q}
					</button>
				) : (
					<DChip
						key={p.q}
						on={false}
						className="!bg-transparent !shadow-none [&>button]:!h-8 [&>button]:!pl-2.5 [&>button]:!pr-3"
						onClick={() => f.prompt(p.q)}
						swatch={<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />}
						label={p.q}
					/>
				),
			)}
		</div>
	)
}

/**
 * LAB STAND-IN: the captured prompts carry no reading (the fixtures' `reading` is null), and the lab can't run the
 * paid reading. So a reading is made up from the query's words in the shape the site sends (want chips with their
 * fingerprint key, attributes, phrases), only so Discover's chips can be seen here. The real site shows its own.
 */
const STAND_IN: [RegExp, ReadingChip][] = [
	[/\b(cozy|cosy|comfort|wholesome)/, { kind: "want", text: "Wholesome", key: "wholesome" }],
	[/\b(feel-?good|uplifting|hopeful)/, { kind: "want", text: "Hopefulness", key: "hopefulness" }],
	[/\b(mystery|whodunn?it|detective)/, { kind: "want", text: "Mystery", key: "mystery" }],
	[/\b(thriller|tense|suspense)/, { kind: "want", text: "Tension", key: "tension" }],
	[/\b(funn|comed|laugh|hilari)/, { kind: "want", text: "Situational comedy", key: "situational_comedy" }],
	[/\b(witty|clever)/, { kind: "want", text: "Wit", key: "wit_wordplay" }],
	[/\b(scary|horror|creepy|spooky)/, { kind: "want", text: "Scare", key: "scare" }],
	[/\b(mind-?bending|psycholog|twist)/, { kind: "want", text: "Psychological", key: "psychological" }],
	[/\b(sci-?fi|space|future)/, { kind: "want", text: "Futuristic", key: "futuristic" }],
	[/\b(romanc|romantic|partner|date night|love story)/, { kind: "want", text: "Romance", key: "romance" }],
	[/\b(dark|bleak|grim)/, { kind: "want", text: "Bleakness", key: "bleakness" }],
	[/\b(sad|cry|tearjerk)/, { kind: "want", text: "Melancholy", key: "melancholy" }],
	[/\b(action|explosi|chase)/, { kind: "want", text: "Adrenaline", key: "adrenaline" }],
	[/\b(animated|animation|anime)/, { kind: "attribute", text: "Animation" }],
	[/\bunder (two|2) hours\b/, { kind: "attribute", text: "Under 2 hours" }],
	[/\b(show|series|binge)\b/, { kind: "attribute", text: "TV show" }],
	[/\blike ([a-z][a-z' ]{2,24}?)(?= but| with|$)/, { kind: "phrase", text: "$1" }],
	[/\brainy (sunday|day|night)/, { kind: "phrase", text: "rainy day" }],
]

function standInReading(q: string): ReadingChip[] {
	const t = q.toLowerCase()
	const out: ReadingChip[] = []
	for (const [re, chip] of STAND_IN) {
		const m = re.exec(t)
		if (!m) continue
		const text = chip.text === "$1" ? `like ${m[1].replace(/\b\w/g, (c) => c.toUpperCase())}` : chip.text
		if (!out.some((c) => c.text === text)) out.push({ ...chip, text })
	}
	return out
}

/** Whether the site's reading would have arrived: TYPED_READING_MS after a typed search starts. */
function useReadingArrived(loading: boolean) {
	const [arrived, setArrived] = useState(!loading)
	useEffect(() => {
		if (!loading) return setArrived(true)
		setArrived(false)
		const t = setTimeout(() => setArrived(true), TYPED_READING_MS)
		return () => clearTimeout(t)
	}, [loading])
	return arrived
}

/** How the search read the text: "Reading…" until the reading arrives, then Discover's chips (or the mood it landed on). */
export function BarReading({ f }: { f: StageFlow }) {
	const arrived = useReadingArrived(f.loading)
	const q = f.source.kind === "typed" || f.source.kind === "prompt" ? f.source.q : f.draft
	const captured = readingChips(f.loading ? f.reading : f.answer?.reading)
	const chips = captured.length ? captured : standInReading(q)
	if (f.loading && !arrived && !f.reading)
		return (
			<span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-gray-400 sm:text-sm">
				<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
				Reading…
			</span>
		)
	const label = <span className="shrink-0 text-[13px] text-gray-400 sm:text-sm">Read as</span>
	if (readAsChips(chips).length)
		return (
			<span className="flex w-max items-center gap-2">
				{label}
				<ReadAsChips reading={chips} className="!flex-nowrap [&>li]:shrink-0 [&>li]:whitespace-nowrap" />
			</span>
		)
	if (f.loading) return <span className="whitespace-nowrap text-[13px] text-gray-400 sm:text-sm">Searching “{q}”</span>
	const mood = f.answer?.kind === "mood" ? f.data.guest.moods.find((m) => m.label === f.answer?.answeredAs) : undefined
	if (mood)
		return (
			<span className="flex w-max items-center gap-2">
				{label}
				<span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-gray-100 ring-1 ring-inset ring-white/10">
					<span className="h-2 w-2 rounded-full" style={{ background: moodHue(mood.key) }} />
					{mood.label}
				</span>
			</span>
		)
	return <span className="whitespace-nowrap text-[13px] text-gray-400 sm:text-sm">Searching “{q}”</span>
}

/**
 * One fixed-height row that holds the presets, or the reading while a search is on: both are always mounted, the hidden
 * one at opacity 0 and inert, so swapping never changes a height. Scrolls sideways when it doesn't fit (phones).
 */
export function BarChipRow({
	f,
	className = "",
	ghost = false,
	lead = true,
	compact = false,
}: { f: StageFlow; className?: string; ghost?: boolean; lead?: boolean; compact?: boolean }) {
	const on = searchActive(f)
	const layer =
		"absolute inset-0 flex items-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)] transition-[opacity,transform] duration-300 ease-out"
	return (
		<div className={`relative min-w-0 ${className}`}>
			<div className={layer} style={{ opacity: on ? 0 : 1, transform: on ? "translateY(4px)" : "none", pointerEvents: on ? "none" : "auto" }} {...(on ? { inert: "" } : {})}>
				<BarPresets f={f} ghost={ghost} lead={lead} compact={compact} />
			</div>
			<div className={layer} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(-4px)", pointerEvents: on ? "auto" : "none" }} aria-live="polite" {...(on ? {} : { inert: "" })}>
				{on ? <BarReading f={f} /> : null}
			</div>
		</div>
	)
}

/** The lifted field's shadow and focus glow, as stage j draws them. */
export const BAR_SHADOW =
	"0 1px 0 rgb(255 255 255 / .06) inset, 0 2px 4px rgb(0 0 0 / .45), 0 10px 22px rgb(0 0 0 / .45), 0 28px 56px rgb(0 0 0 / .55), 0 60px 120px rgb(0 0 0 / .55)"

export const BAR_CSS = `.sb-glow{opacity:0;transition:opacity .25s ease-out}
.sb-field:focus-within .sb-glow{opacity:1}`
