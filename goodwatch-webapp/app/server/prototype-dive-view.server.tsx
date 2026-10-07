// PROTOTYPE for "Prototype native-scroll carousels on title pages", fourth round. Throwaway code: not for production.
//
// The markup of the four dive variants, as strings, like the third round's (prototype-walk.server.tsx): the title
// page puts the section into its HTML, and a step or a dive asks the prototype's endpoint for the stage and swaps
// it in. One inline script drives every variant (DIVE_SCRIPT in ui/prototype-carousels/DiveSection.tsx).
//
// What every variant's markup has in common, and what the script and the checks rely on:
// - a direction is a `[data-dir]` container with its place in `data-pos` (n, e, s, w). It is always there, with the
//   same word in its label, also when it has no titles.
// - the first poster place of a direction is `[data-dive-slot]`: the title the visitor came from when there is one
//   (`[data-dive-back]`), else the nearest title, else an empty place. It is where the old center flies to.
// - a poster is a button with the direction it lies in (`data-via`). Never a link.
// - a label is a button that dives into its direction (`data-dive-lock`), or says why the direction ends.
import type { CSSProperties, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	type DiveDirection,
	type DiveModel,
	type DivePick,
	type DiveVariant,
	SECOND_AXES,
	keyOf,
	oppositeOf,
} from "~/ui/prototype-carousels/dive-model"
import type { PxTitle } from "~/ui/prototype-carousels/explore-model"
import { titleToDashed } from "~/utils/helpers"

const pathOf = (title: Pick<PxTitle, "type" | "id" | "title">) =>
	`/${title.type}/${title.id}-${titleToDashed(title.title)}`

type Pos = DiveDirection["pos"]
const ARROWS: Record<Pos, string> = { n: "↑", e: "→", s: "↓", w: "←" }

/** What the reason line says at rest. */
const HINTS: Record<DiveVariant, () => string> = {
	dive1: () =>
		"Each side keeps its meaning. Tap a poster to step that way, or a word to see further that way.",
	dive2: () =>
		"Four ways that stay where they are. Tap a poster to step, or a word for a longer run.",
	dive3: () =>
		"Four lanes, nearest title first. Tap a poster to step, or the arrow at a lane's end to see further.",
	dive4: () =>
		"Four piles, each a way to go. Tap a pile to lay it out from a bit to much.",
	dive5: () =>
		"Lighter and darker stay left and right. Pick what up and down mean, then tap a poster or a word.",
}

const TRAIL_HINTS: Record<DiveVariant, string> = {
	dive1: "Tap a poster to walk there. You stay on this page.",
	dive2: "Tap a poster to walk there. You stay on this page.",
	dive3: "Your path starts here. Tap a poster to walk on.",
	dive4: "Tap a pile, then a poster to walk there.",
	dive5: "Tap a poster to walk there. You stay on this page.",
}

type Entry = { pick: PxTitle | DivePick; back: boolean }

/** A direction's posters in order: the title the visitor came from, then the titles that way. */
const entriesOf = (direction: DiveDirection): Entry[] => [
	...(direction.back ? [{ pick: direction.back, back: true }] : []),
	...direction.titles.map((pick) => ({ pick, back: false })),
]

/** A poster you can step onto. Never a link. */
function Poster({
	entry,
	direction,
	first,
	width,
	className = "",
	style,
	children,
}: {
	entry: Entry
	direction: DiveDirection
	/** The direction's first place: where the old center lands after a step the opposite way. */
	first: boolean
	width: number
	className?: string
	style?: CSSProperties
	children?: ReactNode
}) {
	const { pick, back } = entry
	const why = back ? "Where you came from" : (pick as DivePick).why
	return (
		<button
			type="button"
			className={`wk-p ${className}`}
			style={style}
			data-dive-step={keyOf(pick)}
			data-via={direction.id}
			data-dive-slot={first ? "" : undefined}
			data-dive-back={back ? "" : undefined}
			data-lv={back ? undefined : (pick as DivePick).level}
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
				<span className="dv-bk" aria-hidden="true">
					back
				</span>
			)}
			{children}
		</button>
	)
}

/** An empty first place: nothing to tap, but the place the old center flies to. */
const Ghost = ({
	className = "",
	style,
}: {
	className?: string
	style?: CSSProperties
}) => (
	<span
		className={`dv-g ${className}`}
		style={style}
		data-dive-slot=""
		aria-hidden="true"
	/>
)

