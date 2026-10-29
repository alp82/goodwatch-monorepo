// PROTOTYPE (start-streamline, round 2): the card's box as a teaser that grows into the card. The room keeps the
// framing a search gives today (the sofa between the search block and the card), so nothing in the room moves.
//
// The card is always laid out at full height. Closed, only its top `--pst2-t` shows: a clip box moved up by the
// hidden height, with the card moved back down by the same amount inside it. Opening moves both to 0, so the clip's
// lower edge slides down while the card's top stays put. Transforms only.
//
// Flows (`?flow=`): d Preview (a compact panel), e Ledge (posters on the room's floor, no panel), f Open (the card
// from the start, the room's lamp coming on).
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
import { ListTag } from "~/ui/list-tag/ListTag"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { Flow } from "./ProtoSwitcher"
import type { TeaserModel, TeaserSide } from "./teaser-models"

export function useReveal(flow: Flow, startOpen: boolean) {
	const [open, setOpen] = useState(flow === "f" || startOpen)
	useEffect(() => {
		if (flow === "f") return
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			if ((e.target as HTMLElement | null)?.closest("input, textarea")) return
			setOpen(false)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [flow])
	return {
		open: flow === "f" || open,
		request: (next: boolean) => setOpen(flow === "f" ? true : next),
	}
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
	className: "pst2",
	"data-flow": flow,
	...(open ? { "data-open": "" } : {}),
})

export function RevealCard({
	open,
	onOpen,
	onClose,
	onAction,
	teaser,
	children,
}: {
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
			<div className="pst2-clip">
				<div className="pst2-inner">
					<div className="pst2-content" {...(open ? {} : { inert: "" })}>
						{children}
					</div>
					{teaser ? (
						<div className="pst2-teaser" {...(open ? { inert: "" } : {})}>
							<Teaser model={teaser} onOpen={onOpen} onAction={onAction} />
						</div>
					) : null}
				</div>
			</div>
		</>
	)
}

function Teaser({
	model: m,
	onOpen,
	onAction,
}: {
	model: TeaserModel
	onOpen: () => void
	onAction: (id: TeaserModel["action"]["id"]) => void
}) {
	return (
		<div className="pst2-t" data-kind={m.kind} data-tone={m.tone}>
			{/* The whole teaser opens the card; the button over it does its own action. */}
			<button
				type="button"
				className="pst2-cover"
				aria-label={`Open: ${m.headline}`}
				aria-controls="start-card"
				onClick={onOpen}
			/>
			<div key={m.key} className="pst2-body">
				{m.kind === "fan" ? <Fan posters={m.posters} /> : null}
				<div className="pst2-words">
					<div className="pst2-eyebrow">
						{m.busy ? <Dots /> : null}
						{m.eyebrow}
					</div>
					<div className="pst2-headline">{m.headline}</div>
					{m.sub ? <div className="pst2-sub">{m.sub}</div> : null}
				</div>
				<button
					type="button"
					className="pst2-cta"
					onClick={() => onAction(m.action.id)}
				>
					{m.action.id === "surprise" ? <DieIcon /> : null}
					{m.action.label}
				</button>
				{m.kind === "row" ? <Row posters={m.posters} busy={!!m.busy} /> : null}
				{m.kind === "pair" && m.pair ? <Pair pair={m.pair} /> : null}
			</div>
		</div>
	)
}

function Fan({ posters }: { posters: TeaserModel["posters"] }) {
	const shown = posters.filter((p) => p.path).slice(0, 5)
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
