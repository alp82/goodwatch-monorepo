// The navigation's search entry: the omnibox in the desktop header, the dock's Search key, and the hub sheet's search
// field all open one search dialog, as do ⌘K / Ctrl K and "/" outside text fields. For now the dialog takes a query
// and opens the search page; the command palette (destinations, matching titles, "Search for …" first) replaces its
// body later without changing how it's opened.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useState } from "react"
import { useNavigation } from "./NavigationContext"
import { searchHref } from "./destinations"

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
			className={`flex h-11 items-center gap-1.5 justify-self-end rounded-full pr-4 pl-3 text-[13.5px] font-bold ${on ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.08] text-gray-100"}`}
		>
			<MagnifyingGlassIcon className="h-[22px] w-[22px]" aria-hidden />
			Search
		</button>
	)
}

function SearchForm({ onDone }: { onDone: () => void }) {
	const navigate = useNavigate()
	const [q, setQ] = useState(useCurrentQuery())
	const trimmed = q.trim()
	const run = () => {
		navigate(searchHref(q))
		onDone()
	}
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				run()
			}}
		>
			<div className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)] focus-within:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.6)]">
				<MagnifyingGlassIcon
					className="h-5 w-5 shrink-0 text-gray-400"
					aria-hidden
				/>
				<input
					// The dialog's initial focus (Headless UI): the dialog exists to type into this field.
					data-autofocus
					type="search"
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder={SEARCH_LABEL}
					aria-label={SEARCH_LABEL}
					autoComplete="off"
					className="search-private min-w-0 flex-1 border-0 bg-transparent text-base text-gray-100 outline-none placeholder:text-gray-500"
				/>
				<kbd className="hidden rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300 lg:block">
					esc
				</kbd>
			</div>
			{trimmed && (
				<button
					type="submit"
					className="mt-2 flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-left text-gray-100 hover:bg-white/[0.1]"
				>
					<MagnifyingGlassIcon
						className="h-5 w-5 shrink-0 text-amber-400"
						aria-hidden
					/>
					<b className="truncate">Search for “{trimmed}”</b>
				</button>
			)}
		</form>
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
			aria-label="Search"
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
					<SearchForm onDone={close} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}
