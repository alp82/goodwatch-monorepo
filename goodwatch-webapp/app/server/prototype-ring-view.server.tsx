// PROTOTYPE for "Prototype native-scroll carousels on title pages", fifth round. Throwaway code: not for production.
//
// The markup of the ring variants, as strings: the title page puts the section into its HTML, and a step, a dive, or
// a turn of a dial asks the prototype's endpoint for the stage and swaps it in. One inline script drives every
// variant (RING_SCRIPT in ui/prototype-carousels/RingSection.tsx).
//
// What every variant's markup has in common, and what the script and the checks rely on:
// - the map carries the walk's state: its axes (`data-axes`), the page title's traits (`data-traits`), and the
//   direction of a dive (`data-lock`).
// - a direction is a `[data-dir]` container with its place in `data-pos`. It is always there with its word, also
//   when it has no titles.
// - the first poster place of a direction is `[data-rg-slot]`: the title the visitor came from when there is one
//   (`[data-rg-back]`), else the nearest title, else an empty place. It is where the old center flies to.
// - a poster is a button with the direction it lies in (`data-via`) and, where the form shows ranks, its rank
//   (`data-rk`, 0 nearest). Never a link.
// - a dive has two ways out that say so: `[data-rg-exit]` on a chip and on the middle title.
//
// Places are in hundredths of the map's width from its middle, for x and for y, so one table serves the phone and
// the desktop. The map of a placed layout is 107.5 high.
import type { CSSProperties, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbImage } from "~/ui/TmdbImage"
import { keyOf } from "~/ui/prototype-carousels/dive-model"
import type { PxTitle } from "~/ui/prototype-carousels/explore-model"
import {
	PRESETS,
	RING_FORMS,
	type RingDirection,
	type RingModel,
	type RingOption,
	type RingPick,
	type RingPos,
	type RingVariant,
	packOption,
} from "~/ui/prototype-carousels/ring-model"
import { titleToDashed } from "~/utils/helpers"

const pathOf = (title: Pick<PxTitle, "type" | "id" | "title">) =>
	`/${title.type}/${title.id}-${titleToDashed(title.title)}`

const ARROWS: Record<RingPos, string> = {
	n: "↑",
	e: "→",
	s: "↓",
	w: "←",
	// With the text variation selector: without it the diagonal arrows come out as emoji.
	ne: "↗\uFE0E",
	se: "↘\uFE0E",
	sw: "↙\uFE0E",
	nw: "↖\uFE0E",
	w2: "←",
	e2: "→",
}
const WEST = new Set<RingPos>(["w", "w2", "sw", "nw"])

type XY = [number, number]
type Entry = { pick: PxTitle | RingPick; back: boolean }

/** A direction's posters in order: the title the visitor came from, then the titles that way. */
const entriesOf = (direction: RingDirection): Entry[] => [
	...(direction.back ? [{ pick: direction.back, back: true }] : []),
	...direction.titles.map((pick) => ({ pick, back: false })),
]

const at = ([x, y]: XY, w?: number) =>
	({ "--x": x, "--y": y, ...(w ? { "--w": w } : {}) }) as CSSProperties

/** A poster you can step onto. Never a link. */
function Poster({
	entry,
	direction,
	first,
	width,
	rank,
	style,
	children,
}: {
	entry: Entry
	direction: RingDirection
	/** The direction's first place: where the old center lands after a step the opposite way. */
	first: boolean
	width: number
	rank?: number
	style?: CSSProperties
	children?: ReactNode
}) {
	const { pick, back } = entry
	const why = back ? "Where you came from" : (pick as RingPick).why
	return (
		<button
			type="button"
			className="wk-p rg-p"
			style={style}
			data-rg-step={keyOf(pick)}
			data-via={direction.id}
			data-rg-slot={first ? "" : undefined}
			data-rg-back={back ? "" : undefined}
			data-lv={back ? undefined : (pick as RingPick).level}
			data-rk={rank}
			data-t={pick.title}
			data-y={pick.year}
			data-why={why}
			aria-label={
				back
					? `Back to ${pick.title} (${pick.year})`
					: `Walk to ${pick.title} (${pick.year}): ${why}`
			}
		>
			<span className="wk-i">
				<TmdbImage kind="poster" path={pick.poster} width={width} alt="" />
			</span>
			{back && (
				<span className="rg-bk" aria-hidden="true">
					back
				</span>
			)}
			{children}
		</button>
	)
}

