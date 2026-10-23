// The Taste tab's opening: the viewer type (the fingerprint's identity and line), a few numbers, badges, and "the
// titles that are most them" (two rows of eight), with a signed-in visitor's own scores on the ones they rated.
import {
	CalendarDaysIcon,
	FilmIcon,
	ScaleIcon,
	StarIcon,
	UsersIcon,
} from "@heroicons/react/20/solid"
import type { ComponentType, SVGProps } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import { YouMark, backdropUrl, count } from "../parts"
import { Whorl } from "./Whorl"
import { theirLine, useTaste } from "./model"
import { MiniPoster, PANEL } from "./parts"

const BADGE_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	medium: FilmIcon,
	era: CalendarDaysIcon,
	style: ScaleIcon,
	anime: StarIcon,
	plates: UsersIcon,
}

export function TasteHero({ mostYou = true }: { mostYou?: boolean }) {
	const { taste, stats, owner, handle, title, attributeByKey } = useTaste()
	const id = taste.identity
	const backdrop = taste.mostYou[0]
		? backdropUrl(title(taste.mostYou[0]).backdrop)
		: null
	const agree =
		taste.crowd.agreement >= 0.5
			? "Often"
			: taste.crowd.agreement >= 0.25
				? "Half the time"
				: "Rarely"
	return (
		<section aria-labelledby="viewer-type" className="flex flex-col gap-4">
			<div className={`${PANEL} relative isolate overflow-hidden`}>
				{backdrop && (
					<img
						src={backdrop}
						alt=""
						className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
					/>
				)}
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/90 to-gray-950/40" />
				<div className="grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)]">
					<div className="mx-auto w-40 sm:w-48">
						<Whorl
							attributes={taste.attributes}
							turns={11}
							rim={false}
							label="Fingerprint emblem"
						/>
					</div>
					<div className="min-w-0">
						<p className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">
							{owner ? "Your viewer type" : `@${handle}'s viewer type`}
						</p>
						<h2
							id="viewer-type"
							className={`${DISPLAY} mt-1 scroll-mt-44 text-3xl leading-[1.05] text-balance text-white sm:text-5xl`}
						>
							{id ? id.name : "Still forming"}
						</h2>
						{taste.line && (
							<p className="mt-4 max-w-2xl text-lg text-gray-100 sm:text-xl">
								{owner ? taste.line : theirLine(taste.line)}
							</p>
						)}
						<dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
							{stats?.eras.averageYear != null && (
								<HeroStat
									value={String(stats.eras.averageYear)}
									label="average release"
								/>
							)}
							<HeroStat value={count(taste.counted)} label="titles read" />
							{taste.usual != null && (
								<HeroStat value={String(taste.usual)} label="usual score" />
							)}
							{taste.crowd.status === "ready" && (
								<HeroStat value={agree} label="agrees with everyone" />
							)}
						</dl>
					</div>
				</div>
			</div>
			{stats && stats.badges.length > 0 && (
				<ul className="grid grid-cols-2 gap-2 lg:grid-cols-5">
					{stats.badges.map((b) => {
						const Icon = BADGE_ICON[b.id] ?? StarIcon
						return (
							<li
								key={b.id}
								className={`${PANEL} flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3`}
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30 sm:size-10">
									<Icon className="size-5" aria-hidden />
								</span>
								<span className="min-w-0">
									<span className="block text-sm font-bold text-white">
										{b.name}
									</span>
									<span className="line-clamp-2 block text-xs text-gray-400">
										{owner
											? b.line
													.replace(/^Their/, "Your")
													.replace(/ they /, " you ")
											: b.line}
									</span>
								</span>
							</li>
						)
					})}
				</ul>
			)}
			{mostYou && <MostYou />}
		</section>
	)
}

function HeroStat({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex flex-col">
			<dd className="text-2xl font-black tabular-nums text-white">{value}</dd>
			<dt className="order-first text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
				{label}
			</dt>
		</div>
	)
}

/** "The titles that are most them": two rows of eight (one on phones); a visitor's own score on the ones they rated. */
export function MostYou() {
	const { taste, owner, handle, title, compare } = useTaste()
	if (!taste.mostYou.length) return null
	return (
		<div className={`${PANEL} p-4 sm:p-5`}>
			<p className="mb-3 text-sm font-bold text-gray-200">
				{owner
					? "The titles that are most you"
					: `The titles that are most @${handle}`}
			</p>
			<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
				{taste.mostYou.slice(0, 16).map((key, i) => (
					<li key={key} className={`relative ${i >= 8 ? "max-sm:hidden" : ""}`}>
						<MiniPoster title={title(key)} />
						{compare && <YouMark score={compare.yourScores[key]} />}
					</li>
				))}
			</ul>
		</div>
	)
}
