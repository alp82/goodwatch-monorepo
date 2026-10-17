// PROTOTYPE - throwaway. Landing variant H, "It watches out for you". The room and the TV stay as they are after
// the boot. Over the room, the messages a member would get slide in one by one, each from a real start title: a
// wanted title that landed on a service, a new episode tonight, a pick for a side of their taste, a score. The
// pitch and its sign-up link are plain text in the server HTML; the messages are marked as an example.
import { useState } from "react"
import type { CSSProperties } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { goodwatchScoreDisplay } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Boot } from "./shared"
import type { Landing, VariantProps } from "./variants"
import "./v-alerts.css"

type Message = {
	key: string
	when: string
	head: string
	line: string
	card: LandingCard
	/** A service's logo over the poster. */
	logo?: string | null
	/** The score ring in place of the poster. */
	ring?: boolean
}

/** Picks four different titles for the four messages, each the best fit for its kind. */
/** Mood words that read well in "your … side". */
const goodFeel = (word: string) => !word.endsWith("-focused") && !word.includes(" ")

function messages(cards: LandingCard[], fallback: { name: string; logo_path: string | null } | undefined): Message[] {
	const used = new Set<string>()
	const take = (fit: (c: LandingCard) => boolean, strict = false) => {
		const c =
			cards.find((one) => !used.has(String(one.key)) && fit(one)) ??
			(strict ? undefined : cards.find((one) => !used.has(String(one.key))))
		if (c) used.add(String(c.key))
		return c
	}
	const out: Message[] = []
	// A title on a service, else an older one (a new release is often still in cinemas) on the guest's first service.
	const landed =
		take((c) => Boolean(c.services?.length), true) ??
		take((c) => (c.release_year ?? 9999) < new Date().getFullYear() && c.goodwatch_overall_score_normalized_percent != null, true) ??
		take(() => true)
	if (landed) {
		const service = landed.services?.[0] ?? fallback
		out.push({
			key: "landed",
			when: "now",
			head: `Now on ${service?.name ?? "your service"}`,
			line: `${landed.title}, from your Wishlist`,
			card: landed,
			logo: service?.logo_path,
		})
	}
	const episode = take((c) => c.media_type === "show")
	if (episode)
		out.push({ key: "episode", when: "8:00 pm", head: "New episode tonight", line: episode.title, card: episode })
	const side = take((c) => c.feels.some(goodFeel))
	if (side)
		out.push({
			key: "side",
			when: "today",
			head: `New for your ${side.feels.find(goodFeel) ?? side.feels[0]} side`,
			line: side.title,
			card: side,
		})
	const scored = take((c) => (c.goodwatch_overall_score_normalized_percent ?? 0) >= 75)
	if (scored) {
		const score = goodwatchScoreDisplay(scored.goodwatch_overall_score_normalized_percent ?? 0)
		out.push({
			key: "score",
			when: "this week",
			head: `${scored.title} scores ${score}`,
			line: "IMDb, Rotten Tomatoes and Metacritic agree",
			card: scored,
			ring: true,
		})
	}
	return out
}

/** When the first message lands: after the boot. Then one every 0.9 s. */
const FIRST_MS = 2600
const EACH_MS = 900

export function useAlerts({ data, tvOpen }: VariantProps): Landing {
	const [open, setOpen] = useState(!data.member)
	if (!open || tvOpen) return { screen: <Boot /> }
	const list = messages(data.landing ?? [], data.services[0])
	return {
		screen: <Boot />,
		room: (
			<div className="lpa">
				<section className="lpa-pitch" aria-labelledby="lpa-h">
					<h2 id="lpa-h">Never miss what you wanted to watch.</h2>
					<p>GoodWatch keeps an eye on every service and your shows, and tells you when it's time to press play.</p>
					<div className="lpa-actions">
						<a href="/sign-up" className="lpa-cta">
							Sign up free
						</a>
						<button type="button" className="lpa-ghost" onClick={() => setOpen(false)}>
							Look around
						</button>
					</div>
				</section>
				<div className="lpa-stack" aria-label="Example: what members see">
					<span className="lpa-kicker">What members see</span>
					{list.map((m, i) => (
						<div
							key={m.key}
							className="lpa-card"
							style={{ "--lpa-at": `${FIRST_MS + i * EACH_MS}ms` } as CSSProperties}
						>
							{m.ring ? (
								<span className="lpa-ring">
									<ScoreRing
										media={{ details: { goodwatch_overall_score_normalized_percent: m.card.goodwatch_overall_score_normalized_percent } } as never}
										size={40}
										label={false}
									/>
								</span>
							) : (
								<span className="lpa-pic">
									{m.card.poster_path && <img src={tmdbImageUrl(m.card.poster_path, "w92")} alt="" />}
									{m.logo && <img className="lpa-logo" src={tmdbImageUrl(m.logo, "w92")} alt="" />}
								</span>
							)}
							<span className="lpa-words">
								<span className="lpa-app">
									<b>GoodWatch</b>
									<span>{m.when}</span>
								</span>
								<span className="lpa-head block">{m.head}</span>
								<span className="lpa-line block">{m.line}</span>
							</span>
						</div>
					))}
				</div>
			</div>
		),
	}
}