/** An empty first place: nothing to tap, but the place the old center flies to. */
const Ghost = ({ style }: { style?: CSSProperties }) => (
	<span className="rg-g" style={style} data-rg-slot="" aria-hidden="true" />
)

const axisLetter = (model: RingModel, slot: number) =>
	RING_FORMS[model.variant].axes === 1
		? "this line"
		: RING_FORMS[model.variant].layout === "arms"
			? slot === 0
				? "the upper row"
				: "the lower row"
			: slot === 0
				? "left and right"
				: "up and down"

/**
 * A direction's word. What a tap on it does depends on the form: it dives into the direction, or it opens the
 * choices for its axis (then, where the form has a dive, a second small control dives). A direction with nothing
 * left keeps its word and says that it ends.
 */
function Label({
	direction,
	model,
	style,
	align = "c",
	small,
}: {
	direction: RingDirection
	model: RingModel
	style?: CSSProperties
	align?: "l" | "c" | "r"
	small?: boolean
}) {
	const form = RING_FORMS[model.variant]
	const locked = model.lock === direction.id
	const ended = Boolean(direction.end)
	const chooses = form.dial === "words"
	const west = WEST.has(direction.pos)
	const word = (
		<>
			{west && <i>{ARROWS[direction.pos]}&nbsp;</i>}
			<b>{direction.label}</b>
			{!west && <i>&nbsp;{ARROWS[direction.pos]}</i>}
		</>
	)
	const endNote = `${direction.label} ends here: ${direction.end}.`
	return (
		<span
			className={`rg-lb rg-a${align}${small ? " rg-sm" : ""}`}
			style={style}
			data-rg-label={direction.pos}
			data-rg-ended={ended ? "" : undefined}
		>
			{chooses ? (
				<button
					type="button"
					className="rg-l rg-ch"
					data-rg-choose={direction.slot}
					aria-label={`${direction.label}: choose what ${axisLetter(model, direction.slot)} means`}
				>
					{word}
					<u>▾</u>
				</button>
			) : ended ? (
				<button
					type="button"
					className="rg-l"
					data-rg-end={endNote}
					aria-label={`${direction.label}: nothing further. ${direction.end}`}
				>
					{word}
					<em> ends</em>
				</button>
			) : form.dive ? (
				<button
					type="button"
					className="rg-l"
					data-rg-lock={direction.id}
					aria-pressed={locked}
					aria-label={
						locked
							? `${direction.label}: back to all directions`
							: `${direction.label}: see further this way`
					}
				>
					{word}
					{locked && <u>✕</u>}
				</button>
			) : (
				<span className="rg-l rg-plain">{word}</span>
			)}
			{chooses &&
				(ended ? (
					<button type="button" className="rg-fu rg-fe" data-rg-end={endNote}>
						ends
					</button>
				) : (
					form.dive &&
					!locked && (
						<button
							type="button"
							className="rg-fu"
							data-rg-lock={direction.id}
							aria-label={`See further: ${direction.word}`}
						>
							further
						</button>
					)
				))}
		</span>
	)
}

/** The title you stand on. In a dive it is a way out. */
function Center({
	model,
	width,
	style,
}: {
	model: RingModel
	width: number
	style?: CSSProperties
}) {
	const image = (
		<span className="wk-i">
			<TmdbImage
				kind="poster"
				path={model.center.poster}
				width={width}
				alt={`${model.center.title} (${model.center.year})`}
				priority="eager"
				data-rg-center=""
			/>
		</span>
	)
	return model.lock ? (
		<button
			type="button"
			className="wk-c rg-c"
			style={style}
			data-rg-exit=""
			aria-label={`${model.center.title}: back to all directions`}
		>
			{image}
		</button>
	) : (
		<span className="wk-c rg-c" style={style}>
			{image}
		</span>
	)
}

function mapProps(model: RingModel, className: string) {
	const lockPos = model.directions.find((d) => d.id === model.lock)?.pos
	return {
		className: `rg-map ${className}`,
		"data-rg-map": "",
		"data-axes": model.axes.join(","),
		"data-traits": model.traits.map(packOption).join(","),
		"data-lock": model.lock ?? undefined,
		"data-lockpos": lockPos,
	}
}

