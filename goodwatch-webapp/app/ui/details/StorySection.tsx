// The story: the tagline as a pull line, the synopsis (folded after four lines on a phone), and the essence tags.
import { useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import Description from "~/ui/details/Description"
import { CAPTION } from "~/ui/details/page-ui"
import MediaText from "~/ui/media-text/MediaText"
import { mediaTextAttributes, presentedText } from "~/ui/media-text/media-text"

export function StorySection({ media }: { media: MovieResult | ShowResult }) {
	const { details, fingerprint } = media
	const { synopsis, tagline } = details
	const tags = fingerprint?.essenceTags ?? []
	const [open, setOpen] = useState(false)
	const long = (synopsis?.length ?? 0) > 220
	return (
		<div data-feedback-area="details" className="flex max-w-3xl flex-col gap-5">
			{tagline && (
				<MediaText
					as="p"
					value={presentedText(details, "tagline", tagline)}
					className="border-l-2 border-amber-400/70 pl-4 text-lg font-medium italic leading-snug text-white sm:text-xl"
				/>
			)}
			{synopsis && (
				<div
					{...mediaTextAttributes(
						presentedText(details, "overview", synopsis).lang,
					)}
				>
					<div
						className={`text-[15px] leading-relaxed text-gray-200 sm:text-base [&>div]:my-0 [&>div]:text-[inherit] [&>div]:leading-[inherit] ${long && !open ? "max-sm:line-clamp-4" : ""}`}
					>
						<Description description={synopsis} />
					</div>
					{long && (
						<button
							type="button"
							onClick={() => setOpen(!open)}
							className="mt-1.5 cursor-pointer text-sm font-semibold text-amber-300/90 hover:text-amber-300 sm:hidden"
						>
							{open ? "Less" : "More"}
						</button>
					)}
				</div>
			)}
			{tags.length > 0 && (
				<div>
					<h3 className={`${CAPTION} mb-2.5`}>Feels like</h3>
					<ul className="flex flex-wrap gap-2">
						{tags.map((tag) => (
							<li
								key={tag}
								className="rounded-full bg-white/[0.05] px-3 py-1 text-sm text-gray-200 ring-1 ring-white/10"
							>
								{tag}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
