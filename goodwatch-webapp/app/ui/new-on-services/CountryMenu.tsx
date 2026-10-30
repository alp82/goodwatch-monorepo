// New's country menu: a search over the countries with new titles and a list of links, each to that country's page.
// A navigation menu, not a dialog: it closes on a pick, Escape, a click outside or a page change. On phones it is a
// bottom sheet, on desktop a two-column menu under its button, with "Use my country" on top. Loaded on first use
// (./CountryChooser.tsx).
import {
	CheckIcon,
	MagnifyingGlassIcon,
	MapPinIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { Link, useLocation, useNavigate } from "@remix-run/react"
import {
	type KeyboardEvent,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { searchCountries } from "~/ui/discover-bar/watch/watch-choices"
import { useDragToClose } from "~/ui/navigation/useDragToClose"
import { Flag } from "./parts"

export interface CountryChoice {
	code: string
	name: string
	path: string
}

const GUTTER = 16
const GAP = 8

/** Where the menu sits: under its button, inside the window's width, in page coordinates. */
function placeOf(anchor: HTMLElement, width: number) {
	const box = anchor.getBoundingClientRect()
	const room = document.documentElement.clientWidth
	const w = Math.min(width, room - GUTTER * 2)
	const left = Math.min(Math.max(GUTTER, box.left), room - GUTTER - w)
	return { top: box.bottom + window.scrollY + GAP, left, width: w }
}

const phone = () => window.matchMedia("(max-width: 767px)").matches
const finePointer = () => window.matchMedia("(pointer: fine)").matches

export default function CountryMenu({
	choices,
	current,
	home,
	anchor,
	onClose,
}: {
	choices: CountryChoice[]
	current: string
	/** The viewer's own country. */
	home: string
	anchor: HTMLElement
	/** `refocus`: give the focus back to the button (Escape). */
	onClose: (refocus: boolean) => void
}) {
	const id = useId()
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const panel = useRef<HTMLElement | null>(null)
	const input = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState("")
	const [shown, setShown] = useState(false)
	const [sheet] = useState(phone)
	const [place, setPlace] = useState(() => placeOf(anchor, 560))
	const dragRef = useDragToClose(() => onClose(false))

	const mine = choices.find((c) => c.code === home) ?? null
	const rows = useMemo(() => {
		const found = searchCountries(choices, query)
		const text = query.trim().toLowerCase()
		// Names that start with the text come first: "ger" finds Germany before Algeria.
		if (text)
			found.sort(
				(a, b) =>
					Number(!a.name.toLowerCase().startsWith(text)) -
					Number(!b.name.toLowerCase().startsWith(text)),
			)
		return found
	}, [choices, query])

	// In, with opacity and a short slide.
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(true))
		if (finePointer()) input.current?.focus({ preventScroll: true })
		return () => cancelAnimationFrame(frame)
	}, [])

	useLayoutEffect(() => {
		if (sheet) return
		const update = () => setPlace(placeOf(anchor, 560))
		window.addEventListener("resize", update)
		return () => window.removeEventListener("resize", update)
	}, [anchor, sheet])

	// A page change closes it (a pick lands on another country's page of the same route).
	const opened = useRef(pathname)
	useEffect(() => {
		if (pathname !== opened.current) onClose(false)
	}, [pathname, onClose])

	useEffect(() => {
		const outside = (event: PointerEvent) => {
			const target = event.target as Node
			if (panel.current?.contains(target) || anchor.contains(target)) return
			onClose(false)
		}
		const onEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") onClose(true)
		}
		document.addEventListener("pointerdown", outside)
		document.addEventListener("keydown", onEscape)
		return () => {
			document.removeEventListener("pointerdown", outside)
			document.removeEventListener("keydown", onEscape)
		}
	}, [anchor, onClose])

	const links = () =>
		Array.from(
			panel.current?.querySelectorAll<HTMLAnchorElement>("[data-country]") ??
				[],
		)
	const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault()
			links()[0]?.focus()
		}
		if (event.key === "Enter" && rows[0]) {
			event.preventDefault()
			navigate(rows[0].path)
		}
	}
	const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
		event.preventDefault()
		const all = links()
		const at = all.indexOf(document.activeElement as HTMLAnchorElement)
		const next = at + (event.key === "ArrowDown" ? 1 : -1)
		if (next < 0) input.current?.focus()
		else all[Math.min(next, all.length - 1)]?.focus()
	}

	const search = (
		<label className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-white/30">
			<MagnifyingGlassIcon
				className="size-5 shrink-0 text-gray-400"
				aria-hidden
			/>
			<input
				ref={input}
				type="search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={onInputKey}
				placeholder={`Search ${choices.length} countries`}
				aria-label="Search countries"
				aria-controls={`${id}-list`}
				className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
			/>
			{query && (
				<button
					type="button"
					onClick={() => {
						setQuery("")
						input.current?.focus()
					}}
					aria-label="Clear search"
					className="cursor-pointer rounded-full p-1 text-gray-400 hover:text-white"
				>
					<XMarkIcon className="size-4" />
				</button>
			)}
		</label>
	)

	const useMine = mine && (
		<Link
			to={mine.path}
			prefetch="intent"
			aria-current={mine.code === current ? "page" : undefined}
			onClick={() => onClose(false)}
			className="flex min-h-12 shrink-0 items-center gap-3 rounded-xl bg-amber-400/10 px-3 text-left ring-1 ring-amber-400/40 outline-none hover:bg-amber-400/15 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<MapPinIcon className="size-5 shrink-0 text-amber-400" aria-hidden />
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-bold text-white">
					Use my country
				</span>
				<span className="block truncate text-xs text-amber-100/70">
					{mine.name}
					{mine.code === current ? ", shown now" : ""}
				</span>
			</span>
			<Flag country={mine.code} />
		</Link>
	)

	const list = (
		<ul
			id={`${id}-list`}
			aria-label="Countries"
			onKeyDown={onListKey}
			className={`min-h-0 overflow-y-auto overscroll-contain ${sheet ? "flex-1" : "grid max-h-[min(60vh,420px)] grid-cols-2 gap-x-2"}`}
		>
			{rows.map((choice) => {
				const on = choice.code === current
				return (
					<li key={choice.code}>
						<Link
							data-country={choice.code}
							to={choice.path}
							prefetch="intent"
							aria-current={on ? "page" : undefined}
							onClick={() => onClose(false)}
							className={`flex h-11 items-center gap-3 rounded-lg px-2.5 text-sm outline-none focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-amber-400/10 font-bold text-white" : "font-semibold text-gray-200 hover:bg-white/[0.07]"}`}
						>
							<Flag country={choice.code} />
							<span className="min-w-0 flex-1 truncate">{choice.name}</span>
							{on && (
								<CheckIcon
									className="size-4 shrink-0 text-amber-400"
									aria-label="Shown now"
								/>
							)}
						</Link>
					</li>
				)
			})}
			{rows.length === 0 && (
				<li className="px-2.5 py-3 text-sm text-gray-400">
					No country called "{query.trim()}" has new titles.
				</li>
			)}
		</ul>
	)

	if (sheet)
		return createPortal(
			<div className="fixed inset-0 z-[1100]">
				<div
					aria-hidden
					className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
				/>
				<nav
					ref={(element) => {
						panel.current = element
						dragRef(element)
					}}
					aria-label="Choose a country"
					className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col gap-3 rounded-t-3xl bg-gray-900 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10 transition-transform duration-200 ease-out ${shown ? "translate-y-0" : "translate-y-full"}`}
				>
					<span
						aria-hidden
						className="mx-auto h-1 w-10 shrink-0 rounded-full bg-white/20"
					/>
					<p className="text-base font-bold text-white">Choose a country</p>
					{useMine}
					{search}
					{list}
				</nav>
			</div>,
			document.body,
		)

	return createPortal(
		<nav
			ref={panel}
			aria-label="Choose a country"
			style={{ top: place.top, left: place.left, width: place.width }}
			className={`absolute z-[1100] flex flex-col gap-2 rounded-2xl bg-gray-900 p-2 shadow-2xl ring-1 ring-white/15 transition-[opacity,transform] duration-150 ease-out ${shown ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
		>
			{useMine}
			{search}
			{list}
		</nav>,
		document.body,
	)
}
