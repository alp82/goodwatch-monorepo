// PROTOTYPE - throwaway. The parts the three flow variants share: the focusable item, tiles, buttons, the expand
// control, and the screens that are the same everywhere (rating, the quiz, search, the menu, What is GoodWatch?).
// Sizes are in TV canvas pixels (960 x 528 on the desktop): no type under 20, no focus target under 60 tall.
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react"
import { type Dest, DEST, LEVELS, QUIZ, QUIZ_GOAL, SEARCH_IDEAS, type Title, islandOf, nextEpisodeOf, search, titleOf } from "./data"
import { parseId, useTv } from "./engine"

/** The expand control's colour. Nothing else on the TV uses it, so amber brackets always mean "this leaves the TV". */
export const AMBER = "#fbbf24"

export const TV_CSS = `
@layer components {
.tvf { position: relative; display: block; text-align: left; border-radius: 18px; outline: 0 solid transparent; outline-offset: 5px; scroll-margin: 58px 20px 26px; transition: transform .16s ease-out, outline-color .16s, background-color .16s, color .16s; }
.tvf-on { outline: 5px solid #fff; transform: scale(var(--grow, 1.05)); z-index: 2; }
.tvb { background: rgba(255,255,255,.12); }
.tvb.tvf-on { background: #fff; color: #000; outline-width: 0; transform: scale(1.06); }
.tvb.tv-current:not(.tvf-on) { background: rgba(255,255,255,.2); color: #fff; }
.tvb.tv-quiet:not(.tvf-on) { background: transparent; color: rgba(255,255,255,.6); }
.tvx { background: rgba(251,191,36,.08); color: ${AMBER}; }
.tvx.tvf-on { outline-color: ${AMBER}; background: rgba(251,191,36,.2); }
.tvx.tvb.tvf-on { background: ${AMBER}; color: #000; }
.tvx-frame { position: absolute; inset: var(--in); }
.tvf-on .tvx-frame { animation: tvx-out 1s ease-in-out infinite alternate; }
@keyframes tvx-out { from { inset: var(--in); } to { inset: var(--out); } }
@media (prefers-reduced-motion: reduce) { .tvf-on .tvx-frame { animation: none; inset: var(--out); } }
}
`

/** A tile's width: five fill a row on the desktop; on the phone the third is cut off, so the row reads as longer. */
export const tileWidth = (phone: boolean) => (phone ? 190 : 160)

export const posterBg = (hue: number) => `linear-gradient(160deg, hsl(${hue} 52% 36%), hsl(${hue + 35} 58% 13%))`
export const washBg = (hue: number) => `linear-gradient(100deg, hsl(${hue} 45% 20%) 0%, hsl(${hue + 30} 50% 9%) 70%, #0a0c11 100%)`

