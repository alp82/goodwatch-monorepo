// The comparison's shared pieces: the three panels of "Where your tastes meet" (Overlap, Splits, Picks) and small
// helpers. Each panel takes `frame`, the classes of its surface (a boxed PANEL by default); the strip (Strip.tsx) passes
// "" and separates them itself.
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { animate } from "framer-motion"
import { useEffect, useState } from "react"
import { RATE_FALLBACK_PATH } from "~/domain/member-paths"
import type { ProfileTitle } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { PANEL_CARD_SIZES, ProfileCard } from "../../ProfileCard"
import { AMBER_BUTTON, TILE, posterUrl, vibe } from "../../parts"
import { PANEL } from "../parts"

export type Ready = Extract<MemberCompare, { status: "ready" }>

interface PanelProps {
	handle: string
	c: Ready
	/** The panel's surface classes; "" drops the box. */
	frame?: string
}

export function CountUp({ to, still }: { to: number; still: boolean }) {
	const [n, setN] = useState(to)
	useEffect(() => {
		if (still) {
			setN(to)
			return
		}
		const run = animate(0, to, {
			duration: 1.1,
			ease: [0.16, 1, 0.3, 1],
			onUpdate: (v) => setN(Math.round(v)),
		})
		return () => run.stop()
	}, [to, still])
	return <>{n}</>
}

/** Too few liked titles on one side to compare: the visitor's (rate more) or the owner's (nothing to do). */
export function ThinMatch({
	compare,
	handle,
}: { compare: Extract<MemberCompare, { status: "thin" }>; handle: string }) {
	if (compare.side === "them")
		return (
			<div className={`${TILE} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
				<SparklesIcon className="size-7 shrink-0 text-gray-500" aria-hidden />
				<p className="min-w-[12rem] flex-1 text-gray-300">
					<b className="text-white">
						@{handle} hasn't rated enough yet to compare.
					</b>
				</p>
			</div>
		)
	return (
		<div className={`${TILE} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
			<SparklesIcon className="size-7 shrink-0 text-amber-400" aria-hidden />
			<p className="min-w-[12rem] flex-1 text-gray-300">
				<b className="text-white">Rate 5 titles you love to see your match.</b>{" "}
				You have {compare.liked} so far.
			</p>
			<Link to={RATE_FALLBACK_PATH} className={AMBER_BUTTON}>
				Rate titles
				<ArrowRightIcon className="size-4" aria-hidden />
			</Link>
		</div>
	)
}

// ---------- The overlap ----------

export function Fan({
	titles,
	size,
	label,
}: { titles: ProfileTitle[]; size: "sm" | "lg"; label: string }) {
	const n = titles.length
	const w = size === "lg" ? "w-[4.6rem] sm:w-24" : "w-14 sm:w-[4.5rem]"
	return (
		<ul className="flex justify-center" aria-label={label}>
			{titles.map((t, i) => {
				const mid = (n - 1) / 2
				const turn = (i - mid) * (size === "lg" ? 7 : 9)
				const lift = Math.abs(i - mid) * (size === "lg" ? 7 : 6)
				return (
					<li
						key={t.key}
						className={`${w} shrink-0 ${i ? (size === "lg" ? "-ml-6 sm:-ml-8" : "-ml-5 sm:-ml-6") : ""}`}
						style={{
							transform: `translateY(${lift}px) rotate(${turn}deg)`,
							zIndex: 10 - Math.round(Math.abs(i - mid)),
						}}
					>
						<Link to={t.href} title={t.title} className="block">
							{t.poster ? (
								<img
									src={posterUrl(t.poster) ?? ""}
									alt={t.title}
									loading="lazy"
									className="aspect-[2/3] w-full rounded-lg object-cover shadow-xl ring-2 ring-gray-950"
								/>
							) : (
								<span className="block aspect-[2/3] w-full rounded-lg bg-white/10" />
							)}
						</Link>
					</li>
				)
			})}
		</ul>
	)
}

export function Region({
	title,
	count,
	children,
	tone,
}: { title: string; count: string; children: React.ReactNode; tone: string }) {
	return (
		<div className="flex flex-col items-center gap-3">
			<p className="text-center">
				<span
					className={`block text-[11px] font-bold tracking-wide uppercase ${tone}`}
				>
					{title}
				</span>
				<span className="block text-xs text-gray-500">{count}</span>
			</p>
			{children}
		</div>
	)
}

export function Overlap({ handle, c, frame = PANEL }: PanelProps) {
	const overlap = c.overlap
	const both = overlap.both.slice(0, 3)
	const them = overlap.onlyThem.slice(0, 4)
	const you = overlap.onlyYou.slice(0, 4)
	return (
		<div className={`${frame} relative overflow-hidden p-4 sm:p-6`}>
			{/* Two circles that overlap: theirs amber, yours white. Drawn behind three poster fans on wide screens. */}
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative, aria-hidden; the numbers beside it carry the meaning */}
			<svg
				viewBox="0 0 1000 420"
				preserveAspectRatio="xMidYMid meet"
				className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
				aria-hidden
			>
				<defs>
					<radialGradient id="ov-them" cx="35%" cy="50%" r="40%">
						<stop offset="0" stopColor="#fbbf24" stopOpacity=".12" />
						<stop offset="1" stopColor="#fbbf24" stopOpacity=".02" />
					</radialGradient>
					<radialGradient id="ov-you" cx="65%" cy="50%" r="40%">
						<stop offset="0" stopColor="#ffffff" stopOpacity=".1" />
						<stop offset="1" stopColor="#ffffff" stopOpacity=".02" />
					</radialGradient>
				</defs>
				<circle
					cx="355"
					cy="210"
					r="195"
					fill="url(#ov-them)"
					stroke="#fbbf24"
					strokeOpacity=".45"
					strokeWidth="1.5"
				/>
				<circle
					cx="645"
					cy="210"
					r="195"
					fill="url(#ov-you)"
					stroke="#ffffff"
					strokeOpacity=".4"
					strokeWidth="1.5"
				/>
			</svg>
			<div className="relative grid gap-8 md:min-h-[22rem] md:grid-cols-[1fr_0.9fr_1fr] md:items-center md:gap-2 md:px-[4%]">
				<Region
					title={`Only @${handle} loves`}
					count={`${overlap.onlyThemCount} of their 9s and 10s you haven't rated`}
					tone="text-amber-300"
				>
					<Fan titles={them} size="sm" label={`Loved by @${handle}`} />
				</Region>
				<Region
					title="You both love"
					count={`${overlap.bothCount} titles you both scored 8 or more`}
					tone="text-white"
				>
					<Fan titles={both} size="lg" label="Loved by you both" />
				</Region>
				<Region
					title="Only you love"
					count={`${overlap.onlyYouCount} of your 8s and up they haven't rated`}
					tone="text-gray-200"
				>
					<Fan titles={you} size="sm" label="Loved by you" />
				</Region>
			</div>
		</div>
	)
}

