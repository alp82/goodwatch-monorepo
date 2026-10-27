// PROTOTYPE (start page lab, round 2): member a + b's pick card (one candidate on its backdrop, a fixed-size face),
// its Watch button, the chip look, and the room backdrop (nook-stage, no TV) the decision sits on.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { titleHref, tmdbImage } from "../../lab/kit"
import { type LabCard, useLab } from "../../lab/types"
import { DISPLAY } from "../member/shared"
import { type Candidate, factsOf } from "./ab-rank"

/**
 * One candidate, filling its (fixed-size) box: the backdrop (or the poster, darkened, when the fixture has no
 * backdrop), the poster, the reason, the title and the facts. Phones stack it bottom-up; md+ reads left to right.
 */
export function CardFace({ c, lines, onTitle }: { c: Candidate; lines: ReactNode; onTitle?: (e: React.MouseEvent) => void }) {
	const card = c.card
	const score = card.goodwatch_overall_score_normalized_percent
	return (
		<div className="absolute inset-0 overflow-hidden rounded-2xl bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-white/10">
			{c.backdrop ? (
				<img
					src={tmdbImage(c.backdrop, "w1280")}
					alt=""
					draggable={false}
					className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
				/>
			) : (
				<img
					src={tmdbImage(card.poster_path, "w780")}
					alt=""
					draggable={false}
					className="absolute inset-0 h-full w-full scale-110 object-cover object-[center_30%] opacity-45"
				/>
			)}
			<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/75 to-gray-950/0 md:bg-linear-to-r md:from-gray-950 md:via-gray-950/80 md:to-gray-950/10" />
			{score ? (
				<div className="absolute right-3 top-3 rounded-full bg-gray-950/70 p-1 md:right-4 md:top-4">
					<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: score } }} size={40} label={false} />
				</div>
			) : null}
			<div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 md:inset-y-0 md:left-0 md:right-auto md:w-[68%] md:items-center md:gap-6 md:p-8">
				<Link to={titleHref(card)} onClick={onTitle} draggable={false} className="shrink-0">
					<img
						src={tmdbImage(card.poster_path, "w342")}
						alt=""
						draggable={false}
						className="aspect-[2/3] w-[4.75rem] rounded-lg object-cover shadow-lg shadow-black/60 ring-1 ring-white/15 md:w-44"
					/>
				</Link>
				<div className="min-w-0 flex-1">
					<Link to={titleHref(card)} onClick={onTitle} draggable={false} className="block">
						<h3
							className={`${DISPLAY} line-clamp-2 leading-[0.95] text-white ${card.title.length > 24 ? "text-2xl md:text-4xl" : "text-[1.75rem] md:text-5xl"}`}
						>
							{card.title}
						</h3>
					</Link>
					<p className="mt-1.5 truncate text-xs text-gray-300 md:mt-3 md:text-sm">{factsOf(c)}</p>
					<div className="mt-1.5 md:mt-3">{lines}</div>
				</div>
			</div>
		</div>
	)
}

/** The amber reason line (and the episode's name under it, when there is one). */
export function ReasonLines({ c, reason }: { c: Candidate; reason: string }) {
	return (
		<>
			<p className="truncate text-sm font-semibold text-amber-300 md:text-base">{reason}</p>
			<p className="hidden truncate text-sm text-gray-300 md:block">{c.episodeName ?? c.card.tagline ?? " "}</p>
		</>
	)
}

/** Watch: the service's logo and "Watch on …" when the fixture knows it, else the title page. */
export function WatchLink({ c, className = "", short = false }: { c: Candidate | null; className?: string; short?: boolean }) {
	const s = c?.service
	if (!c)
		return (
			<Link to="/watch-next" className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 font-bold text-black hover:bg-gray-200 ${className}`}>
				Watch next
			</Link>
		)
	return (
		<Link
			to={titleHref(c.card)}
			className={`inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-lg bg-white pl-2 pr-4 font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200 ${className}`}
		>
			{s?.logo ? <img src={s.logo} alt="" className="h-8 w-8 shrink-0 rounded-md" /> : <PlayIcon className="ml-1 h-5 w-5 shrink-0" aria-hidden />}
			<span className="truncate">
				{s && short ? <span className="sm:hidden">Watch</span> : null}
				<span className={s && short ? "hidden sm:inline" : ""}>{s ? `Watch on ${s.name}` : "Watch"}</span>
			</span>
		</Link>
	)
}

/** The decision's column: narrower than the page so the card stays a card on a desktop. */
export const BOX = "mx-auto w-full max-w-4xl px-4 sm:px-6"

export const CHIP =
	"inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors duration-150"
export const chipLook = (on: boolean) =>
	on ? "bg-amber-400 text-black ring-amber-400" : "bg-gray-950/60 text-gray-200 ring-white/15 hover:bg-white/10 hover:text-white"

/**
 * The room behind the decision: nook-stage (no TV), its shelves showing `posters`, dimmed so the card reads.
 * `children` sit above it in normal flow; the room fills the box.
 */
export function RoomBackdrop({ posters, children, className = "" }: { posters: LabCard[]; children: ReactNode; className?: string }) {
	const { Room } = useLab()
	return (
		<section className={`relative isolate overflow-hidden ${className}`} aria-label="Tonight">
			<Room className="-z-10" style={{ position: "absolute", inset: 0 }} posters={posters} noTv noOverlay />
			<div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-gray-950/80 via-gray-950/45 to-gray-950" />
			{children}
		</section>
	)
}
