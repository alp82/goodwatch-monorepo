// PROTOTYPE (start-streamline, rounds 4 and 5): other designs for the guest's open card while they tap three. Each flow lays
// out the same parts: the heading with Surprise me, what's on show, the loved progress, See all, and the posters as
// loved toggles (SpotlightCard's LovedToggle). The empty state and For you stay SpotlightCard's own.
//
// - k Shelf: no panel; the posters stand on a lit shelf edge over the room.
// - l Panel: today's panel, tightened: the posters fill its height, the progress is three hearts.
// - m Slots: three big numbered slots beside the row fill up as you tap.
// - n Wall: two rows of posters, more to choose from at a glance.
//
// Round 4 verdict: l is great; every round 5 flow shows it.
import { HeartIcon } from "@heroicons/react/20/solid"
import type { CSSProperties } from "react"
import { WORD_BY_ID } from "~/domain/taste-picker"
import type { TitleCard } from "~/server/title-cards.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { seeAllHref } from "../search/start-search"
import { EdgeArrows, PageDots, SmallArrows, usePager } from "../spotlight/PosterPager"
import {
	DieIcon,
	LovedToggle,
	SeeAll,
	SpotlightCard,
	TAP_THREE,
	shownLabel,
	surpriseMood,
} from "../spotlight/SpotlightCard"
import type { LovedThreeState } from "../spotlight/useLovedThree"
import { LOVED_NEEDED, type StartResults, type StartView } from "../stage/start-query"
import type { StartQueryState } from "../stage/useStartQuery"
/** The card designs of round 4; round 5 keeps l (Panel) for every flow. */
export type CardDesign = "k" | "l" | "m" | "n"

type Props = {
	flow: CardDesign
	start: StartQueryState
	results: StartResults & { retry: () => void }
	view: StartView
	loved: LovedThreeState
	fan: Parameters<typeof SpotlightCard>[0]["fan"]
}

export function TapCard(props: Props) {
	const { flow, start, results, view, loved } = props
	// The empty state and For you: today's card.
	if (view === "empty" || view === "forYou")
		return (
			<SpotlightCard
				start={start}
				results={results}
				view={view}
				loved={loved}
				fan={props.fan}
			/>
		)
	const { query } = start
	const hue = query.picks.length ? (WORD_BY_ID[query.picks[0]]?.hue ?? "#fbbf24") : "#fbbf24"
	const n = results.total ?? results.cards.length
	const ready = view === "results" && results.cards.length > 0
	const surprise = () => {
		start.clearSearch()
		start.setPicks([surpriseMood(query.picks)])
	}
	return (
		<div className="ptc" data-flow={flow} style={{ "--ptc-hue": hue } as CSSProperties}>
			<div className="ptc-head">
				<div className="ptc-words">
					<div className="ptc-title-row">
						<h2 className="ptc-title">{TAP_THREE}</h2>
						<button
							type="button"
							onClick={surprise}
							className="ptc-die"
							aria-label="Surprise me: a random mood"
							title="Surprise me"
						>
							<DieIcon className="h-[18px] w-[18px]" />
							<span className="ptc-die-label">Surprise me</span>
						</button>
					</div>
					<div className="ptc-line">
						<span className="ptc-chip">
							<i aria-hidden />
							{shownLabel(query)}
						</span>
						{view === "loading" ? (
							<span className="ptc-count">Finding titles…</span>
						) : ready ? (
							<span className="ptc-count">
								{n} {n === 1 ? "title" : "titles"}
							</span>
						) : null}
					</div>
				</div>
				{flow === "m" ? null : <Progress flow={flow} loved={loved} />}
				{ready ? <SeeAll href={seeAllHref(query)} className="ptc-see max-sm:hidden" /> : null}
			</div>
			<div className="ptc-body">
				{flow === "m" ? <BigSlots loved={loved} /> : null}
				<div className="ptc-stage">
					{view === "loading" ? (
						<Skeleton flow={flow} />
					) : results.status === "error" ? (
						<Message
							text={results.error ?? "Couldn't load"}
							action={{ label: "Retry", run: results.retry }}
						/>
					) : !results.cards.length ? (
						<Message
							text={
								query.picks.length
									? "Nothing matches these"
									: `Nothing found for “${query.text}”`
							}
							action={
								query.picks.length
									? { label: "Clear the moods", run: start.clearPicks }
									: { label: "Surprise me", run: surprise }
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
		</div>
	)
}

/** The loved progress: the shelf and the wall show three hearts, the panel the hearts with a count. */
function Progress({ flow, loved }: { flow: CardDesign; loved: LovedThreeState }) {
	const count = loved.loved.length
	if (flow === "n") return <PosterSlots loved={loved} />
	return (
		<div className="ptc-progress">
			<span className="sr-only" aria-live="polite">
				{count} of {LOVED_NEEDED} loved
			</span>
			<span aria-hidden className="ptc-hearts">
				{Array.from({ length: LOVED_NEEDED }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: places
					<HeartIcon key={i} className="ptc-heart" data-on={i < count ? "" : undefined} />
				))}
			</span>
			<span aria-hidden className="ptc-progress-text">
				{count === 0 ? "Loved none yet" : `${LOVED_NEEDED - count} more`}
			</span>
		</div>
	)
}

/** The wall's small poster slots, as today's card has them. */
function PosterSlots({ loved }: { loved: LovedThreeState }) {
	return (
		<div className="ptc-pslots">
			<span className="sr-only" aria-live="polite">
				{loved.loved.length} of {LOVED_NEEDED} loved
			</span>
			{Array.from({ length: LOVED_NEEDED }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: places
				<Slot key={i} card={loved.loved[i]} n={i + 1} onUndo={loved.toggle} />
			))}
		</div>
	)
}

/** Slots: three big numbered places beside the row. */
function BigSlots({ loved }: { loved: LovedThreeState }) {
	const count = loved.loved.length
	return (
		<div className="ptc-slots">
			<span className="sr-only" aria-live="polite">
				{count} of {LOVED_NEEDED} loved
			</span>
			<div aria-hidden className="ptc-slots-label">
				{count === 0
					? "Your three"
					: count < LOVED_NEEDED
						? `${LOVED_NEEDED - count} to go`
						: "Finding picks…"}
			</div>
			<div className="ptc-slots-row">
				{Array.from({ length: LOVED_NEEDED }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: places
					<Slot key={i} card={loved.loved[i]} n={i + 1} onUndo={loved.toggle} />
				))}
			</div>
			<div aria-hidden className="ptc-slots-hint">
				{count ? "Tap one here to take it back." : "Tap posters you loved. They land here."}
			</div>
		</div>
	)
}

