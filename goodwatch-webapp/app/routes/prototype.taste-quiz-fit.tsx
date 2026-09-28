// PROTOTYPE - throwaway (#220). What /taste/quiz becomes in the recommendation redesign.
// ?variant=keep|living-room|taste|remove  &as=guest|new|me
// Reuses the quiz's ClickScorer, UnlockCelebration, the Taste tabs' look, the Sample taste band, and SignUpPrompt.
// Mock titles, nothing persists, nothing is written (ratings stay in component state).
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import ClickScorer from "~/ui/scoring/ClickScorer"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { Score } from "~/server/scores.server"
import UnlockCelebration from "~/ui/taste/components/UnlockCelebration"
import { FEATURES } from "~/ui/taste/features"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"

const T = (
	tmdb_id: number,
	media_type: "movie" | "show",
	title: string,
	release_year: string,
	poster_path: string,
	backdrop_path: string,
	genres: string[],
): ScoringMedia => ({ tmdb_id, media_type, title, release_year, poster_path, backdrop_path, genres })

// What smart-titles would serve: popular, widely seen titles first.
const TITLES: ScoringMedia[] = [
	T(155, "movie", "The Dark Knight", "2008", "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", "/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg", ["Action", "Crime"]),
	T(27205, "movie", "Inception", "2010", "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg", ["Science Fiction", "Action"]),
	T(1396, "show", "Breaking Bad", "2008", "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg", ["Drama", "Crime"]),
	T(13, "movie", "Forrest Gump", "1994", "/Cw4hIUIAmSYfK9QfaUW5igp9La.jpg", "/66Kn4XWhkuPkJxOJyPEx4U2CUfN.jpg", ["Comedy", "Drama"]),
	T(603, "movie", "The Matrix", "1999", "/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg", "/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg", ["Action", "Science Fiction"]),
	T(1399, "show", "Game of Thrones", "2011", "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", "/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg", ["Drama", "Fantasy"]),
	T(157336, "movie", "Interstellar", "2014", "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg", ["Science Fiction", "Drama"]),
	T(66732, "show", "Stranger Things", "2016", "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg", "/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg", ["Drama", "Mystery"]),
	T(496243, "movie", "Parasite", "2019", "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg", ["Thriller", "Drama"]),
	T(807, "movie", "Se7en", "1995", "/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg", "/i5H7zusQGsysGQ8i6P361Vnr0n2.jpg", ["Crime", "Mystery"]),
	T(8966, "movie", "Twilight", "2008", "/3Gkb6jm6962ADUPaCBqzz9CTbn9.jpg", "/weAYfu6FfrNxEDJ3xH1XpgQcqUv.jpg", ["Fantasy", "Romance"]),
	T(11036, "movie", "The Notebook", "2004", "/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg", "/zdXnJqBaGFVtLoPNuMeKfEYUViZ.jpg", ["Romance", "Drama"]),
]
const PICKS = [
	T(949, "movie", "Heat", "1995", "/umSVjVdbVwtx5ryCA2QXL44Durm.jpg", "/uI22JkEMediWyiRqhllNqeeGtW0.jpg", ["Crime"]),
	T(1949, "movie", "Zodiac", "2007", "/6YmeO4pB7XTh8P8F960O1uA14JO.jpg", "/3zCPI4JFc54xvLaJ71oI2KoP3az.jpg", ["Crime"]),
	T(670, "movie", "Oldboy", "2003", "/pWDtjs568ZfOTMbURQBYuT4Qxka.jpg", "/rwf5SUTiEsmfkXAgy15R0UtJUtv.jpg", ["Thriller"]),
]
const poster = (m: ScoringMedia, w = "w342") => `https://image.tmdb.org/t/p/${w}${m.poster_path}`

