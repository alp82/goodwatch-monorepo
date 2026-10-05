// PROTOTYPE - throwaway. The Explorer's title card (a copy of ProximityCard's pinned form in
// ~/ui/explorer/ProximityCard.tsx, drawn with explorer.css) fed by a TitleCard and carrying the unified action set.
// The `peek` variant opens this same card over the page from every surface.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import type { MovieResult } from "~/server/types/details-types"
import type { TitleCard } from "~/server/title-cards.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { ActionSet, HideLink } from "./controls"
import { useStore } from "./store"

const TMDB = "https://image.tmdb.org/t/p"
export const EX_VARS = { "--text": "#eef2ff", "--mute": "rgba(222, 229, 255, 0.62)", "--isl": "#7c9cff" } as React.CSSProperties

export const fakeMedia = (card: TitleCard) =>
	({ details: { goodwatch_overall_score_normalized_percent: card.goodwatch_overall_score_normalized_percent } }) as unknown as MovieResult

export function TitlePopup({
	card,
	form,
	where,
	onClose,
	onHide,
	quiet,
	className = "",
}: {
	card: TitleCard
	/** How the action set sits in the card; "compact-link" puts Not interested beside "Open the title page". */
	form: "full" | "compact" | "compact-link" | "collapsed"
	where?: string
	onClose?: () => void
	onHide?: () => void
	quiet?: boolean
	className?: string
}) {
	const s = useStore()
	const score = s.scoreOf(card.key)
	const meta = [card.release_year ? String(card.release_year) : "", card.media_type === "show" ? "Series" : "Film"].filter(Boolean).join(", ")
	const services = (card.services ?? []).slice(0, 4)
	return (
		<div className={`ex-card ex-card-pinned ${className}`} style={EX_VARS} role="dialog" aria-label={card.title}>
			<div className="ex-card-hero">
				{card.backdrop_path ? <img src={`${TMDB}/w780${card.backdrop_path}`} alt="" className="ex-card-bd" /> : null}
				<div className="ex-card-veil" />
				<div className="ex-card-head">
					{where && (
						<span className="ex-card-where">
							<span className="h-2 w-2 rounded-full" style={{ background: "#7c9cff" }} />
							{where}
						</span>
					)}
					<h2 className="ex-card-t">{card.title}</h2>
					<p className="ex-card-meta">{meta}</p>
				</div>
				<div className="ex-card-tools">
					<button type="button" className="ex-icon cursor-pointer" onClick={onClose} aria-label="Close">
						<XMarkIcon className="h-[1.15rem] w-[1.15rem]" />
					</button>
				</div>
			</div>
			<div className="ex-card-body">
				<div className="ex-card-row">
					<ScoreRing media={fakeMedia(card)} size={40} label={false} />
					{score ? (
						<span className="ex-match">
							You rated it <b>{score}</b>
						</span>
					) : card.match != null ? (
						<span className="ex-match">
							<b className="text-amber-400">{card.match}%</b> your taste
						</span>
					) : null}
					<span className="ex-card-svc">
						{services.length ? (
							services.map((sv) => <img key={sv.id} src={`${TMDB}/w92${sv.logo_path}`} alt={sv.name} title={sv.name} className="ex-svc-mine" />)
						) : (
							<span className="ex-card-svc-none">Not streaming here</span>
						)}
					</span>
				</div>
				{card.tagline && <p className="ex-why">{card.tagline}</p>}
				<div className="mt-3">
					<ActionSet card={card} form={form === "compact-link" ? "compact" : form} hideAs={form === "compact-link" ? "link" : "button"} onHide={onHide} quiet={quiet} />
				</div>
				<div className="flex items-center justify-between gap-3">
					<button type="button" className="ex-open cursor-pointer" onClick={() => s.say("Opens the title page (off in this prototype)")}>
						Open the title page
					</button>
					{form === "compact-link" && <HideLink card={card} onHide={onHide} quiet={quiet} />}
				</div>
			</div>
		</div>
	)
}

/** The popup over the page: centered on wide screens, docked at the bottom on phones. */
export function PopupOverlay({ card, onClose, quiet }: { card: TitleCard | null; onClose: () => void; quiet?: boolean }) {
	useEffect(() => {
		if (!card) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [card, onClose])
	if (!card || typeof document === "undefined") return null
	return createPortal(
		<div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4" data-title-popup>
			<button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} />
			<TitlePopup card={card} form="compact-link" onClose={onClose} onHide={onClose} quiet={quiet} className="relative max-h-[92dvh] !w-full overflow-y-auto sm:!w-[380px] max-sm:!rounded-b-none max-sm:[&_.ex-card-body]:pb-16" />
		</div>,
		document.body,
	)
}
