// The title page's fingerprint section: what the title does to you.
//
// - 12 dials lead it (Dials.tsx): hovering one lights the sub-scores it's read from on the drawing; a click or tap pins
//   it. On phones a tap brings the drawing into view.
// - The effect rows beside the drawing (desktop) or under it (phones): the title's five leading effects, type size by
//   strength. A click on a row or an area of the drawing puts that effect in a selection of up to three (a dot marks
//   selected rows; hover shows a plus or a cross). The rows never grow: the last selected effect that isn't a row takes
//   the "Not for" line's place.
// - The drawing (Shape.tsx) lights the selection and names its ingredients with their scores at the rim.
// - Under them, the titles that share the selection (Results.tsx), and the member's taste card (TasteCard.tsx).
// It opens on the title's rarest pair of effects among its rows.
import { type HTMLAttributes, useMemo, useRef, useState } from "react"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { Dials } from "./Dials"
import { Results } from "./Results"
import { Shape } from "./Shape"
import { TasteCard } from "./TasteCard"
import { useRarePairs } from "./population"
import {
	type Phrase,
	type Reading,
	phraseOf,
	printAttributes,
	readTitle,
} from "./reading"
import {
	type Target,
	byId,
	dialLight,
	keyOf,
	lightOf,
	nextSelection,
	startSelection,
} from "./selection"
import { SECTION_STYLE } from "./styles"

type Media = MovieResult | ShowResult
type Handlers = (t: Target) => HTMLAttributes<HTMLElement>

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'

export function FingerprintSection({
	media,
	sides,
}: { media: Media; sides: TitleSides | null }) {
	const t = useMemo(
		(): F.TitleInput | null =>
			media.fingerprint
				? {
						title: media.details.title,
						titleLang: media.details.presentation?.title.language,
						mediaType: media.mediaType,
						year: media.details.release_year,
						genres: media.details.genres,
						fingerprint: media.fingerprint,
					}
				: null,
		[media],
	)
	if (!t) return null
	return (
		<div
			data-feedback-area="analysis"
			data-fingerprint-section=""
			className="@container/fp"
		>
			<style>{SECTION_STYLE}</style>
			<Body t={t} selfId={media.details.tmdb_id} />
			{sides && (
				<TasteCard
					className="mt-6"
					sides={sides}
					mediaType={media.mediaType}
					tmdbId={media.details.tmdb_id}
				/>
			)}
		</div>
	)
}

