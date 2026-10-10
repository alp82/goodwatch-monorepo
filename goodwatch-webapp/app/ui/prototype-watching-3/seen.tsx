// PROTOTYPE - throwaway. Pieces the pages of /prototype/watching-3 (#371) share: the page head, and what a Seen title
// looks like as a card and as a row. A watch reads as the watch log prototype defines it: a day, a day and a time, or
// "Date unknown", and an imported watch says where it came from on a second line.
import { ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useState } from "react"
import { Progress } from "~/ui/prototype-watching/kit"
import { img } from "~/ui/prototype-watching/model"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { type Nav, type SeenItem, type SeenTitle, importLine, statusWord, watchesLine, whenOf } from "./model"

export const count = (n: number) => n.toLocaleString("en-US")

export type HeadLink = { id: string; label: string; open: () => void }

/** The ways from My shows and My movies to the Wishlist and, where it is a page of its own, to Seen. */
export function headLinks({ variant, store, seen, go }: Nav): HeadLink[] {
	const want = { id: "wishlist", label: `Wishlist · ${count(store.wishlist.length)}`, open: () => go("wishlist", { side: "want" }) }
	if (variant === "library") return [{ id: "library", label: "My library", open: () => go("wishlist", { side: "want" }) }]
	if (variant === "page") return [want, { id: "seen", label: `Seen · ${count(seen.length)}`, open: () => go("wishlist", { side: "seen" }) }]
	return [want]
}

export const LinkKey = ({ link }: { link: HeadLink }) => (
	<button
		type="button"
		data-to={link.id}
		onClick={link.open}
		className="inline-flex h-9 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
	>
		{link.label}
		<ChevronRightIcon className="h-4 w-4" aria-hidden />
	</button>
)

export function PageHead({ name, line, links = [], children }: { name: string; line: ReactNode; links?: HeadLink[]; children?: ReactNode }) {
	return (
		<header className={`${WRAP} flex flex-wrap items-end gap-x-6 gap-y-3 pb-4 pt-6`} data-page-head>
			<div className="min-w-0">
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{name}</h1>
				<p className="mt-1 text-sm text-gray-400">{line}</p>
			</div>
			<span className="grow" />
			{children}
			{links.map((l) => (
				<LinkKey key={l.id} link={l} />
			))}
		</header>
	)
}

export const Poster = ({ t, size = "w342", className = "" }: { t: SeenTitle; size?: string; className?: string }) =>
	t.poster ? (
		<img src={img(t.poster, size)} alt="" loading="lazy" decoding="async" className={`bg-white/5 object-cover ${className}`} />
	) : (
		<span className={`block bg-white/10 ${className}`} />
	)

export const KindTag = ({ t, className = "" }: { t: SeenTitle; className?: string }) => (
	<span className={`rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-100 backdrop-blur ${className}`}>{t.type === "show" ? "Show" : "Movie"}</span>
)

