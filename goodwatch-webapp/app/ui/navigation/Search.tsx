// The navigation's search entry: the omnibox in the desktop header, the dock's Search key, and the hub sheet's search
// field all open one dialog holding the command palette, as do ⌘K / Ctrl K and "/" outside text fields.
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

/** The search query on screen (Discover's search mode or the search page), shown in the omnibox. */
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
			onClick={() => navigation?.setSearchOpen(true)}
			{...preloadOnIntent}
			aria-haspopup="dialog"
			aria-keyshortcuts="Meta+K Control+K /"
			data-search-entry
			className="flex h-10 w-[320px] items-center gap-2.5 rounded-xl bg-white/[0.06] pr-3 pl-3.5 text-sm whitespace-nowrap text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)] hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)]"
		>
			<MagnifyingGlassIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
			<span className={`truncate ${q ? "text-gray-100" : ""}`}>
				{q || SEARCH_LABEL}
			</span>
			{shortcut && (
				<kbd className="ml-auto rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300">
					{shortcut}
				</kbd>
			)}
		</button>
	)
}

/** The dock's Search key. */
export function DockSearchKey() {
	const navigation = useNavigation()
	const { pathname, search } = useLocation()
	const on =
		pathname === "/search" || Boolean(currentSearchQuery(pathname, search))
	return (
		<button
			type="button"
			onClick={() => navigation?.setSearchOpen(true)}
			{...preloadOnIntent}
			aria-haspopup="dialog"
			data-search-entry
			className={`flex h-11 items-center gap-1.5 justify-self-end rounded-full pr-4 pl-3 text-[13.5px] font-bold ${on ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.08] text-gray-100"}`}
		>
			<MagnifyingGlassIcon className="h-[22px] w-[22px]" aria-hidden />
			Search
		</button>
	)
}

/** The keyboard shortcuts that open the search dialog: ⌘K / Ctrl K, and "/" outside text fields. */
export function useSearchShortcuts() {
	const navigation = useNavigation()
	const setSearchOpen = navigation?.setSearchOpen
	useEffect(() => {
		if (!setSearchOpen) return
		const onKey = (event: KeyboardEvent) => {
			const typing = (event.target as HTMLElement | null)?.closest?.(
				"input, textarea, select, [contenteditable]",
			)
			const command =
				event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)
			if (command || (event.key === "/" && !typing && !event.metaKey)) {
				event.preventDefault()
				// Focus the visible search entry first: the dialog returns focus to what had it, so Escape lands on
				// the omnibox (or the dock's Search key) rather than wherever focus was.
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
