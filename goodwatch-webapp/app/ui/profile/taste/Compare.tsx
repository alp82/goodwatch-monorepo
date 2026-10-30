// Compare-to-me for a signed-in visitor, at the top of someone else's Taste tab: the match card (the tier word, the
// percentage, both avatars) with a full-width row at its foot that opens "Where your tastes meet" right under it. The
// section is told through titles, not tags: what only they love, what you both love and what only you love, where your
// scores split on titles you both rated, and picks for each other.
// PROTOTYPE OPTIONS (member nav, round 13): the row's label, nav-options.ts `meet`.
import {
	ArrowRightIcon,
	ChevronDownIcon,
	SparklesIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	AnimatePresence,
	animate,
	motion,
	useReducedMotion,
} from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { RATE_FALLBACK_PATH } from "~/domain/member-paths"
import type { ProfileShell, ProfileTitle } from "~/domain/profile"
import { type MemberCompare, matchTier } from "~/domain/profile-taste"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { DISPLAY } from "~/ui/my-pages/bits"
import { type NavOptions, useNavOptions } from "~/ui/navigation/nav-options"
import { PANEL_CARD_SIZES, ProfileCard } from "../ProfileCard"
import { ProfileAvatar } from "../ProfileFrame"
import { COMPARE_ID, onCompareRequest, scrollUnderRows } from "../compare-link"
import { matchColor, matchStrength } from "../match"
import { AMBER_BUTTON, TILE, posterUrl, vibe } from "../parts"
import { PANEL } from "./parts"

type Ready = Extract<MemberCompare, { status: "ready" }>

/** PROTOTYPE OPTIONS (round 13): the row's label. */
const MEET_LABEL: Record<NavOptions["meet"], string> = {
	meet: "Where your tastes meet",
	share: "See what you share",
	compare: "Compare your tastes side by side",
	both: "What you both love, and where you split",
}

/**
 * The match card and, at its foot, the way into "Where your tastes meet": one full-width row under a hairline that
 * opens and closes the section. The section follows right under the card, fading and sliding in; the page below moves
 * down with it. The header's match chip opens it too (compare-link.ts): in place on this tab, or by #compare on arrival.
 */
