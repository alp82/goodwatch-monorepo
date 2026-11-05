// The command palette: one field that goes anywhere. Typed, it shows every kind of match in groups (movies, shows,
// people, tropes, moods, genres, sequels, services, lists, pages, members, blog posts): the server's groups
// (/api/command-palette) and the site's pages, matched here in the browser (palette-pages.ts). Before typing it shows
// the member's For you picks (or the For you page's call to action), trending titles, moods, popular tropes, and pages
// to go to (/api/command-palette-start). How each answer is laid out lives in palette-layout.ts.
//
// The "Search ↵" button at the field's end searches Discover for the text: it is the active option while nothing
// else is, so Enter with nothing chosen runs it. A combobox over a listbox: focus stays in the field, Up and Down move
// the active option (group headers, cards, rows), Enter runs it; Tab and Shift+Tab (or Alt+Left and Alt+Right) switch
// the rail's tabs when the rail shows; Escape closes the dialog around it.
import { ArrowTurnDownLeftIcon } from "@heroicons/react/20/solid"
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useLocation, useNavigate } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { openFeedback } from "~/ui/feedback/FeedbackTab"
import { DiscordMark } from "~/ui/footer/links"
import { useUser } from "~/utils/auth"
import {
	MIN_PREFIX_CHARS,
	PALETTE_GROUP_ORDER,
	type PaletteGroup,
	type PaletteItem,
	normalizePrefix,
} from "~/utils/command-palette"
import useLocale from "~/utils/locale"
import { useSignUpHref } from "./bits"
import { currentDestination, searchHref } from "./destinations"
import {
	paletteAnswerQuery,
	paletteStartQuery,
	shownPaletteAnswer,
} from "./palette-answer"
import {
	type Option,
	type PanelGroup,
	type PanelGroupKey,
	type Plan,
	type Tab,
	layoutOptions,
	moodOption,
	nothingPlan,
	resultsPlan,
	searchingPlan,
	startPlan,
	titleOption,
} from "./palette-layout"
import { type PalettePage, matchPages, palettePages } from "./palette-pages"
import { type Ctx, LayoutView } from "./palette-parts"
import { useTonightsPick } from "./useTonightsPick"

const PLACEHOLDER = "Search or go to…"
/** Waits this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 150
/** "Send feedback" opens the Feedback drawer once the palette's dialog has closed (its leave transition is 200 ms). */
const FEEDBACK_AFTER_MS = 250
/** The most pages the Pages group carries, like the server's groups. */
const MAX_PAGES = 12
/** The groups in the panel's order: the server's, with the pages between Lists and Members. */
const PANEL_ORDER: PanelGroupKey[] = PALETTE_GROUP_ORDER.flatMap((key) =>
	key === "lists" ? [key, "pages" as const] : [key],
)
/** The moods to start from when nothing matched. */
const QUICK_MOODS: MoodKey[] = [
	"funny",
	"feelgood",
	"tense",
	"mind",
	"romance",
	"scary",
]
/** The pages to go to before typing: the ones members keep going back to; visitors get the main pages. */
const GO_TO = {
	member: ["profile", "wishlist", "myScores", "myLists", "forYou", "settings"],
	visitor: ["discover", "forYou", "hot", "bestMovies", "signUp", "howItWorks"],
}

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), ms)
		return () => clearTimeout(timer)
	}, [value, ms])
	return debounced
}

/**
 * The server's groups for the typed text, looked up once typing pauses, and whether they answer the text as it is now
 * (not an older prefix's answer kept on screen while the new one loads, and not a lookup still on its way).
 */
function usePaletteGroups(q: string) {
	const now = normalizePrefix(q)
	const prefix = useDebounced(now, DEBOUNCE_MS)
	const typed = now.length >= MIN_PREFIX_CHARS
	const { locale } = useLocale()
	const query = useQuery(paletteAnswerQuery(prefix, locale.language))
	const settled =
		prefix === now &&
		!query.isFetching &&
		(query.isError || (query.isSuccess && !query.isPlaceholderData))
	const groups = shownPaletteAnswer(typed, query.data).groups
	return useMemo(
		() => ({ groups, settled: !typed || settled }),
		[groups, typed, settled],
	)
}

