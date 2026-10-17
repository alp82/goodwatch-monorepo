// The quiz the film ends on (scenes/quiz.tsx): "Tap three you loved." over twelve well-known titles. Every tap shows a
// little more of the visitor's taste: the feeling words the picks share build up under the headline, and the three
// slots fill with the posters. The third tap asks the guest recommendations for each kind of title picked
// (api.guest-recommendations.ts), merges them by match, reads the best as intro cards (api.intro.ts: score, services
// in the visitor's country, feeling words) and reveals the top pick with three more.
//
// The taps and the pick are kept for the tab (progress.ts), so coming back from sign-up shows the quiz as it was.
import { Link } from "@remix-run/react"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { TAPS_KEY } from "../progress"

const NEED = 3
/** The reading screen stays at least this long, so its words can land. */
const READ_MS = 1300

type Rec = {
	tmdb_id: number
	media_type: "movie" | "show"
	match_percentage: number
}
type Pick = { top: IntroCard; more: IntroCard[]; fallback: boolean }

/** The mood words of the picks, the most shared first, with how many picks share each. */
function tasteWords(picks: IntroCard[]) {
	const count = new Map<string, number>()
	for (const p of picks)
		for (const f of p.feels) count.set(f, (count.get(f) ?? 0) + 1)
	return [...count.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, picks.length > 1 ? 4 : 3)
}