// ---------- Where you split ----------

export function Splits({ handle, c, frame = PANEL }: PanelProps) {
	const shared = c.shared
	const [all, setAll] = useState(false)
	const rows = all ? shared : shared.slice(0, 6)
	const at = (score: number) => `${((score - 1) / 9) * 100}%`
	return (
		<div className={`${frame} flex flex-col gap-3 p-4 sm:p-5`}>
			<div className="flex flex-wrap items-baseline gap-x-3">
				<p className="font-bold text-white">Where you split</p>
				<p className="text-xs text-gray-400">
					{shared.length} titles you both rated, widest gap first ·{" "}
					<span className="inline-flex items-center gap-1">
						<span className="size-2 rounded-full bg-amber-400" aria-hidden />@
						{handle}
					</span>{" "}
					<span className="inline-flex items-center gap-1">
						<span className="size-2 rounded-full bg-white" aria-hidden />
						you
					</span>
				</p>
			</div>
			<ul className="flex flex-col gap-1">
				{rows.map((r) => {
					const lo = Math.min(r.yours, r.theirs)
					const hi = Math.max(r.yours, r.theirs)
					const wide = hi - lo >= 3
					return (
						<li
							key={r.key}
							className="grid grid-cols-[2rem_minmax(0,7rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[2rem_minmax(0,10rem)_minmax(0,1fr)]"
						>
							<span className="block w-8">
								{r.poster && (
									<img
										src={posterUrl(r.poster, "w92") ?? ""}
										alt=""
										loading="lazy"
										className="aspect-[2/3] w-full rounded object-cover"
									/>
								)}
							</span>
							<Link
								to={r.href}
								className="truncate text-sm font-semibold text-gray-200 hover:text-white"
							>
								{r.title}
							</Link>
							<span
								className="relative mx-3 h-8"
								aria-label={`@${handle} ${r.theirs}, you ${r.yours}`}
							>
								<span className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
								<span
									className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${wide ? "bg-rose-400/70" : "bg-white/30"}`}
									style={{ left: at(lo), width: `${((hi - lo) / 9) * 100}%` }}
								/>
								<Dot at={at(r.theirs)} score={r.theirs} ring="ring-amber-400" />
								<Dot at={at(r.yours)} score={r.yours} ring="ring-white" />
							</span>
						</li>
					)
				})}
			</ul>
			{shared.length > 6 && (
				<button
					type="button"
					onClick={() => setAll(!all)}
					className="self-start text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					{all ? "Show fewer" : `Show all ${shared.length}`}
				</button>
			)}
		</div>
	)
}

export function Dot({ at, score, ring }: { at: string; score: number; ring: string }) {
	return (
		<span
			className={`absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-black text-gray-950 ring-2 ${ring}`}
			style={{ left: at, background: vibe(score) }}
		>
			{score}
		</span>
	)
}

// ---------- Picks for each other ----------

export function Picks({ handle, c, frame = PANEL }: PanelProps) {
	const forYou = c.overlap.onlyThem.slice(0, 4)
	const forThem = c.overlap.onlyYou.filter((x) => x.wished).slice(0, 4)
	if (!forYou.length && !forThem.length) return null
	return (
		<div className={`${frame} flex flex-col gap-4 p-4 sm:p-5`}>
			<div>
				<p className="font-bold text-white">Picks for each other</p>
				<p className="text-xs text-gray-400">
					Their favorites that carry what you seek, and yours already on their
					wishlist.
				</p>
			</div>
			<PickRow
				title={`From @${handle}'s favorites, for you`}
				items={forYou.map((t) => ({
					t,
					note: t.why
						? `For your ${t.why.toLowerCase()}`
						: `They scored it ${t.score}`,
				}))}
			/>
			<PickRow
				title={`You loved these; @${handle} wants to see them`}
				items={forThem.map((t) => ({ t, note: `You scored it ${t.yours}` }))}
			/>
		</div>
	)
}

export function PickRow({
	title,
	items,
}: { title: string; items: { t: ProfileTitle; note: string }[] }) {
	if (!items.length) return null
	return (
		<div>
			<p className="mb-2 text-xs font-semibold text-gray-300">{title}</p>
			<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{items.map(({ t, note }, i) => (
					<li
						key={t.key}
						className={`flex min-w-0 flex-col gap-1 ${i === 3 ? "max-sm:hidden" : ""}`}
					>
						<ProfileCard title={t} posterSizes={PANEL_CARD_SIZES} />
						<span className="block truncate text-[11px] text-gray-500">
							{note}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
