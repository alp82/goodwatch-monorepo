import { useMemo, useState } from "react"
// The profile's Wishlist tab. The owner sees "Watch now" first (wishlist titles on their services, best match first),
// the import call to action and the way to the editable page; a signed-in visitor sees the titles they've already
// seen first, their own score in each card's pill. Then everything, newest first or by title. The posters are the
// site's poster cards, for the visitor to pick from; on the owner's own Wishlist they leave out the bookmark.
import type { LibraryKind } from "~/domain/my-library"
import type {
	ProfileShell,
	ProfileTitle,
	ProfileWishlistPage,
} from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ImportCta } from "../ImportCta"
import { ProfileCard } from "../ProfileCard"
import {
	OwnerPageLink,
	Segmented,
	SortSelect,
	TILE,
	count,
	shortDate,
} from "../parts"

type Kind = LibraryKind
type Sort = "added" | "title"
const FIRST = 48

export function WishlistPage({
	shell,
	page,
	you,
}: {
	shell: ProfileShell
	page: ProfileWishlistPage
	you: Record<string, number> | null
}) {
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<Sort>("added")
	const [all, setAll] = useState(false)
	const owner = shell.viewer === "owner"
	const rest = useMemo(() => {
		const list =
			kind === "all"
				? page.titles
				: page.titles.filter((t) => t.mediaType === kind)
		const sorted =
			sort === "title"
				? [...list].sort((a, b) => a.title.localeCompare(b.title))
				: [...list].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
		return you
			? [
					...sorted.filter((t) => you[t.key] != null),
					...sorted.filter((t) => you[t.key] == null),
				]
			: sorted
	}, [page.titles, kind, sort, you])
	const seenByYou = you
		? page.titles.filter((t) => you[t.key] != null).length
		: 0
	const movies = page.titles.filter((t) => t.mediaType === "movie").length
	const card = (t: ProfileTitle, caption: string | null | undefined) => (
		<li key={t.key} className="flex min-w-0 flex-col gap-1.5">
			<ProfileCard title={t} skipWant={owner} />
			{caption && (
				<span className="block truncate text-[11px] text-gray-500">
					{caption}
				</span>
			)}
		</li>
	)

	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<Segmented
					label="Movies or shows"
					value={kind}
					onChange={setKind}
					options={[
						["all", `All ${count(page.titles.length)}`],
						["movie", `Movies ${count(movies)}`],
						["show", `Shows ${count(page.titles.length - movies)}`],
					]}
				/>
				<span className="grow" />
				<SortSelect
					value={sort}
					onChange={setSort}
					options={[
						{ key: "added", label: "Last added", hint: "Newest first" },
						{ key: "title", label: "Title", hint: "A to Z" },
					]}
				/>
				{owner && (
					<OwnerPageLink to="/my-library/want">
						Open in My library
					</OwnerPageLink>
				)}
			</div>

			<ImportCta shell={shell} what="wishlist" />

			{owner && page.watchNow && page.watchNow.length > 0 && (
				<section>
					<h2 className={`${DISPLAY} text-2xl`}>Watch now</h2>
					<p className="mt-1 mb-4 text-sm text-gray-400">
						On your services today, your best match first. Only you see this.
					</p>
					<ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
						{page.watchNow.map((t) =>
							card(t, t.match ? `${t.match}% match` : shortDate(t.date)),
						)}
					</ul>
				</section>
			)}

			{seenByYou > 0 && (
				<p className="rounded-xl bg-sky-400/[0.07] px-4 py-3 text-sm text-sky-100 ring-1 ring-sky-400/25">
					You've already seen <b>{count(seenByYou)}</b> of the titles @
					{shell.handle} wants to see. They come first, with your score on the
					poster.
				</p>
			)}

			{page.titles.length ? (
				<section>
					<h2 className="mb-4 flex items-baseline gap-2 border-b border-white/10 pb-2">
						<span className={`${DISPLAY} text-2xl`}>Everything</span>
						<span className="text-sm tabular-nums text-gray-500">
							{count(page.total)}
						</span>
					</h2>
					<ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
						{(all ? rest : rest.slice(0, FIRST)).map((t) =>
							card(
								t,
								t.date
									? `Added ${shortDate(t.date)}`
									: t.year
										? String(t.year)
										: undefined,
							),
						)}
					</ul>
					{rest.length > FIRST && (
						<button
							type="button"
							onClick={() => setAll((a) => !a)}
							className="mt-4 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"
						>
							{all ? "Show fewer" : `Show all ${count(rest.length)}`}
						</button>
					)}
				</section>
			) : (
				<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
					{owner
						? "Your Wishlist is empty."
						: `@${shell.handle}'s Wishlist is empty.`}
				</p>
			)}
		</>
	)
}