/** The panel's width rule (Tailwind's lg): the rail beside the results and two columns only from here. */
const WIDE = "(min-width: 1024px)"
const watchWide = (change: () => void) => {
	const list = window.matchMedia(WIDE)
	list.addEventListener("change", change)
	return () => list.removeEventListener("change", change)
}
/** Whether the panel is wide; the palette only renders in the browser (LazyDialogs), so the server's guess is moot. */
const useWide = () =>
	useSyncExternalStore(
		watchWide,
		() => window.matchMedia(WIDE).matches,
		() => true,
	)

const itemOption = (item: PaletteItem, group: PanelGroupKey): Option =>
	item.title
		? { ...titleOption(item.title), key: item.key }
		: {
				key: item.key,
				label: item.label,
				sub: item.sub,
				href: item.href,
				image: item.image,
				group,
			}

const serverGroup = (group: PaletteGroup): PanelGroup => ({
	...group,
	items: group.items.map((item) => itemOption(item, group.key)),
})

export function CommandPalette({ onDone }: { onDone: () => void }) {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { user } = useUser()
	const { handle } = useAccountSummary()
	const signUp = useSignUpHref()
	const { pick } = useTonightsPick()
	const wide = useWide()
	// Opens empty: Discover's own field already shows the search on screen.
	const [q, setQ] = useState("")
	const [tabKey, setTabKey] = useState("")
	const [active, setActive] = useState(0)
	const id = useId()
	const field = useRef<HTMLInputElement>(null)
	// Headless UI moves initial focus to data-autofocus only without touch, and focuses the panel itself on phones,
	// after this mounts; the next frame puts it in the field, so the keyboard comes up.
	useEffect(() => {
		const frame = requestAnimationFrame(() => field.current?.focus())
		return () => cancelAnimationFrame(frame)
	}, [])

	const trimmed = q.trim()
	const member = Boolean(user)
	const server = usePaletteGroups(q)
	// Trending fills the no-match state too, so it loads with the panel whatever is typed first.
	const start = useQuery(paletteStartQuery(user?.id ?? "visitor"))
	const pages = useMemo(
		() => palettePages({ member, handle, signUpHref: signUp }),
		[member, handle, signUp],
	)

	const pageOption = useCallback(
		(page: PalettePage, typed: boolean): Option => {
			const here = currentDestination(pathname, handle)
			const isHere = page.destination
				? here === page.destination
				: page.href === pathname
			const pickOn = pick?.href
				? currentDestination(pick.href.split("#")[0], handle)
				: null
			const upNext = pick && page.destination && page.destination === pickOn
			return {
				key: `page-${page.key}`,
				label: page.label,
				sub: isHere
					? "You're here"
					: upNext
						? `${pick.title.title} is up next`
						: typed || page.cta
							? page.sub
							: undefined,
				href: page.href,
				action: page.action,
				icon: page.icon === "discord" ? DiscordMark : page.icon,
				group: "pages",
			}
		},
		[pathname, handle, pick],
	)

	const trending = useMemo(
		() => (start.data?.trending ?? []).map(titleOption),
		[start.data],
	)
	const tropes = useMemo(
		() => (start.data?.tropes ?? []).map((item) => itemOption(item, "tropes")),
		[start.data],
	)

	const plan = useMemo((): Plan => {
		if (!trimmed) {
			const keys = member ? GO_TO.member : GO_TO.visitor
			return startPlan({
				start: start.data,
				failed: start.isError,
				trending,
				moods: MOODS.map((mood) => moodOption(mood)),
				tropes,
				pages: keys.flatMap((key) => {
					const page = pages.find((p) => p.key === key)
					return page ? [pageOption(page, false)] : []
				}),
			})
		}
		const matched = matchPages(pages, trimmed)
		const byKey = new Map<PanelGroupKey, PanelGroup>(
			server.groups.map((group) => [group.key, serverGroup(group)]),
		)
		if (matched.length)
			byKey.set("pages", {
				key: "pages",
				label: "Pages",
				total: matched.length,
				items: matched
					.slice(0, MAX_PAGES)
					.map(({ page }) => pageOption(page, true)),
			})
		const groups = PANEL_ORDER.flatMap((key) => byKey.get(key) ?? [])
		if (groups.length) return resultsPlan(groups, wide)
		if (!server.settled) return searchingPlan
		return nothingPlan(
			trimmed,
			normalizePrefix(trimmed).length < MIN_PREFIX_CHARS,
			QUICK_MOODS.map((key) => moodOption(MOOD_BY_KEY[key], false)),
			trending,
		)
	}, [
		trimmed,
		member,
		start.data,
		start.isError,
		trending,
		tropes,
		pages,
		pageOption,
		server,
		wide,
	])

	const tab: Tab = plan.tabs.find((t) => t.key === tabKey) ?? plan.tabs[0]
	const options = useMemo(() => layoutOptions(tab.layout), [tab])
	const positions = useMemo(
		() => new Map(options.map((option, index) => [option.key, index])),
		[options],
	)
	// Typed text has the Search action before the first option (-1): it's active while nothing else is.
	const floor = trimmed ? -1 : 0
	const at = Math.max(floor, Math.min(active, options.length - 1))
	const optionId = (index: number) =>
		index < 0 ? `${id}-search` : `${id}-option-${index}`
	const listId = `${id}-list`
	const showRail = plan.rail && plan.tabs.length > 1

	// Keep the active option in view while the arrow keys move it; the Search action brings the list back to the top.
	useEffect(() => {
		if (at < 0) document.getElementById(listId)?.scrollTo({ top: 0 })
		else
			document
				.getElementById(optionId(at))
				?.scrollIntoView({ block: "nearest" })
	})

	const showTab = (key: string) => {
		setTabKey(key)
		setActive(floor)
		document.getElementById(listId)?.scrollTo({ top: 0 })
	}
	const go = (href: string, action?: Option["action"]) => {
		if (action === "feedback")
			// After the dialog has handed focus back, so the drawer keeps it.
			setTimeout(() => {
				if (!openFeedback()) navigate(href)
			}, FEEDBACK_AFTER_MS)
		else navigate(href)
		onDone()
	}
	const run = (option: Option) => {
		if (option.opens) {
			showTab(option.opens)
			field.current?.focus()
		} else go(option.href, option.action)
	}
	const search = () => go(searchHref(trimmed))

	const ctx: Ctx = {
		indexOf: (option) => positions.get(option.key) ?? -1,
		active: at,
		optionId,
		setActive,
		run,
	}

	const step = (by: number) => {
		const index = plan.tabs.indexOf(tab)
		const count = plan.tabs.length
		showTab(plan.tabs[(index + by + count) % count].key)
	}
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (showRail && event.key === "Tab") {
			event.preventDefault()
			step(event.shiftKey ? -1 : 1)
		} else if (
			showRail &&
			event.altKey &&
			(event.key === "ArrowLeft" || event.key === "ArrowRight")
		) {
			event.preventDefault()
			step(event.key === "ArrowLeft" ? -1 : 1)
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			setActive(Math.min(at + 1, options.length - 1))
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			setActive(Math.max(at - 1, floor))
		} else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
			event.preventDefault()
			if (at < 0) {
				if (trimmed) search()
			} else {
				const option = options[at]
				if (option) run(option)
			}
		}
	}

	return (
		<div
			className={`search-private ph-no-capture sentry-mask flex min-h-0 w-full flex-1 flex-col ${showRail ? "lg:w-[min(980px,94vw)]" : "lg:w-[640px]"}`}
		>
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
						aria-expanded={options.length > 0}
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={at >= 0 ? optionId(at) : undefined}
						aria-describedby={trimmed ? `${id}-search-hint` : undefined}
						aria-label={PLACEHOLDER}
						placeholder={PLACEHOLDER}
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						enterKeyHint="search"
						value={q}
						onChange={(event) => {
							setQ(event.target.value)
							setTabKey("")
							setActive(event.target.value.trim() ? -1 : 0)
						}}
						onKeyDown={onKeyDown}
						className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] text-white outline-none placeholder:text-gray-500 focus:ring-0"
					/>
					{trimmed && (
						<>
							<span id={`${id}-search-hint`} className="sr-only">
								Enter searches Discover unless a suggestion is chosen.
							</span>
							<button
								id={optionId(-1)}
								type="button"
								onClick={search}
								onMouseMove={() => at !== -1 && setActive(-1)}
								aria-label={`Search Discover for “${trimmed}”`}
								className={`flex h-10 shrink-0 items-center gap-2 rounded-[10px] pr-2.5 pl-3 text-[13.5px] font-semibold ${at === -1 ? "bg-amber-400 text-gray-950" : "bg-white/[0.06] text-gray-200 hover:bg-white/10"}`}
							>
								Search
								<ArrowTurnDownLeftIcon className="h-4 w-4" aria-hidden />
							</button>
						</>
					)}
				</div>
			</header>
			<div
				className={`flex min-h-0 flex-1 flex-col ${showRail ? "lg:flex-row" : ""}`}
			>
				{showRail && (
					<Rail
						tabs={plan.tabs}
						tab={tab}
						listId={listId}
						open={(key) => {
							showTab(key)
							field.current?.focus()
						}}
					/>
				)}
				{/* The combobox pattern: focus stays in the field, which points at the active option, so the listbox and
				    its options aren't focusable themselves, and a native <select> couldn't hold posters and links. */}
				{/* biome-ignore lint/a11y/useFocusableInteractive: see above */}
				<div
					id={listId}
					// biome-ignore lint/a11y/useSemanticElements: see above
					role="listbox"
					aria-label={tab.key === "all" ? "Suggestions" : tab.label}
					className={`flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-4 pb-[calc(22px+env(safe-area-inset-bottom))] lg:px-3 lg:pt-1 lg:pb-3.5 ${showRail ? "lg:min-h-[420px]" : ""}`}
				>
					<LayoutView layout={tab.layout} ctx={ctx} />
				</div>
			</div>
		</div>
	)
}

