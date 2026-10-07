// PROTOTYPE for "Prototype native-scroll carousels on title pages", third round. Throwaway code: not for production.
//
// The markup of the five walk variants, as strings. The title page puts the whole section into its HTML, and a step
// in the browser asks the prototype's endpoint for the stage around another title and swaps it in. React renders
// nothing of it in the browser and attaches no handler: one inline script drives every variant (WALK_SCRIPT in
// ui/prototype-carousels/WalkSection.tsx), so a tap works from the moment the section is in the document.
//
// The rule of this round is in the markup: a poster is a button, never a link. The links are the "Open" control
// of the title you stand on and the one line of text links at the bottom.
import type { CSSProperties, ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TmdbImage } from "~/ui/TmdbImage"
import type { PxPick, PxTitle } from "~/ui/prototype-carousels/explore-model"
import type {
	WalkModel,
	WalkVariant,
} from "~/ui/prototype-carousels/walk-model"
import { titleToDashed } from "~/utils/helpers"

const pathOf = (title: Pick<PxTitle, "type" | "id" | "title">) =>
	`/${title.type}/${title.id}-${titleToDashed(title.title)}`
const keyOf = (title: Pick<PxTitle, "type" | "id">) =>
	`${title.type}-${title.id}`

/** What the reason line says while nothing was stepped onto or focused. */
const HINTS: Record<WalkVariant, (center: string) => string> = {
	walk1: (center) =>
		`Eight of the closest to ${center}. Walk to one, and this line says how it differs.`,
	walk2: (center) =>
		`Four ways to leave ${center}. Tap a poster to go that way.`,
	walk3: (center) =>
		`Each branch leans another way from ${center}. Your path grows above.`,
	walk4: () => "",
	walk5: (center) =>
		`Four piles, each around something they share with ${center}. Tap a pile to spread it out.`,
}

const TRAIL_HINTS: Record<WalkVariant, string> = {
	walk1: "Tap a poster to walk there. You stay on this page.",
	walk2: "Tap a poster to walk there. You stay on this page.",
	walk3: "Your path starts here. Tap a branch to walk on.",
	walk4: "Tap a poster to walk there. You stay on this page.",
	walk5: "Tap a pile, then a poster to walk there.",
}

/** A poster you can step onto. Never a link. */
function Step({
	pick,
	index,
	width,
	className = "",
	on,
	style,
	children,
}: {
	pick: PxPick
	index: number
	width: number
	/** The one the caption talks about. */
	on?: boolean
	className?: string
	style?: CSSProperties
	children?: ReactNode
}) {
	return (
		<button
			type="button"
			className={`wk-p ${className}`}
			style={style}
			data-walk-step={keyOf(pick)}
			data-i={index}
			data-on={on ? "" : undefined}
			data-t={pick.title}
			data-y={pick.year}
			data-why={pick.why}
			aria-label={`Walk to ${pick.title} (${pick.year}): ${pick.why}`}
		>
			<span className="wk-i">
				<TmdbImage kind="poster" path={pick.poster} width={width} alt="" />
			</span>
			{children}
		</button>
	)
}

function Center({ model, width }: { model: WalkModel; width: number }) {
	return (
		<span className="wk-c">
			<span className="wk-i">
				<TmdbImage
					kind="poster"
					path={model.center.poster}
					width={width}
					alt={`${model.center.title} (${model.center.year})`}
					priority="eager"
					data-walk-center=""
				/>
			</span>
		</span>
	)
}

const at = (x: number, y: number) => ({ "--x": x, "--y": y }) as CSSProperties

// walk1: a regular ring, closest at the top and then clockwise. In percent of the map from its middle.
const RING: [number, number][] = [
	[0, -38.7],
	[28.6, -27.4],
	[40.5, 0],
	[28.6, 27.4],
	[0, 38.7],
	[-28.6, 27.4],
	[-40.5, 0],
	[-28.6, -27.4],
]
// walk4: the same ring turned by half a step, so no poster sits straight above the center.
const ORBIT: [number, number][] = [
	[15.5, -33.7],
	[37.4, -14],
	[37.4, 14],
	[15.5, 33.7],
	[-15.5, 33.7],
	[-37.4, 14],
	[-37.4, -14],
	[-15.5, -33.7],
]

function Ring({
	model,
	places,
	orbit,
}: {
	model: WalkModel
	places: [number, number][]
	orbit?: boolean
}) {
	const ring = (model.ring ?? []).slice(0, places.length)
	return (
		<div className="wk-map">
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				{orbit && <ellipse cx="50" cy="50" rx="40.5" ry="36.5" />}
				{ring.map((pick, index) => (
					<line
						key={keyOf(pick)}
						data-spoke={index}
						data-on={orbit && index === 0 ? "" : undefined}
						x1="50"
						y1="50"
						x2={50 + places[index][0]}
						y2={50 + places[index][1]}
						vectorEffect="non-scaling-stroke"
					/>
				))}
			</svg>
			<Center model={model} width={104} />
			{ring.map((pick, index) => (
				<Step
					key={keyOf(pick)}
					pick={pick}
					index={index}
					width={72}
					style={at(...places[index])}
					on={orbit && index === 0}
				/>
			))}
		</div>
	)
}

const ARROWS = ["↑", "→", "↓", "←"]
const SLOT_NAMES = ["n", "e", "s", "w"]

