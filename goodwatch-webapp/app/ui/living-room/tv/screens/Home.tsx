// Home: a row of tiles along the bottom, and above it the one that has the focus, large, with its picture behind
// everything. The apps come first; after them a tile for each of the person's two streaming services, with the
// service's mark, which opens "On <service>" as its key on the Remote does. Nothing here leaves the TV: OK on a
// tile opens it on the TV.
//
// A member's home is Start (Start.tsx): Watch next, then the TV's other screens as tiles.
//
// The headline is the start page's H1, the same sentence for a guest and a member. Until the pool is there, a
// guest's home is drawn from the start titles alone, so the server's HTML is the same for every guest.
import { type ReactNode, createContext, useContext, useRef } from "react"
import { ServiceMark, hasDrawnMark, serviceColor } from "../../Remote"
import {
	CornerBar,
	Cross,
	Item,
	PHONE_FOOT,
	PHONE_HEAD,
	PHONE_SIDE,
	PageArrow,
	Shade,
	backdropSize,
	keySize,
	phoneFit,
	useListAnchor,
	usePage,
	useTvView,
} from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import type {
	TvAppArt,
	TvAppTile,
	TvHomeSide,
	TvHomeData,
	TvTonightPick,
	TvService,
	TvServiceTile,
} from "../tv-home"
import { Start } from "./Start"
import { AppArt, artFiles } from "./app-art"

export const HOME_HEADLINE = "Let's find something good to watch next."

/**
 * The phone's column of the headline and the row, under the header: it fits the phone's canvas, and the row shows
 * three tiles at a time with an arrow to either side. On the TV they stand in their own places.
 */
