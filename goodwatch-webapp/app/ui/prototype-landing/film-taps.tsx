// PROTOTYPE - throwaway. The film's last screen (v-film.tsx): "Tap three you loved." over twelve popular titles.
// Every tap shows a little more of the visitor's taste: the mood words the picks share build up under the headline,
// and the three slots fill with the posters. The third tap asks the guest recommendations for each kind of title
// picked (api.guest-recommendations.ts), merges them by match, reads the best as landing cards
// (prototype.landing-cards.ts: score, services, mood words) and reveals the top pick with three more.
//
// The question is in the server HTML at full opacity: the film lies over it until it ends. The pick is the browser's.
import { Link } from "@remix-run/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./variants"
import "./film-taps.css"

const NEED = 3
/** The reading screen stays at least this long, so its words can land. */
const READ_MS = 1300

type Rec = { tmdb_id: number; media_type: "movie" | "show"; match_percentage: number }
type Pick = { top: LandingCard; more: LandingCard[]; fallback: boolean }

/** The mood words of the picks, the most shared first, with how many picks share each. */
function tasteWords(picks: LandingCard[]) {
	const count = new Map<string, number>()
	for (const p of picks) for (const f of p.feels) count.set(f, (count.get(f) ?? 0) + 1)
	return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, picks.length > 1 ? 4 : 3)
}

