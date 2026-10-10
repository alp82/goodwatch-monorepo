// PROTOTYPE - throwaway. The member home on the TV for /prototype/watching-3 (#371): round 2's variant A, the three
// doors, as the owner chose it, with "movie" where round 2 said "film". Copied from ui/prototype-watching-2/home.tsx;
// the screen keeps its head and one band under it, and the Remote's wheel moves the focus and OK opens it.
import type { ReactNode } from "react"
import { WatchedButton } from "~/ui/prototype-watching/kit"
import { type Store, type Title, ago, code, img, isNew } from "~/ui/prototype-watching/model"
import { type Facts, hm, picksOf, plural, startsOf } from "~/ui/prototype-watching-2/model"
import type { Go } from "./model"

export type HomeItem = { id: string; lcd: [string, string]; open: () => void }
type Props = { store: Store; facts: Record<string, Facts>; go: Go; focus: string; setFocus: (id: string) => void; phone?: boolean }

const RING = "ring-2 transition-[transform,background-color,box-shadow] duration-200"
const on = (focused: boolean) => (focused ? "ring-amber-300 bg-white/[0.10]" : "ring-white/5 bg-white/[0.04]")
const showsCount = (store: Store) => store.wishlist.filter((t) => t.type === "show").length

/** What the focus can land on, with what the Remote's screen says and where OK goes. */
export function homeItems(store: Store, facts: Record<string, Facts>, go: Go): HomeItem[] {
	const p = picksOf(store, facts)
	const items: HomeItem[] = []
	if (p.episode?.entry?.next) items.push({ id: "continue", lcd: ["CONTINUE", `${p.episode.title.title} · ${code(p.episode.entry.next)}`], open: () => go("shows") })
	if (p.start) items.push({ id: "start", lcd: ["START A SHOW", `${showsCount(store)} you want to see`], open: () => go("shows", { at: "start" }) })
	items.push({ id: "movie", lcd: ["A MOVIE", p.film ? `${p.film.title.title} · ${hm(p.film.title.runtime)}` : "No movies yet"], open: () => go("movies") })
	items.push({ id: "new", lcd: ["SOMETHING NEW", "Close to your taste"], open: () => {} })
	return items
}

function Fan({ titles, w, className }: { titles: Title[]; w: number; className: string }) {
	return (
		<span className={`pointer-events-none absolute flex ${className}`}>
			{titles.slice(0, 3).map((t, i) => (
				<span key={t.key} className="block" style={{ transform: `rotate(${(i - 1) * 6}deg)` }}>
					<img src={img(t.poster, w > 100 ? "w185" : "w154")} alt="" className="rounded-lg object-cover shadow-2xl ring-1 ring-white/10" style={{ width: w, height: w * 1.5 }} />
				</span>
			))}
		</span>
	)
}

const Keys = ({ phone }: { phone?: boolean }) => (
	<div className={`absolute z-20 flex items-center gap-2 ${phone ? "right-4 top-3" : "right-6 top-5"}`} aria-hidden>
		{["M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z", "M4 7h16M4 12h16M4 17h16"].map((d) => (
			<span key={d} className={`flex items-center justify-center rounded-full bg-black/45 text-white/85 ring-1 ring-white/10 ${phone ? "h-11 w-11" : "h-9 w-9"}`}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={phone ? "h-6 w-6" : "h-[18px] w-[18px]"}>
					<title>Key</title>
					<path d={d} />
				</svg>
			</span>
		))}
	</div>
)

type Focus = { focus: string; setFocus: (id: string) => void }