function Body({ t, selfId }: { t: F.TitleInput; selfId: number }) {
	const scores = t.fingerprint.scores
	const reading = useMemo(() => readTitle(t), [t])
	const pairs = useRarePairs(t.mediaType, selfId)
	const start = useMemo(
		() => (pairs.data ? startSelection(pairs.data.pairs, reading) : []),
		[pairs.data, reading],
	)
	const attributes = useMemo(
		() => printAttributes(scores, POPULATION_MEDIANS[t.mediaType]),
		[scores, t.mediaType],
	)
	const isRow = (id: string) => reading.rows.some((p) => p.r.effect.id === id)

	// null until the first click: the selection is then the title's rarest pair.
	const [picked, setPicked] = useState<string[] | null>(null)
	const [hover, setHoverRaw] = useState<Target | null>(null)
	// The target just clicked shows no preview of undoing it until the pointer moves on.
	const [quiet, setQuiet] = useState<string | null>(null)
	const selected = picked ?? start
	const setHover = (target: Target | null) => {
		if (target && keyOf(target) === quiet) return
		if (quiet) setQuiet(null)
		setHoverRaw(target)
	}
	const pick = (target: Target) => {
		setDialPin(null)
		setPicked(nextSelection(selected, target, reading))
		setHoverRaw(null)
		setQuiet(keyOf(target))
	}
	const handlers: Handlers = (target) => ({
		onPointerEnter: (e) => e.pointerType === "mouse" && setHover(target),
		onPointerLeave: (e) => e.pointerType === "mouse" && setHover(null),
		onFocus: () => setHover(target),
		onBlur: () => setHover(null),
		onClick: () => pick(target),
	})

	// A dial lights what it's read from: on hover (mouse), or pinned by a click or tap.
	const [dialHover, setDialHover] = useState<string | null>(null)
	const [dialPin, setDialPin] = useState<string | null>(null)
	const dialName = dialHover ?? dialPin
	const dial = dialName
		? reading.scales.find((s) => s.sc.name === dialName)
		: undefined
	const drawing = useRef<HTMLDivElement>(null)

	// Hover previews the selection the click would make, on the drawing and the row marks only.
	const preview = hover ? nextSelection(selected, hover, reading) : selected
	const light = dial ? dialLight(dial, scores) : lightOf(preview, reading)
	const effects = selected
		.map((id) => byId(reading, id))
		.filter((r): r is EffectReading => !!r)

	const extraId = [...selected].reverse().find((id) => !isRow(id))
	const extra = extraId ? byId(reading, extraId) : null
	const label = `What it does to you, on eight feelings: ${reading.axes.map((a) => `${a.axis.label} ${a.strength.toFixed(1)}`).join(", ")}. Click an area to add it to the selection.`

	const pinDial = (name: string) => {
		const on = dialPin !== name
		setDialPin(on ? name : null)
		// The drawing the dial lights comes into view when it isn't, with room for the sticky bars.
		const el = drawing.current
		if (!on || !el) return
		const b = el.getBoundingClientRect()
		const below = b.bottom - (window.innerHeight - 96)
		const above = b.top - 176
		const by =
			below > 0 ? Math.min(below, Math.max(0, above)) : above < 0 ? above : 0
		if (by) {
			const reduce = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches
			window.scrollBy({ top: by, behavior: reduce ? "auto" : "smooth" })
		}
	}

	return (
		<>
			<Dials
				scales={reading.scales}
				active={dialName}
				pinned={dialPin}
				onHover={setDialHover}
				onPin={pinDial}
			/>
			<div className="grid grid-cols-1 gap-y-5 @min-[640px]/fp:grid-cols-[minmax(0,1fr)_21rem] @min-[640px]/fp:gap-x-8 @min-[860px]/fp:grid-cols-[minmax(0,1fr)_29rem] @min-[860px]/fp:gap-x-10">
				<div className="min-w-0 @min-[640px]/fp:pt-2">
					<Rows
						reading={reading}
						selected={selected}
						preview={preview}
						handlers={handlers}
						extra={extra ? phraseOf(extra) : null}
					/>
				</div>
				<div
					ref={drawing}
					// Phones: the dials, then the drawing, then the rows.
					className="order-first mx-auto w-full max-w-[24rem] min-w-0 @min-[640px]/fp:order-none @min-[640px]/fp:mx-0 @min-[640px]/fp:max-w-none"
				>
					{/* Phones: a tighter box, names kept inside it. Wider: names may reach into the gap beside the rows. */}
					{[false, true].map((wide) => (
						<div
							key={String(wide)}
							className={
								wide ? "hidden @min-[640px]/fp:block" : "@min-[640px]/fp:hidden"
							}
						>
							<Shape
								reading={reading}
								attributes={attributes}
								light={light}
								onPoint={(axis) =>
									setHover(axis ? { kind: "axis", id: axis } : null)
								}
								onPick={(axis) => axis && pick({ kind: "axis", id: axis })}
								label={label}
								bleed={wide ? 72 : 0}
								W={wide ? 262 : 300}
								H={wide ? 200 : 194}
							/>
						</div>
					))}
				</div>
			</div>

			<div className="mt-6 border-t border-white/[0.06] pt-4">
				<Results
					effects={effects}
					ready={pairs.isFetched || picked !== null}
					type={t.mediaType}
					selfId={selfId}
					onRemove={(id) => pick({ kind: "effect", id })}
				/>
			</div>
		</>
	)
}

// --- Rows -----------------------------------------------------------------------------------------------------------

/** The largest type size that still fits every row and its mark on one line. */
function fitHi(rows: Phrase[]) {
	const terms = rows
		.filter((p) => p.k > 0.05)
		.map(
			(p) =>
				`calc(var(--lo) + (98cqi / ${(`${p.r.effect.name}.`.length * 0.48 + 0.9).toFixed(2)} - var(--lo)) / ${p.k.toFixed(3)})`,
		)
	return `min(var(--hi-max)${terms.map((x) => `, ${x}`).join("")})`
}

