// PROTOTYPE - throwaway. Landing variant F, "Three taps to your taste". After the boot a guest's TV asks one small
// question over a grid of twelve popular titles: tap three you loved. The third tap asks the guest recommendations
// (api.guest-recommendations.ts) for a pick, takes the first that streams in the visitor's country
// (api.title-cards.ts), and shows it as Tonight shows a title: its picture, its GoodWatch score, its services, and
// why it was picked. Then the sign-up, or Look around for the real TV home.
//
// The question is in the server HTML at full opacity, under the boot: it is the variant's headline. The pick is
// the browser's.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { TitleCard } from "~/server/title-cards.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { titleKey } from "~/utils/title-key"
import { Boot } from "./shared"
import type { Landing, VariantProps } from "./variants"
import "./v-taps.css"

const NEED = 3
/** The thinking screen stays at least this long, so the words that name the taste can be read. */
const THINK_MS = 1600

type Pick = { card: TitleCard; fallback: boolean }

/** The words the picks share most, strongest first. */
function sharedFeels(picks: LandingCard[]) {
	const count = new Map<string, number>()
	for (const p of picks) for (const f of p.feels) count.set(f, (count.get(f) ?? 0) + 1)
	return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 2)
}

const short = (title: string) => title.replace(/:.*$/, "")

async function findPick(picks: LandingCard[], pool: LandingCard[]): Promise<Pick> {
	const movies = picks.filter((p) => p.media_type === "movie").length
	const mediaType = movies * 2 >= picks.length ? "movie" : "show"
	const params = new URLSearchParams({
		mediaType,
		scoredItems: JSON.stringify(picks.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type, score: 10 }))),
		excludeIds: JSON.stringify(pool.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type }))),
		limit: "12",
	})
	try {
		const recs: { tmdb_id: number; media_type: "movie" | "show" }[] =
			(await (await fetch(`/api/guest-recommendations?${params}`)).json()).recommendations ?? []
		const keys = recs.map((r) => titleKey(r.media_type, r.tmdb_id))
		if (!keys.length) throw new Error("no recommendations")
		const cards: TitleCard[] = (await (await fetch(`/api/title-cards?keys=${keys.join(",")}`)).json()).cards ?? []
		const card = cards.find((c) => c.services?.length && c.backdrop_path) ?? cards.find((c) => c.backdrop_path)
		if (!card) throw new Error("no card")
		return { card, fallback: false }
	} catch (error) {
		console.error("taps: the pick fell back to a start title", error)
		const words = new Set(picks.flatMap((p) => p.feels))
		const rest = pool.filter((p) => !picks.includes(p) && p.backdrop_path)
		const best = rest.sort((a, b) => b.feels.filter((f) => words.has(f)).length - a.feels.filter((f) => words.has(f)).length)[0]
		return { card: best ?? picks[0], fallback: true }
	}
}

