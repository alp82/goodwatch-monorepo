import { mediaFieldLanguage } from "~/utils/media-presentation"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { presentCatalogLoader } from "~/server/media-payload.server"
// Public share list page: /u/:handle/lists/:id. The card, large, and the five titles as rows: the score pill, the
// owner's score on someone else's list, and the viewer's own services that stream it in their country (none for a
// guest). Lists are looked up by id; a wrong or differently cased handle redirects to the canonical URL, and deleted lists
// (or lists of deleted accounts) answer 404. Unlisted lists open by link. The page is noindex, follow. Its og:image is the
// list's share card itself, as a small JPEG preview versioned by the list's content hash; the full-resolution card PNG
// stays at the same path with .png.
import {
	PencilSquareIcon,
	PlusIcon,
	Square2StackIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { ensureShareCard } from "~/server/share-card/images.server"
import { ownServicesOf } from "~/server/row-services.server"
import { getOwnerScores } from "~/server/share-lists/owner-scores.server"
import { createShareListPageLoader } from "~/server/share-lists/page-loaders.server"
import { getListView } from "~/server/share-lists/store.server"
import { getUserSettings } from "~/server/user-settings.server"
import {
	RowLogos,
	RowScores,
	rowMark,
	useRowMarks,
} from "~/ui/list-row/RowScores"
import { CardFonts, ScaledCard } from "~/ui/share-card/ScaledCard"
import { designByKey } from "~/ui/share-card/designs"
import { titleFontPreload } from "~/ui/share-card/font-faces"
import {
	newListPath,
	profilePath,
	shareListEditPath,
	SHARE_CARD_PREVIEW,
} from "~/ui/share-card/links"
import { type CardTitle, THEMES } from "~/ui/share-card/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import type { SizeRule } from "~/utils/tmdb-image"
import { countryFlagUrl } from "~/utils/country-flag"

export { pageHeaders as headers } from "~/utils/headers"

// Logos shown per title before the rest collapse into "+N".
const LOGOS_SHOWN = 3

const canonicalLoader = createShareListPageLoader({
	getListView,
	ensureShareCard,
	getUserIdFromRequest,
	getUserSettings,
	getOwnServices: ownServicesOf,
	getOwnerScores,
})

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data)
		return [
			{ title: "List not found · GoodWatch" },
			{ name: "robots", content: "noindex, nofollow" },
		]
	const { list, items, share } = data
	const title = `${list.title} by ${list.byline} · GoodWatch`
	const description = items
		.map((item, i) => `${i + 1}. ${item.title}`)
		.join("  ")
	const alt = `${list.title}: ${items.map((item) => item.title).join(", ")}`
	// The card's title is the page's largest text. The preload starts its font's download next to the
	// stylesheet's, so the title rarely shows in its fallback font first.
	const titleFont = titleFontPreload(designByKey(list.design).key)
	return [
		{ title },
		...(titleFont
			? [
					{
						tagName: "link",
						rel: "preload",
						as: "font",
						type: "font/woff2",
						href: titleFont,
						crossOrigin: "anonymous",
					},
				]
			: []),
		{ name: "description", content: description },
		// Lists stay out of results, but crawlers may follow a shared list to its five title pages.
		{ name: "robots", content: "noindex, follow" },
		{ tagName: "link", rel: "canonical", href: share.url },
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "GoodWatch" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: share.url },
		{ property: "og:image", content: share.image },
		{ property: "og:image:type", content: SHARE_CARD_PREVIEW.type },
		{ property: "og:image:width", content: String(share.width) },
		{ property: "og:image:height", content: String(share.height) },
		{ property: "og:image:alt", content: alt },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:site", content: "@GoodWatchApp" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: share.image },
		{ name: "twitter:image:alt", content: alt },
	]
}

const titlePath = (item: CardTitle) =>
	`/${item.type}/${item.key.split(":")[1]}-${titleToDashed(canonicalMediaTitle(item))}`