function HomeColumn({ phone, children }: { phone: boolean; children: ReactNode }) {
	if (!phone) return <>{children}</>
	return (
		<div
			className="absolute inset-x-0 bottom-0 flex flex-col justify-end"
			style={{ top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
		>
			{children}
		</div>
	)
}

/**
 * The headline's tag: the start page's H1, unless the page has an H1 of its own ("How GoodWatch works" below the
 * room, for a guest), when it is a paragraph with the same look.
 */
export type HomeHeadingTag = "h1" | "p"
export const HomeHeading = createContext<HomeHeadingTag>("h1")

/** A tile of home's row: an app, or a streaming service. */
type Tile = {
	/** Its item: `app:tonight`, `service:8`. */
	id: string
	name: string
	line: string
	art: TvAppArt
	service?: TvService
	/** My shows' tile: the New episodes signal. */
	signal?: TvAppTile["signal"]
}

export function Home({
	apps,
	services = [],
	sides = [],
	items,
	member = false,
	picks = [],
	popular,
	waiting = false,
	failed = false,
}: {
	member?: boolean
	/** A member's Watch next picks, the next one first. */
	picks?: readonly TvTonightPick[]
	popular?: TvHomeData["popular"]
	waiting?: boolean
	/** The member's picks couldn't be read: not the same as an empty Wishlist. */
	failed?: boolean
	apps: readonly TvAppTile[]
	/** The person's two streaming services, after the apps. */
	services?: readonly TvServiceTile[]
	/** A member's taste groups: with any, the desktop's home is the guide. */
	sides?: readonly TvHomeSide[]
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
}) {
	// A member's home is Start.
	if (member)
		return (
			<Start
				picks={picks}
				popular={popular}
				waiting={waiting}
				failed={failed}
				items={items}
				signal={apps.find((a) => a.app === "shows")?.signal}
			/>
		)
	return <HomeRow apps={apps} services={services} items={items} />
}

/** Today's home: the row of tiles. */
function HomeRow({
	apps,
	services,
	items,
}: {
	apps: readonly TvAppTile[]
	services: readonly TvServiceTile[]
	items: readonly string[]
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const Heading = useContext(HomeHeading)
	const tiles: Tile[] = [
		...apps.map((a) => ({ ...a, id: `app:${a.app}` })),
		...services.map(({ service, line, picture }) => ({
			id: `service:${service.id}`,
			name: service.name,
			line,
			art: {
				kind: "backdrop" as const,
				path: picture,
				color: serviceColor(service),
			},
			service,
		})),
	]
	// The tile the home shows large: the one that has the focus, and while the focus is on the bar, the one that
	// had it last.
	const anchor = useListAnchor("home-tiles", tiles.map((tile) => tile.id))
	const last = useRef(anchor ?? tiles[0].id)
	if (tiles.some((tile) => tile.id === focused)) last.current = focused
	const shown = tiles.find((tile) => tile.id === last.current) ?? tiles[0]
	// One file per picture: a tile shows the file the whole picture uses, so its app's picture is there when the
	// tile takes the focus.
	const backdrop = backdropSize(canvas)
	const whole = artFiles(shown.art, backdrop, "w342")
	// The phone's row: three tiles a page.
	const page = usePage(
		tiles.map((tile) => tile.id),
		phoneFit(canvas, 3, 104, 5),
		shown.id,
	)
	const rowTiles = P ? tiles.filter((tile) => page.shown.includes(tile.id)) : tiles
	const arrow = Math.min(keySize(canvas, 54), 70)
	return (
		<>
			<Cross id={`${shown.id} ${whole.join(" ")}`} files={whole}>
				<AppArt art={shown.art} files={whole} className="h-full w-full" />
			</Cross>
			<Shade dim={0.5} />
			{/* The phone's header names the screen; the TV's corner has the wordmark. */}
			{!P && (
				<div
					// The toast takes this place while it shows (TvScreen.tsx).
					className="absolute left-14 top-11 font-bold uppercase tracking-[0.22em] text-white/80 transition-opacity [[data-tv-toast]_&]:opacity-0 text-[22px]"
				>
					GoodWatch
				</div>
			)}
			{/* On the phone the words and the row are one column under the header, and the row pages. */}
			<HomeColumn phone={P}>
				<div
					className={P ? "" : "absolute left-14 top-[136px] w-[780px]"}
				>
					<Heading className={`text-white/75 ${P ? "text-[17px] leading-tight" : "text-[28px]"}`}>
						{HOME_HEADLINE}
					</Heading>
					<div key={shown.id} className="tvc-fade">
						<div
							className="font-bold leading-[0.95] tracking-tight"
							style={{ fontSize: P ? 38 : 108 }}
						>
							{shown.name}
						</div>
						<div
							className={`text-white/85 ${P ? "mt-1 text-[17px] leading-tight" : "mt-4 text-[32px] leading-snug"}`}
						>
							{shown.line}
						</div>
					</div>
				</div>
				<div
					{...(!P && { [TV_ROW_ATTR]: "" })}
					className={`flex ${P ? "mt-2 items-center gap-2" : "absolute inset-x-0 bottom-0 gap-[22px] overflow-hidden px-14 pb-12 pt-6"}`}
				>
					{P && <PageArrow to={page.prev} dir="prev" label="Previous tiles" size={arrow} />}
					{rowTiles.map((a) => (
						<Item
							key={a.id}
							id={a.id}
							// A service's mark is a picture: its tile says what it opens.
							label={a.service ? `On ${a.service.name}` : undefined}
							className="tvc-tile shrink-0"
							style={
								P ? { width: 96, height: 68 } : { width: 200, height: 128 }
							}
						>
							<AppArt
								art={a.art}
								files={artFiles(a.art, backdrop, "w154")}
								className="absolute inset-0 h-full w-full"
							/>
							<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
							{a.service ? (
								<span className={`absolute flex items-center gap-2.5 ${P ? "inset-x-2.5 bottom-2" : "inset-x-4 bottom-3"}`}>
									<ServiceMark service={a.service} height={P ? 20 : 28} />
									{/* A drawn mark says the name; a logo from the catalog does not. */}
									{!hasDrawnMark(a.service) && (
										<span
											className={`truncate font-bold leading-none ${P ? "text-[17px]" : "text-[23px]"}`}
										>
											{a.name}
										</span>
									)}
								</span>
							) : (
								<span
									className={`absolute font-bold leading-none ${P ? "bottom-2 left-2.5 text-[18px]" : "bottom-3 left-4 text-[26px]"}`}
								>
									{a.name}
								</span>
							)}
							{/* My shows (slice 9): the New episodes signal, in its sky blue; it stays bright on a tile that sits back. */}
							{a.signal && (
								<>
									<span
										aria-hidden
										className={`absolute z-[1] flex items-center justify-center rounded-full bg-sky-300 font-bold leading-none text-black ${P ? "right-1.5 top-1.5 h-[26px] min-w-[26px] px-1.5 text-[17px]" : "right-2.5 top-2.5 h-[36px] min-w-[36px] px-2 text-[22px]"}`}
									>
										{a.signal.badge}
									</span>
									<span className="sr-only">{a.signal.label}</span>
								</>
							)}
						</Item>
					))}
					{P && <span className="flex-1" />}
					{P && <PageArrow to={page.next} dir="next" label="More tiles" size={arrow} />}
				</div>
			</HomeColumn>
			{/* Last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}
