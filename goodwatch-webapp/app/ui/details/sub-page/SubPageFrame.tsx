// The frame a title's sub-page (Fingerprint, Tropes, At a glance) sits in: the title page's own pieces around one of
// its sections, so going in reads as moving into one part of the same page, not a trip to another one. It keeps the
// blurred page backdrop, the title bar (as the sub-page header, the whole bar Back), the page's columns (main + the
// 18-19.5rem rail at the same gaps), the You block and find in the rail, and the section header style (the
// sub-page's heading is its section's header, grown to the page). The rail is the title page's "On this page" with
// the sub-page's entry selected and its parts under it (rail/SubPageRail.tsx).
import { useNavigate } from "@remix-run/react"
import { type ReactNode, useEffect } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { YouBlock } from "~/ui/details/YouBlock"
import { SubFind } from "~/ui/details/find/SubPageFind"
import type { FindGrid } from "~/ui/details/find/find-index"
import { land, takeSubGo } from "~/ui/details/find/landing"
import { useHlParam } from "~/ui/details/find/marks"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { CAPTION, SectionHeader } from "~/ui/details/page-ui"
import { SubPageRail, useSubParts } from "~/ui/details/rail/SubPageRail"
import { fitMeta } from "~/ui/details/title-words"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { SubPageHeader } from "./SubPageHeader"
import { SUB, type SubKind, titlePagePath } from "./paths"
import { openedFromTitlePage, useWayBack } from "./way-back"
import { writeJump } from "./way-in"

type Media = MovieResult | ShowResult

export interface SubPageFrameProps {
	media: Media
	country: string
	kind: SubKind
	/** The line under the sub-page's heading. */
	subtitle: string
	/** A show's episodes for find (the sub-page's loader sends what find reads); null for a movie. */
	findGrid: FindGrid | null
	/** The sub-page's content. */
	children: ReactNode
}

const body = () => document.querySelector<HTMLElement>("[data-sub-body]")

export function SubPageFrame({
	media,
	country,
	kind,
	subtitle,
	findGrid,
	children,
}: SubPageFrameProps) {
	useHlParam()
	const sub = SUB[kind]
	const back = useWayBack(titlePagePath(media))
	const backdrop = media.details.backdrop_path
		? tmdbImageUrl(media.details.backdrop_path, "w300")
		: ""
	const parts = useSubParts(kind)
	const navigate = useNavigate()
	/** Back to the title page at one of its sections. */
	const toSection = (id: string) => {
		const path = back.to.split(/[?#]/)[0]
		writeJump(path, id)
		if (openedFromTitlePage()) window.history.back()
		else navigate(path)
	}
	// A part named in the address (a link to one of At a glance's rows): there once it has laid out.
	useEffect(() => {
		const id = window.location.hash.slice(1)
		if (!id) return
		let n = 0
		let t = 0
		const go = () => {
			document
				.getElementById(id)
				?.scrollIntoView({ block: "start", behavior: "instant" })
			if (++n < 6) t = window.setTimeout(go, 120)
		}
		const f = requestAnimationFrame(go)
		const stop = () => window.clearTimeout(t)
		window.addEventListener("wheel", stop, { once: true, passive: true })
		window.addEventListener("touchstart", stop, { once: true, passive: true })
		return () => {
			cancelAnimationFrame(f)
			stop()
		}
	}, [])
	// A find match picked elsewhere (the title page, another sub-page) lands here once it is laid out. Taken once (an
	// effect that runs twice must not lose it), so its landing isn't stopped by a cleanup either.
	useEffect(() => {
		const go = takeSubGo(window.location.pathname)
		if (go) land(go, body)
	}, [])
	return (
		<div
			data-subpage={kind}
			className="relative isolate min-h-dvh overflow-x-clip pb-28 text-white"
		>
			{backdrop && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 -z-10"
					style={{
						backgroundImage: `url(${backdrop})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
						filter: "blur(64px) brightness(0.15)",
					}}
				/>
			)}
			<SubPageHeader
				poster={media.details.poster_path ?? null}
				title={media.details.title}
				crumbs={[sub.label]}
				meta={fitMeta(media, country)}
				back={back}
				end={<ScoreRing media={media} size={30} label={false} />}
			/>
			<div className="mx-auto max-w-[88rem] px-4 pt-[68px] lg:px-8 lg:pt-16">
				<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:gap-x-16">
					<div
						data-sub-main
						className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pl-6"
					>
						<section
							id={`sub-${kind}`}
							aria-labelledby={`sub-${kind}-h`}
							className="pt-6"
						>
							<div data-sub-head>
								<SectionHeader
									anchor={`sub-${kind}`}
									icon={sub.icon}
									title={sub.label}
									subtitle={subtitle}
									as="h1"
									context={`${media.details.title}:`}
								/>
							</div>
							{/* On a phone, find sits above the content. */}
							<div className="mt-5 lg:hidden">
								<SubFind
									media={media}
									country={country}
									kind={kind}
									back={back}
									listId="find-sub-phone"
									findGrid={findGrid}
								/>
							</div>
							<div data-sub-body className="mt-6 min-w-0 lg:mt-8">
								{children}
							</div>
						</section>
					</div>
					<aside
						aria-label={`You and ${sub.label}`}
						className="hidden min-w-0 lg:sticky lg:top-32 lg:col-start-2 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-9rem)] lg:flex-col lg:self-start lg:pt-6"
					>
						<section data-sub-you aria-label="You" className="shrink-0">
							<h2 className={`${CAPTION} mb-2.5`}>You</h2>
							<YouBlock
								media={media}
								country={country}
								onWatch={() => toSection("watch")}
							/>
						</section>
						<div
							data-sub-index
							className="mt-6 flex min-h-0 flex-1 flex-col border-t border-white/10 pt-5"
						>
							<SubFind
								media={media}
								country={country}
								kind={kind}
								back={back}
								listId="find-sub-rail"
								findGrid={findGrid}
							>
								<div className="mt-5 flex min-h-0 flex-1 flex-col">
									<SubPageRail
										media={media}
										kind={kind}
										back={back}
										sub={parts}
									/>
								</div>
							</SubFind>
						</div>
					</aside>
				</div>
			</div>
		</div>
	)
}
