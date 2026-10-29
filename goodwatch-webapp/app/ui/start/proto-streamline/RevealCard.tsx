// PROTOTYPE (start-streamline, rounds 2 and 3): the card's box as a teaser that grows into the card. The room
// never moves.
//
// The card is always laid out at full height, and only the teaser's height of it shows while closed: a clip box moved
// by the hidden height, with the card moved back by the same amount inside it. Opening moves both to 0. Transforms
// only.
//
// - Round 2 (`?flow=e`): the teaser is the card's top, so the card grows down.
// - Rounds 3 and 4 (`?flow=g|k|l|m|n`): the room sits lower (the window in view), the teaser is the card's bottom
//   on the room's floor, and the card grows up from it (streamline.css, `.pst3`). Tapping the teaser does its
//   action: a guest's empty state rolls a surprise mood at once. Once open, the card stays open.
import { ChevronDownIcon, FilmIcon, PlayIcon, TvIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
import { ListTag } from "~/ui/list-tag/ListTag"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { type Flow, ROUND3 } from "./ProtoSwitcher"
import type { ListLink, TeaserModel, TeaserSide } from "./teaser-models"

/** Whether the card is open. Once open it stays open: there is no way back to the ledge. */
export function useReveal(startOpen: boolean) {
	const [open, setOpen] = useState(startOpen)
	return { open, request: (next: boolean) => setOpen((was) => was || next) }
}

/** The lamp: the room loads dim and the light comes up a moment after the page has started. */
export function useLamp(delay = 700) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		const t = setTimeout(() => setOn(true), delay)
		return () => clearTimeout(t)
	}, [delay])
	return on
}

/** The wrapper's attributes: StartStage's card box reads them through `.pst2`. */
export const revealAttrs = (flow: Flow, open: boolean) => ({
	className: ROUND3.includes(flow) ? "pst2 pst3" : "pst2",
	"data-flow": flow,
	...(open ? { "data-open": "" } : {}),
})

export function RevealCard({
	open,
	onOpen,
	onClose,
	onAction,
	teaser,
	fan = 5,
	edge = null,
	children,
}: {
	/** Shown on the open card's top edge, outside its box (a member's list links). */
	edge?: ReactNode
	/** How many posters the fan shows. */
	fan?: number
	open: boolean
	onOpen: () => void
	onClose: (() => void) | null
	onAction: (id: TeaserModel["action"]["id"]) => void
	/** Null: no teaser (the card is always open). */
	teaser: TeaserModel | null
	children: ReactNode
}) {
	return (
		<>
			{onClose ? (
				<button
					type="button"
					className="pst2-tab"
					aria-label="Hide"
					tabIndex={open ? undefined : -1}
					onClick={onClose}
				>
					<ChevronDownIcon className="h-4 w-4" />
				</button>
			) : null}
			{edge ? (
				<div className="pst5-edge" {...(open ? {} : { inert: "" })}>
					{edge}
				</div>
			) : null}
			<div className="pst2-clip">
				<div className="pst2-inner">
					<div className="pst2-content" {...(open ? {} : { inert: "" })}>
						{children}
					</div>
					{teaser ? (
						<div className="pst2-teaser" {...(open ? { inert: "" } : {})}>
							<Teaser model={teaser} fan={fan} onOpen={onOpen} onAction={onAction} />
						</div>
					) : null}
				</div>
			</div>
		</>
	)
}

function Teaser({
	model: m,
	fan,
	onOpen,
	onAction,
}: {
	model: TeaserModel
	fan: number
	onOpen: () => void
	onAction: (id: TeaserModel["action"]["id"]) => void
}) {
	if (m.kind === "choose")
		return (
			<div className="pst2-t" data-kind="choose">
				<div key={m.key} className="pst5-choose">
					<ListLinks links={m.links ?? []} at="ledge" />
					<button type="button" className="pst5-go" aria-controls="start-card" onClick={onOpen}>
						<span className="pst5-go-icon" aria-hidden>
							<PlayIcon className="h-5 w-5" />
						</span>
						<span className="pst5-go-words">
							<span className="pst5-go-label">{m.headline}</span>
							{m.sub ? <span className="pst5-go-sub">{m.sub}</span> : null}
						</span>
					</button>
				</div>
			</div>
		)
	return (
		<div className="pst2-t" data-kind={m.kind} data-tone={m.tone}>
			{/* The whole teaser is one button: its action (open, or a surprise mood at once). */}
			<button
				type="button"
				className="pst2-cover"
				aria-label={`${m.action.label}: ${m.headline}`}
				aria-controls="start-card"
				onClick={() => (m.action.id === "open" ? onOpen() : onAction(m.action.id))}
			/>
			<div key={m.key} className="pst2-body">
				{m.kind === "fan" ? <Fan posters={m.posters} max={fan} /> : null}
				<div className="pst2-words">
					<div className="pst2-eyebrow">
						{m.busy ? <Dots /> : null}
						{m.eyebrow}
					</div>
					<div className="pst2-headline">{m.headline}</div>
					{m.sub ? <div className="pst2-sub">{m.sub}</div> : null}
				</div>
				{/* The action's label; the cover does it. */}
				<span aria-hidden className="pst2-cta">
					{m.action.id === "surprise" ? <DieIcon /> : null}
					{m.action.label}
				</span>
				{m.kind === "row" ? <Row posters={m.posters} busy={!!m.busy} /> : null}
				{m.kind === "pair" && m.pair ? <Pair pair={m.pair} /> : null}
			</div>
		</div>
	)
}

