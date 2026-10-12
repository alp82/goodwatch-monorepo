// PROTOTYPE - throwaway. The review page of /prototype/rec-brand: every place the GoodWatch name is drawn today, as
// a mocked context at its real size, drawn with one logo system. The contexts are representative mocks, not the
// production components; none of them is changed.
import { type ReactNode, useRef, useState } from "react"
import roomPhoto from "~/img/living-room/room-1280.webp"
import { CardFonts, useIsomorphicLayoutEffect } from "~/ui/share-card/ScaledCard"
import { assetUrl } from "~/utils/asset-url"
import { type BrandSystem, G, INK, type Tone, WHITE, YELLOW } from "./variants"

const AMBER = "#fbbf24"
const tmdb = (path: string, size = "w342") => `https://image.tmdb.org/t/p/${size}${path}`
const TITLES = [
	{ title: "Blade Runner 2049", year: 2017, score: 83, poster: "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", tint: "#7c4a1e" },
	{ title: "Project Hail Mary", year: 2026, score: 86, poster: "/yihdXomYb5kTeSivtFndMy5iDmf.jpg", tint: "#1e3a5f" },
	{ title: "Avengers: Endgame", year: 2019, score: 85, poster: "/ulzhLuWrPK07P1YkdWQLZnQh1JL.jpg", tint: "#3b2a5c" },
	{ title: "Zootopia 2", year: 2025, score: 81, poster: "/oJ7g2CifqpStmoYQyaLQgEU32qO.jpg", tint: "#1f5a4a" },
	{ title: "Toy Story 5", year: 2026, score: 81, poster: "/sfQtVlIHljToOwYjhe21KPGzZWK.jpg", tint: "#5c2a2a" },
]

/** A poster from TMDB over a tint, so the mock still reads without a network. */
function Poster({ i, w, h, r = 12 }: { i: number; w: number | string; h: number | string; r?: number }) {
	const t = TITLES[i]
	return (
		<div style={{ width: w, height: h, borderRadius: r, flexShrink: 0, overflow: "hidden", background: `linear-gradient(160deg, ${t.tint}, #111)` }}>
			<img src={tmdb(t.poster)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
		</div>
	)
}

/** A fixed-size design (an og image, a share card, a TV canvas) scaled down to the width it is given. */
function Fit({ w, h, max, children }: { w: number; h: number; max?: number; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [scale, setScale] = useState(0)
	useIsomorphicLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / w))
		observer.observe(el)
		return () => observer.disconnect()
	}, [w])
	return (
		<div ref={ref} className="relative w-full overflow-hidden" style={{ maxWidth: max ?? w, aspectRatio: `${w} / ${h}` }}>
			<div className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
				{children}
			</div>
		</div>
	)
}

