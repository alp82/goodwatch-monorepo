// PROTOTYPE (discover-easy): the one search field both modes share, in the same place. Enter runs the start page's
// interpreter (/api/discover/interpret): the words it understands become Discover filters in the URL, the rest stays
// the search text (q), so Advanced shows the same filters as controls.
import { ArrowRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import type { DiscoverInterpretation } from "~/server/discover-query.server"

/** URL keys that aren't filters: kept through a search, left out of what the interpreter reads. */
const PAGE_KEYS = ["mode", "variant", "as"]
const DROP_KEYS = ["q", "asked", "page", "allTitles", "sort", "layout"]

/** Example searches for the field (round 10). */
export type Examples = {
	how: "menu" | "placeholder" | "chips" | "links" | "composer"
	/** Round 15: show only two things: empty = placeholder + examples, filled = label + text. above: the small line over
	 * the text swaps (Try examples, then the label); around: the label sits above, the examples below the text. */
	two?: "above" | "around"
	/** A text runs as is; a pair shows `label` and runs `query` (wording the interpreter reads right). */
	list: readonly (string | { label: string; query: string })[]
	extra?: ReactNode
}

/** The last interpretation per search text, so the readout can say which filters came from the words. */
export const interpreted = new Map<string, { typed: string; result: DiscoverInterpretation }>()

export function useInterpretedSearch() {
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	const run = async (typed: string) => {
		const current = new URLSearchParams(window.location.search)
		const existing = new URLSearchParams(current)
		for (const k of [...PAGE_KEYS, ...DROP_KEYS]) existing.delete(k)
		const out = new URLSearchParams()
		setBusy(true)
		try {
			const response = await fetch("/api/discover/interpret", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ query: typed, existing: existing.toString() }),
			})
			if (!response.ok) throw new Error(String(response.status))
			const result = (await response.json()) as DiscoverInterpretation
			for (const [k, v] of new URLSearchParams(result.params)) out.append(k, v)
			interpreted.set(out.get("q") ?? "", { typed, result })
			// What was typed stays in the field, also when every word became a filter and no search text is left.
			out.set("asked", typed)
		} catch {
			// Without the interpreter the words are searched as they are.
			for (const [k, v] of existing) out.append(k, v)
			out.set("q", typed)
		} finally {
			setBusy(false)
		}
		for (const k of PAGE_KEYS) {
			const v = current.get(k)
			if (v) out.set(k, v)
		}
		navigate({ search: `?${out}` }, { preventScrollReset: true })
	}
	return { run, busy }
}

