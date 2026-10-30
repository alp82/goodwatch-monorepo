// The full lists the comparison's three groups open into (round 19, nav option `venn`). Each carries its group's
// meaning: Picks for you is a ranked shelf with why each title fits you, You both love is a shared wall with both
// scores side by side, and Only you love is your titles they haven't rated, with a nudge.
import { BookmarkIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { useState } from "react"
import type { ProfileTitle } from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ProfileCard } from "../../ProfileCard"
import type { PosterProps } from "~/ui/Poster"
import { GROUPS, type GroupId, type Plan, type Ready } from "./parts"

/** Cards three to a row on phones, up to six in the card. */
const GRID_SIZES: PosterProps["sizes"] = [
	["(min-width: 1024px)", "170px"],
	["(min-width: 640px)", "22vw"],
	[null, "30vw"],
]
/** Cards shown first, then each "Show more" adds a batch. */
const FIRST = 12
const BATCH = 12

export function GroupView({
	id,
	plan,
	c,
	control,
	className = "p-5 sm:p-8",
}: {
	id: GroupId
	plan: Plan
	c: Ready
	/** The way back or out, at the header's end. */
	control?: ReactNode
	className?: string
}) {
	const g = GROUPS.find((x) => x.id === id) ?? GROUPS[0]
	const handle = plan.handle
	const list: ProfileTitle[] = plan.groups[id]
	const total = plan.counts[id]
	const [shown, setShown] = useState(FIRST)
	const items = list.slice(0, shown)
	const left = list.length - items.length

	const line = {
		picks: `@${handle}'s 9s and 10s you haven't rated, ranked by how well they fit your taste.`,
		both: "Titles you both scored 8 or more, the highest pair first.",
		only: `Your 8s and up that @${handle} hasn't rated.`,
	}[id]
	const wished =
		id === "only" ? plan.groups.only.filter((t) => t.wished).length : 0

	return (
		<div className={`flex flex-col gap-5 ${className}`}>
			<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
				<div className="flex min-w-0 items-center gap-4">
					<span
						className={`${DISPLAY} text-5xl leading-none tabular-nums sm:text-6xl ${g.tone}`}
					>
						{total}
					</span>
					<span className="min-w-0">
						<span
							className={`block text-[11px] font-bold tracking-[0.14em] uppercase ${g.tone}`}
						>
							{g.name}
						</span>
						<span className="mt-0.5 block max-w-xl text-sm text-gray-400">
							{line}
						</span>
					</span>
				</div>
				{control}
			</div>

			{id === "only" && (
				<p className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-gray-300 ring-1 ring-white/[0.07]">
					<BookmarkIcon
						className="size-4 shrink-0 text-amber-400"
						aria-hidden
					/>
					{wished > 0 ? (
						<span>
							<b className="text-white">
								@{handle} already wants to see {wished}
							</b>{" "}
							of these. They come first.
						</span>
					) : (
						<span>
							None of these is on @{handle}'s radar yet.{" "}
							<b className="text-white">Your 10s</b> are the place to start.
						</span>
					)}
				</p>
			)}

			<ul
				className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 ${id === "both" ? "gap-x-2 gap-y-4 sm:gap-x-3" : "gap-x-3 gap-y-6 sm:gap-x-4"}`}
			>
				{items.map((t, i) => (
					<li key={t.key} className="relative flex min-w-0 flex-col gap-1.5">
						{id === "picks" && <Rank n={i + 1} />}
						<ProfileCard title={t} posterSizes={GRID_SIZES} />
						{id === "picks" && (
							<PickNote
								t={t as Ready["overlap"]["onlyThem"][number]}
								handle={handle}
							/>
						)}
						{id === "both" && (
							<BothScores
								theirs={t.score}
								yours={c.yourScores[t.key] ?? null}
								handle={handle}
							/>
						)}
						{id === "only" && (
							<OnlyNote t={t as Ready["overlap"]["onlyYou"][number]} />
						)}
					</li>
				))}
			</ul>

			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
				{left > 0 && (
					<button
						type="button"
						onClick={() => setShown(shown + BATCH)}
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Show {Math.min(BATCH, left)} more
					</button>
				)}
				{left === 0 && total > list.length && (
					<span className="text-gray-500">
						The first {list.length} of {total}.
					</span>
				)}
			</div>
		</div>
	)
}

/** The shelf's rank, big and amber, over the poster's top left corner. */
function Rank({ n }: { n: number }) {
	return (
		<span
			aria-hidden
			className={`${DISPLAY} pointer-events-none absolute -top-2.5 -left-1.5 z-10 text-3xl leading-none text-amber-300 sm:text-4xl`}
			style={{ textShadow: "0 2px 0 rgb(3 7 18), 0 0 12px rgb(3 7 18)" }}
		>
			{n}
		</span>
	)
}

function PickNote({
	t,
	handle,
}: { t: Ready["overlap"]["onlyThem"][number]; handle: string }) {
	return (
		<span className="flex min-w-0 flex-col text-[11px] leading-snug">
			{t.why && (
				<span className="line-clamp-2 font-semibold text-amber-300">
					Fits your {t.why.toLowerCase()}
				</span>
			)}
			<span className="truncate text-gray-500">
				@{handle} scored it {t.score}
			</span>
		</span>
	)
}

/** Both scores side by side: theirs with the amber dot, yours with the white one. */
function BothScores({
	theirs,
	yours,
	handle,
}: { theirs: number | null; yours: number | null; handle: string }) {
	const same = theirs != null && theirs === yours
	return (
		<span
			className="flex items-center justify-center gap-2 rounded-full bg-white/[0.05] py-0.5 text-xs font-bold tabular-nums ring-1 ring-white/[0.07]"
			aria-label={`@${handle} ${theirs ?? "?"}, you ${yours ?? "?"}`}
		>
			<span className="inline-flex items-center gap-1 text-amber-200">
				<span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
				{theirs ?? "?"}
			</span>
			<span className={same ? "text-amber-400" : "text-gray-600"} aria-hidden>
				{same ? "=" : "·"}
			</span>
			<span className="inline-flex items-center gap-1 text-white">
				<span className="size-1.5 rounded-full bg-white" aria-hidden />
				{yours ?? "?"}
			</span>
		</span>
	)
}

function OnlyNote({ t }: { t: Ready["overlap"]["onlyYou"][number] }) {
	return t.wished ? (
		<span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-amber-300">
			<BookmarkIcon className="size-3 shrink-0" aria-hidden />
			<span className="truncate">On their wishlist</span>
		</span>
	) : (
		<span className="truncate text-[11px] text-gray-500">
			Not rated by them
		</span>
	)
}
