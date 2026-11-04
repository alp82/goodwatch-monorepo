// The opened content of an At a glance row: the facts panel, the content guide (the age ratings, how strong each kind
// of content is, the viewing guide), the whole cast, the crew as credits. The sub-page draws every one in its HTML;
// the title page loads this on the first row it opens (LazyGlanceDetail), since every row is closed at first.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { CAPTION } from "~/ui/details/page-ui"
import { CastSection } from "~/ui/details/people/CastSection"
import { ageWord, countryName } from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { CrewCredits } from "./CrewCredits"
import { FactsPanel } from "./FactsPanel"
import { contentLevels, ratings, severity, viewingGuide } from "./content"
import type { GlanceRowId } from "./rows"

type Media = MovieResult | ShowResult

export default function GlanceDetail({
	id,
	media,
	country,
	questions,
}: {
	id: GlanceRowId
	media: Media
	country: string
	questions: TitleQuestion[]
}) {
	if (id === "glance-facts") return <FactsPanel media={media} />
	if (id === "glance-content")
		return (
			<ContentGuide media={media} country={country} questions={questions} />
		)
	if (id === "glance-cast") return <CastSection media={media} />
	return <CrewCredits media={media} />
}

// --- Content ------------------------------------------------------------------------------------------------------

const severityColor = (v: number) =>
	v >= 7
		? "bg-rose-300/75"
		: v >= 5
			? "bg-amber-300/75"
			: v >= 3
				? "bg-amber-200/45"
				: "bg-emerald-300/50"

const CONTENT_ROW =
	"grid grid-cols-[minmax(0,10rem)_1fr_6.5rem] items-center gap-3 text-[14px]"

/** The opened Content row: the age ratings, how strong each kind of content is, the viewing guide. */
function ContentGuide({
	media,
	country,
	questions,
}: { media: Media; country: string; questions: TitleQuestion[] }) {
	const rated = ratings(media, country)
	const advisories = media.details.content_advisories ?? []
	const kids = questions.find((q) => q.id === "kids")
	const { levels, unscaled } = contentLevels(media)
	const guide = viewingGuide(media)
	return (
		<div className="grid gap-8 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-10">
			<div>
				<h4 className={`${CAPTION} mb-3`}>Rated</h4>
				{rated.length ? (
					<ul className="flex flex-wrap gap-4">
						{rated.map((r) => (
							<li key={r.cc} className="flex flex-col items-start gap-1">
								<span className="rounded-md px-2 py-0.5 text-lg font-bold text-white tabular-nums ring-1 ring-white/20">
									{ageWord(r.cert)}
								</span>
								<span className="text-xs text-gray-400">
									{countryName(r.cc)}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-gray-500">No age rating yet.</p>
				)}
				{kids && (
					<p className="mt-4 text-[14px] leading-snug text-gray-300">
						{kids.a}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-7">
				{(levels.length > 0 || unscaled.length > 0) && (
					<div>
						<h4 className={`${CAPTION} mb-3`}>What's in it</h4>
						<ul className="flex flex-col gap-2.5">
							{levels.map((c) => (
								<li key={c.key} className={CONTENT_ROW}>
									<span
										className={`truncate ${c.named ? "font-semibold text-white" : "text-gray-300"}`}
									>
										{c.label}
									</span>
									<span className="relative h-2 rounded-full bg-white/[0.06]">
										<span
											className={`absolute inset-y-0 left-0 rounded-full ${severityColor(c.value)}`}
											style={{ width: `${Math.max(3, c.value * 10)}%` }}
										/>
									</span>
									<span
										className={`text-right text-[13px] ${c.value >= 5 ? "text-gray-200" : "text-gray-500"}`}
									>
										{severity(c.value)}
									</span>
								</li>
							))}
							{unscaled.map((a) => (
								<li key={a} className={CONTENT_ROW}>
									<span className="truncate font-semibold text-white">{a}</span>
									<span className="text-[13px] text-gray-500">
										Named in the advisories
									</span>
									<span />
								</li>
							))}
						</ul>
						<p className="mt-3 text-xs text-gray-500">
							{advisories.length > 0 &&
								"In white: what the content advisories name. "}
							Levels from the title analysis.
						</p>
					</div>
				)}
				{guide.listed.length > 0 && (
					<div>
						<h4 className={`${CAPTION} mb-3`}>Viewing guide</h4>
						<div className="flex flex-wrap gap-1.5">
							{guide.listed.map((g) => (
								<span
									key={g}
									className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[13px] font-medium text-emerald-200 ring-1 ring-emerald-300/25 ring-inset"
								>
									{g}
								</span>
							))}
						</div>
						{guide.notFor.length > 0 && (
							<p className="mt-2.5 text-[13px] text-gray-500">
								Not listed for{" "}
								{guide.notFor.map((x) => x.toLowerCase()).join(" or ")}.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
