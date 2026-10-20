// Home: a row of tiles along the bottom, and above it the one that has the focus, large, with its picture behind
// everything. The apps come first; after them a tile for each of the person's two streaming services, with the
// service's mark, which opens "On <service>" as its key on the Remote does. Nothing here leaves the TV: OK on a
// tile opens it on the TV.
//
// A member with Sides of you gets home as a guide instead, on the desktop edition (HomeGuide.tsx, #673).
//
// The headline is the start page's H1, the same sentence for a guest and a member. Until the pool is there, a
// guest's home is drawn from the start titles alone, so the server's HTML is the same for every guest.
import { useRef } from "react"
import { ServiceMark, hasDrawnMark, serviceColor } from "../../Remote"
import { CornerBar, Cross, Item, Shade, backdropSize, useTvView } from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import type {
	TvAppArt,
	TvAppTile,
	TvHomeSide,
	TvService,
	TvServiceTile,
} from "../tv-home"
import { HomeGuide } from "./HomeGuide"
import { AppArt, artFiles } from "./app-art"

export const HOME_HEADLINE = "Let's find something good to watch next."

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
}: {
	apps: readonly TvAppTile[]
	/** The person's two streaming services, after the apps. */
	services?: readonly TvServiceTile[]
	/** A member's taste groups: with any, the desktop's home is the guide. */
	sides?: readonly TvHomeSide[]
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
}) {
	const phone = useTvView().canvas.edition === "phone"
	if (sides.length && !phone)
		return (
			<HomeGuide
				headline={HOME_HEADLINE}
				apps={apps}
				sides={sides}
				items={items}
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
	const last = useRef(tiles[0].id)
	if (tiles.some((tile) => tile.id === focused)) last.current = focused
	const shown = tiles.find((tile) => tile.id === last.current) ?? tiles[0]
	// One file per picture: a tile shows the file the whole picture uses, so its app's picture is there when the
	// tile takes the focus.
	const backdrop = backdropSize(canvas)
	const whole = artFiles(shown.art, backdrop, "w342")
	return (
		<>
			<Cross id={`${shown.id} ${whole.join(" ")}`} files={whole}>
				<AppArt art={shown.art} files={whole} className="h-full w-full" />
			</Cross>
			<Shade dim={0.5} />
			<div
				// The toast takes this place while it shows (TvScreen.tsx).
				className={`absolute font-bold uppercase tracking-[0.22em] text-white/80 transition-opacity [[data-tv-toast]_&]:opacity-0 ${P ? "left-5 top-[28px] text-[20px]" : "left-14 top-11 text-[22px]"}`}
			>
				GoodWatch
			</div>
			<div
				className={`absolute ${P ? "inset-x-5 top-[82px]" : "left-14 top-[136px] w-[780px]"}`}
			>
				<h1 className={`text-white/75 ${P ? "text-[20px]" : "text-[28px]"}`}>
					{HOME_HEADLINE}
				</h1>
				<div key={shown.id} className="tvc-fade">
					<div
						className="font-bold leading-[0.95] tracking-tight"
						style={{ fontSize: P ? 56 : 108 }}
					>
						{shown.name}
					</div>
					<div
						className={`leading-snug text-white/85 ${P ? "mt-2 text-[21px]" : "mt-4 text-[32px]"}`}
					>
						{shown.line}
					</div>
				</div>
			</div>
			<div
				{...{ [TV_ROW_ATTR]: "" }}
				className={`absolute inset-x-0 bottom-0 flex overflow-hidden ${P ? "gap-3.5 px-5 pb-5 pt-4" : "gap-[22px] px-14 pb-12 pt-6"}`}
			>
				{tiles.map((a) => (
					<Item
						key={a.id}
						id={a.id}
						// A service's mark is a picture: its tile says what it opens.
						label={a.service ? `On ${a.service.name}` : undefined}
						className="tvc-tile shrink-0"
						style={
							P ? { width: 172, height: 110 } : { width: 200, height: 128 }
						}
					>
						<AppArt
							art={a.art}
							files={artFiles(a.art, backdrop, "w154")}
							className="absolute inset-0 h-full w-full"
						/>
						<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
						{a.service ? (
							<span className="absolute inset-x-4 bottom-3 flex items-center gap-2.5">
								<ServiceMark service={a.service} height={P ? 24 : 28} />
								{/* A drawn mark says the name; a logo from the catalog does not. */}
								{!hasDrawnMark(a.service) && (
									<span
										className={`truncate font-bold leading-none ${P ? "text-[21px]" : "text-[23px]"}`}
									>
										{a.name}
									</span>
								)}
							</span>
						) : (
							<span
								className={`absolute bottom-3 left-4 font-bold leading-none ${P ? "text-[23px]" : "text-[26px]"}`}
							>
								{a.name}
							</span>
						)}
						{/* My shows (slice 9): the New episodes signal, in its sky blue; it stays bright on a tile that sits back. */}
						{a.signal && (
							<>
								<span
									aria-hidden
									className="absolute right-2.5 top-2.5 z-[1] flex h-[36px] min-w-[36px] items-center justify-center rounded-full bg-sky-300 px-2 text-[22px] font-bold leading-none text-black"
								>
									{a.signal.badge}
								</span>
								<span className="sr-only">{a.signal.label}</span>
							</>
						)}
					</Item>
				))}
			</div>
			{/* Last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}
