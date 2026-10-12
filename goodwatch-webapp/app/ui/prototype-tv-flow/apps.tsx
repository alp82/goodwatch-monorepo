// PROTOTYPE - throwaway. Variant "apps": a console dashboard. Home is one row of large app tiles with a preview
// of the focused one; OK opens the app on the TV. Every app keeps the expand control in the same place, the top
// right corner. Focusing it frames the whole picture (this is what grows); OK goes.
import type { ReactNode } from "react"
import { BRIDGES, DEST, type Dest, ISLANDS, MOODS, NEXT_EPISODES, POPULAR, QUIZ_GOAL, SIDES, TO_START, WISHLIST_MOVIES, discover, islandOf, islandTitles, moodName, sideOf, titleOf } from "./data"
import { parseId, useTv } from "./engine"
import { Btn, Buttons, ExpandKey, F, Facts, IslandTile, Layer, Menu, Poster, Row, Shared, Still, posterBg, useTitleActions, washBg } from "./kit"

export function AppsTv() {
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
		case "tonight":
			return <Tonight at={Number(arg) || 0} />
		case "discover":
			return arg ? <Results mood={arg === "any" ? null : arg} /> : <Moods />
		case "explorer":
			return <MiniMap />
		case "island":
			return <Island island={arg} />
		case "taste":
			return <Taste />
		case "side":
			return <Side side={arg} />
		case "shows":
			return <Shows />
		case "title":
			return <TitleScreen titleKey={arg} />
		case "rate":
		case "quiz":
		case "search":
		case "about":
			return <Shared id={id} onQuizDone={tv.back} searchExit={(dest) => <ExpandKey dest={dest} framed />} />
		default:
			return <Home />
	}
}

function Home() {
	const tv = useTv()
	const apps = [
		{ key: "tonight", name: "Tonight", hue: 28, line: tv.member ? "One pick at a time, from your Wishlist." : "One pick at a time, best rated right now.", art: tv.member ? WISHLIST_MOVIES : POPULAR },
		{ key: "discover", name: "Discover", hue: 350, line: "Pick a mood, get four titles.", art: discover("funny", null, null) },
		{ key: "explorer", name: "Explorer", hue: 200, line: "Sail a small map of islands.", art: islandTitles("heists") },
		{ key: "taste", name: "Taste", hue: 265, line: tv.taste ? "Three sides of you." : `Rate ${QUIZ_GOAL} titles, get picks made for you.`, art: SIDES[1].titles },
		...(tv.member ? [{ key: "shows", name: "My shows", hue: 150, line: "Your next episodes.", art: NEXT_EPISODES.map((e) => e.title) }] : []),
	]
	const shown = apps.find((a) => `app-${a.key}` === tv.focus) ?? apps[0]
	return (
		<Layer className={tv.phone ? "px-7 pt-8" : "px-11 pt-9"}>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">GoodWatch</div>
			<div className="mt-1 text-[44px] font-extrabold leading-none">{tv.member ? "Welcome back." : "Good evening."}</div>
			<div className="-mx-4 mt-3 flex gap-4 overflow-hidden px-4 py-4" style={{ scrollPadding: 20 }}>
				{apps.map((a, n) => (
					<F key={a.key} id={`app-${a.key}`} first={n === 0} onOk={() => tv.push(a.key)} className={`flex items-end overflow-hidden p-4 ${tv.phone ? "w-[170px] shrink-0" : "flex-1"}`} style={{ height: 150, background: posterBg(a.hue) }}>
						<span className="text-[27px] font-extrabold leading-tight">{a.name}</span>
					</F>
				))}
			</div>
			<div className="mt-3 flex items-center justify-between gap-8">
				<div>
					<div className="text-[34px] font-extrabold leading-tight">{shown.name}</div>
					<div className="mt-1 text-[24px] leading-snug text-white/75">{shown.line}</div>
				</div>
				<div className="flex shrink-0 gap-3">
					{shown.art.slice(0, tv.phone ? 0 : 3).map((x) => (
						<Still key={x.key} title={x} w={132} h={150} />
					))}
				</div>
			</div>
		</Layer>
	)
}

