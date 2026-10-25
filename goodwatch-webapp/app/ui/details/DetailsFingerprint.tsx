// The fingerprint as one compact section: the band of areas on top, a bold headline on the left, and the scales on
// the right. Selecting an area (a band segment, a scale, or a colored headline word) swaps both sides in place to
// that area: its lines and scales on the left, its details on the right. Every state shares one grid cell per side,
// so the section never changes height, and every state is in the server's HTML. The interface says "area", never
// "pillar".

import { useRef } from "react"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import AreaBand from "~/ui/details/fingerprint/AreaBand"
import AreaDetails, { GoodForLine } from "~/ui/details/fingerprint/AreaDetails"
import HeadlineText from "~/ui/details/fingerprint/HeadlineText"
import PaneSwap from "~/ui/details/fingerprint/PaneSwap"
import ScaleSlider from "~/ui/details/fingerprint/ScaleSlider"
import { AREAS } from "~/ui/details/fingerprint/areas"
import {
	areaLines,
	composeHeadline,
	segmentText,
} from "~/ui/details/fingerprint/headline"
import {
	type Scale,
	SCALE_GROUPS,
	scalesOf,
} from "~/ui/details/fingerprint/scales"
import {
	type AreaSelection,
	useAreaSelection,
} from "~/ui/details/fingerprint/selection"
import type * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"
import { useReplayedTap } from "~/utils/useReplayedTap"

const BOLD = "text-[1.45rem] leading-[1.2] sm:text-[1.9rem] lg:text-[2.1rem]"
const GROUP_HEADING =
	"text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

// Feel on its own column; Story and Look share the other. On phones each group runs two scales to a row.
function AllScales({
	t,
	selection,
}: { t: F.TitleInput; selection: AreaSelection }) {
	const [feel, story, look] = SCALE_GROUPS
	const item = (sc: Scale) => (
		<li key={sc.name} className="min-w-0">
			<ScaleSlider sc={sc} t={t} selection={selection} />
		</li>
	)
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8">
			<section className="col-span-2 sm:col-span-1">
				<h3 className={GROUP_HEADING}>{feel.name}</h3>
				<ul className="mt-0.5 grid grid-cols-2 gap-x-5 sm:grid-cols-1">
					{feel.scales.map(item)}
				</ul>
			</section>
			<div className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:col-span-1 sm:grid-cols-1">
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEADING}>{story.name}</h3>
					<ul className="mt-0.5 grid grid-cols-2 items-end gap-x-5 sm:grid-cols-1">
						{story.scales.map(item)}
					</ul>
				</section>
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEADING}>{look.name}</h3>
					<ul className="mt-0.5 grid grid-cols-2 gap-x-5 sm:grid-cols-1">
						{look.scales.map(item)}
					</ul>
				</section>
			</div>
		</div>
	)
}

function Fingerprint({ t }: { t: F.TitleInput }) {
	const selection = useAreaSelection()
	const active = selection.selected ?? "all"
	const root = useRef<HTMLDivElement>(null)
	// A tap on an area before the app's script was there (see utils/replay-tap.ts).
	useReplayedTap("area", (el) => Boolean(root.current?.contains(el)))
	return (
		<div ref={root}>
			<div className="mt-4">
				<AreaBand t={t} selection={selection} />
			</div>

			<div className="mt-6 grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<PaneSwap
					active={active}
					panes={[
						{
							id: "all",
							node: (
								<div className="flex h-full flex-col">
									<HeadlineText
										segments={composeHeadline(t)}
										selection={selection}
										className={BOLD}
									/>
									<GoodForLine t={t} className="mt-auto pt-5" />
								</div>
							),
						},
						...AREAS.map((area) => ({
							id: area,
							node: (
								<div className="flex h-full flex-col">
									<div className={`${BOLD} space-y-1`}>
										{areaLines(t, area).map((line) => (
											<HeadlineText
												key={segmentText(line)}
												segments={line}
												selection={selection}
											/>
										))}
									</div>
									<ul className="mt-auto max-w-md pt-5">
										{scalesOf(area).map((sc) => (
											<li key={sc.name}>
												<ScaleSlider
													sc={sc}
													t={t}
													selection={selection}
													layout="row"
												/>
											</li>
										))}
									</ul>
								</div>
							),
						})),
					]}
				/>

				<PaneSwap
					active={active}
					panes={[
						{ id: "all", node: <AllScales t={t} selection={selection} /> },
						...AREAS.map((area) => ({
							id: area,
							label: `${area} details`,
							node: <AreaDetails t={t} area={area} onReset={selection.reset} />,
						})),
					]}
				/>
			</div>
		</div>
	)
}

export default function DetailsFingerprint({
	media,
	sectionProps,
}: {
	media: MovieResult | ShowResult
	sectionProps: {
		id: string
		className: string
		ref: (el: HTMLDivElement) => void
	}
}) {
	if (!media.fingerprint) return null
	const t: F.TitleInput = {
		title: media.details.title,
		titleLang: media.details.presentation?.title.language,
		mediaType: media.mediaType,
		year: media.details.release_year,
		genres: media.details.genres,
		fingerprint: media.fingerprint,
	}
	return (
		<section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div {...sectionProps} data-feedback-area="analysis">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
					<img
						src={assetUrl(fingerprintIcon)}
						className="h-6 w-auto rounded-sm bg-amber-950/50 p-0.5"
						alt=""
					/>
					<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} />{" "}
					fingerprint
				</h2>
				<Fingerprint t={t} />
			</div>
		</section>
	)
}