function Section({ n, name, source, today, children }: { n: string; name: string; source: string; today: string; children: ReactNode }) {
	return (
		<section className="border-t border-white/10 py-7">
			<header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className="rb-mono text-[12px] text-amber-400">{n}</span>
				<h2 className="text-[19px] font-bold text-white">{name}</h2>
				<span className="rb-mono text-[11.5px] text-gray-500">{source}</span>
				<span className="basis-full text-[13px] text-gray-400">
					<b className="text-gray-300">Today:</b> {today}
				</span>
			</header>
			{children}
		</section>
	)
}
const Cap = ({ children }: { children: ReactNode }) => <div className="mb-1.5 mt-1 text-[12px] font-semibold text-gray-400">{children}</div>
const Chip = ({ children, tone = "copy" }: { children: ReactNode; tone?: "copy" | "brand" | "emblem" }) => (
	<span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tone === "brand" ? "bg-amber-400 text-black" : tone === "emblem" ? "bg-sky-300 text-black" : "bg-white/10 text-gray-200"}`}>{children}</span>
)
/** Real-size mocks keep their pixel width; on a narrower window they scroll sideways instead of shrinking. */
const RealSize = ({ children }: { children: ReactNode }) => <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">{children}</div>

// --- 01 Headers ------------------------------------------------------------------------------------------------
function Headers({ b }: { b: BrandSystem }) {
	const phone = "flex h-16 w-[390px] shrink-0 items-center gap-2.5 border-b border-white/[0.09] bg-gray-950 pr-2.5 pl-3.5 rounded-lg ring-1 ring-white/10"
	const signUp = <span className="flex h-8 items-center rounded-full bg-amber-500 px-[13px] text-[13px] font-extrabold text-amber-950">Sign up</span>
	return (
		<Section n="01" name="Site headers" source="ui/main/Header.tsx · ui/navigation/SiteHeader.tsx" today="white G (#fdfcfc) + “oodWatch” in near-white (#f3f4f6), Gabarito 700. On phones: the G, and the full word “GoodWatch” beside it on Home.">
			<Cap>Main desktop header · 64px bar, real size</Cap>
			<RealSize>
				<div className="flex h-16 min-w-[1024px] items-center bg-gray-900 px-4">
					<b.Lockup size={28} />
					<div className="ml-6 flex gap-4 text-[16px] font-semibold text-gray-300">
						{["Taste", "Movies", "Shows", "Discover"].map((l, i) => (
							<span key={l} className={`rounded-md px-3 py-2 ${i === 3 ? "bg-amber-800 text-white" : ""}`}>{l}</span>
						))}
					</div>
					<span className="grow" />
					<span className="flex h-9 w-72 items-center rounded-md bg-gray-800 px-3 text-sm text-gray-400">Search movies and shows</span>
					<span className="ml-3 rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white">Sign in</span>
				</div>
			</RealSize>
			<Cap>New navigation desktop header · 64px bar, real size</Cap>
			<RealSize>
				<div className="flex h-16 min-w-[1024px] items-center gap-[18px] border-b border-white/[0.09] bg-gray-950 px-8">
					<b.Lockup size={28} />
					<span className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 font-bold text-gray-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">▦ Browse ▾</span>
					<span className="grow" />
					<span className="flex h-10 w-[320px] items-center rounded-xl bg-white/[0.06] px-3.5 text-sm text-gray-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]">Search or ask for a mood</span>
					<span className="flex items-center gap-2">
						<span className="overflow-hidden rounded-md ring-[1.5px] ring-amber-400/85"><Poster i={1} w={30} h={44} r={0} /></span>
						<span className="flex flex-col leading-[1.15]">
							<small className="text-[11px] font-bold text-amber-400">Tonight</small>
							<b className="text-[13.5px] text-gray-100">Project Hail Mary</b>
						</span>
					</span>
					<span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-rose-500" />
				</div>
			</RealSize>
			<div className="mt-1 flex flex-wrap gap-x-5">
				<div className="min-w-0 max-w-full">
					<Cap>Phone header on Home · 390px</Cap>
					<RealSize>
					<div className={phone}>
						<b.Lockup size={22} />
						<span className="grow" />
						{signUp}
					</div>
					</RealSize>
				</div>
				<div className="min-w-0 max-w-full">
					<Cap>Compact, emblem only · phone header away from Home</Cap>
					<RealSize>
					<div className={phone}>
						<b.Emblem size={25} />
						<span className="brand-header text-[19px] text-white">Discover</span>
						<span className="grow" />
						{signUp}
					</div>
					</RealSize>
				</div>
			</div>
		</Section>
	)
}

// --- 02 to 04 Living room --------------------------------------------------------------------------------------
function Boot({ b, run }: { b: BrandSystem; run: number }) {
	return (
		<div key={run} className="rb-boot">
			<b.Lockup size={64} />
		</div>
	)
}
function LivingRoom({ b }: { b: BrandSystem }) {
	const [run, setRun] = useState(0)
	const [reduced, setReduced] = useState(false)
	const photo = assetUrl(roomPhoto)
	return (
		<Section n="02–04" name="Living room: TV boot, caption, phone landscape home link" source="ui/living-room/TvScreens.tsx (Boot) · LivingRoom.tsx · PhoneLivingRoom.tsx" today="boot: G above “GOODWATCH”, bold, tracking 0.35em. Caption: G + uppercase tracked “GOODWATCH” + “Pull up a seat.” Phone landscape: black pill with G + “GoodWatch”, 12px semibold.">
			<div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
				<button type="button" onClick={() => setRun(run + 1)} className="rounded-full bg-white px-3 py-1 font-bold text-black">↻ Replay boot</button>
				<label className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
					<input type="checkbox" checked={reduced} onChange={(e) => { setReduced(e.target.checked); setRun(run + 1) }} />
					Preview reduced motion
				</label>
				<span className="text-gray-400">One Boot for both TVs. The last frame is the standard lockup, no boot-only typography. Your system's reduced-motion setting is honored as well.</span>
			</div>
			<div className={`grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] ${reduced ? "rb-reduced" : ""}`}>
				<div className="min-w-0">
					<Cap>Desktop room · TV boot (960×528 canvas, scaled to the set) and caption at real size</Cap>
					<div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: "1672 / 941", background: `center / cover url("${photo}")` }}>
						<div className="absolute overflow-hidden rounded-[3px] bg-black" style={{ left: "31.76%", top: "9.56%", width: "36.54%", height: "35.07%" }}>
							<Fit w={960} h={528}><Boot b={b} run={run} /></Fit>
							<div className="rb-tvglass pointer-events-none absolute inset-0" />
						</div>
						<div className="absolute bottom-6 left-8 flex items-center gap-3 [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
							<b.Small size={22} />
							<span className="text-[15px] text-white/70">Pull up a seat.</span>
						</div>
					</div>
				</div>
				<div className="min-w-0">
					<Cap>Phone landscape · 844×390, boot on the 560×308 canvas, home link top left</Cap>
					<div className="overflow-x-auto">
						<div className="relative h-[390px] w-[844px] overflow-hidden rounded-[28px] ring-4 ring-gray-800" style={{ background: `-13px -31px / 870px auto no-repeat url("${photo}") #0b0f14` }}>
							<div className="absolute overflow-hidden bg-black" style={{ left: 263, top: 16, width: 318, height: 172 }}>
								<Fit w={560} h={308}><Boot b={b} run={run} /></Fit>
							</div>
							{b.treatment === "badge" ? (
								<span className="absolute left-3 top-3"><b.Small size={18} /></span>
							) : (
								<span className="absolute left-3 top-3 flex items-center rounded-full bg-black/55 py-1.5 pl-2.5 pr-3 ring-1 ring-white/10"><b.Small size={b.treatment === "initial" ? 12.5 : 13} /></span>
							)}
						</div>
					</div>
					{b.treatment === "badge" && <p className="mt-1 text-[12px] text-gray-400">The one-line badge is the pill: no second black pill around it.</p>}
				</div>
			</div>
		</Section>
	)
}

