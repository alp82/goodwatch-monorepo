// The ledge on the room's floor and the card that grows up from it (start.css, "The ledge"). It fills the stage's card
// box (stage/StartStage.tsx), which is always laid out at the open card's height.
//
// Until the card opens, only the box's bottom strip shows: a clip moved down by the hidden height, with the card
// moved back up by the same amount inside it. Opening moves both to 0, so the clip's top edge slides up while the card
// stays put; only transforms move. The strip shows the ledge (ledge-models.ts), and the whole ledge is one button doing
// its action. Once open, the card stays open: there is no way back to the ledge.
import { FilmIcon, PlayIcon, TvIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { DieIcon } from "../spotlight/card-parts"
import type { LedgeModel, ListLink } from "./ledge-models"

/** Whether the card is open: it opens on a request and stays open. */
export function useCardOpen(startOpen: boolean) {
	const [open, setOpen] = useState(startOpen)
	return { open, show: () => setOpen(true) }
}

/** How long the room waits in the dark before its lamp comes on (ms). */
export const LAMP_DELAY = 700

/** The lamp: the room loads dim, and the light comes up a moment after the page has started. */
export function useLamp(delay = LAMP_DELAY) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		const t = setTimeout(() => setOn(true), delay)
		return () => clearTimeout(t)
	}, [delay])
	return on
}

export function StartLedge({
	open,
	ledge,
	onOpen,
	onSurprise,
	tabs,
	children,
}: {
	open: boolean
	ledge: LedgeModel
	onOpen: () => void
	/** A guest's Surprise me: rolls a random mood (the card opens on its titles). */
	onSurprise?: () => void
	/** On the open card's top edge, outside its box: a member's list links. */
	tabs?: ReactNode
	/** The open card. */
	children: ReactNode
}) {
	return (
		<>
			{tabs ? (
				<div className="start-tabs" {...(open ? {} : { inert: "" })}>
					{tabs}
				</div>
			) : null}
			<div className="start-ledge-clip">
				<div className="start-ledge-inner">
					<div className="start-ledge-card" {...(open ? {} : { inert: "" })}>
						{children}
					</div>
					<div className="start-ledge" {...(open ? { inert: "" } : {})}>
						<Ledge
							model={ledge}
							onAction={() =>
								ledge.action.id === "surprise" && onSurprise
									? onSurprise()
									: onOpen()
							}
						/>
					</div>
				</div>
			</div>
		</>
	)
}

function Ledge({
	model: m,
	onAction,
}: { model: LedgeModel; onAction: () => void }) {
	if (m.kind === "choose")
		return (
			<div className="start-ledge-face" data-kind="choose">
				<div key={m.key} className="start-ledge-choose">
					<button
						type="button"
						className="start-ledge-go"
						aria-controls="start-card"
						onClick={onAction}
					>
						<span className="start-ledge-go-icon" aria-hidden>
							<PlayIcon className="h-5 w-5 sm:h-[26px] sm:w-[26px]" />
						</span>
						<span className="start-ledge-go-label">{m.headline}</span>
					</button>
					<ListLinks links={m.links ?? []} />
				</div>
			</div>
		)
	return (
		<div className="start-ledge-face" data-kind={m.kind} data-tone={m.tone}>
			{/* The whole ledge is one button: its action. */}
			<button
				type="button"
				className="start-ledge-cover"
				aria-label={`${m.action.label}: ${m.headline}`}
				aria-controls="start-card"
				onClick={onAction}
			/>
			<div key={m.key} className="start-ledge-body">
				{m.kind === "fan" ? <Fan posters={m.posters} /> : null}
				<div className="start-ledge-words">
					<div className="start-ledge-eyebrow">
						{m.busy ? <Dots /> : null}
						{m.eyebrow}
					</div>
					<div className="start-ledge-headline">{m.headline}</div>
					{m.sub ? <div className="start-ledge-sub">{m.sub}</div> : null}
				</div>
				{/* The action's name; the cover does it. */}
				<span aria-hidden className="start-ledge-cta">
					{m.action.id === "surprise" ? (
						<DieIcon className="h-[18px] w-[18px]" />
					) : null}
					{m.action.label}
				</span>
				{m.kind === "row" ? <Row posters={m.posters} busy={!!m.busy} /> : null}
			</div>
		</div>
	)
}

/** My movies and My shows: under a member's big button, and as tabs on the open card's top edge. */
export function ListLinks({ links }: { links: readonly ListLink[] }) {
	return (
		<nav aria-label="Your lists" className="start-lists">
			{links.map((l) => (
				<Link
					key={l.href}
					to={l.href}
					prefetch="intent"
					className="start-list-link"
				>
					{l.label === "My movies" ? (
						<FilmIcon className="start-list-icon" aria-hidden />
					) : (
						<TvIcon className="start-list-icon" aria-hidden />
					)}
					<span>{l.label}</span>
					{l.note ? <span className="start-list-note">{l.note}</span> : null}
				</Link>
			))}
		</nav>
	)
}

function Fan({ posters }: { posters: LedgeModel["posters"] }) {
	const shown = posters.filter((p) => p.path).slice(0, 5)
	const mid = (shown.length - 1) / 2
	return (
		<div
			aria-hidden
			className="start-ledge-fan"
			style={{ "--n": shown.length } as CSSProperties}
		>
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
	posters: LedgeModel["posters"]
	busy: boolean
}) {
	const shown = busy
		? Array.from({ length: 10 }, () => null)
		: posters.filter((p) => p.path).slice(0, 12)
	return (
		<div aria-hidden className="start-ledge-row">
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
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
						key={i}
						className="start-ledge-skel"
						style={{ "--i": i } as CSSProperties}
					/>
				),
			)}
		</div>
	)
}

function Dots() {
	return (
		<span className="start-ledge-dots">
			<i />
			<i />
			<i />
		</span>
	)
}
