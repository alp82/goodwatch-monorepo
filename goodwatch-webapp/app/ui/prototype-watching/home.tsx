// PROTOTYPE - throwaway. The member home on the TV under each variant of /prototype/watching (#371), in the desktop
// edition (960 x 528 canvas) and the phone edition (560 x 308, 18 px smallest type), after the real member home
// (ui/living-room/TvScreens.tsx and PhoneTvScreens.tsx): "What are we watching?" over two tiles.
//   A section: a Watching row above the two tiles.
//   B merged:  the Watch next tile leads with the Next episode.
//   C view:    one Next episode line above the two tiles; everything else is in the Watching view.
//   D mix:     C's line, named Tonight's pick.
import type { ReactNode } from "react"
import { WatchedButton } from "./kit"
import { type Entry, type Store, type Title, type VariantKey, ago, code, img, isNew, watchNextOf } from "./model"

export type Go = (surface: "home" | "wishlist", tab?: "watching" | "wishlist") => void
type Props = { store: Store; variant: VariantKey; go: Go }

const FOCUS = "ring-2 ring-white/5 bg-white/[0.04] transition-[transform,background-color,box-shadow] duration-200 hover:ring-amber-300 hover:bg-white/[0.10]"

/** The shows a member can continue tonight: Watching with a Next episode, then Seen shows with new episodes. */
const tonight = (store: Store) => [...store.groups.next, ...store.groups.seenNew]

const lastLine = (e: Entry) => (e.kind === "seenNew" ? `${e.left} new since you saw it` : `Last watched ${ago(e.track.lastWatch)}`)

function Posters({ titles, w, className }: { titles: Title[]; w: number; className: string }) {
	return (
		<span className={`absolute flex ${className}`}>
			{titles.slice(0, 3).map((t, i) => (
				<span key={t.key} className="block" style={{ transform: `rotate(${(i - 1) * 6}deg)` }}>
					<img
						src={img(t.poster, w > 100 ? "w185" : "w92")}
						alt=""
						className="rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
						style={{ width: w, height: w * 1.5 }}
					/>
				</span>
			))}
		</span>
	)
}

/** One of the home's two tiles, as the real home draws them. `children` sit above the tile's own click target. */
function Tile({
	phone,
	title,
	line,
	art,
	onClick,
	className = "",
	id,
}: { phone?: boolean; title: string; line: string; art: Title[]; onClick: () => void; className?: string; id: string }) {
	return (
		<button
			type="button"
			data-tile={id}
			onClick={onClick}
			className={`relative flex cursor-pointer flex-col justify-end overflow-hidden text-left hover:scale-[1.02] ${FOCUS} ${phone ? "rounded-2xl p-4 !ring-4" : "rounded-3xl p-7"} ${className}`}
		>
			<Posters titles={art} w={phone ? 72 : 120} className={phone ? "-right-3 top-3 -space-x-7" : "-right-4 top-6 -space-x-10"} />
			<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
			<span className={`relative ${phone ? "" : "max-w-[62%]"}`}>
				<span className={`block font-extrabold leading-none ${phone ? "text-[24px]" : "text-[32px]"}`}>{title}</span>
				<span className={`block text-white/60 ${phone ? "mt-1 truncate text-[18px]" : "mt-2 text-[15px]"}`}>{line}</span>
			</span>
		</button>
	)
}

function useTiles({ store, go }: Props) {
	const n = store.wishlist.length
	return {
		watchNext: {
			id: "watch-next",
			title: "Watch next",
			line: n ? `${n} on your Wishlist, best match first.` : "Your Wishlist is empty. Want to See adds a title here.",
			short: n ? `${n} on your Wishlist` : "Your Wishlist is empty",
			art: store.wishlist,
			onClick: () => go("wishlist", "wishlist"),
		},
		somethingNew: {
			id: "something-new",
			title: "Something new",
			line: "Not seen yet, on your services, closest to your taste.",
			short: "Close to your taste",
			art: store.suggestions,
			onClick: () => {},
		},
	}
}

// The search and menu keys in the TV's top right corner, for the framing.
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
	<span className={`font-bold text-amber-300/90 ${phone ? "text-[18px]" : "text-[12px] uppercase tracking-[0.25em]"}`}>{children}</span>
)

// ---------------------------------------------------------------------------------------------------------
// A: a Watching row above the two tiles.