// --- 05 Open Graph images --------------------------------------------------------------------------------------
function OgTitle({ b }: { b: BrandSystem }) {
	return (
		<div style={{ position: "relative", width: 1200, height: 630, background: AMBER, fontFamily: "Gabarito", overflow: "hidden" }}>
			<div style={{ position: "absolute", left: 780, top: 0 }}><Poster i={0} w={420} h={630} r={0} /></div>
			<div style={{ position: "absolute", top: 40, left: 56 }}><b.Lockup size={56} tone="light" /></div>
			<div style={{ position: "absolute", left: 56, bottom: 52, width: 670, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
				<div style={{ background: INK, color: AMBER, fontSize: 24, fontWeight: 900, letterSpacing: 3, padding: "7px 16px", borderRadius: 6 }}>MOVIE · 2017 · 2H 44M</div>
				<div style={{ fontFamily: "Anton", fontSize: 112, lineHeight: 0.95, letterSpacing: 1, color: INK }}>BLADE RUNNER 2049</div>
				<div style={{ background: "#16934a", borderRadius: 20, padding: "8px 30px 14px", textAlign: "center", color: "#fff" }}>
					<div style={{ fontFamily: "Anton", fontSize: 108, lineHeight: 1.05 }}>83</div>
					<div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3 }}>GREAT</div>
				</div>
			</div>
		</div>
	)
}
function OgBand({ b, photo }: { b: BrandSystem; photo: string }) {
	return (
		<div style={{ position: "relative", width: 1200, height: 630, background: "#0b0f14", fontFamily: "Gabarito", overflow: "hidden" }}>
			<div style={{ position: "absolute", inset: 0, background: `center 30% / cover url("${photo}")`, opacity: 0.55 }} />
			<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,10,0.75) 0%, rgba(10,10,10,0.1) 40%, rgba(10,10,10,0.92) 100%)" }} />
			<div style={{ position: "absolute", top: 36, left: 56 }}><b.Lockup size={56} /></div>
			<div style={{ position: "absolute", left: 56, right: 56, bottom: 52, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
				<div style={{ background: AMBER, color: INK, fontSize: 24, fontWeight: 900, letterSpacing: 3, padding: "7px 16px", borderRadius: 6 }}>ABOUT</div>
				<div style={{ fontFamily: "Anton", fontSize: 124, lineHeight: 0.95, color: "#fff" }}>WHAT TO WATCH TONIGHT</div>
				<div style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Scores, streaming and taste in one place.</div>
			</div>
		</div>
	)
}
function OgImages({ b }: { b: BrandSystem }) {
	const photo = assetUrl(roomPhoto)
	const light = b.treatment === "initial" ? "backing plate: an ink chip carries white and yellow onto amber" : b.treatment === "split" ? "ink translation: type in ink, the tile keeps the yellow G; white and yellow do not appear" : "unchanged: the badge is its own ink field"
	return (
		<Section n="05" name="Open Graph image signature" source="ui/og-image/parts.tsx (Brand) · OgCard.tsx" today="amber G + white “GoodWatch” at weight 900 on dark, all ink on the amber panel.">
			<div className="grid gap-5 lg:grid-cols-2">
				{[
					{ label: `Bright amber panel · ${light}`, card: <OgTitle b={b} /> },
					{ label: "Dark background · white and yellow as they are", card: <OgBand b={b} photo={photo} /> },
				].map(({ label, card }) => (
					<div key={label} className="min-w-0">
						<Cap>1200×630, scaled to fit · {label}</Cap>
						<Fit w={1200} h={630}>{card}</Fit>
						<div className="mt-2 flex flex-wrap items-end gap-2 text-[11.5px] text-gray-400">
							<div className="w-[260px] overflow-hidden rounded-xl bg-gray-800"><Fit w={1200} h={630}>{card}</Fit><div className="px-2.5 py-1.5 text-gray-300">goodwatch.app</div></div>
							As a 260px link preview in a chat
						</div>
					</div>
				))}
			</div>
			<p className="mt-3 text-[12.5px] text-gray-400">HTML only. These mocks do not go through Satori and resvg, so they do not yet validate the exported image: the inlined SVG, uppercase transform and cap-height line boxes need a Satori pass.</p>
		</Section>
	)
}