type Variant = "keep" | "living-room" | "taste" | "remove"
type As = "guest" | "new" | "me"
const VARIANTS: Record<Variant, { name: string; idea: string }> = {
	keep: { name: "Keep the quiz", idea: "/taste/quiz stays a separate page with its unlock ladder. Taste's empty states and the TV link to it." },
	"living-room": { name: "Merge into the Living room", idea: "After this or that, the TV asks \"Seen any of these?\" and rates on the TV until 5. No separate page." },
	taste: { name: "Fold into Taste", idea: "The rating shortcut opens a rating strip inside the Taste tab; the Sample taste band counts to 5 and flips to your taste." },
	remove: { name: "Remove it", idea: "No rating flow. Taste's shortcut goes to Discover (Popular, Not seen yet off) where cards carry rating stars." },
}
const GOAL = 5

function useRatings(as: As) {
	const start = as === "me" ? 42 : 0
	const [scores, setScores] = useState<{ m: ScoringMedia; s: Score | null }[]>([])
	const rated = scores.filter((x) => x.s).length
	return {
		count: start + rated,
		rated,
		liked: scores.filter((x) => (x.s ?? 0) >= 7).length,
		next: TITLES[scores.length % TITLES.length],
		rate: (s: Score) => setScores((p) => [...p, { m: TITLES[p.length % TITLES.length], s }]),
		skip: () => setScores((p) => [...p, { m: TITLES[p.length % TITLES.length], s: null }]),
		reset: () => setScores([]),
	}
}
type R = ReturnType<typeof useRatings>

export default function TasteQuizFit() {
	const [sp, setSp] = useSearchParams()
	const variant = (sp.get("variant") as Variant) in VARIANTS ? (sp.get("variant") as Variant) : "keep"
	const as = (["guest", "new", "me"].includes(sp.get("as") ?? "") ? sp.get("as") : "guest") as As
	const set = (k: string, v: string) => {
		const n = new URLSearchParams(sp)
		n.set(k, v)
		setSp(n, { replace: true })
	}
	const r = useRatings(as)
	return (
		<div className="min-h-screen bg-gray-950 text-white">
			<div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-4 py-2 text-xs backdrop-blur">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
					<span className="font-bold text-amber-400">Prototype #220</span>
					{(Object.keys(VARIANTS) as Variant[]).map((v) => (
						<button key={v} type="button" onClick={() => { set("variant", v); r.reset() }} className={`rounded-full px-3 py-1 ${v === variant ? "bg-amber-400 font-bold text-gray-950" : "bg-white/10 text-gray-300"}`}>
							{VARIANTS[v].name}
						</button>
					))}
					<span className="mx-2 text-gray-600">|</span>
					{(["guest", "new", "me"] as As[]).map((a) => (
						<button key={a} type="button" onClick={() => { set("as", a); r.reset() }} className={`rounded-full px-3 py-1 ${a === as ? "bg-white font-bold text-gray-950" : "bg-white/10 text-gray-300"}`}>
							{a === "guest" ? "New guest" : a === "new" ? "New member" : "Member, 42 ratings"}
						</button>
					))}
					<span className="ml-auto text-gray-400">{VARIANTS[variant].idea}</span>
				</div>
			</div>
			{variant === "keep" && <Keep r={r} as={as} />}
			{variant === "living-room" && <LivingRoom r={r} as={as} />}
			{variant === "taste" && <TasteFold r={r} as={as} />}
			{variant === "remove" && <Remove r={r} as={as} />}
		</div>
	)
}

// ---------- shared bits (existing looks) ----------

function Dots({ n }: { n: number }) {
	return (
		<span className="inline-flex gap-1.5" aria-label={`${Math.min(n, GOAL)} of ${GOAL} ratings`}>
			{Array.from({ length: GOAL }, (_, i) => (
				<span key={i} className={`h-2.5 w-2.5 rounded-full ${i < n ? "bg-amber-400" : "bg-white/15"}`} />
			))}
		</span>
	)
}

function Tabs({ active = 0 }: { active?: number }) {
	return (
		<nav className="border-b border-white/10 bg-gray-950">
			<div className="mx-auto flex max-w-7xl gap-6 px-4 md:gap-8 md:px-8">
				{["Sides of you", "You vs everyone", "Fingerprint"].map((t, i) => (
					<span key={t} className={`-mb-px flex min-h-11 items-center border-b-2 py-3 text-sm font-semibold md:py-4 md:text-base ${i === active ? "border-amber-400 text-white" : "border-transparent text-gray-400"}`}>
						{t}
					</span>
				))}
			</div>
		</nav>
	)
}

