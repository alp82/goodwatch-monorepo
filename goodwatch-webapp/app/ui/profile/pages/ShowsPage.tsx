// The profile's Shows tab: the shows in My shows' groups and words (Continue, Pick up, Waiting for episodes, Start, On
// hold, Dropped), each with its progress and next episode.
import { Link } from "@remix-run/react"
import type {
	ProfileShell,
	ProfileShowsPage,
	ShowGroup,
} from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { PosterImg, TILE } from "../parts"

const GROUPS: Record<ShowGroup, { name: string; line: string }> = {
	continue: { name: "Continue", line: "Next episode is out" },
	pickUp: { name: "Pick up", line: "Left for a while" },
	waiting: { name: "Waiting for episodes", line: "Caught up" },
	start: { name: "Start", line: "On the Wishlist, not started" },
	onHold: { name: "On hold", line: "Set aside" },
	dropped: { name: "Dropped", line: "Stopped watching" },
}

type Show = ProfileShowsPage["groups"][number]["shows"][number]

export function ShowsPage({
	shell,
	page,
}: { shell: ProfileShell; page: ProfileShowsPage }) {
	const groups = page.groups.filter((g) => g.shows.length)
	return (
		<>
			{groups.length ? (
				groups.map((g) => (
					<section key={g.group}>
						<h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 border-b border-white/10 pb-2">
							<span className={`${DISPLAY} text-2xl`}>
								{GROUPS[g.group].name}
							</span>
							<span className="text-sm tabular-nums text-gray-500">
								{g.shows.length}
							</span>
							<span className="text-sm text-gray-500">
								· {GROUPS[g.group].line}
							</span>
						</h2>
						<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{g.shows.map((show) => (
								<ShowCard key={show.key} show={show} />
							))}
						</ul>
					</section>
				))
			) : (
				<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
					{shell.viewer === "owner"
						? "No shows on My shows yet."
						: `@${shell.handle} isn't following any shows yet.`}
				</p>
			)}
		</>
	)
}

function ShowCard({ show }: { show: Show }) {
	const aired = show.airedEpisodes ?? 0
	const share = aired ? Math.min(1, show.watchedEpisodes / aired) : 0
	return (
		<li className={`${TILE} flex min-w-0 gap-3 p-3`}>
			<Link
				to={show.href}
				aria-label={show.title}
				className="block w-14 shrink-0"
			>
				<PosterImg title={show} className="rounded-md" />
			</Link>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<Link
					to={show.href}
					className="truncate font-bold text-gray-100 hover:text-white"
				>
					{show.title}
				</Link>
				{aired > 0 && (
					<div>
						{/* biome-ignore lint/a11y/useFocusableInteractive: a progress bar is not interactive */}
						<div
							className="h-1.5 overflow-hidden rounded-full bg-white/10"
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={aired}
							aria-valuenow={show.watchedEpisodes}
							aria-label={`${show.watchedEpisodes} of ${aired} episodes watched`}
						>
							<div
								className="h-full origin-left rounded-full bg-amber-400"
								style={{ transform: `scaleX(${share})` }}
							/>
						</div>
						<p className="mt-1 text-xs tabular-nums text-gray-400">
							{show.watchedEpisodes} of {aired} episodes
						</p>
					</div>
				)}
				{show.next && (
					<p className="truncate text-xs text-gray-300">Next: {show.next}</p>
				)}
			</div>
		</li>
	)
}
