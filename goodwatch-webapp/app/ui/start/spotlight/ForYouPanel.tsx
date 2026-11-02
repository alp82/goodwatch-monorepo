// One recommendation expands in its original position; selecting another
// collapses the active card without reordering any of the titles.
import { InformationCircleIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type CSSProperties, useEffect, useId, useRef, useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { titlePath } from "~/utils/helpers"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { ForYouSkeleton } from "./ForYouSkeleton"
import { SmallArrows, usePager } from "./PosterPager"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { answerKey } from "~/ui/taste/guest-pick"
import type { RecommendationView } from "./start-return"
import type { ForYouPicks } from "./useLovedThree"
import "./for-you-accordion.css"

export function ForYouPanel({
	picks,
	returnView,
	onOpenDetails,
}: {
	picks: ForYouPicks | null
	returnView: RecommendationView | null
	onOpenDetails: (view: RecommendationView) => void
}) {
	if (!picks || picks.status === "loading") return <ForYouSkeleton />
	const { top, more } = picks.pick
	if (!top)
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
				<p className="text-[15px] font-semibold text-white sm:text-lg">
					No picks for these three yet. Choose different titles to try again.
				</p>
			</div>
		)
	const cards = [top, ...more].filter(
		(c, i, all) => all.findIndex((t) => t.key === c.key) === i,
	)
	return (
		<Recommendations
			key={cards.map((c) => c.key).join(",")}
			cards={cards}
			fingerprints={picks.pick.fingerprints ?? {}}
			returnView={returnView}
			onOpenDetails={onOpenDetails}
		/>
	)
}

function Recommendations({
	cards,
	fingerprints,
	returnView,
	onOpenDetails,
}: {
	cards: TitleCard[]
	fingerprints: Record<string, string[]>
	returnView: RecommendationView | null
	onOpenDetails: (view: RecommendationView) => void
}) {
	const [active, setActive] = useState(
		cards.find((c) => c.key === returnView?.active)?.key ?? cards[0]?.key,
	)
	const id = useId()
	const row = useRef<HTMLUListElement | null>(null)
	const nav = usePager()
	useEffect(() => {
		if (!returnView) return
		const frame = requestAnimationFrame(() => {
			if (row.current) row.current.scrollLeft = returnView.scrollLeft
			window.scrollTo({ top: returnView.scrollY, behavior: "instant" })
		})
		return () => cancelAnimationFrame(frame)
	}, [])

	const reveal = () => {
		const container = row.current,
			selected = container?.querySelector<HTMLElement>('[data-expanded="true"]')
		if (!container || !selected) return
		const bounds = container.getBoundingClientRect(),
			card = selected.getBoundingClientRect()
		const shift =
			card.left < bounds.left
				? card.left - bounds.left
				: card.right > bounds.right
					? card.right - bounds.right
					: 0
		if (shift)
			container.scrollBy({
				left: shift,
				behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
					? "instant"
					: "smooth",
			})
	}
	useEffect(() => {
		const timer = window.setTimeout(
			reveal,
			matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
		)
		return () => window.clearTimeout(timer)
	}, [active])
	return (
		<div className="fy-accordion spotlight-pad">
			<div className="fy-toolbar">
				<span>Explore your recommendations</span>
				<div>
					<SmallArrows nav={nav} name="Recommendations" size="h-7 w-7" />
				</div>
			</div>
			<ul
				className="fy-row"
				ref={(node) => {
					row.current = node
					nav.ref(node)
				}}
				aria-label="Your recommendations"
			>
				{cards.map((card, index) => {
					const expanded = card.key === active
					const matched = card.reasons?.length ? card.reasons.slice(0, 3) : null
					const qualities = (
						matched ??
						fingerprints[answerKey(card)] ??
						[]
					).slice(0, 3)
					const services = card.services?.slice(0, 3).map((s) => s.name) ?? []
					const panelId = `${id}-panel-${index}`,
						triggerId = `${id}-trigger-${index}`
					return (
						<li
							key={card.key}
							className="fy-card"
							data-expanded={expanded}
							onTransitionEnd={(event) => {
								if (
									event.target === event.currentTarget &&
									event.propertyName === "flex-basis" &&
									expanded
								)
									reveal()
							}}
						>
							{card.poster_path && (
								<img
									className="fy-poster"
									src={tmdbImageUrl(card.poster_path, "w342")}
									alt=""
									draggable={false}
									loading={index > 3 ? "lazy" : "eager"}
								/>
							)}
							{card.backdrop_path && (
								<img
									className="fy-backdrop"
									src={tmdbImageUrl(card.backdrop_path, "w780")}
									alt=""
									draggable={false}
									loading={expanded ? "eager" : "lazy"}
								/>
							)}
							<div className="fy-shade" aria-hidden />
							<button
								type="button"
								id={triggerId}
								className="fy-trigger"
								aria-label={card.title}
								title={card.title}
								aria-expanded={expanded}
								aria-controls={panelId}
								onClick={() => setActive(card.key)}
								onKeyDown={(event) => {
									const next =
										event.key === "ArrowRight"
											? (index + 1) % cards.length
											: event.key === "ArrowLeft"
												? (index - 1 + cards.length) % cards.length
												: event.key === "Home"
													? 0
													: event.key === "End"
														? cards.length - 1
														: null
									if (next === null) return
									event.preventDefault()
									row.current
										?.querySelectorAll<HTMLButtonElement>(".fy-trigger")
										[next]?.focus()
								}}
							>
								<span className="fy-collapsed-title">{card.title}</span>
							</button>
							<section
								id={panelId}
								className="fy-details"
								aria-labelledby={triggerId}
								hidden={!expanded}
							>
								<h3>{card.title}</h3>
								<div className="fy-meta">
									<ScoreRing
										media={{
											details: {
												goodwatch_overall_score_normalized_percent:
													card.goodwatch_overall_score_normalized_percent,
											},
										}}
										size={36}
										label={false}
									/>
									<span>
										{card.release_year ? `${card.release_year} · ` : ""}
										{card.media_type === "show" ? "Show" : "Movie"}
									</span>
								</div>
								{services.length > 0 && <p>On {services.join(", ")}</p>}
								<div className="fy-why">
									{qualities.length ? (
										<>
											<span>
												{matched ? "Why this fits" : "Picked for you"}
											</span>
											<div>
												{qualities.map((key) => {
													const meta = getFingerprintMeta(key)
													return (
														<span
															key={key}
															style={
																{ "--fy-quality": meta.color } as CSSProperties
															}
														>
															<i aria-hidden /> {meta.label}
														</span>
													)
												})}
											</div>
										</>
									) : (
										<p>Based on the three titles you loved.</p>
									)}
								</div>

								<Link
									to={titlePath(card.media_type, card.tmdb_id, card.title)}
									prefetch="none"
									className="fy-details-link"
									onClick={() =>
										onOpenDetails({
											active: card.key,
											scrollLeft: row.current?.scrollLeft ?? 0,
											scrollY: window.scrollY,
										})
									}
								>
									<InformationCircleIcon className="h-4 w-4" aria-hidden />
									Details
								</Link>
							</section>
						</li>
					)
				})}
			</ul>
			<Link to="/sign-up" className="fy-save">
				<div>
					<h3>Make these recommendations yours</h3>
					<p>Save your taste and the titles you loved.</p>
				</div>
				<span className="fy-save-cta">
					Create an account <span aria-hidden>→</span>
				</span>
			</Link>
		</div>
	)
}
