// PROTOTYPE - throwaway. The phone edition of the TV screens (#224), round 1. On a phone the living room's TV
// is 360 to 450 px wide, so the 960 x 528 canvas prints at 0.37 to 0.47: about 5 px text. The owner decided
// phones get their own readable TV screens. The room is `sideways` (portrait couch, or the whole room turned
// sideways with ?force=landscape) and the flow is `ask`; useFlow's state and item keys are unchanged, so the
// remote drives every screen. Only the rendering changes. Four answers (?variant=):
//   small-canvas  existing components: a 440 x 242 phone canvas (about 1:1 sideways, 0.82 in portrait). One
//                 job per screen, 14 px minimum on the canvas (11.4 px at portrait scale), 4 px focus rings.
//                 Welcome is three short rows, Services a logo row that scrolls with the focus (name on focus),
//                 Moods two rows of chips that scroll, Tonight one big pick plus two posters, Title poster +
//                 title + score + two actions (the rest behind "More", opened when the focus reaches it), and
//                 the home Doors fold into the Bar as icons.
//   type-scale    existing components: the 960 layouts' structure on a 640 x 352 canvas with bigger type and
//                 fewer items (two cards per row, six services a page, no synopsis). How far a lighter touch gets.
//   focus-card    bolder: the TV shows pictures only (posters, backdrops, big titles); the focused item's words
//                 sit in a caption strip docked under the TV, in the page's own pixels (13 to 15 px), like a
//                 TV's info banner.
//   lean-in       bolder: small-canvas, and the camera leans in while you use the TV: the room scales (transform
//                 only) until the TV fills the width, then eases back after 5 s idle, on Back from home, or off.
// Keyboard and the search results: small-canvas has its own keyboard (type-scale shows it scaled up); the
// search results are still the desktop `Search` scaled into the canvas (not redone this round).
// Rendering budget (#190): only transform and opacity animate, nothing loops at idle, no blend or live blur.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-icon-250.png"
import { and } from "~/ui/prototype-rec-home/taste"
import { posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { MOOD, MOODS, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { GwBadge, Search, ease } from "./channels"
import { APP, APPS, Backdrop, Boot, Coin, ExitLayer, F, type FlowT, Fan, appLine, watchLine } from "./flow1"
import type { PhoneTvOpts } from "./phone1"
import { Icon } from "./r3"
import { SEARCH_PRESETS, type Tv4 } from "./r4"
import { SUGGESTIONS } from "./remote2"

export type PhoneTvVariant = "type-scale" | "type-scale-rows" | "type-scale-narrow" | "small-canvas" | "type-scale-r1" | "focus-card" | "lean-in"

export const PHONETV_VARIANTS: Record<PhoneTvVariant, { name: string; kind: "existing components" | "bolder" }> = {
	"type-scale": { name: "Type scale for portrait: 560 canvas, everything stays", kind: "existing components" },
	"type-scale-rows": { name: "Type scale, Welcome as rows, moods in six rows", kind: "existing components" },
	"type-scale-narrow": { name: "Type scale on a narrower 500 canvas, biggest type", kind: "existing components" },
	"small-canvas": { name: "Round 1: small canvas, one job per screen", kind: "existing components" },
	"type-scale-r1": { name: "Round 1: mid canvas, bigger type, fewer items", kind: "existing components" },
	"focus-card": { name: "Pictures on the TV, words under it", kind: "bolder" },
	"lean-in": { name: "The camera leans in", kind: "bolder" },
}

export const SMALL = { w: 440, h: 242 }
export const MID = { w: 640, h: 352 }
// Round 2 (#224): the portrait type-scale canvases. Text is 18 px minimum on the canvas.
export const TS: Record<"type-scale" | "type-scale-rows" | "type-scale-narrow", Cv> = {
	"type-scale": { w: 560, h: 308, rows: false },
	"type-scale-rows": { w: 560, h: 308, rows: true },
	"type-scale-narrow": { w: 500, h: 275, rows: false },
}
type Cv = { w: number; h: number; rows: boolean }
const tsOf = (v: PhoneTvVariant): Cv | null => (v in TS ? TS[v as keyof typeof TS] : null)

const ICONS = {
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	more: "M5 12h.01M12 12h.01M19 12h.01",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	picks: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
	check: "M5 12l5 5L20 7",
	eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	no: "M5 5l14 14M19 5L5 19",
	out: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
	play: "M7 4l13 8-13 8z",
	plus: "M12 5v14M5 12h14",
}

// ---------------------------------------------------------------------------------------------------------
// The slot: which screens the TV renders, plus what the room around it does (caption, lean).

export function phoneTvOpts(v: PhoneTvVariant): PhoneTvOpts {
	const ts = tsOf(v)
	if (ts) return { canvas: { w: ts.w, h: ts.h } }
	if (v === "type-scale-r1") return { canvas: MID }
	if (v === "focus-card") return { canvas: SMALL, gap: 92, below: (t, tv, box) => <Caption t={t as unknown as FlowT} tv={tv} box={box} /> }
	if (v === "lean-in") return { canvas: SMALL, lean: (t) => (t as unknown as { leaning?: boolean }).leaning ?? false }
	return { canvas: SMALL }
}

export function PhoneTvScreen({ t, v }: { t: FlowT; v: PhoneTvVariant }) {
	const s = t.scr
	const key = s.k === "title" ? `t-${s.key}` : s.k === "page" ? `p-${s.id}` : s.k
	const ts = tsOf(v)
	const mid = v === "type-scale-r1" || !!ts
	const cw = ts ? ts.w : mid ? MID.w : SMALL.w
	const pic = v === "focus-card"
	const body = () => {
		if (s.k === "boot") return <Boot />
		if (s.k === "keyboard") return mid ? <Up k={cw / SMALL.w}><SKeyboard t={t} /></Up> : <SKeyboard t={t} />
		if (s.k === "search") return t.query ? <Up k={cw / 960}><Search queries={SUGGESTIONS} fixed={t.query} /></Up> : null
		if (ts) return <TsScreen t={t} c={ts} />
		if (mid) return <MidScreen t={t} />
		if (pic) return <PicScreen t={t} />
		return <SmallScreen t={t} />
	}
	return (
		<div data-flow-screen className="absolute inset-0 overflow-hidden bg-[#07080b] text-white">
			<AnimatePresence initial={false}>
				<motion.div key={key} className="absolute inset-0" initial={{ opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease }}>
					{body()}
				</motion.div>
			</AnimatePresence>
			{s.k !== "boot" && (ts ? <TsBar t={t} /> : mid ? <MidBar t={t} /> : <SBar t={t} />)}
			<AnimatePresence>
				{t.note && (
					<motion.div
						key={t.note.id}
						className={`absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 font-semibold text-black shadow-2xl ${ts ? "bottom-3 px-4 py-1.5 text-[18px]" : mid ? "bottom-4 px-5 py-2 text-[20px]" : "bottom-3 px-4 py-1.5 text-[15px]"}`}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
					>
						{t.note.text}
					</motion.div>
				)}
			</AnimatePresence>
			{t.exit && typeof document !== "undefined" && createPortal(<ExitLayer t={t} />, document.body)}
		</div>
	)
}

// Render something laid out for a smaller canvas, scaled up (or the desktop's, scaled down).
function Up({ k, children }: { k: number; children: ReactNode }) {
	return (
		<div className="absolute left-0 top-0 origin-top-left" style={{ width: `${100 / k}%`, height: `${100 / k}%`, transform: `scale(${k})` }}>
			{children}
		</div>
	)
}

/** The lean-in camera: in while the TV is in use, out after 5 s idle, on Back at home, or when it is off. */
export function useLean(t: FlowT) {
	const [on, setOn] = useState(false)
	const first = useRef(t.pulse)
	useEffect(() => {
		if (t.pulse === first.current || !t.on) return
		setOn(true)
		const id = setTimeout(() => setOn(false), 5000)
		return () => clearTimeout(id)
	}, [t.pulse, t.on])
	useEffect(() => {
		if (!t.on) setOn(false)
	}, [t.on])
	const back = () => {
		if (t.scr.k === "home" && !t.menu) setOn(false)
		t.back()
	}
	return { leaning: on, back }
}

// ---------------------------------------------------------------------------------------------------------
// Shared bits for the 440 x 242 canvas. 14 px minimum on the canvas; the focus ring is 4 px (3.3 px portrait).

function P(props: Parameters<typeof F>[0]) {
	return <F ring="ring-4" off="ring-transparent bg-white/[0.07]" scale={1.03} {...props} />
}

function SHead({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: ReactNode }) {
	return (
		<div className="absolute left-4 right-[132px] top-2.5 flex items-baseline gap-2">
			{eyebrow && <span className="shrink-0 text-[14px] font-bold text-amber-300/90">{eyebrow}</span>}
			<span className="truncate text-[19px] font-extrabold leading-tight tracking-tight">{title}</span>
			{right}
		</div>
	)
}

// Keep the focused item of a horizontal strip in view: translate the strip (transform only).
function useStrip(t: FlowT, values: string[], itemW: number, viewW: number) {
	const i = Math.max(0, values.indexOf(t.focused))
	const total = values.length * itemW
	return -Math.max(0, Math.min(total - viewW, i * itemW - viewW / 2 + itemW / 2))
}

function Strip({ x, children, className = "" }: { x: number; children: ReactNode; className?: string }) {
	return (
		<motion.div className={`flex ${className}`} initial={false} animate={{ x }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
			{children}
		</motion.div>
	)
}

function Pill({ t, v, children, primary, className = "" }: { t: FlowT; v: string; children: ReactNode; primary?: boolean; className?: string }) {
	return primary ? (
		<P t={t} v={v} className={`rounded-full px-4 py-1.5 text-[15px] font-bold ${className}`} on="ring-amber-300 bg-amber-400 text-black" off="ring-transparent bg-amber-400/90 text-black">
			{children}
		</P>
	) : (
		<P t={t} v={v} className={`rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${className}`}>
			{children}
		</P>
	)
}

// ---------------------------------------------------------------------------------------------------------
// small-canvas (and lean-in).

function SmallScreen({ t }: { t: FlowT }) {
	const s = t.scr
	if (s.k === "home") return t.member ? <SMoods t={t} home /> : <SWelcome t={t} />
	if (s.k === "about") return <SAbout t={t} />
	if (s.k === "services") return <SServices t={t} />
	if (s.k === "duel") return <SDuel t={t} />
	if (s.k === "moods") return <SMoods t={t} />
	if (s.k === "from") return <SFrom t={t} />
	if (s.k === "tonight") return <STonight t={t} />
	if (s.k === "title") return <STitle t={t} k={s.key} />
	if (s.k === "page") return <SApp t={t} id={s.id} />
	return null
}

function SWelcome({ t }: { t: FlowT }) {
	const p = t.h.picks
	const rows: { v: string; label: string; line: string; art: ReactNode }[] = [
		{ v: "go:services", label: "Find my tonight", line: "3 quick questions", art: <Thumbs xs={p.slice(3, 5)} heart /> },
		{ v: "go:quick", label: "Just show me", line: "Best rated now", art: <Thumbs xs={p.slice(0, 2)} /> },
		{ v: "go:about", label: "What is GoodWatch?", line: "One score, where it streams", art: <GwBadge gw={85} size={30} text="text-[18px]" /> },
	]
	return (
		<>
			<Backdrop t={p[0]} dim={0.14} />
			<SHead title="What's tonight?" />
			<div className="absolute inset-x-4 top-[44px] flex flex-col gap-2">
				{rows.map((r) => (
					<P key={r.v} t={t} v={r.v} className="flex h-[56px] items-center gap-3 rounded-2xl px-3">
						<span className="flex w-[62px] shrink-0 justify-center">{r.art}</span>
						<span className="min-w-0 flex-1 truncate text-[18px] font-extrabold">{r.label}</span>
						<span className="shrink-0 text-[14px] text-white/55">{r.line}</span>
					</P>
				))}
			</div>
		</>
	)
}

function Thumbs({ xs, heart, h = 44 }: { xs: WTitle[]; heart?: boolean; h?: number }) {
	return (
		<span className="relative flex -space-x-3">
			{xs.map((x, i) => (
				<img key={x.key} src={posterUrl(x, "w92")} alt="" className="rounded-md object-cover shadow-lg ring-1 ring-black/60" style={{ height: h, width: (h * 2) / 3, transform: `rotate(${(i - 0.5) * 8}deg)` }} />
			))}
			{heart && <span className="absolute -right-2 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[14px] leading-none text-black">♥</span>}
		</span>
	)
}

function SAbout({ t }: { t: FlowT }) {
	const d = t.h.picks[0]
	const facts: { art: ReactNode; title: string; line: string }[] = [
		{ art: <GwBadge gw={d?.score ?? 85} size={26} text="text-[16px]" />, title: "One score", line: "IMDb, RT and Metacritic" },
		{ art: <span className="text-[18px]">⚡❤️😂</span>, title: "How it feels", line: "Energy, heart, humor" },
		{
			art: (
				<span className="flex gap-1">
					{t.h.data.catalog.slice(0, 3).map((c) => (
						<img key={c.name} src={c.logo} alt="" className="h-6 w-6 rounded-md" />
					))}
				</span>
			),
			title: "Where it streams",
			line: "Your services first",
		},
	]
	return (
		<>
			<SHead title="What is GoodWatch?" />
			<div className="absolute inset-x-4 top-[42px] flex flex-col gap-1.5">
				{facts.map((f) => (
					<div key={f.title} className="flex h-[40px] items-center gap-3 rounded-xl bg-white/[0.04] px-3">
						<span className="flex w-[84px] shrink-0">{f.art}</span>
						<span className="text-[16px] font-bold">{f.title}</span>
						<span className="ml-auto truncate text-[14px] text-white/55">{f.line}</span>
					</div>
				))}
			</div>
			<div className="absolute bottom-3 left-4 flex gap-2.5">
				<Pill t={t} v="go:services" primary>
					Find my tonight
				</Pill>
				<Pill t={t} v="go:quick">Just show me</Pill>
			</div>
		</>
	)
}

function SServices({ t }: { t: FlowT }) {
	const h = t.h
	const cat = h.data.catalog.slice(0, 12)
	const vals = cat.map((c) => `svc:${c.name}`)
	const x = useStrip(t, vals, 76, 408)
	const f = cat.find((c) => t.isFocus(`svc:${c.name}`))
	return (
		<>
			<SHead eyebrow="1/3" title="Where do you watch?" />
			<div className="absolute inset-x-4 top-[50px] overflow-visible">
				<div className="overflow-hidden px-1 py-2">
					<Strip x={x} className="gap-3">
						{cat.map((c) => {
							const on = h.mine.includes(c.name)
							return (
								<P key={c.name} t={t} v={`svc:${c.name}`} className="h-[64px] w-[64px] shrink-0 rounded-[16px] !p-0" off={on ? "ring-green-500 bg-transparent" : "ring-transparent bg-transparent"} on={on ? "ring-green-300 bg-transparent" : "ring-amber-300 bg-transparent"} scale={1.08}>
									<img src={c.logo} alt="" className="h-full w-full rounded-[14px]" />
									{on && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[14px] font-black text-black">✓</span>}
								</P>
							)
						})}
					</Strip>
				</div>
			</div>
			<div className="absolute inset-x-4 top-[140px] h-[22px] text-[16px] font-bold">
				{f ? (
					<>
						{f.name} <span className="font-normal text-white/55">{h.mine.includes(f.name) ? "· yours" : "· OK to add"}</span>
					</>
				) : (
					<span className="font-normal text-white/55">{h.mine.length ? `${h.mine.length} picked` : "Pick every one you have"}</span>
				)}
			</div>
			<div className="absolute bottom-3 left-4">
				<Pill t={t} v="go:duel" primary>
					{h.mine.length ? `Continue with ${h.mine.length}` : "Continue without"}
				</Pill>
			</div>
		</>
	)
}

function Dots({ at, of, className = "" }: { at: number; of: number; className?: string }) {
	return (
		<span className={`flex items-center gap-1 ${className}`}>
			{Array.from({ length: of }, (_, i) => (
				<span key={i} className={`h-1.5 rounded-full ${i < at ? "w-4 bg-amber-400" : i === at ? "w-4 bg-white/60" : "w-2 bg-white/20"}`} />
			))}
		</span>
	)
}

function SDuel({ t }: { t: FlowT }) {
	const h = t.h
	const i = t.pairAt()
	const p = h.data.pairs[i]
	if (!p) return null
	const side = (k: string, s: "a" | "b", label: string) => {
		const x = h.T(k)
		if (!x) return null
		return (
			<P t={t} v={`duel:${s}`} className="flex w-[180px] items-center gap-2.5 rounded-2xl p-1.5" scale={1.04}>
				<img src={posterUrl(x, "w185")} alt="" className="h-[118px] w-[79px] shrink-0 rounded-lg object-cover" />
				<span className="line-clamp-4 text-[16px] font-extrabold leading-tight">{label}</span>
			</P>
		)
	}
	return (
		<>
			<Backdrop t={h.T(p.a)} dim={0.1} />
			<SHead eyebrow="2/3" title="Which one tonight?" right={<Dots at={h.answers.length} of={h.data.pairs.length} className="ml-auto self-center" />} />
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} className="absolute inset-x-4 top-[44px] flex items-center justify-between" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
					{side(p.a, "a", p.left)}
					<span className="text-[15px] font-bold text-white/40">or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-2.5 left-4 flex items-center gap-2.5">
				<Pill t={t} v="duel:skip">Skip</Pill>
				{t.answered >= 3 ? (
					<Pill t={t} v="duel:done" primary>
						♥ Show my picks
					</Pill>
				) : (
					<span className="text-[14px] text-white/50">{3 - t.answered} more for your picks</span>
				)}
			</div>
		</>
	)
}

function SMoods({ t, home }: { t: FlowT; home?: boolean }) {
	const vals = ["mood:any", ...MOODS.map((m) => `mood:${m.key}`)]
	// Two rows, filled column by column, so the wheel walks down then across and the strip follows the column.
	const col = Math.floor(Math.max(0, vals.indexOf(t.focused)) / 2)
	const cols = Math.ceil(vals.length / 2)
	const W = 142
	const x = -Math.max(0, Math.min(cols * W - 408, col * W - 408 / 2 + W / 2))
	const chip = (v: string, name: string, hue: string, n: number | null) => (
		<P key={v} t={t} v={v} className="flex h-[52px] w-[132px] items-center gap-2.5 rounded-2xl px-3">
			<span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: hue }} />
			<span className="min-w-0 flex-1 truncate text-[16px] font-bold">{name}</span>
			{n != null && <span className={`text-[14px] tabular-nums ${n ? "text-white/60" : "text-white/30"}`}>{n}</span>}
		</P>
	)
	const hour = new Date().getHours()
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<SHead title="What kind of night?" />
			{t.member && <div className="absolute left-4 top-[36px] text-[14px] text-white/50">{home ? (hour < 18 ? "Good day." : "Good evening.") : ""} Numbers: fits on your Wishlist</div>}
			<div className="absolute inset-x-4 top-[64px] overflow-hidden py-1.5">
				<Strip x={x}>
					<div className="grid grid-flow-col grid-rows-2 gap-2.5 px-1">
						{chip("mood:any", "Any mood", "rgba(255,255,255,0.6)", null)}
						{MOODS.map((m) => chip(`mood:${m.key}`, m.name, m.hue, t.member ? t.moodCount(m.key) : null))}
					</div>
				</Strip>
			</div>
			<div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 text-[14px] text-white/50">
				<span className="flex gap-1">
					{Array.from({ length: cols }, (_, i) => (
						<span key={i} className={`h-1.5 w-1.5 rounded-full ${i === col ? "bg-white/80" : "bg-white/20"}`} />
					))}
				</span>
				{home ? "Watch now, Taste and more: top right" : "Turn for more moods"}
			</div>
		</>
	)
}

