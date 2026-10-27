// PROTOTYPE (start page lab, round 4): the "More moods" step's parts for stage h and i: the filter box, a group of
// choices as a grid of chips, the "search for it instead" empty state, and closing on Escape or a tap outside.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type RefObject, useEffect } from "react"
import type { StageFlow } from "./ab-shared"
import { isChosen, pickVocab } from "./hi-shared"
import type { VocabItem } from "./hi-vocab"

export function useDismiss(open: boolean, close: () => void, panel: RefObject<HTMLElement | null>, { outside = true } = {}) {
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close()
		}
		const onDown = (e: PointerEvent) => {
			const t = e.target as Element | null
			if (!t || panel.current?.contains(t) || t.closest("[data-hi-more]")) return
			close()
		}
		document.addEventListener("keydown", onKey)
		if (outside) document.addEventListener("pointerdown", onDown)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onDown)
		}
	}, [open, close, panel, outside])
}

/** Focus the filter box when the step opens, on a pointer screen only (a phone's keyboard would cover the list). */
export function useFocusOnOpen(open: boolean, input: RefObject<HTMLInputElement>) {
	useEffect(() => {
		if (!open) return
		if (!window.matchMedia("(hover: hover)").matches) return
		const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 60)
		return () => clearTimeout(t)
	}, [open, input])
}

export function FilterBox({
	value,
	onChange,
	inputRef,
	count,
	className = "",
}: {
	value: string
	onChange: (v: string) => void
	inputRef: RefObject<HTMLInputElement>
	count: number
	className?: string
}) {
	return (
		<label className={`flex h-10 items-center gap-2 rounded-xl bg-gray-950 px-3 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-amber-400 ${className}`}>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={`Filter ${count} choices…`}
				aria-label="Filter moods, themes and styles"
				autoComplete="off"
				className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] text-white outline-none placeholder:text-gray-500 focus:ring-0 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
			/>
			{value ? (
				<button type="button" onClick={() => onChange("")} aria-label="Clear the filter" className="-mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white">
					<XMarkIcon className="h-4 w-4" aria-hidden />
				</button>
			) : null}
		</label>
	)
}

export function VocabChip({ f, item, onPicked, big = false }: { f: StageFlow; item: VocabItem; onPicked: () => void; big?: boolean }) {
	const on = isChosen(f, item)
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => {
				if (on) f.clear()
				else pickVocab(f, item)
				onPicked()
			}}
			className={`hi-pill flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${big ? "h-11 text-[15px]" : "h-10 text-sm"} ${on ? "bg-amber-400 text-gray-950" : "bg-white/[0.05] text-gray-100 ring-1 ring-white/10 can-hover:hover:bg-white/10 can-hover:hover:text-white"}`}
			style={on ? undefined : { backgroundImage: `linear-gradient(to right, ${item.color}2e, transparent 70%)` }}
		>
			<span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/30" style={{ background: item.color }} />
			<span className="truncate">{item.label}</span>
		</button>
	)
}

/** No choice matches the filter: run it as a search instead. */
export function SearchInstead({ f, q, onPicked }: { f: StageFlow; q: string; onPicked: () => void }) {
	return (
		<div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-gray-400">
			<p>
				Nothing called <b className="text-white">“{q}”</b> here.
			</p>
			<button
				type="button"
				onClick={() => {
					f.setDraft(q)
					f.typed(q)
					onPicked()
				}}
				className="hi-pill inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-4 font-semibold text-gray-950 hover:bg-amber-300"
			>
				<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
				Search for “{q}”
			</button>
		</div>
	)
}