function containerProps(direction: RingDirection, model: RingModel) {
	return {
		"data-dir": direction.id,
		"data-pos": direction.pos,
		"data-end": direction.end ? "" : undefined,
		"data-on": model.lock === direction.id ? "" : undefined,
	}
}

// --- The places of the placed layouts -------------------------------------------------------------------------

interface Rest {
	center: { at: XY; w: number }
	/** Per place: the poster places (the first is where the title you came from goes), their width, the label. */
	sides: Partial<
		Record<
			RingPos,
			{ places: XY[]; w: number; label: XY; align: "l" | "c" | "r" }
		>
	>
}

// ring: three per side. Rows above and below, columns left and right, with the columns' words in the corners.
const RING_REST: Rest = {
	center: { at: [0, 0], w: 22 },
	sides: {
		n: {
			places: [
				[0, -30.5],
				[-18, -30.5],
				[18, -30.5],
			],
			w: 16,
			label: [0, -53.2],
			align: "c",
		},
		s: {
			places: [
				[0, 30.5],
				[18, 30.5],
				[-18, 30.5],
			],
			w: 16,
			label: [0, 53.2],
			align: "c",
		},
		e: {
			places: [
				[41, 0],
				[41, -25.5],
				[41, 25.5],
			],
			w: 16,
			label: [50, -53.2],
			align: "r",
		},
		w: {
			places: [
				[-41, 0],
				[-41, 25.5],
				[-41, -25.5],
			],
			w: 16,
			label: [-50, -53.2],
			align: "l",
		},
	},
}

// star: six spokes of two, the nearer title nearer. The diagonal spokes' words are in the corners, and the words
// of left and right sit above their spoke at the edge.
const STAR_REST: Rest = {
	center: { at: [0, 0], w: 22 },
	sides: {
		e: {
			places: [
				[28, 0],
				[43, 0],
			],
			w: 13,
			label: [50, -15.5],
			align: "r",
		},
		w: {
			places: [
				[-28, 0],
				[-43, 0],
			],
			w: 13,
			label: [-50, 15.5],
			align: "l",
		},
		ne: {
			places: [
				[18, -27.5],
				[33, -36],
			],
			w: 13,
			label: [50, -50],
			align: "r",
		},
		sw: {
			places: [
				[-18, 27.5],
				[-33, 36],
			],
			w: 13,
			label: [-50, 50],
			align: "l",
		},
		nw: {
			places: [
				[-18, -27.5],
				[-33, -36],
			],
			w: 13,
			label: [-50, -50],
			align: "l",
		},
		se: {
			places: [
				[18, 27.5],
				[33, 36],
			],
			w: 13,
			label: [50, 50],
			align: "r",
		},
	},
}

/** A thin line per axis through the center, behind the posters. */
const AXIS_LINES: Record<"ring" | "star", [number, number, number, number][]> =
	{
		ring: [
			[-41, 0, 41, 0],
			[0, -30.5, 0, 30.5],
		],
		star: [
			[-43, 0, 43, 0],
			[-33, 36, 33, -36],
			[-33, -36, 33, 36],
		],
	}

interface Fan {
	center: { at: XY; w: number }
	w: number
	/** Per rank, near to far: the poster places and where the rank's word goes. */
	ranks: { places: XY[]; word: XY; align: "l" | "c" | "r" }[]
	/** The title you came from, peeking out behind the center on the far side of the dive. */
	back: XY
	/** The dived direction's word, the way out, and the opposite direction's word. */
	head: { at: XY; align: "l" | "c" | "r" }
	exit: { at: XY; align: "l" | "c" | "r" }
	opposite: { at: XY; align: "l" | "c" | "r" }
}

