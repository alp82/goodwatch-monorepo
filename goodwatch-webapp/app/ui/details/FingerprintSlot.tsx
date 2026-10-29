import type { TitleSides } from "~/server/title-sides.server"
// The fingerprint section's place on the title page. Until the new fingerprint section lands, it shows today's
// fingerprint and, for a member, where the title sits in their taste (the taste group line). The page imports
// FingerprintSection from here; the new section takes the same props.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import TitleSidesLine from "~/ui/details/hero/TitleSidesLine"

const noSection = { id: "fingerprint-body", className: "", ref: () => {} }

export function FingerprintSection({
	media,
	sides,
}: { media: MovieResult | ShowResult; sides: TitleSides | null }) {
	return (
		<div className="flex flex-col gap-6">
			{/* Its own heading repeats the section's. */}
			<div className="[&>section>div>h2]:hidden [&>section]:max-w-none [&>section]:p-0">
				<DetailsFingerprint media={media} sectionProps={noSection} />
			</div>
			{sides && (
				<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
					<TitleSidesLine
						sides={sides}
						mediaType={media.mediaType}
						tmdbId={media.details.tmdb_id}
					/>
				</div>
			)}
		</div>
	)
}
