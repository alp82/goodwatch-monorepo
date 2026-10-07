// PROTOTYPE for "Prototype native-scroll carousels on title pages", sixth round. Throwaway code: not for production.
//
// The markup of the sea forms (sea1 to sea6), as strings. Each form takes the look of the Explorer (night sea,
// islands with luminous shores and names, posters as places, a proximity card, a minimap, a zoom rail) and shrinks it
// into the related titles section. The data is the fifth round's ring model in a six-direction shape: three axes,
// six directions, every direction graded from "a bit" to "much".
//
// What every form's markup has in common, and what the scripts (ui/prototype-carousels/SeaSection.tsx and
// sea-live.ts) and the checks rely on:
// - `[data-sea-map]` is the stage. It never changes its size. `[data-sea-world]` inside it is the sea: everything on
//   it has a place in world units (`--x`, `--y`, `--w` for the phone layout, `--X`, `--Y`, `--W` for the wide one),
//   and the camera is a transform of the world.
// - a step swaps three parts: `[data-sea-here]` (what lies around the title), `[data-sea-ui]` (the form's controls),
//   and `[data-sea-card]` (the card that names where you are and why).
// - a poster is a button with the direction it lies in (`data-via`) and its rank (`data-rk`, 0 nearest). Never a link.
// - an island is drawn twice: a static SVG with the Explorer's outline formula, which is the picture before the sea
//   wakes, and (once the lazy part runs) by the Explorer's own sea renderer on a canvas under the posters.
import type { CSSProperties, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbImage } from "~/ui/TmdbImage"
import { hexRgb, luminous } from "~/ui/explorer/color"
import { keyOf } from "~/ui/prototype-carousels/dive-model"
import type { PxTitle } from "~/ui/prototype-carousels/explore-model"
import {
	type RingDirection,
	type RingModel,
	type RingPick,
	type RingPos,
	type SeaVariant,
	packOption,
} from "~/ui/prototype-carousels/ring-model"
import { titleToDashed } from "~/utils/helpers"

const pathOf = (title: Pick<PxTitle, "type" | "id" | "title">) =>
	`/${title.type}/${title.id}-${titleToDashed(title.title)}`

// --- Colors: the Explorer's mood islands lend theirs to the directions that mean about the same ---------------

const DIRECTION_COLORS: Record<string, string> = {
	"tone-": "#8ccf4d",
	"tone+": "#6a5aa8",
	"pace-": "#7cc4e8",
	"pace+": "#e8793d",
	"humor-": "#5b7fa8",
	"humor+": "#e2cf55",
	"strange-": "#b98a5a",
	"strange+": "#9b7bea",
	"ideas-": "#9a9460",
	"ideas+": "#3fc1b0",
	"scale-": "#e0607e",
	"scale+": "#e9a23b",
}
const SPARE_COLORS = ["#3fc1b0", "#e0607e", "#e9a23b", "#7cc4e8"]
const HOME_COLOR = "#9fb4e8"

/** "r,g,b" of the tint the Explorer would draw an island of this color in. */
const tintOf = (hex: string) =>
	luminous(hexRgb(hex))
		.map((v) => Math.round(v * 255))
		.join(",")

const colorOf = (direction: RingDirection) =>
	DIRECTION_COLORS[direction.id] ??
	SPARE_COLORS[(direction.slot * 2 + (direction.sign > 0 ? 1 : 0)) % 4]

// --- Islands: the Explorer's outline, as a path ---------------------------------------------------------------

const SEEDS = [0.6, 1.9, 3.1, 4.4, 5.3, 2.5]

/** The shader's wobbly outline for a unit radius (sea/shaders.ts `shape`, sea/canvas2d.ts `outlineRadius`). */
function outlinePath(seed: number) {
	const steps = 40
	let d = ""
	for (let n = 0; n < steps; n++) {
		const a = (n / steps) * Math.PI * 2
		const r =
			1 +
			0.055 * Math.sin(3 * a + seed) +
			0.035 * Math.sin(5 * a + seed * 2.3) +
			0.03 * Math.sin(2 * a + seed * 0.7)
		d += `${n ? "L" : "M"}${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`
	}
	return `${d}Z`
}

