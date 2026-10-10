// PROTOTYPE - throwaway. The member home on the TV under each home variant of /prototype/watching-2 (#371), in the
// desktop edition (960 x 528 canvas) and the phone edition (560 x 308, 18 px smallest type), after the real member
// home (ui/living-room/TvScreens.tsx and PhoneTvScreens.tsx). No variant adds a row: the screen keeps its head and one
// band under it.
//   A doors: the band's tiles are the three intents: Continue, Start a show, A film.
//   B rail:  one pick fills the band, and a list of the intents beside it changes which pick it is.
//   C nav:   the screen as shipped (Watch next, Something new); the paths are in the header, the dock and the Remote.
// The Remote's wheel moves the focus and OK opens it, as in the real room.
import type { ReactNode } from "react"
import { WatchedButton } from "~/ui/prototype-watching/kit"
import { type Store, type Title, ago, code, img, isNew } from "~/ui/prototype-watching/model"
import { type Choice, type Facts, type Go, type Pick, costLine, hm, picksOf, plural, startsOf, surfaceOf } from "./model"

export type HomeItem = { id: string; lcd: [string, string]; open: () => void }
type Props = { store: Store; facts: Record<string, Facts>; choice: Choice; go: Go; focus: string; setFocus: (id: string) => void; phone?: boolean }

const RING = "ring-2 transition-[transform,background-color,box-shadow] duration-200"
const on = (focused: boolean) => (focused ? "ring-amber-300 bg-white/[0.10]" : "ring-white/5 bg-white/[0.04]")

const filmsCount = (store: Store) => store.wishlist.filter((t) => t.type === "movie").length
const showsCount = (store: Store) => store.wishlist.filter((t) => t.type === "show").length

/** What the focus can land on under each variant, with what the Remote's screen says and where OK goes. */
export function homeItems(store: Store, facts: Record<string, Facts>, choice: Choice, go: Go): HomeItem[] {
	const p = picksOf(store, facts)
	const items: HomeItem[] = []
	if (choice.home === "nav") {
		const wishlist = choice.wishlist === "behind"
		items.push({
			id: "watch-next",
			lcd: ["WATCH NEXT", wishlist ? `${store.wishlist.length} on your Wishlist` : p.tonight ? p.tonight.title.title : "Nothing yet"],
			open: () => go(wishlist ? "wishlist" : surfaceOf(p.tonight)),
		})
		items.push({ id: "new", lcd: ["SOMETHING NEW", "Close to your taste"], open: () => {} })
		return items
	}
	if (p.episode?.entry?.next)
		items.push({ id: "continue", lcd: ["CONTINUE", `${p.episode.title.title} · ${code(p.episode.entry.next)}`], open: () => go("shows", { mode: "continue" }) })
	if (p.start) items.push({ id: "start", lcd: ["START A SHOW", `${showsCount(store)} you want to see`], open: () => go("shows", { mode: "start" }) })
	items.push({ id: "film", lcd: ["A FILM", p.film ? `${p.film.title.title} · ${hm(p.film.title.runtime)}` : "No films yet"], open: () => go("films") })
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

const Background = () => <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />

function Head({ phone, line }: { phone?: boolean; line?: ReactNode }) {
	return phone ? (
		<div className="absolute left-5 right-[110px] top-3">
			<h2 className="truncate text-[26px] font-extrabold leading-tight tracking-tight">What are we watching?</h2>
		</div>
	) : (
		<div className="absolute left-12 right-44 top-9">
			<div className="text-[34px] font-extrabold leading-none tracking-tight">What are we watching?</div>
			{line && <div className="mt-2 text-[15px] text-white/60">{line}</div>}
		</div>
	)
}

const Eyebrow = ({ children, phone }: { children: ReactNode; phone?: boolean }) => (
	<span className={`block font-bold text-amber-300/90 ${phone ? "text-[18px] leading-tight" : "text-[12px] uppercase tracking-[0.22em]"}`}>{children}</span>
)

/** The text key in the head that keeps Something new one press away where the tiles became intents. */
function NewLine({ focus, setFocus }: Pick2) {
	return (
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
	)
}
type Pick2 = { focus: string; setFocus: (id: string) => void }

// ---------------------------------------------------------------------------------------------------------
// A: three doors.

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
}: Pick2 & {
	id: string
	phone?: boolean
	open: () => void
	backdrop?: string | null
	fan?: Title[]
	eyebrow: string
	title: string
	line: string
	sub?: string
	action?: ReactNode
}) {
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
				{!phone && <Eyebrow>{eyebrow}</Eyebrow>}
				<span className={`block font-extrabold leading-none ${phone ? "text-[23px]" : "mt-1.5 text-[30px]"}`}>{title}</span>
				<span className={`block truncate text-white/85 ${phone ? "mt-1 text-[18px] leading-tight" : "mt-2 text-[16px] font-semibold"}`}>{line}</span>
				{!phone && sub && <span className="mt-0.5 block truncate text-[13.5px] text-white/55">{sub}</span>}
				{action && <span className={`pointer-events-auto ${phone ? "absolute right-2 top-2" : "mt-3"}`}>{action}</span>}
			</div>
		</div>
	)
}

