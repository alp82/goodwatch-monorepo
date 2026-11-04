// The header every sub-page of the title page has (Fingerprint, Tropes, At a glance, More like this's expanded view):
// the title page's sticky title bar (TitleBar.tsx: same place, height, widths, background, poster, title, the meta
// line that fits, the score) with a back chevron in front. The whole bar is one control that goes back, as the
// browser's Back does, so the title page lands where it was left. Where you are is for the rail and the page's
// heading to say.
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { MouseEvent, ReactNode } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import { FitLine } from "~/ui/details/TitleBar"
import { usePageMeta } from "~/ui/details/rail/rail-model"

/** Where the screen starts below the site header (64 px) and the bar (48 px on a desktop). */
export const SUB_HEADER_BOTTOM = 64 + 48

export type HeaderBack =
	| { to: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void }
	| { onBack: () => void }

export function SubPageHeader({
	poster,
	title,
	crumbs,
	back,
	end,
	meta,
}: {
	poster: string | null
	title: string
	/** Where you are after the title, for screen readers (the last is the sub-page). */
	crumbs: string[]
	back: HeaderBack
	/** At the bar's right, inside the control (the score). */
	end?: ReactNode
	/** The bar's meta line options, longest first (title-words.ts fitMeta); unset: the title page's. */
	meta?: string[]
}) {
	const pageMeta = usePageMeta()
	const className =
		"group flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md pr-1 text-left transition-colors duration-150 hover:bg-white/[.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 lg:-ml-2 lg:gap-3 lg:pl-1"
	const metaLine = meta ?? pageMeta
	const body = (
		<>
			<ChevronLeftIcon
				aria-hidden="true"
				className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:text-white"
			/>
			{poster && (
				<TmdbImage
					kind="poster"
					path={poster}
					width={28}
					alt=""
					data-sub-bar-poster=""
					className="h-10 w-[27px] shrink-0 rounded-[4px] object-cover ring-1 ring-white/10 lg:h-9 lg:w-6"
				/>
			)}
			<span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-baseline lg:gap-3">
				<span
					data-sub-bar-name=""
					className="truncate text-sm font-semibold text-white transition-colors group-hover:text-amber-200 lg:max-w-[50%] lg:shrink-0 lg:text-[15px]"
				>
					{title}
				</span>
				{metaLine && metaLine.length > 0 && (
					<FitLine
						options={metaLine}
						className="flex-1 text-[11px] text-gray-400 lg:text-[13px]"
					/>
				)}
			</span>
			<span className="sr-only">
				{crumbs.length ? `, ${crumbs.join(", ")}` : ""}
			</span>
			{end && <span className="shrink-0">{end}</span>}
		</>
	)
	const label = `Back to ${title}`
	return (
		<div
			data-sub-bar=""
			className="fixed inset-x-0 top-16 z-[31] border-b border-white/10 bg-stone-950 shadow-[0_8px_24px_rgba(0,0,0,.45)]"
		>
			<div className="mx-auto flex h-[52px] max-w-[88rem] items-center pr-2 pl-1 lg:h-12 lg:px-8">
				{"to" in back ? (
					<Link
						to={back.to}
						onClick={back.onClick}
						prefetch="intent"
						aria-label={label}
						data-sub-bar-back=""
						className={className}
					>
						{body}
					</Link>
				) : (
					<button
						type="button"
						onClick={back.onBack}
						aria-label={label}
						data-sub-bar-back=""
						className={className}
					>
						{body}
					</button>
				)}
			</div>
		</div>
	)
}
