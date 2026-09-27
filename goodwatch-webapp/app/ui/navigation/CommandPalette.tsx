// The command palette: one field that goes anywhere. As soon as anything is typed, its first suggestion is
// "Search for …" (the search page), then up to five matching titles, then matching destinations ("Go to Taste"), then
// Sign up for guests. Empty, it shows the destinations and the viewer's recent searches. A combobox over a listbox:
// Up and Down move the active option, Enter runs it; Escape closes the dialog around it.
import {
	ArrowRightEndOnRectangleIcon,
	ClockIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"
import { Link, useLocation, useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import {
	type ComponentType,
	type SVGProps,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import { useFeatures } from "~/hooks/useFeature"
import { useUser } from "~/utils/auth"
import {
	MIN_PREFIX_CHARS,
	type PaletteTitle,
	normalizePrefix,
	paletteTitlePath,
} from "~/utils/command-palette"
import { tmdbImage, useSignUpHref } from "./bits"
import {
	type DestinationKey,
	currentDestination,
	getDestinations,
	searchHref,
} from "./destinations"
import { useTonightsPick } from "./useTonightsPick"

const PLACEHOLDER = "Search or go to…"
/** Waits this long after the last keystroke before asking for titles. */
const DEBOUNCE_MS = 150
const RECENT_KEY = "goodwatch.recent-searches"
const RECENT_MAX = 5

/** The destinations the palette offers, in this order; ones whose page is off for the viewer are left out. */
const PALETTE_DESTINATIONS: DestinationKey[] = [
	"home",
	"watchNext",
	"discover",
	"taste",
	"explorer",
	"movies",
	"shows",
]

interface Row {
	key: string
	label: string
	sub?: string
	href: string
	/** Set on rows that run a search, so it joins the recent searches. */
	search?: string
	icon?: ComponentType<SVGProps<SVGSVGElement>>
	poster?: string | null
}

// Recent searches live in this browser only (they're the viewer's own text), read and written defensively: storage
// can be missing or throw in private windows.
function readRecent(): string[] {
	try {
		const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
		return Array.isArray(stored)
			? stored.filter((q) => typeof q === "string").slice(0, RECENT_MAX)
			: []
	} catch {
		return []
	}
}

function rememberSearch(q: string) {
	try {
		const recent = [
			q,
			...readRecent().filter(
				(other) => other.toLowerCase() !== q.toLowerCase(),
			),
		].slice(0, RECENT_MAX)
		localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
	} catch {
		// Recent searches are a convenience; without storage there are none.
	}
}

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), ms)
		return () => clearTimeout(timer)
	}, [value, ms])
	return debounced
}

async function fetchTitles(
	prefix: string,
	signal: AbortSignal,
): Promise<PaletteTitle[]> {
	const response = await fetch(
		`/api/command-palette?q=${encodeURIComponent(prefix)}`,
		{ signal },
	)
	if (!response.ok) throw new Error(`Command palette: ${response.status}`)
	return ((await response.json()) as { titles: PaletteTitle[] }).titles
}

/** Matching titles for the typed text, looked up once typing pauses. */
function usePaletteTitles(q: string): PaletteTitle[] {
	const prefix = useDebounced(normalizePrefix(q), DEBOUNCE_MS)
	const typed = normalizePrefix(q).length >= MIN_PREFIX_CHARS
	const query = useQuery({
		queryKey: ["command-palette", prefix],
		queryFn: ({ signal }) => fetchTitles(prefix, signal),
		enabled: prefix.length >= MIN_PREFIX_CHARS,
		staleTime: 5 * 60 * 1000,
		// While the next prefix loads, the last titles stay, so the list doesn't jump on every keystroke.
		placeholderData: (previous) => previous,
	})
	return typed ? (query.data ?? []) : []
}

