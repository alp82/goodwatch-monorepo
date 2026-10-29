// The parts of the old Overview that a visitor's Taste profile keeps (ui/profile/pages/TasteProfilePage.tsx): the taste
// match (a signed-in visitor), a sign-up card (a signed-out visitor), every 10, and the hot takes. Every part follows the
// owner's "who sees what".
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { animate, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import {
	type ProfileOverview,
	type ProfilePart,
	type ProfileShell,
	type ProfileTitle,
	seesPart,
} from "~/domain/profile"
import { RATE_FALLBACK_PATH } from "~/domain/member-paths"
import { type MemberCompare, matchTier } from "~/domain/profile-taste"
import type { Score } from "~/server/scores.server"
import { RowScores, rowMark, useRowMarks } from "~/ui/list-row/RowScores"
import { DISPLAY } from "~/ui/my-pages/bits"
import { profileTabPath } from "./links"
import { matchColor, matchStrength } from "./match"
import {
	AMBER_BUTTON,
	PosterImg,
	ProfilePoster,
	TILE,
	count,
	posterOwner,
} from "./parts"
import { Whorl, type WhorlAttribute } from "./taste/Whorl"

/** What the match card shows of the owner's fingerprint: their print. */
export interface OverviewTaste {
	identity: string | null
	line: string
	avoid: string[]
	attributes: WhorlAttribute[]
}

/**
 * The parts of the old Overview that a visitor's Taste profile keeps, under the portrait: the taste match (a signed-in
 * visitor) or the way to one (a signed-out visitor), every 10, and the hot takes. Each follows the owner's "who sees
 * what".
 */
export function Overview({
	shell,
	overview,
	taste,
	compare,
}: {
	shell: ProfileShell
	overview: ProfileOverview
	taste: OverviewTaste | null
	compare: MemberCompare | null
}) {
	const see = (part: ProfilePart) => seesPart(shell, part)
	const owner = shell.viewer === "owner"
	const tier = (score: number) =>
		`${profileTabPath(shell.handle, "scores")}#tier-${score}`
	return (
		<>
			{/* The match and the way to it show whatever the owner shares: they compare whole tastes, not one part. */}
			{shell.viewer === "guest" && <GuestMatch handle={shell.handle} />}
			{shell.viewer === "member" && compare && (
				<MatchCard shell={shell} compare={compare} taste={taste} />
			)}

			{see("scores") && overview.favorites.length > 0 && (
				<Section
					title="Their 10s"
					note="Every 10, latest watched first"
					more={{
						to: tier(10),
						label: `See all ${count(shell.spread[9] ?? overview.favorites.length)}`,
					}}
				>
					<ol className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 lg:grid-cols-8">
						{overview.favorites.slice(0, 8).map((title, i) => (
							<li
								key={title.key}
								className={`min-w-0 ${i >= 6 ? "max-lg:hidden" : i >= 4 ? "max-sm:hidden" : ""}`}
							>
								<ProfilePoster
									title={title}
									owner={posterOwner(shell)}
									sizes={FAVORITE_SIZES}
								/>
							</li>
						))}
					</ol>
				</Section>
			)}

			{see("scores") && overview.hotTakes.length > 0 && (
				<Section
					title="Hot takes"
					note={`Where ${owner ? "you part" : "they part"} with everyone most`}
				>
					<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{overview.hotTakes.map(({ title, delta }) => (
							<HotTake
								key={title.key}
								title={title}
								delta={delta}
								owner={owner ? null : `@${shell.handle}`}
							/>
						))}
					</ul>
				</Section>
			)}
		</>
	)
}

/**
 * One hot take: the title and how far the owner's score is from everyone's, then the score pill (GoodWatch and the
 * viewer's own score) and, on another member's profile, their score. `owner`: their handle; null on your own.
 */
function HotTake({
	title,
	delta,
	owner,
}: { title: ProfileTitle; delta: number; owner: string | null }) {
	const marks = useRowMarks()(title.mediaType, title.tmdbId)
	return (
		<li className="min-w-0">
			<Link
				to={title.href}
				className={`${TILE} flex items-center gap-3 p-2.5 hover:bg-white/[0.06]`}
			>
				<span className="block w-9 shrink-0">
					<PosterImg title={title} className="rounded" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-gray-200">
						{title.title}
					</span>
					<span
						className={`block text-xs font-bold tabular-nums ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
					>
						{delta > 0 ? "+" : "−"}
						{Math.abs(delta).toFixed(1)} vs everyone
					</span>
				</span>
				<RowScores
					goodwatch={title.gw}
					score={marks.score}
					mark={rowMark(marks)}
					owner={owner ? (title.score as Score | null) : null}
					ownerName={owner}
				/>
			</Link>
		</li>
	)
}

function Section({
	title,
	note,
	count: n,
	more,
	children,
}: {
	title: string
	note?: string
	count?: number
	more?: { to: string; label: string }
	children: ReactNode
}) {
	return (
		<section className="flex min-w-0 flex-col gap-4">
			<h2 className="flex flex-wrap items-baseline gap-x-3 border-b border-white/10 pb-2">
				<span className={`${DISPLAY} text-2xl`}>{title}</span>
				{n != null && (
					<span className="text-sm font-bold text-gray-500">{n}</span>
				)}
				{note && <span className="text-sm text-gray-500">{note}</span>}
				{more && (
					<Link
						to={more.to}
						className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-amber-500 hover:text-amber-400"
					>
						{more.label}
						<ArrowRightIcon className="size-4" aria-hidden />
					</Link>
				)}
			</h2>
			{children}
		</section>
	)
}

// ---------- Match ----------

function GuestMatch({ handle }: { handle: string }) {
	return (
		<div className={`${TILE} flex flex-wrap items-center gap-4 p-4 sm:p-5`}>
			<span className="text-3xl font-black text-gray-600 tabular-nums">
				??%
			</span>
			<p className="min-w-[12rem] flex-1 text-gray-300">
				<b className="text-white">See how your taste matches @{handle}.</b> Rate
				a few titles you love and GoodWatch shows what you share.
			</p>
			<Link to="/sign-up" rel="nofollow" className={AMBER_BUTTON}>
				Sign up free
			</Link>
		</div>
	)
}

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
	// `side` says whose taste is too thin; without it, it's the visitor's.
	const side = (compare as { side?: "you" | "them" }).side ?? "you"
	if (side === "them")
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
			</Link>
		</div>
	)
}

/** The signed-in visitor's match with the owner: the ring, the tier word, what pulls you both, the titles you both love,
 * the two prints, and the way to the comparison. */
function MatchCard({
	shell,
	compare,
	taste,
}: {
	shell: ProfileShell
	compare: MemberCompare
	taste: OverviewTaste | null
}) {
	const still = useReducedMotion() ?? false
	const compareHref = `${profileTabPath(shell.handle, "stats")}#compare`
	if (compare.status === "thin")
		return <ThinMatch compare={compare} handle={shell.handle} />
	const p = compare.percent
	const s = matchStrength(p)
	const color = matchColor(p)
	const loved = compare.overlap.both
	const splits = compare.shared.filter(
		(r) => Math.abs(r.yours - r.theirs) >= 3,
	).length
	const pulls = compare.pulls
	const R = 52
	const C = 2 * Math.PI * R
	const yours: WhorlAttribute[] | null = taste
		? taste.attributes.map((a) => ({
				...a,
				edge: compare.yourEdges[a.key]?.edge ?? 0,
			}))
		: null
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
				className="relative grid items-center gap-x-8 gap-y-5 rounded-[23px] bg-gray-950 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto]"
				style={{
					backgroundImage: `radial-gradient(90% 120% at 0% 50%, color-mix(in srgb, ${color} ${8 + s * 16}%, transparent), transparent 65%)`,
				}}
			>
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
					<p className="text-sm text-gray-400 md:hidden">
						You and <b className="text-gray-200">@{shell.handle}</b>
					</p>
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
					<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
						{loved.length > 0 && (
							<ul className="flex pl-1" aria-label="Titles you both love">
								{loved.slice(0, 5).map((t, i, all) => {
									const mid = (all.length - 1) / 2
									return (
										<motion.li
											key={t.key}
											className={`w-11 shrink-0 ${i ? "-ml-4" : ""}`}
											style={{
												rotate: (i - mid) * 6,
												zIndex: 10 - Math.round(Math.abs(i - mid)),
											}}
											initial={still ? false : { opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: Math.abs(i - mid) * 3 }}
											transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
										>
											<PosterImg
												title={t}
												className="rounded-md shadow-lg ring-2 ring-gray-950"
											/>
										</motion.li>
									)
								})}
							</ul>
						)}
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
				</div>

				<div className="flex items-center gap-4 md:flex-col md:items-end">
					{taste && yours && (
						<div className="relative hidden h-24 w-44 sm:block" aria-hidden>
							<span className="absolute top-0 left-0 block w-24">
								<Whorl
									attributes={taste.attributes}
									turns={11}
									rim={false}
									label=""
									animate={false}
									className="w-full"
								/>
							</span>
							<span className="absolute top-0 right-0 block w-24 opacity-80">
								<Whorl
									attributes={yours}
									turns={11}
									rim={false}
									label=""
									animate={false}
									className="w-full"
								/>
							</span>
						</div>
					)}
					{/* The full comparison lives on the Taste tab, so it needs Taste to be shared with members. */}
					{seesPart(shell, "taste") && (
						<Link
							to={compareHref}
							className={`${AMBER_BUTTON} max-sm:w-full max-sm:justify-center`}
						>
							Compare tastes
							<ArrowRightIcon className="size-4" aria-hidden />
						</Link>
					)}
				</div>
			</div>
		</section>
	)
}

const FAVORITE_SIZES: [string | null, string][] = [
	["(min-width: 1024px)", "130px"],
	["(min-width: 640px)", "16vw"],
	[null, "25vw"],
]