function SFrom({ t }: { t: FlowT }) {
	const h = t.h
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const newArt = h.picks.filter((x) => !t.night.mood || (h.data.extra[x.key]?.m ?? []).includes(t.night.mood as never))
	const row = (v: string, title: string, line: string, art: WTitle[]) => (
		<P t={t} v={v} className="flex h-[76px] items-center gap-3 rounded-2xl px-3">
			<span className="flex w-[70px] shrink-0 justify-center">
				<Thumbs xs={art.slice(0, 2)} h={54} />
			</span>
			<span className="min-w-0">
				<span className="block text-[19px] font-extrabold leading-tight">{title}</span>
				<span className="block truncate text-[14px] text-white/55">{line}</span>
			</span>
		</P>
	)
	return (
		<>
			<SHead title={mood ? `${mood}. From where?` : "From where?"} />
			<div className="absolute inset-x-4 top-[46px] flex flex-col gap-2.5">
				{row("from:wish", "From my Wishlist", t.wish.length ? `${t.wish.length} fit, best match first` : "Nothing there fits", t.wish)}
				{row("from:new", "Something new", "Not seen, closest to your taste", newArt)}
			</div>
		</>
	)
}

function STonight({ t }: { t: FlowT }) {
	const h = t.h
	const [a, ...rest] = t.options
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const from = t.source === "wish" ? "Wishlist" : t.member ? "New to you" : h.hasTaste ? "For your answers" : "Best rated"
	return (
		<>
			<Backdrop t={a} dim={0.26} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
			<SHead title="Here's tonight." right={<span className="truncate text-[14px] text-white/55">{[from, mood, t.svc].filter(Boolean).join(" · ")}</span>} />
			{!a && <div className="absolute left-4 top-[60px] text-[16px] text-white/60">Nothing fits. Try another mood.</div>}
			<div className="absolute left-4 right-4 top-[40px] flex items-start gap-2.5">
				{a && (
					<P t={t} v={`t:${a.key}`} className="flex w-[244px] gap-2.5 rounded-2xl p-1.5">
						<img src={posterUrl(a, "w185")} alt="" className="h-[132px] w-[88px] shrink-0 rounded-lg object-cover" />
						<span className="min-w-0 py-0.5">
							<span className="line-clamp-2 block text-[18px] font-extrabold leading-tight">{a.title}</span>
							<span className="mt-1.5 flex items-center gap-2">
								<GwBadge gw={a.score} size={22} text="text-[16px]" />
								<Coin t={a} className="!text-[14px]" />
							</span>
							<span className="mt-1.5 line-clamp-2 block text-[14px] leading-snug text-white/60">{watchLine(a).text}</span>
						</span>
					</P>
				)}
				{rest.map((x) => (
					<P key={x.key} t={t} v={`t:${x.key}`} className="w-[70px] shrink-0 rounded-xl p-1" scale={1.06}>
						<img src={posterUrl(x, "w154")} alt="" className="h-[93px] w-full rounded-lg object-cover" />
						{x.match != null && <Coin t={x} className="absolute -bottom-1 left-1/2 -translate-x-1/2 !px-1.5 !text-[14px]" />}
					</P>
				))}
			</div>
			<div className="absolute bottom-2.5 left-4 flex items-center gap-2">
				<Pill t={t} v="go:moods">{mood ? `Mood: ${mood}` : "Mood"}</Pill>
				{t.member ? (
					<Pill t={t} v="night:switch">{t.source === "wish" ? "Something new" : "My Wishlist"}</Pill>
				) : (
					<P t={t} v={t.answered ? "go:duel" : "go:services"} className="rounded-full px-3.5 py-1.5 text-[15px] font-bold text-amber-200" on="ring-amber-300 bg-amber-400/20" off="ring-transparent bg-amber-400/10">
						{t.answered ? "♥ Refine" : "♥ Make it mine"}
					</P>
				)}
			</div>
		</>
	)
}

