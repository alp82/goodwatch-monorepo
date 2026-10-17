// PROTOTYPE - throwaway.
// Shared bits for the bandsliders, trio and stripes variants: signature band, floating evidence card, polished slider, versus pairs.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bars, DriverBars, HEX, MoreLinks, type Pillar, PILLARS, Verdict } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { AREA_SCALES, INTENSITY_SCALE, SCALES, type Scale, reading, scaleTraits } from "./slidestrip-parts"
import { AREA_WORD, type Key, type Scores } from "./versus-parts"

// --- Groups (same as allsliders) ---

const [PACE, TONE, SETTING, ATTENTION] = SCALES
const A = AREA_SCALES
export const GROUPS: { name: string; scales: Scale[] }[] = [
	{ name: "Feel", scales: [PACE, A.Energy, INTENSITY_SCALE, TONE, A.Heart, A.Humor] },
	{ name: "Story", scales: [ATTENTION, SETTING, A.World] },
	{ name: "Look", scales: [A.Style, A.Craft] },
]
// Scales with a real opposite at each end fill from the middle; the rest fill from the left.
export const TWO_POLE = new Set(["Pace", "Tone", "Setting"])

// --- Signature band (from Barcode.tsx) ---

export function hash(str: string) {
	let h = 2166136261
	for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
	return (h >>> 0) / 4294967295
}

export function areaStripes(p: Pillar, s: Scores, seed: string) {
	const keys: Key[] = [...F.PILLAR_KEYS[p], ...F.RELATED_KEYS[p].filter((k) => !(F.PILLAR_KEYS[p] as readonly Key[]).includes(k))]
	const lines: { id: string; key: Key; score: number; w: number; b: number }[] = []
	for (const k of keys) {
		const n = 1 + Math.round(s[k] / 1.6)
		for (let i = 0; i < n; i++) {
			const r = hash(`${seed}:${k}:${i}`)
			lines.push({ id: `${k}${i}`, key: k, score: s[k], w: (0.35 + r * 1.3) * (0.6 + s[k] / 20), b: Math.max(0, Math.min(10, s[k] + (r - 0.5) * 4)) })
		}
	}
	return lines.sort((a, b) => hash(`${seed}${a.id}`) - hash(`${seed}${b.id}`))
}

export const shade = (hex: string, b: number) => `color-mix(in srgb, ${hex} ${Math.round(8 + b * 9.2)}%, #0c0a09)`

