// PROTOTYPE - throwaway (discover search preferences, see README.md). The visual language every variant shares: a
// preference is a dashed outline (it lifts titles), a required filter is a solid chip with a lock (it removes titles),
// a set-aside word is struck through. Plus the count an action would give, asked from the same V7 service.
import { LockClosedIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { Readout, Word } from "./model"
import { useWhatIf } from "./usePreferencePrototype"

export function useGo() {
	const navigate = useNavigate()
	return (next: URLSearchParams, replace = false) =>
		navigate({ search: `?${next}` }, { replace, preventScrollReset: true })
}
export function useParams() {
	return useSearchParams()[0]
}

export const PREF =
	"border border-dashed border-sky-300/55 bg-sky-300/[0.06] text-sky-100"
export const REQUIRED = "bg-white/[0.13] text-white ring-1 ring-white/25"

export function PrefChip({
	word,
	onClick,
	size = "sm",
	active = false,
}: { word: Word; onClick?: () => void; size?: "sm" | "md"; active?: boolean }) {
	const cls = `inline-flex shrink-0 items-center gap-1.5 rounded-full ${size === "md" ? "px-3 py-1 text-[13px]" : "px-2.5 py-0.5 text-[12px]"} font-[600] ${PREF} ${active ? "ring-2 ring-sky-300/60" : ""}`
	const body = (
		<>
			<span className="h-1.5 w-1.5 rounded-full border border-sky-200/80" aria-hidden />
			{word.label}
		</>
	)
	return onClick ? (
		<button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:bg-sky-300/[0.14]`} aria-haspopup="dialog" aria-expanded={active}>
			{body}
		</button>
	) : (
		<span className={cls}>{body}</span>
	)
}

export function RequiredChip({
	word,
	onClick,
	onRemove,
	field,
	active = false,
}: {
	word: Word
	onClick?: () => void
	onRemove?: () => void
	/** "Genre", "About"…: shown before the label. */
	field?: string
	active?: boolean
}) {
	const body = (
		<>
			<LockClosedIcon className="h-3 w-3 text-white/60" aria-hidden />
			{field && <span className="font-normal text-[#a9b8cc]">{field}</span>}
			{word.label}
		</>
	)
	return (
		<span className={`inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-[12px] font-[650] ${REQUIRED} ${active ? "ring-2 ring-white/60" : ""}`}>
			{onClick ? (
				<button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-1" aria-haspopup="dialog" aria-expanded={active}>
					{body}
				</button>
			) : (
				<span className="flex items-center gap-1">{body}</span>
			)}
			{onRemove ? (
				<button type="button" onClick={onRemove} aria-label={`Remove ${word.label}`} className="ml-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white">
					<XMarkIcon className="h-3 w-3" aria-hidden />
				</button>
			) : (
				<span className="w-1" />
			)}
		</span>
	)
}

export function SetAsideChip({ phrase, by }: { phrase: string; by: Word }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-gray-400" title={`Your ${by.label} filter decides this`}>
			<span className="line-through decoration-gray-500">{phrase}</span>
			<span className="text-[11px] text-gray-500">{by.label} wins</span>
		</span>
	)
}

export function NotChip({ clause }: { clause: string }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[#b4c1d3]">
			<small className="text-[10px] text-[#9ba9bb]">Not</small>
			<strong className="font-[550] line-through decoration-[1.5px]">{clause}</strong>
		</span>
	)
}

/** "→ 46 titles" for an action, asked when shown. */
export function WhatIf({ next, shown = true }: { next: URLSearchParams | null; shown?: boolean }) {
	const result = useWhatIf(next, shown)
	if (!result) return null
	if (result.browse) return <span className="text-gray-500 tabular-nums">browse</span>
	if (result.total === null) return <span className="text-gray-500 tabular-nums">…</span>
	return (
		<span className="tabular-nums text-gray-300">
			{result.total.toLocaleString("en")} {result.total === 1 ? "title" : "titles"}
		</span>
	)
}

/** A plain action row: label, what it does, the count it would give. */
export function ActionRow({
	label,
	detail,
	next,
	onGo,
	shown = true,
}: { label: string; detail?: string; next: URLSearchParams; onGo: (n: URLSearchParams) => void; shown?: boolean }) {
	return (
		<button type="button" onClick={() => onGo(next)} className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-white/[0.07]">
			<span>
				<span className="block text-[13px] font-semibold text-white">{label}</span>
				{detail && <span className="block text-[12px] leading-snug text-gray-400">{detail}</span>}
			</span>
			<span className="shrink-0 pt-0.5 text-[12px]">
				<WhatIf next={next} shown={shown} />
			</span>
		</button>
	)
}

/** A small dialog under its anchor (desktop) or as a bottom sheet (phone). Escape or a press outside closes it. */
export function Pop({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest("[aria-haspopup=dialog]")) onClose()
		}
		window.addEventListener("keydown", key)
		window.addEventListener("pointerdown", down)
		return () => {
			window.removeEventListener("keydown", key)
			window.removeEventListener("pointerdown", down)
		}
	}, [open, onClose])
	if (!open) return null
	return (
		<div
			ref={ref}
			role="dialog"
			aria-label={label}
			className="fixed inset-x-2 bottom-2 z-[60] max-h-[70vh] overflow-y-auto rounded-2xl bg-gray-900 p-2 shadow-2xl ring-1 ring-white/15 lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-full lg:mt-2 lg:w-[360px]"
		>
			{children}
		</div>
	)
}

export function useOpenKey() {
	const [open, setOpen] = useState<string | null>(null)
	return { open, toggle: (key: string) => setOpen((o) => (o === key ? null : key)), close: () => setOpen(null) }
}

export const wordKey = (w: Word) => `${w.param}=${w.value}`

/** The counts line for a readout: total, and how many carry the tags the words were read as. */
export function countsLine(r: Readout): string {
	if (r.catalogue || r.branch !== "positive") return `${r.total.toLocaleString("en")} titles`
	return `${r.total.toLocaleString("en")} titles · ${r.originalInList.toLocaleString("en")} tagged ${r.prefs.map((p) => p.label).join(" and ")}`
}