/** The member's score, or a quiet key to give one. Either opens the rating bar. */
export function Score({ item, askRate, className = "" }: { item: SeenItem; askRate: Nav["askRate"]; className?: string }) {
	if (item.entry && item.entry.track.status !== "seen") return null
	return item.mine != null ? (
		<button
			type="button"
			data-score={item.id}
			onClick={() => askRate(item)}
			aria-label={`Your score for ${item.t.title}: ${item.mine}. Change it`}
			className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-gray-950/85 text-sm font-black tabular-nums text-amber-300 ring-1 ring-amber-400/50 hover:bg-amber-400 hover:text-black ${className}`}
		>
			{item.mine}
		</button>
	) : (
		<button
			type="button"
			data-rate={item.id}
			onClick={() => askRate(item)}
			aria-label={`Rate ${item.t.title}`}
			className={`flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/30 bg-gray-950/85 px-2 text-xs font-semibold text-gray-300 hover:border-amber-300 hover:text-amber-200 ${className}`}
		>
			Rate
		</button>
	)
}

/** The bar a score is given in: one row of ten keys, above the dock. In the browser only. */
export function RateBar({ item, rate, close }: { item: SeenItem | null; rate: (id: string, score: number | null) => void; close: () => void }) {
	if (!item) return null
	return (
		<div data-rate-bar className="fixed inset-x-2 bottom-[150px] z-[66] mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-gray-950 p-3 text-gray-100 shadow-2xl ring-1 ring-white/20 lg:bottom-20">
			<div className="flex items-center gap-2">
				<Poster t={item.t} size="w92" className="h-12 w-8 shrink-0 rounded" />
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm">{item.t.title}</b>
					<span className="block text-xs text-gray-400">{item.mine == null ? "Your score" : `Your score is ${item.mine}`}</span>
				</span>
				<button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white">
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div className="grid grid-cols-10 gap-1">
				{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
					<button
						key={n}
						type="button"
						data-give={n}
						aria-pressed={item.mine === n}
						onClick={() => {
							rate(item.id, n)
							close()
						}}
						className={`h-10 cursor-pointer rounded-md text-sm font-black tabular-nums ${item.mine === n ? "bg-amber-400 text-black" : "bg-white/[0.08] text-gray-100 hover:bg-white/20"}`}
					>
						{n}
					</button>
				))}
			</div>
		</div>
	)
}

/** A Seen title in a grid: the poster with the score on it, then when it was watched. */
export function SeenCard({ item, today, askRate }: { item: SeenItem; today: string; askRate: Nav["askRate"] }) {
	const first = item.watches[0]
	const open = item.entry && item.entry.track.status !== "seen" ? item.entry : null
	return (
		<li className="min-w-0" data-seen={item.id}>
			<span className="relative block">
				<Poster t={item.t} className="aspect-[2/3] w-full rounded-lg ring-1 ring-white/5" />
				<KindTag t={item.t} className="absolute left-1.5 top-1.5" />
				{item.watches.length > 1 && <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-gray-100 backdrop-blur">{item.watches.length} watches</span>}
				{open && <span className="absolute inset-x-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-200 backdrop-blur">{statusWord(open)}</span>}
				<Score item={item} askRate={askRate} className="absolute bottom-1.5 right-1.5" />
			</span>
			<span className="mt-1.5 block truncate text-sm font-bold text-white">{item.t.title}</span>
			{open ? (
				<>
					<Progress entry={open} className="mt-1" />
					<span className="mt-1 block truncate text-xs text-gray-400">
						{open.done} of {open.show.total} episodes
					</span>
				</>
			) : (
				<>
					<span className="block truncate text-xs text-gray-400">{watchesLine(today, item)}</span>
					{first && importLine(first) && <span className="block truncate text-xs text-gray-500">{importLine(first)}</span>}
				</>
			)}
		</li>
	)
}

/** A Seen title as a row: when, where the watch came from, and the score at the end. */
export function SeenRow({ item, today, askRate }: { item: SeenItem; today: string; askRate: Nav["askRate"] }) {
	const first = item.watches[0]
	return (
		<li className="flex items-center gap-3 border-b border-white/5 py-2" data-seen={item.id}>
			<Poster t={item.t} size="w92" className="h-[60px] w-10 shrink-0 rounded" />
			<span className="min-w-0 flex-1">
				<b className="block truncate text-sm text-white md:text-base">{item.t.title}</b>
				<span className="block truncate text-xs text-gray-500">{[item.t.type === "show" ? "Show" : "Movie", item.t.year].filter(Boolean).join(" · ")}</span>
			</span>
			<span className="w-36 shrink-0 text-right text-xs sm:w-56 sm:text-left">
				<span className="block truncate text-gray-200">{first ? watchesLine(today, item) : ""}</span>
				{first && importLine(first) && <span className="block truncate text-gray-500">{importLine(first)}</span>}
			</span>
			<span className="flex w-12 shrink-0 justify-end">
				<Score item={item} askRate={askRate} />
			</span>
		</li>
	)
}

export { whenOf }

/** "Have I seen it?": a search over the titles on the page. */
export function Search({ value, onChange, placeholder }: { value: string; onChange: (q: string) => void; placeholder: string }) {
	return (
		<label className="relative flex h-9 min-w-0 flex-1 basis-44 items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 focus-within:ring-amber-300 sm:max-w-xs">
			<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" aria-hidden />
			<span className="sr-only">{placeholder}</span>
			<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-search className="h-full w-full min-w-0 bg-transparent pl-8 pr-2 text-sm text-white placeholder:text-gray-500 focus:outline-none" />
		</label>
	)
}

/** A long list in steps: the first `step`, and a key for the next ones. 1,500 posters are never drawn at once. */
export function useSteps<T>(list: T[], step: number) {
	const [n, setN] = useState(step)
	const shown = list.slice(0, n)
	const left = list.length - shown.length
	const more =
		left > 0 ? (
			<button type="button" data-more onClick={() => setN(n + step * 2)} className="mt-4 h-10 cursor-pointer self-start rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10">
				Show {count(Math.min(left, step * 2))} more <span className="font-medium text-gray-500">· {count(left)} left</span>
			</button>
		) : null
	return { shown, more, reset: () => setN(step) }
}

export const GRID = "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7"
