// PROTOTYPE - throwaway. Variant "guided": a single path, the way a TV walks you through its setup. One question
// per screen with three or four big answers; the path ends on one title at a time. Leaving: the expand control is
// the last control of a path's last screen. OK starts a slow run (the brackets creep out to the edge of the
// picture) that Back cancels; a second OK skips the wait.
import type { CSSProperties, ReactNode } from "react"
import { DEST, type Dest, ISLANDS, type Kind, MOODS, NEXT_EPISODES, QUIZ_GOAL, SIDES, type Title, discover, islandOf, islandTitles, moodName, titleOf } from "./data"
import { parseId, useTv } from "./engine"
import { Btn, Buttons, ExpandKey, F, Facts, Layer, Menu, Question, Shared, useTitleActions, washBg } from "./kit"

export function GuidedTv() {
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
		case "mood":
			return (
				<Question
					kicker="Tonight · Step 1 of 3"
					question="What kind of night?"
					answers={[...MOODS.slice(0, 3).map((m) => ({ id: `mood-${m.key}`, label: m.name, onOk: () => tv.push(`kind-${m.key}`) })), { id: "mood-any", label: "Surprise me", onOk: () => tv.push("kind-any") }]}
					footer={<Steps at={1} of={3} />}
				/>
			)
		case "kind":
			return (
				<Question
					kicker={`Tonight · Step 2 of 3 · ${moodName(arg === "any" ? null : arg)}`}
					question="A movie or a show?"
					answers={[
						{ id: "kind-movie", label: "Movie", onOk: () => tv.push(`pick-${arg}-movie-0`) },
						{ id: "kind-show", label: "Show", onOk: () => tv.push(`pick-${arg}-show-0`) },
						{ id: "kind-any", label: "Either", onOk: () => tv.push(`pick-${arg}-any-0`) },
					]}
					footer={<Steps at={2} of={3} />}
				/>
			)
		case "pick":
			return <Pick arg={arg} />
		case "start":
			return (
				<Question
					kicker="The map · Step 1 of 2"
					question="Where do we start?"
					line="Each island holds titles that belong together."
					answers={ISLANDS.slice(0, 4).map((i) => ({ id: `island-${i.key}`, label: i.name, onOk: () => tv.push(`island-${i.key}-0`) }))}
					footer={<Steps at={1} of={2} />}
				/>
			)
		case "island":
			return <IslandStop arg={arg} />
		case "next":
			return <NextEpisode at={Number(arg) || 0} />
		case "taste":
			return <Taste />
		case "title":
			return <TitleScreen titleKey={arg} />
		case "rate":
		case "quiz":
		case "search":
		case "about":
			return <Shared id={id} onQuizDone={() => tv.replace("taste")} searchExit={(dest) => <ExpandKey dest={dest} slow />} />
		default:
			return <Home />
	}
}

function Steps({ at, of }: { at: number; of: number }) {
	return (
		<div className="absolute right-12 top-10 flex gap-2" aria-hidden="true">
			{Array.from({ length: of }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: the steps never reorder
				<span key={i} className={`h-[10px] w-[64px] rounded-full ${i < at ? "bg-white" : "bg-white/25"}`} />
			))}
		</div>
	)
}

function Home() {
	const tv = useTv()
	const episode = NEXT_EPISODES[0]
	const answers = [
		...(tv.member ? [{ id: "go-next", name: `Continue ${episode.title.title}`, line: `${episode.code} · ${episode.runtime}`, hue: episode.title.hue, to: "next-0" }] : []),
		{ id: "go-tonight", name: "Find something for tonight", line: "Three questions, three picks.", hue: 28, to: "mood" },
		{ id: "go-map", name: "Wander the map", line: "Step from island to island.", hue: 200, to: "start" },
		{ id: "go-taste", name: tv.taste ? "See my taste" : "Teach it my taste", line: tv.taste ? "Three sides of you." : `Rate ${QUIZ_GOAL} titles you've seen.`, hue: 265, to: tv.taste ? "taste" : "quiz" },
	]
	return (
		<Layer className={`flex flex-col justify-center ${tv.phone ? "px-7" : "px-12"}`}>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">GoodWatch</div>
			<div className="mt-1 font-extrabold leading-[1.05] tracking-tight" style={{ fontSize: tv.phone ? 36 : 46 }}>
				What would you like to do?
			</div>
			<div className={`mt-8 ${tv.phone ? "flex flex-col gap-3" : "grid gap-4"}`} style={tv.phone ? undefined : { gridTemplateColumns: `repeat(${answers.length}, minmax(0, 1fr))` }}>
				{answers.map((a, n) => (
					<F key={a.id} id={a.id} first={n === 0} onOk={() => tv.push(a.to)} className="flex flex-col justify-end overflow-hidden p-5" style={{ height: tv.phone ? 104 : 250, background: washBg(a.hue), "--grow": 1.03 } as CSSProperties}>
						<span className="text-[28px] font-extrabold leading-[1.1]">{a.name}</span>
						<span className="mt-2 text-[21px] leading-tight text-white/80">{a.line}</span>
					</F>
				))}
			</div>
		</Layer>
	)
}

