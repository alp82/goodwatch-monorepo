// PROTOTYPE - throwaway. Round 5 variant 13: what the right side of the panel shows for each sub-tab. Each one is
// shaped for its job: the lanes for Search, a tag mixer with a recipe line for Mood, About and Style, logo tiles for
// Services, a big switch plus two pickers for Seen, a threshold bar and sliders for Scores and Critics, a year range
// for Released, and the real filter card for the rest.
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { Chip, byCount } from "~/ui/filter-bar/SheetControls"
import { GROUP_LABEL, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId } from "../kit"
import { SearchLanes } from "./R5-13-lanes"
import {
	ClearLink,
	CountryLine,
	GenreControl,
	MOOD_TAGS,
	NotSeenControl,
	OneCard,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	TypeControl,
	chipsOf,
	groupNote,
	tagOption,
} from "./R5-13-parts"

export interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	input?: ReactNode
}

const clearCards = (d: ProtoDiscover, pieces: Pieces, ks: CardKey[]) =>
	d.filters.update((s) => ks.flatMap((k) => chipsOf(pieces, k)).reduce((acc, c) => c.remove(acc), s))

/** One filter with its name, a short hint and Clear. */
function Section({
	d,
	pieces,
	k,
	title,
	hint,
	children,
}: { d: ProtoDiscover; pieces: Pieces; k: CardKey; title: string; hint: string; children: ReactNode }) {
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{title}</h4>
					<p className="truncate text-[12px] text-gray-500">{hint}</p>
				</div>
				{set && <ClearLink onClick={() => clearCards(d, pieces, [k])} />}
			</header>
			{children}
		</section>
	)
}

function Card({ d, pieces, k, title, hint }: { d: ProtoDiscover; pieces: Pieces; k: CardKey; title: string; hint: string }) {
	return (
		<Section d={d} pieces={pieces} k={k} title={title} hint={hint}>
			<OneCard key={k} pieces={pieces} k={k} />
		</Section>
	)
}

