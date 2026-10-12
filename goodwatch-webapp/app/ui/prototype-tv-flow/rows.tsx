// PROTOTYPE - throwaway. Variant "rows": the home of a streaming box. Tabs across the top (they switch as the
// focus lands on them), a hero, and rows of tiles that page down. Every mini feature is a tab; a title is a
// screen of its own. Leaving: the expand control is the last tile of each row, and one press goes.
import type { CSSProperties, ReactNode } from "react"
import { DEST, ISLANDS, MOODS, NEW_FOR_YOU, NEXT_EPISODES, POPULAR, QUIZ_GOAL, SIDES, TO_START, WISHLIST_MOVIES, discover, islandOf, islandTitles, moodName, sideOf, titleOf } from "./data"
import { parseId, useTv } from "./engine"
import { Btn, Buttons, ExpandKey, ExpandTile, F, Facts, IslandTile, Layer, Menu, Poster, Row, Shared, metaOf, useTitleActions, washBg } from "./kit"

const ROOTS = ["home", "discover", "explorer", "taste", "shows"]

export function RowsTv() {
	const tv = useTv()
	const overlay = tv.top === "menu"
	const id = overlay ? (tv.stack[tv.stack.length - 2] ?? "home") : tv.top
	return (
		<>
			<Screen id={id} />
			{overlay && <Menu />}
		</>
	)
}

function Screen({ id }: { id: string }) {
	const tv = useTv()
	const [kind, arg] = parseId(id)
	switch (kind) {
		case "discover":
			return (
				<Tabbed current="discover">
					<Discover mood={arg || null} />
				</Tabbed>
			)
		case "explorer":
			return (
				<Tabbed current="explorer">
					<Explorer />
				</Tabbed>
			)
		case "taste":
			return (
				<Tabbed current="taste">
					<Taste />
				</Tabbed>
			)
		case "shows":
			return (
				<Tabbed current="shows">
					<Shows />
				</Tabbed>
			)
		case "island":
			return <Island island={arg} />
		case "side":
			return <Side side={arg} />
		case "title":
			return <TitleScreen titleKey={arg} />
		case "rate":
		case "quiz":
		case "search":
		case "about":
			return <Shared id={id} onQuizDone={tv.back} searchExit={() => null} />
		default:
			return (
				<Tabbed current="home">
					<Home />
				</Tabbed>
			)
	}
}

/** A tab's screen: the tabs, and under them the content, which pages down as the focus moves. */
function Tabbed({ current, children }: { current: string; children: ReactNode }) {
	const tv = useTv()
	const tabs = [
		["home", "Home"],
		["discover", "Discover"],
		["explorer", "Explorer"],
		["taste", "Taste"],
		...(tv.member ? [["shows", "My shows"]] : []),
	]
	return (
		<Layer>
			<div data-tv-group data-tv-prefer={`tab-${current}`} className={`flex h-[76px] items-center gap-2 overflow-hidden ${tv.phone ? "px-5" : "px-9"}`} style={{ scrollPadding: 20 }}>
				{tabs.map(([id, name]) => (
					<F key={id} id={`tab-${id}`} onOk={() => tv.root(id)} onKeyFocus={() => tv.root(id)} className={`tvb shrink-0 rounded-full px-6 py-2 text-[25px] font-bold ${current === id ? "tv-current" : "tv-quiet"}`}>
						{name}
					</F>
				))}
				{tv.store.service && <span className="ml-auto shrink-0 text-[22px] font-bold text-white/70">Only {tv.store.service}</span>}
			</div>
			<div className={`absolute inset-x-0 bottom-0 top-[76px] overflow-hidden pb-6 pt-3 ${tv.phone ? "px-7" : "px-11"}`}>{children}</div>
		</Layer>
	)
}