function Taps({ data, onDone }: { data: VariantProps["data"]; onDone: () => void }) {
	const pool = data.landing.filter((c) => c.poster_path).slice(0, 12)
	const [picked, setPicked] = useState<LandingCard[]>([])
	const [pick, setPick] = useState<Pick | null>(null)
	const asked = useRef(false)
	const full = picked.length >= NEED

	useEffect(() => {
		if (!full || asked.current) return
		asked.current = true
		const started = Date.now()
		findPick(picked, pool).then((found) => {
			setTimeout(() => setPick(found), Math.max(0, THINK_MS - (Date.now() - started)))
		})
	}, [full, picked, pool])

	const toggle = (card: LandingCard) => {
		if (full) return
		setPicked((now) => (now.includes(card) ? now.filter((c) => c !== card) : [...now, card]))
	}
	const again = () => {
		asked.current = false
		setPick(null)
		setPicked([])
	}

	const feels = sharedFeels(picked)
	const names = picked.map((p) => short(p.title))

	return (
		<div className="lpt">
			{!full && (
				<section className="lpt-ask" aria-labelledby="lpt-h">
					<div className="lpt-top">
						<div>
							<div className="lpt-kicker">GoodWatch</div>
							<h2 id="lpt-h" className="lpt-h">
								Tap three you loved.
							</h2>
							<p className="lpt-line">We'll find the one you'll love next, and where to watch it.</p>
						</div>
						<div className="flex flex-none flex-col items-end gap-[1.4cqh]">
							<div className="lpt-count" aria-label={`${picked.length} of ${NEED} picked`}>
								{Array.from({ length: NEED }, (_, i) => (
									<i key={i} className={i < picked.length ? "lpt-lit" : ""} />
								))}
							</div>
							<button type="button" className="lpt-skip" onClick={onDone}>
								Just look around
							</button>
						</div>
					</div>
					<ul className="lpt-grid">
						{pool.map((card) => {
							const on = picked.includes(card)
							return (
								<li key={card.key} className="contents">
									<button
										type="button"
										className={`lpt-poster ${on ? "lpt-on" : ""}`}
										aria-pressed={on}
										onClick={() => toggle(card)}
									>
										<img src={tmdbImageUrl(card.poster_path as string, "w185")} alt={card.title} draggable={false} />
										<span className="lpt-check" aria-hidden="true">
											✓
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				</section>
			)}

			{full && !pick && (
				<div className="lpt-think" aria-live="polite">
					<div className="lpt-think-posters">
						{picked.map((p) => (
							<img key={p.key} src={tmdbImageUrl(p.poster_path as string, "w185")} alt="" />
						))}
					</div>
					<div className="lpt-think-line">Reading your taste…</div>
					<div className="lpt-think-words">
						{feels.map((f, i) => (
							<span key={f} style={{ animationDelay: `${0.25 + i * 0.35}s` }}>
								{f}
							</span>
						))}
					</div>
				</div>
			)}

			{pick && (
				<section className="lpt-pick" aria-live="polite">
					<img
						className="lpt-pick-art"
						src={tmdbImageUrl(pick.card.backdrop_path as string, "w1280")}
						alt=""
						draggable={false}
					/>
					<div className="lpt-pick-shade" />
					<div className="lpt-pick-words">
						<div className="lpt-kicker">Your pick for tonight</div>
						<div className="lpt-pick-title">{pick.card.title}</div>
						<div className="lpt-facts">
							<ScoreRing
								media={{ details: { goodwatch_overall_score_normalized_percent: pick.card.goodwatch_overall_score_normalized_percent } } as never}
								size={44}
							/>
							{pick.card.services?.slice(0, 3).map((s) => (
								<img key={s.id} className="lpt-logo" src={tmdbImageUrl(s.logo_path, "w92")} alt={s.name} title={s.name} />
							))}
						</div>
						<p className="lpt-why">
							Because you loved <b>{names.slice(0, -1).join(", ")}</b> and <b>{names[names.length - 1]}</b>
							{feels.length ? `: you like it ${feels.join(" and ")}.` : "."}
						</p>
						<div className="lpt-acts">
							<Link to="/sign-up" className="lpt-cta">
								Keep my taste
							</Link>
							<button type="button" className="lpt-ghost" onClick={onDone}>
								Look around
							</button>
							<button type="button" className="lpt-ghost" onClick={again}>
								Try three others
							</button>
						</div>
						<p className="lpt-small">Free. Every title you rate makes the next pick sharper.</p>
					</div>
				</section>
			)}
		</div>
	)
}

export function useTaps({ data, tvOpen }: VariantProps): Landing {
	// In memory only: the question is back on every load, as the prototype has no persistence.
	const [done, setDone] = useState(false)
	const ask = !data.member && !tvOpen && !done && data.landing.length >= NEED
	return {
		screen: (
			<>
				{ask && <Taps data={data} onDone={() => setDone(true)} />}
				<Boot />
			</>
		),
	}
}