/** A direction's word. It dives into the direction, or says why there is nothing that way. */
function Label({
	direction,
	model,
	className = "",
}: {
	direction: DiveDirection
	model: DiveModel
	className?: string
}) {
	const locked = model.lock === direction.id
	const ended = Boolean(direction.end)
	return (
		<button
			type="button"
			className={`dv-l ${className}`}
			data-dive-label={direction.pos}
			data-dive-lock={ended ? undefined : direction.id}
			data-dive-end={
				ended ? `${direction.label} ends here: ${direction.end}.` : undefined
			}
			aria-pressed={ended ? undefined : locked}
			aria-label={
				ended
					? `${direction.label}: nothing further. ${direction.end}`
					: locked
						? `${direction.label}: leave the dive`
						: `${direction.label}: see further this way`
			}
		>
			{direction.pos === "w" && <i>{ARROWS.w} </i>}
			<b>{direction.label}</b>
			{direction.pos !== "w" && <i> {ARROWS[direction.pos]}</i>}
			{ended && <em> ends</em>}
		</button>
	)
}

function Center({ model, width }: { model: DiveModel; width: number }) {
	return (
		<span className="wk-c">
			<span className="wk-i">
				<TmdbImage
					kind="poster"
					path={model.center.poster}
					width={width}
					alt={`${model.center.title} (${model.center.year})`}
					priority="eager"
					data-dive-center=""
				/>
			</span>
		</span>
	)
}

const at = ([x, y]: [number, number]) =>
	({ "--x": x, "--y": y }) as CSSProperties

const posOf = (model: DiveModel, id: string | null) =>
	model.directions.find((direction) => direction.id === id)?.pos

function mapProps(model: DiveModel, className: string) {
	return {
		className: `wk-map ${className}`,
		"data-dive-map": "",
		"data-axis": model.axis,
		"data-lock": model.lock ?? undefined,
		"data-lockpos": posOf(model, model.lock),
	}
}

function containerProps(direction: DiveDirection, model: DiveModel) {
	return {
		"data-dir": direction.id,
		"data-pos": direction.pos,
		"data-end": direction.end ? "" : undefined,
		"data-on": model.lock === direction.id ? "" : undefined,
	}
}

// dive1: a ring with two places per side, in percent of the map from its middle. The first place of a side is the
// one the title you came from takes.
const RING: Record<Pos, [number, number][]> = {
	n: [
		[-10.5, -31],
		[10.5, -31],
	],
	e: [
		[38.5, -16],
		[38.5, 16],
	],
	s: [
		[10.5, 31],
		[-10.5, 31],
	],
	w: [
		[-38.5, 16],
		[-38.5, -16],
	],
}
// A dive: the center moves to the opposite edge and the side opens into three ranks, near to far, each with its
// word ("a bit", the direction, "much"). Given for east and north; west and south are their mirrors.
const FAN: Record<
	"e" | "n",
	{
		run: [number, number][]
		back: [number, number]
		ranks: [number, number][]
	}
> = {
	e: {
		run: [
			[-7.5, -13],
			[-7.5, 13],
			[13, -26],
			[13, 0],
			[13, 26],
			[34, -16],
			[34, 16],
		],
		back: [-39.5, 0],
		ranks: [
			[-7.5, -45],
			[13, -45],
			[34, -45],
		],
	},
	n: {
		run: [
			[-8.7, 5.4],
			[8.7, 5.4],
			[-18, -14.8],
			[0, -14.8],
			[18, -14.8],
			[-9.8, -34.7],
			[9.8, -34.7],
		],
		back: [0, 40],
		ranks: [
			[-38, 5.4],
			[-38, -14.8],
			[-38, -34.7],
		],
	},
}
const fanOf = (pos: Pos) => {
	const base = FAN[pos === "e" || pos === "w" ? "e" : "n"]
	const flip = ([x, y]: [number, number]): [number, number] =>
		pos === "w" ? [-x, y] : pos === "s" ? [x, -y] : [x, y]
	return {
		run: base.run.map(flip),
		back: flip(base.back),
		ranks: base.ranks.map(flip),
	}
}

