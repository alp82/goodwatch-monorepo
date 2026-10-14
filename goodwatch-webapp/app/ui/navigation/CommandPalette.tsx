import useLocale from "~/utils/locale"
import MediaText from "~/ui/media-text/MediaText"
// The command palette: one field that goes anywhere. As soon as anything is typed, its first suggestion is
// "Search for …" (the search page), then up to eight matching titles ending in "Show 120 more" (the search page
// again) when more match, then matching destinations ("Go to Taste"), then Sign up
// for guests. Empty, it shows the destinations. The field sits in the dialog's header and the destinations
// are compact rows, so the search leads. A combobox over a listbox: Up and Down move the active option, Enter runs
// it; Escape closes the dialog around it.
import {
	ArrowRightEndOnRectangleIcon,
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
	type PaletteTitles,
	normalizePrefix,
	paletteTitlePath,
} from "~/utils/command-palette"
import { tmdbImage, useSignUpHref } from "./bits"
import {
	type DestinationKey,
	currentDestination,
	currentSearchQuery,
	getDestinations,
	searchHref,
} from "./destinations"
import { paletteTitlesQuery, shownPaletteTitles } from "./palette-titles"
import { useTonightsPick } from "./useTonightsPick"

const PLACEHOLDER = "Search or go to…"
/**
 * On wider screens, when destinations follow the titles, the titles scroll in a box of their own so the destinations
 * stay in view. On phones the panel fills the screen, so the titles take the room they need and the list scrolls whole.
 */
const TITLES_BOX =
	"lg:max-h-[min(300px,40dvh)] lg:overflow-y-auto lg:overscroll-contain"
/** Waits this long after the last keystroke before asking for titles. */
const DEBOUNCE_MS = 150

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
	language?: string
	key: string
	label: string
	sub?: string
	href: string
	/** A destination: a compact row, so the search field and its results lead. */
	compact?: boolean
	icon?: ComponentType<SVGProps<SVGSVGElement>>
	poster?: string | null
	/** A matching title or the "Show … more" after them: grouped, so they can scroll in a box of their own. */
	title?: boolean
}

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), ms)
		return () => clearTimeout(timer)
	}, [value, ms])
	return debounced
}

/** Matching titles for the typed text, looked up once typing pauses. None when the lookup fails. */
function usePaletteTitles(q: string): PaletteTitles {
	const prefix = useDebounced(normalizePrefix(q), DEBOUNCE_MS)
	const typed = normalizePrefix(q).length >= MIN_PREFIX_CHARS
	const { locale } = useLocale()
	const query = useQuery(paletteTitlesQuery(prefix, locale.language))
	return shownPaletteTitles(typed, query.data)
}

export function CommandPalette({ onDone }: { onDone: () => void }) {
	const navigate = useNavigate()
	const { pathname, search } = useLocation()
	const { user } = useUser()
	const signUp = useSignUpHref()
	const features = useFeatures()
	const { pick } = useTonightsPick()
	const [q, setQ] = useState(() => currentSearchQuery(pathname, search))
	const [active, setActive] = useState(0)
	const { titles, more } = usePaletteTitles(q)
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
				href: searchHref(trimmed, features),
				icon: MagnifyingGlassIcon,
			})
		for (const title of titles)
			result.push({
				key: `title-${title.mediaType}-${title.tmdbId}`,
				label: title.title,
				language: title.presentation?.title.language,
				sub: [title.mediaType === "show" ? "Series" : "Movie", title.year]
					.filter(Boolean)
					.join(", "),
				href: paletteTitlePath(title),
				poster: title.posterPath,
				title: true,
			})
		if (titles.length > 0 && more > 0)
			result.push({
				key: "more",
				label: `Show ${more.toLocaleString("en-US")} more`,
				href: searchHref(trimmed, features),
				compact: true,
				icon: MagnifyingGlassIcon,
				title: true,
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
				compact: true,
				icon: destination.icon,
			})
		}
		if (!user && (!needle || "sign up".includes(needle)))
			result.push({
				key: "sign-up",
				label: "Sign up",
				sub: "Keep your Wishlist and let Best match learn your taste",
				href: signUp,
				icon: ArrowRightEndOnRectangleIcon,
			})
		return result
	}, [features, pathname, trimmed, needle, titles, more, pick, user, signUp])

	const at = Math.min(active, rows.length - 1)
	const optionId = (index: number) => `${id}-option-${index}`

	// Keep the active option in view while the arrow keys move it.
	useEffect(() => {
		if (at < 0) return
		document.getElementById(optionId(at))?.scrollIntoView({ block: "nearest" })
	})

	const run = (row: Row) => {
		navigate(row.href)
		onDone()
	}

	const option = ({ row, index }: IndexedRow) => {
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
				className={`flex min-w-0 shrink-0 items-center rounded-xl px-3 text-left ${row.compact ? "min-h-[38px] gap-2.5 py-1 text-gray-300" : "min-h-[50px] gap-3 py-1.5 text-gray-100"} ${index === at ? "bg-white/[0.08]" : ""}`}
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
							className={`shrink-0 text-amber-400 ${row.compact ? "h-4 w-4" : "h-5 w-5"}`}
							aria-hidden
						/>
					)
				)}
				<span className="flex min-w-0 flex-col">
					{/* The clipping element carries the title's language, so truncation keeps Arabic marks and ends. */}
					<MediaText
						as="b"
						value={{ text: row.label, lang: row.language ?? "en" }}
						className={`truncate ${row.compact ? "text-[13.5px] font-semibold" : "text-[15px]"}`}
					/>
					{row.sub && (
						<small
							className={`truncate text-gray-400 ${row.compact ? "text-[11.5px]" : "text-[12.5px]"}`}
						>
							{row.sub}
						</small>
					)}
				</span>
			</Link>
		)
	}

	return (
		<div className="search-private ph-no-capture sentry-mask flex min-h-0 flex-1 flex-col">
			<header className="shrink-0 border-b border-white/[0.08] px-4 pb-3 lg:p-3.5">
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
			</header>
			{/* The combobox pattern: focus stays in the field, which points at the active option, so the listbox and
			    its options aren't focusable themselves, and a native <select> couldn't hold posters and links. */}
			{/* biome-ignore lint/a11y/useFocusableInteractive: see above */}
			<div
				id={`${id}-list`}
				// biome-ignore lint/a11y/useSemanticElements: see above
				role="listbox"
				aria-label="Suggestions"
				className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(22px+env(safe-area-inset-bottom))] lg:px-3.5 lg:pb-3.5"
			>
				{groupTitles(rows).map((group, i, groups) =>
					Array.isArray(group) ? (
						<div
							key="titles"
							// biome-ignore lint/a11y/useSemanticElements: a group of options inside the listbox
							role="group"
							aria-label="Titles"
							className={`flex shrink-0 flex-col gap-0.5 ${i < groups.length - 1 ? TITLES_BOX : ""}`}
						>
							{group.map(option)}
						</div>
					) : (
						option(group)
					),
				)}
			</div>
		</div>
	)
}

type IndexedRow = { row: Row; index: number }

/** The rows with their indexes, the run of title rows gathered in a list of its own. */
function groupTitles(rows: Row[]): (IndexedRow | IndexedRow[])[] {
	const groups: (IndexedRow | IndexedRow[])[] = []
	let titles: IndexedRow[] | undefined
	rows.forEach((row, index) => {
		if (!row.title) {
			titles = undefined
			groups.push({ row, index })
		} else if (titles) titles.push({ row, index })
		else {
			titles = [{ row, index }]
			groups.push(titles)
		}
	})
	return groups
}