/** An app on the TV: its name on the left, the expand control always in the top right corner. */
function App({ name, crumb, dest, hue, children }: { name: string; crumb?: string; dest: Dest; hue?: number; children: ReactNode }) {
	const tv = useTv()
	return (
		<Layer style={hue == null ? undefined : { background: washBg(hue) }}>
			<div className={`flex h-[80px] items-center justify-between gap-4 ${tv.phone ? "px-7" : "px-11"}`}>
				<div className="flex min-w-0 items-baseline gap-4">
					<span className="shrink-0 text-[32px] font-extrabold">{name}</span>
					{crumb && <span className="truncate text-[24px] text-white/65">{crumb}</span>}
				</div>
				<ExpandKey dest={dest} framed />
			</div>
			<div className={`absolute inset-x-0 bottom-0 top-[80px] overflow-hidden pb-6 pt-1 ${tv.phone ? "px-7" : "px-11"}`}>{children}</div>
		</Layer>
	)
}

function Tonight({ at }: { at: number }) {
	const tv = useTv()
	const picks = (tv.member ? WISHLIST_MOVIES : POPULAR).slice(0, 3)
	const x = picks[at % picks.length]
	return (
		<App name="Tonight" crumb={tv.member ? "From your Wishlist" : "Best rated right now"} dest={tv.member ? DEST.movies() : DEST.discover()} hue={x.hue}>
			<div className="flex h-full flex-col justify-end">
				<Facts title={x} kicker={`Pick ${(at % picks.length) + 1} of ${picks.length}`} />
				<Buttons className="mt-7">
					<Btn id="details" first onOk={() => tv.push(`title-${x.key}`)}>
						Details
					</Btn>
					<Btn id="another" onOk={() => tv.replace(`tonight-${(at + 1) % picks.length}`, true)}>
						Another one
					</Btn>
				</Buttons>
			</div>
		</App>
	)
}

function Moods() {
	const tv = useTv()
	const tiles = [...MOODS, { key: "any", name: "Any mood", line: "Surprise me.", hue: 180 }]
	return (
		<App name="Discover" dest={DEST.discover()}>
			<div className="mb-5 text-[30px] font-bold leading-none text-white/85">What kind of night?</div>
			<div className={`grid gap-4 ${tv.phone ? "grid-cols-2" : "grid-cols-3"}`}>
				{tiles.map((m, n) => (
					<F key={m.key} id={`mood-${m.key}`} first={n === 0} onOk={() => tv.push(`discover-${m.key}`)} className="flex flex-col justify-end p-5" style={{ height: tv.phone ? 132 : 150, background: washBg(m.hue) }}>
						<span className="text-[29px] font-extrabold leading-tight">{m.name}</span>
						<span className="text-[21px] leading-tight text-white/80">{m.line}</span>
					</F>
				))}
			</div>
		</App>
	)
}

function Results({ mood }: { mood: string | null }) {
	const tv = useTv()
	const hits = discover(mood, null, tv.store.service)
	return (
		<App name="Discover" crumb={[moodName(mood), tv.store.service && `only ${tv.store.service}`].filter(Boolean).join(", ")} dest={DEST.discover(mood)}>
			<Row>
				{hits.map((x, n) => (
					<Poster key={x.key} title={x} first={n === 0} w={200} h={250} />
				))}
				{!hits.length && <div className="flex h-[250px] items-center text-[26px] text-white/60">Nothing fits.</div>}
			</Row>
			<Buttons className="mt-2">
				<Btn id="change" first={!hits.length} onOk={tv.back}>
					Change mood
				</Btn>
			</Buttons>
		</App>
	)
}

/** The mini map: six islands on the sea, the focus sails between them in four directions. */
function MiniMap() {
	const tv = useTv()
	const open = (key: string) => () => tv.push(`island-${key}`)
	if (tv.phone)
		return (
			<App name="Explorer" dest={DEST.explorer()}>
				<div className="grid grid-cols-2 gap-4">
					{ISLANDS.map((i, n) => (
						<IslandTile key={i.key} island={i.key} first={n === 0} onOk={open(i.key)} w={245} h={150} />
					))}
				</div>
			</App>
		)
	const W = 200
	const H = 130
	return (
		<App name="Explorer" crumb="Six islands of titles that belong together" dest={DEST.explorer()}>
			<div className="relative h-[410px] rounded-[26px] bg-[#0c1f2c]">
				<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
					{BRIDGES.map(([a, b]) => {
						const p = islandOf(a).at
						const q = islandOf(b).at
						return <line key={a + b} x1={p.x + W / 2} y1={p.y + H / 2 + 30} x2={q.x + W / 2} y2={q.y + H / 2 + 30} stroke="rgba(255,255,255,.28)" strokeWidth="5" strokeDasharray="4 14" strokeLinecap="round" />
					})}
				</svg>
				{ISLANDS.map((i, n) => (
					<F key={i.key} id={`island-${i.key}`} first={n === 0} onOk={open(i.key)} className="absolute flex items-center justify-center text-center" style={{ left: i.at.x, top: i.at.y + 30, width: W, height: H, borderRadius: "50%", background: `radial-gradient(closest-side, hsl(${i.hue} 60% 50%), hsl(${i.hue} 55% 28%))` }}>
						<span className="text-[25px] font-extrabold leading-tight">{i.name}</span>
					</F>
				))}
			</div>
		</App>
	)
}