function AmberButton({ children, onClick, to, small }: { children: ReactNode; onClick?: () => void; to?: string; small?: boolean }) {
	const cls = `inline-flex min-h-11 cursor-pointer items-center rounded-full bg-linear-to-b from-amber-400 to-amber-600 font-black text-gray-950 hover:brightness-110 md:min-h-9 ${small ? "px-4 text-sm" : "px-5 text-base"}`
	return to ? <Link to={to} className={cls}>{children}</Link> : <button type="button" onClick={onClick} className={cls}>{children}</button>
}

function SampleBand({ n, action }: { n: number; action: ReactNode }) {
	return (
		<section aria-label="Sample taste" className="border-b border-amber-500/20 bg-amber-950/30">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
				<span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">Sample taste</span>
				<p className="text-sm text-amber-50/90">This is someone else's taste. Rate {GOAL} titles you've seen to see your own.</p>
				<Dots n={n} />
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					{action}
					<SignUpPrompt feature="taste" stage="learn" size="inline" />
				</span>
			</div>
		</section>
	)
}

// Stand-in for the Sides of you tab body (the real one needs the taste portrait server).
function SidesMock({ own }: { own: boolean }) {
	return (
		<div className="mx-auto max-w-7xl px-4 pt-10 md:px-8">
			<h1 className="text-3xl font-black md:text-5xl">{own ? "You love dread, and you love wonder." : "Slow-burn crime, and nothing broad."}</h1>
			<p className="mt-3 text-gray-400">{own ? "Built from your ratings just now." : "Sample: a member with about 40 ratings."}</p>
			<div className="mt-8 flex gap-3">
				{(own ? TITLES.slice(0, 5) : PICKS).map((m) => (
					<img key={m.tmdb_id} src={poster(m)} alt={m.title} className="h-48 w-32 rounded-xl object-cover" />
				))}
			</div>
		</div>
	)
}

function Rater({ r, label }: { r: R; label?: ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-6">
			{label}
			<ClickScorer key={r.rated + r.next.tmdb_id} media={r.next} onScore={r.rate} onSkip={r.skip} onPlanToWatch={r.skip} isGuest />
		</div>
	)
}

function Note({ children }: { children: ReactNode }) {
	return <p className="mx-auto max-w-3xl px-4 py-3 text-center text-xs text-sky-300/80">Prototype note: {children}</p>
}

// ---------- A. keep ----------

function Keep({ r, as }: { r: R; as: As }) {
	const [page, setPage] = useState<"entry" | "quiz">(as === "me" ? "quiz" : "entry")
	const [celebrated, setCelebrated] = useState(false)
	if (page === "entry")
		return (
			<>
				<Tabs />
				<SampleBand n={0} action={<AmberButton small onClick={() => setPage("quiz")}>Rate titles</AmberButton>} />
				<SidesMock own={false} />
				<Note>Entry points: this band, the tab empty states, and a TV door. All leave Taste for /taste/quiz.</Note>
			</>
		)
	const unlocked = as !== "me" && r.count >= GOAL && !celebrated
	return (
		<div>
			<div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6">
				<h1 className="text-2xl font-black">Taste Quiz</h1>
				<span className="flex items-center gap-3 text-sm text-gray-400">
					{r.count} rated <Dots n={r.count} />
				</span>
			</div>
			{unlocked ? (
				<UnlockCelebration unlockedFeature={FEATURES[0]} onReveal={() => setCelebrated(true)} onContinueRating={() => setCelebrated(true)} />
			) : (
				<Rater r={r} />
			)}
			<Note>
				At 5 the quiz celebrates "{FEATURES[0].name}" from the old unlock ladder and shows its own picks list, while For you, Best match,
				and the Taste tabs switch on silently elsewhere. Guests hit the 20 cap here. The quiz is a second home for "your taste".
			</Note>
		</div>
	)
}

// ---------- B. living room ----------

function Tv({ children }: { children: ReactNode }) {
	return (
		<div className="flex justify-center bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)] px-4 py-10">
			<div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-3xl border-8 border-black bg-black shadow-2xl ring-1 ring-white/10">{children}</div>
		</div>
	)
}

