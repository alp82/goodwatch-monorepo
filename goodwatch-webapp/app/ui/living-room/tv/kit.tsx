// The parts every screen of the new TV is drawn with, in the look "Cinema": the art does the work. The picture
// takes the backdrop of whatever has the focus and cross-fades as the focus moves; the focused item comes forward
// while the others sit back in the dark. Sizes are in TV canvas pixels (1200 x 648 on the desktop, 500 wide on the
// phone): no type under 20, and no focus target under 44 px on a phone's screen.
//
// The markup contract (tv-dom.ts reads it): a screen and the menu are each a `Layer`, an item is an `Item` (a real
// button with `data-tv-item`, `aria-current` while it has the focus), a row that pages sideways is marked
// `data-tv-row`. The rules are in living-room.css.
//
// Rendering budget (#190): only `transform` and `opacity` move, each once per change. An item that is not focused
// is dimmed by an overlay's opacity, not by a filter. A picture is decoded before it fades in, and at most two
// are alive at a time.
import {
	type CSSProperties,
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { useInRouterContext, useLocation } from "@remix-run/react"
import { GoodWatchG, GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { TrailerMark } from "~/ui/details/hero/trailer-mark"
import { ICON, Icon } from "../Remote"
import type { TvCanvas } from "./room-tv"
import { listKeys, tabListMemory } from "./focus-memory"
import { PHONE_TV_CANVAS } from "./room-layout"
import { fitCount, pageAt } from "./screens/phone-paging"
import { TV_ITEM_ATTR, TV_LAYER_ATTR, bringIntoView } from "./tv-dom"
import { type TvAction, jumpItem, jumpTarget } from "./tv-machine"

/** What a screen knows about the TV it is drawn on. */
export type TvView = {
	canvas: TvCanvas
	/** The focused item of the topmost layer. */
	focused: string
	dispatch: (action: TvAction) => void
	/** The page the screen's Expand key opens, as a screen reader hears it ("Discover"). */
	expands?: string | null
	/** The Expand key's words: short and about the page ("Full details", `destinationLabel`). */
	expandLabel?: string | null
	expandHref?: string | null
	/** The navigation's item of the screen on show (`nav:tonight`), marked in the bar; null on other screens. */
	here?: string | null
	/** The person is a member: the white G says Start, not Home. */
	member?: boolean
	/** The pointer left the items: the focused item keeps the focus but does not show it. */
	ringOff?: boolean
	/** The focus came from a mouse or a finger last: a list holds still under it. */
	byPointer?: boolean
	/** The mouse left an item. */
	unpoint?: (id: string) => void
	/** The screen's name, as the phone's header shows it ("Watch next"). */
	screenName?: string
	/** The screen is home (Start, or a guest's Home): the phone's header has no Back there. */
	atHome?: boolean
}

const ViewContext = createContext<TvView | null>(null)
export const TvViewProvider = ViewContext.Provider

export function useTvView(): TvView {
	const view = useContext(ViewContext)
	if (!view) throw new Error("A TV screen is drawn inside TvScreen")
	return view
}

/**
 * The phone's header, in canvas pixels: the white G, the screen's name and Menu (`PhoneHeader`). A phone screen
 * draws under it, in the 480 x 270 canvas's remaining 204 px, and nothing on it scrolls: a list pages by its
 * arrows (`usePage`, `PageArrow`).
 */
export const PHONE_HEAD = 66
/** The phone screen's content box under the header: its sides and its bottom margin, in canvas pixels. */
export const PHONE_SIDE = 16
export const PHONE_FOOT = 10

/**
 * The width a phone screen's content has: the canvas less its sides. 448 upright; on its side the canvas is as wide
 * as the TV is (room-layout.ts, 480 to 810), and so is this.
 */
export const phoneSpan = (canvas: Pick<TvCanvas, "w">) => canvas.w - 2 * PHONE_SIDE

/**
 * How many of a phone row's items show: `base` on the upright canvas, one more for every `step` canvas px the
 * canvas is wider, and never more than `most`. The upright phone keeps exactly what it drew before.
 */
export function phoneFit(
	canvas: Pick<TvCanvas, "w" | "edition">,
	base: number,
	step: number,
	most: number,
): number {
	if (canvas.edition !== "phone") return base
	return fitCount(canvas.w, base, step, most, PHONE_TV_CANVAS.w)
}

/** The phone edition: its canvas is 480 x 270 (wider on its side) and its bar's keys are icons. */
export const usePhone = () => useTvView().canvas.edition === "phone"

/** The smallest side of a touch target, in pixels of the phone's screen. */
export const TOUCH_TARGET = 44

/**
 * How tall a key is on this canvas, in canvas pixels: `drawn`, and on a phone never under 44 px of the phone's
 * screen. A phone's canvas is shown smaller than it is drawn (at 0.66 on a phone 360 wide, at 0.8 on one 430
 * wide), so its keys are drawn that much larger: 67 canvas px on the narrowest phone. Every key of every screen
 * takes its height on the phone from here. Before the window is measured nobody knows the scale, and nothing is
 * painted.
 */
export function keySize(canvas: TvCanvas, drawn: number): number {
	if (canvas.edition !== "phone" || canvas.first) return drawn
	return Math.max(drawn, Math.ceil(TOUCH_TARGET / canvas.scale))
}

/** `keySize` for the canvas a screen is drawn on. */
export const useKeySize = (drawn: number) => keySize(useTvView().canvas, drawn)

/**
 * `keySize` as a length for a style, for the keys the server draws: the top bar's and the Expand key. Before the
 * window is measured the phone's scale is living-room.css's (`--tv-key`, the first paint), so the keys have the height they
 * keep after hydration.
 */
export function keyLength(canvas: TvCanvas, drawn: number): number | string {
	if (canvas.edition === "phone" && canvas.first)
		return `max(${drawn}px, var(--tv-key, ${drawn}px))`
	return keySize(canvas, drawn)
}

// ---------------------------------------------------------------------------------------------------------
// A screen's data. See "How a screen loads its data" in docs/implementation/tv-screen-revamp/tonight-title.

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Hands what a screen's data component holds up to the scene, and takes it back when the component leaves.
 * Before the paint, so the screen is drawn in the same frame as its data component mounts. `value` must keep its
 * identity while nothing in it changed (`useMemo`): every new one is another render of the scene.
 */
export function useReport<T>(report: (value: T | null) => void, value: T) {
	useIsoLayoutEffect(() => {
		report(value)
	}, [report, value])
	useIsoLayoutEffect(() => () => report(null), [report])
}

/** A screen, or an overlay on top of one. The focus moves inside the topmost layer only. */
export function Layer({
	children,
	className = "",
	away = false,
}: {
	children: ReactNode
	className?: string
	/** Under an overlay: the layer takes no input and is not read out. */
	away?: boolean
}) {
	return (
		<div
			{...{ [TV_LAYER_ATTR]: "" }}
			{...(away && { inert: "" })}
			className={`absolute inset-0 overflow-hidden ${className}`}
		>
			{children}
		</div>
	)
}

/** A focusable thing on the TV: pointing at it focuses it, the direction keys move the focus, OK or a click chooses it. */
export function Item({
	id,
	label,
	pressed,
	role,
	className = "",
	style,
	children,
	href,
	linkData,
	prefetchHref,
}: {
	id: string
	href?: string
	linkData?: Record<string, string | number>
	prefetchHref?: string | null
	/** For a screen reader, where the item shows a picture or an icon alone. */
	label?: string
	/** For an item that is on or off, such as a tab: whether it is on. */
	pressed?: boolean
	/** What the item is to a screen reader where a button is not enough: an item of the menu. */
	role?: "menuitem"
	className?: string
	style?: CSSProperties
	children: ReactNode
}) {
	const view = useTvView()
	const focused = view.focused === id
	// The focus shows unless the pointer left the items (use-tv.ts): then it waits for the next key.
	const on = focused && !view.ringOff
	// An item that arrives with the focus is in view at once: its row pages to it before the first paint. A screen
	// can arrive with the focus far along a row (a reload, a link, Back from a page), and the room draws its screen
	// anew once it has measured the window. A focus that moves later is paged to by the TV's hook (use-tv.ts).
	const el = useRef<HTMLButtonElement & HTMLAnchorElement>(null)
	const arrivedOn = useRef(focused)
	// Not when the pointer gave it the focus: it is under the cursor or the finger, and paging to it would pull a
	// phone's column from its end in the middle of a swipe.
	const byPointer = useRef(view.byPointer)
	useIsoLayoutEffect(() => {
		if (arrivedOn.current && !byPointer.current && el.current)
			bringIntoView(el.current, false)
	}, [])
	const Tag = href ? "a" : "button"
	return (
		<Tag
			ref={el}
			href={href}
			target={href ? "_blank" : undefined}
			rel={href ? "noreferrer" : undefined}
			{...linkData}
			type={href ? undefined : "button"}
			{...{ [TV_ITEM_ATTR]: id }}
			data-prefetch-href={prefetchHref || undefined}
			aria-current={focused || undefined}
			aria-label={label}
			aria-pressed={pressed}
			role={role}
			// The mouse: the item under the cursor takes the focus, and the ring shows it (pointing.ts). A finger
			// points through pointing.ts, which gives the focus itself and lets go with this button's click.
			// A move, not an enter: an item that comes to lie under a resting cursor (a new screen, a row that pages)
			// must not take the focus from the keys.
			onPointerMove={(e) => {
				if (!on && e.pointerType === "mouse")
					view.dispatch({ type: "focus", item: id, pointer: true })
			}}
			onPointerLeave={(e) => {
				if (e.pointerType === "mouse") view.unpoint?.(id)
			}}
			onClick={() => view.dispatch({ type: href ? "focus" : "choose", item: id })}
			className={`tvc-item ${on ? "tvc-on" : ""} ${className}`}
			style={style}
		>
			{children}
		</Tag>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Pictures.

/**
 * The backdrop file for a picture this many canvas pixels wide. On the desktop the whole picture is `w1280`, and a
 * smaller one `w780` under 900 px on the window, `w1280` above; on the phone `w780`. The whole picture does not
 * depend on the window's size: the first paint draws it before anything is measured, and hydration keeps its file.
 */
export function backdropSize(canvas: TvCanvas, width = canvas.w): string {
	if (canvas.edition === "phone")
		// A phone on its side draws its wide canvas larger than the file of 780 (2026-10-22): the next file up.
		return !canvas.first && width * canvas.scale > 780 ? "w1280" : "w780"
	return width >= canvas.w || width * canvas.scale >= 900 ? "w1280" : "w780"
}

export function Img({
	src,
	className = "",
	width,
	height,
}: {
	src: string
	className?: string
	/** The file's own size. The box comes from `className`; these only say the picture's shape. */
	width?: number
	height?: number
}) {
	const { canvas } = useTvView()
	return (
		<img
			// Low priority, so that the TV's pictures don't share the connection with the room's (the first screen's
			// largest, its LCP: TvRoom.tsx) while the boot screen covers them; in the window Chrome would raise them
			// (#236). Before the window is measured in both editions: they name the same files, and a hidden copy
			// without it raises the shown one. On a phone also afterwards: a picture whose priority changes while it
			// loads is raised again.
			{...((canvas.first || canvas.edition === "phone") && {
				fetchpriority: "low",
			})}
			src={src}
			width={width}
			height={height}
			alt=""
			draggable={false}
			decoding="async"
			// Before the window is measured both editions are in the HTML and CSS shows one: lazy, so the other's
			// pictures are not requested.
			loading={canvas.first ? "lazy" : undefined}
			className={`object-cover ${className}`}
		/>
	)
}

/**
 * The files a picture needs before it may fade in. A picture waits until they are decoded, so the fade never
 * shows a half-loaded image; one that cannot be decoded fades in as it is.
 */
function useDecoded<T>(next: T, id: string, files: readonly string[]): T {
	const [shown, setShown] = useState({ id, value: next })
	const key = files.join(" ")
	// `next` and the files belong to `id`: the effect runs again for another picture, not for another render.
	useEffect(() => {
		if (id === shown.id) return
		let alive = true
		const show = () => {
			if (alive) setShown({ id, value: next })
		}
		Promise.all(
			files.map((src) => {
				const img = new Image()
				img.src = src
				return img.decode().catch(() => {})
			}),
		).then(show)
		return () => {
			alive = false
		}
		// Also when another picture came to be shown than the one wanted: a picture that finished decoding in the
		// moment the focus moved back would otherwise stay, with nothing left to replace it.
	}, [id, key, shown.id])
	// The same picture drawn anew (other props, the same id) is shown at once.
	return shown.id === id ? next : shown.value
}

/**
 * Fills its box and cross-fades to the next content whenever `id` changes, once `files` are decoded. The last
 * content stays under the new one, so two are alive at a time.
 */
export function Cross({
	id,
	files = [],
	children,
	className = "",
}: {
	id: string
	/** The images in `children`: the swap waits until they are decoded. */
	files?: readonly string[]
	children: ReactNode
	className?: string
}) {
	const ready = useDecoded({ id, node: children }, id, files)
	const [layers, setLayers] = useState({
		id: ready.id,
		beforeId: "",
		before: null as ReactNode,
		node: ready.node,
	})
	if (layers.id !== ready.id)
		setLayers({
			id: ready.id,
			beforeId: layers.id,
			before: layers.node,
			node: ready.node,
		})
	return (
		<div className={`absolute inset-0 overflow-hidden ${className}`}>
			{layers.before && (
				<div key={layers.beforeId} className="absolute inset-0">
					{layers.before}
				</div>
			)}
			<div
				key={ready.id}
				// The first picture of a screen is there at once; only a change fades.
				className={`absolute inset-0 ${layers.beforeId ? "tvc-fade" : ""}`}
			>
				{ready.node}
			</div>
		</div>
	)
}

/** A picture that fills its box and cross-fades to the next one. */
export function Ambient({ src }: { src: string }) {
	return (
		<Cross id={src} files={[src]}>
			<Img src={src} className="h-full w-full" />
		</Cross>
	)
}

/** The shade that keeps type readable on a picture: dark on the left and at the bottom. */
export function Shade({ dim }: { dim: number }) {
	return (
		<div
			className="absolute inset-0"
			style={{
				background: `linear-gradient(90deg, rgba(5,6,10,.94) 0%, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.45}) 100%), linear-gradient(0deg, rgba(5,6,10,.92) 0%, rgba(5,6,10,0) 50%)`,
			}}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The top bar: the same keys, in the same place, on every screen.

const MENU_ICON = "M4 7h16M4 12h16M4 17h16"

const BAR_KEYS = [
	{ id: "bar:back", label: "Back", d: ICON.back },
	{ id: "bar:search", label: "Search", d: ICON.search },
	{ id: "bar:menu", label: "Menu", d: MENU_ICON },
]

/**
 * Back, Search and Menu. They do what the Remote's keys do. A key that has nothing to do is not there: no Back on
 * home, no Search on the search screens (`items` are the screen's, from `tvItems`). On the phone the keys show
 * their icons only.
 */
export function Bar({
	items,
	className = "",
}: { items: readonly string[]; className?: string }) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	// On the phone a key is a round touch target.
	const side = keyLength(canvas, 54)
	return (
		<div
			className={`flex shrink-0 items-center ${P ? "gap-2" : "gap-2.5"} ${className}`}
		>
			{BAR_KEYS.filter((key) => items.includes(key.id)).map((key) => (
				<Item
					key={key.id}
					id={key.id}
					label={key.label}
					className={`tvc-act flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "" : "h-[64px] gap-2.5 px-5 text-[24px]"}`}
					style={P ? { width: side, height: side } : undefined}
				>
					<Icon
						d={key.d}
						className={P ? "h-[26px] w-[26px]" : "h-[28px] w-[28px]"}
					/>
					{!P && key.label}
				</Item>
			))}
		</div>
	)
}

/** Where a screen without a `Frame` puts the bar: the picture's top right corner, or the navigation along the top. */
/** The TV's navigation along the top, tabs and all (`navItems`), as against a screen's bar with the G alone. */
const navigates = (items: readonly string[]) =>
	items.some((id) => id.startsWith("nav:") && id !== "nav:home")

/**
 * The white G on a desktop screen without the navigation: at the picture's top left, before the screen's name. It
 * returns to Start (Home for a guest), as the navigation's does (the owner, 2026-10-22: always there).
 */
function HomeG({ className = "" }: { className?: string }) {
	const { here, member } = useTvView()
	return (
		<Item
			id="nav:home"
			label={member ? "Start" : "Home"}
			pressed={here === "nav:home"}
			// As tall as the bar's keys beside it.
			className={`tvc-act tvc-home flex h-[64px] w-[64px] shrink-0 items-center justify-center ${className}`}
		>
			<GoodWatchG height={28} />
		</Item>
	)
}

export function CornerBar({ items }: { items: readonly string[] }) {
	const P = usePhone()
	if (P) return <PhoneHeader items={items} />
	if (navigates(items)) return <NavBar items={items} />
	return (
		<>
			{items.includes("nav:home") && (
				<HomeG className="absolute left-14 top-[22px] z-10" />
			)}
			<Bar items={items} className="absolute right-14 top-[22px] z-10" />
		</>
	)
}

/** The navigation's tabs, by item: their words, and the phone's shorter ones. */
const NAV_TABS: Record<string, { label: string; short?: string }> = {
	"nav:tonight": { label: "Watch next", short: "Next" },
	"nav:popular": { label: "Popular" },
	"nav:discover": { label: "Discover" },
	"nav:search": { label: "Search" },
	"nav:quiz": { label: "Taste" },
}

/**
 * The navigation along the top of the TV's own screens (tv-machine.ts, `navItems`): the white G, which returns to
 * Start, a tab per screen with the one on show marked, and Menu at the right. On the phone the G and Menu are round
 * touch targets and the tabs say Next, Discover and Search.
 */
export function NavBar({ items }: { items: readonly string[] }) {
	const { canvas, here, member } = useTvView()
	const P = canvas.edition === "phone"
	if (P) return <PhoneHeader items={items} />
	const side = keyLength(canvas, P ? 54 : 56)
	return (
		<nav
			aria-label="TV"
			className={`absolute inset-x-0 top-0 z-10 flex items-center ${P ? "h-[78px] gap-1.5 px-4" : "h-[108px] gap-2 px-12"}`}
		>
			{items.includes("nav:home") && (
				<Item
					id="nav:home"
					label={member ? "Start" : "Home"}
					pressed={here === "nav:home"}
					className={`tvc-act tvc-home flex shrink-0 items-center justify-center ${here === "nav:home" ? "tvc-here" : ""}`}
					style={{ width: side, height: side }}
				>
					<GoodWatchG height={P ? 26 : 28} />
				</Item>
			)}
			<span aria-hidden className={P ? "w-1" : "w-3"} />
			{items
				.filter((id) => NAV_TABS[id])
				.map((id) => {
					const on = here === id
					return (
						<Item
							key={id}
							id={id}
							pressed={on}
							className={`tvc-act tvc-nav flex shrink-0 items-center whitespace-nowrap font-bold ${on ? "tvc-here" : ""} ${P ? "px-3 text-[20px]" : "px-5 text-[23px]"}`}
							style={{ height: side }}
						>
							{P ? (NAV_TABS[id].short ?? NAV_TABS[id].label) : NAV_TABS[id].label}
							{on && (
								<span
									aria-hidden
									className="ml-2 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400"
								/>
							)}
						</Item>
					)
				})}
			{items.includes("bar:menu") && (
				<Item
					id="bar:menu"
					label="Menu"
					className={`tvc-act ml-auto flex shrink-0 items-center justify-center ${P ? "" : "gap-2.5 px-5 text-[23px]"}`}
					style={P ? { width: side, height: side } : { height: side }}
				>
					<Icon d={MENU_ICON} className="h-[26px] w-[26px]" />
					{!P && "Menu"}
				</Item>
			)}
		</nav>
	)
}

/**
 * The phone's header on every screen (the owner, 2026-10-22): the white G, which returns to Start (Home for a
 * guest), the screen's name, and Menu, which lists every TV screen. No tabs: they crowded a phone's width. Back
 * is the Remote's.
 */
export function PhoneHeader({
	items,
	name,
	mark,
}: {
	items: readonly string[]
	/** The screen's name; the screen's own from the TV (`screenName`) when there is none. */
	name?: string
	/** What stands before the name: a service's mark. */
	mark?: ReactNode
}) {
	const { canvas, here, member, screenName, atHome } = useTvView()
	const side = keyLength(canvas, 54)
	const words = name ?? screenName ?? ""
	// The keys are every phone screen's (tv-machine.ts, `tvItems`): Back on every screen but home, the G and Menu.
	// Before the window is measured the screen is drawn with the desktop's items, and the header already has them:
	// nothing appears once the phone is known.
	void items
	return (
		<nav
			aria-label="TV"
			className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3"
			style={{ height: PHONE_HEAD }}
		>
			{/* Back: the Remote's Back key on the screen, an arrow, never the G's way home. */}
			{!atHome && (
				<Item
					id="bar:back"
					label="Back"
					className="tvc-act flex shrink-0 items-center justify-center"
					style={{ width: side, height: side }}
				>
					<Icon d={ICON.back} className="h-[26px] w-[26px]" />
				</Item>
			)}
			<Item
				id="nav:home"
				label={member ? "Start" : "Home"}
				pressed={here === "nav:home"}
				className={`tvc-act tvc-home flex shrink-0 items-center justify-center ${here === "nav:home" ? "tvc-here" : ""}`}
				style={{ width: side, height: side }}
			>
				<GoodWatchG height={26} />
			</Item>
			{/* The toast takes this place while it shows (TvScreen.tsx). */}
			<div className="ml-1 flex min-w-0 flex-1 items-center gap-2.5 transition-opacity [[data-tv-toast]_&]:opacity-0">
				{mark}
				{/* A long name (a title's) takes two lines at a smaller size rather than losing its end. */}
				<span
					className={`font-bold ${words.length > 24 ? "line-clamp-2 text-[18px] leading-[1.1]" : "truncate text-[23px] leading-tight"}`}
				>
					{words}
				</span>
			</div>
			<Item
				id="bar:menu"
				label="Menu"
				className="tvc-act flex shrink-0 items-center justify-center"
				style={{ width: side, height: side }}
			>
				<Icon d={MENU_ICON} className="h-[26px] w-[26px]" />
			</Item>
		</nav>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Tabs on the phone: quiet words with an underline, not pills (2026-10-22). `primary` for a screen's sections
// (Discover's All, Moods, Themes, Styles), `secondary` for parts within one (the fingerprint's Summary, Feel, Story,
// Look): smaller and softer. A tab is a full touch target however small its words; the one on show is underlined,
// and the focus rings it. Nothing grows (living-room.css, `tvc-utab`).

export function Tab({
	id,
	on,
	level = "primary",
	label,
	className = "",
	children,
}: {
	id: string
	/** The tab on show. */
	on: boolean
	level?: "primary" | "secondary"
	label?: string
	className?: string
	children: ReactNode
}) {
	const { canvas } = useTvView()
	return (
		<Item
			id={id}
			pressed={on}
			label={label}
			className={`tvc-utab flex shrink-0 items-center justify-center whitespace-nowrap ${level === "primary" ? "px-2 text-[18px] font-bold" : "tvc-utab-2 px-2 text-[16px] font-semibold"} ${on ? "tvc-utab-on" : ""} ${className}`}
			style={{ height: keySize(canvas, 54), minWidth: keySize(canvas, 0) }}
		>
			{children}
		</Item>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Pages: a phone's list shows a page at a time, with an arrow to either side. Nothing scrolls.

/**
 * The page of `ids` a phone list shows: the one with the focus, else the one it showed last (the focus went to an
 * arrow, the header or a key). The arrows move the focus to the first item of the next page or to the last one of
 * the page before (`jump:<item>`, tv-machine.ts), and the page follows the focus.
 */
export function usePage(
	ids: readonly string[],
	per: number,
	/**
	 * The item the list's page holds while the focus is outside it and nothing on this mount set the page yet: what
	 * the screen's navigation state names (Popular's pick in the address, `useListAnchor`). Back from Details returns
	 * the focus to Details and draws the screen anew; the page comes back with it.
	 */
	anchor?: string | null,
) {
	const { focused } = useTvView()
	// The item the page was set by on this mount; the page follows it, so a page size that changes with the window
	// (a phone turned on its side) keeps the same item in view.
	const last = useRef<string | null>(null)
	if (ids.includes(focused)) last.current = focused
	return pageAt(ids, per, last.current && ids.includes(last.current) ? last.current : anchor)
}

/**
 * The places a list is remembered under, each the list's own (`owner`): its history entry, and the list's own
 * address (the TV's address without the filters step and the focus), which a step that takes the entry's place
 * keeps (Filters, then Done). The filter grid of that step is another list under the same address: with its own
 * name it never takes the results' place (Standards, 2026-10-22). A changed filter changes the address, so the
 * results start again at their first page.
 */
const useEntry = (owner: string): readonly string[] =>
	listKeys(owner, useLocation())
const noEntry = (_owner: string): readonly string[] => []
const noSubscription = () => () => {}

/**
 * A list's place under the history entry on show (focus-memory.ts, `tabListMemory`): the list's item that had the
 * focus last on this entry, remembered as it changes, so a list drawn anew (Back from Details, from a real page)
 * finds its page and its picture again. Null where nothing is remembered, or outside a router (a screen drawn by
 * itself, in the tests). A component is always drawn inside a router or always outside one, so the hooks keep their
 * order.
 */
export function useListAnchor(
	/** Which list of the screen: its place is its own, never another list's under the same address. */
	owner: string,
	ids: readonly string[],
): string | null {
	const { focused } = useTvView()
	const [entry, list] = (useInRouterContext() ? useEntry : noEntry)(owner)
	const memory = () => tabListMemory()
	// Read after hydration only (the server knows no tab's memory), so the server's HTML and the first render agree.
	const byEntry = useSyncExternalStore(
		noSubscription,
		() => (entry ? memory().recall(entry) : null),
		() => null,
	)
	const byList = useSyncExternalStore(
		noSubscription,
		() => (list ? memory().recall(list) : null),
		() => null,
	)
	const on = ids.includes(focused)
	useEffect(() => {
		if (!on) return
		if (entry) memory().remember(entry, focused)
		if (list) memory().remember(list, focused)
	}, [entry, list, on, focused])
	return [byEntry, byList].find((one) => one && ids.includes(one)) ?? null
}

const CHEVRON = { prev: "M15 5l-7 7 7 7", next: "M9 5l7 7-7 7" }

/**
 * A page arrow: a round key with a chevron, or its place kept empty at the list's end, so nothing shifts. `to` is
 * the arrow's item from `usePage`.
 */
export function PageArrow({
	to,
	dir,
	label,
	size,
	className = "",
}: {
	to: string | null
	dir: "prev" | "next"
	/** What a screen reader hears: "Next titles". */
	label: string
	/** Its side; a key's height on this canvas by default. */
	size?: number
	className?: string
}) {
	const { canvas } = useTvView()
	const side = size ?? keySize(canvas, 54)
	if (!to)
		return <span aria-hidden className={`block shrink-0 ${className}`} style={{ width: side, height: side }} />
	return (
		<Item
			id={to}
			label={label}
			className={`tvc-btn tvc-arrow flex shrink-0 items-center justify-center ${className}`}
			style={{ width: side, height: side }}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
				<path d={CHEVRON[dir]} />
			</svg>
		</Item>
	)
}

/** Where a phone list is: "2 / 5", in quiet type. Nothing where it has one page. */
export function PageCount({ page, pages, className = "" }: { page: number; pages: number; className?: string }) {
	if (pages < 2) return null
	return (
		<span className={`shrink-0 text-[17px] font-semibold tabular-nums text-white/60 ${className}`}>
			<span className="sr-only">Page </span>
			{page + 1} / {pages}
		</span>
	)
}

/** Whether an item is a page arrow, and where it leads. */
export { jumpItem, jumpTarget }

// ---------------------------------------------------------------------------------------------------------
// Keys in the site's own looks.

/**
 * The Trailer key: the title page's Trailer button at TV size, a white pill with the red play mark
 * (ui/details/hero/trailer-mark.tsx). The focus rings it; it never grows.
 */
export function TrailerKey({
	label = "Trailer",
	says,
	height,
	className = "",
	id = "trailer",
}: {
	label?: string
	says?: string
	height: number
	className?: string
	id?: string
}) {
	const P = usePhone()
	return (
		<Item
			id={id}
			label={says ?? label}
			className={`tvc-btn tvc-trailer flex shrink-0 items-center whitespace-nowrap ${P ? "gap-2 pl-2 pr-4 text-[19px]" : "gap-3 pl-3 pr-6 text-[23px]"} ${className}`}
			style={{ height }}
		>
			<TrailerMark size={P ? 32 : 40} />
			{label}
		</Item>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The Expand key: the one way out of the TV into a real page.

/** The key's motif on the canvas: a small picture in its brackets. */
const MOTIF = { w: 44, h: 32, arm: 9 }

/**
 * The Expand key: amber corner brackets around a small picture, and the words of where it goes ("Full details",
 * `destinationLabel`). OK on it grows the TV's picture into the page the screen stands for (`destinationHref`,
 * tv-machine.ts). While it has the focus the same brackets come out to the picture's corners (TvRoom.tsx,
 * living-room.css) and its own move out from the small picture: both rest after a few strokes (#190). The picture
 * keeps its size.
 */
export function Expand({
	compact = false,
}: {
	/** On the phone, in a row of tabs: smaller words and motif, the same touch target. */
	compact?: boolean
} = {}) {
	const { canvas, expands, expandLabel, expandHref } = useTvView()
	const P = canvas.edition === "phone"
	const words = expandLabel ?? "Expand"
	const motif = compact ? { w: 30, h: 22, arm: 7 } : MOTIF
	return (
		<Item
			id="expand"
			prefetchHref={expandHref}
			label={expands ? `${words}: opens ${expands} on GoodWatch` : words}
			className={`tvc-x flex shrink-0 items-center whitespace-nowrap ${P ? (compact ? "gap-1.5 px-2.5 text-[17px]" : "gap-2.5 px-3.5 text-[20px]") : "h-[64px] gap-4 px-6 text-[26px]"}`}
			style={P ? { height: keyLength(canvas, 54) } : undefined}
		>
			<span
				className="relative block shrink-0"
				style={{ width: motif.w, height: motif.h }}
			>
				<span className="absolute inset-[30%] rounded-[3px] bg-current opacity-75" />
				{[0, 1, 2, 3].map((corner) => (
					<i
						key={corner}
						className="tvc-x-arm"
						data-corner={corner}
						style={{ width: motif.arm, height: motif.arm }}
					/>
				))}
			</span>
			{words}
		</Item>
	)
}

/**
 * The Expand key in its place, the picture's bottom right corner, on the desktop and on the phone; nothing where
 * the screen has no page to grow into (`items` are the screen's, from `tvItems`).
 */
/**
 * A phone screen's last row: what the screen puts there, then the Expand key at its right end. The key carries
 * where it goes ("Search all titles"), so it is as wide as its words: in the row, what comes before it gives way,
 * where a fixed corner would lie over the last key. The screen's `Frame` takes `inlineExpand`.
 */
export function PhoneFoot({
	items,
	height,
	className = "",
	children,
}: {
	items: readonly string[]
	height: number
	className?: string
	children?: ReactNode
}) {
	return (
		<div className={`flex shrink-0 items-center gap-2 ${className}`} style={{ height }}>
			<div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
			{items.includes("expand") && <Expand />}
		</div>
	)
}

export function ExpandCorner({ items }: { items: readonly string[] }) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const [right, bottom] = P ? [20, 20] : [56, 40]
	return (
		<div
			data-tv-expand-place
			className="tvc-x-place absolute z-10"
			style={{ right, bottom }}
		>
			{items.includes("expand") && <Expand />}
		</div>
	)
}

/**
 * A screen with the top bar: its name and crumb on the left, the bar's keys on the right, the content under it.
 * The Expand key's place is the picture's bottom right corner, on the desktop and on the phone; `reserve` keeps
 * the band under the content free for it on the desktop, where a screen fills its width. On the phone every
 * screen leaves the corner free itself.
 * A service's screen leads with the service's mark (`mark`) and has a line of its colour along the top (`edge`).
 */
export function Frame({
	name,
	crumb,
	items,
	art,
	dim = 0.6,
	reserve = false,
	inlineExpand = false,
	mark,
	edge,
	children,
}: {
	name: string
	crumb?: string
	items: readonly string[]
	/** The backdrop behind the screen. */
	art?: string
	dim?: number
	reserve?: boolean
	/** On the phone the screen draws the Expand key itself, at the end of its scrolling content, instead of the corner. */
	inlineExpand?: boolean
	/** What stands before the screen's name in the top bar. */
	mark?: ReactNode
	/** A colour for a thin line along the picture's top edge. */
	edge?: string
	children: ReactNode
}) {
	const P = usePhone()
	const nav = navigates(items)
	const words = (
		<>
			<div
				className={`truncate font-bold leading-none ${P ? "text-[24px]" : "text-[36px]"}`}
			>
				{name}
			</div>
			{crumb && (
				<div
					className={`mt-1.5 truncate leading-tight text-white/70 ${P ? "text-[20px]" : "text-[24px]"}`}
				>
					{crumb}
				</div>
			)}
		</>
	)
	return (
		<>
			{art && <Ambient src={art} />}
			<Shade dim={dim} />
			{edge && (
				<div
					data-tv-edge
					className="pointer-events-none absolute inset-x-0 top-0 h-1"
					style={{ background: edge }}
				/>
			)}
			{/* On the phone the content fits the box under the header: nothing scrolls, a list pages (`usePage`). */}
			<div
				className={`absolute inset-x-0 bottom-0 ${P ? "overflow-hidden" : `top-[108px] px-14 ${reserve ? "pb-[120px]" : "pb-10"}`}`}
				style={P ? { top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT } : undefined}
			>
				{/* The navigation takes the bar's place, so the crumb stands over the content. */}
				{(nav || P) && crumb ? (
					<div className="flex h-full flex-col">
						<div
							className={`shrink-0 truncate leading-tight text-white/70 ${P ? "pb-1.5 text-[17px]" : "-mt-2 pb-2 text-[21px]"}`}
						>
							{crumb}
						</div>
						<div className="relative min-h-0 flex-1">{children}</div>
					</div>
				) : (
					children
				)}
			</div>
			{!(P && inlineExpand) && <ExpandCorner items={items} />}
			{/* The bar is last in the markup, as in `tvItems`: the items are met in reading order. A screen with the
			    navigation shows it in the bar's place, and its name is the marked tab. */}
			{P ? (
				<PhoneHeader items={items} name={name} mark={mark} />
			) : nav ? (
				<NavBar items={items} />
			) : (
			<div
				className={`absolute inset-x-0 top-0 flex items-center justify-between gap-4 ${P ? "h-[78px] px-5" : "h-[108px] px-14"}`}
			>
				{items.includes("nav:home") && <HomeG />}
				{/* The toast takes this place while it shows (TvScreen.tsx). */}
				<div
					className={`min-w-0 flex-1 transition-opacity [[data-tv-toast]_&]:opacity-0 ${mark ? `flex items-center ${P ? "gap-3" : "gap-5"}` : ""}`}
				>
					{mark}
					{mark ? <div className="min-w-0">{words}</div> : words}
				</div>
				<Bar items={items} />
			</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Power.

/**
 * The boot screen: the wordmark on black. The G scales in and "oodWatch" comes out of it to the right
 * (living-room.css, `lr-boot`); with reduced motion the finished wordmark fades in once.
 */
export function Boot() {
	const P = usePhone()
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-black">
			<GoodWatchWordmark
				gHeight={P ? 44 : 70}
				className="lr-boot"
				gClassName="lr-boot-g"
				textClassName="lr-boot-letters"
			/>
		</div>
	)
}
