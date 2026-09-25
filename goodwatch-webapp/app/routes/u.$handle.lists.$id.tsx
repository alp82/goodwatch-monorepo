// Public share list page: /u/:handle/lists/:id. The card, large, and the five titles with where they stream in the
// viewer's country. Lists are looked up by id; an outdated handle redirects to the canonical URL, and deleted lists
// (or lists of deleted accounts) answer 404. Unlisted lists open by link. The page is noindex. Its og:image is the
// versioned 1200x630 link preview, not the card, because link previews crop or shrink portrait images.
import { CheckIcon } from "@heroicons/react/20/solid"
import {
	PencilSquareIcon,
	PlusIcon,
	Square2StackIcon,
} from "@heroicons/react/24/outline"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { resolveCountry } from "~/server/country.server"
import { previewHash } from "~/server/share-card/images.server"
import {
	type ListOffer,
	type TitleAvailability,
	getListAvailability,
} from "~/server/share-lists/availability.server"
import { getList, getProfileByUserId } from "~/server/share-lists/store.server"
import { resolveCardTitles } from "~/server/share-lists/titles.server"
import { getUserSettings } from "~/server/user-settings.server"
import { LIST_PREVIEW_SIZE } from "~/ui/og-image/ListPreviewCard"
import { CardFonts, ScaledCard } from "~/ui/share-card/ScaledCard"
import { designByKey } from "~/ui/share-card/designs"
import {
	newListPath,
	profilePath,
	publicOrigin,
	shareListEditPath,
	shareListPath,
	shareListPreviewPath,
} from "~/ui/share-card/links"
import { type CardTitle, THEMES, cardDate, listByline } from "~/ui/share-card/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import { duplicateProviderMapping } from "~/utils/streaming-links"

// A list or profile can come back (Undo, a restored account), so "not found" must never be cached.
const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } })

export { pageHeaders as headers } from "~/utils/headers"

// Offers shown per title before the rest collapse into "+N".
const OFFERS_SHOWN = 4