/** My movies and My shows: under the big button on the ledge, and as tabs on the open card's top edge. */
export function ListLinks({
	links,
	at,
}: {
	links: readonly ListLink[]
	at: "ledge" | "edge"
}) {
	return (
		<nav aria-label="Your lists" className="pst5-links" data-at={at}>
			{links.map((l, i) => (
				<Link key={l.href} to={l.href} prefetch="intent" className="pst5-link" data-side={i ? "right" : "left"}>
					{l.href.includes("movies") ? (
						<FilmIcon className="pst5-link-icon" aria-hidden />
					) : (
						<TvIcon className="pst5-link-icon" aria-hidden />
					)}
					<span className="pst5-link-label">{l.label}</span>
					{l.note ? <span className="pst5-link-note">{l.note}</span> : null}
				</Link>
			))}
		</nav>
	)
}

function Fan({ posters, max }: { posters: TeaserModel["posters"]; max: number }) {
	const shown = posters.filter((p) => p.path).slice(0, max)
	const mid = (shown.length - 1) / 2
	return (
		<div aria-hidden className="pst2-fan" style={{ "--n": shown.length } as CSSProperties}>
			{shown.map((p, i) => (
				<img
					key={`${p.path}`}
					src={tmdbImageUrl(p.path as string, "w185")}
					alt=""
					decoding="async"
					draggable={false}
					style={
						{
							"--d": i - mid,
							zIndex: 10 - Math.abs(Math.round(i - mid)),
						} as CSSProperties
					}
				/>
			))}
		</div>
	)
}

function Row({
	posters,
	busy,
}: {
	posters: TeaserModel["posters"]
	busy: boolean
}) {
	const shown = busy
		? Array.from({ length: 10 }, () => null)
		: posters.filter((p) => p.path).slice(0, 12)
	return (
		<div aria-hidden className="pst2-row">
			{shown.map((p, i) =>
				p ? (
					<img
						key={`${p.path}`}
						src={tmdbImageUrl(p.path as string, "w185")}
						alt=""
						decoding="async"
						draggable={false}
						style={{ "--i": i } as CSSProperties}
					/>
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
					<span key={i} className="pst2-skel" style={{ "--i": i } as CSSProperties} />
				),
			)}
		</div>
	)
}

function Pair({ pair }: { pair: readonly [TeaserSide, TeaserSide] }) {
	return (
		<div aria-hidden className="pst2-pair">
			<Side side={pair[0]} />
			<span className="pst2-or">or</span>
			<Side side={pair[1]} />
		</div>
	)
}

function Side({ side }: { side: TeaserSide }) {
	const src = side.backdrop
		? tmdbImageUrl(side.backdrop, "w300")
		: side.poster
			? tmdbImageUrl(side.poster, "w185")
			: null
	return (
		<div className="pst2-side">
			<div className="pst2-art">
				{src ? <img src={src} alt="" decoding="async" draggable={false} /> : null}
				{side.poster ? (
					<img
						className="pst2-art-poster"
						src={tmdbImageUrl(side.poster, "w185")}
						alt=""
						decoding="async"
						draggable={false}
					/>
				) : null}
				<ListTag kind={side.source} size="sm" className="pst2-art-tag">
					{side.source === "continue"
						? "Continue"
						: side.source === "wishlist"
							? "Wishlist"
							: "For you"}
				</ListTag>
			</div>
			<div className="pst2-side-words">
				<div className="pst2-side-title">{side.title}</div>
				<div className="pst2-side-why" data-source={side.source}>{side.why}</div>
			</div>
		</div>
	)
}

function Dots() {
	return (
		<span className="pst2-dots">
			<i />
			<i />
			<i />
		</span>
	)
}

function DieIcon() {
	return (
		<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
			<rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="2" />
			<circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
			<circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" />
			<circle cx="12" cy="12" r="1.4" fill="currentColor" />
		</svg>
	)
}