export function Band({
	t,
	focus,
	open,
	onHover,
	onPick,
	size = "lg",
	labels = "names",
}: {
	t: F.TitleInput
	focus: Pillar | null
	open: Pillar | null
	onHover?: (p: Pillar | null) => void
	onPick: (p: Pillar, el: HTMLElement) => void
	size?: "lg" | "thin"
	labels?: "names" | "words" | "none"
}) {
	const s = t.fingerprint.scores
	const tiers = t.fingerprint.pillars
	const lg = size === "lg"
	return (
		<div className={`flex ${lg ? "gap-[3px]" : "gap-[2px]"}`} onPointerLeave={() => onHover?.(null)}>
			{PILLARS.map((p, i) => {
				const on = open === p
				const dim = focus !== null && focus !== p
				return (
					<button
						key={p}
						type="button"
						data-fp-trigger
						aria-expanded={on}
						aria-haspopup="dialog"
						aria-label={`${p}: ${AREA_WORD[p][tiers[p]].toLowerCase()}`}
						onPointerEnter={(e) => e.pointerType === "mouse" && onHover?.(p)}
						onFocus={() => onHover?.(p)}
						onBlur={() => onHover?.(null)}
						onClick={(e) => onPick(p, e.currentTarget)}
						className={`group flex cursor-pointer flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${lg ? "min-w-[2.9rem] sm:min-w-[3.4rem]" : "min-w-[2.5rem]"}`}
						style={{ flex: `${tiers[p] + 1.5} 1 0%` }}
					>
						<span
							aria-hidden="true"
							className={`relative flex w-full overflow-hidden transition-opacity duration-200 ${lg ? "h-12 sm:h-14" : "h-2.5"} ${
								i === 0 ? (lg ? "rounded-l-xl" : "rounded-l-full") : ""
							} ${i === PILLARS.length - 1 ? (lg ? "rounded-r-xl" : "rounded-r-full") : ""} ${dim ? "opacity-25" : ""}`}
						>
							{areaStripes(p, s, t.title).map((x) => (
								<span key={x.id} className="h-full" style={{ flex: `${x.w} 1 0%`, background: shade(HEX[p], x.b) }} />
							))}
							{lg && (
								<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.10),transparent_35%,transparent_65%,rgba(0,0,0,.30))]" />
							)}
						</span>
						{labels !== "none" && (
							<>
								<span
									aria-hidden="true"
									className={`mt-1.5 block h-0.5 w-full rounded-full transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
									style={{ background: HEX[p] }}
								/>
								<span
									className={`mt-1 block truncate text-xs transition-colors ${dim ? "text-gray-600" : on || focus === p ? "text-white" : "text-gray-400"}`}
								>
									<span aria-hidden="true" className="max-sm:hidden">
										{PILLAR_CONFIG[p].emoji}{" "}
									</span>
									{p}
								</span>
								{labels === "words" && (
									<span className={`block truncate text-sm font-semibold ${dim ? "text-gray-500" : "text-white"}`}>{AREA_WORD[p][tiers[p]]}</span>
								)}
							</>
						)}
					</button>
				)
			})}
		</div>
	)
}

// --- Floating evidence card: anchored popover from sm up, bottom sheet on phones. Nothing in the page moves. ---

export function FloatCard({
	anchor,
	onClose,
	label,
	color,
	width = 360,
	children,
}: {
	anchor: HTMLElement
	onClose: () => void
	label: string
	color: string
	width?: number
	children: ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)
	const close = useRef(onClose)
	close.current = onClose
	const [phone] = useState(() => window.matchMedia("(max-width: 639px)").matches)
	const [pos, setPos] = useState<{ top: number; left: number; below: boolean; max: number } | null>(null)

	useLayoutEffect(() => {
		if (phone) return
		const place = () => {
			const el = ref.current
			if (!el) return
			const r = anchor.getBoundingClientRect()
			const w = el.offsetWidth
			const h = el.scrollHeight
			// Keep clear of the sticky header and tabs: walk down from the top while the point hits a fixed or sticky bar.
			let inset = 8
			for (let y = 2; y < 320; y = inset + 2) {
				const bar = document
					.elementsFromPoint(innerWidth / 2, y)
					.find((e) => !el.contains(e) && ["fixed", "sticky"].includes(getComputedStyle(e).position))
				if (!bar) break
				inset = bar.getBoundingClientRect().bottom + 8
			}
			const spaceBelow = innerHeight - 8 - (r.bottom + 10)
			const spaceAbove = r.top - 10 - inset
			const below = h <= spaceBelow || spaceBelow >= spaceAbove
			const top = below ? r.bottom + 10 : Math.max(inset, r.top - 10 - h)
			const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 12)
			setPos({ top, left, below, max: Math.max(180, below ? spaceBelow : innerHeight - 8 - top) })
		}
		place()
		addEventListener("scroll", place, { passive: true })
		addEventListener("resize", place)
		return () => {
			removeEventListener("scroll", place)
			removeEventListener("resize", place)
		}
	}, [anchor, phone])

	useEffect(() => {
		ref.current?.focus({ preventScroll: true })
		const down = (e: PointerEvent) => {
			const tg = e.target as Element
			if (ref.current?.contains(tg) || tg.closest?.("[data-fp-trigger]")) return
			close.current()
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			close.current()
			anchor.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [anchor])

	const body = (
		<>
			<style>
				{
					"@keyframes fpcIn{from{opacity:0;transform:translateY(var(--fpc-y,6px)) scale(.98)}to{opacity:1;transform:none}}@keyframes fpsIn{from{transform:translateY(100%)}to{transform:none}}@keyframes fpbIn{from{opacity:0}to{opacity:1}}"
				}
			</style>
			{phone && <div className="fixed inset-0 z-[100] bg-black/55 motion-safe:animate-[fpbIn_180ms_ease-out]" aria-hidden="true" />}
			<div
				ref={ref}
				role="dialog"
				aria-label={label}
				tabIndex={-1}
				className={
					phone
						? "fixed inset-x-0 bottom-0 z-[101] max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-stone-900 px-5 pb-[max(4.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none motion-safe:animate-[fpsIn_220ms_cubic-bezier(.2,.8,.2,1)]"
						: "fixed z-[101] rounded-2xl border border-white/10 bg-stone-900 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,.8)] outline-none motion-safe:animate-[fpcIn_160ms_ease-out]"
				}
				style={
					phone
						? undefined
						: ({
								width,
								maxWidth: "calc(100vw - 24px)",
								maxHeight: pos?.max,
								overflowY: "auto",
								top: pos?.top ?? -9999,
								left: pos?.left ?? 0,
								visibility: pos ? "visible" : "hidden",
								"--fpc-y": pos?.below === false ? "-6px" : "6px",
							} as React.CSSProperties)
				}
			>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 rounded-[inherit]"
					style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 14%, transparent), transparent 55%)` }}
				/>
				{phone && <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20" />}
				<button
					type="button"
					onClick={() => {
						onClose()
						anchor.focus({ preventScroll: true })
					}}
					aria-label="Close"
					className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
				>
					<XMarkIcon className="h-5 w-5" aria-hidden="true" />
				</button>
				<div className="relative">{children}</div>
			</div>
		</>
	)
	return createPortal(body, document.body)
}

// Card bodies.
export function ScaleCardBody({ sc, t }: { sc: Scale; t: F.TitleInput }) {
	const r = reading(sc, t)
	return (
		<>
			<p className="pr-8 text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[sc.area] }}>
				{sc.name}
			</p>
			<p className="mt-0.5 text-lg font-semibold text-white">{r.word}</p>
			<p className="mb-3 mt-0.5 text-xs text-gray-400">
				Between {sc.left.toLowerCase()} and {sc.right.toLowerCase()}. The traits behind it, out of 10:
			</p>
			<Bars attributes={scaleTraits(sc, t, 6)} color={HEX[sc.area]} />
		</>
	)
}

export function AreaCardBody({ p, t }: { p: Pillar; t: F.TitleInput }) {
	return (
		<>
			<p className="pr-8 text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[p] }}>
				{PILLAR_CONFIG[p].emoji} {p} · {AREA_WORD[p][t.fingerprint.pillars[p]]}
			</p>
			<div className="mt-2">
				<Verdict t={t} p={p} />
			</div>
			<div className="mt-3">
				<DriverBars t={t} p={p} compact />
			</div>
			<div className="mt-4 [&_a]:text-xs">
				<MoreLinks t={t} p={p} />
			</div>
		</>
	)
}

export function PairCardBody({ hi, other, s, color }: { hi: Key; other: Key; s: Scores; color: string }) {
	const row = (k: Key, low: boolean) => {
		const m = getFingerprintMeta(k)
		return (
			<li className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-sm">
				<span className="truncate text-gray-200">{m.label}</span>
				<span className="tabular-nums text-xs text-gray-400">{s[k]} of 10</span>
				<span className="col-span-2 h-1.5 rounded-full bg-white/8">
					<span className="block h-1.5 rounded-full" style={{ width: `${s[k] * 10}%`, background: low ? "#78716c" : color }} />
				</span>
				{m.description && <span className="col-span-2 mt-0.5 text-xs text-gray-500">{m.description}</span>}
			</li>
		)
	}
	return (
		<>
			<p className="mb-3 pr-8 text-xs text-gray-400">Where this comes from</p>
			<ul className="space-y-3">
				{row(hi, false)}
				{row(other, s[other] <= 4)}
			</ul>
		</>
	)
}

// --- Polished slider track ---

export function SlimTrack({ sc, v, word, dim = false }: { sc: Scale; v: number; word: string; dim?: boolean }) {
	const c = HEX[sc.area]
	const two = TWO_POLE.has(sc.name)
	const from = two ? 0.5 : 0
	const lo = Math.min(from, v)
	const hi = Math.max(from, v)
	return (
		<span
			role="img"
			aria-label={`${sc.name}: ${word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
			className={`relative block h-1.5 rounded-full bg-white/[.07] transition-opacity duration-200 ${dim ? "opacity-30" : ""}`}
		>
			{two && <span aria-hidden="true" className="absolute -inset-y-0.5 left-1/2 w-px bg-white/20" />}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 rounded-full"
				style={{
					left: `${lo * 100}%`,
					width: `${(hi - lo) * 100}%`,
					background: `linear-gradient(${v >= from ? "90deg" : "270deg"}, color-mix(in srgb, ${c} 10%, transparent), color-mix(in srgb, ${c} 55%, transparent))`,
				}}
			/>
			<span
				aria-hidden="true"
				className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-stone-950"
				style={{ left: `calc(7px + ${v} * (100% - 14px))`, background: c, boxShadow: `0 0 0 5px color-mix(in srgb, ${c} 18%, transparent)` }}
			/>
		</span>
	)
}

// --- Versus pairs (copied from Versus.tsx, which doesn't export them) ---

const HUMOR: Key[] = ["situational_comedy", "wit_wordplay", "physical_comedy", "absurdist_humor", "satire_parody", "dark_humor"]
const maxOf = (s: Scores, ks: Key[]) => Math.max(...ks.map((k) => s[k]))
const argMax = (s: Scores, ks: Key[]) => [...ks].sort((a, b) => s[b] - s[a])[0]

export interface Pair {
	a: string
	conj: "not" | "but" | "with"
	b: string
	hi: (s: Scores) => Key
	other: (s: Scores) => Key
	ok: (s: Scores) => boolean
	score: (s: Scores) => number
}

const k = (key: Key) => () => key
const not = (a: string, b: string, hi: Key, lo: Key, min: number, max: number): Pair => ({
	a,
	conj: "not",
	b,
	hi: k(hi),
	other: k(lo),
	ok: (s) => s[hi] >= min && s[lo] <= max,
	score: (s) => s[hi] - s[lo],
})
const but = (a: string, b: string, x: Key | Key[], y: Key | Key[], min: number, conj: "but" | "with" = "but"): Pair => {
	const xs = Array.isArray(x) ? x : [x]
	const ys = Array.isArray(y) ? y : [y]
	return {
		a,
		conj,
		b,
		hi: (s) => argMax(s, xs),
		other: (s) => argMax(s, ys),
		ok: (s) => maxOf(s, xs) >= min && maxOf(s, ys) >= min,
		score: (s) => Math.min(maxOf(s, xs), maxOf(s, ys)) - 4.5,
	}
}

const PAIRS: Pair[] = [
	not("Tense", "scary", "tension", "scare", 7, 4),
	not("Exciting", "scary", "adrenaline", "scare", 6, 3),
	not("Thrilling", "gory", "adrenaline", "grotesque", 7, 3),
	not("Violent", "gory", "violence", "grotesque", 7, 3),
	not("Philosophical", "slow", "philosophical", "slow_burn", 7, 3),
	not("Heartwarming", "a tearjerker", "wholesome", "pathos", 7, 4),
	not("Clever", "confusing", "complexity", "ambiguity", 8, 4),
	not("A crime story", "a whodunit", "crime", "mystery", 8, 5),
	not("Strange", "hard to follow", "surrealism", "complexity", 7, 5),
	{ ...but("Feel-good", "fluffy", "hopefulness", ["character_depth", "complexity"], 8), conj: "not" },
	{ ...but("Action-packed", "mindless", "adrenaline", ["philosophical", "complexity"], 8), conj: "not" },
	{ ...but("Family-friendly", "childish", "wholesome", ["character_depth", "wit_wordplay", "complexity"], 7), conj: "not" },
	but("Epic", "personal", "spectacle", "character_depth", 8),
	but("Fast", "layered", "fast_pace", "complexity", 7),
	but("Slow", "gripping", "slow_burn", ["tension", "intrigue"], 7),
	but("Bleak", "darkly funny", "bleakness", "dark_humor", 7),
	but("Funny", "bittersweet", HUMOR, "melancholy", 7),
	but("Quirky", "heartfelt", "eccentricity", "pathos", 7),
	but("Violent", "thoughtful", "violence", "philosophical", 8),
	but("Nostalgic", "fresh", "nostalgia", "novelty", 8),
	but("Dark", "hopeful", "bleakness", "hopefulness", 6),
	but("Stylish", "substance", "visual_stylization", ["character_depth", "philosophical", "narrative_structure"], 9, "with"),
	but("Funny", "heart", HUMOR, ["pathos", "wholesome"], 7, "with"),
]

// Up to n pairs that don't share a trait.
export function pickPairs(s: Scores, n = 3) {
	const used = new Set<Key>()
	const out: { p: Pair; hi: Key; other: Key }[] = []
	for (const p of PAIRS.filter((x) => x.ok(s)).sort((x, y) => y.score(s) - x.score(s))) {
		const hi = p.hi(s)
		const other = p.other(s)
		if (used.has(hi) || used.has(other)) continue
		used.add(hi)
		used.add(other)
		out.push({ p, hi, other })
		if (out.length === n) break
	}
	return out
}

// "Tense, not scary." with the last word kept together with the full stop.
export function PairText({ p, color, after }: { p: Pair; color: string; after?: ReactNode }) {
	const words = p.b.split(" ")
	return (
		<>
			<span style={{ color }}>{p.a},</span>{" "}
			<span className={p.conj === "not" ? "text-gray-500" : "text-white"}>
				{p.conj} {words.slice(0, -1).join(" ")}{" "}
				<span className="whitespace-nowrap">
					{words.at(-1)}.{after}
				</span>
			</span>
		</>
	)
}
