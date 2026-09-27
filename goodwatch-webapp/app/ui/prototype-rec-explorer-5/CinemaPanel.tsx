// PROTOTYPE - throwaway. The controls of the round-5 close-up (#180). The close-up itself is the map (engine5.ts);
// this panel only holds what words and buttons do better: the title, why it fits, Want to See and Seen it, previous
// and next on this island, and a step toward each neighboring island showing the exact title it lands on.
//   side     a panel on the right, the map on the left;
//   marquee  the title set huge over the backdrop, the controls along the bottom;
//   sheet    phones: a bottom sheet under the map.
import {
	ArrowTopRightOnSquareIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { Score } from "~/server/scores.server"
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import { asPool } from "~/ui/prototype-rec-explorer-3/kit3"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { PeekInfo4 } from "~/ui/prototype-rec-explorer-4/wire4"
import { ActionButton } from "~/ui/prototype-rec-explorer/kit"
import { Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import { getVibeColorValue } from "~/utils/ratings"
import { IdentBadge } from "./chrome5"
import type { Config } from "./config"
import type { Look } from "./emblems"
import { TMDB } from "./engine5"
import type { W } from "./wire5"

export type DoorView = {
	dir: "n" | "e" | "s" | "w"
	look: Look
	item: W | null
}
const ARROW = { n: "↑", e: "→", s: "↓", w: "←" }

export function CinemaPanel({
	ex,
	cfg,
	layout,
	it,
	look,
	at,
	total,
	onPrev,
	onNext,
	prevT,
	nextT,
	doors,
	info,
	onDoor,
}: {
	ex: Ex4
	cfg: Config
	layout: "side" | "marquee" | "sheet"
	it: W
	look: Look
	at: number
	total: number
	onPrev: (() => void) | null
	onNext: (() => void) | null
	prevT: string
	nextT: string
	doors: DoorView[] | null
	info: PeekInfo4 | null
	onDoor: (d: DoorView) => void
}) {
	const pi = asPool(it)
	const meta = (
		<p className="rx5-meta">
			{it.yr ? `${it.yr} ` : ""}
			{pi.type === "show" ? "series" : "film"}
			{it.g.length ? `, ${it.g.join(", ").toLowerCase()}` : ""}
			{info?.people.length ? `. ${info.role} ${info.people.join(" and ")}` : ""}
		</p>
	)
	const match = (
		<div className="mt-3 flex items-center gap-3">
			<Ring item={pi} size={46} />
			{it.r ? (
				<span
					className="text-lg font-bold"
					style={{ color: getVibeColorValue(it.r as Score) }}
				>
					You rated it {it.r}
				</span>
			) : (
				<span
					className="rx4-display rx5-match"
					style={{ color: HEAT[it.m] ?? "#fbbf24" }}
				>
					{it.m}%<span className="rx5-match-l">your taste</span>
				</span>
			)}
			<div className="ml-auto">
				<ServiceLogos item={pi} services={ex.services} size="w-7 h-7" />
			</div>
		</div>
	)
	const acts = (
		<div className="rx5-acts">
			<ActionButton
				kind="want"
				active={!!(it.f & 4)}
				onClick={() => ex.actions.want(it)}
			/>
			<ActionButton
				kind="seen"
				active={!!(it.f & 2)}
				onClick={() => ex.actions.seen(it)}
			/>
		</div>
	)
	const nav = (
		<div className="rx5-nav-row">
			<span className="rx5-nav-where">
				<IdentBadge
					ident={look.ident}
					color={look.color}
					icons={cfg.icons}
					size={20}
				/>
				<span className="truncate">{look.name}</span>
				<span className="rx5-nav-n">
					{at} of {total}
				</span>
			</span>
			<button
				type="button"
				className="rx5-nav"
				disabled={!onPrev}
				onClick={() => onPrev?.()}
				aria-label={onPrev ? `Previous on ${look.name}: ${prevT}` : "Previous"}
			>
				<ChevronLeftIcon className="rx4-i-s" />
			</button>
			<button
				type="button"
				className="rx5-nav"
				disabled={!onNext}
				onClick={() => onNext?.()}
				aria-label={onNext ? `Next on ${look.name}: ${nextT}` : "Next"}
			>
				<ChevronRightIcon className="rx4-i-s" />
			</button>
		</div>
	)
	const doorBtn = (d: DoorView) =>
		d.item && (
			<button
				key={d.dir}
				type="button"
				className="rx5-door"
				onClick={() => onDoor(d)}
				aria-label={`Step toward ${d.look.name}: ${d.item.t}`}
				title={`${d.look.name}: ${d.item.t}`}
			>
				<span className="rx5-door-dir" aria-hidden>
					{ARROW[d.dir]}
				</span>
				{d.item.p && (
					<img src={`${TMDB}/w92${d.item.p}`} alt="" className="rx5-door-img" />
				)}
				<span className="min-w-0 flex-1">
					<span className="rx5-door-to" style={{ color: d.look.color }}>
						<IdentBadge
							ident={d.look.ident}
							color={d.look.color}
							icons={cfg.icons}
							size={18}
						/>
						<span>{d.look.name}</span>
					</span>
					<span className="rx5-door-t">{d.item.t}</span>
				</span>
			</button>
		)
	const doorList = (
		<div className="rx5-doors">
			{layout !== "marquee" && (
				<p className="rx5-doors-h">Step toward a neighboring island</p>
			)}
			{doors === null ? (
				<p className="text-sm text-stone-500">Finding the way…</p>
			) : (
				doors.map(doorBtn)
			)}
		</div>
	)
	const details = (
		<Link
			to={href(pi)}
			className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-300 hover:text-white"
		>
			Details
			<ArrowTopRightOnSquareIcon className="rx4-i-s" />
		</Link>
	)

	if (layout === "marquee")
		return (
			<section className="rx5-panel rx5-marq" aria-label={`${it.t}, close-up`}>
				<h2 key={it.k} className="rx4-display rx5-marq-title">
					{it.t}
				</h2>
				<div className="rx5-marq-row">
					<div className="max-w-full flex-none" style={{ width: "27rem" }}>
						{meta}
						<p className="rx5-why">{info?.why ?? " "}</p>
						{match}
						{acts}
						{nav}
					</div>
					<div className="rx5-marq-doors">{doors?.map(doorBtn)}</div>
				</div>
			</section>
		)
	return (
		<section
			className={`rx5-panel ${layout === "side" ? "rx5-side" : "rx5-sheet"}`}
			aria-label={`${it.t}, close-up`}
		>
			<h2 key={it.k} className="rx4-display rx5-title">
				{it.t}
			</h2>
			{meta}
			{match}
			<p className="rx5-why">{info?.why ?? " "}</p>
			{acts}
			{nav}
			{doorList}
			{details}
		</section>
	)
}