function Island({ island }: { island: string }) {
	const tv = useTv()
	const i = islandOf(island)
	return (
		<App name="Explorer" crumb={`Island: ${i.name}`} dest={DEST.explorer(i.key)}>
			<Row>
				{islandTitles(i.key).map((x, n) => (
					<Poster key={x.key} title={x} first={n === 0} w={200} h={250} />
				))}
			</Row>
			<Buttons className="mt-2">
				<span className="shrink-0 text-[24px] font-bold text-white/70">Sail to</span>
				{i.next.map((key) => (
					<Btn key={key} id={`hop-${key}`} onOk={() => tv.replace(`island-${key}`)}>
						{islandOf(key).name}
					</Btn>
				))}
			</Buttons>
		</App>
	)
}

function Taste() {
	const tv = useTv()
	if (!tv.taste)
		return (
			<App name="Taste" dest={DEST.taste()}>
				<div className="flex h-full flex-col justify-center">
					<div className="text-[46px] font-extrabold leading-[1.05]">Rate {QUIZ_GOAL} titles you've seen.</div>
					<div className="mb-8 mt-2 text-[25px] text-white/70">
						{tv.store.rated} of {QUIZ_GOAL} rated. Then GoodWatch knows your taste.
					</div>
					<Buttons>
						<Btn id="start-quiz" first onOk={() => tv.push("quiz")}>
							{tv.store.rated ? "Keep rating" : "Start rating"}
						</Btn>
					</Buttons>
				</div>
			</App>
		)
	return (
		<App name="Taste" crumb="Three sides of you" dest={DEST.taste()}>
			<Row>
				{SIDES.map((s, n) => (
					<F key={s.key} id={`side-${s.key}`} first={n === 0} onOk={() => tv.push(`side-${s.key}`)} className="flex shrink-0 flex-col justify-end overflow-hidden p-6" style={{ width: 280, height: 250, background: washBg(s.hue) }}>
						<span className="text-[30px] font-extrabold leading-tight">{s.name}</span>
						<span className="mt-1 text-[22px] leading-tight text-white/80">{s.line}</span>
					</F>
				))}
			</Row>
			<Buttons className="mt-2">
				<Btn id="start-quiz" onOk={() => tv.push("quiz")}>
					Rate more
				</Btn>
			</Buttons>
		</App>
	)
}

function Side({ side }: { side: string }) {
	const s = sideOf(side)
	return (
		<App name="Taste" crumb={`${s.name}: not seen yet, closest first`} dest={DEST.taste()}>
			<Row>
				{s.titles.map((x, n) => (
					<Poster key={x.key} title={x} first={n === 0} w={200} h={250} />
				))}
			</Row>
		</App>
	)
}

function Shows() {
	return (
		<App name="My shows" crumb="Your next episodes" dest={DEST.shows()}>
			<Row>
				{NEXT_EPISODES.map((e, n) => (
					<Poster key={e.title.key} id={`ep-${e.title.key}`} title={e.title} sub={`${e.code} · ${e.runtime}`} first={n === 0} w={278} h={250} />
				))}
			</Row>
			<Row label="Start next">
				{TO_START.map((x) => (
					<Poster key={x.key} id={`start-${x.key}`} title={x} sub={x.runtime} w={278} h={200} />
				))}
			</Row>
		</App>
	)
}

function TitleScreen({ titleKey }: { titleKey: string }) {
	const tv = useTv()
	const x = titleOf(titleKey)
	const actions = useTitleActions(x)
	return (
		<App name={x.kind === "movie" ? "Movie" : "Show"} dest={DEST.title(x)} hue={x.hue}>
			<div className={`flex h-full ${tv.phone ? "flex-col justify-end gap-6" : "items-center gap-10"}`}>
				<div className="min-w-0 flex-1">
					<Facts title={x} size={48} />
				</div>
				<div className={`flex shrink-0 flex-col gap-4 ${tv.phone ? "" : "w-[330px]"}`}>
					{actions.map((a, n) => (
						<Btn key={a.id} id={a.id} first={n === 0} onOk={a.onOk} className="w-full">
							{a.label}
						</Btn>
					))}
				</div>
			</div>
		</App>
	)
}