export function TasteMatch({
	shell,
	compare,
}: { shell: ProfileShell; compare: MemberCompare }) {
	const still = useReducedMotion() ?? false
	const label = MEET_LABEL[useNavOptions().meet]
	const [open, setOpen] = useState(false)
	const row = useRef<HTMLButtonElement>(null)
	// Set by the chip or #compare: once the section is open, scroll the row to just under the sticky rows.
	const [scroll, setScroll] = useState(0)
	useEffect(() => {
		const reveal = () => {
			setOpen(true)
			setScroll((n) => n + 1)
		}
		if (window.location.hash === `#${COMPARE_ID}`) reveal()
		return onCompareRequest(reveal)
	}, [])
	useEffect(() => {
		if (scroll && open && row.current) scrollUnderRows(row.current)
	}, [scroll, open])
	if (compare.status === "thin")
		return <ThinMatch compare={compare} handle={shell.handle} />
	const toggle = () => {
		// A closed section drops #compare, so a reload starts closed.
		if (open && window.location.hash === `#${COMPARE_ID}`)
			window.history.replaceState(
				window.history.state,
				"",
				window.location.pathname + window.location.search,
			)
		setOpen(!open)
	}
	// `layout` makes this a member of the page's LayoutGroup, so the content below slides when the section opens or
	// closes; popLayout takes a closing section out of the flow at once.
	return (
		<motion.div
			layout={still ? false : "position"}
			className="relative flex flex-col gap-4"
		>
			<MatchCard shell={shell} compare={compare}>
				<button
					ref={row}
					type="button"
					aria-expanded={open}
					aria-controls={COMPARE_ID}
					onClick={toggle}
					className="group flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-b-[23px] px-5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:px-6"
					data-compare-row
				>
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-gray-100 group-hover:text-white sm:text-base">
							{label}
						</span>
						<span className="block text-xs text-gray-500">
							Overlap, splits, and picks for each other
						</span>
					</span>
					<ChevronDownIcon
						className={`size-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-white ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
			</MatchCard>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={COMPARE_ID}
						aria-label={label}
						className="flex flex-col gap-4"
						initial={{ opacity: 0, y: still ? 0 : -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -10 }}
						transition={{ duration: still ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
					>
						<Meet handle={shell.handle} c={compare} />
					</motion.section>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

/** "Where your tastes meet", trimmed for its place under the card: the overlap, then the splits and the picks. */
function Meet({ handle, c }: { handle: string; c: Ready }) {
	return (
		<>
			<Overlap handle={handle} c={c} />
			{(c.shared.length > 0 ||
				c.overlap.onlyThem.length > 0 ||
				c.overlap.onlyYou.some((x) => x.wished)) && (
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
					{c.shared.length > 0 && <Splits handle={handle} c={c} />}
					<Picks handle={handle} c={c} />
				</div>
			)}
		</>
	)
}

// ---------- The match card ----------

function CountUp({ to, still }: { to: number; still: boolean }) {
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
function ThinMatch({
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

/** Their avatar and yours, overlapping. */
function Avatars({ shell }: { shell: ProfileShell }) {
	const me = useAccountSummary()
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="md" />
			<span className="-ml-4">
				<ProfileAvatar
					handle={me.handle ?? me.initial}
					avatar={{ url: me.avatarUrl, color: me.color }}
					size="md"
				/>
			</span>
		</span>
	)
}

/** The signed-in visitor's match with the owner: the ring, the tier word, what pulls you both, the counts, and both
 * avatars; `children` is the row at the card's foot, under a hairline. */
function MatchCard({
	shell,
	compare,
	children,
}: { shell: ProfileShell; compare: Ready; children: ReactNode }) {
	const still = useReducedMotion() ?? false
	const p = compare.percent
	const s = matchStrength(p)
	const color = matchColor(p)
	const splits = compare.shared.filter(
		(r) => Math.abs(r.yours - r.theirs) >= 3,
	).length
	const pulls = compare.pulls
	const R = 52
	const C = 2 * Math.PI * R
	return (
		<section
			aria-label="Taste match"
			className="relative overflow-hidden rounded-3xl p-px"
			style={{ background: `color-mix(in srgb, ${color} 30%, transparent)` }}
		>
			{/* A light that runs round the border: faster and brighter the closer the match. */}
			{!still && (
				<motion.span
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[150%]"
					style={{
						x: "-50%",
						y: "-50%",
						opacity: 0.25 + s * 0.75,
						background: `conic-gradient(from 0deg, transparent 0 62%, ${color} 80%, transparent 92%)`,
					}}
					animate={{ rotate: 360 }}
					transition={{
						duration: 16 - s * 9,
						ease: "linear",
						repeat: Number.POSITIVE_INFINITY,
					}}
				/>
			)}
			<div
				className="relative rounded-[23px] bg-gray-950"
				style={{
					backgroundImage: `radial-gradient(90% 120% at 0% 40%, color-mix(in srgb, ${color} ${8 + s * 16}%, transparent), transparent 65%)`,
				}}
			>
				<div className="grid items-center gap-x-8 gap-y-5 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
					<div className="flex items-center gap-5 md:block">
						<div className="relative size-28 shrink-0 sm:size-32">
							{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative, aria-hidden; the numbers beside it carry the meaning */}
							<svg
								viewBox="0 0 120 120"
								className="size-full -rotate-90"
								aria-hidden
							>
								<circle
									cx="60"
									cy="60"
									r={R}
									fill="none"
									stroke="rgba(255,255,255,.08)"
									strokeWidth="9"
								/>
								<motion.circle
									cx="60"
									cy="60"
									r={R}
									fill="none"
									stroke={color}
									strokeWidth="9"
									strokeLinecap="round"
									strokeDasharray={`${((C * p) / 100).toFixed(1)} ${C.toFixed(1)}`}
									initial={still ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.8 }}
								/>
							</svg>
							<span className="absolute inset-0 flex flex-col items-center justify-center">
								<span
									className="text-4xl leading-none font-black tabular-nums"
									style={{ color }}
								>
									<CountUp to={p} still={still} />
									<span className="text-xl">%</span>
								</span>
								<span className="mt-1 text-[10px] font-bold tracking-wider text-gray-500 uppercase">
									match
								</span>
							</span>
						</div>
						<div className="flex flex-col items-start gap-2 md:hidden">
							<Avatars shell={shell} />
							<p className="text-sm text-gray-400">
								You and <b className="text-gray-200">@{shell.handle}</b>
							</p>
						</div>
					</div>

					<div className="flex min-w-0 flex-col gap-3">
						<div>
							<p className="hidden text-xs font-bold tracking-[0.18em] text-gray-500 uppercase md:block">
								You and @{shell.handle}
							</p>
							<h2 className={`${DISPLAY} text-3xl sm:text-4xl`}>
								<span
									className="relative inline-block overflow-hidden"
									style={{ color }}
								>
									{matchTier(p)}
									{/* A sheen across the word; it passes more often for a closer match. */}
									{!still && (
										<motion.span
											aria-hidden
											className="absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-white/40 to-transparent"
											animate={{ x: ["0%", "400%"] }}
											transition={{
												duration: 1.4,
												ease: "easeInOut",
												repeat: Number.POSITIVE_INFINITY,
												repeatDelay: 7 - s * 4,
											}}
										/>
									)}
								</span>
							</h2>
							{(pulls.both.length > 0 ||
								(pulls.onlyThem[0] && pulls.onlyYou[0])) && (
								<p className="mt-1 text-sm text-gray-300">
									{pulls.both.length > 0 && (
										<>
											You both go for{" "}
											{pulls.both.slice(0, 2).join(" and ").toLowerCase()}.{" "}
										</>
									)}
									{pulls.onlyThem[0] && pulls.onlyYou[0] && (
										<>
											They chase {pulls.onlyThem[0].toLowerCase()}; you chase{" "}
											{pulls.onlyYou[0].toLowerCase()}.
										</>
									)}
								</p>
							)}
						</div>
						<dl className="flex gap-5 text-sm">
							<div>
								<dt className="text-[11px] text-gray-500">Both love</dt>
								<dd className="font-black text-white tabular-nums">
									{compare.overlap.bothCount}
								</dd>
							</div>
							<div>
								<dt className="text-[11px] text-gray-500">Rated by both</dt>
								<dd className="font-black text-white tabular-nums">
									{compare.shared.length}
								</dd>
							</div>
							<div>
								<dt className="text-[11px] text-gray-500">Big splits</dt>
								<dd className="font-black text-white tabular-nums">{splits}</dd>
							</div>
						</dl>
					</div>

					<div className="hidden md:block">
						<Avatars shell={shell} />
					</div>
				</div>
				<div aria-hidden className="h-px bg-white/10" />
				{children}
			</div>
		</section>
	)
}

// ---------- The overlap ----------

function Fan({
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

function Region({
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

function Overlap({ handle, c }: { handle: string; c: Ready }) {
	const overlap = c.overlap
	const both = overlap.both.slice(0, 3)
	const them = overlap.onlyThem.slice(0, 4)
	const you = overlap.onlyYou.slice(0, 4)
	return (
		<div className={`${PANEL} relative overflow-hidden p-4 sm:p-6`}>
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

function Splits({ handle, c }: { handle: string; c: Ready }) {
	const shared = c.shared
	const [all, setAll] = useState(false)
	const rows = all ? shared : shared.slice(0, 6)
	const at = (score: number) => `${((score - 1) / 9) * 100}%`
	return (
		<div className={`${PANEL} flex flex-col gap-3 p-4 sm:p-5`}>
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

function Dot({ at, score, ring }: { at: string; score: number; ring: string }) {
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

function Picks({ handle, c }: { handle: string; c: Ready }) {
	const forYou = c.overlap.onlyThem.slice(0, 4)
	const forThem = c.overlap.onlyYou.filter((x) => x.wished).slice(0, 4)
	if (!forYou.length && !forThem.length) return null
	return (
		<div className={`${PANEL} flex flex-col gap-4 p-4 sm:p-5`}>
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

function PickRow({
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