export async function loader({ params, request }: LoaderFunctionArgs) {
	const list = await getList(params.id ?? "")
	if (!list) throw notFound()
	const owner = await getProfileByUserId(list.userId)
	if (!owner) throw notFound()
	if (params.handle !== owner.handle)
		return redirect(shareListPath(owner.handle, list.id), 301)

	const viewerId = await getUserIdFromRequest({ request })
	// Settings only refine the page (country, the viewer's services); the list still shows without them.
	const settings = viewerId
		? await getUserSettings({ userId: viewerId }).catch((error) => {
				console.error("[share-list] user settings failed", error)
				return null
			})
		: null
	const { country } = resolveCountry({
		request,
		countryDefault: settings?.country_default,
	})
	const [items, availability] = await Promise.all([
		resolveCardTitles(list.items),
		getListAvailability(list.items, country),
	])

	// The viewer's own services come first and get a check mark, as on title pages.
	const owned = new Set(
		(settings?.streaming_providers_default ?? "")
			.split(",")
			.filter(Boolean)
			.map(Number)
			.flatMap((id) => [id, ...(duplicateProviderMapping[id] ?? [])]),
	)

	const design = designByKey(list.design)
	const origin = publicOrigin()
	const signature = listByline(list.signature, owner.handle)
	return json(
		{
			list: {
				id: list.id,
				title: list.title,
				design: design.key,
				theme: list.theme,
				signature,
				date: cardDate(new Date(list.createdAt)),
				unlisted: list.visibility === "unlisted",
			},
			items,
			availability,
			owned: [...owned],
			country,
			owner: { handle: owner.handle, displayName: owner.displayName },
			isOwner: viewerId === list.userId,
			share: {
				url: `${origin}${shareListPath(owner.handle, list.id)}`,
				image: `${origin}${shareListPreviewPath(list.id, previewHash(list, signature))}`,
				width: LIST_PREVIEW_SIZE.width,
				height: LIST_PREVIEW_SIZE.height,
			},
		},
		// Lists are live: after an edit, the page (and its og:image URL) must change right away, so no shared caching.
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data)
		return [
			{ title: "List not found · GoodWatch" },
			{ name: "robots", content: "noindex, nofollow" },
		]
	const { list, items, share } = data
	const title = `${list.title} by ${list.signature} · GoodWatch`
	const description = items
		.map((item, i) => `${i + 1}. ${item.title}`)
		.join("  ")
	const alt = `${list.title}: ${items.map((item) => item.title).join(", ")}`
	return [
		{ title },
		{ name: "description", content: description },
		{ name: "robots", content: "noindex, nofollow" },
		{ tagName: "link", rel: "canonical", href: share.url },
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "GoodWatch" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: share.url },
		{ property: "og:image", content: share.image },
		{ property: "og:image:type", content: "image/png" },
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
	`/${item.type}/${item.key.split(":")[1]}-${titleToDashed(item.title)}`

export default function ShareListPage() {
	const { list, items, availability, owned, country, owner, isOwner } =
		useLoaderData<typeof loader>()
	const design = designByKey(list.design)
	const t = THEMES[list.theme]
	const ownedIds = new Set(owned)
	const gradient = `linear-gradient(90deg, ${t.accent}, ${t.accent2})`
	return (
		<main className="relative isolate min-h-screen overflow-hidden pb-24 text-white">
			<CardFonts />
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
								name: list.signature,
								theme: list.theme,
								date: list.date,
							}}
							fill
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
							{list.title}
						</h1>
						<p className="text-gray-300">
							By{" "}
							<Link
								to={profilePath(owner.handle)}
								className="font-bold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
							>
								{list.signature}
							</Link>
							{list.signature !== `@${owner.handle}` && (
								<span className="text-gray-400"> · @{owner.handle}</span>
							)}
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
							<span className="flex items-center gap-1.5 text-xs text-gray-400">
								<img
									src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`}
									alt=""
									className="h-2.5 rounded-[1px]"
								/>
								Where to watch in {country}
							</span>
						</div>
						<ol className="flex flex-col gap-2">
							{items.map((item, i) => (
								<li
									key={item.key}
									className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 pr-3 ring-1 ring-white/5 sm:gap-4"
								>
									<span
										className="w-8 shrink-0 text-center text-3xl font-black sm:w-10 sm:text-4xl"
										style={{ color: t.accent }}
									>
										{i + 1}
									</span>
									<Link
										to={titlePath(item)}
										prefetch="intent"
										className="shrink-0"
									>
										{item.poster ? (
											<img
												src={item.poster.replace("/w500/", "/w185/")}
												alt=""
												className="aspect-[2/3] w-12 rounded-md object-cover shadow-lg shadow-black/50 sm:w-14"
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
												{item.title}
											</Link>
											<p className="text-xs text-gray-400">
												{[item.year, item.type === "movie" ? "Movie" : "Series"]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										<Availability
											availability={availability[item.key]}
											country={country}
											ownedIds={ownedIds}
										/>
									</div>
								</li>
							))}
						</ol>
						<p className="text-[11px] text-gray-500">
							Links go to licensed services. Data from{" "}
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
					</section>
				</div>
			</div>
		</main>
	)
}

const KIND_LABEL: Record<ListOffer["kind"], string> = {
	stream: "Stream",
	rent: "Rent",
	buy: "Buy",
}

function Availability({
	availability,
	country,
	ownedIds,
}: {
	availability?: TitleAvailability
	country: string
	ownedIds: Set<number>
}) {
	if (!availability || availability.state === "none")
		return (
			<p className="text-xs text-gray-500">
				No streaming offers in {country} yet.
			</p>
		)
	if (availability.state === "unknown")
		return (
			<p className="text-xs text-gray-500">
				Availability in {country} is unknown right now.
			</p>
		)

	const stream = availability.offers
		.filter((o) => o.kind === "stream")
		.sort(
			(a, b) =>
				Number(ownedIds.has(b.serviceId)) - Number(ownedIds.has(a.serviceId)),
		)
	// Without a streaming offer, show where to rent or buy instead, one logo per service.
	const offers = stream.length
		? stream
		: availability.offers.filter(
				(o, i, all) => all.findIndex((x) => x.serviceId === o.serviceId) === i,
			)
	const shown = offers.slice(0, OFFERS_SHOWN)
	const more = offers.length - shown.length
	return (
		<div className="flex min-w-0 items-center gap-1.5">
			{!stream.length && (
				<span className="mr-0.5 text-xs text-gray-400">Rent or buy</span>
			)}
			{shown.map((o) => {
				const mine = ownedIds.has(o.serviceId)
				const label = `${KIND_LABEL[o.kind]} on ${o.name}${mine ? ", one of your services" : ""}`
				const logo = o.logo ? (
					<img src={o.logo} alt={label} className="size-7 rounded-md" />
				) : (
					<span className="flex h-7 items-center rounded-md bg-white/10 px-2 text-xs">
						{o.name}
					</span>
				)
				return (
					<span key={`${o.kind}-${o.serviceId}`} className="relative shrink-0">
						{o.url ? (
							<a
								href={o.url}
								target="_blank"
								rel="noreferrer"
								title={label}
								className={`block rounded-md ring-2 hover:brightness-125 ${mine ? "ring-green-500" : "ring-transparent"}`}
							>
								{logo}
							</a>
						) : (
							<span title={label} className="block">
								{logo}
							</span>
						)}
						{mine && (
							<span className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-gray-950">
								<CheckIcon className="size-2.5" aria-hidden />
							</span>
						)}
					</span>
				)
			})}
			{more > 0 && <span className="text-xs text-gray-400">+{more}</span>}
			{stream.length === 1 && (
				<span className="ml-1 min-w-0 truncate text-xs text-gray-400">
					{stream[0].name}
				</span>
			)}
		</div>
	)
}