// A dive: the center moves toward the opposite edge and the direction opens into three ranks. Every rank is farther
// from the center than the one before, in every direction. Given for east, north, and north-east: the others are
// mirrors.
const FANS: Record<"e" | "n" | "ne", Fan> = {
	e: {
		center: { at: [-29, 3], w: 20 },
		w: 16,
		ranks: [-5, 15, 35].map((x) => ({
			places: [
				[x, 3],
				[x, -23],
				[x, 29],
			] as XY[],
			word: [x, -39.5] as XY,
			align: "c" as const,
		})),
		back: [-41, 3],
		head: { at: [50, -50], align: "r" },
		exit: { at: [-50, -18.5], align: "l" },
		opposite: { at: [-50, 24.5], align: "l" },
	},
	n: {
		center: { at: [0, 32.5], w: 18 },
		w: 13.3,
		ranks: [5.5, -15.5, -36.5].map((y) => ({
			places: [
				[0, y],
				[-15.5, y],
				[15.5, y],
			] as XY[],
			word: [-50, y] as XY,
			align: "l" as const,
		})),
		back: [0, 42.5],
		head: { at: [0, -50.5], align: "c" },
		exit: { at: [-11.5, 27], align: "r" },
		opposite: { at: [11.5, 44], align: "l" },
	},
	ne: {
		center: { at: [-24, 26], w: 18 },
		w: 13,
		ranks: [28, 52, 76].map((r) => {
			const u = Math.SQRT1_2
			const base: XY = [-24 + r * u, 26 - r * u]
			const s = 19.5 * u
			return {
				places: [
					base,
					[base[0] - s, base[1] - s],
					[base[0] + s, base[1] + s],
				] as XY[],
				word: [base[0] + s, base[1] + s + 12.5] as XY,
				align: "c" as const,
			}
		}),
		back: [-37, 36],
		head: { at: [-50, -50.5], align: "l" },
		exit: { at: [-50, 6.5], align: "l" },
		opposite: { at: [-50, 50.5], align: "l" },
	},
}

const round = (value: number) => Math.round(value * 100) / 100
function fanOf(pos: RingPos): Fan {
	const base =
		FANS[
			pos === "e" || pos === "w" ? "e" : pos === "n" || pos === "s" ? "n" : "ne"
		]
	const fx = pos === "w" || pos === "nw" || pos === "sw" ? -1 : 1
	const fy = pos === "s" || pos === "se" || pos === "sw" ? -1 : 1
	const flip = ([x, y]: XY): XY => [round(x * fx), round(y * fy)]
	const side = (align: "l" | "c" | "r") =>
		fx > 0 || align === "c" ? align : align === "l" ? "r" : "l"
	const label = <T extends { at: XY; align: "l" | "c" | "r" }>(entry: T) => ({
		at: flip(entry.at),
		align: side(entry.align),
	})
	return {
		center: { at: flip(base.center.at), w: base.center.w },
		w: base.w,
		ranks: base.ranks.map((rank) => ({
			places: rank.places.map(flip),
			word: flip(rank.word),
			align: side(rank.align),
		})),
		back: flip(base.back),
		head: label(base.head),
		exit: label(base.exit),
		opposite: label(base.opposite),
	}
}

// The same three words in every direction, short enough for a rank's place.
const RANK_WORDS = ["a bit", "more", "much"]

/** Posters of one direction put on ranks: per rank, the places are filled in order. */
function ranked(
	entries: Entry[],
	ranks: { places: XY[] }[],
): { entry: Entry; place: XY; rank: number }[] {
	const taken = ranks.map(() => 0)
	const placed: { entry: Entry; place: XY; rank: number }[] = []
	for (const entry of entries) {
		const rank = entry.back ? 0 : (entry.pick as RingPick).rank
		const place = ranks[rank]?.places[taken[rank]]
		if (!place) continue
		taken[rank]++
		placed.push({ entry, place, rank })
	}
	return placed
}

const oppositeOf = (id: string) =>
	`${id.slice(0, -1)}${id.endsWith("+") ? "-" : "+"}`

