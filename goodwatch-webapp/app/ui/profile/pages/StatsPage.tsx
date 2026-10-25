// The profile's Stats tab: one summary (the viewer type with what draws them and what doesn't, the counts, the print, the
// taste groups, and three titles against everyone), then the numbers (genres, people, eras, world, facts, rating
// style). A signed-in visitor gets "Where your tastes meet" after the summary. The owner gets their own taste tools
// (/taste, also through the print) and the import call to action; a signed-out visitor, the way to their own viewer type.
import {
	ArrowRightIcon,
	LockClosedIcon,
	SparklesIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useMemo, useState } from "react"
import { type ProfileShell, seesPart } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import { ImportCta } from "../ImportCta"
import { AMBER_BUTTON, QUIET_BUTTON, TILE } from "../parts"
import { CompareBanner } from "../taste/Compare"
import {
	Eras,
	Facts,
	Genres,
	type NamedTasteStats,
	People,
	RatingStyle,
	World,
} from "../taste/Stats"
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

export function StatsPage({
	shell,
	taste,
	stats,
	compare,
}: {
	shell: ProfileShell
	taste: ProfileTaste
	stats: NamedTasteStats | null
	compare: MemberCompare | null
}) {
	const owner = shell.viewer === "owner"
	const value = useMemo(
		() => tasteContextValue(taste, stats, compare, shell.handle, owner),
		[taste, stats, compare, shell.handle, owner],
	)

	if (taste.status !== "ready")
		return (
			<div className={`${WRAP} pt-8 pb-32`}>
				<div
					className={`${TILE} flex flex-col items-center gap-3 px-6 py-14 text-center`}
				>
					<SparklesIcon className="size-7 text-amber-400" aria-hidden />
					<p className="text-lg font-bold text-gray-100">
						{taste.status === "unavailable"
							? "The taste portrait is loading. Try again in a moment."
							: owner
								? "Rate a few more titles you love and your taste shows here."
								: `@${shell.handle}'s taste is still forming.`}
					</p>
					{owner && taste.status === "empty" && (
						<Link to="/taste" className={AMBER_BUTTON}>
							Rate titles
						</Link>
					)}
				</div>
			</div>
		)

	return (
		<TasteContext.Provider value={value}>
			<div className={`${WRAP} flex flex-col gap-6 pt-6 pb-32 text-white`}>
				{owner && <OwnerBar />}
				<ImportCta shell={shell} what="ratings" />
				{shell.viewer === "guest" && (
					<div className="flex flex-wrap items-center gap-3">
						<Link to="/sign-up" rel="nofollow" className={AMBER_BUTTON}>
							Find your own viewer type
							<ArrowRightIcon className="size-4" aria-hidden />
						</Link>
					</div>
				)}
				<div className="flex flex-col gap-12">
					<Summary
						counts={{
							rated: seesPart(shell, "scores") ? shell.counts.rated : undefined,
							seen: seesPart(shell, "seen") ? shell.counts.seen : undefined,
							hours: seesPart(shell, "hours") ? shell.counts.hours : undefined,
						}}
					/>
					{value.compare && <CompareBanner />}
					<div className="flex flex-col gap-16 sm:gap-20">
						<Genres />
						<People />
						<Eras />
						<World />
						<Facts />
						<RatingStyle />
					</div>
				</div>
			</div>
		</TasteContext.Provider>
	)
}

function Summary({
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
	const higher = taste.crowd.higher[0]
	const lower = taste.crowd.lower[0]
	// Agreement: a title scored 8 or more that they score the same as everyone.
	const agree = Object.values(taste.titles)
		.filter((t) => t.score != null && t.gw != null && t.score >= 8)
		.sort(
			(a, b) =>
				Math.abs((a.score ?? 0) * 10 - (a.gw ?? 0)) -
					Math.abs((b.score ?? 0) * 10 - (b.gw ?? 0)) ||
				(b.score ?? 0) - (a.score ?? 0),
		)[0]
	const versus = !!(higher || lower || agree)
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
					{owner ? (
						<PrintLink>{print}</PrintLink>
					) : (
						<div className="aspect-square w-full">{print}</div>
					)}
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
						{higher && (
							<VsRow
								t={title(higher.key)}
								mine={higher.mine}
								everyone={higher.everyone}
								tone="up"
								note="Far above everyone"
							/>
						)}
						{lower && (
							<VsRow
								t={title(lower.key)}
								mine={lower.mine}
								everyone={lower.everyone}
								tone="down"
								note="Far below everyone"
							/>
						)}
						{agree && agree.score != null && agree.gw != null && (
							<VsRow
								t={agree}
								mine={agree.score}
								everyone={agree.gw}
								tone="same"
								note="Same as everyone"
							/>
						)}
					</ul>
				</div>
			)}
		</section>
	)
}

/**
 * The print as the owner's link to their taste page. "Your full taste" fades in over it on hover or focus; on a touch
 * screen the first tap shows it and the second follows the link.
 */
function PrintLink({ children }: { children: ReactNode }) {
	const [shown, setShown] = useState(false)
	const [touch, setTouch] = useState(false)
	return (
		<Link
			to="/taste"
			aria-label="Your full taste"
			onPointerDown={(e) => setTouch(e.pointerType === "touch")}
			onClick={(e) => {
				if (touch && !shown) {
					e.preventDefault()
					setShown(true)
				}
			}}
			onBlur={() => setShown(false)}
			className="group relative block aspect-square w-full rounded-full focus-visible:outline-2 focus-visible:outline-amber-400"
		>
			{children}
			<span
				className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
			>
				<span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gray-900/95 px-4 text-sm font-bold text-gray-100 shadow-xl ring-1 ring-white/20">
					Your full taste
					<ArrowRightIcon className="size-4" aria-hidden />
				</span>
			</span>
		</Link>
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
	tone: "up" | "down" | "same"
	note: string
}) {
	const color =
		tone === "up"
			? "text-emerald-300"
			: tone === "down"
				? "text-rose-300"
				: "text-gray-300"
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

/**
 * The owner's own tools for their taste, in one row at every width: shorter labels on phones, and the lock leads to Edit
 * profile, where the owner chooses who sees this page.
 */
function OwnerBar() {
	const hint = "Only you see this. Choose who sees this page in Edit profile."
	return (
		<div className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/[0.03] p-2 text-sm sm:p-3">
			<Link
				to="/settings/profile"
				aria-label={hint}
				title={hint}
				className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-amber-300/90 uppercase hover:text-amber-200"
			>
				<LockClosedIcon className="size-3.5" aria-hidden />
				<span className="max-[399px]:hidden">Only you</span>
			</Link>
			<Link
				to="/taste/quiz"
				className={`${AMBER_BUTTON} shrink-0 whitespace-nowrap max-lg:px-3`}
			>
				<SparklesIcon className="size-4" aria-hidden />
				<span className="lg:hidden">Rate more</span>
				<span className="max-lg:hidden">
					Rate more for better recommendations
				</span>
			</Link>
			<Link
				to="/taste"
				className={`${QUIET_BUTTON} min-w-0 whitespace-nowrap max-lg:px-3`}
			>
				Your taste
			</Link>
			<span className="ml-auto hidden text-xs text-gray-500 xl:inline">
				You choose who sees this page in Edit profile.
			</span>
		</div>
	)
}
