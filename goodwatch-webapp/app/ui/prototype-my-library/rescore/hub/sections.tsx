// PROTOTYPE - throwaway. The subpages of the My library hub, made once from the loader's data, so each variant only
// decides the layout. Scores is new (the rescoring list), so it carries its score spread and a "New" mark.
import {
	ArrowDownTrayIcon,
	BookmarkIcon,
	CheckCircleIcon,
	EyeSlashIcon,
	ListBulletIcon,
	PlayIcon,
	QuestionMarkCircleIcon,
	StarIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, SVGProps } from "react"
import type { HubPoster, HubPreviews } from "~/server/prototype-my-library-hub.server"
import type { RescoreData } from "~/server/prototype-my-library-rescore.server"
import { Poster } from "~/ui/my-pages/bits"

export const SCORES_PATH = "/prototype/my-library-rescore/scores"

export type SectionKey =
	| "want"
	| "seen"
	| "progress"
	| "unrated"
	| "scores"
	| "lists"
	| "imports"
	| "hidden"

export interface Section {
	key: SectionKey
	name: string
	hint: string
	to: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	/** Null: the hub has no count for it (lists, imports). */
	count: number | null
	/** Words after the count, or in its place. */
	detail?: string
	posters: HubPoster[]
	isNew?: boolean
	/** Group on the hub: your titles, then tools. */
	group: "titles" | "tools"
}

export interface HubData {
	rescore: RescoreData
	previews: HubPreviews
}

export const count = (n: number) => n.toLocaleString("en-US")

/** How many titles have each score, 1 to 10. */
export const spreadOf = (rescore: RescoreData) => {
	const spread = Array.from({ length: 10 }, () => 0)
	for (const title of rescore.titles) spread[title.score - 1] += 1
	return spread
}

export function sectionsOf({ rescore, previews }: HubData): Section[] {
	const { counts } = rescore
	const recentlyRated = [...rescore.titles]
		.sort((a, b) => (b.ratedAt ?? "").localeCompare(a.ratedAt ?? ""))
		.slice(0, 12)
	const progressCount = counts.watching + counts.on_hold + counts.dropped
	return [
		{
			key: "want",
			name: "Want to see",
			hint: "Titles you saved for later",
			to: "/my-library?status=want",
			icon: BookmarkIcon,
			count: counts.want,
			posters: previews.posters.want,
			group: "titles",
		},
		{
			key: "seen",
			name: "Seen",
			hint: "Movies you watched and shows you finished",
			to: "/my-library?status=seen",
			icon: CheckCircleIcon,
			count: counts.seen,
			posters: previews.posters.seen,
			group: "titles",
		},
		{
			key: "scores",
			name: "Scores",
			hint: "Every title you rated, with all ten scores beside it to change at once",
			to: SCORES_PATH,
			icon: StarIcon,
			count: rescore.titles.length,
			detail: "rated",
			posters: recentlyRated,
			isNew: true,
			group: "titles",
		},
		{
			key: "progress",
			name: "Shows in progress",
			hint: "Watching, On hold and Dropped",
			to: "/my-library?status=watching",
			icon: PlayIcon,
			count: progressCount,
			detail: `${count(counts.watching)} watching · ${count(counts.on_hold)} on hold · ${count(counts.dropped)} dropped`,
			posters: [
				...previews.posters.watching,
				...previews.posters.on_hold,
				...previews.posters.dropped,
			].slice(0, 12),
			group: "titles",
		},
		{
			key: "unrated",
			name: "Not rated",
			hint: "Seen, without a score",
			to: "/my-library?status=unrated",
			icon: QuestionMarkCircleIcon,
			count: counts.unrated,
			posters: previews.posters.unrated,
			group: "titles",
		},
		{
			key: "lists",
			name: "My lists",
			hint: "Lists you made and shared",
			to: "/lists/mine",
			icon: ListBulletIcon,
			count: null,
			posters: [],
			group: "tools",
		},
		{
			key: "imports",
			name: "Imports",
			hint: "Bring ratings and watches from other sites",
			to: "/settings/imports",
			icon: ArrowDownTrayIcon,
			count: null,
			posters: [],
			group: "tools",
		},
		{
			key: "hidden",
			name: "Hidden titles",
			hint: "Titles you marked Not interested",
			to: "/settings/hidden",
			icon: EyeSlashIcon,
			count: previews.hidden,
			posters: [],
			group: "tools",
		},
	]
}

/** The Scores spread as small bars, one per score. */
export function SpreadBars({
	spread,
	className = "h-12",
}: { spread: number[]; className?: string }) {
	const most = Math.max(1, ...spread)
	return (
		<span className="flex flex-col gap-1">
			<span className={`flex items-end gap-1 ${className}`} aria-hidden>
				{spread.map((n, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed ten scores
						key={i}
						className="flex-1 rounded-sm bg-amber-400/80"
						style={{ height: `${Math.max(4, (n / most) * 100)}%` }}
						title={`${i + 1}: ${n}`}
					/>
				))}
			</span>
			<span className="flex gap-1 text-[10px] font-bold tabular-nums text-gray-500">
				{spread.map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed ten scores
					<span key={i} className="flex-1 text-center">
						{i + 1}
					</span>
				))}
			</span>
			<span className="sr-only">
				{spread.map((n, i) => `${n} titles scored ${i + 1}`).join(", ")}
			</span>
		</span>
	)
}

/** A row of overlapping posters. */
export function PosterFan({
	posters,
	max = 5,
}: { posters: HubPoster[]; max?: number }) {
	return (
		<span className="flex -space-x-3">
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

export const NewMark = () => (
	<span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black tracking-wide text-black uppercase">
		New
	</span>
)