/** ring and star: the directions around the center, and one of them opened into a fan when the stage dives. */
function Placed({ model, rest }: { model: RingModel; rest: Rest }) {
	const form = RING_FORMS[model.variant]
	const locked = model.directions.find((d) => d.id === model.lock)
	const fan = locked ? fanOf(locked.pos) : null
	const opposite = model.lock ? oppositeOf(model.lock) : null
	const center = fan ? fan.center : rest.center
	return (
		<div {...mapProps(model, `rg-pl rg-${form.layout}`)}>
			{!fan && (
				<svg viewBox="-50 -53.75 100 107.5" aria-hidden="true">
					{AXIS_LINES[form.layout === "star" ? "star" : "ring"].map(
						([x1, y1, x2, y2]) => (
							<line key={`${x1} ${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
						),
					)}
				</svg>
			)}
			<Center model={model} width={104} style={at(center.at, center.w)} />
			{fan && locked && (
				<button
					type="button"
					className={`rg-x rg-a${fan.exit.align}`}
					style={at(fan.exit.at)}
					data-rg-exit=""
				>
					<span aria-hidden="true">✕</span> All directions
				</button>
			)}
			{model.directions.map((direction) => {
				const side = rest.sides[direction.pos]
				if (!side) return null
				const entries = entriesOf(direction)
				const isLocked = direction.id === model.lock
				const isOpposite = direction.id === opposite
				let posters: { entry: Entry; place: XY; rank?: number }[] = []
				let ghost: XY | null = null
				let label: { at: XY; align: "l" | "c" | "r" } | null = {
					at: side.label,
					align: side.align,
				}
				let width = side.w
				if (!fan) {
					posters = entries
						.slice(0, side.places.length)
						.map((entry, i) => ({ entry, place: side.places[i] }))
					if (!entries.length) ghost = side.places[0]
				} else if (isLocked) {
					posters = ranked(entries, fan.ranks)
					label = fan.head
					width = fan.w
				} else if (isOpposite) {
					posters = entries
						.filter((entry) => entry.back)
						.map((entry) => ({ entry, place: fan.back }))
					if (!posters.length) ghost = fan.back
					label = fan.opposite
					width = fan.w
				} else label = null
				return (
					<div
						key={direction.id}
						className="rg-d"
						{...containerProps(direction, model)}
					>
						{label ? (
							<Label
								direction={direction}
								model={model}
								style={at(label.at)}
								align={label.align}
								small={Boolean(fan) && !isLocked}
							/>
						) : (
							// A dive shows one axis. The words of the others stay in the document, out of sight.
							<span hidden={true} data-rg-label={direction.pos}>
								<b>{direction.label}</b>
							</span>
						)}
						{posters.map(({ entry, place, rank }, index) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								first={index === 0}
								width={72}
								rank={rank}
								style={at(place, width)}
							/>
						))}
						{ghost && <Ghost style={at(ghost, width)} />}
						{fan &&
							isLocked &&
							RANK_WORDS.map(
								(text, rank) =>
									posters.some((poster) => poster.rank === rank) && (
										<span
											key={text}
											className={`rg-rk rg-a${fan.ranks[rank].align}`}
											style={at(fan.ranks[rank].word)}
											aria-hidden="true"
										>
											{text}
										</span>
									),
							)}
					</div>
				)
			})}
			<Menus model={model} />
		</div>
	)
}

// bow: one axis left and right, three ranks per side with shrinking posters. The map is 96 high.
// glass: one axis up and down, two ranks per side. The map is 107.5 high.
const RANKS: Record<
	"bow" | "glass",
	{
		center: { at: XY; w: number }
		/** For the high end. The low end is the mirror. */
		ranks: { places: XY[]; w: number; word: XY; align: "l" | "c" | "r" }[]
		label: { at: XY; align: "l" | "c" | "r" }
		words: (direction: RingDirection) => string[]
	}
> = {
	bow: {
		center: { at: [0, 4], w: 18 },
		ranks: [
			{
				places: [
					[17.5, -6.5],
					[17.5, 14.5],
				],
				w: 13,
				word: [17.5, 28],
				align: "c",
			},
			{
				places: [
					[32, 4],
					[32, -15.5],
					[32, 23.5],
				],
				w: 12,
				word: [32, 36],
				align: "c",
			},
			{
				places: [
					[44.75, -4.5],
					[44.75, 12.5],
					[44.75, -21.5],
					[44.75, 29.5],
				],
				w: 10.5,
				word: [44.75, 41],
				align: "c",
			},
		],
		label: { at: [50, -47.5], align: "r" },
		words: () => ["a bit", "more", "much"],
	},
	glass: {
		center: { at: [0, 0], w: 17 },
		ranks: [
			{
				places: [
					[-7.25, -23.6],
					[7.25, -23.6],
					[-21.75, -23.6],
					[21.75, -23.6],
				],
				w: 12.5,
				word: [-50, -23.6],
				align: "l",
			},
			{
				places: [
					[0, -42.6],
					[-12.5, -42.6],
					[12.5, -42.6],
					[-25, -42.6],
					[25, -42.6],
				],
				w: 10.5,
				word: [-50, -42.6],
				align: "l",
			},
		],
		label: { at: [11.5, -6], align: "l" },
		words: () => ["a bit", "more"],
	},
}

/** bow and glass: the whole stage is one axis, and its ranks are always there. */
function Ranks({ model }: { model: RingModel }) {
	const layout = RING_FORMS[model.variant].layout as "bow" | "glass"
	const table = RANKS[layout]
	return (
		<div {...mapProps(model, `rg-pl rg-${layout}`)}>
			<Center
				model={model}
				width={104}
				style={at(table.center.at, table.center.w)}
			/>
			{model.directions.map((direction) => {
				const low = direction.sign < 0
				// The low end is the high end turned around the center.
				const cy = table.center.at[1]
				const flip = ([x, y]: XY): XY =>
					!low ? [x, y] : layout === "bow" ? [-x, y] : [x, round(2 * cy - y)]
				const side = (align: "l" | "c" | "r") =>
					low && layout === "bow" && align !== "c"
						? align === "l"
							? "r"
							: "l"
						: align
				const ranks = table.ranks.map((rank) => ({
					...rank,
					places: rank.places.map(flip),
				}))
				const posters = ranked(entriesOf(direction), ranks)
				const words = table.words(direction)
				return (
					<div
						key={direction.id}
						className="rg-d"
						{...containerProps(direction, model)}
					>
						<Label
							direction={direction}
							model={model}
							style={at(flip(table.label.at))}
							align={side(table.label.align)}
						/>
						{posters.map(({ entry, place, rank }, index) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								first={index === 0}
								width={72}
								rank={rank}
								style={at(place, ranks[rank].w)}
							/>
						))}
						{!posters.length && (
							<Ghost style={at(ranks[0].places[0], ranks[0].w)} />
						)}
						{words.map(
							(text, rank) =>
								posters.some((poster) => poster.rank === rank) && (
									<span
										key={text}
										className={`rg-rk rg-a${side(ranks[rank].align)}`}
										style={at(flip(ranks[rank].word))}
										aria-hidden="true"
									>
										{text}
									</span>
								),
						)}
					</div>
				)
			})}
			<Menus model={model} />
		</div>
	)
}

/** One strip: the titles of a direction, nearest first, scrolling away from the center. */
function Strip({
	direction,
	model,
}: {
	direction: RingDirection
	model: RingModel
}) {
	const entries = entriesOf(direction)
	const west = WEST.has(direction.pos)
	return (
		<div
			className={`rg-d rg-arm ${west ? "rg-west" : "rg-east"}`}
			style={{ gridRow: direction.slot + 1 }}
			{...containerProps(direction, model)}
		>
			<Label direction={direction} model={model} align={west ? "r" : "l"} />
			{/* The west strip is written right to left, so that it starts at the center and scrolls outward. */}
			<div
				className="rg-strip"
				dir={west ? "rtl" : "ltr"}
				data-rg-strip={direction.id}
				data-rg-more={direction.more ? "" : undefined}
			>
				<StripPosters direction={direction} entries={entries} from={0} />
				{!entries.length && <Ghost />}
				{direction.more ? (
					<button
						type="button"
						className="rg-mo"
						data-rg-load={direction.id}
						aria-label={`Further: ${direction.word}`}
					>
						{west ? "‹" : "›"}
					</button>
				) : (
					<span className="rg-en" dir="ltr">
						{direction.end ? "ends" : "no further"}
					</span>
				)}
			</div>
		</div>
	)
}

/** "a bit", "more", or "much": a title's grade without the direction's word, for the line under a small poster. */
const shortGrade = (grade: string) =>
	grade.startsWith("a bit")
		? "a bit"
		: grade.startsWith("much")
			? "much"
			: "more"

function StripPosters({
	direction,
	entries,
	from,
}: {
	direction: RingDirection
	entries: Entry[]
	from: number
}) {
	return (
		<>
			{entries.map((entry, index) => (
				<Poster
					key={keyOf(entry.pick)}
					entry={entry}
					direction={direction}
					first={from + index === 0}
					width={64}
				>
					{!entry.back && (
						<span className="rg-gr" dir="ltr" aria-hidden="true">
							{shortGrade((entry.pick as RingPick).grade)}
						</span>
					)}
				</Poster>
			))}
		</>
	)
}

/** line and arms: a row per axis, the center in the middle, and a strip to each side. */
function Strips({ model }: { model: RingModel }) {
	const layout = RING_FORMS[model.variant].layout
	const rows = model.axes.length
	return (
		<div {...mapProps(model, `rg-${layout}`)}>
			<div className="rg-rows" style={{ "--rows": rows } as CSSProperties}>
				<Center model={model} width={104} />
				{model.directions.map((direction) => (
					<Strip key={direction.id} direction={direction} model={model} />
				))}
			</div>
			{layout === "line" && <ListDial model={model} />}
			<Menus model={model} />
		</div>
	)
}

// --- The dials -------------------------------------------------------------------------------------------------

const pairOf = (option: {
	low: string
	high: string
	side?: RingOption["side"]
}) =>
	option.side === "low"
		? `${option.low} only`
		: option.side === "high"
			? `${option.high} only`
			: `${option.low} ↔ ${option.high}`

/** What an axis can be: the fixed axes and the page title's own traits. */
const optionsOf = (model: RingModel) => [...model.fixed, ...model.traits]

/** words: per axis, the choices that a tap on one of its words opens. In the map, over the stage. */
function Menus({ model }: { model: RingModel }) {
	if (RING_FORMS[model.variant].dial !== "words") return null
	return (
		<>
			{model.axes.map((axis, slot) => (
				<div
					key={axis}
					className="rg-menu"
					data-rg-menu={slot}
					hidden={true}
					aria-label={`What ${axisLetter(model, slot)} means`}
				>
					<p>
						<span>What should {axisLetter(model, slot)} mean?</span>
						<button type="button" data-rg-close="" aria-label="Close">
							✕
						</button>
					</p>
					{optionsOf(model)
						// An axis that the other row or column already has isn't offered a second time.
						.filter(
							(option) => option.id === axis || !model.axes.includes(option.id),
						)
						.map((option) => (
							<button
								key={option.id}
								type="button"
								data-rg-set={`${slot}:${option.id}`}
								aria-pressed={option.id === axis}
							>
								{pairOf(option)}
							</button>
						))}
					<button type="button" className="rg-su" data-rg-pick={slot}>
						Surprise me
					</button>
				</div>
			))}
		</>
	)
}

/** presets: chips that set both axes at once. traits: chips with the title's own traits for the last axis. */
function ChipDial({ model }: { model: RingModel }) {
	const dial = RING_FORMS[model.variant].dial
	if (dial === "presets") {
		const own = model.traits.slice(0, 2).map((trait) => trait.id)
		const current = model.axes.join(",")
		const presets = PRESETS.map((preset) => ({
			...preset,
			axes: preset.axes ?? (own.length === 2 ? own : null),
		})).filter((preset) => preset.axes)
		return (
			<div className="rg-dial" aria-label="What the axes are about">
				{presets.map((preset) => (
					<button
						key={preset.id}
						type="button"
						data-rg-axes={preset.axes?.join(",")}
						aria-pressed={preset.axes?.join(",") === current}
					>
						{preset.label}
					</button>
				))}
				<button type="button" className="rg-su" data-rg-preset="surprise">
					Surprise me
				</button>
			</div>
		)
	}
	if (dial === "traits") {
		const slot = model.axes.length - 1
		return (
			<div
				className="rg-dial"
				aria-label={`What ${axisLetter(model, slot)} means`}
			>
				{model.axes.length > 1 && <span aria-hidden="true">↕</span>}
				{model.traits.map((trait) => (
					<button
						key={trait.id}
						type="button"
						data-rg-set={`${slot}:${trait.id}`}
						aria-pressed={trait.id === model.axes[slot]}
						aria-label={pairOf(trait)}
					>
						{trait.name}
						{trait.side !== "both" && (
							<small> {trait.side === "low" ? "less only" : "more only"}</small>
						)}
					</button>
				))}
				{model.traits.length > 1 && (
					<button type="button" className="rg-su" data-rg-pick={slot}>
						Surprise me
					</button>
				)}
				{!model.traits.length && (
					<span>No trait of this title has titles both ways.</span>
				)}
			</div>
		)
	}
	return null
}

/** list: every choice for the one axis, with both of its ends spelled out. Inside the map, under the line. */
function ListDial({ model }: { model: RingModel }) {
	return (
		<div className="rg-list" aria-label="What the line means">
			{optionsOf(model)
				.slice(0, 7)
				.map((option) => (
					<button
						key={option.id}
						type="button"
						data-rg-set={`0:${option.id}`}
						aria-pressed={option.id === model.axes[0]}
					>
						{pairOf(option)}
					</button>
				))}
			<button type="button" className="rg-su" data-rg-pick="0">
				Surprise me
			</button>
		</div>
	)
}

/** The caption of the title you stand on: its name, the separate control that opens its page, and one line. */
function Caption({ model, isRoot }: { model: RingModel; isRoot: boolean }) {
	const { center } = model
	const locked = model.directions.find((d) => d.id === model.lock)
	return (
		<div className="wk-cap">
			<p className="wk-here">
				<span className="wk-here-l">You're on</span>
				<b data-rg-here="">{center.title}</b>
				<span className="wk-meta" data-rg-meta="">
					{center.year}
					{center.type === "show" ? " · Show" : ""}
				</span>
				{isRoot ? (
					<span className="wk-this">this page</span>
				) : (
					<a
						className="wk-open"
						data-rg-nav=""
						data-rg-open=""
						href={pathOf(center)}
					>
						Open<span className="sr-only"> {center.title}</span>
					</a>
				)}
			</p>
			<p className="wk-why" data-rg-why="" aria-live="polite">
				{locked
					? locked.titles.length
						? `${locked.label} than ${center.title}: a bit is nearest, much is farthest. Tap ✕ or the middle poster for all directions.`
						: `${locked.label} ends here: ${locked.end}. Tap ✕ or the middle poster for all directions.`
					: RING_FORMS[model.variant].hint}
			</p>
		</div>
	)
}

function Stage({ model, rootKey }: { model: RingModel; rootKey: string }) {
	const layout = RING_FORMS[model.variant].layout
	return (
		<>
			<ChipDial model={model} />
			{layout === "ring" && <Placed model={model} rest={RING_REST} />}
			{layout === "star" && <Placed model={model} rest={STAR_REST} />}
			{(layout === "bow" || layout === "glass") && <Ranks model={model} />}
			{(layout === "line" || layout === "arms") && <Strips model={model} />}
			<Caption model={model} isRoot={keyOf(model.center) === rootKey} />
			{model.links.length > 0 && (
				<p className="wk-more">
					<span>Open a page:</span>
					{model.links.map((title) => (
						<a key={keyOf(title)} data-rg-nav="" href={pathOf(title)}>
							{title.title} ({title.year})
						</a>
					))}
				</p>
			)}
		</>
	)
}

/** The stage around a title: what a step, a dive, or a turn of a dial swaps in. */
export const ringStageHtml = (model: RingModel, rootKey: string) =>
	renderToStaticMarkup(<Stage model={model} rootKey={rootKey} />)

/** The further titles of one strip: what scrolling it outward appends. */
export function ringMoreHtml(model: RingModel, id: string, skip: number) {
	const direction = model.directions.find((entry) => entry.id === id)
	if (!direction) return ""
	return renderToStaticMarkup(
		<>
			<StripPosters
				direction={direction}
				entries={direction.titles.map((pick) => ({ pick, back: false }))}
				from={skip}
			/>
			<span className="rg-en" dir="ltr">
				no further
			</span>
		</>,
	)
}

/**
 * Everything inside the section on a title page. Without a model (the related titles weren't there in time) the
 * stage is empty and the script asks for it.
 */
export function ringSectionHtml(input: {
	variant: RingVariant
	title: string
	rootKey: string
	model: RingModel | undefined
}) {
	return renderToStaticMarkup(
		<>
			<h2 className="wk-h">Titles like {input.title}</h2>
			<div className="wk-trail" data-rg-trail="">
				<p className="wk-hint" data-rg-hint="">
					Tap a poster to walk there. You stay on this page.
				</p>
				<ol
					className="wk-crumbs"
					data-rg-crumbs=""
					hidden={true}
					aria-label="Where you walked"
				/>
			</div>
			<div
				className="wk-stage rg-stage"
				data-rg-stage=""
				data-rg-load={input.model ? undefined : ""}
			>
				{input.model && <Stage model={input.model} rootKey={input.rootKey} />}
			</div>
		</>,
	)
}