function Doors({ store, facts, go, focus, setFocus, phone }: Props) {
	const p = picksOf(store, facts)
	const starts = startsOf(store, facts)
	const shortest = startsOf(store, facts, "short")[0]
	const films = store.wishlist.filter((t) => t.type === "movie")
	const e = p.episode?.entry
	const f = { focus, setFocus }
	const three = !!e?.next && starts.length > 0
	return (
		<>
			<Background />
			<Head phone={phone} line={three ? <NewLine {...f} /> : "Everything else is in the menu, top right."} />
			<div className={`absolute grid ${phone ? "inset-x-5 bottom-4 top-[58px] gap-3" : "inset-x-12 top-[132px] gap-5"} grid-cols-3`}>
				{e?.next && (
					<Door
						id="continue"
						phone={phone}
						{...f}
						open={() => go("shows", { mode: "continue" })}
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
						open={() => go("shows", { mode: "start" })}
						fan={starts.map((s) => s.show)}
						eyebrow={`${plural(starts.length, "show")} you want to see`}
						title={phone ? "New show" : "Start a show"}
						line={phone ? `${starts.length} to start` : starts[0].show.title}
						sub={shortest ? `Shortest: ${shortest.show.title}, ${plural(facts[shortest.show.key]?.episodes ?? 0, "episode")}` : undefined}
					/>
				)}
				<Door
					id="film"
					phone={phone}
					{...f}
					open={() => go("films")}
					fan={p.film ? [p.film.title, ...films.filter((t) => t.key !== p.film?.title.key)].slice(0, 3).reverse() : []}
					eyebrow={`${plural(films.length, "film")} you want to see`}
					title="A film"
					line={phone ? `${films.length} films` : (p.film?.title.title ?? "No films yet")}
					sub={p.film ? [hm(p.film.title.runtime), p.film.title.service ? `on ${p.film.title.service.name}` : null].filter(Boolean).join(" · ") : undefined}
				/>
				{!three && (
					<Door
						id="new"
						phone={phone}
						{...f}
						open={() => {}}
						fan={store.suggestions}
						eyebrow="Not seen yet"
						title="Something new"
						line={phone ? "Your taste" : "Closest to your taste"}
					/>
				)}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: one pick, and the intents beside it.

function Rail({ store, facts, go, focus, setFocus, phone }: Props) {
	const p = picksOf(store, facts)
	const intents: { id: string; label: string; short: string; sub: string; pick: Pick | null }[] = []
	if (p.episode?.entry?.next)
		intents.push({ id: "continue", label: "Continue", short: "Continue", sub: `${p.episode.title.title} · ${code(p.episode.entry.next)}`, pick: p.episode })
	if (p.start) intents.push({ id: "start", label: "Start a show", short: "New show", sub: `${showsCount(store)} you want to see`, pick: p.start })
	intents.push({ id: "film", label: "A film", short: "A film", sub: `${filmsCount(store)} you want to see`, pick: p.film })
	if (!phone || intents.length < 3) intents.push({ id: "new", label: "Something new", short: "New", sub: "Close to your taste", pick: null })
	const current = intents.find((i) => i.id === focus) ?? intents[0]
	const pick = current.pick
	const e = pick?.kind === "episode" ? pick.entry : null
	const fct = pick ? facts[pick.title.key] : undefined
	const open = () => (current.id === "new" ? undefined : go(current.id === "film" ? "films" : "shows", current.id === "film" ? undefined : { mode: current.id }))
	const eyebrow = current.id === "continue" ? "Tonight's pick · Next episode" : current.id === "start" ? "Tonight's pick · a show to start" : current.id === "film" ? "Tonight's pick · a film" : "Something new"
	const line =
		current.id === "new"
			? "Not seen yet, on your services, closest to your taste."
			: e?.next
				? `${code(e.next)} · ${e.next.name}`
				: pick?.kind === "start"
					? costLine(fct)
					: pick
						? [hm(pick.title.runtime), `${pick.title.match}% taste match`].join(" · ")
						: "Want to See on a film puts it here."
	const sub = e?.next
		? `Last watched ${ago(e.track.lastWatch)}${pick?.title.service ? ` · on ${pick.title.service.name}` : ""}`
		: pick
			? [pick.kind === "start" && fct ? (fct.ended ? "Has ended" : "Still running") : null, pick.title.service ? `on ${pick.title.service.name}` : "Not on your services"].filter(Boolean).join(" · ")
			: ""
	const all = current.id === "continue" ? `All ${store.groups.next.length + store.groups.seenNew.length} ›` : current.id === "start" ? `All ${showsCount(store)} ›` : current.id === "film" ? `All ${filmsCount(store)} ›` : ""
	return (
		<>
			<Background />
			<Head phone={phone} />
			<div
				className={phone ? "absolute left-5 right-5 top-[52px] flex gap-2" : "absolute left-12 top-[100px] flex w-[250px] flex-col gap-2.5"}
				role="tablist"
				aria-label="What are we watching?"
			>
				{intents.map((i) => {
					const focused = i.id === current.id
					return (
						<button
							key={i.id}
							type="button"
							role="tab"
							aria-selected={focused}
							data-item={i.id}
							data-focused={focused}
							onMouseEnter={() => setFocus(i.id)}
							onClick={() => (focused ? open() : setFocus(i.id))}
							className={`cursor-pointer text-left ${RING} ${on(focused)} ${phone ? "h-[44px] flex-1 truncate rounded-full px-3 text-center text-[19px] font-extrabold !ring-4" : "rounded-2xl px-5 py-3"} ${focused && phone ? "!bg-amber-400 text-black" : ""}`}
						>
							{phone ? (
								i.short
							) : (
								<>
									<span className={`block text-[22px] font-extrabold leading-tight ${focused ? "text-amber-200" : ""}`}>{i.label}</span>
									<span className="block truncate text-[13.5px] text-white/55">{i.sub}</span>
								</>
							)}
						</button>
					)
				})}
			</div>
			<div
				data-pane={current.id}
				className={`absolute overflow-hidden bg-white/[0.04] ring-1 ring-white/10 ${phone ? "inset-x-5 bottom-4 top-[108px] rounded-2xl" : "bottom-10 left-[322px] right-12 top-[100px] rounded-3xl"}`}
			>
				<button type="button" onClick={open} className="absolute inset-0 cursor-pointer" aria-label={`Open ${current.label}`}>
					{pick?.title.backdrop && <img key={pick.title.key} src={img(pick.title.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
				</button>
				{!pick && current.id === "new" && <Fan titles={store.suggestions} w={phone ? 84 : 150} className={phone ? "right-6 top-4 -space-x-8" : "right-12 top-10 -space-x-12"} />}
				<span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/75 to-transparent" />
				<span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0c10]/90 via-transparent to-transparent" />
				<div className={`pointer-events-none absolute inset-0 flex flex-col justify-end ${phone ? "p-4" : "p-7"}`}>
					{!phone && <Eyebrow>{eyebrow}</Eyebrow>}
					<span className={`block truncate font-extrabold leading-none ${phone ? "text-[26px]" : "mt-2 text-[42px]"}`}>{pick?.title.title ?? (current.id === "new" ? "Something new" : "Nothing here yet")}</span>
					<span className={`block truncate text-white/90 ${phone ? "mt-1 text-[18px]" : "mt-2.5 text-[20px] font-semibold"}`}>{line}</span>
					{!phone && sub && <span className="mt-1 block truncate text-[14.5px] text-white/60">{sub}</span>}
					<span className={`pointer-events-auto flex items-center gap-3 ${phone ? "absolute right-3 top-3" : "mt-5"}`}>
						{e && (
							<WatchedButton
								entry={e}
								store={store}
								label={phone ? "none" : "long"}
								className={phone ? "!h-11 !w-11 !rounded-full !bg-black/60 [&>svg]:!h-6 [&>svg]:!w-6" : "!h-10 !rounded-full !bg-black/50 !px-4 !text-[15px] backdrop-blur"}
							/>
						)}
						{!phone && all && (
							<button type="button" onClick={open} data-all className="h-10 cursor-pointer rounded-full bg-amber-400 px-4 text-[15px] font-extrabold text-black">
								{all}
							</button>
						)}
					</span>
				</div>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: the screen as shipped.

function Shipped({ store, facts, choice, go, focus, setFocus, phone }: Props) {
	const p = picksOf(store, facts)
	const n = store.wishlist.length
	const wishlist = choice.wishlist === "behind"
	const tiles = [
		{
			id: "watch-next",
			title: "Watch next",
			line: wishlist ? (n ? `${n} on your Wishlist, best match first.` : "Your Wishlist is empty. Want to See adds a title here.") : `Tonight: ${p.tonight ? p.tonight.title.title : "nothing yet"}.`,
			short: wishlist ? `${n} on your Wishlist` : (p.tonight?.title.title ?? "Nothing yet"),
			art: store.wishlist,
			open: () => go(wishlist ? "wishlist" : surfaceOf(p.tonight)),
		},
		{ id: "new", title: "Something new", line: "Not seen yet, on your services, closest to your taste.", short: "Close to your taste", art: store.suggestions, open: () => {} },
	]
	return (
		<>
			<Background />
			<Head phone={phone} line="Everything else is in the menu, top right." />
			<div className={`absolute grid grid-cols-2 ${phone ? "inset-x-5 bottom-4 top-[58px] gap-4" : "inset-x-12 top-[132px] gap-6"}`}>
				{tiles.map((t) => (
					<button
						key={t.id}
						type="button"
						data-item={t.id}
						data-focused={focus === t.id}
						onMouseEnter={() => setFocus(t.id)}
						onClick={t.open}
						className={`relative flex cursor-pointer flex-col justify-end overflow-hidden text-left ${RING} ${on(focus === t.id)} ${focus === t.id ? "scale-[1.02]" : ""} ${phone ? "rounded-2xl p-4 !ring-4" : "h-[300px] rounded-3xl p-7"}`}
					>
						<Fan titles={t.art} w={phone ? 72 : 120} className={phone ? "-right-3 top-3 -space-x-7" : "-right-4 top-6 -space-x-10"} />
						<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
						<span className={`relative ${phone ? "" : "max-w-[62%]"}`}>
							<span className={`block font-extrabold leading-none ${phone ? "text-[24px]" : "text-[32px]"}`}>{t.title}</span>
							<span className={`block text-white/60 ${phone ? "mt-1 truncate text-[18px]" : "mt-2 text-[15px]"}`}>{phone ? t.short : t.line}</span>
						</span>
					</button>
				))}
			</div>
		</>
	)
}

export function HomeScreen(props: Props) {
	const Screen = props.choice.home === "doors" ? Doors : props.choice.home === "rail" ? Rail : Shipped
	return (
		<div className="absolute inset-0 text-white">
			<Screen {...props} />
			<Keys phone={props.phone} />
		</div>
	)
}