function Home() {
	const tv = useTv()
	const episode = NEXT_EPISODES[0]
	const hero = tv.member ? episode.title : POPULAR[0]
	return (
		<>
			<F id="hero" first onOk={() => tv.push(`title-${hero.key}`)} className="mb-4 flex w-full flex-col justify-center overflow-hidden px-8" style={{ height: 160, background: washBg(hero.hue), "--grow": 1.012 } as CSSProperties}>
				<span className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/70">{tv.member ? `Next episode · ${episode.code} · ${episode.runtime}` : "Tonight's pick"}</span>
				<span className="mt-1 text-[46px] font-extrabold leading-none tracking-tight">{hero.title}</span>
				<span className="mt-2 text-[23px] text-white/80">{tv.member ? `“${episode.name}” · On ${hero.service}` : `${metaOf(hero)} · On ${hero.service}`}</span>
			</F>
			{tv.member && (
				<>
					<Row label="My shows · Continue">
						{NEXT_EPISODES.map((e) => (
							<Poster key={e.title.key} id={`ep-${e.title.key}`} title={e.title} sub={e.code} />
						))}
						<Poster id={`start-${TO_START[0].key}`} title={TO_START[0]} sub="Start" />
						<ExpandTile id="expand-shows" dest={DEST.shows()} />
					</Row>
					<Row label="My movies · Watch next">
						{WISHLIST_MOVIES.map((x) => (
							<Poster key={x.key} id={`wl-${x.key}`} title={x} />
						))}
						<ExpandTile id="expand-movies" dest={DEST.movies()} />
					</Row>
				</>
			)}
			<Row label={tv.member ? "Discover · New for you" : "Discover · Popular tonight"}>
				{(tv.member ? NEW_FOR_YOU : POPULAR).map((x) => (
					<Poster key={x.key} title={x} />
				))}
				<ExpandTile id="expand-discover" dest={DEST.discover()} />
			</Row>
			<Row label="Explorer · Islands">
				{ISLANDS.slice(0, 4).map((i) => (
					<IslandTile key={i.key} island={i.key} onOk={() => tv.push(`island-${i.key}`)} />
				))}
				<ExpandTile id="expand-explorer" dest={DEST.explorer()} />
			</Row>
			{!tv.taste && (
				<Row label="Taste">
					<F id="start-quiz" onOk={() => tv.push("quiz")} className="tvb flex h-[120px] w-full flex-col justify-center px-8" style={{ "--grow": 1.012 } as CSSProperties}>
						<span className="text-[30px] font-extrabold leading-tight">Rate {QUIZ_GOAL} titles you've seen</span>
						<span className="text-[22px] opacity-75">Then every pick here is made for you.</span>
					</F>
				</Row>
			)}
		</>
	)
}

function Discover({ mood }: { mood: string | null }) {
	const tv = useTv()
	const hits = discover(mood, null, tv.store.service)
	const chips = [{ key: "", name: "Any mood" }, ...MOODS.slice(0, 4)]
	return (
		<>
			<div className="mb-3 text-[32px] font-extrabold leading-none">What kind of night?</div>
			<div className="-mx-4 mb-4 flex gap-3 overflow-hidden px-4 py-3" style={{ scrollPadding: 20 }}>
				{chips.map((m) => (
					<F key={m.key} id={`mood-${m.key || "any"}`} first={(m.key || null) === mood} onOk={() => tv.replace(m.key ? `discover-${m.key}` : "discover", true)} className={`tvb flex h-[62px] shrink-0 items-center rounded-full px-7 text-[25px] font-bold ${(m.key || null) === mood ? "tv-current" : ""}`}>
						{(m.key || null) === mood ? `✓ ${m.name}` : m.name}
					</F>
				))}
			</div>
			<Row label={`${moodName(mood)} · best match first`}>
				{hits.map((x) => (
					<Poster key={x.key} title={x} />
				))}
				{!hits.length && <div className="flex h-[200px] items-center text-[26px] text-white/60">Nothing on {tv.store.service}.</div>}
				<ExpandTile id="expand" dest={DEST.discover(mood)} />
			</Row>
		</>
	)
}

function Explorer() {
	const tv = useTv()
	return (
		<>
			<div className="mb-1 text-[32px] font-extrabold leading-none">Step onto an island.</div>
			<div className="mb-3 text-[23px] text-white/70">Titles that belong together live on one.</div>
			<Row>
				{ISLANDS.slice(0, 4).map((i, n) => (
					<IslandTile key={i.key} island={i.key} first={n === 0} onOk={() => tv.push(`island-${i.key}`)} />
				))}
				<ExpandTile id="expand" dest={DEST.explorer()} />
			</Row>
			<Row label="Further out">
				{ISLANDS.slice(4).map((i) => (
					<IslandTile key={i.key} island={i.key} onOk={() => tv.push(`island-${i.key}`)} />
				))}
			</Row>
		</>
	)
}