export function ProtoSearch({
	query,
	onClear,
	phone,
	inside,
	side,
	lead,
	trail,
	examples,
	flatBottom,
}: {
	query: string | null
	onClear: () => void
	phone: boolean
	/** A line under the text, inside the field; the text line itself never moves. */
	inside?: ReactNode
	/** Controls at the bar's right end, after a line (For you over Sort, attached). */
	side?: ReactNode
	/** Attached before the text and between the text and the Search button. */
	lead?: ReactNode
	trail?: ReactNode
	/** Example searches: a small menu while the empty field has focus, or the placeholder cycling through them. */
	examples?: Examples
	/** Advanced with the tray look: the filter row continues the bar, so its bottom corners go square. */
	flatBottom?: boolean
}) {
	const { run, busy } = useInterpretedSearch()
	// The field shows what was typed, not only the part left as search text.
	const [params] = useSearchParams()
	const typed = params.get("asked") ?? (query !== null ? (interpreted.get(query)?.typed ?? query) : "")
	const [text, setText] = useState(typed)
	useEffect(() => setText(typed), [typed])
	const [focused, setFocused] = useState(false)
	const [tick, setTick] = useState(0)
	useEffect(() => {
		if (examples?.how !== "placeholder" || text) return
		const id = setInterval(() => setTick((n) => n + 1), 2600)
		return () => clearInterval(id)
	}, [examples?.how, text])
	const cyc = examples?.how === "placeholder" ? examples.list[tick % examples.list.length] : null
	const cycling = cyc === null || cyc === undefined ? null : typeof cyc === "string" ? cyc : cyc.query
	const submit = () => {
		// An empty field with a cycling example searches that example.
		const t = text.trim() || cycling || ""
		if (t) run(t)
		else onClear()
	}
	const how = examples?.how
	const composer = how === "composer"
	const tall = how === "chips" || how === "links" || composer
	const two = examples?.two
	const filled = text.trim().length > 0
	const pick = (x: string) => {
		setText(x)
		run(x)
	}
	// Round 12: small example searches inside the bar, under the text (chips, links) or in its bottom toolbar (composer).
	const tryRow = tall && examples && (
		<div
			className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]"
			style={{ maskImage: "linear-gradient(to right, black 92%, transparent)" }}
		>
			<span className="mr-1 shrink-0 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">Try</span>
			{examples.list.map((item, i) => {
				const x = typeof item === "string" ? item : item.label
				const q = typeof item === "string" ? item : item.query
				return how === "links" ? (
					<button
						key={x}
						type="button"
						onClick={() => pick(q)}
						className={`shrink-0 cursor-pointer text-[13px] text-gray-300 underline decoration-white/30 decoration-dotted underline-offset-[3px] transition hover:text-amber-300 hover:decoration-amber-400 focus-visible:text-amber-300 focus-visible:outline-none ${i > 0 ? "ml-2" : ""}`}
					>
						{x}
					</button>
				) : (
					<button
						key={x}
						type="button"
						onClick={() => pick(q)}
						className="shrink-0 cursor-pointer rounded-full bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-gray-300 ring-1 ring-white/[0.06] hover:bg-white/[0.12] hover:text-white"
					>
						{x}
					</button>
				)
			})}
			<span className="w-6 shrink-0" />
		</div>
	)
	const clearButton = (text || query) && (
		<button
			type="button"
			aria-label="Clear the search"
			onClick={() => {
				setText("")
				onClear()
			}}
			className="mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
		>
			<XMarkIcon className="h-5 w-5" />
		</button>
	)
	const submitButton = (
		<button
			type="submit"
			disabled={busy}
			className={`mr-2 shrink-0 cursor-pointer rounded-full bg-amber-400 font-bold text-gray-950 hover:bg-amber-300 disabled:opacity-70 ${
				phone ? "flex h-11 w-11 items-center justify-center" : tall ? "px-6 py-3.5 text-base" : "px-5 py-3 text-[15px]"
			}`}
		>
			{phone ? <ArrowRightIcon className="h-5 w-5" aria-label="Search" /> : busy ? "Reading…" : "Search"}
		</button>
	)
	const placeholder = cycling
		? `Try “${cycling}”`
		: phone
			? "Describe it: “cozy anime”"
			: "Describe it: “Wednesday vibes, but darker”"
	if (composer)
		return (
			<form
				role="search"
				onSubmit={(e) => {
					e.preventDefault()
					submit()
				}}
				className={`group relative bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 ${
					phone ? "rounded-[22px] pl-4" : "rounded-[30px] pl-7"
				}`}
			>
				<label className="flex cursor-text flex-col pt-4 pr-6">
					<span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-amber-300/90 uppercase">
						<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
						Search
					</span>
					<input
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder={placeholder}
						aria-label="Search by mood, plot, or title"
						className={`brand-header search-private mt-1 w-full min-w-0 bg-transparent leading-tight text-white placeholder:text-gray-500 focus:outline-none ${
							phone ? "text-[20px]" : "text-[26px]"
						}`}
					/>
				</label>
				<div className={`flex items-center gap-2 ${phone ? "h-14" : "h-16"}`}>
					{tryRow}
					{clearButton}
					{trail}
					{submitButton}
				</div>
				{inside && <div className={`pb-3.5 ${phone ? "pr-4" : "pr-7"}`}>{inside}</div>}
			</form>
		)
	// Round 13 (links, chips): two columns. Text and examples on the left stop at a full-height line; Ready and Search sit
	// on the right, centered over the whole height.
	if (tall)
		return (
			<form
				role="search"
				onSubmit={(e) => {
					e.preventDefault()
					submit()
				}}
				className={`group relative flex items-stretch bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 ${
					phone ? `pl-4 ${flatBottom ? "rounded-t-[22px] rounded-b-none" : "rounded-[22px]"}` : `pl-8 ${flatBottom ? "rounded-t-[32px] rounded-b-none" : "rounded-[32px]"}`
				}`}
			>
				<div className={`flex min-w-0 flex-1 flex-col justify-center ${phone ? "gap-1.5 py-3.5 pr-2" : "gap-2 py-[18px] pr-3"}`}>
					{two === "above" && (
						<div className="relative h-[18px]">
							<span className={`absolute inset-0 flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 ${filled ? "opacity-100" : "pointer-events-none opacity-0"}`}>
								<MagnifyingGlassIcon className="h-3 w-3" aria-hidden />
								Search
							</span>
							<div className={`absolute inset-0 flex transition-opacity duration-150 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`}>{tryRow}</div>
						</div>
					)}
					{two === "around" && (
						<span className={`flex h-[14px] items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase transition-opacity duration-150 ${filled ? "opacity-100" : "opacity-0"}`}>
							<MagnifyingGlassIcon className="h-3 w-3" aria-hidden />
							Search
						</span>
					)}
					<label className="flex min-w-0 cursor-text flex-col justify-center gap-0.5">
						{!two && (
							<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-amber-300/80 uppercase">
								<MagnifyingGlassIcon className="h-3 w-3" aria-hidden />
								Search
							</span>
						)}
						<input
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder={placeholder}
							aria-label="Search by mood, plot, or title"
							className={`brand-header search-private w-full min-w-0 bg-transparent leading-tight text-white placeholder:text-gray-500 focus:outline-none ${
								phone ? "text-[20px]" : "text-[25px]"
							}`}
						/>
					</label>
					{!two && tryRow}
					{two === "around" && (
						<div className={`flex h-[18px] transition-opacity duration-150 ${filled ? "pointer-events-none opacity-0" : "opacity-100"}`} aria-hidden={filled}>
							{tryRow}
						</div>
					)}
				</div>
				{clearButton && <div className="flex shrink-0 items-center pr-3">{clearButton}</div>}
				{trail && <span className="w-px shrink-0 self-stretch bg-white/10" aria-hidden />}
				<div className="flex shrink-0 items-center gap-1 pr-3 pl-1.5">
					{trail}
					{submitButton}
				</div>
			</form>
		)
	return (
		<form
			role="search"
			onSubmit={(e) => {
				e.preventDefault()
				submit()
			}}
			className={`group relative bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 ${
				phone ? "rounded-[22px] pl-4" : inside || tall ? "rounded-[32px] pl-7" : "rounded-full pl-7"
			}`}
		>
			<div className={`flex items-center ${phone ? "h-[62px]" : "h-[76px]"}`}>
			{lead}
			<label className="flex min-w-0 flex-1 cursor-text flex-col justify-center">
				<span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-amber-300/90 uppercase">
					<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
					Search
				</span>
				<input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={placeholder}
					onFocus={() => setFocused(true)}
					onBlur={() => setTimeout(() => setFocused(false), 150)}
					aria-label="Search by mood, plot, or title"
					className={`brand-header search-private w-full min-w-0 bg-transparent leading-tight text-white placeholder:text-gray-500 focus:outline-none ${
						phone ? "text-[19px]" : "text-[21px]"
					}`}
				/>
			</label>
			{clearButton}
			{trail}
			{submitButton}
			{side}
			</div>
			{tall && <div className={`-mt-1 flex pb-3.5 ${phone ? "pr-2" : "pr-6"}`}>{tryRow}</div>}
			{examples?.how === "menu" && focused && !text && (
				<div className="absolute top-full right-0 left-0 z-40 mt-2 rounded-[22px] bg-gray-900 p-3 shadow-2xl shadow-black/70 ring-1 ring-white/10">
					<p className="px-2 pb-1.5 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">Try</p>
					<div className="flex flex-wrap gap-1.5">
						{examples.list.map((item) => typeof item === "string" ? item : item.label).map((x) => (
							<button
								key={x}
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									setText(x)
									run(x)
								}}
								className="cursor-pointer rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-gray-200 hover:bg-white/[0.12] hover:text-white"
							>
								{x}
							</button>
						))}
					</div>
					{examples.extra}
				</div>
			)}
			{inside && <div className={`-mt-2 pb-3.5 ${phone ? "pr-4" : "pr-7"}`}>{inside}</div>}
		</form>
	)
}
