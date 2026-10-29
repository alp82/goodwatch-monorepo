// The guest's card while they tap three (SpotlightCard.tsx shows it for a search's titles and while they load): a
// panel whose posters fill its height. The header has the heading with Surprise me, what's on show as a chip in the
// first pick's color with the count, three hearts for the loved titles, and See all; the posters are the loved
// toggles. A search that found nothing or failed says so in the panel, with the way on.
import { HeartIcon } from "@heroicons/react/20/solid"
import type { CSSProperties } from "react"
import { WORD_BY_ID } from "~/domain/taste-picker"
import type { TitleCard } from "~/server/title-cards.server"
import { shownLabel } from "../moods/mixes"
import { seeAllHref } from "../search/start-search"
import {
	LOVED_NEEDED,
	type StartResults,
	type StartView,
} from "../stage/start-query"
import type { StartQueryState } from "../stage/useStartQuery"
import { EdgeArrows, PageDots, SmallArrows, usePager } from "./PosterPager"
import { DieIcon, LovedToggle, SeeAll, TAP_THREE } from "./card-parts"
import type { LovedThreeState } from "./useLovedThree"

/** At most this many posters in the row, then See all. */
const ROW_MAX = 24

export function TapThreePanel({
	start,
	results,
	view,
	loved,
	onSurprise,
}: {
	start: StartQueryState
	results: StartResults & { retry: () => void }
	view: StartView
	loved: LovedThreeState
	onSurprise: () => void
}) {
	const { query } = start
	const hue = query.picks.length
		? (WORD_BY_ID[query.picks[0]]?.hue ?? "#fbbf24")
		: "#fbbf24"
	const n = results.total ?? results.cards.length
	const ready = view === "results" && results.cards.length > 0
	return (
		<div className="tap-panel" style={{ "--tap-hue": hue } as CSSProperties}>
			<div className="tap-head">
				<div className="tap-words">
					<div className="tap-title-row">
						<h2 className="tap-title">{TAP_THREE}</h2>
						<button
							type="button"
							onClick={onSurprise}
							className="tap-die"
							aria-label="Surprise me: a random mood"
							title="Surprise me"
						>
							<DieIcon className="h-[18px] w-[18px]" />
							<span className="tap-die-label">Surprise me</span>
						</button>
					</div>
					<div className="tap-line">
						<span className="tap-chip">
							<i aria-hidden />
							{shownLabel(query)}
						</span>
						{view === "loading" ? (
							<span className="tap-count">
								{query.text ? "Reading your search…" : "Finding titles…"}
							</span>
						) : ready ? (
							<span className="tap-count">
								{n.toLocaleString("en-US")} {n === 1 ? "title" : "titles"}
							</span>
						) : null}
					</div>
				</div>
				<Hearts loved={loved} />
				{ready ? (
					<SeeAll href={seeAllHref(query)} className="tap-see max-sm:hidden" />
				) : null}
			</div>
			<div className="tap-body">
				{view === "loading" ? (
					<Skeleton />
				) : results.status === "error" ? (
					<Message
						text={results.error ?? "Discover couldn't load right now"}
						action={{ label: "Retry", run: results.retry }}
					/>
				) : !results.cards.length ? (
					<Message
						text={
							query.picks.length && query.text
								? "Nothing matches all of these"
								: query.picks.length
									? "Nothing matches these moods"
									: `Nothing found for “${query.text}”`
						}
						action={
							query.picks.length
								? {
										label: query.text
											? "Search without the moods"
											: "Clear the moods",
										run: start.clearPicks,
									}
								: { label: "Surprise me", run: onSurprise }
						}
					/>
				) : (
					<Posters
						key={results.signature}
						cards={results.cards}
						loved={loved}
						seeAll={seeAllHref(query)}
					/>
				)}
			</div>
		</div>
	)
}

/** The loved titles so far, as three hearts; a filled one takes its title back (it may be off screen after a new search). */
function Hearts({ loved }: { loved: LovedThreeState }) {
	const count = loved.loved.length
	return (
		<div className="tap-progress">
			<span className="sr-only" aria-live="polite">
				{count} of {LOVED_NEEDED} loved
			</span>
			<span className="tap-hearts">
				{Array.from({ length: LOVED_NEEDED }, (_, i) => {
					const card = loved.loved[i]
					return card ? (
						<button
							key={card.key}
							type="button"
							className="tap-heart-undo"
							onClick={() => loved.toggle(card)}
							aria-label={`Remove ${card.title}`}
							title={`Remove ${card.title}`}
						>
							<HeartIcon aria-hidden className="tap-heart" data-on="" />
						</button>
					) : (
						<HeartIcon
							// biome-ignore lint/suspicious/noArrayIndexKey: places
							key={i}
							aria-hidden
							className="tap-heart"
						/>
					)
				})}
			</span>
			<span aria-hidden className="tap-progress-text">
				{count === 0 ? "Loved none yet" : `${LOVED_NEEDED - count} more`}
			</span>
		</div>
	)
}

function Posters({
	cards,
	loved,
	seeAll,
}: {
	cards: readonly TitleCard[]
	loved: LovedThreeState
	seeAll: string
}) {
	const nav = usePager()
	const count = loved.loved.length
	const full = count >= LOVED_NEEDED
	return (
		<div className="tap-posters">
			<div ref={nav.ref} className="tap-row">
				{cards.slice(0, ROW_MAX).map((card, i) => {
					const on = loved.isLoved(card)
					return (
						<div
							key={card.key}
							className={`tap-c ${count && !full && !on ? "spotlight-dim" : ""}`}
							style={{ "--i": i } as CSSProperties}
						>
							<LovedToggle
								card={card}
								on={on}
								full={full}
								onToggle={() => loved.toggle(card)}
								priority={i < 10}
							/>
						</div>
					)
				})}
				<div className="tap-c tap-all">
					<SeeAll href={seeAll} />
				</div>
			</div>
			<EdgeArrows
				nav={nav}
				name="results"
				className="max-sm:hidden"
				top="50%"
			/>
			<div className="tap-dots">
				<PageDots nav={nav} max={Number.POSITIVE_INFINITY} />
				<SmallArrows nav={nav} name="results" />
			</div>
		</div>
	)
}

function Skeleton() {
	return (
		<div aria-hidden className="tap-posters">
			<div className="tap-row">
				{Array.from({ length: 10 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
					<div key={i} className="tap-c">
						<div
							className="tap-skel"
							style={{ animationDelay: `${i * 80}ms` }}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

function Message({
	text,
	action,
}: {
	text: string
	action: { label: string; run: () => void }
}) {
	return (
		<div aria-live="polite" className="tap-message">
			<p>{text}</p>
			<button type="button" onClick={action.run}>
				{action.label}
			</button>
		</div>
	)
}
