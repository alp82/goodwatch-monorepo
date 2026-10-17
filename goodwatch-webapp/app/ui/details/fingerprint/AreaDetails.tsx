import { XMarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { areaLinks, areaTraits, goodFor } from "./area-details"
import { type Area, AREA_COLOR, areaLevelWord } from "./areas"

/**
 * One area in the details region: its name and tier with the way back to all areas, its verdict, its strongest
 * traits, and more-like-this links at the bottom.
 */
export default function AreaDetails({
	t,
	area,
	onReset,
}: {
	t: F.TitleInput
	area: Area
	onReset: () => void
}) {
	const color = AREA_COLOR[area]
	const brief = F.pillarBrief(t, area)
	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between gap-3">
				<p
					className="text-xs font-semibold uppercase tracking-[.12em]"
					style={{ color }}
				>
					<span aria-hidden="true">{PILLAR_CONFIG[area].emoji} </span>
					{area} · {areaLevelWord(area, t.fingerprint.pillars[area])}
				</p>
				<button
					type="button"
					onClick={onReset}
					className="-my-1 flex cursor-pointer items-center gap-1 rounded-full border border-white/15 py-1 pl-2 pr-3 text-xs text-gray-300 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden="true" />
					All areas
				</button>
			</div>
			<div className="mt-3">
				<p className="text-base font-semibold leading-snug text-white">
					{brief.verdict}
				</p>
				{brief.note && (
					<p className="mt-0.5 text-sm leading-relaxed text-gray-400">
						{brief.note}
					</p>
				)}
			</div>
			<ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
				{areaTraits(t, area).map((trait) => (
					<li
						key={trait.key}
						className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-[13px]"
					>
						<span className="truncate text-gray-200">
							{getFingerprintMeta(trait.key).label}
						</span>
						<span className="tabular-nums text-xs text-gray-500">
							{trait.score}
						</span>
						<span className="col-span-2 mt-1 h-1.5 rounded-full bg-white/[.07]">
							<span
								className="block h-1.5 rounded-full"
								style={{
									width: `${trait.score * 10}%`,
									// Related traits in a muted shade of the area's color.
									background: trait.own
										? color
										: `color-mix(in srgb, ${color} 45%, #57534e)`,
								}}
							/>
						</span>
					</li>
				))}
			</ul>
			<div className="mt-auto flex flex-wrap gap-2 pt-5">
				{areaLinks(t, area).map((link) =>
					link.primary ? (
						<Link
							key={link.url}
							to={link.url}
							className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-black hover:brightness-110"
							style={{ background: color }}
						>
							{link.label}
						</Link>
					) : (
						<Link
							key={link.url}
							to={link.url}
							className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm hover:border-white/60 hover:bg-white/5"
						>
							{link.label}
						</Link>
					),
				)}
			</div>
		</div>
	)
}

/** "Good for date night · friends · …" from the viewing guide, or nothing when the guide is empty. */
export function GoodForLine({
	t,
	className = "",
}: { t: F.TitleInput; className?: string }) {
	const items = goodFor(t)
	if (!items.length) return null
	return (
		<p className={`text-sm text-gray-300 ${className}`}>
			<span className="font-semibold text-emerald-200">Good for</span>{" "}
			{items.join(" · ")}
		</p>
	)
}