function LivingRoom({ r, as }: { r: R; as: As }) {
	const [step, setStep] = useState<"duel" | "seen" | "picks">(as === "guest" ? "duel" : "seen")
	const [duels, setDuels] = useState(0)
	const done = r.count >= GOAL && step === "seen"
	return (
		<>
			<Tv>
				{step === "duel" && (
					<div className="flex h-full flex-col p-8">
						<p className="text-xs uppercase tracking-widest text-white/50">2 of 3</p>
						<h2 className="text-3xl font-extrabold">Which one, tonight?</h2>
						<p className="text-white/60">No need to have seen them. Go with your gut.</p>
						<div className="mt-6 flex items-center justify-center gap-6">
							{[TITLES[duels * 2 % 10], TITLES[(duels * 2 + 1) % 10]].map((m, i) => (
								<button key={m.tmdb_id} type="button" onClick={() => (duels >= 2 ? setStep("seen") : setDuels(duels + 1))} className="flex w-[260px] items-center gap-4 rounded-3xl bg-white/5 p-3 ring-2 ring-transparent hover:ring-amber-300">
									<img src={poster(m, "w185")} alt="" className="h-[160px] w-[107px] rounded-xl object-cover" />
									<span className="text-left text-lg font-extrabold">{i ? "Something bigger" : "Something darker"}<span className="block text-sm font-normal text-white/60">{m.title}</span></span>
								</button>
							))}
						</div>
						<p className="mt-auto text-sm text-white/40">{3 - duels} more for your picks.</p>
					</div>
				)}
				{step === "seen" && !done && (
					<div className="flex h-full flex-col p-8">
						<p className="text-xs uppercase tracking-widest text-white/50">{as === "guest" ? "3 of 3" : "Your first night"}</p>
						<h2 className="text-3xl font-extrabold">Seen any of these?</h2>
						<p className="flex items-center gap-3 text-white/60">Rate the ones you've seen. {GOAL} and your picks become yours. <Dots n={r.count} /></p>
						<div className="mt-4 flex gap-6">
							<img src={poster(r.next)} alt="" className="h-[260px] rounded-2xl object-cover" />
							<div className="flex flex-col justify-center">
								<p className="text-2xl font-extrabold">{r.next.title} <span className="text-white/40">({r.next.release_year})</span></p>
								<div className="mt-4 flex flex-wrap gap-2">
									{([3, 5, 7, 9] as Score[]).map((s) => (
										<button key={s} type="button" onClick={() => r.rate(s)} className="rounded-full bg-white/10 px-4 py-2 font-bold hover:bg-amber-400 hover:text-black">{s}</button>
									))}
									<button type="button" onClick={r.skip} className="rounded-full px-4 py-2 text-white/60 hover:bg-white/10">Haven't seen it</button>
								</div>
								<button type="button" onClick={() => setStep("picks")} className="mt-6 self-start text-sm text-white/50 underline">Just show my picks</button>
							</div>
						</div>
					</div>
				)}
				{(step === "picks" || done) && (
					<div className="flex h-full flex-col p-8">
						<h2 className="text-3xl font-extrabold">{r.count >= GOAL ? "Tonight, for you" : "Tonight"}</h2>
						<p className="text-white/60">{r.count >= GOAL ? "From your 5 ratings. Your taste is on Taste now." : "From your this-or-that answers."}</p>
						<div className="mt-6 flex gap-5">
							{PICKS.map((m) => <img key={m.tmdb_id} src={poster(m)} alt={m.title} className="h-[220px] rounded-2xl object-cover" />)}
						</div>
						{r.count >= GOAL && <span className="mt-auto self-start rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black">Taste ▸ Sides of you</span>}
					</div>
				)}
			</Tv>
			<div className="flex justify-center py-2">{r.count >= GOAL && as === "guest" && <SignUpPrompt feature="taste" stage="keep" size="inline" />}</div>
			<Note>
				One-rating-at-a-time on the TV, remote-sized buttons (3/5/7/9 instead of the 10-step scorer). Taste's "Rate titles" would open the room
				with the TV on this screen. Needs the full scorer only on desktop? A TV can't show 10 buttons comfortably.
			</Note>
		</>
	)
}