// --- 06 Share cards --------------------------------------------------------------------------------------------
function PodiumMock({ b }: { b: BrandSystem }) {
	return (
		<div style={{ position: "relative", width: 1080, height: 1920, background: "#120804", color: "#fff", fontFamily: "Gabarito", overflow: "hidden" }}>
			<div style={{ position: "absolute", inset: "0 0 auto 0", height: 1180, background: `center / cover url("${tmdb("/gNdLJU9TxrpGx4dkZidjys3fyy0.jpg", "w780")}") #3a1a08` }} />
			<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(18,8,4,0.25) 0%, rgba(18,8,4,0.55) 30%, #120804 58%)" }} />
			<div style={{ position: "absolute", inset: "0 0 auto 0", height: 14, background: "linear-gradient(90deg, #ff5a1f, #ffc53d)" }} />
			<div style={{ position: "relative", height: 1920, padding: "84px 72px 72px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<b.Lockup size={52} />
					<div style={{ background: "#ff5a1f", color: "#120804", fontWeight: 900, fontSize: 30, padding: "10px 26px", borderRadius: 999, letterSpacing: 2 }}>TOP 5</div>
				</div>
				<div style={{ flexGrow: 1 }} />
				<div style={{ fontFamily: "Anton", fontSize: 112, lineHeight: 0.95 }}>MY TOP 5 MOVIES OF ALL TIME</div>
				<div style={{ width: 180, height: 12, margin: "36px 0 56px", borderRadius: 6, background: "linear-gradient(90deg, #ff5a1f, #ffc53d)" }} />
				<div style={{ display: "flex", alignItems: "flex-end", height: 480 }}>
					<div style={{ fontFamily: "Anton", fontSize: 460, lineHeight: 0.78, color: "#ff5a1f", marginRight: 8 }}>1</div>
					<Poster i={0} w={320} h={480} r={18} />
					<div style={{ marginLeft: 40, fontWeight: 900, fontSize: 52, lineHeight: 1.02 }}>Blade Runner 2049</div>
				</div>
				<div style={{ display: "flex", gap: 24, marginTop: 72 }}>
					{[1, 2, 3, 4].map((i) => <Poster key={i} i={i} w={216} h={324} r={14} />)}
				</div>
				<div style={{ display: "flex", justifyContent: "space-between", marginTop: 88, paddingTop: 36, borderTop: "2px solid rgba(255,255,255,0.14)" }}>
					<div><div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 3 }}>CURATED BY</div><div style={{ fontSize: 38, fontWeight: 900, color: "#ffc53d" }}>@alper</div></div>
					<div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 3 }}>MAKE YOURS</div><div style={{ fontSize: 38, fontWeight: 900 }}>goodwatch.app</div></div>
				</div>
			</div>
		</div>
	)
}
function ReceiptMock({ b }: { b: BrandSystem }) {
	const line = (l: string, r: string) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}><span>{l}</span><span>{r}</span></div>
	const rule = <div style={{ borderTop: "3px dashed #1a1205", margin: "26px 0" }} />
	return (
		<div style={{ width: 1080, height: 1920, background: "radial-gradient(circle at 20% 10%, #ffc53d, #ff5a1f 55%)", fontFamily: "Space Mono", color: "#1a1205", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
			<div style={{ width: 780, background: "#fff4e6", padding: "56px 64px", transform: "rotate(-2.5deg)", boxShadow: "0 40px 60px rgba(18,8,4,0.35)" }}>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
					<b.Lockup size={58} tone="light" />
					<div style={{ fontSize: 26, letterSpacing: 8, marginTop: 20 }}>*** TASTE RECEIPT ***</div>
				</div>
				{rule}
				{line("DATE", "OCT 12, 2026")}
				{line("ORDER", "#052190")}
				{line("CURATOR", "@ALPER")}
				{rule}
				<div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.15 }}>MY TOP 5 MOVIES OF ALL TIME</div>
				{rule}
				<div style={{ display: "flex", flexDirection: "column", gap: 22 }}>{TITLES.map((t, i) => line(`0${i + 1} ${t.title.toUpperCase().slice(0, 17)}`, String(t.score)))}</div>
				{rule}
				{line("AVG GOODWATCH SCORE", "83")}
				<div style={{ fontSize: 26, fontWeight: 700, textAlign: "center", marginTop: 40 }}>MAKE YOURS AT GOODWATCH.APP</div>
			</div>
		</div>
	)
}
function BentoMock({ b }: { b: BrandSystem }) {
	const tile = { borderRadius: 32, overflow: "hidden", flexShrink: 0 } as const
	return (
		<div style={{ width: 1080, height: 1080, padding: 36, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18, background: "radial-gradient(circle at 85% 0%, rgba(255,90,31,0.28), rgba(255,90,31,0) 55%) #120804", fontFamily: "Gabarito", color: "#fff" }}>
			<div style={{ display: "flex", gap: 18, height: 610 }}>
				<div style={tile}><Poster i={0} w={420} h={610} r={0} /></div>
				<div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
					<div style={{ ...tile, flex: 1, background: "linear-gradient(145deg, #ff5a1f, #ffc53d)", color: "#120804", padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
						<div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>TOP 5</div>
						<div style={{ fontSize: 48, fontWeight: 900, lineHeight: 0.98, letterSpacing: -1.5 }}>My top 5 movies of all time</div>
					</div>
					<div style={{ ...tile, height: 250, background: `center / cover url("${tmdb("/8Tfys3mDZVp4tNoH2ktm06a0Tau.jpg", "w780")}") #1e3a5f` }} />
				</div>
			</div>
			<div style={{ display: "flex", gap: 18, flex: 1 }}>
				{[2, 3, 4].map((i) => <div key={i} style={{ ...tile, flex: 1 }}><Poster i={i} w="100%" h="100%" r={0} /></div>)}
				<div style={{ ...tile, width: 240, boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.14)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start" }}>
					{b.bento.top}
					<div><div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>CURATED BY</div><div style={{ fontSize: 26, fontWeight: 900, color: "#ffc53d" }}>@alper</div></div>
					<div>{b.bento.bottom}<div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>goodwatch.app</div></div>
				</div>
			</div>
		</div>
	)
}
function ShareCards({ b }: { b: BrandSystem }) {
	return (
		<Section n="06" name="Share cards: the shared Brand and Bento's tile" source="ui/share-card/kit.tsx (Brand, 14 designs) · designs/bento.tsx" today="amber G + white “GoodWatch” at weight 900 on dark cards, all ink on light cards. Bento alone draws an amber emblem and a white “GoodWatch” line apart, in one tile.">
			<div className="flex flex-wrap items-start gap-5">
				<div className="w-[270px]"><Cap>Dark card · Podium, story 1080×1920</Cap><Fit w={1080} h={1920}><PodiumMock b={b} /></Fit></div>
				<div className="w-[270px]"><Cap>Light card · Receipt, story 1080×1920</Cap><Fit w={1080} h={1920}><ReceiptMock b={b} /></Fit></div>
				<div className="w-[400px] max-w-full">
					<Cap>Bento · separate emblem and name tile, 1080×1080</Cap>
					<Fit w={1080} h={1080}><BentoMock b={b} /></Fit>
					<p className="mt-2 text-[12.5px] text-gray-300">{b.bento.note}</p>
					<Cap>The Brand at export size (size 52), dark and light</Cap>
					<div className="flex flex-wrap items-center gap-3 overflow-x-auto rounded-lg p-4" style={{ background: "#120804" }}><b.Lockup size={52} /></div>
					<div className="flex flex-wrap items-center gap-3 overflow-x-auto rounded-b-lg p-4" style={{ background: "#fff4e6" }}><b.Lockup size={52} tone="light" /></div>
				</div>
			</div>
			<p className="mt-3 text-[12.5px] text-gray-400">Representative mocks of the real hierarchy (Podium, Receipt, Bento), drawn in HTML. The other 11 designs take the same Brand at sizes 30 to 58. Not rendered through Satori.</p>
		</Section>
	)
}

// --- 07 Import walkthrough -------------------------------------------------------------------------------------
function ImportHeading({ b }: { b: BrandSystem }) {
	return (
		<Section n="07" name="Import walkthrough: the small GoodWatch section heading" source="ui/imports/howto/Scenes.tsx (UploadScene)" today="plain text “GoodWatch”, 12px semibold, gray.">
			<div className="flex h-[210px] w-[360px] max-w-full flex-col gap-2 rounded-lg bg-gray-950 p-3 ring-1 ring-white/10">
				<div className="flex h-12 shrink-0 items-center gap-1.5 rounded-md bg-gray-900 pl-16 pr-3 text-xs text-gray-400 ring-1 ring-white/10">⭳ Downloads</div>
				<div className="flex h-4 shrink-0 items-center px-1"><b.Small size={b.treatment === "badge" ? 12.5 : 11} /></div>
				<div className="flex min-h-0 flex-1 items-center gap-5 rounded-md border border-dashed border-emerald-400 bg-emerald-500/10 px-3">
					<span className="flex h-11 w-9 items-end justify-center rounded-sm bg-gray-100 pb-1.5 text-[9.5px] font-bold text-emerald-700">CSV</span>
					<span className="text-xs text-gray-300">ratings.csv<br /><span className="text-gray-500">Dropped. Ready to review.</span></span>
				</div>
			</div>
			<p className="mt-2 text-[12.5px] text-gray-400">Real size: the heading row is 16px high. This is the smallest wordmark in the app.</p>
		</Section>
	)
}

// --- 08 Decorative names and emblem-only companions ------------------------------------------------------------
function Decorative({ b }: { b: BrandSystem }) {
	const box = "flex h-[96px] items-center justify-center overflow-hidden rounded-lg px-4"
	const uses: { where: string; today: ReactNode; rule: string }[] = [
		{
			where: "Ceremony · line under the Brand",
			today: (
				<div className={`${box} flex-col gap-2.5 bg-[#0b0b0d]`}>
					<b.Lockup size={20} />
					<span style={{ fontFamily: "Gabarito", fontSize: 11, fontWeight: 700, letterSpacing: 4.5, color: "#a39b8b" }}>— THE GOODWATCH AWARDS 2026 —</span>
				</div>
			),
			rule: "The standard brand sits above. The awards line stays copy in the card's tracked capitals.",
		},
		{
			where: "Tickets · stub print",
			today: (
				<div className={`${box} bg-[#f5ead6]`}>
					<span style={{ fontFamily: "Space Mono", fontSize: 12, letterSpacing: 2, color: "#3a2a12", borderLeft: "2px dashed #3a2a12", paddingLeft: 12 }}>GOODWATCH CINEMA · MOVIE<br />ADMIT ONE · ROW 01</span>
				</div>
			),
			rule: "In-world print on a ticket. Stays copy.",
		},
		{
			where: "Film strip · edge print",
			today: (
				<div className={`${box} flex-col gap-1 bg-[#15100a]`}>
					<span style={{ fontFamily: "Space Mono", fontSize: 11, letterSpacing: 2, color: "#e8a23a" }}>{"GOODWATCH 5219  >  01A"}</span>
					<span className="flex gap-2">{Array.from({ length: 12 }, (_, i) => <i key={i} className="block h-3 w-4 rounded-[2px] bg-[#f3e9d6]" />)}</span>
				</div>
			),
			rule: "Kodak-style edge print. Stays copy.",
		},
		{
			where: "Trading cards · copyright",
			today: (
				<div className={`${box} bg-[#1a1420]`}>
					<span style={{ fontFamily: "Space Mono", fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.55)" }}>NO. 001 / 005 · SERIES 26 · © GOODWATCH</span>
				</div>
			),
			rule: "Legal small print in the card's own type. Stays copy.",
		},
	]
	return (
		<Section n="08" name="Decorative names and emblem-only companions" source="share-card/designs/{ceremony,tickets,filmstrip,trading}.tsx · TvScreens.tsx (Score) · MobileDock.tsx · Remote.tsx" today="uppercase GOODWATCH appears as costume print in four card designs; the bare G stands alone in score pills, the dock and on the remote.">
			<p className="mb-3 max-w-3xl text-[13.5px] text-gray-200">
				<b>Rule in this system:</b> the standard brand appears once per surface, as the signature. Every other mention is copy in that surface's own type. {b.decorative}
			</p>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{uses.map((u) => (
					<div key={u.where}>
						<Cap>{u.where}</Cap>
						{u.today}
						<div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-gray-400"><Chip>Stays contextual copy</Chip>{u.rule}</div>
					</div>
				))}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-white/[0.04] p-3 text-[12.5px] text-gray-400">
				<Chip tone="brand">Standard brand</Chip>
				<span>For comparison, the same awards line with the brand set into the sentence. Not proposed: a logo inside a sentence breaks the once-per-surface rule.</span>
				<span className="flex flex-wrap items-center gap-2 rounded bg-[#0b0b0d] px-3 py-2 text-[11px] font-bold tracking-[4.5px] text-[#a39b8b]">THE <b.Small size={12} /> AWARDS 2026</span>
			</div>

			<h3 className="mb-1 mt-7 text-[15px] font-bold text-white">Emblem-only companions <Chip tone="emblem">Emblem, not a wordmark</Chip></h3>
			<p className="mb-3 text-[12.5px] text-gray-400">These never spell the name, in any direction. Real size.</p>
			<div className="flex flex-wrap items-end gap-8">
				<div>
					<Cap>Score icons · 12px and 16px</Cap>
					<div className="flex items-center gap-2 rounded-lg bg-gray-800 p-3">
						<span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[15px] font-black tabular-nums text-white ring-1 ring-white/15"><b.Emblem size={12} />83</span>
						<span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-1 text-[20px] font-black tabular-nums text-white ring-1 ring-white/15"><b.Emblem size={16} />86</span>
					</div>
				</div>
				<div>
					<Cap>Dock G · 64px button, 24px emblem</Cap>
					<div className="flex h-[84px] w-[180px] items-center justify-center rounded-lg bg-gray-950 ring-1 ring-white/10">
						<span className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#4b5563,#111827_70%)] shadow-[0_0_0_1px_rgba(255,255,255,0.16)]">
							<b.Emblem size={24} />
							<small className="text-[9px] font-bold text-amber-400">Browse</small>
						</span>
					</div>
				</div>
				<div>
					<Cap>Remote grip · 28px emblem at 20%</Cap>
					<div className="flex h-[84px] w-[150px] items-end justify-center rounded-b-[40px] bg-gradient-to-b from-gray-800 to-gray-900 pb-3 ring-1 ring-white/10">
						<span className="opacity-20"><b.Emblem size={28} /></span>
					</div>
				</div>
				<div>
					<Cap>Emblem on a light background · 28px</Cap>
					<div className="flex h-[84px] w-[150px] items-center justify-center rounded-lg" style={{ background: "#fff4e6" }}><b.Emblem size={28} tone="light" /></div>
				</div>
			</div>
		</Section>
	)
}

// --- 09 Coverage -----------------------------------------------------------------------------------------------
function Coverage({ b }: { b: BrandSystem }) {
	const stacked = b.treatment === "badge"
	const rows = [
		["Main desktop header", "ui/main/Header.tsx", "Lockup"],
		["New navigation desktop header", "ui/navigation/SiteHeader.tsx", "Lockup"],
		["Phone header on Home", "ui/navigation/SiteHeader.tsx", "Lockup"],
		["Phone header away from Home, old header on phones", "SiteHeader.tsx · Header.tsx", "Emblem only"],
		["TV boot, desktop and phone", "ui/living-room/TvScreens.tsx", "Lockup, animated"],
		["Living-room caption", "ui/living-room/LivingRoom.tsx", stacked ? "One-line badge" : "Lockup"],
		["Phone landscape home link", "ui/living-room/PhoneLivingRoom.tsx", stacked ? "One-line badge, replaces the pill" : "Lockup in the pill"],
		["Open Graph images", "ui/og-image/parts.tsx", "Lockup, light rule on amber"],
		["Share cards, 14 designs", "ui/share-card/kit.tsx", "Lockup, light rule on light cards"],
		["Bento tile", "ui/share-card/designs/bento.tsx", b.treatment === "split" ? "Emblem + wordmark apart" : "One lockup"],
		["Import walkthrough heading", "ui/imports/howto/Scenes.tsx", stacked ? "One-line badge" : "Lockup"],
		["Decorative uppercase names", "share-card/designs/*", "Contextual copy, unchanged"],
		["Score icons, dock G, remote emblem", "TvScreens.tsx · MobileDock.tsx · Remote.tsx", "Emblem only"],
	]
	return (
		<Section n="09" name="Coverage" source="inventory of every drawn GoodWatch name" today="five different treatments across these files.">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] text-left text-[12.5px]">
					<thead className="text-gray-400"><tr><th className="py-1 pr-4 font-semibold">Placement</th><th className="py-1 pr-4 font-semibold">Source</th><th className="py-1 font-semibold">In {b.key} · {b.name}</th></tr></thead>
					<tbody>
						{rows.map(([place, source, form]) => (
							<tr key={place} className="border-t border-white/[0.07]"><td className="py-1.5 pr-4 text-gray-100">{place}</td><td className="rb-mono py-1.5 pr-4 text-[11.5px] text-gray-500">{source}</td><td className="py-1.5 text-amber-200">{form}</td></tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="mt-3 max-w-3xl text-[12.5px] text-gray-400">
				Not altered here: the older navigation prototypes (<span className="rb-mono">prototype-rec-nav</span>, <span className="rb-mono">prototype-watching-2</span>, <span className="rb-mono">prototype-watching-3</span>) and the duplicated card Brand in <span className="rb-mono">prototype-share-list</span>. They follow the selected system when it is folded into the real code.
			</p>
		</Section>
	)
}

// --- The page --------------------------------------------------------------------------------------------------
function Specimen({ b }: { b: BrandSystem }) {
	const light: [string, Tone][] = [["#fbbf24", "light"], ["#fff4e6", "light"], ["#ffffff", "light"]]
	return (
		<div className="min-w-0">
			<div className="flex min-h-[140px] items-center justify-center rounded-xl bg-black p-4">
				<Fit w={650} h={190}><div className="flex h-[190px] w-[650px] items-center justify-center"><b.Lockup size={72} /></div></Fit>
			</div>
			<div className="mt-3 grid grid-cols-3 gap-3">
				{light.map(([bg, tone]) => (
					<div key={bg} className="flex min-w-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: bg }}><Fit w={240} h={92}><div className="flex h-[92px] w-[240px] items-center justify-center"><b.Lockup size={24} tone={tone} /></div></Fit></div>
				))}
			</div>
			<Cap>Size ladder · G height today at each placement</Cap>
			<div className="flex flex-wrap items-end gap-x-6 gap-y-3 overflow-x-auto rounded-xl bg-gray-950 p-4 ring-1 ring-white/10">
				{[56, 28, 22].map((s) => <span key={s} className="flex flex-col items-start gap-1.5"><b.Lockup size={s} /><small className="rb-mono text-[10.5px] text-gray-500">{s}px</small></span>)}
				{[22, 16, 12].map((s) => <span key={`s${s}`} className="flex flex-col items-start gap-1.5"><b.Small size={s} /><small className="rb-mono text-[10.5px] text-gray-500">small {s}px</small></span>)}
				{[28, 16, 12].map((s) => <span key={`e${s}`} className="flex flex-col items-start gap-1.5"><b.Emblem size={s} /><small className="rb-mono text-[10.5px] text-gray-500">emblem {s}px</small></span>)}
			</div>
		</div>
	)
}

export function Review({ brand: b }: { brand: BrandSystem }) {
	return (
		<div className="rb-page px-4 pb-32 pt-6 sm:px-8">
			<CardFonts />
			<div className="mx-auto max-w-[1500px]">
				<div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
					<h1 className="text-[26px] font-extrabold text-white">GoodWatch wordmark · {b.key} · {b.name}</h1>
					<span className="rounded-full bg-fuchsia-500 px-3 py-1 text-[12px] font-bold text-white">PROTOTYPE · nothing is saved · production logos unchanged</span>
					<span className="basis-full text-[14px] text-gray-300">{b.line} <span className="text-gray-500">Switch with the pill below or the ← → keys. The site header above this page is today's.</span></span>
				</div>
				<div className="grid gap-6 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)]">
					<Specimen b={b} />
					<dl className="self-start rounded-xl bg-gray-950 p-4 text-[13px] ring-1 ring-white/10">
						<div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Spec · {b.key} <G h={12} color={WHITE} /> <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: YELLOW }} /></div>
						{b.spec.map((row) => (
							<div key={row.label} className="grid grid-cols-[112px_1fr] gap-2 border-t border-white/[0.07] py-2">
								<dt className="font-semibold text-gray-400">{row.label}</dt>
								<dd className="text-gray-100">{row.value}</dd>
							</div>
						))}
					</dl>
				</div>
				<Headers b={b} />
				<LivingRoom b={b} />
				<OgImages b={b} />
				<ShareCards b={b} />
				<ImportHeading b={b} />
				<Decorative b={b} />
				<Coverage b={b} />
			</div>
		</div>
	)
}