/** Two filters side by side (stacked on phones). */
function Pair({ phone, children }: { phone: boolean; children: [ReactNode, ReactNode] }) {
	return (
		<div className={phone ? "flex flex-col gap-8" : "grid grid-cols-2 gap-x-8"}>
			<div>{children[0]}</div>
			<div className={phone ? "" : "-ml-4 border-l border-white/[0.06] pl-4"}>{children[1]}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Mood: the mixer. The recipe line sits on top of Mood, About and Style, one slot per group.

const MIX: { group: TagGroup; sub: string }[] = [
	{ group: "moods", sub: "mood" },
	{ group: "themes", sub: "about" },
	{ group: "styles", sub: "style" },
]

function Recipe({ d, sub, onSub, phone }: { d: ProtoDiscover; sub: string; onSub: (s: string) => void; phone: boolean }) {
	const any = d.picked.length > 0
	return (
		<div
			className={`flex h-12 shrink-0 items-center gap-2 ${phone ? "-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`}
		>
			{MIX.map(({ group, sub: id }, i) => {
				const picks = d.picked.filter((t) => t.group === group)
				const on = sub === id
				return (
					<div key={group} className="flex shrink-0 items-center gap-2">
						{i > 0 && <span className="text-gray-600" aria-hidden>+</span>}
						<button
							type="button"
							onClick={() => onSub(id)}
							aria-current={on || undefined}
							className={`flex h-9 max-w-[260px] items-center gap-2 rounded-full px-3 text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
								on ? "bg-white/[0.1] ring-1 ring-white/25" : "bg-white/[0.04] ring-1 ring-white/[0.07] hover:bg-white/[0.07]"
							}`}
						>
							<span className="text-[11px] font-bold tracking-[0.06em] text-gray-400 uppercase">{GROUP_LABEL[group]}</span>
							{picks.length ? (
								<span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-white">
									{picks.map((t) => (
										<span key={tagId(t)} className="flex items-center gap-1">
											<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
											{t.name}
										</span>
									))}
								</span>
							) : (
								<span className="text-gray-500">Any</span>
							)}
						</button>
					</div>
				)
			})}
			<span className="shrink-0 pl-1 text-[13px] whitespace-nowrap text-gray-400">
				={" "}
				{d.total == null ? "…" : <RollingNumber value={d.total} className="font-bold text-white" />}{" "}
				{d.q ? "matches" : "titles"}
			</span>
			{any && (
				<span className="ml-auto shrink-0">
					<ClearLink onClick={d.clearTags} />
				</span>
			)}
		</div>
	)
}

function MoodTile({ d, t }: { d: ProtoDiscover; t: Tag }) {
	const on = d.isOn(t)
	const n = d.countFor(t)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={() => d.toggle(t)}
			className={`flex h-[60px] min-w-0 items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
			}`}
			style={on ? { background: `${t.color}2e`, boxShadow: `inset 0 0 0 1.5px ${t.color}` } : undefined}
		>
			<span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline gap-2">
					<span className={`truncate text-[14px] font-semibold ${on ? "text-white" : "text-gray-100"}`}>{t.name}</span>
					{n != null && !on && <span className="text-[11px] text-gray-500 tabular-nums">{n.toLocaleString()}</span>}
				</span>
				{t.description && <span className="block truncate text-[12px] text-gray-500">{t.description}</span>}
			</span>
		</motion.button>
	)
}

function MixHead({ d, group }: { d: ProtoDiscover; group: TagGroup }) {
	return <p className="mb-3 text-[12px] text-gray-500">{groupNote(d, group)}</p>
}

function MoodGrid({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div>
			<MixHead d={d} group="moods" />
			<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-3 xl:grid-cols-4"}`}>
				{MOOD_TAGS.map((t) => (
					<MoodTile key={tagId(t)} d={d} t={t} />
				))}
			</div>
		</div>
	)
}

function TagCloud({ d, group }: { d: ProtoDiscover; group: "themes" | "styles" }) {
	const options = byCount(TAGS.filter((t) => t.group === group).map((t) => tagOption(d, t)))
	return (
		<div>
			<MixHead d={d} group={group} />
			<div className="flex flex-wrap gap-2 [&>button]:h-9 [&>button]:px-3.5 [&>button]:text-[14px]">
				{options.map((o) => (
					<Chip key={o.id} o={o} />
				))}
			</div>
		</div>
	)
}

function Mixer({ d, sub, onSub, phone }: { d: ProtoDiscover; sub: string; onSub: (s: string) => void; phone: boolean }) {
	return (
		<div className="flex flex-col gap-4">
			<Recipe d={d} sub={sub} onSub={onSub} phone={phone} />
			{sub === "mood" ? <MoodGrid d={d} phone={phone} /> : <TagCloud d={d} group={sub === "about" ? "themes" : "styles"} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function NotSeenTile({ pieces }: { pieces: Pieces }) {
	return (
		<div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
			<NotSeenControl pieces={pieces} />
		</div>
	)
}

/** The right side for one sub-tab. Search's first sub-tab fills the whole height with its own lanes. */
export function SubContent({
	seg,
	sub,
	d,
	pieces,
	phone,
	search,
	onSub,
}: {
	seg: SegKey
	sub: string
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
	onSub: (s: string) => void
}) {
	const id = `${seg}:${sub}`
	switch (id) {
		case "search:anything":
			return <SearchLanes d={d} phone={phone} {...search} />
		case "search:people":
			return (
				<div className="max-w-2xl">
					<Card d={d} pieces={pieces} k="people" title="Cast and crew" hint="Actors, directors, writers" />
				</div>
			)
		case "mood:mood":
		case "mood:about":
		case "mood:style":
			return <Mixer d={d} sub={sub} onSub={onSub} phone={phone} />
		case "mood:genre":
			return (
				<div className="flex flex-col gap-6">
					<TypeControl d={d} />
					<GenreControl d={d} limit={phone ? 12 : 30} />
				</div>
			)
		case "mood:length":
			return (
				<div className="max-w-2xl">
					<Card d={d} pieces={pieces} k="runtime" title="Length" hint="Movie length, episode length" />
				</div>
			)
		case "streaming:services":
			return (
				<div>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="w-full max-w-md">
							<StreamingModes d={d} pieces={pieces} />
						</div>
						<CountryLine d={d} pieces={pieces} />
					</div>
					<div className="mt-5">
						<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 18} />
					</div>
				</div>
			)
		case "streaming:age":
			return (
				<div className="max-w-2xl">
					<Card d={d} pieces={pieces} k="ageLimit" title="Age and content" hint="Age rating, violence, language" />
				</div>
			)
		case "streaming:country":
			return (
				<div className="max-w-2xl">
					<Card d={d} pieces={pieces} k="productionCountries" title="Made in" hint="Where it was produced" />
				</div>
			)
		case "watched:seen":
			return (
				<div className="flex flex-col gap-6">
					<div className={phone ? "" : "max-w-md"}>
						<NotSeenTile pieces={pieces} />
					</div>
					<Pair phone={phone}>
						<Card d={d} pieces={pieces} k="loved" title="Loved" hint="Steer toward these" />
						<Card d={d} pieces={pieces} k="disliked" title="Disliked" hint="Steer away from these" />
					</Pair>
				</div>
			)
		case "watched:scores":
			return (
				<Pair phone={phone}>
					<ScoreControl d={d} />
					<Card d={d} pieces={pieces} k="minMatch" title="Taste match" hint="How well it fits your taste" />
				</Pair>
			)
		case "watched:critics":
			return (
				<Pair phone={phone}>
					<Card d={d} pieces={pieces} k="sourceScores" title="Scores by source" hint="IMDb, Rotten Tomatoes, Metacritic" />
					<Card d={d} pieces={pieces} k="scoreGap" title="Critics vs audiences" hint="Where they disagree" />
				</Pair>
			)
		case "watched:released":
			return (
				<div className="max-w-2xl">
					<ReleasedControl d={d} />
				</div>
			)
		default:
			return null
	}
}