function STitle({ t, k }: { t: FlowT; k: string }) {
	const h = t.h
	const x = h.T(k)
	if (!x) return null
	const w = watchLine(x)
	const want = h.q.inQueue(x.key)
	const more = [`seen:${x.key}`, `no:${x.key}`, `exit:title:${x.key}`]
	const open = more.includes(t.focused)
	return (
		<>
			<Backdrop t={x} dim={0.4} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
			<div className="absolute left-4 top-3 flex gap-3.5">
				<img src={posterUrl(x, "w185")} alt="" className="h-[150px] w-[100px] rounded-xl object-cover shadow-2xl ring-1 ring-white/10" />
				<div className="w-[180px] pt-0.5">
					<div className="line-clamp-2 text-[21px] font-extrabold leading-tight">{x.title}</div>
					<div className="mt-1 text-[14px] text-white/55">{[x.year, runtimeLabel(x)].filter(Boolean).join(" · ")}</div>
					<div className="mt-2 flex items-center gap-2.5">
						<GwBadge gw={x.score} size={26} text="text-[18px]" />
						{x.match != null && <Coin t={x} className="!text-[14px]" />}
					</div>
				</div>
			</div>
			<div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
				<P t={t} v={`watch:${x.key}`} className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
					{w.offer?.logo && <img src={w.offer.logo} alt="" className="h-5 w-5 rounded" />}
					{w.owned ? "Watch" : w.offer ? `On ${w.offer.name}` : "Not streaming"}
				</P>
				<Pill t={t} v={`want:${x.key}`}>{want ? "✓ Wishlist" : "Want to See"}</Pill>
				{/* The rest behind More: it opens when the focus reaches it. */}
				{open ? (
					<>
						<Pill t={t} v={`seen:${x.key}`}>Seen</Pill>
						<Pill t={t} v={`no:${x.key}`}>Not for me</Pill>
						<Pill t={t} v={`exit:title:${x.key}`}>↗</Pill>
					</>
				) : (
					<P t={t} v={`seen:${x.key}`} className="rounded-full px-3.5 py-1.5 text-[15px] font-semibold text-white/80">
						More
					</P>
				)}
			</div>
		</>
	)
}

function SApp({ t, id }: { t: FlowT; id: string }) {
	const h = t.h
	const a = APP[id as keyof typeof APP]
	const pid = id as (typeof APPS)[number]
	const locked = !t.member && id === "watchnext"
	const xs = h.watchNext.slice(0, 6)
	const x = useStrip(t, xs.map((w) => `t:${w.key}`), 82, 408)
	return (
		<>
			<div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 20% 0%, ${a.tint}33 0%, #07080b 60%)` }} />
			<div className="absolute left-4 right-[132px] top-2.5 flex items-center gap-2">
				<span style={{ color: a.tint }}>
					<Icon d={a.d} className="h-6 w-6" />
				</span>
				<span className="text-[20px] font-extrabold">{a.name}</span>
			</div>
			<div className="absolute inset-x-4 top-[42px] line-clamp-2 text-[15px] leading-snug text-white/65">{locked ? "With a free account, this is your Wishlist, best match first." : appLine(t, pid)}</div>
			{id === "watchnext" && t.member && (
				<div className="absolute inset-x-4 top-[84px] overflow-hidden py-1">
					<Strip x={x} className="gap-2.5 px-1">
						{xs.map((w) => (
							<P key={w.key} t={t} v={`t:${w.key}`} className="w-[72px] shrink-0 rounded-xl p-1" scale={1.06}>
								<img src={posterUrl(w, "w154")} alt="" className="h-[96px] w-full rounded-lg object-cover" />
							</P>
						))}
					</Strip>
				</div>
			)}
			{!locked && (
				<div className="absolute bottom-3 left-4">
					<Pill t={t} v={`exit:page:${id}`} primary>
						Open {a.name} ↗
					</Pill>
				</div>
			)}
		</>
	)
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]

function SKeyboard({ t }: { t: FlowT }) {
	const tv = t as unknown as Tv4
	useEffect(() => {
		const on = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return
			if (e.key === "Backspace") tv.setDraft((d) => d.slice(0, -1))
			else if (e.key === "Enter") tv.submit()
			else if (e.key.length === 1) tv.setDraft((d) => (d + e.key).slice(0, 120))
			else return
			e.preventDefault()
			e.stopPropagation()
		}
		window.addEventListener("keydown", on, true)
		return () => window.removeEventListener("keydown", on, true)
	})
	const key = "flex h-[30px] items-center justify-center rounded-lg bg-white/[0.08] text-[15px] font-semibold ring-1 ring-white/10"
	return (
		<div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,#0b2a28_0%,#05080a_60%)]">
			<div className="absolute left-4 right-[132px] top-2 flex h-[32px] items-center gap-2 rounded-xl bg-white/[0.07] px-3 ring-1 ring-white/15">
				<Icon d={ICONS.search} className="h-4 w-4 shrink-0 text-teal-300" />
				<span className="truncate text-[15px]">{t.draft || <span className="text-white/40">What do you feel like?</span>}</span>
			</div>
			<div className="absolute inset-x-4 top-[46px] flex gap-2 overflow-hidden">
				{SEARCH_PRESETS.slice(0, 2).map((q, i) => (
					<button key={q} type="button" data-pick={`preset:${i}`} className="min-w-0 flex-1 truncate rounded-lg bg-teal-400/10 px-2.5 py-1 text-left text-[14px] text-teal-100 ring-1 ring-teal-300/25">
						{q}
					</button>
				))}
			</div>
			<div className="absolute inset-x-3 bottom-2.5 flex flex-col items-center gap-1.5">
				{ROWS.map((row) => (
					<div key={row} className="flex gap-1.5">
						{[...row].map((c) => (
							<button key={c} type="button" data-pick={`key:${c}`} className={`${key} w-[37px] uppercase`}>
								{c}
							</button>
						))}
					</div>
				))}
				<div className="flex gap-1.5">
					<button type="button" data-pick="key:del" className={`${key} w-[80px]`}>
						Delete
					</button>
					<button type="button" data-pick="key:space" className={`${key} w-[160px]`}>
						Space
					</button>
					<button type="button" data-pick="key:go" className={`${key} w-[80px] !bg-teal-400 font-bold text-black`}>
						Search
					</button>
				</div>
			</div>
		</div>
	)
}