// ---------- C. fold into Taste ----------

function TasteFold({ r, as }: { r: R; as: As }) {
	const [open, setOpen] = useState(as === "new")
	if (as === "me")
		return (
			<>
				<Tabs />
				<div className="mx-auto flex max-w-7xl justify-end px-4 pt-4 md:px-8"><AmberButton small onClick={() => setOpen(!open)}>{open ? "Done rating" : "Rate more"}</AmberButton></div>
				{open && <Rater r={r} />}
				<SidesMock own />
				<Note>Members keep a "Rate more" entry on every tab; the tab recomputes after each rating (taste rebuilds after writes).</Note>
			</>
		)
	const own = r.count >= GOAL
	return (
		<>
			<Tabs />
			{own ? (
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-4 md:px-8">
					<span className="text-sm text-gray-400">{r.liked} liked of {r.count} rated</span>
					{as === "guest" ? <SignUpPrompt feature="taste" stage="keep" size="inline" /> : <AmberButton small onClick={() => setOpen(!open)}>Rate more</AmberButton>}
				</div>
			) : (
				as === "guest" ? (
					<SampleBand n={r.count} action={<AmberButton small onClick={() => setOpen(true)}>Rate titles</AmberButton>} />
				) : (
					<p className="mx-auto flex max-w-7xl items-center gap-4 px-4 pt-6 text-lg text-gray-300 md:px-8">Rate a few more titles you love to see the sides of your taste. <Dots n={r.count} /></p>
				)
			)}
			{open && !own && <Rater r={r} label={<p className="mb-2 text-center text-sm text-gray-400">{GOAL - r.count} more and this page becomes yours.</p>} />}
			{(own || as === "guest") && <SidesMock own={own} />}
			<Note>
				The rater expands in place under the band; at 5 the band disappears and the tab swaps from the sample to your own taste, no celebration.
				Sides needs ~6 loved titles, so a tab can still show its empty state with the same inline rater.
			</Note>
		</>
	)
}

// ---------- D. remove ----------

function Remove({ r, as }: { r: R; as: As }) {
	const [page, setPage] = useState<"taste" | "discover">("taste")
	if (page === "taste")
		return (
			<>
				<Tabs />
				{as === "me" ? <SidesMock own /> : (
					<>
						<SampleBand n={r.count} action={<AmberButton small onClick={() => setPage("discover")}>Rate titles</AmberButton>} />
						<SidesMock own={r.count >= GOAL} />
					</>
				)}
				<Note>The shortcut goes to Discover. Nothing new to keep alive; the quiz and the unlock ladder are deleted.</Note>
			</>
		)
	return (
		<div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-black">Discover</h1>
				<span className="flex items-center gap-3 text-sm text-gray-400">{r.count} rated <Dots n={r.count} /></span>
			</div>
			<p className="mt-1 text-gray-400">Popular · Not seen yet off · tap a score on anything you've seen</p>
			<div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
				{TITLES.map((m, i) => (
					<div key={m.tmdb_id} className="rounded-xl bg-gray-900 p-2">
						<img src={poster(m)} alt={m.title} className="aspect-[2/3] w-full rounded-lg object-cover" />
						<div className="mt-2 flex justify-between gap-1">
							{([3, 6, 8, 10] as Score[]).map((s) => (
								<button key={s} type="button" onClick={() => r.rate(s)} className="flex-1 rounded bg-white/10 py-1 text-xs font-bold hover:bg-amber-400 hover:text-black">{s}</button>
							))}
						</div>
					</div>
				))}
			</div>
			{r.count >= GOAL && (
				<div className="mt-6 flex items-center gap-4 rounded-2xl bg-amber-950/40 p-4 ring-1 ring-amber-500/30">
					<span>For you is on. Your taste is ready.</span>
					<AmberButton small onClick={() => setPage("taste")}>See your taste</AmberButton>
				</div>
			)}
			<Note>Cards don't carry quick scores today (rating is on title details). This variant needs that added, or it's 5 round trips to details pages.</Note>
		</div>
	)
}
