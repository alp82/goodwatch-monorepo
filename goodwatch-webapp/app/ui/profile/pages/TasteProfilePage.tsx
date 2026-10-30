// A visitor's Taste profile: /u/:handle as others see it (and the owner with ?as=visitor). For a signed-in visitor the
// taste match first, with "Where your tastes meet" in place under it. Then who they are (bio, links), the summary of
// their taste (the viewer type with what draws them and what doesn't, the counts, the print, the taste groups, three
// titles against everyone), their 10s and their hot takes.
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { useMemo } from "react"
import {
	type ProfileOverview,
	type ProfileShell,
	seesPart,
} from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { Overview } from "../Overview"
import { ProfileAbout } from "../ProfileFrame"
import { AMBER_BUTTON, TILE } from "../parts"
import { TasteMatch } from "../taste/Compare"
import { Whorl } from "../taste/Whorl"
import {
	FAMILY_COLOR,
	type ProfileTaste,
	TasteContext,
	type TasteTitle,
	tasteContextValue,
	theirLine,
	useTaste,
} from "../taste/model"
import { PANEL, TastePoster } from "../taste/parts"

const EYEBROW = "text-[11px] font-bold tracking-[0.18em] uppercase"

export function TasteProfilePage({
	shell,
	taste,
	overview,
	compare,
}: {
	shell: ProfileShell
	/** Null when the viewer may not see the taste, or it failed to load. */
	taste: ProfileTaste | null
	overview: ProfileOverview
	compare: MemberCompare | null
}) {
	const still = useReducedMotion() ?? false
	const value = useMemo(
		() => taste && tasteContextValue(taste, null, null, shell.handle, false),
		[taste, shell.handle],
	)
	return (
		<LayoutGroup>
			<div className={`${WRAP} flex flex-col gap-10 pt-6 pb-32 text-white`}>
				{shell.viewer === "member" && compare && (
					<TasteMatch shell={shell} compare={compare} />
				)}
				{/* Moves down with "Where your tastes meet" as it opens, by transform only. */}
				<motion.div
					layout={still ? false : "position"}
					transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
					className="flex flex-col gap-10"
				>
					<ProfileAbout shell={shell} />
					{shell.viewer === "guest" && (
						<div className="flex flex-wrap items-center gap-3">
							<Link to="/sign-up" rel="nofollow" className={AMBER_BUTTON}>
								Find your own viewer type
								<ArrowRightIcon className="size-4" aria-hidden />
							</Link>
						</div>
					)}
					{seesPart(shell, "taste") &&
						(taste && value && taste.status === "ready" ? (
							<TasteContext.Provider value={value}>
								<TasteSummary
									counts={{
										rated: seesPart(shell, "scores")
											? shell.counts.rated
											: undefined,
										seen: seesPart(shell, "seen")
											? shell.counts.seen
											: undefined,
										hours: seesPart(shell, "hours")
											? shell.counts.hours
											: undefined,
									}}
								/>
							</TasteContext.Provider>
						) : (
							<div
								className={`${TILE} flex flex-col items-center gap-3 px-6 py-14 text-center`}
							>
								<SparklesIcon className="size-7 text-amber-400" aria-hidden />
								<p className="text-lg font-bold text-gray-100">
									{taste?.status === "empty"
										? `@${shell.handle}'s taste is still forming.`
										: "The taste portrait is loading. Try again in a moment."}
								</p>
							</div>
						))}
					<Overview shell={shell} overview={overview} />
				</motion.div>
			</div>
		</LayoutGroup>
	)
}

