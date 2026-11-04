// PROTOTYPE - throwaway. Variant C, "Words in the field": the search field itself shows how each word is used. A
// preference word gets a dashed underline, a required word a solid one with a lock, a word your own filter overrides
// is struck through. Tapping a word opens its choices under the field. Filters you picked elsewhere sit at the end of
// the field as locked chips. Editing the text is one tap on the text (or the pencil) away. Under Top rated one grid
// cell marks where the tagged titles end.
import { ArrowRightIcon, LockClosedIcon, PencilIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { BarChip } from "~/ui/discover-bar/chips"
import { useDiscoverMode } from "~/ui/discover-bar/mode"
import { GROUP_FIELD, type Readout, type Word, dropFilter, mentions, relaxWord, removeWord, requireWord, resetToWords } from "./model"
import { ActionRow, PREF, Pop, REQUIRED, RequiredChip, useGo, useOpenKey, useParams, wordKey } from "./parts"
import { tagged } from "./VariantA"

type Kind = "pref" | "strict" | "pinned" | "aside" | "not"
interface Mark {
	start: number
	end: number
	kind: Kind
	key: string
	word?: Word
	by?: Word
}

function find(query: string, phrase: string | undefined, label: string, taken: Mark[]): [number, number] | null {
	const free = (s: number, e: number) => taken.every((m) => e <= m.start || s >= m.end)
	if (phrase) {
		const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig")
		for (const m of query.matchAll(re)) if (free(m.index ?? 0, (m.index ?? 0) + m[0].length)) return [m.index ?? 0, (m.index ?? 0) + m[0].length]
	}
	for (const m of query.matchAll(/[\p{L}\p{N}'-]+/gu)) {
		const s = m.index ?? 0
		if (free(s, s + m[0].length) && mentions(m[0], label)) return [s, s + m[0].length]
	}
	return null
}

function marksOf(r: Readout): Mark[] {
	const out: Mark[] = []
	const add = (kind: Kind, phrase: string | undefined, label: string, extra: Partial<Mark>) => {
		const at = find(r.query, phrase, label, out)
		if (at) out.push({ start: at[0], end: at[1], kind, key: `${kind}:${extra.word ? wordKey(extra.word) : label}`, ...extra })
	}
	for (const n of r.negative) {
		const at = find(r.query, n, n, out)
		if (at) {
			const before = r.query.slice(0, at[0]).match(/\b(without|no|not|except|but not)\s+$/i)
			out.push({ start: before ? at[0] - before[0].length : at[0], end: at[1], kind: "not", key: `not:${n}` })
		}
	}
	for (const w of r.pinned) if (w.phrase) add("pinned", undefined, w.label, { word: w })
	for (const w of r.prefs) add("pref", w.phrase, w.label, { word: w })
	for (const w of r.searchStrict) if (w.phrase) add("strict", w.phrase, w.label, { word: w })
	for (const s of r.setAside) add("aside", s.phrase, s.phrase, { by: s.by })
	return out.sort((a, b) => a.start - b.start)
}

const MARK: Record<Kind, string> = {
	pref: "underline decoration-dashed decoration-sky-300/80 decoration-2 underline-offset-[6px] text-sky-50 hover:bg-sky-300/10",
	strict: "underline decoration-solid decoration-white/70 decoration-2 underline-offset-[6px] hover:bg-white/10",
	pinned: "underline decoration-solid decoration-white/70 decoration-2 underline-offset-[6px] hover:bg-white/10",
	aside: "line-through decoration-gray-500 text-gray-500 hover:bg-white/5",
	not: "text-[#b4c1d3] line-through decoration-[1.5px] hover:bg-white/5",
}

export function VariantCField({
	r,
	typed,
	onSearch,
	onClear,
	ready,
	loading,
}: {
	r: Readout | null
	typed: string
	onSearch: (text: string) => void
	onClear: () => void
	ready: ReactNode
	loading: boolean
}) {
	const params = useParams()
	const go = useGo()
	const pop = useOpenKey()
	const { mode } = useDiscoverMode()
	const flat = mode === "advanced"
	const [editing, setEditing] = useState(!typed)
	const [text, setText] = useState(typed)
	const input = useRef<HTMLInputElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		setText(typed)
		if (!typed) setEditing(true)
	}, [typed])
	useEffect(() => {
		if (editing && typed) input.current?.focus({ preventScroll: true })
	}, [editing, typed])
	const send = (value: string) => {
		clearTimeout(timer.current)
		const v = value.trim()
		if (v === typed) return
		if (v) onSearch(v)
		else onClear()
	}
	const run = (next: URLSearchParams) => {
		pop.close()
		go(next)
	}
	const shown = !editing && r && r.query === typed
	const marks = shown ? marksOf(r) : []
	const chipsAtEnd = shown ? r.pinned.filter((w) => !w.phrase) : []
	const pieces: ReactNode[] = []
	if (shown) {
		let at = 0
		for (const m of marks) {
			if (m.start > at) pieces.push(<span key={`t${at}`} onClick={() => setEditing(true)} className="cursor-text">{typed.slice(at, m.start)}</span>)
			const clickable = m.kind !== "not"
			pieces.push(
				clickable ? (
					<button
						key={m.key}
						type="button"
						aria-haspopup="dialog"
						aria-expanded={pop.open === m.key}
						onClick={() => pop.toggle(m.key)}
						className={`cursor-pointer rounded px-0.5 ${MARK[m.kind]} ${pop.open === m.key ? "bg-white/10" : ""}`}
					>
						{(m.kind === "strict" || m.kind === "pinned") && <LockClosedIcon className="mr-1 inline h-[0.6em] w-[0.6em] align-baseline opacity-70" aria-hidden />}
						{typed.slice(m.start, m.end)}
						<span className="sr-only">{m.kind === "pref" ? " (preference)" : m.kind === "aside" ? " (not used)" : " (required)"}</span>
					</button>
				) : (
					<span key={m.key} className={MARK.not}>
						{typed.slice(m.start, m.end)}
					</span>
				),
			)
			at = m.end
		}
		if (at < typed.length) pieces.push(<span key={`t${at}`} onClick={() => setEditing(true)} className="cursor-text">{typed.slice(at)}</span>)
	}
	const active = marks.find((m) => m.key === pop.open)
	const w = active?.word
	const dialog = active && (
		<Pop open onClose={pop.close} label={w?.label ?? active.key}>
			<div className="px-3 pt-2 pb-1">
				<div className="flex items-center gap-2 text-[15px] font-bold text-white">
					<span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active.kind === "pref" ? PREF : active.kind === "aside" ? "text-gray-400 ring-1 ring-white/10" : REQUIRED}`}>
						{active.kind === "pref" ? "Preference" : active.kind === "aside" ? "Not used" : "Required"}
					</span>
					{w ? `${w.group ? `${GROUP_FIELD[w.group].field} ` : ""}${w.label}` : `“${typed.slice(active.start, active.end)}”`}
				</div>
				<p className="mt-1 text-[12px] leading-snug text-gray-400">
					{active.kind === "pref"
						? "Lifts titles that fit. Titles without it can still appear."
						: active.kind === "pinned"
							? "You required this. It stays when you change the search."
							: active.kind === "aside"
								? `Your ${active.by?.label} filter decides this, so this word isn't searched.`
								: w?.why}
				</p>
			</div>
			{active.kind === "pref" && w && <ActionRow label={`Require ${w.label}`} detail="Only titles tagged with it." next={requireWord(params, w)} onGo={run} />}
			{active.kind === "pinned" && w && <ActionRow label="Back to a preference" detail="Titles without it can show again." next={relaxWord(params, w)} onGo={run} />}
			{active.kind === "aside" && active.by && <ActionRow label={`Remove ${active.by.label}`} detail="Then this word is searched too." next={dropFilter(params, active.by)} onGo={run} />}
			<ActionRow label={`Remove “${typed.slice(active.start, active.end)}”`} detail="Searches the rest of your words." next={active.kind === "pinned" && w ? removeWord(dropFilter(params, w), typed.slice(active.start, active.end)) : removeWord(params, typed.slice(active.start, active.end))} onGo={run} />
		</Pop>
	)
	return (
		<div className="relative">
			<form
				role="search"
				onSubmit={(e) => {
					e.preventDefault()
					send(text)
					if (text.trim()) setEditing(false)
				}}
				className={`relative flex items-stretch bg-white/[0.045] pl-4 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 lg:pl-8 ${flat ? "rounded-t-[22px] lg:rounded-t-[32px]" : "rounded-[22px] lg:rounded-[32px]"}`}
			>
				<div className="relative flex min-h-[92px] min-w-0 flex-1 flex-col justify-center gap-1 py-3 pr-2 lg:min-h-[108px] lg:pr-3">
					{shown ? (
						<div className="search-private brand-header flex flex-wrap items-baseline gap-x-1 gap-y-2 pr-16 text-[20px] leading-snug text-white lg:text-[25px]">
							{pieces}
							{chipsAtEnd.map((cw) => (
								<span key={wordKey(cw)} className="relative top-[-2px] ml-2 font-sans">
									<RequiredChip word={cw} field={cw.group ? GROUP_FIELD[cw.group].field : undefined} onRemove={() => go(dropFilter(params, cw))} onClick={() => pop.toggle(`chip:${wordKey(cw)}`)} active={pop.open === `chip:${wordKey(cw)}`} />
								</span>
							))}
						</div>
					) : (
						<input
							ref={input}
							type="search"
							value={text}
							autoComplete="off"
							enterKeyHint="search"
							aria-label="Search by mood, plot, or title"
							placeholder="Describe what you want to watch"
							onChange={(e) => {
								setText(e.target.value)
								clearTimeout(timer.current)
								const v = e.target.value.trim()
								if (!v) return send("")
								if (v.length >= 2) timer.current = setTimeout(() => send(v), 600)
							}}
							onBlur={() => r && text.trim() === typed && typed && setEditing(false)}
							onKeyDown={(e) => {
								if (e.key === "Escape" && typed) {
									setText(typed)
									setEditing(false)
								}
							}}
							className="search-private brand-header w-full min-w-0 border-0 bg-transparent p-0 pr-10 text-[20px] leading-tight text-white outline-none placeholder:text-[18px] placeholder:text-gray-500 focus:ring-0 lg:text-[25px] lg:placeholder:text-[25px] [&::-webkit-search-cancel-button]:hidden"
						/>
					)}
					{shown && (
						<span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-gray-400">
							<span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-b-2 border-dashed border-sky-300/80" aria-hidden />lifts titles</span>
							<span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-b-2 border-white/70" aria-hidden />required</span>
							<span>{loading ? "Updating…" : "Tap a word to change it"}</span>
						</span>
					)}
					{(shown || text) && (
						<span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center lg:right-2">
							{shown && (
								<button type="button" aria-label="Edit the search" onClick={() => setEditing(true)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white">
									<PencilIcon className="h-4 w-4" aria-hidden />
								</button>
							)}
							<button
								type="button"
								aria-label="Clear the search"
								onClick={() => {
									setText("")
									setEditing(true)
									send("")
								}}
								className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
							>
								<XMarkIcon className="h-5 w-5" aria-hidden />
							</button>
						</span>
					)}
				</div>
				<span className="hidden w-px shrink-0 self-stretch bg-white/10 lg:block" aria-hidden />
				<div className="flex shrink-0 items-center gap-1 pr-2.5 lg:pr-3 lg:pl-1.5">
					<div className="hidden h-14 items-center lg:flex">{ready}</div>
					<button type="submit" aria-label="Search" className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-400 font-bold text-gray-950 outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white lg:h-auto lg:w-auto lg:px-6 lg:py-3.5">
						<ArrowRightIcon className="h-5 w-5 lg:hidden" aria-hidden />
						<span className="hidden lg:inline">Search</span>
					</button>
				</div>
			</form>
			{dialog}
			{chipsAtEnd.map((cw) => (
				<Pop key={wordKey(cw)} open={pop.open === `chip:${wordKey(cw)}`} onClose={pop.close} label={cw.label}>
					<div className="px-3 pt-2 pb-1">
						<div className="text-[15px] font-bold text-white">{cw.label}</div>
						<p className="mt-1 text-[12px] text-gray-400">You picked this in {GROUP_FIELD[cw.group ?? "genres"].tab}. It stays when you change the search.</p>
					</div>
					<ActionRow label="Back to a preference" detail={`Adds “${cw.label.toLowerCase()}” to your search instead.`} next={relaxWord(params, cw)} onGo={run} />
					<ActionRow label={`Remove ${cw.label}`} next={dropFilter(params, cw)} onGo={run} />
				</Pop>
			))}
		</div>
	)
}

