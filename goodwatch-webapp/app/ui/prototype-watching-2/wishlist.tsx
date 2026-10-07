// PROTOTYPE - throwaway. What becomes of the Wishlist under /prototype/watching-2 (#371) once films and shows have a
// page each.
//   A behind:    the Wishlist stays a page: everything the person wants to see, complete and plain, with no pick. The
//                two pages are views of it and link to it.
//   B dissolved: the Wishlist has no page. Its films are My films, its shows are under Start in My shows. This
//                surface then shows what a member meets where the Wishlist used to be.
import { BookmarkIcon, CheckIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useState } from "react"
import { type Store, type Title, ago, img } from "~/ui/prototype-watching/model"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { Segmented, SortSelect } from "./bits"
import { type Choice, type Facts, type Go, costLine, hm, picksOf, plural } from "./model"

type Props = { store: Store; facts: Record<string, Facts>; choice: Choice; go: Go }

/** The two ways on from the Wishlist: a film tonight, a show to start. */
function Doors({ store, facts, go }: Props) {
	const p = picksOf(store, facts)
	const films = store.wishlist.filter((t) => t.type === "movie").length
	const shows = store.wishlist.filter((t) => t.type === "show").length
	const door = (id: string, title: Title | undefined, name: string, line: string, open: () => void) => (
		<button
			type="button"
			data-door={id}
			onClick={open}
			className="group relative isolate flex min-h-28 cursor-pointer items-center gap-4 overflow-hidden rounded-2xl p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-amber-300"
		>
			{title?.backdrop && <img src={img(title.backdrop, "w780")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-55" />}
			<span className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
			{title?.poster && <img src={img(title.poster, "w154")} alt="" className="h-20 w-[54px] shrink-0 rounded-md object-cover ring-1 ring-white/10" />}
			<span className="min-w-0 flex-1">
				<span className={`${DISPLAY} block text-2xl text-white md:text-3xl`}>{name}</span>
				<span className="block truncate text-sm text-gray-300">{line}</span>
			</span>
			<ChevronRightIcon className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-amber-300" aria-hidden />
		</button>
	)
	return (
		<div className="grid gap-3 md:grid-cols-2">
			{door("films", p.film?.title, "My films", p.film ? `${plural(films, "film")} · tonight: ${p.film.title.title}, ${hm(p.film.title.runtime)}` : "No films yet", () => go("films"))}
			{door(
				"shows",
				(p.episode ?? p.start)?.title,
				"My shows",
				[p.episode ? `${store.groups.next.length} in progress` : null, `${shows} to start`].filter(Boolean).join(" · "),
				() => go("shows", { mode: p.episode ? "continue" : "start" }),
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A: the Wishlist stays, behind both pages.

type Kind = "all" | "movie" | "show"
type Sort = "added" | "waiting" | "match" | "top"
const SORTS: Record<Sort, string> = { added: "Last added", waiting: "Waiting longest", match: "Best match", top: "Top rated" }

function BehindPage(props: Props) {
	const { store, facts } = props
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<Sort>("added")
	const films = store.wishlist.filter((t) => t.type === "movie").length
	const by: Record<Sort, (t: Title) => number> = {
		added: (t) => facts[t.key]?.added ?? 0,
		waiting: (t) => -(facts[t.key]?.added ?? 0),
		match: (t) => -t.match,
		top: (t) => -(t.score ?? 0),
	}
	const list = store.wishlist.filter((t) => kind === "all" || t.type === kind).sort((a, b) => by[sort](a) - by[sort](b))
	return (
		<div className={`${WRAP} flex flex-col gap-6 pt-6`}>
			<header>
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>Wishlist</h1>
				<p className="mt-1 text-sm text-gray-400">Everything you want to see, films and shows together. Picking one for tonight happens on the two pages.</p>
			</header>
			<Doors {...props} />
			<div className="flex flex-wrap items-center gap-2">
				<Segmented
					label="Films or shows"
					value={kind}
					onChange={setKind}
					options={[
						{ key: "all", label: "All", count: store.wishlist.length },
						{ key: "movie", label: "Films", count: films },
						{ key: "show", label: "Shows", count: store.wishlist.length - films },
					]}
				/>
				<span className="grow" />
				<SortSelect value={sort} onChange={setSort} options={SORTS} />
			</div>
			<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7" data-wishlist-grid>
				{list.map((t) => (
					<li key={t.key} className="min-w-0" data-title={t.key}>
						<span className="relative block">
							<img src={img(t.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg bg-white/5 object-cover ring-1 ring-white/5" />
							<span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-100 backdrop-blur">{t.type === "show" ? "Show" : "Film"}</span>
						</span>
						<span className="mt-1.5 block truncate text-sm font-bold text-white">{t.title}</span>
						<span className="block truncate text-xs text-gray-400">{t.type === "show" ? costLine(facts[t.key]).split(" · ").slice(0, 2).join(" · ") : hm(t.runtime)}</span>
						<span className="block truncate text-xs text-gray-500">Added {ago(facts[t.key]?.added ?? null)}</span>
					</li>
				))}
			</ul>
			<p className="max-w-2xl text-sm text-gray-500">A show leaves the Wishlist with its first watched episode and is then in My shows. A film leaves it when you have watched it.</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: the Wishlist has no page.

function Fragment({ title, note, children }: { title: string; note: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10" data-fragment={title}>
			<div>
				<h2 className="text-base font-bold text-white">{title}</h2>
				<p className="text-sm text-gray-400">{note}</p>
			</div>
			{children}
		</section>
	)
}

function DissolvedPage(props: Props) {
	const { store, facts } = props
	const p = picksOf(store, facts)
	const film = p.film?.title
	const show = p.start?.title
	const toast = (t: Title | undefined, text: string, where: string) =>
		t && (
			<div className="flex items-center gap-3 rounded-xl bg-gray-950/95 p-2 pr-3 text-sm text-gray-100 shadow-2xl ring-1 ring-white/15">
				<img src={img(t.poster, "w92")} alt="" className="h-12 w-8 rounded object-cover" />
				<span className="min-w-0 flex-1">
					<b>{t.title}</b> {text}
				</span>
				<span className="rounded-lg bg-white/10 px-3 py-1.5 font-bold">{where}</span>
			</div>
		)
	const key = (onLabel: string) => (
		<span className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-400/15 px-4 text-sm font-bold text-amber-200 ring-1 ring-amber-400/50">
			<BookmarkIcon className="h-4 w-4" aria-hidden />
			{onLabel}
			<CheckIcon className="h-4 w-4" aria-hidden />
		</span>
	)
	return (
		<div className={`${WRAP} flex flex-col gap-6 pt-6`}>
			<header className="rounded-2xl border border-dashed border-fuchsia-400/60 p-5" data-note>
				<p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Prototype note</p>
				<h1 className={`${DISPLAY} mt-1 text-3xl text-white md:text-4xl`}>In this variant there is no Wishlist page</h1>
				<p className="mt-2 max-w-3xl text-sm text-gray-300">
					Want to See still exists and the Wishlist stays a word for what it collects, but nobody opens it. Its films are My films and its shows are under Start in My shows. Below is what a member meets
					where the Wishlist used to be.
				</p>
			</header>
			<Fragment title="An old link" note="/wishlist and /watch-next open the page Tonight's pick belongs to. A bookmark still lands somewhere useful.">
				<Doors {...props} />
			</Fragment>
			<div className="grid gap-6 lg:grid-cols-2">
				<Fragment title="After Want to See" note="The toast names the page the title went to.">
					{toast(film, "is in My films.", "Open")}
					{toast(show, "is in My shows, to start.", "Open")}
				</Fragment>
				<Fragment title="On a title page" note="The key keeps its name. Its lit state says where the title is now.">
					<div className="flex flex-wrap gap-2">
						{key("Want to See · in My films")}
						{key("Want to See · in My shows")}
					</div>
				</Fragment>
				<Fragment title="The account menu" note="Wishlist leaves it; the two pages are in the navigation instead.">
					<ul className="w-56 rounded-xl bg-gray-950 p-1.5 text-sm font-semibold text-gray-200 ring-1 ring-white/10">
						{["My films", "My shows", "Lists", "Settings"].map((item) => (
							<li key={item} className="rounded-lg px-3 py-2 hover:bg-white/10">
								{item}
							</li>
						))}
						<li className="rounded-lg px-3 py-2 text-gray-600 line-through">Wishlist</li>
					</ul>
				</Fragment>
				<Fragment title="What is lost" note="Nothing shows films and shows the person wants to see in one place, and the count of both together appears nowhere.">
					<p className="text-sm text-gray-300">
						{plural(store.wishlist.filter((t) => t.type === "movie").length, "film")} and {plural(store.wishlist.filter((t) => t.type === "show").length, "show")}: a member who wants to see both lists opens two pages. A
						share link to "my Wishlist" would have nothing to point at.
					</p>
				</Fragment>
			</div>
		</div>
	)
}

export function WishlistPage(props: Props) {
	return (
		<div className="overflow-x-clip pb-40" data-wishlist={props.choice.wishlist}>
			{props.choice.wishlist === "behind" ? <BehindPage {...props} /> : <DissolvedPage {...props} />}
		</div>
	)
}