export function TasteSummary({
	counts,
}: { counts: { rated?: number; seen?: number; hours?: number } }) {
	const { taste, owner, handle, attributeByKey, title } = useTaste()
	const seek = taste.seek
		.map((k) => attributeByKey.get(k))
		.filter((a) => a != null)
		.slice(0, 4)
	const avoid = taste.avoid
		.map((k) => attributeByKey.get(k))
		.filter((a) => a != null)
		.slice(0, 3)
	const groups = taste.sides.list.slice(0, 3)
	// You vs everyone: the farthest above and the farthest below, then the stronger of the two runners-up.
	const [higher, nextUp] = taste.crowd.higher
	const [lower, nextDown] = taste.crowd.lower
	const third =
		nextUp && nextDown
			? Math.abs(nextUp.delta) >= Math.abs(nextDown.delta)
				? { row: nextUp, tone: "up" as const }
				: { row: nextDown, tone: "down" as const }
			: nextUp
				? { row: nextUp, tone: "up" as const }
				: nextDown
					? { row: nextDown, tone: "down" as const }
					: null
	const versusRows = [
		higher && { row: higher, tone: "up" as const },
		lower && { row: lower, tone: "down" as const },
		third,
	].filter((r) => r != null && taste.titles[r.row.key] != null) as {
		row: (typeof taste.crowd.higher)[number]
		tone: "up" | "down"
	}[]
	const versus = versusRows.length > 0
	const print = (
		<Whorl
			attributes={taste.attributes}
			label="Fingerprint"
			className="h-full w-full"
		/>
	)

	return (
		<section
			aria-label="Taste summary"
			className={`${PANEL} grid gap-px overflow-hidden bg-white/10 lg:grid-cols-12`}
		>
			{/* Who: the viewer type, what draws them and what doesn't, the counts, and the print. */}
			<div className="grid items-center gap-6 bg-gray-950 p-5 sm:grid-cols-[1fr_auto] sm:p-8 lg:col-span-12">
				<div className="mx-auto w-64 sm:order-last sm:w-72 lg:w-80">
					<div className="aspect-square w-full">{print}</div>
				</div>
				<div className="min-w-0">
					<p className={`${EYEBROW} text-amber-400`}>
						{owner ? "Your viewer type" : `@${handle}'s viewer type`}
					</p>
					<h2
						id="viewer-type"
						className={`${DISPLAY} mt-1 scroll-mt-44 text-3xl leading-[1.05] sm:text-5xl`}
					>
						{taste.identity?.name ?? "Still forming"}
					</h2>
					{taste.line && (
						<p className="mt-3 max-w-2xl text-lg text-gray-200">
							{owner ? taste.line : theirLine(taste.line)}
						</p>
					)}
					<div className="mt-5 flex flex-col gap-3">
						{seek.length > 0 && (
							<div className="flex flex-wrap items-center gap-2">
								<span className="w-16 text-xs font-semibold text-gray-400">
									Drawn to
								</span>
								{seek.map((a) => (
									<Chip
										key={a.key}
										emoji={a.emoji}
										label={a.label}
										color={FAMILY_COLOR[a.family]}
									/>
								))}
							</div>
						)}
						{avoid.length > 0 && (
							<div className="flex flex-wrap items-center gap-2">
								<span className="w-16 text-xs font-semibold text-gray-400">
									Less so
								</span>
								{avoid.map((a) => (
									<Chip
										key={a.key}
										emoji={a.emoji}
										label={a.label}
										color={FAMILY_COLOR[a.family]}
										muted
									/>
								))}
							</div>
						)}
					</div>
					<dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
						{counts.rated != null && (
							<Count value={counts.rated} label="rated" />
						)}
						{counts.seen != null && <Count value={counts.seen} label="seen" />}
						{counts.hours != null && (
							<Count value={counts.hours} label="hours watched" />
						)}
					</dl>
				</div>
			</div>

			{groups.length > 0 && (
				<div
					id="sides"
					className={`scroll-mt-44 bg-gray-950 p-5 sm:p-6 ${versus ? "lg:col-span-6" : "lg:col-span-12"}`}
				>
					<p className={`${EYEBROW} text-gray-400`}>Taste groups</p>
					<ul className="mt-4 flex flex-col gap-4">
						{groups.map((g) => (
							<li key={g.id} className="flex items-center gap-3">
								<span className="flex shrink-0 gap-1.5">
									{g.here.slice(0, 2).map((k) => (
										<span key={k} className="w-11">
											<TastePoster title={title(k)} sizes={[[null, "44px"]]} />
										</span>
									))}
								</span>
								<span className="min-w-0">
									<span className="block leading-tight font-bold">
										{g.name}
									</span>
									<span className="text-sm text-gray-400">
										{g.count} titles · average {g.average.toFixed(1)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{versus && (
				<div
					id="everyone"
					className={`flex scroll-mt-44 flex-col gap-4 bg-gray-950 p-5 sm:p-6 ${groups.length > 0 ? "lg:col-span-6" : "lg:col-span-12"}`}
				>
					<p className={`${EYEBROW} text-gray-400`}>
						{owner ? "You" : "Them"} vs everyone
					</p>
					<ul className="flex flex-col gap-3">
						{versusRows.map(({ row, tone }) => (
							<VsRow
								key={row.key}
								t={title(row.key)}
								mine={row.mine}
								everyone={row.everyone}
								tone={tone}
								note={
									tone === "up" ? "Far above everyone" : "Far below everyone"
								}
							/>
						))}
					</ul>
				</div>
			)}
		</section>
	)
}

function Chip({
	emoji,
	label,
	color,
	muted = false,
}: { emoji: string; label: string; color: string; muted?: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-sm ring-1 ring-white/10 ${muted ? "text-gray-400" : "font-semibold text-gray-100"}`}
		>
			<span aria-hidden>{emoji}</span>
			{label}
			<span
				className="h-1.5 w-1.5 rounded-full"
				style={{ background: color, opacity: muted ? 0.5 : 1 }}
				aria-hidden
			/>
		</span>
	)
}

function Count({ value, label }: { value: number; label: string }) {
	return (
		<div>
			<dt className="sr-only">{label}</dt>
			<dd className={`${DISPLAY} text-2xl tabular-nums`}>
				{value.toLocaleString("en-US")}
				<span className="ml-1.5 font-sans text-sm font-normal text-gray-400">
					{label}
				</span>
			</dd>
		</div>
	)
}

/**
 * A title against everyone: the poster card (the owner's score on it when someone else looks), the note, and "9 vs 50",
 * their score then everyone's.
 */
function VsRow({
	t,
	mine,
	everyone,
	tone,
	note,
}: {
	t: TasteTitle
	mine: number
	everyone: number
	tone: "up" | "down"
	note: string
}) {
	const color = tone === "up" ? "text-emerald-300" : "text-rose-300"
	return (
		<li className="flex items-center gap-3">
			<span className="w-[6.5rem] shrink-0">
				<TastePoster title={t} sizes={[[null, "104px"]]} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-semibold">{t.title}</span>
				<span className={`block text-xs font-semibold ${color}`}>{note}</span>
				<span className="block text-xs tabular-nums text-gray-400">
					{mine} vs everyone's {everyone}
				</span>
			</span>
		</li>
	)
}
