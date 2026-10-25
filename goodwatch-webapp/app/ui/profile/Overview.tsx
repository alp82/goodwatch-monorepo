// The profile's Overview below the header: the taste match (a signed-in visitor), a sign-up card (a signed-out
// visitor), Favorites (every 10), the Taste card next to the score spread, the activity row (latest ratings, watching
// now, newest on the wishlist), Lists and Hot takes. Every part follows the owner's "who sees what".
import {
	ArrowRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	LinkIcon,
	SparklesIcon,
} from "@heroicons/react/20/solid"
import { Link, useNavigate } from "@remix-run/react"
import { animate, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import {
	type ProfileOverview,
	type ProfilePart,
	type ProfileShell,
	type ProfileTitle,
	seesPart,
} from "~/domain/profile"
import { type MemberCompare, matchTier } from "~/domain/profile-taste"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { scoreLabels } from "~/utils/ratings"
import { profileTabPath } from "./links"
import { matchColor, matchStrength } from "./match"
import {
	AMBER_BUTTON,
	PosterImg,
	ScoreChip,
	ScoredPoster,
	SpreadBars,
	TILE,
	count,
	posterUrl,
	shortDate,
	vibe,
} from "./parts"
import { Whorl, type WhorlAttribute } from "./taste/Whorl"
import {
	CRAFT_KEYS,
	FAMILY_COLOR,
	type FamilyId,
	theirLine,
} from "./taste/model"

/** What Overview shows of the owner's fingerprint: the Taste card and the match card's print. */
export interface OverviewTaste {
	identity: string | null
	line: string
	avoid: string[]
	attributes: WhorlAttribute[]
}

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
	const navigate = useNavigate()
	const see = (part: ProfilePart) => seesPart(shell, part)
	const owner = shell.viewer === "owner"
	const tier = (score: number) =>
		`${profileTabPath(shell.handle, "scores")}#tier-${score}`
	const mostOften = shell.spread.indexOf(Math.max(...shell.spread)) + 1
	return (
		<div className={`${WRAP} flex flex-col gap-12 pt-8 pb-32 text-white`}>
			{/* The match and the way to it show whatever the owner shares: they compare whole tastes, not one part. */}
			{shell.viewer === "guest" && <GuestMatch handle={shell.handle} />}
			{shell.viewer === "member" && compare && (
				<MatchCard shell={shell} compare={compare} taste={taste} />
			)}

			{see("scores") && overview.favorites.length > 0 && (
				<Section
					title="Favorites"
					note="Every 10, latest watched first"
					more={{
						to: tier(10),
						label: `See all ${count(shell.spread[9] ?? overview.favorites.length)} masterpieces`,
					}}
				>
					<ol className="grid grid-cols-4 gap-3 sm:grid-cols-6 sm:gap-4 lg:grid-cols-8">
						{overview.favorites.slice(0, 8).map((title, i) => (
							<li
								key={title.key}
								className={`min-w-0 ${i >= 6 ? "max-lg:hidden" : i >= 4 ? "max-sm:hidden" : ""}`}
							>
								<ScoredPoster title={title} />
								<p className="mt-2 truncate text-xs font-semibold text-gray-200 sm:text-sm">
									{title.title}
								</p>
								<p className="text-xs text-gray-500">{title.year}</p>
							</li>
						))}
					</ol>
				</Section>
			)}

			{((see("taste") && taste) || see("scores")) && (
				<div className="grid gap-6 lg:grid-cols-2">
					{see("taste") && taste && (
						<Section
							title="Taste"
							more={{
								to: profileTabPath(shell.handle, "stats"),
								label: "Full taste",
							}}
						>
							<TasteCard taste={taste} handle={shell.handle} owner={owner} />
						</Section>
					)}
					{see("scores") && shell.counts.rated > 0 && (
						<Section
							title="Scores"
							more={{
								to: profileTabPath(shell.handle, "scores"),
								label: "All scores by tier",
							}}
						>
							<div className={`${TILE} flex h-full flex-col gap-5 p-5 pt-8`}>
								<SpreadBars
									spread={shell.spread}
									average={shell.counts.average}
									onPick={(score) => navigate(tier(score))}
								/>
								<p className="text-sm text-gray-400">
									Most often <b className="text-white">{mostOften}</b> (
									{scoreLabels[mostOften]}). {count(shell.spread[9] ?? 0)}{" "}
									masterpieces out of {count(shell.counts.rated)}. Pick a bar to
									see its titles.
								</p>
								<Link
									to={profileTabPath(shell.handle, "scores")}
									className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-amber-500 hover:text-amber-400"
								>
									Every score, grouped by tier
									<ArrowRightIcon className="size-4" aria-hidden />
								</Link>
							</div>
						</Section>
					)}
				</div>
			)}

			{see("activity") && <ActivityRow shell={shell} overview={overview} />}

			{see("lists") && overview.lists.length > 0 && (
				<Section
					title="Lists"
					count={overview.lists.length}
					more={{
						to: profileTabPath(shell.handle, "lists"),
						label: "All lists",
					}}
				>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{overview.lists.map((list) => (
							<Link
								key={list.id}
								to={list.href}
								className={`${TILE} group flex min-w-0 flex-col gap-3 p-4 hover:bg-white/[0.06]`}
							>
								<span className="flex -space-x-4" aria-hidden>
									{list.posters.map((p, i) => (
										<span
											// biome-ignore lint/suspicious/noArrayIndexKey: a list's posters in rank order
											key={i}
											className="block w-14 sm:w-16"
											style={{ zIndex: 10 - i }}
										>
											{p ? (
												<img
													src={posterUrl(p) ?? ""}
													alt=""
													loading="lazy"
													className="aspect-[2/3] w-full rounded-md object-cover shadow-lg ring-2 ring-gray-950"
												/>
											) : (
												<span className="block aspect-[2/3] w-full rounded-md bg-white/10" />
											)}
										</span>
									))}
								</span>
								<span className="flex items-center gap-1.5 font-bold text-gray-100 group-hover:text-white">
									<LinkIcon className="size-4 text-gray-500" aria-hidden />
									{list.title}
								</span>
							</Link>
						))}
					</div>
				</Section>
			)}

			{see("scores") && overview.hotTakes.length > 0 && (
				<Section
					title="Hot takes"
					note={`Where ${owner ? "you part" : "they part"} with everyone most`}
					more={
						see("taste")
							? {
									to: `${profileTabPath(shell.handle, "stats")}#everyone`,
									label: owner ? "You vs everyone" : "Them vs everyone",
								}
							: undefined
					}
				>
					<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{overview.hotTakes.map(({ title, delta }) => (
							<li key={title.key} className="min-w-0">
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
										{title.gw != null && (
											<span className="block text-xs text-gray-500">
												Everyone: {(title.gw / 10).toFixed(1)}
											</span>
										)}
									</span>
									<span
										className={`text-xs font-bold tabular-nums ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
									>
										{delta > 0 ? "+" : "−"}
										{Math.abs(delta).toFixed(1)}
									</span>
									<ScoreChip score={title.score} size="sm" />
								</Link>
							</li>
						))}
					</ul>
				</Section>
			)}
		</div>
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

// ---------- Taste card ----------

function TasteCard({
	taste,
	handle,
	owner,
}: { taste: OverviewTaste; handle: string; owner: boolean }) {
	const pulls = taste.attributes
		.filter((a) => !CRAFT_KEYS.has(a.key) && a.edge > 0)
		.sort((a, b) => b.edge - a.edge)
		.slice(0, 5)
	const byKey = new Map(taste.attributes.map((a) => [a.key, a]))
	const away = taste.avoid
		.map((k) => byKey.get(k))
		.filter((a): a is WhorlAttribute => a != null)
	return (
		<Link
			to={profileTabPath(handle, "stats")}
			prefetch="intent"
			className={`${TILE} group relative isolate flex h-full flex-col gap-4 overflow-hidden p-5 hover:bg-white/[0.06]`}
		>
			<div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
				<span className="block w-36 shrink-0 transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none sm:w-40">
					<Whorl
						attributes={taste.attributes}
						turns={12}
						rim={false}
						label={`Fingerprint of @${handle}`}
					/>
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<p className="text-[11px] font-bold tracking-[0.2em] text-amber-400 uppercase">
						Viewer type
					</p>
					<p className="text-2xl leading-tight font-black text-white">
						{taste.identity ?? "Taste forming"}
					</p>
					{taste.line && (
						<p className="text-sm text-gray-300">
							{owner ? taste.line : theirLine(taste.line)}
						</p>
					)}
				</div>
			</div>
			<ul className="flex flex-wrap gap-1.5" aria-label="Strongest pulls">
				{pulls.map((a) => (
					<li
						key={a.key}
						className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-gray-100 ring-1 ring-white/10"
					>
						<span
							aria-hidden
							className="size-2 rounded-full"
							style={{ background: FAMILY_COLOR[a.family as FamilyId] }}
						/>
						{a.label}
					</li>
				))}
				{away.map((a) => (
					<li
						key={a.key}
						className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-gray-500 ring-1 ring-white/10"
					>
						<span
							aria-hidden
							className="size-2 rounded-full"
							style={{
								boxShadow: `inset 0 0 0 1px ${FAMILY_COLOR[a.family as FamilyId]}`,
							}}
						/>
						Not {a.label.toLowerCase()}
					</li>
				))}
			</ul>
			<span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-amber-500 group-hover:text-amber-400">
				{owner
					? "Your fingerprint, sides and hot takes"
					: "Fingerprint, sides and hot takes"}
				<ArrowRightIcon className="size-4" aria-hidden />
			</span>
		</Link>
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
			<Link to="/taste" className={AMBER_BUTTON}>
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

// ---------- Activity ----------

type ActivityTab = "ratings" | "watching" | "wishlist"

/** The score in a corner ribbon, in its strip colour. */
function CornerScore({ score }: { score: number | null }) {
	if (!score) return null
	return (
		<span
			aria-label={`Scored ${score}`}
			className="pointer-events-none absolute top-0 left-0 size-11 overflow-hidden rounded-tl-lg"
		>
			<span
				className="absolute -top-[22px] -left-[22px] size-11 rotate-45"
				style={{ background: vibe(score) }}
			/>
			<span className="absolute top-0.5 left-1 text-[11px] font-black text-gray-950">
				{score}
			</span>
		</span>
	)
}

function Card({
	title,
	line,
	progress,
}: { title: ProfileTitle; line: string; progress?: number | null }) {
	return (
		<li className="w-32 shrink-0 snap-start sm:w-36">
			<Link
				to={title.href}
				className="group block overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10 hover:ring-white/25"
			>
				<span className="relative block">
					<PosterImg
						title={title}
						className="transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
					/>
					<CornerScore score={title.score} />
				</span>
				{progress != null && (
					<span
						className="block h-1 bg-white/10"
						aria-label={`${Math.round(progress * 100)}% watched`}
					>
						<span
							className="block h-full origin-left bg-emerald-400"
							style={{ transform: `scaleX(${progress})` }}
						/>
					</span>
				)}
				<span className="block px-2.5 py-2">
					<span className="block truncate text-sm font-semibold text-gray-100">
						{title.title}
					</span>
					<span className="block truncate text-xs text-gray-500">{line}</span>
				</span>
			</Link>
		</li>
	)
}

function ActivityRow({
	shell,
	overview,
}: { shell: ProfileShell; overview: ProfileOverview }) {
	const see = (part: ProfilePart) => seesPart(shell, part)
	const tabs: {
		id: ActivityTab
		label: string
		n: number
		more: { to: string; label: string }
	}[] = [
		...(see("scores") && overview.recent.length
			? [
					{
						id: "ratings" as const,
						label: "Latest ratings",
						n: overview.recent.length,
						more: {
							to: profileTabPath(shell.handle, "seen"),
							label: "Watch history",
						},
					},
				]
			: []),
		...(see("shows") && overview.watching.length
			? [
					{
						id: "watching" as const,
						label: "Watching now",
						n: overview.watching.length,
						more: {
							to: profileTabPath(shell.handle, "shows"),
							label: "All shows",
						},
					},
				]
			: []),
		...(see("wishlist") && overview.newestWishlist.length
			? [
					{
						id: "wishlist" as const,
						label: "Newest on the wishlist",
						n: shell.counts.wishlist,
						more: {
							to: profileTabPath(shell.handle, "wishlist"),
							label: "Wishlist",
						},
					},
				]
			: []),
	]
	const [tab, setTab] = useState<ActivityTab>(tabs[0]?.id ?? "ratings")
	const strip = useRef<HTMLUListElement>(null)
	const current = tabs.find((t) => t.id === tab) ?? tabs[0]
	if (!current) return null
	const scroll = (dir: number) =>
		strip.current?.scrollBy({
			left: dir * strip.current.clientWidth * 0.8,
			behavior: "smooth",
		})
	return (
		<section className="flex min-w-0 flex-col gap-3" aria-label="Activity">
			<div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-white/10">
				<div
					role="tablist"
					aria-label="Activity"
					className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]"
				>
					{tabs.map((t) => (
						<button
							key={t.id}
							type="button"
							role="tab"
							aria-selected={t.id === current.id}
							onClick={() => setTab(t.id)}
							className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2 text-sm font-semibold whitespace-nowrap sm:px-3 sm:text-base ${
								t.id === current.id
									? "border-amber-400 text-white"
									: "border-transparent text-gray-400 hover:text-gray-100"
							}`}
						>
							{t.label}
							<span className="text-xs tabular-nums text-gray-500">
								{count(t.n)}
							</span>
						</button>
					))}
				</div>
				<span className="grow" />
				<span className="hidden gap-1 sm:flex">
					<button
						type="button"
						onClick={() => scroll(-1)}
						aria-label="Scroll back"
						className="rounded-md bg-white/[0.06] p-1.5 text-gray-300 ring-1 ring-white/10 hover:text-white"
					>
						<ChevronLeftIcon className="size-5" aria-hidden />
					</button>
					<button
						type="button"
						onClick={() => scroll(1)}
						aria-label="Scroll on"
						className="rounded-md bg-white/[0.06] p-1.5 text-gray-300 ring-1 ring-white/10 hover:text-white"
					>
						<ChevronRightIcon className="size-5" aria-hidden />
					</button>
				</span>
				<Link
					to={current.more.to}
					className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					{current.more.label}
					<ArrowRightIcon className="size-4" aria-hidden />
				</Link>
			</div>
			<ul
				ref={strip}
				role="tabpanel"
				className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0"
			>
				{current.id === "ratings" &&
					overview.recent.map((t) => (
						<Card key={t.key} title={t} line={shortDate(t.date)} />
					))}
				{current.id === "watching" &&
					overview.watching.map((s) => (
						<Card
							key={s.key}
							title={s}
							line={s.next ?? `${s.watchedEpisodes} episodes`}
							progress={
								s.airedEpisodes
									? Math.min(1, s.watchedEpisodes / s.airedEpisodes)
									: null
							}
						/>
					))}
				{current.id === "wishlist" &&
					overview.newestWishlist.map((t) => (
						<Card
							key={t.key}
							title={t}
							line={
								t.date ? `Added ${shortDate(t.date)}` : String(t.year ?? "")
							}
						/>
					))}
			</ul>
		</section>
	)
}
