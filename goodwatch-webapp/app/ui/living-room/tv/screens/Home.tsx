// Home: a row of tiles along the bottom, and above it the one that has the focus, large, with its picture behind
// everything. The apps come first; after them a tile for each of the person's two streaming services, with the
// service's mark, which opens "On <service>" as its key on the Remote does. Nothing here leaves the TV: OK on a
// tile opens it on the TV.
//
// The headline is the start page's H1, the same sentence for a guest and a member. Until the pool is there, a
// guest's home is drawn from the start titles alone, so the server's HTML is the same for every guest.
import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { ServiceMark, hasDrawnMark, serviceColor } from "../../Remote"
import {
	CornerBar,
	Cross,
	Img,
	Item,
	Shade,
	backdropSize,
	useTvView,
} from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import type { TvAppArt, TvAppTile, TvService, TvServiceTile } from "../tv-home"

export const HOME_HEADLINE = "Let's find something good for tonight."

/** Explorer's identity: islands on the sea, joined by dotted bridges. Fills its box. */
function MapArt({ className = "" }: { className?: string }) {
	const islands = [
		[70, 62, 46, 30, 40],
		[200, 44, 54, 34, 150],
		[322, 78, 44, 28, 15],
		[110, 150, 50, 30, 200],
		[250, 150, 56, 34, 320],
	]
	return (
		<svg
			viewBox="0 0 400 220"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#0d2a3a" />
			<path
				d="M70 62L200 44L322 78M70 62L110 150L250 150L322 78M200 44L250 150"
				fill="none"
				stroke="rgba(255,255,255,.4)"
				strokeWidth="3"
				strokeDasharray="1 10"
				strokeLinecap="round"
			/>
			{islands.map(([x, y, rx, ry, hue]) => (
				<ellipse
					key={hue}
					cx={x}
					cy={y}
					rx={rx}
					ry={ry}
					fill={`hsl(${hue} 62% 52%)`}
				/>
			))}
		</svg>
	)
}

/** Taste's identity: the ridges of a fingerprint. Fills its box. */
function PrintArt({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 400 220"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#241538" />
			{[26, 48, 70, 92, 114, 136].map((r, i) => (
				<path
					key={r}
					d={`M${200 - r} 150a${r} ${r * 1.05} 0 0 1 ${r * 2} 0${i % 2 ? `v${20 + i * 4}` : ""}`}
					fill="none"
					stroke="#c4b5fd"
					strokeWidth="10"
					strokeLinecap="round"
					opacity={1 - i * 0.11}
				/>
			))}
		</svg>
	)
}

/** The image files of an app's picture, at the size it is drawn: the whole picture, or a tile. */
function artFiles(art: TvAppArt, backdrop: string, poster: string): string[] {
	if (art.kind === "backdrop")
		return art.path ? [tmdbImageUrl(art.path, backdrop)] : []
	if (art.kind === "posters")
		return art.paths.map((path) => tmdbImageUrl(path, poster))
	return []
}

/** An app's picture. Fills its box. */
function AppArt({
	art,
	files,
	className,
}: { art: TvAppArt; files: readonly string[]; className: string }) {
	if (art.kind === "map") return <MapArt className={className} />
	if (art.kind === "print") return <PrintArt className={className} />
	if (art.kind === "posters")
		return (
			<span className={`flex bg-[#10131c] ${className}`}>
				{files.map((src) => (
					<Img key={src} src={src} className="h-full min-w-0 flex-1" />
				))}
			</span>
		)
	// Without a picture the tile is the dark of the room, or its service's own colour, and its name or mark says
	// what it is.
	return files[0] ? (
		<Img src={files[0]} className={className} />
	) : (
		<span
			className={`block ${className}`}
			style={{
				background: art.color
					? `linear-gradient(160deg, color-mix(in srgb, ${art.color} 58%, #05060a) 0%, color-mix(in srgb, ${art.color} 20%, #05060a) 100%)`
					: "linear-gradient(160deg,#1c2433,#0b0e15)",
			}}
		/>
	)
}

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
	items,
}: {
	apps: readonly TvAppTile[]
	/** The person's two streaming services, after the apps. */
	services?: readonly TvServiceTile[]
	/** The screen's items, from `tvItems`. */
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