function SectionHome(props: Props & { phone?: boolean }) {
	const { store, go, phone } = props
	const tiles = useTiles(props)
	const shows = tonight(store)
	const shown = shows.slice(0, phone ? 2 : 3)
	const rest = shows.length - shown.length
	const waiting = store.groups.caughtUp.length + store.groups.comingBack.length + store.groups.onHold.length
	if (!shows.length)
		return (
			<>
				<Background />
				<Head phone={phone} line="Everything else is in the menu, top right." />
				<div className={`absolute grid grid-cols-2 ${phone ? "inset-x-5 bottom-4 top-[58px] gap-4" : "inset-x-12 top-[132px] gap-6"}`}>
					{[tiles.watchNext, tiles.somethingNew].map((t) => (
						<Tile key={t.id} {...t} line={phone ? t.short : t.line} phone={phone} className={phone ? "" : "h-[300px]"} />
					))}
				</div>
			</>
		)
	return (
		<>
			<Background />
			<Head phone={phone} />
			{!phone && (
				<div className="absolute inset-x-12 top-[88px] flex items-baseline justify-between">
					<Eyebrow>Watching</Eyebrow>
					<button type="button" onClick={() => go("wishlist")} className="cursor-pointer text-[13px] font-semibold text-white/60 hover:text-white" data-all>
						{waiting ? `All ${shows.length}, and ${waiting} waiting or On hold ›` : "Open ›"}
					</button>
				</div>
			)}
			<div className={`absolute flex ${phone ? "inset-x-5 top-[56px] h-[84px] gap-3" : "inset-x-12 top-[114px] h-[130px] gap-4"}`}>
				{shown.map((e) => (
					<div
						key={e.show.key}
						data-card={e.show.key}
						className={`relative flex min-w-0 items-center overflow-hidden ${FOCUS} ${phone ? "flex-1 gap-2.5 rounded-xl p-2 !ring-4" : "max-w-[320px] flex-1 gap-3 rounded-2xl p-3"}`}
					>
						<img src={img(e.show.backdrop, "w300")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
						<img src={img(e.show.poster, "w92")} alt="" className={`relative shrink-0 rounded-md object-cover ${phone ? "h-[66px] w-[44px]" : "h-[104px] w-[70px]"}`} />
						<span className="relative min-w-0 flex-1">
							<span className={`block truncate font-extrabold leading-tight ${phone ? "text-[18px]" : "text-[18px]"}`}>{e.show.title}</span>
							<span className={`block truncate text-white/85 ${phone ? "text-[18px] leading-tight" : "text-[15px]"}`}>
								{e.next && code(e.next)}
								{!phone && e.next && ` · ${e.next.name}`}
							</span>
							{!phone && (
								<span className="block truncate text-[14px] text-white/55">
									{isNew(store.today, e.next) ? "New · " : ""}
									{lastLine(e)}
								</span>
							)}
							{!phone && <WatchedButton entry={e} store={store} label="short" className="mt-1.5 !h-8 !rounded-full !text-[13px]" />}
						</span>
						{phone && <WatchedButton entry={e} store={store} label="none" className="relative !h-12 !w-12 !rounded-full [&>svg]:!h-7 [&>svg]:!w-7" />}
					</div>
				))}
				{rest > 0 && (
					<button
						type="button"
						onClick={() => go("wishlist")}
						data-all
						className={`flex shrink-0 cursor-pointer flex-col items-center justify-center font-extrabold text-white/80 ${FOCUS} ${phone ? "w-[64px] rounded-xl text-[20px] !ring-4" : "w-[84px] rounded-2xl text-[24px]"}`}
					>
						+{rest}
						{!phone && <span className="text-[12px] font-semibold text-white/50">more</span>}
					</button>
				)}
			</div>
			<div className={`absolute grid grid-cols-2 ${phone ? "inset-x-5 bottom-4 top-[152px] gap-4" : "inset-x-12 top-[264px] gap-6"}`}>
				{[tiles.watchNext, tiles.somethingNew].map((t) => (
					<Tile key={t.id} {...t} line={phone ? t.short : t.line} phone={phone} className={phone ? "" : "h-[232px]"} />
				))}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: Watch next includes Next episodes, so its tile leads with one.

function MergedHome(props: Props & { phone?: boolean }) {
	const { store, go, phone } = props
	const tiles = useTiles(props)
	const { slots } = watchNextOf(store, "merged")
	const first = slots[0]
	const entry = first?.entry
	const episodes = slots.filter((s) => s.entry).length
	const then = slots
		.slice(1, 3)
		.map((s) => (s.entry?.next ? `${s.title.title} ${code(s.entry.next)}` : s.title.title))
		.join(", ")
	return (
		<>
			<Background />
			<Head phone={phone} line="Everything else is in the menu, top right." />
			<div
				className={`absolute grid ${entry ? "grid-cols-[1.45fr_1fr]" : "grid-cols-2"} ${phone ? "inset-x-5 bottom-4 top-[58px] gap-4" : "inset-x-12 top-[132px] gap-6"}`}
			>
				{entry?.next ? (
					<div data-tile="watch-next" className={`relative overflow-hidden ${FOCUS} ${phone ? "rounded-2xl !ring-4" : "h-[300px] rounded-3xl"}`}>
						<button type="button" onClick={() => go("wishlist")} className="absolute inset-0 cursor-pointer" aria-label="Open Watch next">
							<img src={img(entry.show.backdrop, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
							<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/75 to-transparent" />
						</button>
						<div className={`pointer-events-none absolute inset-0 flex flex-col justify-end ${phone ? "p-4" : "p-7"}`}>
							<Eyebrow phone={phone}>Watch next{phone ? "" : " · Next episode"}</Eyebrow>
							<span className={`mt-1 block truncate font-extrabold leading-none ${phone ? "text-[26px]" : "text-[38px]"}`}>{entry.show.title}</span>
							<span className={`block truncate text-white/90 ${phone ? "mt-1 text-[18px]" : "mt-2 text-[19px]"}`}>
								{code(entry.next)} · {entry.next.name}
							</span>
							{!phone && (
								<span className="mt-1 block truncate text-[14px] text-white/60">
									{lastLine(entry)}
									{entry.show.service ? ` · on ${entry.show.service.name}` : ""}
								</span>
							)}
							<span className={`pointer-events-auto flex items-center gap-3 ${phone ? "mt-2" : "mt-4"}`}>
								<WatchedButton
									entry={entry}
									store={store}
									label="short"
									className={phone ? "!h-11 !rounded-full !px-4 !text-[18px]" : "!h-10 !rounded-full !px-4 !text-[15px]"}
								/>
								{!phone && then && (
									<span className="min-w-0 truncate text-[13px] text-white/55">
										Then {then}
										{slots.length > 3 ? `, +${slots.length - 3}` : ""}
									</span>
								)}
							</span>
						</div>
						{!phone && (
							<span className="absolute right-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white/75 ring-1 ring-white/10">
								{episodes} next {episodes === 1 ? "episode" : "episodes"} · {store.wishlist.length} on your Wishlist
							</span>
						)}
					</div>
				) : (
					<Tile {...tiles.watchNext} line={phone ? tiles.watchNext.short : tiles.watchNext.line} phone={phone} className={phone ? "" : "h-[300px]"} />
				)}
				<Tile {...tiles.somethingNew} line={phone ? tiles.somethingNew.short : tiles.somethingNew.line} phone={phone} className={phone ? "" : "h-[300px]"} />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: one Next episode line; the rest of Watching is a view beside the Wishlist.

function ViewHome(props: Props & { phone?: boolean }) {
	const { store, go, phone } = props
	const tiles = useTiles(props)
	const shows = tonight(store)
	const e = shows[0]
	const tracked = store.groups.next.length + store.groups.caughtUp.length
	return (
		<>
			<Background />
			<Head phone={phone} line={e ? undefined : "Everything else is in the menu, top right."} />
			{e?.next && (
				<div
					data-card={e.show.key}
					className={`absolute flex items-center ${FOCUS} ${phone ? "inset-x-5 top-[54px] h-[60px] gap-3 rounded-xl px-2 !ring-4" : "inset-x-12 top-[92px] h-[72px] gap-4 rounded-2xl px-3"}`}
				>
					<img src={img(e.show.poster, "w92")} alt="" className={`shrink-0 rounded object-cover ${phone ? "h-[46px] w-[31px]" : "h-[54px] w-[36px]"}`} />
					<span className="min-w-0 flex-1">
						{!phone && <Eyebrow>{props.variant === "mix" ? "Tonight's pick · Next episode" : "Next episode"}</Eyebrow>}
						<span className={`block truncate font-extrabold leading-tight ${phone ? "text-[19px]" : "text-[19px]"}`}>
							{e.show.title} <span className="font-semibold text-white/80">· {code(e.next)}</span>
							{!phone && <span className="font-normal text-white/60"> · {e.next.name}</span>}
						</span>
						{phone && <span className="block truncate text-[18px] leading-tight text-white/60">{lastLine(e)}</span>}
					</span>
					{!phone && <span className="shrink-0 text-[13px] text-white/55">{lastLine(e)}</span>}
					<WatchedButton
						entry={e}
						store={store}
						label={phone ? "none" : "short"}
						className={phone ? "!h-11 !w-11 !rounded-full [&>svg]:!h-6 [&>svg]:!w-6" : "!h-9 !rounded-full !text-[14px]"}
					/>
					<button
						type="button"
						onClick={() => go("wishlist", "watching")}
						data-all
						className={`shrink-0 cursor-pointer border-l border-white/10 font-bold text-white/75 hover:text-white ${phone ? "pl-3 pr-1 text-[18px]" : "pl-4 pr-2 text-[14px]"}`}
					>
						{phone ? `${tracked} ›` : `Watching ${tracked} ›`}
					</button>
				</div>
			)}
			<div
				className={`absolute grid grid-cols-2 ${phone ? `inset-x-5 bottom-4 gap-4 ${e ? "top-[126px]" : "top-[58px]"}` : `inset-x-12 gap-6 ${e ? "top-[184px]" : "top-[132px]"}`}`}
			>
				{[tiles.watchNext, tiles.somethingNew].map((t) => (
					<Tile key={t.id} {...t} line={phone ? t.short : t.line} phone={phone} className={phone ? "" : "h-[300px]"} />
				))}
			</div>
		</>
	)
}

export function HomeScreen(props: Props & { phone?: boolean }) {
	const Screen = props.variant === "section" ? SectionHome : props.variant === "merged" ? MergedHome : ViewHome
	return (
		<div className="absolute inset-0 text-white">
			<Screen {...props} />
			<Keys phone={props.phone} />
		</div>
	)
}
