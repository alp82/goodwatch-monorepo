// PROTOTYPE - throwaway. The person page (Jeremy Allen White, from fixture-person.json) from a copy of the real page's
// parts, with the same entry points as the title page around its details and credits.
import { FlagIcon } from "@heroicons/react/20/solid"
import { PERSON_AREAS } from "~/ui/prototype-feedback/model"
import {
	CollaboratorCards,
	Facts,
	GenresAndTags,
	Hero,
	Radar,
	Section,
	TitleCard,
	Titles,
	TraitCards,
} from "~/ui/prototype-feedback/PersonParts"
import { useFeedback } from "~/ui/prototype-feedback/store"
import { Block, HeaderExtra, ReportSheet } from "~/ui/prototype-feedback/TitlePage"
import data from "~/ui/prototype-feedback/fixture-person.json"

export default function PersonPage() {
	const { variant, setOpen } = useFeedback()
	return (
		<main className="min-h-screen pb-24">
			<div className="relative">
				<Hero data={data}>
					<div className="mt-6">
						<Block area="person">
							<Facts data={data} />
						</Block>
					</div>
				</Hero>
				{variant === "B" && (
					<div className="absolute top-20 right-4 z-10 sm:right-[max(1rem,calc((100vw-80rem)/2+1rem))]">
						<HeaderExtra phone />
					</div>
				)}
			</div>
			<div className="mx-auto max-w-7xl space-y-14 px-4 pt-6">
				<Block area="credits">
					<Section title="Known for" note="Their main titles.">
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{data.knownFor.map((c) => (
								<TitleCard key={c.key} c={c} />
							))}
						</div>
					</Section>
				</Block>
				{data.profile.signature.pillars.length > 0 && (
					<Section
						title="What stands out"
						note={`Compared with the average well-known movie, over ${data.profile.signature.basedOn} of their titles. Select a trait to filter titles.`}
					>
						<div className="grid items-start gap-8 lg:grid-cols-[320px_1fr]">
							<Radar data={data} />
							<TraitCards data={data} />
						</div>
					</Section>
				)}
				<GenresAndTags data={data} />
				<Section title="Works often with" note="People in at least two of their main titles.">
					<CollaboratorCards data={data} />
				</Section>
				<Block area="credits">
					<Titles data={data} />
				</Block>
				{variant === "B" && (
					<div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-white/[0.04] p-5 text-center ring-1 ring-white/10 sm:flex-row sm:justify-between sm:text-left">
						<p className="text-gray-300">Something wrong or missing on this page?</p>
						<button
							type="button"
							onClick={() => setOpen("pick")}
							className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 font-semibold text-gray-100 hover:bg-white/10"
						>
							<FlagIcon className="size-4" /> Tell us
						</button>
					</div>
				)}
			</div>
			<ReportSheet areas={PERSON_AREAS} />
		</main>
	)
}
