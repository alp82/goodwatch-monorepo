// The navigation's search entry: the omnibox in the desktop header, the phone header's search bar, and the hub sheet's
// search field all open one dialog holding the command palette, as do ⌘K / Ctrl K and "/" outside text fields.
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import { useEffect, useState } from "react"
import { useNavigation } from "./NavigationContext"
import { currentSearchQuery } from "./destinations"

const SEARCH_LABEL = "Search titles, people, moods"

// The dialog and the palette are only on screen once opened. Their code loads when a visitor reaches for a search
// entry (pointer, touch or focus), or at the latest when the dialog opens.
const preloadOnIntent = {
	onPointerEnter: preloadSearch,
	onTouchStart: preloadSearch,
	onFocus: preloadSearch,
}
function preloadSearch() {
	void import("./SearchPanel")
		.then((module) => module.preloadCommandPalette())
		.catch(() => {})
}

/**
 * Brings up the phone keyboard for the search dialog. Phones only show it for a field focused during the tap itself,
 * and the dialog's field mounts a moment later; a hidden field takes focus during the tap, and the palette's field
 * takes it over (focus moving between fields keeps the keyboard up). Call it in the tap's handler.
 */
export function holdKeyboardForSearch() {
	const stand = document.createElement("input")
	stand.setAttribute("aria-hidden", "true")
	stand.tabIndex = -1
	// 16px keeps iOS from zooming in on the field.
	stand.style.cssText =
		"position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none"
	document.body.appendChild(stand)
	stand.focus({ preventScroll: true })
	const remove = () => stand.remove()
	stand.addEventListener("blur", remove, { once: true })
	setTimeout(remove, 3000)
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere; empty until the browser tells which (the server can't). */
function useShortcutLabel() {
	const [label, setLabel] = useState("")
	useEffect(() => {
		const platform =
			(navigator as { userAgentData?: { platform?: string } }).userAgentData
				?.platform ??
			navigator.platform ??
			""
		setLabel(/mac|iphone|ipad|ipod/i.test(platform) ? "⌘K" : "Ctrl K")
	}, [])
	return label
}

/** The search query on screen (Discover's search mode), shown in the omnibox. */
function useCurrentQuery() {
	const { pathname, search } = useLocation()
	return currentSearchQuery(pathname, search)
}

/** The desktop header's omnibox: looks like an input with its shortcut, opens the search dialog. */
export function Omnibox() {
	const navigation = useNavigation()
	const shortcut = useShortcutLabel()
	const q = useCurrentQuery()
	return (
		<button
			type="button"
			onClick={() => navigation.setSearchOpen(true)}
			{...preloadOnIntent}
			aria-haspopup="dialog"
			aria-keyshortcuts="Meta+K Control+K /"
			data-search-entry
			className="flex h-10 w-[400px] items-center gap-2.5 rounded-full bg-linear-180 from-white/[0.09] to-white/[0.04] pr-3 pl-4 text-sm whitespace-nowrap text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)]"
		>
			<MagnifyingGlassIcon
				className="h-[18px] w-[18px] shrink-0 text-amber-400"
				aria-hidden
			/>
			<span className={`truncate ${q ? "text-gray-100" : ""}`}>
				{q || SEARCH_LABEL}
			</span>
			{shortcut && (
				<kbd className="ml-auto rounded-full bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300">
					{shortcut}
				</kbd>
			)}
		</button>
	)
}

/** The phone header's search bar: opens the search dialog with the keyboard up. */
export function HeaderSearchBar() {
	const navigation = useNavigation()
	const q = useCurrentQuery()
	const open = navigation.searchOpen
	return (
		<button
			type="button"
			onClick={() => {
				holdKeyboardForSearch()
				navigation.setSearchOpen(true)
			}}
			{...preloadOnIntent}
			aria-haspopup="dialog"
			aria-label={q ? `${SEARCH_LABEL}: ${q}` : SEARCH_LABEL}
			className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-linear-180 from-white/[0.09] to-white/[0.04] pr-3 pl-3 text-left text-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-shadow ${
				open
					? "shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.75),0_0_18px_-4px_rgba(245,158,11,0.45)]"
					: "hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)]"
			}`}
		>
			<MagnifyingGlassIcon
				className="h-[18px] w-[18px] shrink-0 text-amber-400"
				aria-hidden
			/>
			<span
				aria-hidden
				className={`truncate ${q ? "text-gray-100" : "text-gray-400"}`}
			>
				{q || "Search"}
			</span>
		</button>
	)
}

/** The keyboard shortcuts that open the search dialog: ⌘K / Ctrl K, and "/" outside text fields. */
export function useSearchShortcuts() {
	const { setSearchOpen } = useNavigation()
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const typing = (event.target as HTMLElement | null)?.closest?.(
				"input, textarea, select, [contenteditable]",
			)
			const command =
				event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)
			if (command || (event.key === "/" && !typing && !event.metaKey)) {
				event.preventDefault()
				// Focus the visible search entry first: the dialog returns focus to what had it, so Escape lands on
				// the omnibox rather than wherever focus was.
				for (const entry of document.querySelectorAll<HTMLElement>(
					"[data-search-entry]",
				))
					if (entry.offsetParent) {
						entry.focus()
						break
					}
				setSearchOpen(true)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [setSearchOpen])
}