// The on-screen bar, for the small canvas: Back and Home away from home, Search, More. On the member home the
// Doors (Watch now, Taste, Discover, Explorer) fold in here as icons; they keep their `page:` keys, so the
// wheel still reaches them after the moods.
function SBar({ t }: { t: FlowT }) {
	const atHome = t.scr.k === "home"
	const doors = atHome && t.member
	const btn = (k: string, d: string, label: string, on?: boolean) => (
		<button key={k} type="button" data-pick={`bar:${k}`} aria-label={label} title={label} className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/50 text-white/85 ring-1 ring-white/10"}`}>
			<Icon d={d} className="h-4 w-4" />
		</button>
	)
	const item = (pick: string, d: string, label: string, tint?: string) => (
		<button key={pick} type="button" data-pick={pick} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-left text-[15px] font-medium text-white/90">
			<span style={tint ? { color: tint } : undefined}>
				<Icon d={d} className="h-4 w-4 opacity-80" />
			</span>
			{label}
		</button>
	)
	return (
		<div className="absolute right-2.5 top-2 z-20 flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-1.5">
				{doors &&
					APPS.map((a) => (
						<F key={a} t={t} v={`page:${a}`} ring="ring-4" className="flex h-[30px] w-[30px] items-center justify-center rounded-full" on="ring-amber-300 bg-white/15" off="ring-white/10 bg-black/50" scale={1.1}>
							<span style={{ color: APP[a].tint }}>
								<Icon d={APP[a].d} className="h-4 w-4" />
							</span>
						</F>
					))}
				{doors && <span className="mx-0.5 h-4 w-px bg-white/20" />}
				{!atHome && btn("back", ICONS.back, "Back")}
				{!atHome && btn("home", ICONS.home, "Home")}
				{!doors && btn("search", ICONS.search, "Search", t.scr.k === "keyboard")}
				{btn("more", ICONS.more, "More", t.menu)}
			</div>
			<AnimatePresence>
				{t.menu && (
					<motion.div className="flex w-[170px] flex-col rounded-xl bg-[#0c0e12]/95 p-1 ring-1 ring-white/10" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
						{doors && item("bar:search", ICONS.search, "Search")}
						{item("bar:mood", ICONS.mood, "Mood", "#fbbf24")}
						{!doors && APPS.map((a) => item(`bar:page:${a}`, APP[a].d, APP[a].name, APP[a].tint))}
						{item("bar:picks", ICONS.picks, "Pick for me", "#fb923c")}
						{item("bar:power", ICONS.power, "Turn off")}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// type-scale: the 960 layouts' structure on 640 x 352, type up, fewer items. 18 px minimum on the canvas.

function MidScreen({ t }: { t: FlowT }) {
	const s = t.scr
	if (s.k === "home") return t.member ? <MMoods t={t} home /> : <MWelcome t={t} />
	if (s.k === "about") return <MAbout t={t} />
	if (s.k === "services") return <MServices t={t} />
	if (s.k === "duel") return <MDuel t={t} />
	if (s.k === "moods") return <MMoods t={t} />
	if (s.k === "from") return <MFrom t={t} />
	if (s.k === "tonight") return <MTonight t={t} />
	if (s.k === "title") return <MTitle t={t} k={s.key} />
	if (s.k === "page") return <MApp t={t} id={s.id} />
	return null
}

function MHead({ title, line, eyebrow }: { title: string; line?: ReactNode; eyebrow?: string }) {
	return (
		<div className="absolute left-8 right-[190px] top-5">
			{eyebrow && <div className="mb-0.5 text-[18px] font-bold text-amber-300/85">{eyebrow}</div>}
			<div className="text-[30px] font-extrabold leading-none tracking-tight">{title}</div>
			{line && <div className="mt-1.5 truncate text-[18px] text-white/60">{line}</div>}
		</div>
	)
}

function M(props: Parameters<typeof F>[0]) {
	return <F ring="ring-[5px]" {...props} />
}

function MPill({ t, v, children, primary }: { t: FlowT; v: string; children: ReactNode; primary?: boolean }) {
	return primary ? (
		<M t={t} v={v} className="rounded-full px-5 py-2 text-[20px] font-bold" on="ring-amber-300 bg-amber-400 text-black" off="ring-transparent bg-amber-400/90 text-black">
			{children}
		</M>
	) : (
		<M t={t} v={v} className="rounded-full px-5 py-2 text-[20px] font-semibold">
			{children}
		</M>
	)
}

function MWelcome({ t }: { t: FlowT }) {
	const p = t.h.picks
	return (
		<>
			<Backdrop t={p[0]} dim={0.18} />
			<MHead title="Something good tonight?" />
			<div className="absolute inset-x-8 top-[76px] grid grid-cols-2 gap-5">
				{[
					{ v: "go:services", label: "Find my tonight", art: <Fan posters={p.slice(3, 6)} heart /> },
					{ v: "go:quick", label: "Just show me", art: <Fan posters={p.slice(0, 3)} /> },
				].map((c) => (
					<M key={c.v} t={t} v={c.v} className="flex flex-col overflow-hidden rounded-3xl">
						<div className="relative h-[150px] w-full">{c.art}</div>
						<div className="px-5 pb-3 text-[24px] font-extrabold leading-tight">{c.label}</div>
					</M>
				))}
			</div>
			<div className="absolute bottom-5 left-8">
				<MPill t={t} v="go:about">
					What is GoodWatch?
				</MPill>
			</div>
		</>
	)
}

function MAbout({ t }: { t: FlowT }) {
	const d = t.h.picks[0]
	const fact = (title: string, art: ReactNode) => (
		<div className="flex flex-col items-center rounded-3xl bg-white/[0.04] pb-3 ring-1 ring-white/5">
			<div className="flex h-[112px] items-center justify-center">{art}</div>
			<div className="text-[20px] font-extrabold">{title}</div>
		</div>
	)
	return (
		<>
			<MHead title="What is GoodWatch?" />
			<div className="absolute inset-x-8 top-[72px] grid grid-cols-3 gap-4">
				{fact(
					"One score",
					<div className="flex items-center gap-2">
						<div className="flex flex-col gap-1 opacity-80">
							{[imdbLogo, rottenLogo, metacriticLogo].map((s) => (
								<img key={s} src={s} alt="" className="h-5 w-5 object-contain" />
							))}
						</div>
						<span className="text-[20px] text-white/40">→</span>
						<GwBadge gw={d?.score ?? 85} size={40} text="text-[28px]" />
					</div>,
				)}
				{fact("How it feels", <span className="text-[34px]">⚡❤️😂</span>)}
				{fact(
					"Where it streams",
					<div className="grid grid-cols-3 gap-1.5">
						{t.h.data.catalog.slice(0, 6).map((c) => (
							<img key={c.name} src={c.logo} alt="" className="h-9 w-9 rounded-lg" />
						))}
					</div>,
				)}
			</div>
			<div className="absolute bottom-5 left-8 flex gap-3">
				<MPill t={t} v="go:services" primary>
					Find my tonight
				</MPill>
				<MPill t={t} v="go:quick">
					Just show me
				</MPill>
			</div>
		</>
	)
}

function MServices({ t }: { t: FlowT }) {
	const h = t.h
	const cat = h.data.catalog.slice(0, 12)
	// Six a page: the page follows the focus (the wheel still walks all twelve).
	const fi = cat.findIndex((c) => t.isFocus(`svc:${c.name}`))
	const [page, setPage] = useState(0)
	useEffect(() => {
		if (fi >= 0) setPage(Math.floor(fi / 6))
	}, [fi])
	const shown = cat.slice(page * 6, page * 6 + 6)
	return (
		<>
			<MHead eyebrow="1 of 3" title="Where do you watch?" line={`Page ${page + 1} of ${Math.ceil(cat.length / 6)}. Turn for more.`} />
			<div className="absolute inset-x-8 top-[110px] grid grid-cols-3 gap-3">
				{shown.map((c) => {
					const on = h.mine.includes(c.name)
					return (
						<M key={c.name} t={t} v={`svc:${c.name}`} className="flex h-[64px] items-center gap-3 rounded-2xl pr-3" off={on ? "ring-green-500 bg-green-500/10" : "ring-white/5 bg-white/[0.04]"} on={on ? "ring-green-400 bg-green-500/20" : "ring-amber-300 bg-white/[0.10]"}>
							<img src={c.logo} alt="" className="h-[60px] w-[60px] rounded-[14px]" />
							<span className="truncate text-[19px] font-semibold">{c.name}</span>
							{on && <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-[18px] font-black text-black">✓</span>}
						</M>
					)
				})}
			</div>
			<div className="absolute bottom-5 left-8">
				<MPill t={t} v="go:duel" primary>
					{h.mine.length ? `Continue with ${h.mine.length}` : "Continue without"}
				</MPill>
			</div>
		</>
	)
}

function MDuel({ t }: { t: FlowT }) {
	const h = t.h
	const i = t.pairAt()
	const p = h.data.pairs[i]
	if (!p) return null
	const side = (k: string, s: "a" | "b", label: string) => {
		const x = h.T(k)
		if (!x) return null
		return (
			<M t={t} v={`duel:${s}`} className="flex w-[250px] items-center gap-3 rounded-3xl p-2.5" scale={1.04}>
				<img src={posterUrl(x, "w185")} alt="" className="h-[150px] w-[100px] rounded-xl object-cover" />
				<div className="text-[22px] font-extrabold leading-tight">{label}</div>
			</M>
		)
	}
	return (
		<>
			<Backdrop t={h.T(p.a)} dim={0.12} />
			<MHead eyebrow="2 of 3" title="Which one, tonight?" />
			<Dots at={h.answers.length} of={h.data.pairs.length} className="absolute right-8 top-[64px]" />
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} className="absolute inset-x-8 top-[96px] flex items-center justify-center gap-5" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
					{side(p.a, "a", p.left)}
					<span className="text-[20px] font-bold text-white/40">or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-5 left-8 flex items-center gap-3">
				<MPill t={t} v="duel:skip">
					Skip
				</MPill>
				{t.answered >= 3 ? (
					<MPill t={t} v="duel:done" primary>
						♥ Show my picks
					</MPill>
				) : (
					<span className="text-[18px] text-white/50">{3 - t.answered} more for your picks</span>
				)}
			</div>
		</>
	)
}

function MMoods({ t, home }: { t: FlowT; home?: boolean }) {
	// Nine a page (the wheel still walks all twelve): three by three, the page follows the focus.
	const vals = ["mood:any", ...MOODS.map((m) => `mood:${m.key}`)]
	const fi = vals.indexOf(t.focused)
	const [page, setPage] = useState(0)
	useEffect(() => {
		if (fi >= 0) setPage(Math.floor(fi / 9))
	}, [fi])
	const shown = vals.slice(page * 9, page * 9 + 9)
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<MHead title="What kind of night?" />
			<div className={`absolute inset-x-8 grid grid-cols-3 gap-2.5 ${home ? "top-[70px]" : "top-[76px]"}`}>
				{shown.map((v) => {
					const m = v === "mood:any" ? null : MOOD[v.slice(5) as MoodKey]
					const n = t.member && m ? t.moodCount(m.key) : null
					return (
						<M key={v} t={t} v={v} className="flex h-[52px] items-center gap-3 rounded-2xl px-4">
							<span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: m?.hue ?? "rgba(255,255,255,0.6)" }} />
							<span className="min-w-0 flex-1 truncate text-[20px] font-bold">{m?.name ?? "Any mood"}</span>
							{n != null && <span className={`text-[18px] tabular-nums ${n ? "text-white/60" : "text-white/30"}`}>{n}</span>}
						</M>
					)
				})}
			</div>
			{home && (
				<div className="absolute inset-x-8 bottom-4 flex items-center gap-2.5">
					{APPS.map((a) => (
						<M key={a} t={t} v={`page:${a}`} className="flex h-11 items-center gap-2 rounded-full px-4 text-[18px] font-semibold" scale={1.05}>
							<span style={{ color: APP[a].tint }}>
								<Icon d={APP[a].d} className="h-5 w-5" />
							</span>
							{APP[a].name}
						</M>
					))}
				</div>
			)}
		</>
	)
}

function MFrom({ t }: { t: FlowT }) {
	const h = t.h
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const newArt = h.picks.filter((x) => !t.night.mood || (h.data.extra[x.key]?.m ?? []).includes(t.night.mood as never))
	const card = (v: string, title: string, line: string, art: WTitle[]) => (
		<M t={t} v={v} className="flex h-[200px] flex-col justify-end overflow-hidden rounded-3xl p-5">
			<span className="absolute -right-4 top-3 flex -space-x-8">
				{art.slice(0, 3).map((x, i) => (
					<img key={x.key} src={posterUrl(x, "w185")} alt="" className="h-[120px] w-[80px] rounded-lg object-cover shadow-2xl ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />
				))}
			</span>
			<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
			<span className="relative">
				<span className="block text-[26px] font-extrabold leading-none">{title}</span>
				<span className="mt-1.5 block text-[18px] text-white/60">{line}</span>
			</span>
		</M>
	)
	return (
		<>
			<MHead title={mood ? `${mood}. From where?` : "From where?"} />
			<div className="absolute inset-x-8 top-[80px] grid grid-cols-2 gap-5">
				{card("from:wish", "My Wishlist", t.wish.length ? `${t.wish.length} fit` : "Nothing fits", t.wish)}
				{card("from:new", "Something new", "Close to your taste", newArt)}
			</div>
		</>
	)
}

function MTonight({ t }: { t: FlowT }) {
	const h = t.h
	const [a, ...rest] = t.options
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const from = t.source === "wish" ? "From your Wishlist" : t.member ? "New to you" : h.hasTaste ? "For your answers" : "Best rated"
	return (
		<>
			<Backdrop t={a} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<MHead title="Here's tonight." line={[from, mood].filter(Boolean).join(" · ")} />
			<div className="absolute left-8 right-8 top-[90px] flex gap-4">
				{a && (
					<M t={t} v={`t:${a.key}`} className="flex w-[330px] gap-3 rounded-3xl p-2.5" scale={1.03}>
						<img src={posterUrl(a, "w342")} alt="" className="h-[165px] w-[110px] rounded-xl object-cover" />
						<div className="min-w-0 py-1">
							<div className="line-clamp-2 text-[24px] font-extrabold leading-tight">{a.title}</div>
							<div className="mt-2 flex items-center gap-2">
								<GwBadge gw={a.score} size={26} text="text-[20px]" />
								<Coin t={a} className="!text-[18px]" />
							</div>
							<div className="mt-2 line-clamp-2 text-[18px] text-white/60">{watchLine(a).text}</div>
						</div>
					</M>
				)}
				{rest.map((x) => (
					<M key={x.key} t={t} v={`t:${x.key}`} className="w-[104px] rounded-2xl p-1.5" scale={1.05}>
						<img src={posterUrl(x, "w185")} alt="" className="h-[140px] w-full rounded-xl object-cover" />
						<div className="mt-1 truncate text-[18px] font-bold">{x.title}</div>
					</M>
				))}
			</div>
			<div className="absolute bottom-4 left-8 flex items-center gap-2.5">
				<MPill t={t} v="go:moods">
					{mood ? `Mood: ${mood}` : "Pick a mood"}
				</MPill>
				{t.member ? (
					<MPill t={t} v="night:switch">
						{t.source === "wish" ? "Something new" : "My Wishlist"}
					</MPill>
				) : (
					<M t={t} v={t.answered ? "go:duel" : "go:services"} className="rounded-full px-5 py-2 text-[20px] font-bold text-amber-200" on="ring-amber-300 bg-amber-400/20" off="ring-amber-300/30 bg-amber-400/10">
						{t.answered ? "♥ Refine" : "♥ Make it mine"}
					</M>
				)}
			</div>
		</>
	)
}

function MTitle({ t, k }: { t: FlowT; k: string }) {
	const h = t.h
	const x = h.T(k)
	if (!x) return null
	const w = watchLine(x)
	const want = h.q.inQueue(x.key)
	const why = h.whyOf(x.key)
	return (
		<>
			<Backdrop t={x} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<div className="absolute left-8 top-6 flex gap-5">
				<img src={posterUrl(x, "w342")} alt="" className="h-[210px] w-[140px] rounded-2xl object-cover shadow-2xl ring-1 ring-white/10" />
				<div className="w-[300px] pt-1">
					<div className="line-clamp-2 text-[30px] font-extrabold leading-none">{x.title}</div>
					<div className="mt-2 text-[18px] text-white/55">{[x.year, runtimeLabel(x)].filter(Boolean).join(" · ")}</div>
					<div className="mt-3 flex items-center gap-3">
						<GwBadge gw={x.score} size={32} text="text-[22px]" />
						{x.match != null && <Coin t={x} className="!text-[18px]" />}
					</div>
					{why.length > 0 && <div className="mt-2 line-clamp-2 text-[18px] text-amber-100/85">For you: {and(why)}.</div>}
				</div>
			</div>
			<div className="absolute bottom-4 left-8 right-8 flex flex-wrap items-center gap-2.5">
				<M t={t} v={`watch:${x.key}`} className="flex items-center gap-2 rounded-full px-5 py-2 text-[20px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
					{w.offer?.logo && <img src={w.offer.logo} alt="" className="h-6 w-6 rounded-md" />}
					{w.owned ? "Watch" : w.offer ? `On ${w.offer.name}` : "Not streaming"}
				</M>
				<MPill t={t} v={`want:${x.key}`}>
					{want ? "✓ Wishlist" : "Want to See"}
				</MPill>
				<MPill t={t} v={`seen:${x.key}`}>
					Seen
				</MPill>
				<MPill t={t} v={`no:${x.key}`}>
					Not for me
				</MPill>
				<MPill t={t} v={`exit:title:${x.key}`}>
					↗
				</MPill>
			</div>
		</>
	)
}

function MApp({ t, id }: { t: FlowT; id: string }) {
	const h = t.h
	const a = APP[id as keyof typeof APP]
	const locked = !t.member && id === "watchnext"
	return (
		<>
			<div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 20% 0%, ${a.tint}33 0%, #07080b 60%)` }} />
			<div className="absolute left-8 top-6 flex items-center gap-3">
				<span style={{ color: a.tint }}>
					<Icon d={a.d} className="h-8 w-8" />
				</span>
				<div className="text-[30px] font-extrabold leading-none">{a.name}</div>
			</div>
			<div className="absolute left-8 right-8 top-[76px] line-clamp-2 text-[20px] text-white/65">{locked ? "With a free account, this is your Wishlist, best match first." : appLine(t, id as (typeof APPS)[number])}</div>
			{id === "watchnext" && t.member && (
				<div className="absolute inset-x-8 top-[140px] flex gap-3">
					{h.watchNext.slice(0, 6).map((x) => (
						<M key={x.key} t={t} v={`t:${x.key}`} className="w-[84px] rounded-2xl p-1" scale={1.06}>
							<img src={posterUrl(x, "w185")} alt="" className="h-[114px] w-full rounded-xl object-cover" />
						</M>
					))}
				</div>
			)}
			{!locked && (
				<div className="absolute bottom-5 left-8">
					<MPill t={t} v={`exit:page:${id}`} primary>
						Open {a.name} ↗
					</MPill>
				</div>
			)}
		</>
	)
}

function MidBar({ t }: { t: FlowT }) {
	const atHome = t.scr.k === "home"
	const btn = (k: string, d: string, label: string, on?: boolean) => (
		<button key={k} type="button" data-pick={`bar:${k}`} aria-label={label} className={`flex h-10 w-10 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/50 text-white/85 ring-1 ring-white/10"}`}>
			<Icon d={d} className="h-5 w-5" />
		</button>
	)
	return (
		<div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
			<div className="flex items-center gap-2">
				{!atHome && btn("back", ICONS.back, "Back")}
				{!atHome && btn("home", ICONS.home, "Home")}
				{btn("search", ICONS.search, "Search", t.scr.k === "keyboard")}
				{btn("more", ICONS.more, "More", t.menu)}
			</div>
			<AnimatePresence>
				{t.menu && (
					<motion.div className="flex w-[220px] flex-col rounded-2xl bg-[#0c0e12]/95 p-1.5 ring-1 ring-white/10" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
						{[["bar:mood", ICONS.mood, "Mood"], ...APPS.map((a) => [`bar:page:${a}`, APP[a].d, APP[a].name]), ["bar:picks", ICONS.picks, "Pick for me"], ["bar:power", ICONS.power, "Turn off"]].map(([p, d, l]) => (
							<button key={p} type="button" data-pick={p} className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-left text-[19px] font-medium text-white/90">
								<Icon d={d} className="h-5 w-5 opacity-80" />
								{l}
							</button>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// focus-card: pictures on the TV, the words in a caption under it.

function PicScreen({ t }: { t: FlowT }) {
	const s = t.scr
	const h = t.h
	if (s.k === "home" && !t.member) {
		const p = h.picks
		return (
			<>
				<Backdrop t={p[0]} dim={0.16} />
				<div className="absolute inset-x-4 top-[46px] grid grid-cols-3 gap-3">
					{[
						{ v: "go:services", art: <Fan posters={p.slice(3, 6)} heart />, label: "Find my tonight" },
						{ v: "go:quick", art: <Fan posters={p.slice(0, 3)} />, label: "Just show me" },
						{ v: "go:about", art: <GwBadge gw={85} size={56} text="text-[34px]" />, label: "About" },
					].map((c) => (
						<P key={c.v} t={t} v={c.v} className="flex h-[176px] flex-col items-center justify-end overflow-hidden rounded-2xl pb-2.5">
							<div className="absolute inset-x-0 top-0 flex h-[130px] origin-center scale-[0.8] items-center justify-center">{c.art}</div>
							<div className="relative text-[17px] font-extrabold">{c.label}</div>
						</P>
					))}
				</div>
			</>
		)
	}
	if (s.k === "about")
		return (
			<>
				<div className="absolute inset-x-4 top-[44px] flex h-[120px] items-center justify-around rounded-2xl bg-white/[0.04]">
					<GwBadge gw={h.picks[0]?.score ?? 85} size={46} text="text-[30px]" />
					<span className="text-[38px]">⚡❤️</span>
					<span className="grid grid-cols-2 gap-1">
						{h.data.catalog.slice(0, 4).map((c) => (
							<img key={c.name} src={c.logo} alt="" className="h-9 w-9 rounded-lg" />
						))}
					</span>
				</div>
				<div className="absolute bottom-3 left-4 flex gap-2.5">
					<Pill t={t} v="go:services" primary>
						Find my tonight
					</Pill>
					<Pill t={t} v="go:quick">Just show me</Pill>
				</div>
			</>
		)
	if (s.k === "services")
		return (
			<div className="absolute inset-x-4 top-[46px] grid grid-cols-6 gap-2.5">
				{h.data.catalog.slice(0, 12).map((c) => {
					const on = h.mine.includes(c.name)
					return (
						<P key={c.name} t={t} v={`svc:${c.name}`} className="aspect-square w-full rounded-[14px] !p-0" off={on ? "ring-green-500 bg-transparent" : "ring-transparent bg-transparent"} on={on ? "ring-green-300 bg-transparent" : "ring-amber-300 bg-transparent"} scale={1.08}>
							<img src={c.logo} alt="" className={`h-full w-full rounded-[12px] ${on ? "" : "opacity-70"}`} />
							{on && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[13px] font-black text-black">✓</span>}
						</P>
					)
				})}
				<div className="col-span-6 mt-1.5">
					<Pill t={t} v="go:duel" primary>
						{h.mine.length ? `Continue · ${h.mine.length}` : "Continue"}
					</Pill>
				</div>
			</div>
		)
	if (s.k === "duel") {
		const p = h.data.pairs[t.pairAt()]
		if (!p) return null
		const side = (k: string, v: "a" | "b") => {
			const x = h.T(k)
			return x ? (
				<P t={t} v={`duel:${v}`} className="rounded-2xl p-1.5" scale={1.05}>
					<img src={posterUrl(x, "w342")} alt="" className="h-[172px] w-[115px] rounded-xl object-cover" />
				</P>
			) : null
		}
		return (
			<>
				<Backdrop t={h.T(p.a)} dim={0.12} />
				<Dots at={h.answers.length} of={h.data.pairs.length} className="absolute left-4 top-4" />
				<div className="absolute inset-x-4 top-[38px] flex items-center justify-center gap-5">
					{side(p.a, "a")}
					<span className="text-[18px] font-bold text-white/40">or</span>
					{side(p.b, "b")}
				</div>
				<div className="absolute bottom-3 right-4 flex flex-col gap-2">
					<Pill t={t} v="duel:skip">Skip</Pill>
					{t.answered >= 3 && (
						<Pill t={t} v="duel:done" primary>
							♥
						</Pill>
					)}
				</div>
			</>
		)
	}
	if (s.k === "moods" || s.k === "home") {
		const vals = ["mood:any", ...MOODS.map((m) => `mood:${m.key}`)]
		return (
			<>
				<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
				<div className="absolute inset-x-4 top-[44px] grid grid-cols-4 gap-2">
					{vals.map((v) => {
						const m = v === "mood:any" ? null : MOOD[v.slice(5) as MoodKey]
						return (
							<P key={v} t={t} v={v} className="flex h-[58px] items-end overflow-hidden rounded-xl px-2 pb-1.5" off="ring-transparent bg-white/[0.05]">
								<span className="absolute inset-x-0 top-0 h-2" style={{ background: m?.hue ?? "rgba(255,255,255,0.6)" }} />
								<span className="truncate text-[15px] font-bold">{m?.name ?? "Any"}</span>
							</P>
						)
					})}
				</div>
			</>
		)
	}
	if (s.k === "from") {
		const newArt = h.picks.filter((x) => !t.night.mood || (h.data.extra[x.key]?.m ?? []).includes(t.night.mood as never))
		return (
			<div className="absolute inset-x-4 top-[46px] grid grid-cols-2 gap-4">
				{(
					[
						["from:wish", t.wish, "♥ Wishlist"],
						["from:new", newArt, "✦ New"],
					] as const
				).map(([v, art, l]) => (
					<P key={v} t={t} v={v} className="flex h-[176px] flex-col items-center justify-end overflow-hidden rounded-2xl pb-2">
						<div className="absolute inset-x-0 top-1 flex h-[130px] origin-center scale-[0.85] items-center justify-center">
							<Fan posters={art.slice(0, 3)} />
						</div>
						<span className="relative text-[18px] font-extrabold">{l}</span>
					</P>
				))}
			</div>
		)
	}
	if (s.k === "tonight") {
		const xs = t.options
		const f = xs.find((x) => t.isFocus(`t:${x.key}`)) ?? xs[0]
		return (
			<>
				<Backdrop t={f} dim={0.45} />
				<div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
				<div className="absolute inset-x-4 top-[40px] flex items-end justify-center gap-3">
					{xs.map((x) => (
						<P key={x.key} t={t} v={`t:${x.key}`} className="rounded-xl p-1" scale={1.06}>
							<img src={posterUrl(x, "w185")} alt="" className="h-[138px] w-[92px] rounded-lg object-cover" />
						</P>
					))}
				</div>
				<div className="absolute bottom-2.5 left-4 flex gap-2">
					<Pill t={t} v="go:moods">Mood</Pill>
					{t.member ? <Pill t={t} v="night:switch">⇄</Pill> : <Pill t={t} v={t.answered ? "go:duel" : "go:services"}>♥</Pill>}
				</div>
			</>
		)
	}
	if (s.k === "title") {
		const x = h.T(s.key)
		if (!x) return null
		const w = watchLine(x)
		const act = (v: string, d: string, label: string, primary?: boolean) => (
			<P t={t} v={v} className="flex h-[40px] w-[40px] items-center justify-center rounded-full" on={primary ? "ring-amber-300 bg-white text-black" : "ring-amber-300 bg-white/20"} off={primary ? "ring-transparent bg-white/90 text-black" : "ring-transparent bg-black/50"}>
				<Icon d={d} className="h-5 w-5" />
				<span className="sr-only">{label}</span>
			</P>
		)
		return (
			<>
				<Backdrop t={x} dim={0.55} />
				<div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
				<img src={posterUrl(x, "w185")} alt="" className="absolute left-4 top-3 h-[150px] w-[100px] rounded-xl object-cover shadow-2xl ring-1 ring-white/10" />
				<div className="absolute left-[124px] right-[132px] top-10 line-clamp-3 text-[24px] font-extrabold leading-tight">{x.title}</div>
				<div className="absolute left-[124px] top-[118px]">
					<GwBadge gw={x.score} size={30} text="text-[21px]" />
				</div>
				<div className="absolute bottom-3 left-4 flex gap-2.5">
					{act(`watch:${x.key}`, ICONS.play, w.offer ? `On ${w.offer.name}` : "Watch", true)}
					{act(`want:${x.key}`, h.q.inQueue(x.key) ? ICONS.check : ICONS.plus, "Want to See")}
					{act(`seen:${x.key}`, ICONS.eye, "Seen it")}
					{act(`no:${x.key}`, ICONS.no, "Not for me")}
					{act(`exit:title:${x.key}`, ICONS.out, "Full page")}
				</div>
			</>
		)
	}
	if (s.k === "page") {
		const a = APP[s.id]
		return (
			<>
				<div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 50% 30%, ${a.tint}44 0%, #07080b 65%)` }} />
				<div className="absolute inset-x-0 top-[50px] flex flex-col items-center gap-2">
					<span style={{ color: a.tint }}>
						<Icon d={a.d} className="h-14 w-14" />
					</span>
					<span className="text-[26px] font-extrabold">{a.name}</span>
				</div>
				{s.id === "watchnext" && t.member ? (
					<div className="absolute inset-x-4 bottom-3 flex justify-center gap-2">
						{h.watchNext.slice(0, 6).map((x) => (
							<P key={x.key} t={t} v={`t:${x.key}`} className="rounded-lg p-0.5" scale={1.08}>
								<img src={posterUrl(x, "w92")} alt="" className="h-[60px] w-[40px] rounded-md object-cover" />
							</P>
						))}
						<Pill t={t} v={`exit:page:${s.id}`}>↗</Pill>
					</div>
				) : (
					!(s.id === "watchnext" && !t.member) && (
						<div className="absolute bottom-3 left-1/2 -translate-x-1/2">
							<Pill t={t} v={`exit:page:${s.id}`} primary>
								Open ↗
							</Pill>
						</div>
					)
				)}
			</>
		)
	}
	return null
}

type Cap = { eyebrow?: string; title: string; line?: string; score?: WTitle; logo?: string }

function captionOf(t: FlowT): Cap {
	const h = t.h
	const v = t.focused
	const s = t.scr
	if (s.k === "boot") return { title: "GoodWatch", line: "Starting…" }
	if (t.menu) return { eyebrow: "Menu", title: "Mood, Watch now, Taste, Discover, Explorer", line: "Pick for me, or turn the TV off." }
	if (s.k === "keyboard") return { eyebrow: "Search", title: t.draft || "Type, or pick a phrase", line: "Point at the keys, or type on your keyboard." }
	if (s.k === "search") return { eyebrow: "Search", title: t.query ?? "", line: "Point at a title to open it." }
	const T = (k: string) => h.T(k)
	if (v.startsWith("t:")) {
		const x = T(v.slice(2))
		if (!x) return { title: "" }
		const why = h.whyOf(x.key)
		return { eyebrow: s.k === "tonight" ? (x.key === t.options[0]?.key ? "Tonight's best pick" : "Or") : "Title", title: x.title, line: [x.year, runtimeLabel(x), watchLine(x).text, why.length ? `For you: ${and(why)}` : null].filter(Boolean).join(" · "), score: x }
	}
	if (s.k === "title") {
		const x = T(s.key)
		if (!x) return { title: "" }
		const w = watchLine(x)
		const act: Record<string, string> = {
			watch: w.owned ? `Watch on ${w.offer?.name}` : w.offer ? `On ${w.offer.name}` : "Not streaming",
			want: h.q.inQueue(x.key) ? "✓ On your Wishlist" : "Want to See",
			seen: "Seen it",
			no: "Not for me",
			exit: "Open the full page ↗",
		}
		return { eyebrow: x.title, title: act[v.split(":")[0]] ?? x.title, line: [x.year, runtimeLabel(x), x.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ") + (x.synopsis ? ` — ${x.synopsis}` : ""), score: x, logo: v.startsWith("watch:") ? (w.offer?.logo ?? undefined) : undefined }
	}
	if (v.startsWith("svc:")) {
		const n = v.slice(4)
		const c = h.data.catalog.find((x) => x.name === n)
		return { eyebrow: "1 of 3 · Where do you watch?", title: n, line: h.mine.includes(n) ? "Yours. OK to remove." : `OK to add. ${h.mine.length} picked so far.`, logo: c?.logo }
	}
	if (v.startsWith("mood:")) {
		if (v === "mood:any") return { eyebrow: "What kind of night?", title: "Any mood", line: "Everything, best match first." }
		const m = MOOD[v.slice(5) as MoodKey]
		return { eyebrow: "What kind of night?", title: m.name, line: `${m.line}${t.member ? ` ${t.moodCount(m.key)} on your Wishlist.` : ""}` }
	}
	if (v.startsWith("page:")) {
		const id = v.slice(5) as (typeof APPS)[number]
		return { eyebrow: "Open", title: APP[id].name, line: appLine(t, id) }
	}
	if (v.startsWith("exit:page:")) return { eyebrow: APP[v.slice(10) as (typeof APPS)[number]].name, title: "Open the full page ↗", line: appLine(t, v.slice(10) as (typeof APPS)[number]) }
	if (v.startsWith("duel:")) {
		const p = h.data.pairs[t.pairAt()]
		const side = v.slice(5)
		if (p && (side === "a" || side === "b")) {
			const x = T(side === "a" ? p.a : p.b)
			return { eyebrow: "2 of 3 · Which one, tonight? Go with your gut.", title: side === "a" ? p.left : p.right, line: x ? `${x.title} (${x.year})` : undefined }
		}
		return { eyebrow: "2 of 3", title: side === "skip" ? "Skip this pair" : "♥ Show my picks", line: t.answered >= 3 ? "Three are enough, six are better." : `${3 - t.answered} more for your picks.` }
	}
	const fixed: Record<string, Cap> = {
		"go:services": { eyebrow: "Let's find something good", title: "Find my tonight", line: "Three quick questions, then your picks." },
		"go:quick": { eyebrow: "Let's find something good", title: "Just show me", line: "The best rated, right now." },
		"go:about": { eyebrow: "Let's find something good", title: "What is GoodWatch?", line: "One score, how it feels, where it streams." },
		"go:duel": { eyebrow: s.k === "services" ? "1 of 3" : "Tonight", title: s.k === "services" ? (h.mine.length ? `Continue with ${h.mine.length}` : "Continue without") : "♥ Refine my picks", line: s.k === "services" ? "Next: this or that." : "Change your answers." },
		"go:moods": { eyebrow: "Tonight", title: t.night.mood ? `Mood: ${MOOD[t.night.mood].name}` : "Pick a mood" },
		"night:switch": { eyebrow: "Tonight", title: t.source === "wish" ? "Something new instead" : "From my Wishlist instead" },
		"from:wish": { eyebrow: "From where?", title: "From my Wishlist", line: t.wish.length ? `${t.wish.length} fit, on your services, best match first.` : "Nothing on your Wishlist fits." },
		"from:new": { eyebrow: "From where?", title: "Something new", line: "Not seen yet, on your services, closest to your taste." },
	}
	if (s.k === "about" && fixed[v]) return { eyebrow: "GoodWatch: one score · how it feels · where it streams", title: fixed[v].title, line: fixed[v].line }
	return fixed[v] ?? { title: t.lcd[0] }
}

function Caption({ t, tv, box }: { t: FlowT; tv: { x: number; y: number; w: number; h: number }; box: { cw: number; ch: number; landscape: boolean; remoteLeft: number } }) {
	if (!t.on) return null
	const c = captionOf(t)
	const pos = box.landscape ? { left: 12, top: tv.y + tv.h + 8, width: box.remoteLeft - 24 } : { left: tv.x, top: tv.y + tv.h + 8, width: tv.w }
	return (
		<div className="absolute z-[5] overflow-hidden rounded-2xl bg-[#0b0c10]/90 px-3.5 py-2.5 shadow-2xl ring-1 ring-white/10" style={pos}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={`${t.focused}|${t.scr.k}|${t.menu}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} className="flex items-center gap-3">
					{c.logo && <img src={c.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg" />}
					<div className="min-w-0 flex-1">
						{c.eyebrow && <div className="truncate text-[13px] font-bold text-amber-300/90">{c.eyebrow}</div>}
						<div className="flex items-center gap-2">
							<span className="truncate text-[16px] font-extrabold leading-tight">{c.title}</span>
							{c.score && (
								<span className="ml-auto shrink-0">
									<GwBadge gw={c.score.score} size={20} text="text-[14px]" />
								</span>
							)}
						</div>
						{c.line && <div className={`${box.landscape ? "line-clamp-3" : "line-clamp-2"} text-[13px] leading-snug text-white/65`}>{c.line}</div>}
					</div>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Round 2, type-scale for portrait (#224): the 960 screens' structure on 560 x 308 (or 500 x 275), 18 px
// minimum on the canvas, so about 11.5 px (13 px narrow) on a 390 px phone. Nothing leaves the home screens:
// guests keep all three Welcome cards with art and lines, members all twelve moods and the four Doors.
// Layouts are flex and grid, not fixed widths, so one set of screens fits both canvases.

function TsScreen({ t, c }: { t: FlowT; c: Cv }) {
	const s = t.scr
	if (s.k === "home") return t.member ? <TsMoods t={t} c={c} home /> : <TsWelcome t={t} c={c} />
	if (s.k === "about") return <TsAbout t={t} />
	if (s.k === "services") return <TsServices t={t} />
	if (s.k === "duel") return <TsDuel t={t} c={c} />
	if (s.k === "moods") return <TsMoods t={t} c={c} />
	if (s.k === "from") return <TsFrom t={t} />
	if (s.k === "tonight") return <TsTonight t={t} c={c} />
	if (s.k === "title") return <TsTitle t={t} k={s.key} c={c} />
	if (s.k === "page") return <TsApp t={t} id={s.id} />
	return null
}

// Header on the left; the Bar owns the top right (two icons at home, four elsewhere).
function TsHead({ t, title, line, eyebrow }: { t: FlowT; title: string; line?: ReactNode; eyebrow?: string }) {
	return (
		<div className="absolute left-5 top-3" style={{ right: t.scr.k === "home" ? 96 : 176 }}>
			<div className="flex items-baseline gap-2.5">
				{eyebrow && <span className="shrink-0 text-[18px] font-bold text-amber-300/90">{eyebrow}</span>}
				<span className="truncate text-[26px] font-extrabold leading-tight tracking-tight">{title}</span>
			</div>
			{line && <div className="truncate text-[18px] leading-snug text-white/60">{line}</div>}
		</div>
	)
}

function Tp(props: Parameters<typeof F>[0]) {
	return <F ring="ring-4" {...props} />
}

function TsPill({ t, v, children, primary, className = "" }: { t: FlowT; v: string; children: ReactNode; primary?: boolean; className?: string }) {
	return primary ? (
		<Tp t={t} v={v} className={`shrink-0 rounded-full px-4 py-1.5 text-[18px] font-bold ${className}`} on="ring-amber-300 bg-amber-400 text-black" off="ring-transparent bg-amber-400/90 text-black">
			{children}
		</Tp>
	) : (
		<Tp t={t} v={v} className={`shrink-0 rounded-full px-4 py-1.5 text-[18px] font-semibold ${className}`}>
			{children}
		</Tp>
	)
}

// The Welcome fan, sized to its box: three posters `w` wide.
function TsFan({ posters, w, heart }: { posters: WTitle[]; w: number; heart?: boolean }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{posters.slice(0, 3).map((p, i) => (
				<div key={p.key} className="relative" style={{ margin: `0 ${-w * 0.14}px`, marginTop: i === 1 ? 0 : w * 0.28, transform: `rotate(${(i - 1) * 7}deg)`, zIndex: i === 1 ? 2 : 1 }}>
					<img src={posterUrl(p, "w185")} alt="" className="rounded-md shadow-xl ring-1 ring-white/10" style={{ width: w, height: w * 1.5 }} />
					{heart && i === 1 && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[18px] text-black">♥</span>}
				</div>
			))}
		</div>
	)
}

function welcomeCards(t: FlowT, fan: number) {
	const p = t.h.picks
	return [
		{ v: "go:services", label: "Find my tonight", line: "Three quick questions, then your picks.", art: <TsFan posters={p.slice(3, 6)} w={fan} heart /> },
		{ v: "go:quick", label: "Just show me", line: "The best rated, right now.", art: <TsFan posters={p.slice(0, 3)} w={fan} /> },
		{
			v: "go:about",
			label: "What is GoodWatch?",
			line: "One score, how it feels, where it streams.",
			art: (
				<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(34,197,94,0.22),transparent_65%)]">
					<GwBadge gw={85} size={fan * 0.8} text="text-[30px]" />
				</div>
			),
		},
	]
}

function TsWelcome({ t, c }: { t: FlowT; c: Cv }) {
	const narrow = c.w < 540
	if (c.rows) {
		return (
			<>
				<Backdrop t={t.h.picks[0]} dim={0.18} />
				<TsHead t={t} title="Something good tonight?" />
				<div className="absolute inset-x-5 bottom-3 top-[52px] flex flex-col gap-2">
					{welcomeCards(t, 38).map((x) => (
						<Tp key={x.v} t={t} v={x.v} className="flex min-h-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl pr-4" scale={1.02}>
							<div className="relative h-full w-[120px] shrink-0">{x.art}</div>
							<div className="min-w-0">
								<div className="text-[21px] font-extrabold leading-tight">{x.label}</div>
								<div className="truncate text-[18px] leading-snug text-white/60">{x.line}</div>
							</div>
						</Tp>
					))}
				</div>
			</>
		)
	}
	return (
		<>
			<Backdrop t={t.h.picks[0]} dim={0.18} />
			<TsHead t={t} title="Something good tonight?" />
			<div className="absolute inset-x-5 bottom-3 top-[52px] grid grid-cols-3 gap-3">
				{welcomeCards(t, narrow ? 36 : 54).map((x) => (
					<Tp key={x.v} t={t} v={x.v} className="flex flex-col overflow-hidden rounded-2xl">
						<div className="relative w-full shrink-0" style={{ height: narrow ? 66 : 104 }}>
							{x.art}
						</div>
						<div className="px-3 pb-2">
							<div className="text-[20px] font-extrabold leading-[1.1]">{x.label}</div>
							<div className="mt-1 text-[18px] leading-[1.15] text-white/60">{x.line}</div>
						</div>
					</Tp>
				))}
			</div>
		</>
	)
}

function TsMood({ t, v, h }: { t: FlowT; v: string; h: number }) {
	const m = v === "mood:any" ? null : MOOD[v.slice(5) as MoodKey]
	// The Wishlist count shows on the focused mood only: at 18 px a count on every chip truncates the names.
	const n = t.member && m && t.isFocus(v) ? t.moodCount(m.key) : null
	return (
		<Tp t={t} v={v} className="flex items-center gap-2 rounded-xl px-2.5" scale={1.04}>
			<span className="w-1.5 shrink-0 self-stretch rounded-full" style={{ background: m?.hue ?? "rgba(255,255,255,0.6)", margin: `${h * 0.2}px 0`, height: h * 0.6 }} />
			<span className="min-w-0 flex-1 truncate text-[18px] font-bold" style={{ lineHeight: `${h}px` }}>
				{m?.name ?? "Any mood"}
			</span>
			{n != null && <span className={`text-[18px] tabular-nums ${n ? "text-white/60" : "text-white/30"}`}>{n}</span>}
		</Tp>
	)
}

function TsDoor({ t, a, stacked }: { t: FlowT; a: (typeof APPS)[number]; stacked?: boolean }) {
	return (
		<Tp t={t} v={`page:${a}`} className={stacked ? "flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[18px] font-semibold" : "flex items-center gap-1.5 rounded-full px-3 py-1 text-[18px] font-semibold"} scale={1.05}>
			<span style={{ color: APP[a].tint }}>
				<Icon d={APP[a].d} className="h-[18px] w-[18px]" />
			</span>
			<span className="whitespace-nowrap">{APP[a].name}</span>
		</Tp>
	)
}

// All twelve moods at once (the round 1 type-scale paged them). With `home`, the four Doors stay too.
function TsMoods({ t, c, home }: { t: FlowT; c: Cv; home?: boolean }) {
	const vals = ["mood:any", ...MOODS.map((m) => `mood:${m.key}`)]
	const narrow = c.w < 540
	const bg = <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
	if (c.rows && home) {
		// Moods in six rows of two; the Doors a column on the right.
		return (
			<>
				{bg}
				<TsHead t={t} title="What kind of night?" />
				<div className="absolute bottom-3 left-5 right-[150px] top-[50px] grid grid-cols-2 grid-rows-6 gap-x-2 gap-y-1">
					{vals.map((v) => (
						<TsMood key={v} t={t} v={v} h={34} />
					))}
				</div>
				<div className="absolute bottom-3 right-5 top-[50px] flex w-[122px] flex-col gap-1.5">
					<span className="text-[18px] font-bold text-white/40">Or open</span>
					{APPS.map((a) => (
						<TsDoor key={a} t={t} a={a} />
					))}
				</div>
			</>
		)
	}
	const rowH = home ? (narrow ? 32 : 36) : narrow ? 42 : 48
	return (
		<>
			{bg}
			<TsHead t={t} title="What kind of night?" line={!home && t.member ? "Numbers fit your Wishlist." : undefined} />
			<div className={`absolute inset-x-5 grid grid-cols-3 gap-x-2 gap-y-1.5 ${!home && t.member ? "top-[78px]" : "top-[52px]"}`}>
				{vals.map((v) => (
					<TsMood key={v} t={t} v={v} h={rowH} />
				))}
			</div>
			{home && (narrow ? (
				<div className="absolute inset-x-5 bottom-3 grid grid-cols-4 gap-2">
					{APPS.map((a) => (
						<TsDoor key={a} t={t} a={a} stacked />
					))}
				</div>
			) : (
				<div className="absolute inset-x-5 bottom-3 flex items-center justify-between gap-2">
					{APPS.map((a) => (
						<TsDoor key={a} t={t} a={a} />
					))}
				</div>
			))}
		</>
	)
}

function TsAbout({ t }: { t: FlowT }) {
	const d = t.h.picks[0]
	const fact = (title: string, art: ReactNode) => (
		<div className="flex flex-col items-center rounded-2xl bg-white/[0.04] pb-2 ring-1 ring-white/5">
			<div className="flex h-[96px] items-center justify-center">{art}</div>
			<div className="text-center text-[18px] font-extrabold leading-tight">{title}</div>
		</div>
	)
	return (
		<>
			<TsHead t={t} title="What is GoodWatch?" />
			<div className="absolute inset-x-5 top-[54px] grid grid-cols-3 gap-3">
				{fact(
					"One score",
					<div className="flex items-center gap-1.5">
						<div className="flex flex-col gap-1 opacity-80">
							{[imdbLogo, rottenLogo, metacriticLogo].map((s) => (
								<img key={s} src={s} alt="" className="h-5 w-5 object-contain" />
							))}
						</div>
						<span className="text-[18px] text-white/40">→</span>
						<GwBadge gw={d?.score ?? 85} size={36} text="text-[24px]" />
					</div>,
				)}
				{fact("How it feels", <span className="text-[28px]">⚡❤️😂</span>)}
				{fact(
					"Where it streams",
					<div className="grid grid-cols-3 gap-1">
						{t.h.data.catalog.slice(0, 6).map((c) => (
							<img key={c.name} src={c.logo} alt="" className="h-8 w-8 rounded-md" />
						))}
					</div>,
				)}
			</div>
			<div className="absolute bottom-3 left-5 flex gap-2.5">
				<TsPill t={t} v="go:services" primary>
					Find my tonight
				</TsPill>
				<TsPill t={t} v="go:quick">
					Just show me
				</TsPill>
			</div>
		</>
	)
}

// All twelve services at once, four by three.
function TsServices({ t }: { t: FlowT }) {
	const h = t.h
	return (
		<>
			<TsHead t={t} eyebrow="1 of 3" title="Where do you watch?" />
			<div className="absolute inset-x-5 top-[52px] grid grid-cols-4 gap-2">
				{h.data.catalog.slice(0, 12).map((c) => {
					const on = h.mine.includes(c.name)
					return (
						<Tp key={c.name} t={t} v={`svc:${c.name}`} className="flex h-[48px] items-center gap-2 rounded-xl pr-2" off={on ? "ring-green-500 bg-green-500/10" : "ring-white/5 bg-white/[0.04]"} on={on ? "ring-green-400 bg-green-500/20" : "ring-amber-300 bg-white/[0.10]"}>
							<img src={c.logo} alt="" className="h-[44px] w-[44px] shrink-0 rounded-[10px]" />
							<span className="truncate text-[18px] font-semibold">{c.name}</span>
							{on && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[14px] font-black text-black">✓</span>}
						</Tp>
					)
				})}
			</div>
			<div className="absolute bottom-3 left-5">
				<TsPill t={t} v="go:duel" primary>
					{h.mine.length ? `Continue with ${h.mine.length}` : "Continue without"}
				</TsPill>
			</div>
		</>
	)
}

function TsDuel({ t, c }: { t: FlowT; c: Cv }) {
	const h = t.h
	const i = t.pairAt()
	const p = h.data.pairs[i]
	if (!p) return null
	const ph = c.w < 540 ? 120 : 138
	const side = (k: string, s: "a" | "b", label: string) => {
		const x = h.T(k)
		if (!x) return null
		return (
			<Tp t={t} v={`duel:${s}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-2" scale={1.04}>
				<img src={posterUrl(x, "w185")} alt="" className="shrink-0 rounded-lg object-cover" style={{ height: ph, width: ph / 1.5 }} />
				<div className="min-w-0 text-[20px] font-extrabold leading-tight">{label}</div>
			</Tp>
		)
	}
	return (
		<>
			<Backdrop t={h.T(p.a)} dim={0.12} />
			<TsHead t={t} eyebrow="2 of 3" title="Which one, tonight?" />
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} className="absolute inset-x-5 top-[54px] flex items-center gap-3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
					{side(p.a, "a", p.left)}
					<span className="text-[18px] font-bold text-white/40">or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-3 left-5 right-5 flex items-center gap-2.5">
				<TsPill t={t} v="duel:skip">
					Skip
				</TsPill>
				{t.answered >= 3 ? (
					<TsPill t={t} v="duel:done" primary>
						♥ Show my picks
					</TsPill>
				) : (
					<span className="truncate text-[18px] text-white/50">{3 - t.answered} more for your picks</span>
				)}
				<Dots at={h.answers.length} of={h.data.pairs.length} className="ml-auto" />
			</div>
		</>
	)
}

function TsFrom({ t }: { t: FlowT }) {
	const h = t.h
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const newArt = h.picks.filter((x) => !t.night.mood || (h.data.extra[x.key]?.m ?? []).includes(t.night.mood as never))
	const card = (v: string, title: string, line: string, art: WTitle[]) => (
		<Tp t={t} v={v} className="flex flex-col justify-end overflow-hidden rounded-2xl p-4">
			<span className="absolute -right-3 top-3 flex -space-x-7">
				{art.slice(0, 3).map((x, i) => (
					<img key={x.key} src={posterUrl(x, "w185")} alt="" className="h-[108px] w-[72px] rounded-lg object-cover shadow-2xl ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />
				))}
			</span>
			<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
			<span className="relative">
				<span className="block text-[24px] font-extrabold leading-none">{title}</span>
				<span className="mt-1 block text-[18px] text-white/60">{line}</span>
			</span>
		</Tp>
	)
	return (
		<>
			<TsHead t={t} title={mood ? `${mood}. From where?` : "From where?"} />
			<div className="absolute inset-x-5 bottom-4 top-[56px] grid grid-cols-2 gap-4">
				{card("from:wish", "My Wishlist", t.wish.length ? `${t.wish.length} fit` : "Nothing fits", t.wish)}
				{card("from:new", "Something new", "Close to your taste", newArt)}
			</div>
		</>
	)
}

function TsTonight({ t, c }: { t: FlowT; c: Cv }) {
	const h = t.h
	const [a, ...rest] = t.options
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const from = t.source === "wish" ? "From your Wishlist" : t.member ? "New to you" : h.hasTaste ? "For your answers" : "Best rated"
	const narrow = c.w < 540
	const ph = narrow ? 126 : 144
	return (
		<>
			<Backdrop t={a} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<TsHead t={t} title="Here's tonight." line={[from, mood].filter(Boolean).join(" · ")} />
			<div className="absolute inset-x-5 top-[80px] flex items-start gap-2.5">
				{a && (
					<Tp t={t} v={`t:${a.key}`} className="flex min-w-0 flex-1 gap-2.5 rounded-2xl p-2" scale={1.03}>
						<img src={posterUrl(a, "w342")} alt="" className="shrink-0 rounded-lg object-cover" style={{ height: ph, width: ph / 1.5 }} />
						<div className="min-w-0">
							<div className="line-clamp-2 text-[20px] font-extrabold leading-tight">{a.title}</div>
							<div className="mt-1.5 flex items-center gap-2">
								<GwBadge gw={a.score} size={26} text="text-[18px]" />
								<Coin t={a} className="!text-[18px]" />
							</div>
							<div className="mt-1.5 line-clamp-2 text-[18px] leading-tight text-white/60">{watchLine(a).text}</div>
						</div>
					</Tp>
				)}
				{rest.map((x) => (
					<Tp key={x.key} t={t} v={`t:${x.key}`} className="shrink-0 rounded-xl p-1" scale={1.05}>
						<img src={posterUrl(x, "w185")} alt="" className="rounded-lg object-cover" style={{ height: ph - 26, width: (ph - 26) / 1.5 }} />
						<div className="truncate text-[18px] font-bold" style={{ width: (ph - 26) / 1.5 }}>
							{x.title}
						</div>
					</Tp>
				))}
			</div>
			<div className="absolute bottom-3 left-5 right-5 flex items-center gap-2">
				<TsPill t={t} v="go:moods">
					{mood ? `Mood: ${mood}` : "Pick a mood"}
				</TsPill>
				{t.member ? (
					<TsPill t={t} v="night:switch">
						{t.source === "wish" ? "Something new" : "My Wishlist"}
					</TsPill>
				) : (
					<Tp t={t} v={t.answered ? "go:duel" : "go:services"} className="shrink-0 rounded-full px-4 py-1.5 text-[18px] font-bold text-amber-200" on="ring-amber-300 bg-amber-400/20" off="ring-amber-300/30 bg-amber-400/10">
						{t.answered ? "♥ Refine" : "♥ Make it mine"}
					</Tp>
				)}
			</div>
		</>
	)
}

function TsTitle({ t, k, c }: { t: FlowT; k: string; c: Cv }) {
	const h = t.h
	const x = h.T(k)
	if (!x) return null
	const w = watchLine(x)
	const want = h.q.inQueue(x.key)
	const why = h.whyOf(x.key)
	const narrow = c.w < 540
	const ph = narrow ? 186 : 212
	return (
		<>
			<Backdrop t={x} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<img src={posterUrl(x, "w342")} alt="" className="absolute left-5 top-4 rounded-xl object-cover shadow-2xl ring-1 ring-white/10" style={{ height: ph, width: ph / 1.5 }} />
			<div className="absolute right-5 top-3.5" style={{ left: 20 + ph / 1.5 + 16 }}>
				<div className="mr-[150px] line-clamp-2 text-[24px] font-extrabold leading-[1.05]">{x.title}</div>
				<div className="mt-1 flex items-center gap-2.5 text-[18px] text-white/55">
					<GwBadge gw={x.score} size={26} text="text-[18px]" />
					{x.match != null && <Coin t={x} className="!text-[18px]" />}
					<span className="truncate">{[x.year, runtimeLabel(x)].filter(Boolean).join(" · ")}</span>
				</div>
				{why.length > 0 && <div className="mt-1 line-clamp-2 text-[18px] leading-tight text-amber-100/85">For you: {and(why)}.</div>}
			</div>
			<div className="absolute bottom-3 right-5 flex flex-wrap content-end items-center gap-2" style={{ left: 20 + ph / 1.5 + 16 }}>
				<Tp t={t} v={`watch:${x.key}`} className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[18px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
					{w.offer?.logo && <img src={w.offer.logo} alt="" className="h-5 w-5 rounded" />}
					{w.owned ? "Watch" : w.offer ? `On ${w.offer.name}` : "Not streaming"}
				</Tp>
				<TsPill t={t} v={`want:${x.key}`}>{want ? "✓ Wishlist" : "Want to See"}</TsPill>
				<TsPill t={t} v={`seen:${x.key}`}>Seen</TsPill>
				<TsPill t={t} v={`no:${x.key}`}>Not for me</TsPill>
				<TsPill t={t} v={`exit:title:${x.key}`}>↗</TsPill>
			</div>
		</>
	)
}

function TsApp({ t, id }: { t: FlowT; id: string }) {
	const h = t.h
	const a = APP[id as keyof typeof APP]
	const locked = !t.member && id === "watchnext"
	return (
		<>
			<div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 20% 0%, ${a.tint}33 0%, #07080b 60%)` }} />
			<div className="absolute left-5 right-[176px] top-3.5 flex items-center gap-2.5">
				<span style={{ color: a.tint }}>
					<Icon d={a.d} className="h-7 w-7" />
				</span>
				<div className="truncate text-[26px] font-extrabold leading-none">{a.name}</div>
			</div>
			<div className="absolute left-5 right-5 top-[56px] line-clamp-2 text-[18px] leading-snug text-white/65">{locked ? "With a free account, this is your Wishlist, best match first." : appLine(t, id as (typeof APPS)[number])}</div>
			{id === "watchnext" && t.member && (
				<div className="absolute inset-x-5 top-[112px] flex gap-2">
					{h.watchNext.slice(0, 6).map((x) => (
						<Tp key={x.key} t={t} v={`t:${x.key}`} className="min-w-0 flex-1 rounded-xl p-1" scale={1.06}>
							<img src={posterUrl(x, "w185")} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />
						</Tp>
					))}
				</div>
			)}
			{!locked && (
				<div className="absolute bottom-3 left-5">
					<TsPill t={t} v={`exit:page:${id}`} primary>
						Open {a.name} ↗
					</TsPill>
				</div>
			)}
		</>
	)
}

function TsBar({ t }: { t: FlowT }) {
	const atHome = t.scr.k === "home"
	const btn = (k: string, d: string, label: string, on?: boolean) => (
		<button key={k} type="button" data-pick={`bar:${k}`} aria-label={label} className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/50 text-white/85 ring-1 ring-white/10"}`}>
			<Icon d={d} className="h-5 w-5" />
		</button>
	)
	return (
		<div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
			<div className="flex items-center gap-1.5">
				{!atHome && btn("back", ICONS.back, "Back")}
				{!atHome && btn("home", ICONS.home, "Home")}
				{btn("search", ICONS.search, "Search", t.scr.k === "keyboard")}
				{btn("more", ICONS.more, "More", t.menu)}
			</div>
			<AnimatePresence>
				{t.menu && (
					<motion.div className="flex w-[200px] flex-col rounded-2xl bg-[#0c0e12]/95 p-1 ring-1 ring-white/10" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
						{[["bar:mood", ICONS.mood, "Mood"], ...APPS.map((a) => [`bar:page:${a}`, APP[a].d, APP[a].name]), ["bar:picks", ICONS.picks, "Pick for me"], ["bar:power", ICONS.power, "Turn off"]].map(([p, d, l]) => (
							<button key={p} type="button" data-pick={p} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-left text-[18px] font-medium text-white/90">
								<Icon d={d} className="h-5 w-5 opacity-80" />
								{l}
							</button>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