function Ring({ model }: { model: DiveModel }) {
	const lockPos = posOf(model, model.lock)
	const fan = lockPos ? fanOf(lockPos) : null
	const opposite = model.lock ? oppositeOf(model.lock) : null
	return (
		<div {...mapProps(model, "dv1")}>
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<ellipse cx="50" cy="50" rx="34" ry="31" />
			</svg>
			<Center model={model} width={104} />
			{model.directions.map((direction) => {
				const entries = entriesOf(direction)
				let places: [number, number][] = RING[direction.pos]
				let shown = entries
				if (fan) {
					if (direction.id === model.lock) {
						// The title you came from keeps the first place of its side, and the run takes the rest.
						places = fan.run
					} else if (direction.id === opposite) {
						places = [fan.back]
						shown = entries.filter((entry) => entry.back)
					} else shown = []
				}
				const empty = fan
					? direction.id === opposite && !shown.length
					: !shown.length
				return (
					<div
						key={direction.id}
						className={`dv-d dv1-${direction.pos}`}
						{...containerProps(direction, model)}
					>
						<Label direction={direction} model={model} />
						{shown.slice(0, places.length).map((entry, index) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								first={index === 0}
								width={72}
								style={at(places[index])}
							/>
						))}
						{empty && <Ghost style={at(places[0])} />}
						{fan &&
							direction.id === model.lock &&
							["a bit", direction.word, "much"].map(
								(text, rank) =>
									shown.length > [0, 2, 5][rank] && (
										<span
											key={text}
											className="dv1-gr"
											style={at(fan.ranks[rank])}
											aria-hidden="true"
										>
											{text}
										</span>
									),
							)}
					</div>
				)
			})}
		</div>
	)
}

// dive2: a compass. A dive makes one arm long: a row that scrolls sideways.
// dive5: the same compass, and above it a dial that says what up and down mean.
function Compass({ model, dial }: { model: DiveModel; dial?: boolean }) {
	const opposite = model.lock ? oppositeOf(model.lock) : null
	const lockPos = posOf(model, model.lock)
	return (
		<div {...mapProps(model, dial ? "dv2 dv5" : "dv2")}>
			{dial && (
				<div className="dv5-dial">
					<span aria-hidden="true">↕</span>
					{SECOND_AXES.map((axis) => (
						<button
							key={axis.id}
							type="button"
							data-dive-axis={axis.id}
							aria-pressed={axis.id === model.axis}
							aria-label={`Up and down: ${axis.low.toLowerCase()} and ${axis.high.toLowerCase()}`}
						>
							{axis.name}
						</button>
					))}
				</div>
			)}
			<Center model={model} width={96} />
			{model.directions.map((direction) => {
				const locked = model.lock === direction.id
				let entries = entriesOf(direction)
				// East or west as a long arm takes the whole middle row: the other side keeps only the way back.
				if (direction.id === opposite && (lockPos === "e" || lockPos === "w"))
					entries = entries.filter((entry) => entry.back)
				return (
					<div
						key={direction.id}
						className={`dv-d dv2-${direction.pos}`}
						{...containerProps(direction, model)}
					>
						<Label direction={direction} model={model} />
						<span className="dv2-r">
							{entries.map((entry, index) => (
								<Poster
									key={keyOf(entry.pick)}
									entry={entry}
									direction={direction}
									first={index === 0}
									width={64}
								/>
							))}
							{!entries.length && <Ghost />}
						</span>
						{locked && (
							<span className="dv2-sc" aria-hidden="true">
								{direction.pos === "w" ? "much ← a bit" : "a bit → much"}
							</span>
						)}
					</div>
				)
			})}
		</div>
	)
}

// dive3: lanes. Top to bottom: north, east, west, south, so that opposite ways mirror around the middle.
const LANES: Pos[] = ["n", "e", "w", "s"]