/** The end of a path: one title, a few actions, and the expand control as the last one. */
function Stop({ title, kicker, dest, children }: { title: Title; kicker: string; dest: Dest; children: ReactNode }) {
	const tv = useTv()
	return (
		<Layer className={`flex flex-col justify-end ${tv.phone ? "px-7 pb-7" : "px-12 pb-10"}`} style={{ background: washBg(title.hue) }}>
			<Facts title={title} kicker={kicker} />
			<Buttons className="mt-8">
				{children}
				<span className={tv.phone ? "" : "ml-auto"}>
					<ExpandKey dest={dest} slow />
				</span>
			</Buttons>
		</Layer>
	)
}

function Pick({ arg }: { arg: string }) {
	const tv = useTv()
	const [m, k, n] = arg.split("-")
	const mood = m === "any" ? null : m
	const kind = k === "movie" || k === "show" ? (k as Kind) : null
	const picks = discover(mood, kind, tv.store.service).slice(0, 3)
	if (!picks.length) return <Question kicker="Tonight" question="Nothing fits." line="Try another kind of night." answers={[{ id: "again", label: "Start over", onOk: tv.home }]} />
	const at = (Number(n) || 0) % picks.length
	const x = picks[at]
	return (
		<Stop title={x} kicker={`Tonight · Pick ${at + 1} of ${picks.length} · ${moodName(mood)}`} dest={DEST.discover(mood, kind)}>
			<Btn id="more" first onOk={() => tv.push(`title-${x.key}`)}>
				Tell me more
			</Btn>
			<Btn id="another" onOk={() => tv.replace(`pick-${m}-${k}-${(at + 1) % picks.length}`, true)}>
				Next pick
			</Btn>
		</Stop>
	)
}

function IslandStop({ arg }: { arg: string }) {
	const tv = useTv()
	const parts = arg.split("-")
	const n = Number(parts.pop()) || 0
	const i = islandOf(parts.join("-"))
	const all = islandTitles(i.key)
	const at = n % all.length
	const x = all[at]
	return (
		<Stop title={x} kicker={`The map · ${i.name} · ${at + 1} of ${all.length}`} dest={DEST.explorer(i.key)}>
			<Btn id="more" first onOk={() => tv.push(`title-${x.key}`)}>
				Tell me more
			</Btn>
			<Btn id="another" onOk={() => tv.replace(`island-${i.key}-${(at + 1) % all.length}`, true)}>
				Next title
			</Btn>
			<Btn id="hop" onOk={() => tv.replace(`island-${i.next[0]}-0`, true)}>
				Sail to {islandOf(i.next[0]).name}
			</Btn>
		</Stop>
	)
}

function NextEpisode({ at }: { at: number }) {
	const tv = useTv()
	const e = NEXT_EPISODES[at % NEXT_EPISODES.length]
	const seen = tv.store.seen[e.title.key]
	return (
		<Stop title={e.title} kicker={`Next episode · ${e.code} · “${e.name}” · ${e.runtime}`} dest={DEST.shows()}>
			<Btn id="seen" first onOk={() => tv.rate(e.title.key, `${e.code} seen`)}>
				{seen ? `${e.code} seen ✓` : `Seen ${e.code}`}
			</Btn>
			<Btn id="another" onOk={() => tv.replace(`next-${(at + 1) % NEXT_EPISODES.length}`, true)}>
				Another show
			</Btn>
		</Stop>
	)
}

function Taste() {
	const tv = useTv()
	return (
		<Layer className={`flex flex-col justify-center ${tv.phone ? "px-7" : "px-12"}`}>
			<div className="text-[21px] font-bold uppercase tracking-[0.14em] text-white/65">Your taste so far</div>
			<div className="mt-2 font-extrabold leading-[1.08] tracking-tight" style={{ fontSize: tv.phone ? 36 : 46 }}>
				{SIDES.map((s) => s.name).join(", ")}.
			</div>
			<div className="mt-3 text-[24px] text-white/70">Three sides of you, from what you rated.</div>
			<Buttons className="mt-9">
				<Btn id="picks" first onOk={() => tv.push("pick-any-any-0")}>
					Show my picks
				</Btn>
				<Btn id="start-quiz" onOk={() => tv.push("quiz")}>
					Rate more
				</Btn>
				<span className={tv.phone ? "" : "ml-auto"}>
					<ExpandKey dest={DEST.taste()} slow />
				</span>
			</Buttons>
		</Layer>
	)
}

function TitleScreen({ titleKey }: { titleKey: string }) {
	const x = titleOf(titleKey)
	const actions = useTitleActions(x)
	return (
		<Stop title={x} kicker={`${x.kind === "movie" ? "Movie" : "Show"} · ${x.year} · ${x.runtime}`} dest={DEST.title(x)}>
			{actions.map((a, n) => (
				<Btn key={a.id} id={a.id} first={n === 0} onOk={a.onOk}>
					{a.label}
				</Btn>
			))}
		</Stop>
	)
}