function Island({ island }: { island: string }) {
	const tv = useTv()
	const i = islandOf(island)
	return (
		<Layer className={tv.phone ? "px-7 pt-8" : "px-11 pt-9"}>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">Explorer · Island</div>
			<div className="mb-3 mt-1 text-[44px] font-extrabold leading-none">{i.name}</div>
			<Row>
				{islandTitles(i.key).map((x, n) => (
					<Poster key={x.key} title={x} first={n === 0} />
				))}
				<ExpandTile id="expand" dest={DEST.explorer(i.key)} />
			</Row>
			<div className="mb-2 mt-1 text-[22px] font-bold text-white/70">Next door</div>
			<Buttons>
				{i.next.map((key) => (
					<Btn key={key} id={`hop-${key}`} onOk={() => tv.replace(`island-${key}`)}>
						{islandOf(key).name}
					</Btn>
				))}
			</Buttons>
		</Layer>
	)
}

function Taste() {
	const tv = useTv()
	if (!tv.taste)
		return (
			<>
				<div className="mt-6 text-[44px] font-extrabold leading-[1.05]">Rate {QUIZ_GOAL} titles you've seen.</div>
				<div className="mb-8 mt-2 text-[25px] text-white/70">
					{tv.store.rated} of {QUIZ_GOAL} rated. Then GoodWatch knows your taste.
				</div>
				<Buttons>
					<Btn id="start-quiz" first onOk={() => tv.push("quiz")}>
						{tv.store.rated ? "Keep rating" : "Start rating"}
					</Btn>
					<ExpandKey dest={DEST.taste()} />
				</Buttons>
			</>
		)
	return (
		<>
			<div className="mb-1 text-[32px] font-extrabold leading-none">Three sides of you</div>
			<div className="mb-3 text-[23px] text-white/70">What your ratings say you enjoy.</div>
			<Row>
				{SIDES.map((s, n) => (
					<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => tv.push(`side-${s.key}`)} className="flex shrink-0 flex-col justify-end overflow-hidden p-5" style={{ width: 220, height: 200, background: washBg(s.hue) }}>
						<span className="text-[27px] font-extrabold leading-tight">{s.name}</span>
						<span className="mt-1 text-[21px] leading-tight text-white/80">{s.line}</span>
					</F>
				))}
				<ExpandTile id="expand" dest={DEST.taste()} />
			</Row>
			<Buttons className="mt-2">
				<Btn id="start-quiz" onOk={() => tv.push("quiz")}>
					Rate more
				</Btn>
			</Buttons>
		</>
	)
}

function Side({ side }: { side: string }) {
	const tv = useTv()
	const s = sideOf(side)
	return (
		<Layer className={tv.phone ? "px-7 pt-8" : "px-11 pt-9"}>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">Taste · A side of you</div>
			<div className="mt-1 text-[44px] font-extrabold leading-none">{s.name}</div>
			<div className="mb-4 mt-2 text-[24px] text-white/70">{s.line} Not seen yet, closest first.</div>
			<Row>
				{s.titles.map((x, n) => (
					<Poster key={x.key} title={x} first={n === 0} />
				))}
				<ExpandTile id="expand" dest={DEST.taste()} />
			</Row>
		</Layer>
	)
}

function Shows() {
	return (
		<>
			<Row label="Continue">
				{NEXT_EPISODES.map((e, n) => (
					<Poster key={e.title.key} id={`ep-${e.title.key}`} title={e.title} sub={`${e.code} · ${e.runtime}`} first={n === 0} w={212} />
				))}
				<ExpandTile id="expand" dest={DEST.shows()} />
			</Row>
			<Row label="Start next">
				{TO_START.map((x) => (
					<Poster key={x.key} id={`start-${x.key}`} title={x} sub={x.runtime} w={212} />
				))}
			</Row>
		</>
	)
}

function TitleScreen({ titleKey }: { titleKey: string }) {
	const tv = useTv()
	const x = titleOf(titleKey)
	const actions = useTitleActions(x)
	return (
		<Layer className={`flex flex-col justify-end ${tv.phone ? "px-7 pb-7" : "px-12 pb-10"}`} style={{ background: washBg(x.hue) }}>
			<Facts title={x} />
			<Buttons className="mt-8">
				{actions.map((a, n) => (
					<Btn key={a.id} id={a.id} first={n === 0} onOk={a.onOk}>
						{a.label}
					</Btn>
				))}
				<ExpandKey dest={DEST.title(x)} />
			</Buttons>
		</Layer>
	)
}