function Compass({ model }: { model: WalkModel }) {
	let index = 0
	return (
		<div className="wk-map">
			<Center model={model} width={96} />
			{(model.compass ?? []).map((direction) => (
				<div
					key={direction.slot}
					className={`wk2-d wk2-${SLOT_NAMES[direction.slot]}`}
				>
					<span className="wk2-l">
						{direction.slot === 3 && <i>{ARROWS[3]} </i>}
						{direction.label}
						{direction.slot !== 3 && <i> {ARROWS[direction.slot]}</i>}
					</span>
					<span className="wk2-r">
						{direction.titles.map((pick) => (
							<Step key={keyOf(pick)} pick={pick} index={index++} width={64} />
						))}
					</span>
				</div>
			))}
		</div>
	)
}

function Path({ model }: { model: WalkModel }) {
	return (
		<div className="wk-map">
			<Center model={model} width={140} />
			<div className="wk3-b">
				{(model.steps ?? []).map((step, index) => (
					<Step key={keyOf(step)} pick={step} index={index} width={48}>
						<span className="wk3-x">
							<b>{step.toward}</b>
							<span>
								{step.title} ({step.year})
							</span>
							<em>{step.why}</em>
						</span>
					</Step>
				))}
			</div>
		</div>
	)
}

// walk5: where a pile sits and, spread out, where its three posters go. In percent of the map from its middle.
const PILES: [number, number][] = [
	[-31, -31],
	[31, -31],
	[-31, 31],
	[31, 31],
]

function Piles({ model }: { model: WalkModel }) {
	let index = 0
	return (
		<div className="wk-map" data-walk-piles="">
			<Center model={model} width={104} />
			{(model.piles ?? []).slice(0, 4).map((pile, p) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: a pile is its position.
					key={p}
					className={`wk5-g ${p < 2 ? "wk5-top" : "wk5-bottom"} ${p % 2 ? "wk5-right" : "wk5-left"}`}
					data-walk-pile={p}
					data-label={pile.label}
					style={at(...PILES[p])}
				>
					<button
						type="button"
						className="wk5-l"
						data-walk-pile-open={p}
						aria-label={`${pile.label}: spread out ${pile.titles.length} titles`}
					>
						{pile.label}
					</button>
					{pile.titles.map((pick, k) => (
						<Step
							key={keyOf(pick)}
							pick={pick}
							index={index++}
							width={72}
							className={`wk5-k${k}`}
						>
							<span className="wk5-t">{pick.tag}</span>
						</Step>
					))}
				</div>
			))}
		</div>
	)
}

/** The caption of the title you stand on: its name, the separate control that opens its page, and one reason. */
function Caption({
	model,
	isRoot,
}: {
	model: WalkModel
	isRoot: boolean
}) {
	const { center } = model
	const first = model.ring?.[0]
	return (
		<div className="wk-cap">
			<p className="wk-here">
				<span className="wk-here-l">You're on</span>
				<b data-walk-here="">{center.title}</b>
				<span className="wk-meta" data-walk-meta="">
					{center.year}
					{center.type === "show" ? " · Show" : ""}
				</span>
				{isRoot ? (
					<span className="wk-this">this page</span>
				) : (
					<a
						className="wk-open"
						data-walk-nav=""
						data-walk-open=""
						href={pathOf(center)}
					>
						Open<span className="sr-only"> {center.title}</span>
					</a>
				)}
			</p>
			{model.variant === "walk4" ? (
				<div className="wk-voice">
					<button
						type="button"
						data-walk-voice-dir="-1"
						aria-label="Previous title"
					>
						‹
					</button>
					<p className="wk-why" data-walk-voice="">
						<b data-walk-voice-t="">
							{first ? `${first.title} (${first.year})` : ""}
						</b>{" "}
						<span data-walk-voice-w="">{first?.why}</span>
					</p>
					<button type="button" data-walk-voice-dir="1" aria-label="Next title">
						›
					</button>
				</div>
			) : (
				<p className="wk-why" data-walk-why="" aria-live="polite">
					{HINTS[model.variant](center.title)}
				</p>
			)}
		</div>
	)
}

function Stage({ model, rootKey }: { model: WalkModel; rootKey: string }) {
	return (
		<>
			{model.variant === "walk1" && <Ring model={model} places={RING} />}
			{model.variant === "walk2" && <Compass model={model} />}
			{model.variant === "walk3" && <Path model={model} />}
			{model.variant === "walk4" && (
				<Ring model={model} places={ORBIT} orbit={true} />
			)}
			{model.variant === "walk5" && <Piles model={model} />}
			<Caption model={model} isRoot={keyOf(model.center) === rootKey} />
			{model.links.length > 0 && (
				<p className="wk-more">
					<span>Open a page:</span>
					{model.links.map((title) => (
						<a key={keyOf(title)} data-walk-nav="" href={pathOf(title)}>
							{title.title} ({title.year})
						</a>
					))}
				</p>
			)}
		</>
	)
}

/** The stage around a title: what a step swaps in. */
export const walkStageHtml = (model: WalkModel, rootKey: string) =>
	renderToStaticMarkup(<Stage model={model} rootKey={rootKey} />)

/**
 * Everything inside the section on a title page. Without a model (the related titles weren't there in time) the
 * stage is empty and the script asks for it.
 */
export function walkSectionHtml(input: {
	variant: WalkVariant
	title: string
	rootKey: string
	model: WalkModel | undefined
}) {
	return renderToStaticMarkup(
		<>
			<h2 className="wk-h">Titles like {input.title}</h2>
			<div className="wk-trail" data-walk-trail="">
				<p className="wk-hint" data-walk-hint="">
					{TRAIL_HINTS[input.variant]}
				</p>
				<ol
					className="wk-crumbs"
					data-walk-crumbs=""
					hidden={true}
					aria-label="Where you walked"
				/>
			</div>
			<div
				className="wk-stage"
				data-walk-stage=""
				data-walk-load={input.model ? undefined : ""}
			>
				{input.model && <Stage model={input.model} rootKey={input.rootKey} />}
			</div>
		</>,
	)
}