/** C's reading line: Discover's other filters, a reset, and one sentence. */
export function VariantCReading({ r, chips, onRemoveChip }: { r: Readout; chips: readonly BarChip[]; onRemoveChip: (c: BarChip) => void }) {
	const params = useParams()
	const go = useGo()
	const other = chips.filter((c) => c.kind !== "query" && !["genres", "themes", "moods", "styles"].includes(c.group ?? ""))
	const unplaced = r.searchStrict.filter((w) => !w.phrase)
	return (
		<div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 py-1 text-[12px] text-gray-400">
			{other.map((chip) => (
				<RequiredChip key={chip.key} word={{ group: null, param: chip.key, value: chip.key, label: chip.label }} field={chip.prefix} onRemove={() => onRemoveChip(chip)} />
			))}
			{unplaced.map((w) => (
				<span key={wordKey(w)} title={w.why}>
					<RequiredChip word={w} field={w.group ? GROUP_FIELD[w.group].field : undefined} />
				</span>
			))}
			<span className="min-w-0">{r.how}</span>
			{r.pinned.some((w) => w.phrase) && (
				<button type="button" onClick={() => go(resetToWords(params, r))} className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300">
					Turn required words back into preferences
				</button>
			)}
		</div>
	)
}

/** Top rated: one grid cell after the last tagged title. */
export function VariantCCell({ r }: { r: Readout }) {
	return (
		<div className="flex aspect-[2/3] flex-col justify-center gap-2 rounded-xl border border-dashed border-sky-300/30 bg-sky-300/[0.04] p-3 text-[12px] leading-snug text-gray-300 sm:p-4 sm:text-[13px]">
			<strong className="text-white">Before this: {r.originalInList.toLocaleString("en")} {tagged(r)}.</strong>
			<span>From here: {(r.total - r.originalInList).toLocaleString("en")} more that fit your words, by rating.</span>
		</div>
	)
}