/** The outlines, once per section: every island refers to one of them. */
const Outlines = () => (
	<svg width="0" height="0" aria-hidden="true" className="sea-defs">
		<defs>
			{SEEDS.map((seed, i) => (
				<path
					// biome-ignore lint/suspicious/noArrayIndexKey: a constant list.
					key={i}
					id={`sea-o${i}`}
					d={outlinePath(seed)}
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</defs>
	</svg>
)

// --- Places ---------------------------------------------------------------------------------------------------

/** A place on the sea in world units: the middle, and the width. */
interface Pt {
	x: number
	y: number
	w?: number
}
/** A place in the phone layout and in the wide one. */
type Both = { t: Pt; d: Pt }
type Mode = "t" | "d"

const r2 = (v: number) => Math.round(v * 100) / 100

const at = (p: Both, extra?: Record<string, string | number>) =>
	({
		"--x": r2(p.t.x),
		"--y": r2(p.t.y),
		"--w": p.t.w === undefined ? undefined : r2(p.t.w),
		"--X": r2(p.d.x),
		"--Y": r2(p.d.y),
		"--W": p.d.w === undefined ? undefined : r2(p.d.w),
		...extra,
	}) as CSSProperties

const both = (make: (mode: Mode) => Pt): Both => ({ t: make("t"), d: make("d") })

const rad = (deg: number) => (deg * Math.PI) / 180
/** A point at an angle (clockwise from east, in degrees) and a distance, stretched sideways by `kx`. */
const polar = (deg: number, dist: number, kx = 1, ky = 1): Pt => ({
	x: Math.cos(rad(deg)) * dist * kx,
	y: Math.sin(rad(deg)) * dist * ky,
})

/** Where the six directions point. Phone: up and down, and four diagonals. Wide: left and right, and four diagonals. */
const STAR: Record<Mode, Record<string, number>> = {
	t: { w: -90, e: 90, ne: -30, sw: 150, se: 30, nw: -150 },
	d: { w: 180, e: 0, ne: -52, sw: 128, se: 52, nw: -128 },
}

/** `n` posters of width `w` side by side across an arm that points along (dx, dy), around a point. */
function across(c: Pt, dx: number, dy: number, n: number, w: number, gap = 1) {
	const len = Math.hypot(dx, dy) || 1
	const px = -dy / len
	const py = dx / len
	// How far apart two 2:3 posters must be along the perpendicular before they clear each other.
	const space =
		Math.min(
			w / Math.max(Math.abs(px), 1e-6),
			(1.5 * w) / Math.max(Math.abs(py), 1e-6),
		) + gap
	return Array.from({ length: n }, (_, i) => ({
		x: c.x + px * space * (i - (n - 1) / 2),
		y: c.y + py * space * (i - (n - 1) / 2),
		w,
	}))
}

type Entry = { pick: PxTitle | RingPick; back: boolean; rank: number }

/** A direction's posters in order: the title the visitor came from (on the nearest rank), then the titles that way. */
const entriesOf = (direction: RingDirection): Entry[] => [
	...(direction.back ? [{ pick: direction.back, back: true, rank: 0 }] : []),
	...direction.titles.map((pick) => ({ pick, back: false, rank: pick.rank })),
]

/** Entries put on the places of their ranks, in order. Entries without a place are left out. */
function onRanks(entries: Entry[], places: Both[][]) {
	const taken = places.map(() => 0)
	const out: { entry: Entry; place: Both; first: boolean }[] = []
	for (const entry of entries) {
		const place = places[entry.rank]?.[taken[entry.rank]]
		if (!place) continue
		taken[entry.rank]++
		out.push({ entry, place, first: out.length === 0 })
	}
	return out
}

const zip = (t: Pt[], d: Pt[]): Both[] => t.map((p, i) => ({ t: p, d: d[i] }))

// --- Pieces ---------------------------------------------------------------------------------------------------

const RANK_WORDS = ["a bit", "more", "much"]

/** A poster you can sail to. Never a link. */
function Poster({
	entry,
	direction,
	place,
	first,
	width = 64,
	className = "",
	style,
	children,
}: {
	entry: Entry
	direction: RingDirection
	place: Both
	first?: boolean
	width?: number
	className?: string
	style?: Record<string, string | number>
	children?: ReactNode
}) {
	const { pick, back } = entry
	const why = back ? "Where you came from" : (pick as RingPick).why
	return (
		<button
			type="button"
			className={`sea-p sea-at ${className}`}
			style={at(place, style)}
			data-sea-step={keyOf(pick)}
			data-via={direction.id}
			data-sea-slot={first ? "" : undefined}
			data-sea-back={back ? "" : undefined}
			data-rk={entry.rank}
			data-t={pick.title}
			data-y={pick.year}
			data-why={why}
			data-g={back ? "back" : `${direction.label} · ${RANK_WORDS[entry.rank]}`}
			aria-label={
				back
					? `Back to ${pick.title} (${pick.year})`
					: `Sail to ${pick.title} (${pick.year}): ${why}`
			}
		>
			<TmdbImage kind="poster" path={pick.poster} width={width} alt="" />
			{back && (
				<span className="sea-bk" aria-hidden="true">
					↩
				</span>
			)}
			{children}
		</button>
	)
}

/** The title you stand on. */
function Center({
	model,
	place,
	className = "",
}: { model: RingModel; place: Both; className?: string }) {
	return (
		<span className={`sea-c sea-at ${className}`} style={at(place)}>
			<TmdbImage
				kind="poster"
				path={model.center.poster}
				width={104}
				alt={`${model.center.title} (${model.center.year})`}
				priority="eager"
				data-sea-center=""
			/>
		</span>
	)
}

interface Isle {
	key: string
	place: Both
	/** Radius in world units, per layout. */
	r: Both
	color: string
	seed: number
	/** -1 dimmed, 0 normal, 1 in focus: what the Explorer's renderer calls emphasis. */
	emphasis?: number
	/** What a tap on the land does: the spot the camera goes to. */
	go?: string
	label?: string
}

const sized = (isle: Isle): Both => ({
	t: { ...isle.place.t, w: isle.r.t.x * 2.5 },
	d: { ...isle.place.d, w: isle.r.d.x * 2.5 },
})
const radius = (t: number, d: number): Both => ({
	t: { x: t, y: 0 },
	d: { x: d, y: 0 },
})

/** The islands of a scene: all shores first, then all lands, so that islands that touch read as one coast. */
function Isles({ isles }: { isles: Isle[] }) {
	return (
		<>
			{isles.map((isle) => (
				<svg
					key={`s${isle.key}`}
					className="sea-isl sea-shore sea-at"
					viewBox="-1.25 -1.25 2.5 2.5"
					style={at(sized(isle), { "--isl": tintOf(isle.color) })}
					aria-hidden="true"
				>
					<use href={`#sea-o${isle.seed % SEEDS.length}`} />
				</svg>
			))}
			{isles.map((isle) => {
				const props = {
					className: `sea-isl sea-land sea-at${isle.go === undefined ? "" : " sea-tap"}`,
					viewBox: "-1.25 -1.25 2.5 2.5",
					style: at(sized(isle), { "--isl": tintOf(isle.color) }),
					"data-isl": SEEDS[isle.seed % SEEDS.length],
					"data-rgb": tintOf(isle.color),
					"data-em": isle.emphasis ?? 0,
					"data-sea-spot": isle.go === undefined ? undefined : isle.key,
					"data-sea-go": isle.go,
				}
				return isle.go === undefined ? (
					<svg key={`l${isle.key}`} {...props} aria-hidden="true">
						<use href={`#sea-o${isle.seed % SEEDS.length}`} />
					</svg>
				) : (
					<svg
						key={`l${isle.key}`}
						{...props}
						// biome-ignore lint/a11y/useSemanticElements: an island is a shape, and SVG has no button.
						// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: the same.
						role="button"
						tabIndex={0}
						aria-label={isle.label}
					>
						<use href={`#sea-o${isle.seed % SEEDS.length}`} />
					</svg>
				)
			})}
		</>
	)
}

/** An island's name, the way the Explorer writes it: heavy, white, with a line under it. */
function Name({
	direction,
	place,
	sub,
	align = "c",
	className = "",
}: {
	direction: RingDirection
	place: Both
	sub?: string
	align?: "l" | "c" | "r"
	className?: string
}) {
	return (
		<span
			className={`sea-nm sea-a${align} sea-at ${className}`}
			style={at(place, { "--isl": tintOf(colorOf(direction)) })}
			data-sea-label={direction.pos}
		>
			<b>{direction.label}</b>
			{sub && <small>{sub}</small>}
		</span>
	)
}

const countLine = (direction: RingDirection) =>
	direction.titles.length
		? `${direction.titles.length} ${direction.titles.length === 1 ? "title" : "titles"}`
		: (direction.end ?? "nothing close")

const endLine = (direction: RingDirection) => direction.end ?? "nothing close"

const dirProps = (direction: RingDirection) => ({
	"data-dir": direction.id,
	"data-pos": direction.pos,
	"data-end": direction.end ? "" : undefined,
	style: { "--isl": tintOf(colorOf(direction)) } as CSSProperties,
})

const HOME: Both = { t: { x: 0, y: 0 }, d: { x: 0, y: 0 } }
const homeIsle = (t: number, d: number): Isle => ({
	key: "home",
	place: HOME,
	r: radius(t, d),
	color: HOME_COLOR,
	seed: 5,
	emphasis: 1,
})

interface Scene {
	here: ReactNode
	ui?: ReactNode
	hint: string
	/** sea5: the turn of the sea the stage starts with, in degrees. */
	turn?: number
	/** sea6: the island the stage starts on. */
	start?: string
}

// --- sea1: pocket sea. A map wider than the stage, an island per direction, a minimap ---------------------------

const POCKET: Record<Mode, { at: Record<string, Pt>; r: number; rows: number[][]; w: number; cw: number }> = {
	// Phone: the four diagonal islands lie around the title, and lighter and darker lie further out to the sides.
	t: {
		at: {
			w: { x: -88, y: 0 },
			e: { x: 88, y: 0 },
			ne: { x: 34.5, y: -29.5 },
			sw: { x: -34.5, y: 29.5 },
			se: { x: 34.5, y: 29.5 },
			nw: { x: -34.5, y: -29.5 },
		},
		r: 24.5,
		rows: [
			[-5.4, 5.4],
			[-10.6, 0, 10.6],
			[-5.4, 5.4],
		],
		w: 9.4,
		cw: 14.5,
	},
	d: {
		at: {
			w: { x: -60, y: 0 },
			e: { x: 60, y: 0 },
			ne: { x: 27.5, y: -26 },
			sw: { x: -27.5, y: 26 },
			se: { x: 27.5, y: 26 },
			nw: { x: -27.5, y: -26 },
		},
		r: 21.5,
		rows: [
			[-4.7, 4.7],
			[-9.2, 0, 9.2],
			[-4.7, 4.7],
		],
		w: 8.2,
		cw: 12.5,
	},
}

function pocketPlaces(direction: RingDirection): {
	isle: Isle
	ranks: Both[][]
	name: Both
} {
	const make = (mode: Mode) => {
		const table = POCKET[mode]
		const c = table.at[direction.pos]
		const rowGap = table.w * 1.5 + 1
		// The island's name is written on its upper shore, so the titles sit a little low.
		const low = table.r * 0.11
		// The nearest rank is the row that faces the title: the lower row of an island above it, and so on.
		const facing = c.y > 0 ? -1 : 1
		const ranks = table.rows.map((xs, rank) =>
			xs.map((x) => ({
				x: c.x + x,
				y: c.y + low + facing * (1 - rank) * rowGap,
				w: table.w,
			})),
		)
		return {
			c,
			ranks,
			name: { x: c.x, y: c.y - table.r * 0.84 },
		}
	}
	const t = make("t")
	const d = make("d")
	return {
		isle: {
			key: direction.id,
			place: { t: t.c, d: d.c },
			r: radius(POCKET.t.r, POCKET.d.r),
			color: colorOf(direction),
			seed: direction.slot * 2 + (direction.sign > 0 ? 1 : 0),
			emphasis: entriesOf(direction).length ? 0 : -1,
			go: direction.id,
			label: `${direction.label}: look at this island`,
		},
		ranks: t.ranks.map((row, i) => zip(row, d.ranks[i])),
		name: entriesOf(direction).length
			? { t: t.name, d: d.name }
			: { t: t.c, d: d.c },
	}
}

function pocket(model: RingModel): Scene {
	const parts = model.directions.map((direction) => ({
		direction,
		...pocketPlaces(direction),
	}))
	const center: Both = {
		t: { x: 0, y: 0, w: POCKET.t.cw },
		d: { x: 0, y: 0, w: POCKET.d.cw },
	}
	// The minimap shows the phone layout's world: 260 by 130 units.
	const mini = (p: Pt) => ({
		left: `${r2(((p.x + 116) / 232) * 100)}%`,
		top: `${r2(((p.y + 58) / 116) * 100)}%`,
	})
	return {
		hint: "Drag the sea sideways, or tap an island. Tap a poster to sail there.",
		here: (
			<>
				<Isles isles={[homeIsle(12, 10.5), ...parts.map((p) => p.isle)]} />
				<Center model={model} place={center} />
				{parts.map(({ direction, ranks, name }) => (
					<div key={direction.id} className="sea-d" {...dirProps(direction)}>
						<Name
							direction={direction}
							place={name}
							className="sea-nm-s"
							sub={entriesOf(direction).length ? undefined : endLine(direction)}
						/>
						{onRanks(entriesOf(direction), ranks).map(({ entry, place, first }) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								place={place}
								first={first}
							/>
						))}
					</div>
				))}
			</>
		),
		ui: (
			<>
				{/* The names of the two islands beyond the edges, on the phone: a tap goes there. */}
				{parts
					.filter(({ direction }) => direction.pos === "w" || direction.pos === "e")
					.map(({ direction }) => (
						<button
							key={direction.id}
							type="button"
							className={`sea-edge sea-edge-${direction.pos}`}
							data-sea-go={direction.id}
							style={{ "--isl": tintOf(colorOf(direction)) } as CSSProperties}
							aria-label={`${direction.label}: look at this island`}
						>
							{direction.pos === "w" && <i>‹</i>}
							<span className="sea-dot" />
							{direction.label}
							{direction.pos === "e" && <i>›</i>}
						</button>
					))}
				<div className="sea-mini" data-sea-mini="-116,-58,116,58">
					{parts.map(({ direction, isle }) => (
						<button
							key={direction.id}
							type="button"
							className="sea-mb"
							data-sea-go={direction.id}
							style={
								{
									...mini(isle.place.t),
									"--isl": tintOf(colorOf(direction)),
								} as CSSProperties
							}
							aria-label={`${direction.label}: look at this island`}
						/>
					))}
					<button
						type="button"
						className="sea-mb sea-mh"
						data-sea-go=""
						style={mini({ x: 0, y: 0 })}
						aria-label={`Back to ${model.center.title}`}
					/>
					<span className="sea-rect" data-sea-rect="" aria-hidden="true" />
				</div>
			</>
		),
	}
}

// --- sea2: ranks on water. Six arms of islets around the title, on range rings ------------------------------------

const RANKS: Record<
	Mode,
	{
		kx: number
		dists: (upright: boolean) => number[]
		widths: number[]
		counts: number[]
		cw: number
		rings: number[]
		label: number
	}
> = {
	t: {
		kx: 1,
		dists: (upright) => (upright ? [20, 35.5, 48.5] : [24, 38, 47]),
		widths: [10.5, 9, 7.5],
		counts: [1, 2, 2],
		cw: 13.5,
		rings: [22.5, 38, 50.5],
		label: 57.5,
	},
	d: {
		kx: 1.42,
		dists: () => [18.5, 31, 42],
		widths: [11.5, 10, 8.6],
		counts: [1, 2, 2],
		cw: 15,
		rings: [18.5, 31, 42],
		label: 0,
	},
}

function ranksOnWater(model: RingModel): Scene {
	const isles: Isle[] = [homeIsle(13, 13.5)]
	const arms = model.directions.map((direction) => {
		const make = (mode: Mode) => {
			const table = RANKS[mode]
			const angle = STAR[mode][direction.pos]
			const upright = Math.abs(Math.sin(rad(angle))) > 0.99
			const dists = table.dists(upright)
			const tip = polar(angle, 1, table.kx)
			const ranks = dists.map((dist, rank) =>
				across(
					polar(angle, dist, table.kx),
					tip.x,
					tip.y,
					table.counts[rank],
					table.widths[rank],
					0.9,
				),
			)
			const centers = dists.map((dist) => polar(angle, dist, table.kx))
			// The name: past the arm's far end on the phone, above the arm's first islet on wide screens.
			const name =
				mode === "t"
					? upright
						? { x: 0, y: Math.sign(tip.y) * table.label }
						: {
								x: Math.sign(tip.x) * 49,
								y: centers[2].y + Math.sign(tip.y) * 14,
							}
					: Math.abs(tip.y) < 0.01
						? { x: centers[2].x + Math.sign(tip.x) * 5.5, y: -18.5 }
						: {
								x: centers[2].x + Math.sign(tip.x) * 11.5,
								y: centers[2].y + Math.sign(tip.y) * 7,
							}
			return { ranks, centers, name, upright, tip }
		}
		const t = make("t")
		const d = make("d")
		const color = colorOf(direction)
		const filled = new Set(entriesOf(direction).map((entry) => entry.rank))
		t.centers.forEach((c, rank) => {
			if (!filled.has(rank)) return
			isles.push({
				key: `${direction.id}${rank}`,
				place: { t: c, d: d.centers[rank] },
				r: radius([9.2, 10.6, 9.4][rank], [10.5, 12.2, 11][rank]),
				color,
				seed: direction.slot * 2 + rank,
				emphasis: [0.6, 0, -0.5][rank],
			})
		})
		const align = (mode: Mode, m: typeof t) =>
			mode === "t"
				? m.upright
					? "c"
					: m.tip.x > 0
						? "r"
						: "l"
				: Math.abs(m.tip.y) < 0.01
					? m.tip.x > 0
						? "r"
						: "l"
					: m.tip.x > 0
						? "l"
						: "r"
		return {
			direction,
			ranks: t.ranks.map((row, i) => zip(row, d.ranks[i])),
			name: { t: t.name, d: d.name } as Both,
			alignT: align("t", t),
			alignD: align("d", d),
		}
	})
	const ring = (k: number): Both => ({
		t: { x: 0, y: 0, w: RANKS.t.rings[k] * 2 },
		d: { x: 0, y: 0, w: RANKS.d.rings[k] * 2 * RANKS.d.kx },
	})
	return {
		hint: "Six ways from here. Every ring out is a step more. Tap a poster to sail there.",
		here: (
			<>
				{[0, 1, 2].map((k) => (
					<span key={k} className="sea-ring sea-at" style={at(ring(k))} aria-hidden="true">
						<i>{RANK_WORDS[k]}</i>
					</span>
				))}
				<Isles isles={isles} />
				<Center
					model={model}
					place={{
						t: { x: 0, y: 0, w: RANKS.t.cw },
						d: { x: 0, y: 0, w: RANKS.d.cw },
					}}
				/>
				{arms.map(({ direction, ranks, name, alignT, alignD }) => (
					<div key={direction.id} className="sea-d" {...dirProps(direction)}>
						<Name
							direction={direction}
							place={name}
							className={`sea-t${alignT} sea-w${alignD} sea-nm-s`}
							sub={direction.titles.length ? undefined : (direction.end ?? undefined)}
						/>
						{onRanks(entriesOf(direction), ranks).map(({ entry, place, first }) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								place={place}
								first={first}
							/>
						))}
					</div>
				))}
			</>
		),
	}
}

// --- sea3: zoom levels. An archipelago you look at from afar, and islands you go into -----------------------------

const ZOOM: Record<Mode, { at: Record<string, Pt>; r: number; cw: number }> = {
	t: {
		at: {
			w: { x: 0, y: -38.5 },
			e: { x: 0, y: 38.5 },
			ne: { x: 31.5, y: -19.5 },
			sw: { x: -31.5, y: 19.5 },
			se: { x: 31.5, y: 19.5 },
			nw: { x: -31.5, y: -19.5 },
		},
		r: 18.5,
		cw: 11,
	},
	d: {
		at: {
			w: { x: -50.5, y: 0 },
			e: { x: 50.5, y: 0 },
			ne: { x: 25.5, y: -27.5 },
			sw: { x: -25.5, y: 27.5 },
			se: { x: 25.5, y: 27.5 },
			nw: { x: -25.5, y: -27.5 },
		},
		r: 19,
		cw: 12,
	},
}
// Inside an island, as parts of its radius: the two nearest titles, then two rows that only show from near.
const ZOOM_ROWS = [
	{ y: 0.06, xs: [-0.27, 0.27], w: 0.47 },
	{ y: 0.4, xs: [-0.34, 0, 0.34], w: 0.3 },
	{ y: 0.8, xs: [-0.29, 0, 0.29], w: 0.25 },
]

function archipelago(model: RingModel, control: "zoom" | "mini" = "zoom"): Scene {
	const parts = model.directions.map((direction) => {
		const make = (mode: Mode) => {
			const table = ZOOM[mode]
			const c = table.at[direction.pos]
			return {
				c,
				ranks: ZOOM_ROWS.map((row) =>
					row.xs.map((x) => ({
						x: c.x + x * table.r,
						y: c.y + row.y * table.r,
						w: row.w * table.r,
					})),
				),
				name: { x: c.x, y: c.y - table.r * 0.58 },
				words: ZOOM_ROWS.map((row) => ({
					x: c.x - table.r * 0.6,
					y: c.y + row.y * table.r,
				})),
			}
		}
		const t = make("t")
		const d = make("d")
		return {
			direction,
			isle: {
				key: direction.id,
				place: { t: t.c, d: d.c },
				r: radius(ZOOM.t.r, ZOOM.d.r),
				color: colorOf(direction),
				seed: direction.slot * 2 + (direction.sign > 0 ? 1 : 0),
				go: direction.id,
				label: `${direction.label}: go into this island`,
			} satisfies Isle,
			ranks: t.ranks.map((row, i) => zip(row, d.ranks[i])),
			name: { t: t.name, d: d.name } as Both,
			words: t.words.map((p, i) => ({ t: p, d: d.words[i] }) as Both),
		}
	})
	// sea6: the whole neighborhood small, per layout, with the part the stage shows outlined.
	const minimap = (mode: Mode) => {
		const [bx, by] = mode === "t" ? [56, 60] : [74, 50]
		const spot = (p: Pt) => ({
			left: `${r2(((p.x + bx) / (2 * bx)) * 100)}%`,
			top: `${r2(((p.y + by) / (2 * by)) * 100)}%`,
		})
		return (
			<div
				className={`sea-mini sea-mini-${mode}`}
				data-sea-mini={`${-bx},${-by},${bx},${by}`}
				style={{ aspectRatio: `${bx}/${by}` }}
			>
				{parts.map(({ direction, isle }) => (
					<button
						key={direction.id}
						type="button"
						className="sea-mb"
						data-sea-go={direction.id}
						style={
							{
								...spot(isle.place[mode]),
								"--isl": tintOf(colorOf(direction)),
							} as CSSProperties
						}
						aria-label={`${direction.label}: look at this island`}
					/>
				))}
				<button
					type="button"
					className="sea-mb sea-mh"
					data-sea-go=""
					style={spot({ x: 0, y: 0 })}
					aria-label={`Back to ${model.center.title}`}
				/>
				<span className="sea-rect" data-sea-rect="" aria-hidden="true" />
			</div>
		)
	}
	// The stage starts on the island further the way the visitor came, when it has titles, else on the first that has.
	const onward = model.directions
		.find((d) => d.back)
		?.id.replace(/[+-]$/, (sign) => (sign === "+" ? "-" : "+"))
	const first = (
		model.directions.find((d) => d.id === onward && d.titles.length) ??
		model.directions.find((d) => d.titles.length)
	)?.id
	return {
		hint:
			control === "mini"
				? "The small map moves you: drag its frame or tap a spot on it. Tap a poster to sail there."
				: "Tap an island to go in. Tap a poster to sail there.",
		start: control === "mini" ? first : undefined,
		here: (
			<>
				<Isles isles={[homeIsle(10.5, 11), ...parts.map((p) => p.isle)]} />
				<Center
					model={model}
					place={{
						t: { x: 0, y: 0, w: ZOOM.t.cw },
						d: { x: 0, y: 0, w: ZOOM.d.cw },
					}}
				/>
				{parts.map(({ direction, ranks, name, words }) => {
					const placed = onRanks(entriesOf(direction), ranks)
					return (
						<div
							key={direction.id}
							className="sea-d sea-z"
							{...dirProps(direction)}
						>
							<Name
								direction={direction}
								place={name}
								sub={countLine(direction)}
								className="sea-k"
							/>
							{placed.map(({ entry, place, first }) => (
								<Poster
									key={keyOf(entry.pick)}
									entry={entry}
									direction={direction}
									place={place}
									first={first}
									width={92}
									className={entry.rank ? "sea-near" : "sea-r0"}
								/>
							))}
							{RANK_WORDS.map(
								(word, rank) =>
									placed.some(({ entry }) => entry.rank === rank) && (
										<span
											key={word}
											className={`sea-rw sea-near sea-k sea-at${rank ? "" : " sea-r0"}`}
											style={at(words[rank])}
											aria-hidden="true"
										>
											{word}
										</span>
									),
							)}
						</div>
					)
				})}
			</>
		),
		ui:
			control === "mini" ? (
				<>
					{minimap("t")}
					{minimap("d")}
				</>
			) : (
			<div className="sea-rail">
				<button
					type="button"
					className="sea-zb"
					data-sea-zoom="in"
					aria-label="Go into the nearest island"
				>
					+
				</button>
				<button
					type="button"
					className="sea-zb sea-zo"
					data-sea-go=""
					aria-label="Back out to all islands"
				>
					−
				</button>
			</div>
			),
	}
}

// --- sea4: voyage. One title per bearing and a second further out; the route stays on the map ------------------

const VOYAGE: Record<Mode, { kx: number; dists: number[]; widths: number[]; cw: number; label: number }> = {
	t: { kx: 1, dists: [23.5, 38.5], widths: [12.5, 9.5], cw: 17, label: 49.5 },
	d: { kx: 1.2, dists: [23, 37.5], widths: [12.5, 9.5], cw: 16.5, label: 47.5 },
}

function voyage(model: RingModel): Scene {
	const isles: Isle[] = [homeIsle(14, 13.5)]
	const arms = model.directions.map((direction) => {
		const make = (mode: Mode) => {
			const table = VOYAGE[mode]
			const angle = STAR[mode][direction.pos]
			const tip = polar(angle, table.dists[1], table.kx)
			const side = Math.abs(tip.x) > 1
			return {
				places: table.dists.map((dist, i) => ({
					...polar(angle, dist, table.kx),
					w: table.widths[i],
				})),
				// Phone: the names of the four side arms sit at the stage's edge, past the arm's far title.
				name:
					mode === "t" && side
						? { x: Math.sign(tip.x) * 48.5, y: tip.y + Math.sign(tip.y) * 10.5 }
						: polar(angle, table.label, table.kx),
				align: side ? (tip.x > 0 ? "r" : "l") : "c",
			}
		}
		const t = make("t")
		const d = make("d")
		const places = zip(t.places, d.places)
		places.slice(0, entriesOf(direction).length).forEach((place, i) =>
			isles.push({
				key: `${direction.id}${i}`,
				place,
				r: radius([10, 8][i], [10, 8][i]),
				color: colorOf(direction),
				seed: direction.slot * 2 + i,
				emphasis: i ? -0.4 : 0.4,
			}),
		)
		return {
			direction,
			places,
			name: { t: t.name, d: d.name } as Both,
			align: t.align,
		}
	})
	return {
		hint: "Tap a poster to sail there. Your route stays on the map: drag sideways to look back.",
		here: (
			<>
				<Isles isles={isles} />
				<Center
					model={model}
					place={{
						t: { x: 0, y: 0, w: VOYAGE.t.cw },
						d: { x: 0, y: 0, w: VOYAGE.d.cw },
					}}
				/>
				{arms.map(({ direction, places, name, align }) => (
					<div key={direction.id} className="sea-d" {...dirProps(direction)}>
						<Name
							direction={direction}
							place={name}
							className={`sea-nm-s sea-t${align}`}
						/>
						{entriesOf(direction)
							.slice(0, 2)
							.map((entry, i) => (
								<Poster
									key={keyOf(entry.pick)}
									entry={{ ...entry, rank: i }}
									direction={direction}
									place={places[i]}
									first={i === 0}
								/>
							))}
						{/* Where a step this way lands, also when the direction is empty. */}
						{!entriesOf(direction).length && (
							<span
								className="sea-at sea-ghost"
								style={at(places[0])}
								data-sea-slot=""
								aria-hidden="true"
							/>
						)}
					</div>
				))}
			</>
		),
	}
}

// --- sea5: compass and horizon. The sea tilted away from you, the heading ahead, posters standing like buoys ---

const HEADINGS: Record<string, number> = {
	e: 0,
	se: 60,
	sw: 120,
	w: 180,
	nw: 240,
	ne: 300,
}
const HORIZON = { dists: [26, 56, 92], widths: [15.5, 15.5, 15.5], counts: [2, 3, 3] }

/** Where an arm lies when another is ahead: 0 ahead, 1 and 5 to the sides, 2 and 4 behind to the sides, 3 behind. */
const relOf = (heading: number, ahead: number) =>
	((Math.round((heading - ahead) / 60) % 6) + 6) % 6

/** The turn of the sea that puts a direction ahead (up the screen). */
const turnOf = (pos: RingPos) => -90 - (HEADINGS[pos] ?? 0)

function horizon(model: RingModel): Scene {
	const isles: Isle[] = [homeIsle(12, 12)]
	// Ahead at the start: further the way the visitor came when there is something, else the way with the most titles.
	const onward = model.directions
		.find((d) => d.back)
		?.id.replace(/[+-]$/, (sign) => (sign === "+" ? "-" : "+"))
	const start = (
		model.directions.find((d) => d.id === onward && d.titles.length) ??
		[...model.directions].sort((a, b) => b.titles.length - a.titles.length)[0]
	)?.id
	const arms = model.directions.map((direction) => {
		const angle = HEADINGS[direction.pos] ?? 0
		const tip = polar(angle, 1)
		const ranks = HORIZON.dists.map((dist, rank) =>
			across(polar(angle, dist), tip.x, tip.y, HORIZON.counts[rank], HORIZON.widths[rank], 2).map(
				(p) => ({ t: p, d: p }) as Both,
			),
		)
		HORIZON.dists.forEach((dist, rank) => {
			const c = polar(angle, dist)
			isles.push({
				key: `${direction.id}${rank}`,
				place: { t: c, d: c },
				r: radius([18, 26, 27][rank], [18, 26, 27][rank]),
				color: colorOf(direction),
				seed: direction.slot * 2 + rank,
				emphasis: [0.5, 0, -0.3][rank],
			})
		})
		const sign = polar(angle, 118)
		return { direction, ranks, sign: { t: sign, d: sign } as Both }
	})
	const startPos = model.directions.find((d) => d.id === start)?.pos ?? "e"
	const ahead = model.directions.find((d) => d.id === start)
	return {
		hint: "Turn the compass, or drag the sea sideways. Further toward the horizon is further that way.",
		turn: turnOf(startPos),
		here: (
			<div
				className="sea-turn"
				data-sea-turn={turnOf(startPos)}
				data-sea-head={start}
			>
				<Isles isles={isles} />
				<span className="sea-b sea-at" style={at(HOME)}>
					<Center
						model={model}
						place={{ t: { x: 0, y: 0, w: 17 }, d: { x: 0, y: 0, w: 17 } }}
						className="sea-up"
					/>
				</span>
				{arms.map(({ direction, ranks, sign }) => (
					<div
						key={direction.id}
						className="sea-d"
						{...dirProps(direction)}
						data-on={direction.id === start ? "" : undefined}
						data-h={HEADINGS[direction.pos]}
						data-rel={relOf(HEADINGS[direction.pos], HEADINGS[startPos])}
					>
						<span className="sea-b sea-at" style={at(sign)}>
							<Name
								direction={direction}
								place={HOME}
								className="sea-up sea-sign"
								sub={direction.titles.length ? undefined : (direction.end ?? undefined)}
							/>
						</span>
						{onRanks(entriesOf(direction), ranks).map(({ entry, place, first }) => (
							<span
								key={keyOf(entry.pick)}
								className="sea-b sea-at"
								style={at({ t: { ...place.t, w: undefined }, d: { ...place.d, w: undefined } })}
							>
								<Poster
									entry={entry}
									direction={direction}
									place={{
										t: { x: 0, y: 0, w: place.t.w },
										d: { x: 0, y: 0, w: place.d.w },
									}}
									first={first}
									width={92}
									className="sea-up"
								/>
							</span>
						))}
					</div>
				))}
			</div>
		),
		ui: (
			<>
			<p className="sea-hd">
				<small>Ahead</small>
				<b data-sea-headname="">{ahead?.label}</b>
			</p>
			<span className="sea-needle" aria-hidden="true" />
			<div className="sea-rose" data-sea-rose="">
				{model.directions.map((direction) => (
					<button
						key={direction.id}
						type="button"
						className="sea-tick"
						data-sea-head={direction.id}
						data-sea-turn={turnOf(direction.pos)}
						aria-pressed={direction.id === start}
						style={
							{
								"--a": `${HEADINGS[direction.pos]}deg`,
								"--isl": tintOf(colorOf(direction)),
							} as CSSProperties
						}
						aria-label={`Head ${direction.word}`}
					/>
				))}
			</div>
			</>
		),
	}
}

const SCENES: Record<SeaVariant, (model: RingModel) => Scene> = {
	sea1: pocket,
	sea2: ranksOnWater,
	sea3: archipelago,
	sea4: voyage,
	sea5: horizon,
	sea6: (model) => archipelago(model, "mini"),
}

// --- The card: the Explorer's proximity card, small --------------------------------------------------------------

function Card({
	model,
	hint,
	isRoot,
}: { model: RingModel; hint: string; isRoot: boolean }) {
	const { center } = model
	return (
		<>
			<div className="sea-cd sea-cd-here">
				<span className="sea-th">
					<TmdbImage kind="poster" path={center.poster} width={104} alt="" />
				</span>
				<p className="sea-wh">
					<span className="sea-dot" />
					You are here
				</p>
				<p className="sea-ti">
					<b data-sea-here-t="">{center.title}</b>
					<span>
						{center.year}
						{center.type === "show" ? " · Show" : ""}
					</span>
					{isRoot ? (
						<em>this page</em>
					) : (
						<a
							className="sea-open"
							data-sea-nav=""
							data-sea-open=""
							href={pathOf(center)}
						>
							Open<span className="sr-only"> {center.title}</span>
						</a>
					)}
				</p>
				<p className="sea-why" data-sea-why="" aria-live="polite">
					{hint}
				</p>
			</div>
			{/* What the light, the pointer, or the middle of the map is on. The script fills it in. */}
			<div className="sea-cd sea-cd-peek" aria-hidden="true">
				<span className="sea-th">
					<img alt="" data-sea-pk-img="" />
				</span>
				<p className="sea-wh">
					<span className="sea-dot" data-sea-pk-dot="" />
					<span data-sea-pk-where="" />
					<em>tap to sail there</em>
				</p>
				<p className="sea-ti">
					<b data-sea-pk-t="" />
					<span data-sea-pk-y="" />
				</p>
				<p className="sea-why" data-sea-pk-why="" />
			</div>
		</>
	)
}

/** What a step swaps in: the sea around a title, the form's controls, and the card. */
function Parts({ model, rootKey }: { model: RingModel; rootKey: string }) {
	const scene = SCENES[model.variant as SeaVariant](model)
	return (
		<>
			<div data-part="here">
				<i
					hidden={true}
					data-sea-state=""
					data-axes={model.axes.join(",")}
					data-traits={model.traits.map(packOption).join(",")}
					data-start={scene.start}
				/>
				{scene.here}
			</div>
			<div data-part="ui">{scene.ui}</div>
			<div data-part="card">
				<Card
					model={model}
					hint={scene.hint}
					isRoot={keyOf(model.center) === rootKey}
				/>
			</div>
		</>
	)
}

export const seaStageHtml = (model: RingModel, rootKey: string) =>
	renderToStaticMarkup(<Parts model={model} rootKey={rootKey} />)

/**
 * Everything inside the section on a title page. Without a model (the related titles weren't there in time) the sea
 * is empty and the script asks for it.
 */
export function seaSectionHtml(input: {
	variant: SeaVariant
	title: string
	rootKey: string
	model: RingModel | undefined
}) {
	const { model } = input
	const scene = model ? SCENES[input.variant](model) : undefined
	return renderToStaticMarkup(
		<>
			<Outlines />
			<div
				className={`sea-map sea-m-${input.variant}`}
				data-sea-map=""
				data-sea-at=""
				data-sea-load={model ? undefined : ""}
				style={
					scene?.turn === undefined
						? undefined
						: ({ "--sea-rot": `${scene.turn}deg` } as CSSProperties)
				}
			>
				<div className="sea-bg" data-sea-bg="" aria-hidden="true" />
				<div className="sea-view" data-sea-view="">
					<div className="sea-world" data-sea-world="">
						<div className="sea-route" data-sea-route="" />
						<div className="sea-here" data-sea-here="">
							{model && (
								<i
									hidden={true}
									data-sea-state=""
									data-axes={model.axes.join(",")}
									data-traits={model.traits.map(packOption).join(",")}
									data-start={scene?.start}
								/>
							)}
							{scene?.here}
						</div>
					</div>
				</div>
				<div className="sea-top">
					<h2 className="sea-h">Titles like {input.title}</h2>
					<ol
						className="sea-trail"
						data-sea-trail=""
						hidden={true}
						aria-label="Where you sailed"
					/>
				</div>
				<div className="sea-ui" data-sea-ui="">
					{scene?.ui}
				</div>
				<div className="sea-card" data-sea-card="">
					{model && scene && (
						<Card
							model={model}
							hint={scene.hint}
							isRoot={keyOf(model.center) === input.rootKey}
						/>
					)}
				</div>
				<i className="sea-unit" data-sea-unit="" />
			</div>
			{/* Always there, so that the section is as high with links as without. */}
			<p className="sea-more">
				{model && model.links.length > 0 && <span>Open a page:</span>}
				{model?.links.map((title) => (
					<a key={keyOf(title)} data-sea-nav="" href={pathOf(title)}>
						{title.title} ({title.year})
					</a>
				))}
			</p>
		</>,
	)
}
