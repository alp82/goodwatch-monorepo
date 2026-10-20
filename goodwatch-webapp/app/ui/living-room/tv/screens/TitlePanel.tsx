import { Frame, Item, keySize, useTvView } from "../kit"
import type { TvTitleOnScreen } from "../tv-title"
import { YoutubePlayer } from "~/ui/details/YoutubePlayer"
import { AREAS, AREA_COLOR } from "~/ui/details/fingerprint/areas"
import {
	areaStripes,
	segmentGrow,
	stripeColor,
} from "~/ui/details/fingerprint/band"
import { composeHeadline } from "~/ui/details/fingerprint/headline"
import { SCALE_GROUPS, readScale } from "~/ui/details/fingerprint/scales"

/** The title page's real fingerprint, presented as readings, never editable sliders. */
export default function TitlePanel({
	title: on,
	items,
}: { title: TvTitleOnScreen; items: readonly string[] }) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const t = on.extras?.fingerprint
	const trailer = on.panel === "trailer"
	const requestedGroup = on.group ?? -1
	const selectedGroup = Number.isInteger(requestedGroup)
		? SCALE_GROUPS[requestedGroup]
		: undefined
	const group = selectedGroup ? requestedGroup : -1
	const message = !on.extras
		? on.extrasFailed
			? "Details could not be loaded. Please try again."
			: "Loading title details…"
		: trailer
			? "No trailer available for this title."
			: "No fingerprint available for this title."
	const groups = P ? (selectedGroup ? [selectedGroup] : []) : SCALE_GROUPS
	return (
		<Frame name={trailer ? "Trailer" : "Fingerprint"} items={items} dim={0.9}>
			<div className="flex h-full min-h-0 flex-col">
				{trailer ? (
					<div className="min-h-0 flex-1">
						{on.extras?.trailer ? (
							<div className="relative mx-auto aspect-video h-full max-w-full">
								<YoutubePlayer videoKey={on.extras.trailer} />
							</div>
						) : (
							<p role="status" className="text-[26px]">
								{message}
							</p>
						)}
					</div>
				) : t ? (
					<div className="min-h-0 flex-1 overflow-y-auto" data-tv-fingerprint>
						<div
							className={
								P
									? "text-[24px] font-bold truncate"
									: "text-[30px] font-bold truncate"
							}
						>
							{t.title}
						</div>
						<div className="mt-3 flex gap-1" aria-label="Fingerprint areas">
							{AREAS.map((area) => (
								<div
									key={area}
									className="min-w-0"
									style={{ flex: segmentGrow(t.fingerprint.pillars[area]) }}
								>
									<div
										className="flex h-4 overflow-hidden rounded-sm"
										aria-hidden="true"
									>
										{areaStripes(area, t.fingerprint.scores, t.title).map(
											(stripe) => (
												<i
													key={stripe.id}
													style={{
														flex: stripe.width,
														background: stripeColor(
															AREA_COLOR[area],
															stripe.brightness,
														),
													}}
												/>
											),
										)}
									</div>
									<span className={P ? "text-[16px]" : "text-[20px]"}>
										{area}
									</span>
								</div>
							))}
						</div>
						<div
							className={P ? "mt-3" : "mt-6 grid grid-cols-[1fr_1.2fr] gap-10"}
						>
							{(!P || group < 0) && (
								<p
									className={`font-bold leading-tight ${P ? "text-[24px]" : "text-[38px]"}`}
								>
									{composeHeadline(t).map((seg, i) => (
										<span
											key={i}
											style={{
												color: seg.area
													? AREA_COLOR[seg.area]
													: seg.tone === "muted"
														? "#a8a29e"
														: undefined,
											}}
										>
											{seg.text}
										</span>
									))}
								</p>
							)}
							<div className={P ? "mt-3" : "grid grid-cols-2 gap-x-7 gap-y-3"}>
								{groups.map((g) => (
									<section
										key={g.name}
										className={!P && g.name === "Feel" ? "row-span-2" : ""}
										aria-label={g.name}
										style={{
											opacity:
												P || group < 0 || group === SCALE_GROUPS.indexOf(g)
													? 1
													: 0.75,
										}}
									>
										<h3
											className={
												P ? "sr-only" : "text-[20px] font-bold text-white/65"
											}
										>
											{g.name}
										</h3>
										<dl
											className={
												P ? "grid grid-cols-2 gap-x-5 gap-y-2" : "space-y-2"
											}
										>
											{g.scales.map((sc) => {
												const { position, word } = readScale(sc, t)
												return (
													<div
														key={sc.name}
														className="text-[20px] leading-tight"
													>
														<div className="flex justify-between gap-2">
															<dt className="text-white/65">{sc.name}</dt>
															<dd className="text-right font-semibold">
																{word}
															</dd>
														</div>
														<div
															className="mt-1 h-1.5 rounded-full bg-white/10"
															aria-hidden="true"
														>
															<div
																className="h-full rounded-full"
																style={{
																	width: `${position * 100}%`,
																	background: AREA_COLOR[sc.area],
																}}
															/>
														</div>
													</div>
												)
											})}
										</dl>
									</section>
								))}
							</div>
						</div>
					</div>
				) : (
					<p role="status" className="flex-1 text-[26px]">
						{message}
					</p>
				)}
				<div className={`mt-3 flex shrink-0 gap-2 ${P ? "" : "gap-4"}`}>
					{!trailer &&
						[{ name: "Summary" }, ...SCALE_GROUPS].map((g, at) => {
							const i = at - 1
							return (
								<Item
									key={g.name}
									id={`group:${i}`}
									pressed={group === i}
									className={`tvc-act flex items-center justify-center ${P ? "px-3 text-[19px]" : "px-4 text-[22px]"} ${group === i ? "ring-2 ring-amber-300" : ""}`}
									style={{ height: keySize(canvas, 54) }}
								>
									{g.name}
								</Item>
							)
						})}
					<Item
						id="close"
						className={`tvc-btn flex items-center justify-center ${P ? "px-3 text-[19px]" : "px-6 text-[22px]"}`}
						style={{ height: keySize(canvas, 54) }}
					>
						Close
					</Item>
				</div>
			</div>
		</Frame>
	)
}
