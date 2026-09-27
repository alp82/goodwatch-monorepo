// PROTOTYPE - throwaway. #192: lightweight mocks of the five destinations, each a real (simple) layout of its
// settled design: the Living room (#187, placeholder TV running the `ask` flow), Watch next (#176, round 8),
// Discover and Search (#179, round 4 `morph` + `badge`), Taste (#177, round 6 tabs), Explorer (#180, round 9
// `preview`, drawn with CSS instead of WebGL). Page controls that the navigation may take over are in controls.tsx.
import { CheckIcon, FingerPrintIcon, MagnifyingGlassIcon, MinusIcon, PlayIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { useEffect, useMemo, useRef } from "react"
import { Card, GMark, Logos, Poster } from "./bits"
import { DiscRow, ExplorerControls, TasteTabs, WnDock } from "./controls"
import { TITLES, type NTitle } from "./data"
import { MOODS, TAGLINE, WISHLIST, byTitle, img, matchOf, seeded, useShell } from "./model"
import room from "./room.webp"

// ------------------------------------------------------------------ Home: the Living room placeholder

function TvScreen() {
	const s = useShell()
	const guest = s.who === "guest"
	return (
		<div className="rn-tvs">
			<div className="rn-tvs-top">
				<GMark size={14} />
				<span>{guest ? "GoodWatch" : "Good evening"}</span>
				<span className="rn-grow" />
				<span>9:41 pm</span>
			</div>
			{guest ? (
				<>
					<h3>Let's find something good for tonight.</h3>
					<div className="rn-tvs-choices">
						<button type="button" className="is-main">
							Find my tonight
						</button>
						<button type="button">Just show me</button>
						<button type="button">What is GoodWatch?</button>
					</div>
				</>
			) : (
				<>
					<h3>What kind of night?</h3>
					<div className="rn-tvs-moods">
						{[{ k: "any", name: "Any mood", hue: "#fff" }, ...MOODS].map((m, i) => (
							<span key={m.k} className={i === 0 ? "is-focus" : ""}>
								<i style={{ background: m.hue }} />
								{m.name}
								<small>{[11, 3, 4, 2, 5, 1, 6, 4, 2, 3, 1, 2][i]}</small>
							</span>
						))}
					</div>
				</>
			)}
			<div className="rn-tvs-open">
				<span>Or open</span>
				<button type="button" onClick={() => (guest ? s.setSheet("signup") : s.go("watch"))}>
					Watch now
				</button>
				<button type="button" onClick={() => s.go("taste")}>
					Taste
				</button>
				<button type="button" onClick={() => s.go("discover")}>
					Discover
				</button>
				<button type="button" onClick={() => s.go("explorer")}>
					Explorer
				</button>
			</div>
		</div>
	)
}

export function HomePage() {
	return (
		<section className="rn-home">
			<div className="rn-room">
				<div className="rn-room-img" style={{ backgroundImage: `url(${room})` }}>
					<div className="rn-tv">
						<TvScreen />
					</div>
				</div>
			</div>
			<p className="rn-note">Living room placeholder. The TV runs the `ask` flow from #187; its "Or open" row, the remote's feature keys and the site navigation all lead to the same four pages.</p>
		</section>
	)
}

// ------------------------------------------------------------------ Watch next

function Tiers({ list }: { list: NTitle[] }) {
	const tiers = [list.slice(0, 5), list.slice(5, 12), list.slice(12)]
	return (
		<div className="rn-tiers">
			{tiers.map((row, i) =>
				row.length ? (
					<div key={i} className={`rn-tier t${i}`}>
						{row.map((t, j) => (
							<Poster key={t.id} t={t} rank={i === 0 ? 5 + j : undefined} />
						))}
					</div>
				) : null,
			)}
		</div>
	)
}

export function WatchPage() {
	const s = useShell()
	const guest = s.who === "guest"
	const list = WISHLIST[s.who]
	const t = list[0]
	const then = list.slice(1, 4)
	const worth = TITLES.filter((x) => !list.includes(x)).slice(0, 10)
	return (
		<section className="rn-wn">
			<div className="rn-wn-hero" style={{ backgroundImage: `url(${img(t.backdrop, "w1280")})` }}>
				<div className="rn-d rn-wn-dockpos">
					<WnDock />
				</div>
				<div className="rn-wn-body">
					<div className="rn-wn-main">
						<p className="rn-eyebrow">
							{guest ? "Top of your Wishlist" : "Best match for you tonight"}
							{!guest && (
								<span className="rn-moodtag">
									<i style={{ background: "#60a5fa" }} />
									Crime &amp; mystery
								</span>
							)}
						</p>
						<h1 className="rn-wn-title">{t.title}</h1>
						<p className="rn-wn-tag">{TAGLINE[t.title] ?? "Next on your list."}</p>
						<p className="rn-wn-meta">
							{t.year}, {t.type === "show" ? "Series" : "Movie"}
							{guest ? "" : `, ${matchOf(t)}% taste match`}
						</p>
						<div className="rn-wn-actions">
							<button type="button" className="rn-play">
								<Logos ids={t.services.slice(0, 1)} size={22} />
								<PlayIcon className="rn-i16" /> Play on {t.services[0] === 337 ? "Disney+" : t.services[0] === 8 ? "Netflix" : "Prime"}
							</button>
							<button type="button" className="rn-ghost">
								<CheckIcon className="rn-i16" /> I watched it
							</button>
							<button type="button" className="rn-textbtn">
								Not tonight
							</button>
						</div>
					</div>
					<div className="rn-wn-then">
						<h4>Then</h4>
						{then.map((x, i) => (
							<div key={x.id} className="rn-then">
								<Poster t={x} rank={i + 2} />
								<span>
									<b>{x.title}</b>
									<small>{x.type === "show" ? "Series" : "Movie"}, {x.year}</small>
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
			{guest && (
				<div className="rn-cta">
					<FingerPrintIcon className="rn-i20 rn-amber" />
					<p>
						<b>Best match needs your taste.</b> Sign up and Watch next orders your Wishlist by what you like, with moods that fit it.
					</p>
					<button type="button" className="rn-signup" onClick={() => s.setSheet("signup")}>
						Sign up
					</button>
				</div>
			)}
			{guest ? (
				<div className="rn-block">
					<h3>Worth adding</h3>
					<p className="rn-dim">Tap Want to See and it joins Watch next.</p>
					<div className="rn-row">
						{worth.map((x) => (
							<Card key={x.id} t={x} guest />
						))}
					</div>
				</div>
			) : (
				<div className="rn-block">
					<h3>Later</h3>
					<Tiers list={list.slice(4)} />
				</div>
			)}
		</section>
	)
}

// ------------------------------------------------------------------ Discover and Search

export function DiscoverPage() {
	const s = useShell()
	const input = useRef<HTMLInputElement>(null)
	const guest = s.who === "guest"
	useEffect(() => {
		if (s.searching) input.current?.focus({ preventScroll: true })
	}, [s.searching])
	const words = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
	const results = useMemo(() => {
		const base = s.disc.forYou && !guest && !s.searching ? [...TITLES].sort((a, b) => matchOf(b) - matchOf(a)) : TITLES
		if (!words.length) return base
		const hit = base.filter((t) => words.some((w) => t.title.toLowerCase().includes(w)))
		return hit.length ? hit : base.slice(0, 8)
	}, [s.q, s.searching, s.disc.forYou, guest])
	return (
		<section className="rn-disc">
			<header className="rn-disc-head">
				{s.searching ? (
					<div className="rn-sfield">
						<MagnifyingGlassIcon className="rn-i20" />
						<input ref={input} value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder="Titles, people, a mood…" aria-label="Search" />
						<button type="button" onClick={s.closeSearch} aria-label="Back to browsing">
							<XMarkIcon className="rn-i20" />
						</button>
					</div>
				) : (
					<button type="button" className="rn-disc-h1" onClick={s.openSearch}>
						Discover
						<span className="rn-roundsearch">
							<MagnifyingGlassIcon className="rn-i20" />
						</span>
					</button>
				)}
				<p className="rn-chipline">
					{s.searching ? (
						words.length ? (
							<>
								Read as
								{words.slice(0, 3).map((w, i) => (
									<span key={w} className={`rn-chip c${i}`}>
										{w}
									</span>
								))}
							</>
						) : (
							<span className="rn-dim">Type a title, a person, or what you're in the mood for.</span>
						)
					) : guest ? (
						<>
							<FingerPrintIcon className="rn-i16 rn-amber" /> Rate a few titles and For you orders this by your taste.
						</>
					) : (
						<>
							<FingerPrintIcon className="rn-i16 rn-amber" /> Your taste leans to
							<span className="rn-chip c0">big questions</span>
							<span className="rn-chip c1">psychological games</span>
							<span className="rn-chip c2">moral grey</span>
						</>
					)}
				</p>
			</header>
			<div className="rn-d">
				<DiscRow />
			</div>
			<div className="rn-grid">
				{results.map((t) => (
					<Card key={t.id} t={t} guest={guest} />
				))}
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ Taste

function Fan({ names, side }: { names: string[]; side: "a" | "b" }) {
	return (
		<div className={`rn-fan is-${side}`}>
			{names.map((n, i) => (
				<Poster key={n} t={byTitle(n)} className={`f${i}`} />
			))}
		</div>
	)
}

function Crowd() {
	const dots = useMemo(() => {
		const r = seeded(42)
		return Array.from({ length: 260 }, () => {
			const a = r() * Math.PI * 2
			const d = Math.sqrt(-2 * Math.log(r() + 1e-6)) * 0.16
			return { x: 50 + Math.cos(a) * d * 100, y: 50 + Math.sin(a) * d * 70 }
		}).filter((p) => p.x > 2 && p.x < 98 && p.y > 4 && p.y < 96)
	}, [])
	return (
		<div className="rn-crowd">
			<div className="rn-crowd-field">
				{dots.map((p, i) => (
					<i key={i} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
				))}
				<b className="rn-you" style={{ left: "81%", top: "22%" }}>
					You
				</b>
			</div>
			<p className="rn-crowd-cap">Most people's favorites sit in the middle. Yours sit out here, where 4% of people do: slower, stranger, and more about ideas.</p>
		</div>
	)
}

const FAMILIES = [
	{ n: "Mood", line: "How it makes you feel", v: 0.82, top: "Dreamlike" },
	{ n: "Story", line: "How it's told", v: 0.74, top: "Puzzle-box" },
	{ n: "World", line: "What it's about", v: 0.61, top: "Big questions" },
	{ n: "Craft", line: "How it looks and sounds", v: 0.55, top: "Striking visuals" },
	{ n: "Humor", line: "What makes you laugh", v: 0.28, top: "Deadpan" },
]

export function TastePage() {
	const s = useShell()
	const guest = s.who === "guest"
	const mergeTabs = s.variant === "merge"
	return (
		<section className="rn-taste">
			<div className={`rn-taste-tabs ${mergeTabs ? "is-merged" : ""}`}>
				<TasteTabs where="top" />
			</div>
			{guest && (
				<div className="rn-cta is-slim">
					<p>
						<b>This is a demo member's taste.</b> Rate ten titles to see yours.
					</p>
					<button type="button" className="rn-signup" onClick={() => s.setSheet("signup")}>
						Sign up
					</button>
				</div>
			)}
			{s.tab === "sides" && (
				<>
					<div className="rn-sides-hero">
						<Fan names={["Blade Runner 2049", "Lioness", "Reacher"]} side="a" />
						<div className="rn-sides-text">
							<p className="rn-dim">The contradiction in your taste</p>
							<h2>
								You love <em className="a">big-question stories about money and class</em>
								<span>and also</span>
								<em className="b">curious crime stories</em>
							</h2>
							<p className="rn-dim">Most people's favorites sit close together. Yours are 53% one thing and 41% its opposite.</p>
						</div>
						<Fan names={["Law & Order: Special Victims Unit", "The Mentalist", "Supernatural"]} side="b" />
					</div>
					<div className="rn-block">
						<h3>The sides of your taste</h3>
						{[
							{ n: "Big questions", c: "#fbbf24", t: ["Project Hail Mary", "The Odyssey", "Avatar: Fire and Ash", "Blade Runner 2049", "Colony"] },
							{ n: "Curious crime", c: "#38bdf8", t: ["The Mentalist", "Reacher", "Law & Order: Special Victims Unit", "Lioness", "Facing El Chapo"] },
							{ n: "Comfort worlds", c: "#f472b6", t: ["The Office", "The Simpsons", "Zootopia 2", "Toy Story 5", "Grey's Anatomy"] },
						].map((side) => (
							<div key={side.n} className="rn-side">
								<h4 style={{ color: side.c }}>{side.n}</h4>
								<div className="rn-row">
									{side.t.map((n) => (
										<Poster key={n} t={byTitle(n)} />
									))}
								</div>
							</div>
						))}
					</div>
				</>
			)}
			{s.tab === "crowd" && (
				<div className="rn-block">
					<h2 className="rn-h2">You vs everyone</h2>
					<Crowd />
				</div>
			)}
			{s.tab === "fingerprint" && (
				<div className="rn-block">
					<p className="rn-dim">Your fingerprint</p>
					<h2 className="rn-h2">The dreamlike novelty hunter</h2>
					<p className="rn-dim">You chase stories that feel like nothing you've seen, told slowly and strangely.</p>
					<div className="rn-fams">
						{FAMILIES.map((f) => (
							<button type="button" key={f.n} className="rn-fam">
								<span className="rn-fam-name">
									<b>{f.n}</b>
									<small>{f.line}</small>
								</span>
								<span className="rn-fam-bar">
									<i style={{ width: `${f.v * 100}%` }} />
								</span>
								<span className="rn-fam-top">{f.top}</span>
							</button>
						))}
					</div>
					<h3>Most you</h3>
					<div className="rn-row">
						{["Blade Runner 2049", "Project Hail Mary", "The Odyssey", "Supernatural", "Lioness", "Avatar: Fire and Ash"].map((n) => (
							<Poster key={n} t={byTitle(n)} />
						))}
					</div>
				</div>
			)}
		</section>
	)
}

// ------------------------------------------------------------------ Explorer

const ISLANDS = [
	{ n: "Science fiction", x: 42, y: 22, r: 15, h: "#34d399", t: "Blade Runner 2049", c: "977 titles, 78% your taste" },
	{ n: "Horror", x: 16, y: 34, r: 12, h: "#84cc16", t: "Resident Evil", c: "1,108 titles" },
	{ n: "Animation", x: 72, y: 26, r: 12, h: "#f0abfc", t: "Zootopia 2", c: "820 titles" },
	{ n: "Fantasy", x: 55, y: 40, r: 9, h: "#a78bfa", t: "Avatar: Fire and Ash", c: "" },
	{ n: "Mystery and thriller", x: 33, y: 45, r: 13, h: "#60a5fa", t: "Reacher", c: "797 titles, 82% your taste" },
	{ n: "Family", x: 88, y: 43, r: 8, h: "#a5b4fc", t: "Toy Story 5", c: "" },
	{ n: "Action and adventure", x: 52, y: 58, r: 10, h: "#fb923c", t: "Avengers: Endgame", c: "" },
	{ n: "Comedy", x: 72, y: 56, r: 13, h: "#facc15", t: "The Office", c: "915 titles, 62% your taste" },
	{ n: "War and history", x: 17, y: 62, r: 10, h: "#d4a373", t: "Lioness", c: "" },
	{ n: "Documentary", x: 36, y: 64, r: 9, h: "#e5e7eb", t: "Facing El Chapo", c: "" },
	{ n: "Drama", x: 55, y: 76, r: 11, h: "#fdba74", t: "Grey's Anatomy", c: "" },
	{ n: "Crime", x: 34, y: 84, r: 15, h: "#f87171", t: "Law & Order: Special Victims Unit", c: "1,559 titles, 84% your taste" },
	{ n: "Romance", x: 77, y: 79, r: 12, h: "#f472b6", t: "The Love Hypothesis", c: "921 titles, 60% your taste" },
]

export function ExplorerPage() {
	const s = useShell()
	const merged = s.variant === "merge"
	return (
		<section className="rn-x">
			<div className="rn-sea" />
			<div className="rn-x-field">
				{ISLANDS.map((il, i) => {
					const lit = s.lit === i
					const dim = s.lit !== null && !lit
					const shared = s.lit !== null && !lit ? 90 + ((i * 131 + (s.lit ?? 0) * 57) % 520) : 0
					return (
						<button
							type="button"
							key={il.n}
							className={`rn-island ${lit ? "is-lit" : ""} ${dim ? "is-dim" : ""}`}
							style={{ left: `${il.x}%`, top: `${il.y}%`, ["--r" as string]: il.r, ["--h" as string]: il.h }}
							onClick={() => s.setLit(lit ? null : i)}
						>
							<span className="rn-island-bg" style={{ backgroundImage: `url(${img(byTitle(il.t).backdrop, "w300")})` }} />
							<span className="rn-island-label">
								<b>{il.n}</b>
								{shared ? <small className="rn-amber">{shared} in both</small> : il.c ? <small>{il.c}</small> : null}
							</span>
						</button>
					)
				})}
			</div>
			<div className={`rn-x-top ${merged ? "is-merged" : ""}`}>
				<ExplorerControls where="map" />
			</div>
			<div className="rn-x-bottom">
				<p className="rn-x-hint">{s.lit === null ? "Tap an island to see how much it shares with every other island." : "Tap another island to raise the bridge between them."}</p>
				<div className="rn-zoom">
					<button type="button" aria-label="Zoom in">
						<PlusIcon className="rn-i20" />
					</button>
					<button type="button" aria-label="Zoom out">
						<MinusIcon className="rn-i20" />
					</button>
				</div>
			</div>
		</section>
	)
}