/** After a row: a dot when it's selected; on hover a plus (would add) or a cross (would take out). */
function Mark({
	state,
	color,
}: { state: "selected" | "add" | "remove" | null; color: string }) {
	return (
		<span
			className="relative ml-[.3em] inline-block h-[.5em] w-[.5em] align-[.1em]"
			aria-hidden="true"
		>
			<span
				className="fp-fade absolute inset-[14%] rounded-full"
				style={{ background: color, opacity: state === "selected" ? 1 : 0 }}
			/>
			<svg
				viewBox="0 0 20 20"
				aria-hidden="true"
				className="fp-fade absolute -inset-[15%] h-[130%] w-[130%]"
				style={{ opacity: state === "add" || state === "remove" ? 1 : 0 }}
			>
				{state === "remove" ? (
					<path
						d="M5.5 5.5l9 9M14.5 5.5l-9 9"
						stroke="#a8a29e"
						strokeWidth="2.4"
						strokeLinecap="round"
					/>
				) : (
					<path
						d="M10 4v12M4 10h12"
						stroke={color}
						strokeWidth="2.4"
						strokeLinecap="round"
					/>
				)}
			</svg>
		</span>
	)
}

function Rows({
	reading,
	selected,
	preview,
	handlers,
	extra,
}: {
	reading: Reading
	selected: string[]
	preview: string[]
	handlers: Handlers
	/** The last selected effect that isn't a row: it takes the "Not for" line's place. */
	extra: Phrase | null
}) {
	const markOf = (id: string) => {
		const now = selected.includes(id)
		const will = preview.includes(id)
		return now && !will
			? "remove"
			: !now && will
				? "add"
				: now
					? "selected"
					: null
	}
	return (
		<div
			className="@container [--lo:19px] [--hi-max:30px] @min-[420px]:[--lo:21px] @min-[420px]:[--hi-max:38px] @min-[520px]:[--lo:22px] @min-[520px]:[--hi-max:42px]"
			style={{ fontFamily: DISPLAY, ["--hi" as string]: fitHi(reading.rows) }}
		>
			<ul>
				{reading.rows.map((p) => {
					const id = p.r.effect.id
					const on = selected.includes(id)
					const color = p.r.counts
						? p.color
						: `color-mix(in srgb, ${p.color} 50%, #78716c)`
					return (
						<li key={id}>
							<button
								type="button"
								aria-pressed={on}
								aria-label={`${p.r.effect.name}: ${on ? "take out of" : "add to"} the selection`}
								{...handlers({ kind: "effect", id })}
								className="-mx-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 py-[.16em] text-left leading-[1.12] whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-amber-300 @max-[640px]/fp:text-center"
								style={{
									color,
									fontSize: `calc(var(--lo) + (var(--hi) - var(--lo)) * ${p.k.toFixed(3)})`,
									fontWeight: Math.round(560 + 300 * p.k),
									letterSpacing: `${(-0.004 - 0.022 * p.k).toFixed(3)}em`,
								}}
							>
								{p.r.effect.name}.
								<Mark state={markOf(id)} color={p.color} />
							</button>
						</li>
					)
				})}
			</ul>
			{/* One slot of fixed height: the extra effect when there is one, else what the title is not for. */}
			<div className="mt-1 flex h-[calc(var(--lo)*1.44)] items-center @max-[640px]/fp:justify-center">
				{extra ? (
					<button
						key={extra.r.effect.id}
						type="button"
						aria-pressed="true"
						aria-label={`${extra.r.effect.name}: take out of the selection`}
						{...handlers({ kind: "effect", id: extra.r.effect.id })}
						className="fp-xin -mx-2 block cursor-pointer rounded-lg px-2 text-left leading-[1.12] whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-amber-300"
						style={{
							color: extra.color,
							fontSize: "var(--lo)",
							fontWeight: 600,
							letterSpacing: "-0.004em",
						}}
					>
						{extra.r.effect.name}.
						<Mark state={markOf(extra.r.effect.id)} color={extra.color} />
					</button>
				) : (
					reading.not.length > 0 && (
						<p
							key="not"
							className="fp-xin font-sans text-[15px] font-medium text-gray-500"
						>
							Not for{" "}
							{reading.not
								.map(
									(n, i) =>
										`${i > 0 ? (i === reading.not.length - 1 ? " or " : ", ") : ""}${n}`,
								)
								.join("")}
							.
						</p>
					)
				)}
			</div>
		</div>
	)
}