/** A screen, or an overlay on top of one. The focus moves inside the topmost layer only. */
export function Layer({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
	return (
		<div data-tv-layer className={`absolute inset-0 overflow-hidden ${className}`} style={style}>
			{children}
		</div>
	)
}

/** A focusable item: pointing at it focuses it, the direction keys move the focus, OK or a click or tap chooses it. */
export function F({
	id,
	onOk,
	onKeyFocus,
	first,
	label,
	className = "",
	style,
	children,
}: {
	id: string
	onOk: () => void
	/** Runs when the direction keys land here (tabs switch on focus). */
	onKeyFocus?: () => void
	/** Where the screen's focus starts. */
	first?: boolean
	label?: string
	className?: string
	style?: CSSProperties
	children: ReactNode
}) {
	const tv = useTv()
	const ref = useRef<HTMLButtonElement>(null)
	const latest = useRef(onKeyFocus)
	latest.current = onKeyFocus
	useEffect(() => {
		const el = ref.current
		const run = () => latest.current?.()
		el?.addEventListener("tvkeyfocus", run)
		return () => el?.removeEventListener("tvkeyfocus", run)
	}, [])
	const on = tv.focus === id
	return (
		<button
			ref={ref}
			type="button"
			data-tv-item={id}
			data-tv-first={first ? "" : undefined}
			aria-current={on || undefined}
			aria-label={label}
			onMouseEnter={() => tv.setFocus(id, "pointer")}
			onClick={() => {
				if (tv.leaving) return
				tv.setFocus(id, "pointer")
				onOk()
			}}
			className={`tvf ${on ? "tvf-on" : ""} ${className}`}
			style={style}
		>
			{children}
		</button>
	)
}

export function Btn({ id, onOk, first, className = "", children }: { id: string; onOk: () => void; first?: boolean; className?: string; children: ReactNode }) {
	const tv = useTv()
	return (
		<F id={id} onOk={onOk} first={first} className={`tvb flex h-[66px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-6 text-[25px] font-bold ${tv.phone ? "w-full" : ""} ${className}`}>
			{children}
		</F>
	)
}

/** A row of buttons; on the phone they stack. */
export function Buttons({ children, className = "" }: { children: ReactNode; className?: string }) {
	const tv = useTv()
	return <div className={`flex ${tv.phone ? "flex-col gap-3" : "flex-wrap items-center gap-3"} ${className}`}>{children}</div>
}

export function Poster({ title, id, onOk, first, sub, w, h = 200 }: { title: Title; id?: string; onOk?: () => void; first?: boolean; sub?: string; w?: number; h?: number }) {
	const tv = useTv()
	w ??= tileWidth(tv.phone)
	return (
		<F id={id ?? `t-${title.key}`} onOk={onOk ?? (() => tv.push(`title-${title.key}`))} first={first} className="shrink-0 overflow-hidden" style={{ width: w, height: h, background: posterBg(title.hue) }}>
			{tv.taste && <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-0.5 text-[20px] font-bold">{title.match}%</span>}
			<span className="absolute inset-x-4 bottom-4">
				<span className="block text-[23px] font-extrabold leading-[1.1]">{title.title}</span>
				{sub && <span className="mt-1 block text-[20px] leading-tight text-white/80">{sub}</span>}
			</span>
		</F>
	)
}

/** A static poster: part of a picture, not a control. */
export function Still({ title, w, h }: { title: Title; w: number; h: number }) {
	return (
		<div className="relative shrink-0 overflow-hidden rounded-[18px]" style={{ width: w, height: h, background: posterBg(title.hue) }}>
			<span className="absolute inset-x-4 bottom-4 text-[22px] font-extrabold leading-[1.1]">{title.title}</span>
		</div>
	)
}

export function IslandTile({ island, onOk, first, w, h = 200 }: { island: string; onOk: () => void; first?: boolean; w?: number; h?: number }) {
	const tv = useTv()
	const i = islandOf(island)
	w ??= tileWidth(tv.phone)
	return (
		<F id={`island-${i.key}`} onOk={onOk} first={first} className="shrink-0 overflow-hidden bg-[#0e2230]" style={{ width: w, height: h }}>
			<span className="absolute left-1/2 top-[38%] h-[46%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[50%]" style={{ background: `radial-gradient(closest-side, hsl(${i.hue} 60% 52%), hsl(${i.hue} 55% 30%))` }} />
			<span className="absolute inset-x-4 bottom-4">
				<span className="block text-[23px] font-extrabold leading-[1.1]">{i.name}</span>
				<span className="mt-1 block text-[20px] text-white/75">Island</span>
			</span>
		</F>
	)
}

/** A labelled row of tiles. A row that is wider than the screen pages sideways as the focus moves. */
export function Row({ label, children }: { label?: string; children: ReactNode }) {
	return (
		<div className="mb-2">
			{label && <div className="mb-1 text-[22px] font-bold text-white/70">{label}</div>}
			<div className="-mx-4 flex gap-4 overflow-hidden px-4 py-3" style={{ scrollPadding: 20 }}>
				{children}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The expand control: four corner brackets around a small picture. Focused, the brackets move outward, again and
// again: the picture wants to grow past its frame. A short label, never the name of a page.

/** Four corner brackets on the edges of their parent box. */
export function Corners({ len, stroke, color = AMBER }: { len: number; stroke: number; color?: string }) {
	const side = { position: "absolute", width: len, height: len, borderColor: color, borderStyle: "solid", borderWidth: 0 } as const
	const r = stroke * 1.2
	return (
		<>
			<span style={{ ...side, left: 0, top: 0, borderLeftWidth: stroke, borderTopWidth: stroke, borderTopLeftRadius: r }} />
			<span style={{ ...side, right: 0, top: 0, borderRightWidth: stroke, borderTopWidth: stroke, borderTopRightRadius: r }} />
			<span style={{ ...side, left: 0, bottom: 0, borderLeftWidth: stroke, borderBottomWidth: stroke, borderBottomLeftRadius: r }} />
			<span style={{ ...side, right: 0, bottom: 0, borderRightWidth: stroke, borderBottomWidth: stroke, borderBottomRightRadius: r }} />
		</>
	)
}

/** The motif: a small picture, and the brackets that pull away from it. */
function Motif({ w, h, stroke }: { w: number; h: number; stroke: number }) {
	return (
		<span className="relative block shrink-0" style={{ width: w, height: h }}>
			<span className="absolute rounded-[4px] bg-current opacity-70" style={{ inset: "30%" }} />
			<span className="tvx-frame" style={{ "--in": "17%", "--out": "0%" } as CSSProperties}>
				<Corners len={Math.round(Math.min(w, h) * 0.26)} stroke={stroke} color="currentColor" />
			</span>
		</span>
	)
}

/** The expand control as the last tile of a row. */
export function ExpandTile({ id, dest, h = 200 }: { id: string; dest: Dest; h?: number }) {
	const tv = useTv()
	const w = tileWidth(tv.phone)
	return (
		<F id={id} onOk={() => tv.leave(dest, id)} label={`${tv.label}: ${dest.name}`} className="tvx flex shrink-0 flex-col items-center justify-center gap-4" style={{ width: w, height: h }}>
			<Motif w={Math.round(w * 0.66)} h={Math.round(w * 0.5)} stroke={6} />
			<span className="text-[25px] font-extrabold leading-none">{tv.label}</span>
		</F>
	)
}

/** The expand control as a key. `framed`: focusing it already frames the whole picture. `slow`: the run can be cancelled. */
export function ExpandKey({ id = "expand", dest, framed, slow }: { id?: string; dest: Dest; framed?: boolean; slow?: boolean }) {
	const tv = useTv()
	return (
		<F id={id} onOk={() => tv.leave(dest, id, { framed, slow })} label={`${tv.label}: ${dest.name}`} className={`tvx tvb flex h-[66px] shrink-0 items-center justify-center gap-4 whitespace-nowrap rounded-full px-6 text-[25px] font-extrabold ${tv.phone && !framed ? "w-full" : ""}`}>
			<Motif w={50} h={38} stroke={4} />
			{tv.label}
		</F>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A title: its facts and its actions. Each variant lays them out its own way.

export const metaOf = (x: Title) => `${x.year} · ${x.kind === "movie" ? "Movie" : "Show"} · ${x.runtime}`

export function Facts({ title, size = 54, kicker }: { title: Title; size?: number; kicker?: string }) {
	const tv = useTv()
	return (
		<div>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">{kicker ?? metaOf(title)}</div>
			<div className="mt-1 font-extrabold leading-[1.02] tracking-tight" style={{ fontSize: tv.phone ? Math.min(size, 42) : size }}>
				{title.title}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[24px] font-bold">
				<span>
					{title.score}
					<span className="ml-1.5 font-normal text-white/60">score</span>
				</span>
				{tv.taste && (
					<span>
						{title.match}%<span className="ml-1.5 font-normal text-white/60">match</span>
					</span>
				)}
				<span className="font-normal text-white/75">On {title.service}</span>
			</div>
			<div className="mt-3 max-w-[640px] text-[24px] leading-snug text-white/80">{title.line}</div>
		</div>
	)
}

/** What a person can do with a title on the TV: three actions, each big. Leaving for the title page is the expand control. */
export function useTitleActions(title: Title): { id: string; label: string; onOk: () => void }[] {
	const tv = useTv()
	const episode = tv.member ? nextEpisodeOf(title.key) : null
	const level = tv.store.seen[title.key]
	return [
		{ id: "watch", label: `Watch on ${title.service}`, onOk: () => tv.toast(`${title.service} would open here, outside GoodWatch`) },
		{ id: "want", label: tv.store.want.includes(title.key) ? "On Wishlist ✓" : "Want to See", onOk: () => tv.want(title.key) },
		episode && !level ? { id: "seen", label: `Seen ${episode.code}`, onOk: () => tv.rate(title.key, `${episode.code} seen`) } : { id: "seen", label: level ?? "Seen it", onOk: () => tv.push(`rate-${title.key}`) },
	]
}

// ---------------------------------------------------------------------------------------------------------
// One question, a few big answers.

export function Question({ kicker, question, line, answers, footer }: { kicker?: string; question: string; line?: string; answers: { id: string; label: string; onOk: () => void }[]; footer?: ReactNode }) {
	const tv = useTv()
	return (
		<Layer className={`flex flex-col justify-center ${tv.phone ? "px-7" : "px-14"}`}>
			{kicker && <div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">{kicker}</div>}
			<div className="mt-1 font-extrabold leading-[1.05] tracking-tight" style={{ fontSize: tv.phone ? 36 : 46 }}>
				{question}
			</div>
			{line && <div className="mt-2 text-[24px] text-white/70">{line}</div>}
			<div className={`mt-9 ${tv.phone ? "flex flex-col gap-3" : "grid gap-4"}`} style={tv.phone ? undefined : { gridTemplateColumns: `repeat(${answers.length}, minmax(0, 1fr))` }}>
				{answers.map((a, i) => (
					<F key={a.id} id={a.id} onOk={a.onOk} first={i === 0} className={`tvb flex items-center justify-center px-4 text-center text-[26px] font-bold leading-tight ${tv.phone ? "h-[68px]" : "h-[112px]"}`}>
						{a.label}
					</F>
				))}
			</div>
			{footer}
		</Layer>
	)
}

/** The screens every variant has: rating a title, the taste quiz, search, What is GoodWatch? */
export function Shared({ id, onQuizDone, searchExit }: { id: string; onQuizDone: () => void; searchExit: (dest: Dest) => ReactNode }) {
	const tv = useTv()
	const [kind, arg] = parseId(id)
	if (kind === "rate") {
		const x = titleOf(arg)
		return (
			<Question
				kicker="Seen it"
				question={`How was ${x.title}?`}
				answers={LEVELS.map((level) => ({
					id: `level-${level}`,
					label: level,
					onOk: () => {
						tv.rate(x.key, level)
						tv.back()
					},
				}))}
			/>
		)
	}
	if (kind === "quiz") {
		const x = QUIZ[tv.store.quizAt % QUIZ.length]
		const answer = (level: string | null) => () => {
			if (tv.quiz(level)) onQuizDone()
		}
		return (
			<Question
				kicker={`Taste · ${Math.min(tv.store.rated, QUIZ_GOAL)} of ${QUIZ_GOAL} rated`}
				question={x.title}
				line={`${metaOf(x)}. Have you seen it?`}
				answers={[
					{ id: "q-loved", label: "Loved it", onOk: answer("Loved it") },
					{ id: "q-liked", label: "Liked it", onOk: answer("Liked it") },
					{ id: "q-no", label: "Not for me", onOk: answer("Not for me") },
					{ id: "q-skip", label: "Haven't seen it", onOk: answer(null) },
				]}
			/>
		)
	}
	if (kind === "search" && arg) {
		const hits = search(arg)
		const dest = DEST.search(arg)
		return (
			<Layer className={tv.phone ? "px-7 pt-8" : "px-11 pt-10"}>
				<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">Search</div>
				<div className="mb-5 mt-1 text-[44px] font-extrabold leading-none">“{arg}”</div>
				<Row>
					{hits.map((x, i) => (
						<Poster key={x.key} title={x} first={i === 0} />
					))}
					{tv.variant === "rows" && <ExpandTile id="expand" dest={dest} />}
				</Row>
				{tv.variant !== "rows" && <div className="mt-4 flex justify-end">{searchExit(dest)}</div>}
			</Layer>
		)
	}
	if (kind === "search") {
		const { draft } = tv.store
		return (
			<Question
				kicker="Search"
				question={draft ? `${draft}▍` : "What are you looking for?"}
				line={draft.length > 1 ? "OK searches for it." : "Type on the keyboard, or pick one."}
				answers={[...(draft.length > 1 ? [{ id: "go", label: `Search “${draft}”`, onOk: () => tv.push(`search-${draft.trim()}`) }] : []), ...SEARCH_IDEAS.slice(0, draft.length > 1 ? 3 : 4).map((q) => ({ id: `idea-${q}`, label: q, onOk: () => tv.push(`search-${q}`) }))]}
			/>
		)
	}
	if (kind === "about")
		return (
			<Question
				kicker="What is GoodWatch?"
				question="One score, how it feels, where it streams."
				line="IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account needed."
				answers={[
					{ id: "got-it", label: "Got it", onOk: tv.back },
					{ id: "rate", label: "Rate what I've seen", onOk: () => tv.replace("quiz") },
				]}
			/>
		)
	return null
}

/** The menu, the same in every variant: a sheet from the right with a handful of big items. */
export function Menu() {
	const tv = useTv()
	const items = [
		{ id: "menu-home", label: "Home", onOk: tv.home },
		{ id: "menu-search", label: "Search", onOk: tv.openSearch },
		tv.member ? { id: "menu-account", label: "Account", onOk: () => tv.toast("Settings would open here") } : { id: "menu-signin", label: "Sign in", onOk: () => tv.toast("Continue with Google would open here") },
		{ id: "menu-about", label: "What is GoodWatch?", onOk: () => tv.replace("about") },
		{
			id: "menu-off",
			label: "Turn off",
			onOk: () => {
				tv.back()
				tv.power(false)
			},
		},
	]
	return (
		<Layer className="bg-black/60">
			<div className={`absolute inset-y-0 right-0 flex flex-col justify-center gap-3 bg-[#14171f] px-8 ${tv.phone ? "w-[78%]" : "w-[400px]"}`}>
				<div className="mb-2 text-[21px] font-bold uppercase tracking-[0.14em] text-white/60">Menu</div>
				{items.map((item, i) => (
					<F key={item.id} id={item.id} onOk={item.onOk} first={i === 0} className="tvb flex h-[66px] items-center rounded-full px-7 text-[25px] font-bold">
						{item.label}
					</F>
				))}
			</div>
		</Layer>
	)
}

export function Toast() {
	const tv = useTv()
	if (!tv.toastText) return null
	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
			<div className="rounded-full bg-white px-7 py-3 text-[24px] font-bold text-black shadow-2xl">{tv.toastText}</div>
		</div>
	)
}