function Door({
	id,
	phone,
	focus,
	setFocus,
	open,
	backdrop,
	fan,
	eyebrow,
	title,
	line,
	sub,
	action,
}: Focus & { id: string; phone?: boolean; open: () => void; backdrop?: string | null; fan?: Title[]; eyebrow: string; title: string; line: string; sub?: string; action?: ReactNode }) {
	const focused = focus === id
	return (
		<div
			data-item={id}
			data-focused={focused}
			onMouseEnter={() => setFocus(id)}
			className={`relative min-w-0 overflow-hidden ${RING} ${on(focused)} ${focused ? "scale-[1.025]" : ""} ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"}`}
		>
			<button type="button" onClick={open} className="absolute inset-0 cursor-pointer" aria-label={`${title}: ${line}`}>
				{backdrop && <img src={img(backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
			</button>
			{fan && <Fan titles={fan} w={phone ? 64 : 104} className={phone ? "-right-2 top-2 -space-x-9" : "-right-3 top-5 -space-x-12"} />}
			<span className={`pointer-events-none absolute inset-0 ${backdrop ? "bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/70 to-transparent" : "bg-gradient-to-tr from-[#0b0c10] via-[#0b0c10]/85 to-transparent"}`} />
			<div className={`pointer-events-none absolute inset-0 flex flex-col justify-end ${phone ? "p-3" : "p-6"}`}>
				{!phone && <span className="block text-[12px] font-bold uppercase tracking-[0.22em] text-amber-300/90">{eyebrow}</span>}
				<span className={`block font-extrabold leading-none ${phone ? "text-[23px]" : "mt-1.5 text-[30px]"}`}>{title}</span>
				<span className={`block truncate text-white/85 ${phone ? "mt-1 text-[18px] leading-tight" : "mt-2 text-[16px] font-semibold"}`}>{line}</span>
				{!phone && sub && <span className="mt-0.5 block truncate text-[13.5px] text-white/55">{sub}</span>}
				{action && <span className={`pointer-events-auto ${phone ? "absolute right-2 top-2" : "mt-3"}`}>{action}</span>}
			</div>
		</div>
	)
}

export function HomeScreen({ store, facts, go, focus, setFocus, phone }: Props) {
	const p = picksOf(store, facts)
	const starts = startsOf(store, facts)
	const shortest = startsOf(store, facts, "short")[0]
	const movies = store.wishlist.filter((t) => t.type === "movie")
	const e = p.episode?.entry
	const f = { focus, setFocus }
	const three = !!e?.next && starts.length > 0
	return (
		<div className="absolute inset-0 text-white">
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			{phone ? (
				<div className="absolute left-5 right-[110px] top-3">
					<h2 className="truncate text-[26px] font-extrabold leading-tight tracking-tight">What are we watching?</h2>
				</div>
			) : (
				<div className="absolute left-12 right-44 top-9">
					<div className="text-[34px] font-extrabold leading-none tracking-tight">What are we watching?</div>
					<div className="mt-2 text-[15px] text-white/60">
						{three ? (
							<>
								Nothing in mind?{" "}
								<button
									type="button"
									data-item="new"
									onMouseEnter={() => setFocus("new")}
									className={`cursor-pointer rounded-full px-2.5 py-0.5 font-bold ring-2 transition-colors ${focus === "new" ? "bg-white/10 text-white ring-amber-300" : "text-white/85 ring-transparent"}`}
								>
									Something new ›
								</button>
							</>
						) : (
							"Everything else is in the menu, top right."
						)}
					</div>
				</div>
			)}
			<div className={`absolute grid ${phone ? "inset-x-5 bottom-4 top-[58px] gap-3" : "inset-x-12 top-[132px] gap-5"} grid-cols-3`}>
				{e?.next && (
					<Door
						id="continue"
						phone={phone}
						{...f}
						open={() => go("shows")}
						backdrop={e.show.backdrop}
						eyebrow={isNew(store.today, e.next) ? "New episode" : `Next episode · ${ago(e.track.lastWatch)}`}
						title="Continue"
						line={phone ? `${code(e.next)} · ${e.show.title}` : `${e.show.title} · ${code(e.next)}`}
						sub={`${e.next.name}${store.groups.next.length > 1 ? ` · and ${store.groups.next.length - 1} more` : ""}`}
						action={
							<WatchedButton
								entry={e}
								store={store}
								label={phone ? "none" : "short"}
								className={phone ? "!h-11 !w-11 !rounded-full !bg-black/60 [&>svg]:!h-6 [&>svg]:!w-6" : "!h-9 !rounded-full !bg-black/50 !text-[14px] backdrop-blur"}
							/>
						}
					/>
				)}
				{starts.length > 0 && (
					<Door
						id="start"
						phone={phone}
						{...f}
						open={() => go("shows", { at: "start" })}
						fan={starts.map((s) => s.show)}
						eyebrow={`${plural(starts.length, "show")} you want to see`}
						title={phone ? "New show" : "Start a show"}
						line={phone ? `${starts.length} to start` : starts[0].show.title}
						sub={shortest ? `Shortest: ${shortest.show.title}, ${plural(facts[shortest.show.key]?.episodes ?? 0, "episode")}` : undefined}
					/>
				)}
				<Door
					id="movie"
					phone={phone}
					{...f}
					open={() => go("movies")}
					fan={p.film ? [p.film.title, ...movies.filter((t) => t.key !== p.film?.title.key)].slice(0, 3).reverse() : []}
					eyebrow={`${plural(movies.length, "movie")} you want to see`}
					title="A movie"
					line={phone ? `${movies.length} movies` : (p.film?.title.title ?? "No movies yet")}
					sub={p.film ? [hm(p.film.title.runtime), p.film.title.service ? `on ${p.film.title.service.name}` : null].filter(Boolean).join(" · ") : undefined}
				/>
				{!three && <Door id="new" phone={phone} {...f} open={() => {}} fan={store.suggestions} eyebrow="Not seen yet" title="Something new" line={phone ? "Your taste" : "Closest to your taste"} />}
			</div>
			<Keys phone={phone} />
		</div>
	)
}
