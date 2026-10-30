// The parts of the old Overview that a visitor's Taste profile keeps (ui/profile/pages/TasteProfilePage.tsx): a sign-up
// card (a signed-out visitor), every 10, and the hot takes. Every part follows the owner's "who sees what". A signed-in
// visitor's match is in taste/Compare.tsx.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import {
	type ProfileOverview,
	type ProfilePart,
	type ProfileShell,
	type ProfileTitle,
	seesPart,
} from "~/domain/profile"
import type { Score } from "~/server/scores.server"
import { RowScores, rowMark, useRowMarks } from "~/ui/list-row/RowScores"
import { DISPLAY } from "~/ui/my-pages/bits"
import { profileTabPath } from "./links"
import {
	AMBER_BUTTON,
	PosterImg,
	ProfilePoster,
	TILE,
	count,
	posterOwner,
} from "./parts"

/**
 * The parts of the old Overview that a visitor's Taste profile keeps, under the portrait: the way to a match (a
 * signed-out visitor), every 10, and the hot takes. Each follows the owner's "who sees what".
 */
export function Overview({
	shell,
	overview,
}: {
	shell: ProfileShell
	overview: ProfileOverview
}) {
	const see = (part: ProfilePart) => seesPart(shell, part)
	const owner = shell.viewer === "owner"
	const tier = (score: number) =>
		`${profileTabPath(shell.handle, "scores")}#tier-${score}`
	return (
		<>
			{/* The way to a match shows whatever the owner shares: it compares whole tastes, not one part. A signed-in
			visitor's match is at the top of the tab (taste/Compare.tsx). */}
			{shell.viewer === "guest" && <GuestMatch handle={shell.handle} />}

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

const FAVORITE_SIZES: [string | null, string][] = [
	["(min-width: 1024px)", "130px"],
	["(min-width: 640px)", "16vw"],
	[null, "25vw"],
]