export function CommandPalette({ onDone }: { onDone: () => void }) {
	const navigate = useNavigate()
	const { pathname, search } = useLocation()
	const { user } = useUser()
	const signUp = useSignUpHref()
	const features = useFeatures()
	const { pick } = useTonightsPick()
	const [q, setQ] = useState(() =>
		pathname === "/search" ? (new URLSearchParams(search).get("q") ?? "") : "",
	)
	const [active, setActive] = useState(0)
	const [recent, setRecent] = useState<string[]>([])
	useEffect(() => setRecent(readRecent()), [])
	const titles = usePaletteTitles(q)
	const id = useId()
	const field = useRef<HTMLInputElement>(null)
	// Headless UI moves initial focus to data-autofocus only without touch, and focuses the panel itself on phones,
	// after this mounts; the next frame puts it in the field, so the keyboard comes up.
	useEffect(() => {
		const frame = requestAnimationFrame(() => field.current?.focus())
		return () => cancelAnimationFrame(frame)
	}, [])

	const trimmed = q.trim()
	const needle = trimmed.toLowerCase()
	const rows = useMemo(() => {
		const destinations = getDestinations(features)
		const here = currentDestination(pathname)
		const result: Row[] = []
		if (trimmed)
			result.push({
				key: "search",
				label: `Search for “${trimmed}”`,
				href: searchHref(trimmed),
				search: trimmed,
				icon: MagnifyingGlassIcon,
			})
		for (const title of titles)
			result.push({
				key: `title-${title.mediaType}-${title.tmdbId}`,
				label: title.title,
				sub: [title.mediaType === "show" ? "Series" : "Movie", title.year]
					.filter(Boolean)
					.join(", "),
				href: paletteTitlePath(title),
				poster: title.posterPath,
			})
		for (const key of PALETTE_DESTINATIONS) {
			const destination = destinations[key]
			if (!destination.available) continue
			const words = `${destination.label} ${destination.short}`.toLowerCase()
			if (needle && !words.includes(needle)) continue
			result.push({
				key: `go-${key}`,
				label: `Go to ${destination.label}`,
				sub:
					here === key
						? "You're here"
						: key === "watchNext" && pick
							? `${pick.title.title} is up next`
							: undefined,
				href: destination.href,
				icon: destination.icon,
			})
		}
		if (!trimmed)
			for (const text of recent)
				result.push({
					key: `recent-${text}`,
					label: text,
					sub: "Recent search",
					href: searchHref(text),
					search: text,
					icon: ClockIcon,
				})
		if (!user && (!needle || "sign up".includes(needle)))
			result.push({
				key: "sign-up",
				label: "Sign up",
				sub: "Keep your Wishlist and let Best match learn your taste",
				href: signUp,
				icon: ArrowRightEndOnRectangleIcon,
			})
		return result
	}, [features, pathname, trimmed, needle, titles, pick, recent, user, signUp])

	const at = Math.min(active, rows.length - 1)
	const optionId = (index: number) => `${id}-option-${index}`

	// Keep the active option in view while the arrow keys move it.
	useEffect(() => {
		if (at < 0) return
		document.getElementById(optionId(at))?.scrollIntoView({ block: "nearest" })
	})

	const run = (row: Row) => {
		if (row.search) rememberSearch(row.search)
		navigate(row.href)
		onDone()
	}

	return (
		<div className="search-private ph-no-capture sentry-mask flex flex-col gap-2.5">
			<div className="flex h-[54px] items-center gap-2.5 rounded-[14px] bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
				<MagnifyingGlassIcon
					className="h-5 w-5 shrink-0 text-gray-300"
					aria-hidden
				/>
				<input
					ref={field}
					// The dialog's initial focus (Headless UI): the palette exists to type into this field.
					data-autofocus
					type="text"
					role="combobox"
					aria-expanded={rows.length > 0}
					aria-controls={`${id}-list`}
					aria-autocomplete="list"
					aria-activedescendant={at >= 0 ? optionId(at) : undefined}
					aria-label={PLACEHOLDER}
					placeholder={PLACEHOLDER}
					autoComplete="off"
					autoCapitalize="off"
					spellCheck={false}
					enterKeyHint="search"
					value={q}
					onChange={(event) => {
						setQ(event.target.value)
						setActive(0)
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault()
							setActive(Math.min(at + 1, rows.length - 1))
						} else if (event.key === "ArrowUp") {
							event.preventDefault()
							setActive(Math.max(at - 1, 0))
						} else if (
							event.key === "Enter" &&
							!event.nativeEvent.isComposing
						) {
							event.preventDefault()
							const row = rows[at]
							if (row) run(row)
						}
					}}
					className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] text-white outline-none placeholder:text-gray-500 focus:ring-0"
				/>
				<kbd className="hidden rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300 lg:block">
					esc
				</kbd>
			</div>
			{/* The combobox pattern: focus stays in the field, which points at the active option, so the listbox and
			    its options aren't focusable themselves, and a native <select> couldn't hold posters and links. */}
			{/* biome-ignore lint/a11y/useFocusableInteractive: see above */}
			<div
				id={`${id}-list`}
				// biome-ignore lint/a11y/useSemanticElements: see above
				role="listbox"
				aria-label="Suggestions"
				className="grid grid-cols-1 gap-0.5"
			>
				{rows.map((row, index) => {
					const Icon = row.icon
					return (
						<Link
							key={row.key}
							id={optionId(index)}
							// biome-ignore lint/a11y/useSemanticElements: an option that is a link (see the listbox above)
							role="option"
							aria-selected={index === at}
							tabIndex={-1}
							to={row.href}
							onMouseMove={() => index !== at && setActive(index)}
							onClick={(event) => {
								// Modified clicks open a new tab and leave the palette as it is.
								if (event.metaKey || event.ctrlKey || event.shiftKey) return
								event.preventDefault()
								run(row)
							}}
							className={`flex min-h-[50px] min-w-0 items-center gap-3 rounded-xl px-3 py-1.5 text-left text-gray-100 ${index === at ? "bg-white/[0.08]" : ""}`}
						>
							{row.poster !== undefined ? (
								row.poster ? (
									<img
										src={tmdbImage(row.poster, "w92")}
										alt=""
										className="h-[42px] w-7 shrink-0 rounded-[5px] object-cover"
									/>
								) : (
									<span className="h-[42px] w-7 shrink-0 rounded-[5px] bg-white/10" />
								)
							) : (
								Icon && (
									<Icon
										className="h-5 w-5 shrink-0 text-amber-400"
										aria-hidden
									/>
								)
							)}
							<span className="flex min-w-0 flex-col">
								<b className="truncate text-[15px]">{row.label}</b>
								{row.sub && (
									<small className="truncate text-[12.5px] text-gray-400">
										{row.sub}
									</small>
								)}
							</span>
						</Link>
					)
				})}
			</div>
		</div>
	)
}
