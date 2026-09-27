// The navigation's search entry: the omnibox in the desktop header, the dock's Search key, and the hub sheet's search
// field all open one dialog holding the command palette, as do ⌘K / Ctrl K and "/" outside text fields.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import { useEffect, useState } from "react"
import { CommandPalette } from "./CommandPalette"
import { useNavigation } from "./NavigationContext"

const SEARCH_LABEL = "Search titles, people, moods"

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

/** The search query on the search page, shown in the omnibox and prefilled in the dialog. */
function useCurrentQuery() {
	const { pathname, search } = useLocation()
	return pathname === "/search"
		? (new URLSearchParams(search).get("q") ?? "")
		: ""
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
	const on = useLocation().pathname === "/search"
	return (
		<button
			type="button"
			onClick={() => navigation?.setSearchOpen(true)}
			aria-haspopup="dialog"
			data-search-entry
			className={`flex h-11 items-center gap-1.5 justify-self-end rounded-full pr-4 pl-3 text-[13.5px] font-bold ${on ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.08] text-gray-100"}`}
		>
			<MagnifyingGlassIcon className="h-[22px] w-[22px]" aria-hidden />
			Search
		</button>
	)
}

/** The search dialog, plus the keyboard shortcuts that open it. */
export function SearchDialog() {
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
	if (!navigation) return null
	const close = () => navigation.setSearchOpen(false)
	return (
		<Dialog
			open={navigation.searchOpen}
			onClose={close}
			className="relative z-[1100]"
			aria-label="Search or go to"
		>
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-black/55 transition-opacity duration-200 data-closed:opacity-0"
			/>
			<div className="fixed inset-0 flex flex-col justify-end lg:items-center lg:justify-start lg:pt-[12vh]">
				<DialogPanel
					transition
					className="h-[92%] overflow-y-auto rounded-t-3xl bg-[#0b1120] px-4 pt-4 pb-[calc(22px+env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-9 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-auto lg:max-h-[70vh] lg:w-[640px] lg:rounded-[18px] lg:p-3.5 lg:data-closed:-translate-y-3"
				>
					<CommandPalette onDone={close} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}