function Lanes({ model }: { model: DiveModel }) {
	return (
		<div {...mapProps(model, "dv3")}>
			<Center model={model} width={140} />
			<div className="dv3-b">
				{LANES.map((pos) => {
					const direction = model.directions.find((d) => d.pos === pos)
					if (!direction) return null
					const locked = model.lock === direction.id
					const entries = entriesOf(direction)
					return (
						<div
							key={direction.id}
							className="dv-d dv3-lane"
							{...containerProps(direction, model)}
						>
							<Label direction={direction} model={model} />
							<span className="dv3-r">
								{entries.map((entry, index) => (
									<Poster
										key={keyOf(entry.pick)}
										entry={entry}
										direction={direction}
										first={index === 0}
										width={48}
									/>
								))}
								{!entries.length && <Ghost />}
								{!locked && !direction.end && (
									<button
										type="button"
										className="dv3-m"
										data-dive-lock={direction.id}
										aria-label={`See further: ${direction.word}`}
									>
										›
									</button>
								)}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

// dive4: where a pile sits, in percent of the map from its middle. Opposite ways lie across the center.
const PILES: Record<Pos, [number, number]> = {
	w: [-31, -29],
	n: [31, -29],
	s: [-31, 29],
	e: [31, 29],
}

function Piles({ model }: { model: DiveModel }) {
	return (
		<div {...mapProps(model, "dv4")}>
			<Center model={model} width={104} />
			{model.directions.map((direction) => {
				const locked = model.lock === direction.id
				const entries = entriesOf(direction)
				const [x, y] = PILES[direction.pos]
				return (
					<div
						key={direction.id}
						className={`dv-d dv4-g ${y < 0 ? "dv4-top" : "dv4-bottom"} ${x < 0 ? "dv4-left" : "dv4-right"}`}
						data-dive-pile={direction.id}
						style={at([x, y])}
						{...containerProps(direction, model)}
					>
						<Label direction={direction} model={model} />
						{(locked ? entries : entries.slice(0, 3)).map((entry, index) => (
							<Poster
								key={keyOf(entry.pick)}
								entry={entry}
								direction={direction}
								first={index === 0}
								width={72}
								className={locked ? "dv4-o" : `dv4-k${index}`}
								style={locked ? ({ "--k": index } as CSSProperties) : undefined}
							/>
						))}
						{locked && entries.length > 0 && (
							<span className="dv4-sc" aria-hidden="true">
								<i>a bit {direction.word}</i>
								<i>much {direction.word}</i>
							</span>
						)}
						{!entries.length && <Ghost className="dv4-k0" />}
					</div>
				)
			})}
		</div>
	)
}

/** The caption of the title you stand on: its name, the separate control that opens its page, and one line. */
function Caption({ model, isRoot }: { model: DiveModel; isRoot: boolean }) {
	const { center } = model
	const locked = model.directions.find((d) => d.id === model.lock)
	return (
		<div className="wk-cap">
			<p className="wk-here">
				<span className="wk-here-l">You're on</span>
				<b data-dive-here="">{center.title}</b>
				<span className="wk-meta" data-dive-meta="">
					{center.year}
					{center.type === "show" ? " · Show" : ""}
				</span>
				{isRoot ? (
					<span className="wk-this">this page</span>
				) : (
					<a
						className="wk-open"
						data-dive-nav=""
						data-dive-open=""
						href={pathOf(center)}
					>
						Open<span className="sr-only"> {center.title}</span>
					</a>
				)}
			</p>
			<p className="wk-why" data-dive-why="" aria-live="polite">
				{locked
					? locked.titles.length
						? `${locked.label} than ${center.title}, from a bit to much. Tap the word again for all four ways.`
						: `${locked.label} ends here: ${locked.end}.`
					: HINTS[model.variant]()}
			</p>
		</div>
	)
}

function Stage({ model, rootKey }: { model: DiveModel; rootKey: string }) {
	return (
		<>
			{model.variant === "dive1" && <Ring model={model} />}
			{model.variant === "dive2" && <Compass model={model} />}
			{model.variant === "dive3" && <Lanes model={model} />}
			{model.variant === "dive4" && <Piles model={model} />}
			{model.variant === "dive5" && <Compass model={model} dial={true} />}
			<Caption model={model} isRoot={keyOf(model.center) === rootKey} />
			{model.links.length > 0 && (
				<p className="wk-more">
					<span>Open a page:</span>
					{model.links.map((title) => (
						<a key={keyOf(title)} data-dive-nav="" href={pathOf(title)}>
							{title.title} ({title.year})
						</a>
					))}
				</p>
			)}
		</>
	)
}

/** The stage around a title: what a step or a dive swaps in. */
export const diveStageHtml = (model: DiveModel, rootKey: string) =>
	renderToStaticMarkup(<Stage model={model} rootKey={rootKey} />)

/**
 * Everything inside the section on a title page. Without a model (the related titles weren't there in time) the
 * stage is empty and the script asks for it.
 */
export function diveSectionHtml(input: {
	variant: DiveVariant
	title: string
	rootKey: string
	model: DiveModel | undefined
}) {
	return renderToStaticMarkup(
		<>
			<h2 className="wk-h">Titles like {input.title}</h2>
			<div className="wk-trail" data-dive-trail="">
				<p className="wk-hint" data-dive-hint="">
					{TRAIL_HINTS[input.variant]}
				</p>
				<ol
					className="wk-crumbs"
					data-dive-crumbs=""
					hidden={true}
					aria-label="Where you walked"
				/>
			</div>
			<div
				className="wk-stage"
				data-dive-stage=""
				data-dive-load={input.model ? undefined : ""}
			>
				{input.model && <Stage model={input.model} rootKey={input.rootKey} />}
			</div>
		</>,
	)
}
