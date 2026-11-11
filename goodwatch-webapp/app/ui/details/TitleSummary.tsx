// The title page's Summary section body: the synopsis (whole unless long), every essence tag as a Discover search, then
// who it's for and who should skip it as two cards side by side.
import {
	ArrowUpRightIcon,
	CheckIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { searchNavigationState } from "~/ui/search/search-attribution"
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { foldSynopsis } from "~/ui/details/synopsis-fold"
import { mediaTextAttributes, presentedText } from "~/ui/media-text/media-text"

type Media = MovieResult | ShowResult

/** A Discover search for a tag or a trope's name. */
export const discoverQueryPath = (q: string) =>
	`/discover?${new URLSearchParams({ q })}`

export function TitleSummary({
	media,
	goodFor,
	skip,
}: { media: Media; goodFor: string[]; skip: string[] }) {
	const tags = media.fingerprint?.essenceTags ?? []
	const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
	return (
		<div className="flex max-w-3xl flex-col gap-6">
			<div className="flex flex-col gap-4">
				<SynopsisText media={media} />
				<EssenceTags tags={tags} />
			</div>
			{(goodFor.length > 0 || skip.length > 0) && (
				<div
					className={`grid gap-3 ${goodFor.length && skip.length ? "sm:grid-cols-2" : ""}`}
				>
					<FitCard tone="good" title="Good for" items={goodFor.map(cap)} />
					<FitCard tone="skip" title="Skip it if" items={skip.map(cap)} />
				</div>
			)}
		</div>
	)
}

/** The synopsis in one paragraph; "More" continues it in place, in the same size. */
function SynopsisText({ media }: { media: Media }) {
	const synopsis = presentedText(
		media.details,
		"overview",
		media.details.synopsis,
	)
	const [open, setOpen] = useState(false)
	if (!synopsis.text) return null
	const { shown, hidden, cut } = foldSynopsis(synopsis.text)
	return (
		<p
			{...mediaTextAttributes(synopsis.lang)}
			className="text-pretty text-lg leading-relaxed text-gray-100 lg:text-xl lg:leading-relaxed"
		>
			{open && cut ? shown.replace(/…$/, "") : shown}
			{open && hidden ? ` ${hidden}` : ""}
			{hidden && (
				<>
					{" "}
					<button
						type="button"
						onClick={() => setOpen(!open)}
						className="cursor-pointer whitespace-nowrap font-semibold text-amber-300/90 hover:text-amber-300"
						aria-expanded={open}
					>
						{open ? "Less" : "More"}
					</button>
				</>
			)}
		</p>
	)
}

// Every essence tag, as a quiet chip with an accent dot; on hover the dot lights and an arrow says it opens a search.
function EssenceTags({ tags }: { tags: string[] }) {
	if (!tags.length) return null
	return (
		<ul className="flex flex-wrap gap-x-2 gap-y-2.5 pt-1">
			{tags.map((tag) => (
				<li key={tag}>
					<Link
						to={discoverQueryPath(tag)}
						state={searchNavigationState(tag, "title_tag", "link")}
						prefetch="intent"
						title={`Search Discover for “${tag}”`}
						className="group flex items-center gap-2 rounded-lg bg-gradient-to-b from-white/[0.07] to-white/[0.025] py-1.5 pr-3 pl-2.5 text-[15px] leading-5 text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.08] ring-inset transition-colors hover:from-amber-300/[0.12] hover:to-amber-300/[0.04] hover:text-white hover:ring-amber-300/30"
					>
						<span className="size-1.5 shrink-0 rounded-full bg-amber-300/50 transition-colors group-hover:bg-amber-300" />
						{tag}
						<ArrowUpRightIcon className="-mr-1 size-3.5 text-amber-200/0 transition-colors group-hover:text-amber-200" />
					</Link>
				</li>
			))}
		</ul>
	)
}

function FitCard({
	tone,
	title,
	items,
}: { tone: "good" | "skip"; title: string; items: string[] }) {
	if (!items.length) return null
	const good = tone === "good"
	const Icon = good ? CheckIcon : XMarkIcon
	return (
		<section
			aria-label={title}
			className={`rounded-xl p-4 ring-1 ${good ? "bg-emerald-400/[0.04] ring-emerald-300/15" : "bg-rose-400/[0.04] ring-rose-300/15"}`}
		>
			<h3
				className={`flex items-center gap-2 text-sm font-semibold ${good ? "text-emerald-200" : "text-rose-200"}`}
			>
				<span
					aria-hidden="true"
					className={`flex h-5 w-5 items-center justify-center rounded-full ${good ? "bg-emerald-400/15" : "bg-rose-400/15"}`}
				>
					<Icon className="h-3.5 w-3.5" />
				</span>
				{title}
			</h3>
			<ul className="mt-3 flex flex-col gap-2 text-[15px] leading-snug text-gray-200">
				{items.map((item) => (
					<li key={item} className="flex gap-2.5">
						<span
							aria-hidden="true"
							className={`mt-[0.55em] h-1 w-1 shrink-0 rounded-full ${good ? "bg-emerald-300/70" : "bg-rose-300/70"}`}
						/>
						{item}
					</li>
				))}
			</ul>
		</section>
	)
}