function Slot({
	card,
	n,
	onUndo,
}: {
	card: TitleCard | undefined
	n: number
	onUndo: (card: TitleCard) => void
}) {
	return (
		<span className="ptc-slot" data-filled={card ? "" : undefined}>
			{card ? (
				<button
					key={card.key}
					type="button"
					onClick={() => onUndo(card)}
					aria-label={`Remove ${card.title}`}
					className="ptc-slot-fill"
				>
					{card.poster_path ? (
						<img src={tmdbImageUrl(card.poster_path, "w185")} alt="" />
					) : null}
				</button>
			) : (
				<span aria-hidden className="ptc-slot-n">
					{n}
				</span>
			)}
		</span>
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
		<div className="ptc-posters">
			<div ref={nav.ref} className="ptc-row">
				{cards.slice(0, 24).map((card, i) => {
					const on = loved.isLoved(card)
					return (
						<div
							key={card.key}
							className={`ptc-c ${count && !full && !on ? "spotlight-dim" : ""}`}
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
				<div className="ptc-c ptc-all">
					<SeeAll href={seeAll} />
				</div>
			</div>
			<EdgeArrows nav={nav} name="results" className="max-sm:hidden" top="50%" />
			<div className="ptc-dots sm:hidden">
				<PageDots nav={nav} />
				<SmallArrows nav={nav} name="results" />
			</div>
		</div>
	)
}

function Skeleton({ flow }: { flow: CardDesign }) {
	return (
		<div aria-hidden className="ptc-posters">
			<div className="ptc-row">
				{Array.from({ length: flow === "n" ? 20 : 10 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
					<div key={i} className="ptc-c">
						<div className="ptc-skel" style={{ animationDelay: `${(i % 10) * 80}ms` }} />
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
		<div aria-live="polite" className="ptc-message">
			<p>{text}</p>
			<button type="button" onClick={action.run}>
				{action.label}
			</button>
		</div>
	)
}
