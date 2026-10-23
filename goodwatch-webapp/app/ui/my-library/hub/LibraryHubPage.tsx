// My library's hub: the Settings page's tiles, one per page under it. Each tile is the link and shows what is
// inside now: Your scores is the wide first tile with the spread of your scores; Want to see, Seen, Shows in
// progress and Not rated have a count and a few posters; lists, imports and hidden titles are small tiles at the end.
import {
	ArrowDownTrayIcon,
	EyeSlashIcon,
	ListBulletIcon,
} from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ComponentType, ReactNode, SVGProps } from "react"
import { SCORES_PAGE, statusPage } from "~/domain/my-library"
import type { HubPoster, LibraryHub } from "~/server/my-library-hub.server"
import { MY_MOVIES, MY_SHOWS, PageHead, Poster, WRAP } from "~/ui/my-pages/bits"
import { useHiddenTitles } from "~/ui/settings/hidden-titles"
import { HIDDEN_PATH } from "~/ui/settings/paths"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { myListsPath } from "~/ui/share-card/links"

const count = (n: number) => n.toLocaleString("en-US")

const TILE =
	"group flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-6"

function Tile({
	name,
	hint,
	to,
	tile,
	mark,
	className = "",
	children,
}: {
	name: string
	hint: string
	to: string
	tile: string
	mark?: ReactNode
	className?: string
	children: ReactNode
}) {
	return (
		<Link to={to} prefetch="intent" className={`${TILE} ${className}`} data-hub-tile={tile}>
			<span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
				{name}
				{mark}
			</span>
			<span className="mb-4 text-sm text-gray-400">{hint}</span>
			<span className="mt-auto">{children}</span>
			<span className="mt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">Open</span>
		</Link>
	)
}

const Count = ({ n, after }: { n: number; after?: string }) => (
	<span className="flex items-baseline gap-2">
		<span className="text-3xl font-black tabular-nums text-white md:text-4xl">{count(n)}</span>
		{after && <span className="text-sm text-gray-400">{after}</span>}
	</span>
)

/** A row of overlapping posters. */
function PosterFan({ posters, max = 5 }: { posters: HubPoster[]; max?: number }) {
	return (
		<span className="flex -space-x-3" aria-hidden>
			{posters.slice(0, max).map((poster) => (
				<Poster
					key={poster.key}
					path={poster.poster_path}
					className="h-20 w-[3.4rem] rounded-md shadow-lg ring-2 ring-gray-950"
				/>
			))}
		</span>
	)
}

/** How many titles have each score, as ten bars. */
function SpreadBars({ spread }: { spread: number[] }) {
	const most = Math.max(1, ...spread)
	return (
		<span className="flex flex-col gap-1">
			<span className="flex h-16 items-end gap-1" aria-hidden>
				{spread.map((n, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
						key={i}
						className="flex-1 rounded-sm bg-amber-400/80"
						style={{ height: `${Math.max(4, (n / most) * 100)}%` }}
					/>
				))}
			</span>
			<span className="flex gap-1 text-[10px] font-bold tabular-nums text-gray-500" aria-hidden>
				{spread.map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
					<span key={i} className="flex-1 text-center">
						{i + 1}
					</span>
				))}
			</span>
			<span className="sr-only">{spread.map((n, i) => `${n} titles scored ${i + 1}`).join(", ")}</span>
		</span>
	)
}

// TODO(2026-11-01): remove the New mark on Your scores, 14 days after the page shipped.
const NewMark = () => (
	<span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black tracking-wide text-black uppercase">
		New
	</span>
)

function ToolTile({
	name,
	hint,
	to,
	tile,
	icon: Icon,
}: {
	name: string
	hint: string
	to: string
	tile: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
}) {
	return (
		<Link
			to={to}
			prefetch="intent"
			data-hub-tile={tile}
			className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white"
		>
			<Icon className="h-6 w-6 shrink-0 text-gray-400" aria-hidden />
			<span className="min-w-0 flex-1">
				<b className="block text-sm text-white">{name}</b>
				<span className="block truncate text-xs text-gray-400">{hint}</span>
			</span>
			<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300" aria-hidden />
		</Link>
	)
}

export function LibraryHubPage({ hub }: { hub: LibraryHub }) {
	const { counts, posters } = hub
	const hidden = useHiddenTitles().data?.titles.length
	const inProgress = counts.watching + counts.on_hold + counts.dropped
	const lists = [
		{
			tile: "want",
			name: "Want to see",
			hint: "Titles you saved for later",
			to: statusPage({ status: "want" }),
			n: counts.want,
			posters: posters.want,
		},
		{
			tile: "seen",
			name: "Seen",
			hint: "Movies you watched and shows you finished",
			to: statusPage({ status: "seen" }),
			n: counts.seen,
			posters: posters.seen,
		},
		{
			tile: "in-progress",
			name: "Shows in progress",
			hint: "Watching, On hold and Dropped",
			to: statusPage({ status: "watching" }),
			n: inProgress,
			detail: `${count(counts.watching)} watching · ${count(counts.on_hold)} on hold · ${count(counts.dropped)} dropped`,
			posters: [...posters.watching, ...posters.on_hold, ...posters.dropped],
		},
		{
			tile: "not-rated",
			name: "Not rated",
			hint: "Seen, without a score",
			to: statusPage({ status: "unrated" }),
			n: counts.unrated,
			posters: posters.unrated,
		},
	]
	return (
		<div className="overflow-x-clip pb-24" data-my-library-hub>
			<PageHead
				name="My library"
				line="Everything you have marked, rated and brought in. Picking one for tonight happens in My shows and My movies."
				links={[
					{ label: "My shows", to: MY_SHOWS },
					{ label: "My movies", to: MY_MOVIES },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-4`}>
				<div className="grid gap-4 md:grid-cols-2">
					<Tile
						tile="scores"
						name="My scores"
						hint="Every title you rated, with all ten scores beside it to change any of them"
						to={SCORES_PAGE}
						mark={<NewMark />}
						className="md:col-span-2"
					>
						<span className="flex flex-wrap items-end gap-6">
							<span className="flex flex-col gap-3">
								<Count n={hub.scored} after="rated" />
								<PosterFan posters={posters.scores} max={6} />
							</span>
							<span className="min-w-56 flex-1">
								<SpreadBars spread={hub.spread} />
							</span>
						</span>
					</Tile>
					{lists.map((list) => (
						<Tile key={list.tile} tile={list.tile} name={list.name} hint={list.hint} to={list.to}>
							<span className="flex items-end justify-between gap-4">
								<span className="flex flex-col gap-1">
									<Count n={list.n} />
									{list.detail && <span className="text-sm text-gray-400">{list.detail}</span>}
								</span>
								<PosterFan posters={list.posters} />
							</span>
						</Tile>
					))}
				</div>
				<div className="grid gap-4 sm:grid-cols-3">
					<ToolTile tile="lists" name="My lists" hint="Lists you made and shared" to={myListsPath} icon={ListBulletIcon} />
					<ToolTile
						tile="imports"
						name="Imports"
						hint="Bring ratings and watches from other sites"
						to={IMPORTS_PATH}
						icon={ArrowDownTrayIcon}
					/>
					<ToolTile
						tile="hidden"
						name="Hidden titles"
						hint={
							hidden == null
								? "Titles you marked Not interested"
								: `${count(hidden)} · Titles you marked Not interested`
						}
						to={HIDDEN_PATH}
						icon={EyeSlashIcon}
					/>
				</div>
			</div>
		</div>
	)
}