const short = (title: string) => title.replace(/:.*$/, "")
const joinNames = (names: string[]) =>
	names.length < 2
		? names.join("")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`

async function recsFor(
	type: "movie" | "show",
	picks: IntroCard[],
	pool: IntroCard[],
): Promise<Rec[]> {
	const params = new URLSearchParams({
		mediaType: type,
		scoredItems: JSON.stringify(
			picks.map((p) => ({
				tmdb_id: p.tmdb_id,
				media_type: p.media_type,
				score: 10,
			})),
		),
		excludeIds: JSON.stringify(
			pool.map((p) => ({ tmdb_id: p.tmdb_id, media_type: p.media_type })),
		),
		limit: "8",
	})
	const res = await fetch(`/api/guest-recommendations?${params}`)
	if (!res.ok) throw new Error(`guest recommendations ${res.status}`)
	return (await res.json()).recommendations ?? []
}

async function findPick(picks: IntroCard[], pool: IntroCard[]): Promise<Pick> {
	try {
		const types = [...new Set(picks.map((p) => p.media_type))]
		const lists = await Promise.all(
			types.map((t) => recsFor(t, picks, pool).catch(() => [] as Rec[])),
		)
		const seen = new Set<string>()
		const recs = lists
			.flat()
			.sort((a, b) => b.match_percentage - a.match_percentage)
			.filter((r) => {
				const k = `${r.media_type}:${r.tmdb_id}`
				if (seen.has(k)) return false
				seen.add(k)
				return true
			})
			.slice(0, 10)
		if (!recs.length) throw new Error("no recommendations")
		const res = await fetch(
			`/api/intro?cards=${recs.map((r) => `${r.media_type}:${r.tmdb_id}`).join(",")}`,
		)
		const cards: IntroCard[] = (await res.json()).cards ?? []
		const order = (c: IntroCard) =>
			recs.findIndex(
				(r) => r.tmdb_id === c.tmdb_id && r.media_type === c.media_type,
			)
		cards.sort((a, b) => order(a) - order(b))
		const top =
			cards.find((c) => c.backdrop_path && c.services?.length) ??
			cards.find((c) => c.backdrop_path)
		if (!top) throw new Error("no card with a picture")
		const more = cards.filter((c) => c !== top && c.poster_path).slice(0, 3)
		return { top, more, fallback: false }
	} catch (error) {
		console.error(
			"The intro's quiz: the pick fell back to a title of the quiz",
			error,
		)
		const words = new Set(picks.flatMap((p) => p.feels))
		const shared = (c: IntroCard) => c.feels.filter((f) => words.has(f)).length
		const rest = pool
			.filter((p) => !picks.includes(p) && p.backdrop_path)
			.sort((a, b) => shared(b) - shared(a))
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

/** The visitor's taps and pick, kept for the tab (progress.ts). */
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
		if (value?.keys.length)
			sessionStorage.setItem(TAPS_KEY, JSON.stringify(value))
		else sessionStorage.removeItem(TAPS_KEY)
	} catch {}
}

export function TasteQuiz({
	cards,
	onLeave,
}: { cards: IntroCard[]; onLeave: () => void }) {
	const pool = cards.filter((c) => c.poster_path).slice(0, 12)
	const [picked, setPicked] = useState<IntroCard[]>([])
	const [pick, setPick] = useState<Pick | null>(null)
	const asked = useRef(false)
	// Back from sign-up: the same taps, and the same pick without asking again.
	const restored = useRef(false)
	useEffect(() => {
		const saved = savedTaps()
		restored.current = true
		if (!saved) return
		const cards = saved.keys.flatMap(
			(key) => pool.find((c) => String(c.key) === key) ?? [],
		)
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
			setTimeout(
				() => {
					setPick(found)
					saveTaps({
						keys: pickedRef.current.map((c) => String(c.key)),
						pick: found,
					})
				},
				Math.max(0, READ_MS - (Date.now() - started)),
			)
		})
	}, [full, picked, pool])

	const toggle = (card: IntroCard) => {
		if (full) return
		const next = picked.includes(card)
			? picked.filter((c) => c !== card)
			: [...picked, card]
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
		<div className="quiz">
			{!full && (
				<section className="quiz-ask" aria-labelledby="quiz-h">
					<div className="quiz-head">
						<div className="min-w-0">
							<div className="quiz-kicker">Your turn</div>
							<h2 id="quiz-h" className="quiz-h">
								Tap three you loved.
							</h2>
							<div className="quiz-taste" aria-live="polite">
								{words.length === 0 ? (
									<span className="quiz-taste-hint">
										Your taste, read in three taps.
									</span>
								) : (
									<>
										<span className="quiz-taste-lead">You like it</span>
										{words.map(([word, n]) => (
											<span
												key={word}
												className={`quiz-word ${n > 1 ? "quiz-word-strong" : ""}`}
											>
												{word}
											</span>
										))}
									</>
								)}
							</div>
						</div>
						<div className="quiz-side">
							<div
								className="quiz-slots"
								aria-label={`${picked.length} of ${NEED} picked`}
							>
								{Array.from({ length: NEED }, (_, i) => {
									const p = picked[i]
									return (
										<span
											key={p?.key ?? `empty-${i}`}
											className={`quiz-slot ${p ? "quiz-slot-on" : ""}`}
										>
											{p ? (
												<img
													src={tmdbImageUrl(p.poster_path as string, "w92")}
													alt=""
												/>
											) : (
												<b>{i + 1}</b>
											)}
										</span>
									)
								})}
							</div>
							<button type="button" className="quiz-leave" onClick={onLeave}>
								Just look around
							</button>
						</div>
					</div>
					<ul className="quiz-grid">
						{pool.map((card, i) => {
							const on = picked.includes(card)
							return (
								<li key={card.key} className="contents">
									<button
										type="button"
										className={`quiz-poster ${on ? "quiz-on" : ""}`}
										style={{ "--i": i } as CSSProperties}
										aria-pressed={on}
										onClick={() => toggle(card)}
									>
										<img
											src={tmdbImageUrl(card.poster_path as string, "w185")}
											alt={card.title}
											draggable={false}
										/>
										<span className="quiz-ring" aria-hidden="true" />
										<span className="quiz-n" aria-hidden="true">
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
				<div className="quiz-read" aria-live="polite">
					<div className="quiz-fan">
						{picked.map((p, i) => (
							<img
								key={p.key}
								src={tmdbImageUrl(p.poster_path as string, "w185")}
								alt=""
								style={
									{
										"--r": `${(i - 1) * 9}deg`,
										"--x": `${(i - 1) * 62}%`,
									} as CSSProperties
								}
							/>
						))}
					</div>
					<div className="quiz-read-line">Reading your taste…</div>
					<div className="quiz-read-words">
						{words.map(([w], i) => (
							<span key={w} style={{ animationDelay: `${0.15 + i * 0.22}s` }}>
								{w}
							</span>
						))}
					</div>
				</div>
			)}

			{pick && (
				<section className="quiz-pick" aria-live="polite">
					<img
						className="quiz-pick-art"
						src={tmdbImageUrl(pick.top.backdrop_path as string, "w1280")}
						alt=""
						draggable={false}
					/>
					<div className="quiz-pick-shade" />
					<div className="quiz-pick-words">
						<div
							className="quiz-kicker quiz-in"
							style={{ "--d": "0.15s" } as CSSProperties}
						>
							Picked for you
						</div>
						<div
							className="quiz-pick-title quiz-in"
							style={{ "--d": "0.25s" } as CSSProperties}
						>
							{pick.top.title}
						</div>
						<div
							className="quiz-facts quiz-in"
							style={{ "--d": "0.4s" } as CSSProperties}
						>
							<ScoreRing
								media={
									{
										details: {
											goodwatch_overall_score_normalized_percent:
												pick.top.goodwatch_overall_score_normalized_percent,
										},
									} as never
								}
								size={ring}
							/>
							{pick.top.feels.length > 0 && (
								<span className="quiz-feels">
									{pick.top.feels.slice(0, 2).join(" · ")}
								</span>
							)}
						</div>
						{pick.top.services?.length ? (
							<div
								className="quiz-where quiz-in"
								style={{ "--d": "0.5s" } as CSSProperties}
							>
								<span className="quiz-where-on">On</span>
								{pick.top.services.slice(0, 2).map((s) => (
									<span key={s.id} className="quiz-service">
										{s.logo_path && (
											<img src={tmdbImageUrl(s.logo_path, "w92")} alt="" />
										)}
										{s.name}
									</span>
								))}
							</div>
						) : null}
						<p
							className="quiz-why quiz-in"
							style={{ "--d": "0.6s" } as CSSProperties}
						>
							Because you loved <b>{joinNames(names)}</b>.
						</p>
						<div
							className="quiz-acts quiz-in"
							style={{ "--d": "0.72s" } as CSSProperties}
						>
							<Link to="/sign-up" className="quiz-cta">
								Keep my taste
							</Link>
							<button type="button" className="quiz-ghost" onClick={onLeave}>
								Look around
							</button>
							<button type="button" className="quiz-text" onClick={again}>
								Try three others
							</button>
						</div>
						<p
							className="quiz-small quiz-in"
							style={{ "--d": "0.82s" } as CSSProperties}
						>
							Free. It gets sharper with every title you rate.
						</p>
					</div>
					{pick.more.length > 0 && (
						<div className="quiz-more">
							<div className="quiz-more-label">Also for you</div>
							<div className="quiz-more-row">
								{pick.more.map((c, i) => (
									<img
										key={c.key}
										className="quiz-in"
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