const short = (title: string) => title.replace(/:.*$/, "")
const joinNames = (names: string[]) =>
	names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`

async function recsFor(type: "movie" | "show", picks: LandingCard[], pool: LandingCard[]): Promise<Rec[]> {
	const params = new URLSearchParams({
		mediaType: type,
		scoredItems: JSON.stringify(picks.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type, score: 10 }))),
		excludeIds: JSON.stringify(pool.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type }))),
		limit: "8",
	})
	const res = await fetch(`/api/guest-recommendations?${params}`)
	if (!res.ok) throw new Error(`guest recommendations ${res.status}`)
	return (await res.json()).recommendations ?? []
}

async function findPick(picks: LandingCard[], pool: LandingCard[]): Promise<Pick> {
	try {
		const types = [...new Set(picks.map((p) => p.media_type))]
		const lists = await Promise.all(types.map((t) => recsFor(t, picks, pool).catch(() => [] as Rec[])))
		const seen = new Set<string>()
		const recs = lists
			.flat()
			.sort((a, b) => b.match_percentage - a.match_percentage)
			.filter((r) => {
				const k = `${r.media_type}:${r.tmdb_id}`
				return seen.has(k) ? false : (seen.add(k), true)
			})
			.slice(0, 10)
		if (!recs.length) throw new Error("no recommendations")
		const res = await fetch(`/prototype/landing-cards?t=${recs.map((r) => `${r.media_type}:${r.tmdb_id}`).join(",")}`)
		const cards: LandingCard[] = (await res.json()).cards ?? []
		const order = (c: LandingCard) => recs.findIndex((r) => r.tmdb_id === c.tmdb_id && r.media_type === c.media_type)
		cards.sort((a, b) => order(a) - order(b))
		const top =
			cards.find((c) => c.backdrop_path && c.services?.length) ?? cards.find((c) => c.backdrop_path)
		if (!top) throw new Error("no card with a picture")
		const more = cards.filter((c) => c !== top && c.poster_path).slice(0, 3)
		return { top, more, fallback: false }
	} catch (error) {
		console.error("film taps: the pick fell back to a start title", error)
		const words = new Set(picks.flatMap((p) => p.feels))
		const shared = (c: LandingCard) => c.feels.filter((f) => words.has(f)).length
		const rest = pool.filter((p) => !picks.includes(p) && p.backdrop_path).sort((a, b) => shared(b) - shared(a))
		return { top: rest[0] ?? picks[0], more: rest.slice(1, 4), fallback: true }
	}
}

/** The ring's size: it draws in pixels, so it follows the window rather than the TV. */
function useRingSize() {
	const [size, setSize] = useState(56)
	useEffect(() => {
		const phone = window.matchMedia("(max-width: 767px)")
		const set = () => setSize(phone.matches ? 34 : 60)
		set()
		phone.addEventListener("change", set)
		return () => phone.removeEventListener("change", set)
	}, [])
	return size
}

/**
 * The visitor's taps and pick, kept for the tab's session: going to sign up and coming back (browser Back) shows the
 * quiz where they left it, not the intro from the start. Nothing leaves the browser.
 */
const TAPS_KEY = "gw-intro-taps"
type SavedTaps = { keys: string[]; pick: Pick | null }
export function savedTaps(): SavedTaps | null {
	try {
		const raw = sessionStorage.getItem(TAPS_KEY)
		return raw ? (JSON.parse(raw) as SavedTaps) : null
	} catch {
		return null
	}
}
const saveTaps = (value: SavedTaps | null) => {
	try {
		if (value && value.keys.length) sessionStorage.setItem(TAPS_KEY, JSON.stringify(value))
		else sessionStorage.removeItem(TAPS_KEY)
	} catch {}
}

export function FilmTaps({ data, onLeave }: { data: VariantProps["data"]; onLeave: () => void }) {
	const pool = data.landing.filter((c) => c.poster_path).slice(0, 12)
	const [picked, setPicked] = useState<LandingCard[]>([])
	const [pick, setPick] = useState<Pick | null>(null)
	const asked = useRef(false)
	// Back from sign-up: the same taps, and the same pick without asking again.
	const restored = useRef(false)
	useEffect(() => {
		const saved = savedTaps()
		restored.current = true
		if (!saved) return
		const cards = saved.keys.flatMap((key) => pool.find((c) => String(c.key) === key) ?? [])
		if (!cards.length) return
		if (saved.pick && cards.length >= NEED) asked.current = true
		setPicked(cards)
		if (saved.pick) setPick(saved.pick)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	// Saved on the visitor's own changes only (a tap, the pick arriving, "Try three others"), never by an effect:
	// an effect that runs on mount (twice in development) would erase what the restore brings back.
	const pickedRef = useRef(picked)
	pickedRef.current = picked
	const ring = useRingSize()
	const full = picked.length >= NEED

	useEffect(() => {
		if (!full || asked.current) return
		asked.current = true
		const started = Date.now()
		findPick(picked, pool).then((found) => {
			setTimeout(() => {
				setPick(found)
				saveTaps({ keys: pickedRef.current.map((c) => String(c.key)), pick: found })
			}, Math.max(0, READ_MS - (Date.now() - started)))
		})
	}, [full, picked, pool])

	const toggle = (card: LandingCard) => {
		if (full) return
		const next = picked.includes(card) ? picked.filter((c) => c !== card) : [...picked, card]
		setPicked(next)
		saveTaps({ keys: next.map((c) => String(c.key)), pick: null })
	}
	const again = () => {
		asked.current = false
		setPick(null)
		setPicked([])
		saveTaps(null)
	}

	const words = tasteWords(picked)
	const names = picked.map((p) => short(p.title))

	return (
		<div className="lpft">
			{!full && (
				<section className="lpft-ask" aria-labelledby="lpft-h">
					<div className="lpft-head">
						<div className="min-w-0">
							<div className="lpft-kicker">Your turn</div>
							<h2 id="lpft-h" className="lpft-h">
								Tap three you loved.
							</h2>
							<div className="lpft-taste" aria-live="polite">
								{words.length === 0 ? (
									<span className="lpft-taste-hint">Your taste, read in three taps.</span>
								) : (
									<>
										<span className="lpft-taste-lead">You like it</span>
										{words.map(([word, n]) => (
											<span key={word} className={`lpft-word ${n > 1 ? "lpft-word-strong" : ""}`}>
												{word}
											</span>
										))}
									</>
								)}
							</div>
						</div>
						<div className="lpft-side">
							<div className="lpft-slots" aria-label={`${picked.length} of ${NEED} picked`}>
								{Array.from({ length: NEED }, (_, i) => {
									const p = picked[i]
									return (
										<span key={p?.key ?? `empty-${i}`} className={`lpft-slot ${p ? "lpft-slot-on" : ""}`}>
											{p ? <img src={tmdbImageUrl(p.poster_path as string, "w92")} alt="" /> : <b>{i + 1}</b>}
										</span>
									)
								})}
							</div>
							<button type="button" className="lpft-leave" onClick={onLeave}>
								Just look around
							</button>
						</div>
					</div>
					<ul className="lpft-grid">
						{pool.map((card, i) => {
							const on = picked.includes(card)
							return (
								<li key={card.key} className="contents">
									<button
										type="button"
										className={`lpft-poster ${on ? "lpft-on" : ""}`}
										style={{ "--i": i } as CSSProperties}
										aria-pressed={on}
										onClick={() => toggle(card)}
									>
										<img src={tmdbImageUrl(card.poster_path as string, "w185")} alt={card.title} draggable={false} />
										<span className="lpft-ring" aria-hidden="true" />
										<span className="lpft-n" aria-hidden="true">
											{on ? picked.indexOf(card) + 1 : ""}
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				</section>
			)}

			{full && !pick && (
				<div className="lpft-read" aria-live="polite">
					<div className="lpft-fan">
						{picked.map((p, i) => (
							<img
								key={p.key}
								src={tmdbImageUrl(p.poster_path as string, "w185")}
								alt=""
								style={{ "--r": `${(i - 1) * 9}deg`, "--x": `${(i - 1) * 62}%` } as CSSProperties}
							/>
						))}
					</div>
					<div className="lpft-read-line">Reading your taste…</div>
					<div className="lpft-read-words">
						{words.map(([w], i) => (
							<span key={w} style={{ animationDelay: `${0.15 + i * 0.22}s` }}>
								{w}
							</span>
						))}
					</div>
				</div>
			)}

			{pick && (
				<section className="lpft-pick" aria-live="polite">
					<img
						className="lpft-pick-art"
						src={tmdbImageUrl(pick.top.backdrop_path as string, "w1280")}
						alt=""
						draggable={false}
					/>
					<div className="lpft-pick-shade" />
					<div className="lpft-pick-words">
						<div className="lpft-kicker lpft-in" style={{ "--d": "0.15s" } as CSSProperties}>
							Picked for you
						</div>
						<div className="lpft-pick-title lpft-in" style={{ "--d": "0.25s" } as CSSProperties}>
							{pick.top.title}
						</div>
						<div className="lpft-facts lpft-in" style={{ "--d": "0.4s" } as CSSProperties}>
							<ScoreRing
								media={{ details: { goodwatch_overall_score_normalized_percent: pick.top.goodwatch_overall_score_normalized_percent } } as never}
								size={ring}
							/>
							{pick.top.feels.length > 0 && <span className="lpft-feels">{pick.top.feels.slice(0, 2).join(" · ")}</span>}
						</div>
						{pick.top.services?.length ? (
							<div className="lpft-where lpft-in" style={{ "--d": "0.5s" } as CSSProperties}>
								<span className="lpft-where-on">On</span>
								{pick.top.services.slice(0, 2).map((s) => (
									<span key={s.id} className="lpft-service">
										{s.logo_path && <img src={tmdbImageUrl(s.logo_path, "w92")} alt="" />}
										{s.name}
									</span>
								))}
							</div>
						) : null}
						<p className="lpft-why lpft-in" style={{ "--d": "0.6s" } as CSSProperties}>
							Because you loved <b>{joinNames(names)}</b>.
						</p>
						<div className="lpft-acts lpft-in" style={{ "--d": "0.72s" } as CSSProperties}>
							<Link to="/sign-up" className="lpft-cta">
								Keep my taste
							</Link>
							<button type="button" className="lpft-ghost" onClick={onLeave}>
								Look around
							</button>
							<button type="button" className="lpft-text" onClick={again}>
								Try three others
							</button>
						</div>
						<p className="lpft-small lpft-in" style={{ "--d": "0.82s" } as CSSProperties}>
							Free. It gets sharper with every title you rate.
						</p>
					</div>
					{pick.more.length > 0 && (
						<div className="lpft-more">
							<div className="lpft-more-label">Also for you</div>
							<div className="lpft-more-row">
								{pick.more.map((c, i) => (
									<img
										key={c.key}
										className="lpft-in"
										style={{ "--d": `${0.7 + i * 0.1}s` } as CSSProperties}
										src={tmdbImageUrl(c.poster_path as string, "w185")}
										alt={c.title}
										title={c.title}
									/>
								))}
							</div>
						</div>
					)}
				</section>
			)}
		</div>
	)
}