export default function ShareListPage() {
	const { list, items, services, ownerScores, country, owner, isOwner } =
		useLoaderData<typeof loader>()
	const design = designByKey(list.design)
	const t = THEMES[list.theme]
	const marksOf = useRowMarks()
	const gradient = `linear-gradient(90deg, ${t.accent}, ${t.accent2})`
	// The card's box is the page width on a phone and at most 640 px high, and a column of at most 624 px by 860 px
	// from lg up. These widths are upper limits for the image sizes.
	const shape = design.w / design.h
	const phoneWidth = Math.round(640 * shape)
	const cardDisplay = {
		rules: [
			["(min-width: 1024px)", `${Math.round(Math.min(624, 860 * shape))}px`],
			[null, phoneWidth < 400 ? `${phoneWidth}px` : "calc(100vw - 32px)"],
		] satisfies SizeRule[],
		maxWidth: Math.round(Math.min(624, 860 * shape)),
	}
	return (
		<main className="relative isolate min-h-screen overflow-hidden pb-24 text-white">
			<CardFonts design={design.key} />
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 opacity-40"
				style={{
					backgroundImage: `radial-gradient(ellipse at 30% 20%, ${t.accent}40 0%, transparent 60%)`,
				}}
			/>
			<div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:pt-10">
				<div className="lg:sticky lg:top-20 lg:self-start">
					<div className="h-[min(70vh,640px)] lg:h-[calc(100vh-7rem)] lg:max-h-[860px]">
						<ScaledCard
							design={design}
							card={{
								title: list.title,
								items,
								name: list.byline,
								theme: list.theme,
								date: list.date,
							}}
							fill
							display={cardDisplay}
							className="rounded-[18px] shadow-2xl shadow-black/60"
						/>
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-8">
					<header className="flex flex-col gap-3">
						<p className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">
							Top {items.length} · {list.date}
							{list.unlisted && (
								<span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 tracking-normal normal-case">
									Unlisted
								</span>
							)}
						</p>
						<h1 className="text-3xl font-black break-words sm:text-5xl">
							<span lang={mediaFieldLanguage(list)}>{list.title}</span>
						</h1>
						<p className="text-gray-300">
							By{" "}
							<Link
								to={profilePath(owner.handle)}
								className="font-bold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
							>
								{list.byline}
							</Link>
						</p>
						<div className="mt-2 flex flex-wrap gap-3">
							<Link
								to={newListPath()}
								className="flex items-center gap-2 rounded-full px-5 py-2.5 font-black text-black transition hover:brightness-110"
								style={{ backgroundImage: gradient }}
							>
								<PlusIcon className="size-5" aria-hidden />
								Make your own
							</Link>
							{isOwner ? (
								<Link
									to={shareListEditPath(owner.handle, list.id)}
									className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-bold hover:bg-white/15"
								>
									<PencilSquareIcon className="size-5" aria-hidden />
									Edit
								</Link>
							) : (
								<Link
									to={newListPath(list.id)}
									className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-bold hover:bg-white/15"
								>
									<Square2StackIcon className="size-5" aria-hidden />
									Remix
								</Link>
							)}
						</div>
					</header>

					<section
						aria-labelledby="titles-heading"
						className="flex flex-col gap-3"
					>
						<div className="flex items-baseline justify-between gap-3">
							<h2 id="titles-heading" className="text-lg font-bold">
								The list
							</h2>
							{services && (
								<span className="flex items-center gap-1.5 text-xs text-gray-400">
									<img
										src={countryFlagUrl(country)}
										alt=""
										width={15}
										height={10}
										className="h-2.5 w-auto rounded-[1px]"
									/>
									On your services in {country}
								</span>
							)}
						</div>
						<ol className="flex flex-col gap-2">
							{items.map((item, i) => {
								const marks = marksOf(
									item.type,
									Number(item.key.split(":")[1]),
								)
								const yours = services?.[item.key] ?? []
								return (
								<li
									key={item.key}
									className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 pr-3 ring-1 ring-white/5 sm:gap-4"
								>
									<span
										className="w-7 shrink-0 text-center text-2xl font-black sm:w-10 sm:text-4xl"
										style={{ color: t.accent }}
									>
										{i + 1}
									</span>
									<Link
										to={titlePath(item)}
										prefetch="intent"
										aria-label={item.title}
										className="shrink-0"
									>
										{item.poster ? (
											<img
												loading="lazy"
												decoding="async"
												width={56}
												height={84}
												srcSet={`${item.poster.replace("/w500/", "/w92/")} 1x, ${item.poster.replace("/w500/", "/w154/")} 2x`}
												src={item.poster.replace("/w500/", "/w92/")}
												alt=""
												className="aspect-[2/3] h-auto w-12 rounded-md object-cover shadow-lg shadow-black/50 sm:w-14"
											/>
										) : (
											<div className="aspect-[2/3] w-12 rounded-md bg-gray-800 sm:w-14" />
										)}
									</Link>
									<div className="flex min-w-0 flex-1 flex-col gap-1.5">
										<div className="min-w-0">
											<Link
												to={titlePath(item)}
												prefetch="intent"
												className="block truncate font-bold hover:underline hover:underline-offset-4"
											>
												<span lang={mediaFieldLanguage(item)}>{item.title}</span>
											</Link>
											<p className="text-xs text-gray-400">
												{[item.year, item.type === "movie" ? "Movie" : "Series"]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										{services && (
											<span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
												<RowLogos services={yours} max={LOGOS_SHOWN} />
												<span className="truncate">
													{yours.length === 1
														? yours[0].name
														: yours.length
															? null
															: "Not on your services"}
												</span>
											</span>
										)}
									</div>
									<RowScores
										goodwatch={item.score}
										score={marks.score}
										mark={rowMark(marks)}
										owner={ownerScores?.[item.key]}
										ownerName={list.byline}
									/>
								</li>
								)
							})}
						</ol>
						{services && (
						<p className="text-[11px] text-gray-500">
							Where to watch: data from{" "}
							<a
								href="https://www.justwatch.com"
								target="_blank"
								rel="noreferrer"
								className="underline decoration-white/20 hover:text-gray-300"
							>
								JustWatch
							</a>{" "}
							and{" "}
							<a
								href="https://www.themoviedb.org"
								target="_blank"
								rel="noreferrer"
								className="underline decoration-white/20 hover:text-gray-300"
							>
								TMDB
							</a>
							.
						</p>
						)}
					</section>
				</div>
			</div>
		</main>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
