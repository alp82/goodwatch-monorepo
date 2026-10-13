// The parts every screen of the new TV is drawn with, in the look "Cinema": the art does the work. The picture
// takes the backdrop of whatever has the focus and cross-fades as the focus moves; the focused item comes forward
// while the others sit back in the dark. Sizes are in TV canvas pixels (1200 x 648 on the desktop, 500 wide on the
// phone): no type under 20, and no focus target under 44 px on a phone's screen.
//
// The markup contract (tv-dom.ts reads it): a screen and the menu are each a `Layer`, an item is an `Item` (a real
// button with `data-tv-item`, `aria-current` while it has the focus), a row that pages sideways is marked
// `data-tv-row`. The rules are in tv.css.
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
	useState,
} from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { ICON, Icon } from "../Remote"
import type { TvCanvas } from "./room-tv"
import { TV_ITEM_ATTR, TV_LAYER_ATTR } from "./tv-dom"
import type { TvAction } from "./tv-machine"

/** What a screen knows about the TV it is drawn on. */
export type TvView = {
	canvas: TvCanvas
	/** The focused item of the topmost layer. */
	focused: string
	dispatch: (action: TvAction) => void
}

const ViewContext = createContext<TvView | null>(null)
export const TvViewProvider = ViewContext.Provider

export function useTvView(): TvView {
	const view = useContext(ViewContext)
	if (!view) throw new Error("A TV screen is drawn inside TvScreen")
	return view
}

/** The phone edition: its canvas is 500 wide and its bar's keys are icons. */
export const usePhone = () => useTvView().canvas.edition === "phone"

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
	className = "",
	style,
	children,
}: {
	id: string
	/** For a screen reader, where the item shows a picture or an icon alone. */
	label?: string
	className?: string
	style?: CSSProperties
	children: ReactNode
}) {
	const view = useTvView()
	const on = view.focused === id
	return (
		<button
			type="button"
			{...{ [TV_ITEM_ATTR]: id }}
			aria-current={on || undefined}
			aria-label={label}
			// SEAM (slice 4): the ring pointer and touch pointing take the place of these two, and dispatch the same.
			// A move, not an enter: an item that comes to lie under a resting cursor (a new screen, a row that pages)
			// must not take the focus from the keys.
			onMouseMove={() => {
				if (!on) view.dispatch({ type: "focus", item: id })
			}}
			onClick={() => view.dispatch({ type: "choose", item: id })}
			className={`tvc-item ${on ? "tvc-on" : ""} ${className}`}
			style={style}
		>
			{children}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Pictures.

/** The backdrop file for a picture this many canvas pixels wide: `w780` under 900 px on the window, `w1280` above. */
export function backdropSize(canvas: TvCanvas, width = canvas.w): string {
	return canvas.edition === "desktop" && width * canvas.scale >= 900
		? "w1280"
		: "w780"
}

export function Img({
	src,
	className = "",
}: { src: string; className?: string }) {
	const { canvas } = useTvView()
	return (
		<img
			src={src}
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
	}, [id, key])
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
	const P = usePhone()
	return (
		<div
			className={`flex shrink-0 items-center ${P ? "gap-2" : "gap-2.5"} ${className}`}
		>
			{BAR_KEYS.filter((key) => items.includes(key.id)).map((key) => (
				<Item
					key={key.id}
					id={key.id}
					label={key.label}
					className={`tvc-act flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "h-[54px] w-[54px]" : "h-[64px] gap-2.5 px-5 text-[24px]"}`}
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

/** Where a screen without a `Frame` puts the bar: the picture's top right corner. */
export function CornerBar({ items }: { items: readonly string[] }) {
	const P = usePhone()
	return (
		<Bar
			items={items}
			className={`absolute z-10 ${P ? "right-5 top-3" : "right-14 top-[22px]"}`}
		/>
	)
}

/**
 * A screen with the top bar: its name and crumb on the left, the bar's keys on the right, the content under it.
 * The Expand key's place is the picture's bottom right corner, on the desktop and on the phone.
 * SEAM (slice 11): the Expand key is drawn into `expand`; `reserve` keeps the band under the content free for it
 * on the desktop, where a screen fills its width. On the phone every screen leaves the corner free itself.
 */
export function Frame({
	name,
	crumb,
	items,
	art,
	dim = 0.6,
	reserve = false,
	expand,
	children,
}: {
	name: string
	crumb?: string
	items: readonly string[]
	/** The backdrop behind the screen. */
	art?: string
	dim?: number
	reserve?: boolean
	expand?: ReactNode
	children: ReactNode
}) {
	const P = usePhone()
	return (
		<>
			{art && <Ambient src={art} />}
			<Shade dim={dim} />
			<div
				className={`absolute inset-x-0 bottom-0 ${P ? "top-[78px] overflow-hidden px-5 pb-5" : `top-[108px] px-14 ${reserve ? "pb-[120px]" : "pb-10"}`}`}
			>
				{children}
			</div>
			<div
				data-tv-expand-place
				className={`absolute z-10 ${P ? "bottom-5 right-5" : "bottom-10 right-14"}`}
			>
				{expand}
			</div>
			{/* The bar is last in the markup, as in `tvItems`: the items are met in reading order. */}
			<div
				className={`absolute inset-x-0 top-0 flex items-center justify-between gap-4 ${P ? "h-[78px] px-5" : "h-[108px] px-14"}`}
			>
				<div className="min-w-0 flex-1">
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
				</div>
				<Bar items={items} />
			</div>
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
