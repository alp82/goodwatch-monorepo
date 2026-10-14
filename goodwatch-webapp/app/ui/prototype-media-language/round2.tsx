// PROTOTYPE - throwaway. Small pieces the round-two variants (D to G) of /prototype/media-language share. Every
// control sits in the title bar, and everything that opens from it is an overlay: absolutely placed, with its size
// set before it opens, so nothing on the page moves when it opens, closes or changes its message.
import { type ReactNode, type RefObject, useEffect, useRef } from "react"
import { type Country, type Lang, countryName } from "./fixtures"
import { type LangChoice, langLabel, useStore } from "./model"
import { Flag } from "./parts"

/** What the chip in the title bar says about a value it shows. */
export type ChipState = "saved" | "draft" | "temporary"

export const LANG_CODE: Record<Lang, string> = {
	en: "EN",
	de: "DE",
	fr: "FR",
	es: "ES",
	ja: "JA",
	tr: "TR",
}

/**
 * The pair in the title bar: country and language in one fixed-size button. A draft or an unsaved value adds a dot
 * and a ring, never a word, so the bar keeps its width and height.
 */
export function PairChip({
	country,
	lang,
	state = "saved",
	expanded,
	onClick,
	buttonRef,
	label,
}: {
	country: Country
	lang: Lang
	state?: ChipState
	expanded?: boolean
	onClick: () => void
	buttonRef?: RefObject<HTMLButtonElement>
	label: string
}) {
	return (
		<button
			ref={buttonRef}
			type="button"
			data-pair-chip
			aria-expanded={expanded}
			aria-label={label}
			onClick={onClick}
			className={`relative inline-flex h-9 w-[5.75rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-xs font-semibold tabular-nums text-gray-100 ring-1 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:w-[11.5rem] sm:justify-start sm:px-3 ${
				state === "saved"
					? "bg-white/[0.06] ring-white/15"
					: "bg-amber-300/10 ring-amber-300/60"
			}`}
		>
			<Flag code={country} className="h-3" />
			<span className="sm:hidden">{LANG_CODE[lang]}</span>
			<span className="hidden min-w-0 truncate sm:inline">
				{countryName(country)} · {langLabel(lang)}
			</span>
			{state !== "saved" && (
				<span
					aria-hidden="true"
					className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-black"
				/>
			)}
		</button>
	)
}

/** The spoken name of the pair: values and where each comes from. */
export function pairLabel(
	country: Country,
	countryWord: string,
	lang: Lang,
	langWord: string,
	action: string,
) {
	return `Country ${countryName(country)}, ${countryWord}. Titles in ${langLabel(lang)}, ${langWord}. ${action}`
}

/**
 * Closes an overlay on a press outside it and on Escape, and gives the focus back to its button when the focus would
 * otherwise fall to the page. `locked` keeps it open (a save under way). With `outside` false a press elsewhere on
 * the page leaves it open. An Escape meant for a dialog over it is not its Escape.
 */
export function useOverlay(
	open: boolean,
	onClose: () => void,
	locked = false,
	outside = true,
) {
	const ref = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const was = useRef(open)
	const close = useRef(onClose)
	close.current = onClose
	useEffect(() => {
		if (
			was.current &&
			!open &&
			(!document.activeElement ||
				document.activeElement === document.body ||
				ref.current?.contains(document.activeElement))
		)
			button.current?.focus({ preventScroll: true })
		was.current = open
	}, [open])
	useEffect(() => {
		if (!open) return
		const down = (e: PointerEvent) => {
			if (locked || !outside) return
			const target = e.target as Node
			// The prototype's own controls are not the page: using them leaves the design's overlays alone.
			if ((target as Element).closest?.("[data-proto-chrome]")) return
			if (!ref.current?.contains(target) && !button.current?.contains(target))
				close.current()
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || locked || e.defaultPrevented) return
			const target = e.target as Element
			if (target.closest?.("[role=dialog]") && !ref.current?.contains(target))
				return
			close.current()
			button.current?.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open, locked, outside])
	return { ref, button }
}

/** The panel that opens under the title bar's right end. Its width and height are set, whatever it holds. */
export function HeaderOverlay({
	panelRef,
	label,
	className = "h-[16rem] w-[19rem]",
	children,
}: {
	panelRef: RefObject<HTMLDivElement>
	label: string
	className?: string
	children: ReactNode
}) {
	return (
		<div
			ref={panelRef}
			// biome-ignore lint/a11y/useSemanticElements: a non-modal panel; <dialog> would bring its own top layer and focus rules
			role="dialog"
			aria-label={label}
			data-header-overlay
			className={`absolute right-2 top-full z-40 mt-2 flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-stone-900 shadow-2xl sm:right-4 ${className}`}
		>
			{children}
		</div>
	)
}

/** The draft language as the page shows it, and as a save writes it. */
export function useDraftLang() {
	const s = useStore()
	const savedChoice: LangChoice = s.saved.lang ?? "browser"
	const langOf = (choice: LangChoice | null) =>
		choice === null
			? s.base.lang
			: choice === "browser"
				? s.browserLang
				: choice
	return { savedChoice, langOf }
}
