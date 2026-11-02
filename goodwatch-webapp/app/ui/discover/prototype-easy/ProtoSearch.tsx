// PROTOTYPE (discover-easy): the one search field both modes share, in the same place. Enter runs the start page's
// interpreter (/api/discover/interpret): the words it understands become Discover filters in the URL, the rest stays
// the search text (q), so Advanced shows the same filters as controls.
import { ArrowRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import type { DiscoverInterpretation } from "~/server/discover-query.server"

/** URL keys that aren't filters: kept through a search, left out of what the interpreter reads. */
const PAGE_KEYS = ["mode", "variant"]
const DROP_KEYS = ["q", "page", "allTitles", "sort", "layout"]

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
}: {
	query: string | null
	onClear: () => void
	phone: boolean
	/** A line under the text, inside the field; the text line itself never moves. */
	inside?: ReactNode
	/** Controls at the bar's right end, after a line (For you over Sort, attached). */
	side?: ReactNode
}) {
	const { run, busy } = useInterpretedSearch()
	// The field shows what was typed, not only the part left as search text.
	const typed = query !== null ? (interpreted.get(query)?.typed ?? query) : ""
	const [text, setText] = useState(typed)
	useEffect(() => setText(typed), [typed])
	const submit = () => {
		const t = text.trim()
		if (t) run(t)
		else onClear()
	}
	return (
		<form
			role="search"
			onSubmit={(e) => {
				e.preventDefault()
				submit()
			}}
			className={`group relative bg-white/[0.045] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-400/60 ${
				phone ? "rounded-[22px] pl-4" : inside ? "rounded-[38px] pl-7" : "rounded-full pl-7"
			}`}
		>
			<div className={`flex items-center ${phone ? "h-[62px]" : "h-[76px]"}`}>
			<label className="flex min-w-0 flex-1 cursor-text flex-col justify-center">
				<span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-amber-300/90 uppercase">
					<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
					Search
				</span>
				<input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={phone ? "Mood, plot, title…" : "Describe it: “funny 90s movies on Netflix”"}
					aria-label="Search by mood, plot, or title"
					className={`brand-header search-private w-full min-w-0 bg-transparent leading-tight text-white placeholder:text-gray-500 focus:outline-none ${
						phone ? "text-[19px]" : "text-[21px]"
					}`}
				/>
			</label>
			{(text || query) && (
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
			)}
			<button
				type="submit"
				disabled={busy}
				className={`mr-2 shrink-0 cursor-pointer rounded-full bg-amber-400 font-bold text-gray-950 hover:bg-amber-300 disabled:opacity-70 ${
					phone ? "flex h-10 w-10 items-center justify-center" : "px-5 py-3 text-[15px]"
				}`}
			>
				{phone ? <ArrowRightIcon className="h-5 w-5" aria-label="Search" /> : busy ? "Reading…" : "Search"}
			</button>
			{side}
			</div>
			{inside && <div className={`-mt-2 pb-3.5 ${phone ? "pr-4" : "pr-7"}`}>{inside}</div>}
		</form>
	)
}