/**
 * The groups' tabs: a column of names and counts beside the results on desktop, a row of chips under the field on
 * phones. The active one has a straight amber bar at its left edge on desktop.
 */
function Rail({
	tabs,
	tab,
	listId,
	open,
}: {
	tabs: Tab[]
	tab: Tab
	listId: string
	open: (key: string) => void
}) {
	return (
		<nav
			aria-label="Result groups"
			className="flex shrink-0 gap-1.5 overflow-x-auto border-white/[0.08] px-4 py-2.5 lg:w-[220px] lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-r lg:px-2.5 lg:py-3"
		>
			{tabs.map((t) => {
				const on = t.key === tab.key
				return (
					<button
						key={t.key}
						type="button"
						aria-pressed={on}
						aria-controls={listId}
						// Tab and Shift+Tab in the field switch these; focus stays in the field.
						tabIndex={-1}
						onClick={() => open(t.key)}
						className={`flex shrink-0 items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap lg:relative lg:rounded-xl lg:border-0 lg:py-2 ${on ? "border-amber-400/60 bg-white/[0.08] text-white" : "border-white/10 text-gray-400 hover:text-gray-200"}`}
					>
						{on && (
							// A straight bar, square ended, that ignores the item's rounded corners.
							<span
								aria-hidden
								className="absolute top-1 bottom-1 left-0 hidden w-[3px] bg-amber-400 lg:block"
							/>
						)}
						<span className="truncate">{t.label}</span>
						{t.count && (
							<span
								className={`text-[11.5px] tabular-nums ${on ? "text-amber-300" : "text-gray-500"}`}
							>
								{t.count}
							</span>
						)}
					</button>
				)
			})}
		</nav>
	)
}
