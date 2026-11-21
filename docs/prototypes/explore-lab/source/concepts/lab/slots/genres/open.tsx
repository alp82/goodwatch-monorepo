// PROTOTYPE - throwaway (prototype/explore-r6; fans since r7). One genre opened up: what it is, and the kinds inside
// it. Posters come as fans, each one link to its genre or kind.
import { Link } from "@remix-run/react"
import { type Kind, ing, kindNoun, place } from "../../../../kit/address"
import { count } from "../../../../kit/count"
import { FOCUS } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import type { PageViewProps } from "../../contract"
import type { AtlasGenre, AtlasKind } from "./atlas.server"
import { PosterFan } from "./fan"
import { GenreName, Words } from "./pieces"
import { low, onlyOf } from "./shared"

type To = PageViewProps["to"]

export const genreTo = (to: To, kind: Kind, g: AtlasGenre) =>
	to(place(kind, [ing("genre", g.place.slug)]))
export const kindTo = (to: To, kind: Kind, g: AtlasGenre, k: AtlasKind) =>
	`${to({ ...place(kind, [ing("genre", g.place.slug)]), kind_: k.id })}#titles`

const pct = (share: number) => `${Math.max(1, Math.round(share * 100))}%`

function KindRow({ g, k, to, kind }: { g: AtlasGenre; k: AtlasKind; to: To; kind: Kind }) {
	return (
		<li className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
			<Link
				to={kindTo(to, kind, g, k)}
				prefetch="intent"
				className={`group/k min-w-0 flex-1 rounded-md ${FOCUS}`}
			>
				<span className="flex items-baseline gap-2">
					<span
						className={`text-[17px] leading-snug font-bold text-white group-hover/k:text-amber-200 ${QUICK_T}`}
					>
						{k.name}
					</span>
					<span aria-hidden className={`text-amber-300 ${QUICK_T} group-hover/k:translate-x-0.5`}>
						›
					</span>
				</span>
				<span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
					<Words words={k.words} />
					<span className="text-gray-500">
						· {pct(k.share)} of {low(g.plural)}
					</span>
				</span>
			</Link>
			<PosterFan
				titles={k.titles}
				to={kindTo(to, kind, g, k)}
				label={`See ${k.name.toLowerCase()}`}
				size="m"
				className="max-sm:origin-right max-sm:scale-[0.78] max-sm:-mr-2"
			/>
		</li>
	)
}

/** The opened genre. `compact` drops the essentials row (a phone, or a narrow column). */
export function GenreOpen({
	g,
	to,
	kind,
	compact = false,
}: {
	g: AtlasGenre
	to: To
	kind: Kind
	compact?: boolean
}) {
	return (
		<div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
			<div className="min-w-0">
				<Link
					to={genreTo(to, kind, g)}
					prefetch="intent"
					className={`group/g block rounded-md ${FOCUS}`}
				>
					<span className="block text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">
						<GenreName label={g.place.label} only={onlyOf(kind, g.place.slug)} />
					</span>
				</Link>
				<Words words={g.words} className="mt-2 block text-[15px] font-semibold" />
				{g.short && (
					<p className="mt-2 text-[15px] leading-relaxed text-pretty text-gray-300">{g.short}</p>
				)}
				<Link
					to={genreTo(to, kind, g)}
					prefetch="intent"
					className={`group/all mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/[0.12] ${QUICK_T} ${FOCUS}`}
				>
					All {count(g.n)} {low(g.plural)}
					<span aria-hidden className={`text-amber-300 ${QUICK_T} group-hover/all:translate-x-0.5`}>
						›
					</span>
				</Link>
				{!compact && g.titles.length > 0 && (
					<div className="mt-8 pl-6 max-lg:hidden">
						<PosterFan
							titles={g.titles}
							to={genreTo(to, kind, g)}
							label={`All ${low(g.plural)}`}
							size="l"
						/>
						<p className="mt-6 text-xs text-gray-500">The {low(g.plural)} that define it</p>
					</div>
				)}
			</div>
			<div className="min-w-0">
				<p className="text-xs font-bold tracking-[0.12em] text-gray-500 uppercase">
					Kinds of {g.place.label.toLowerCase()} {kindNoun(kind)}
				</p>
				{g.kinds.length ? (
					<ul className="mt-3 divide-y divide-white/[0.07]">
						{g.kinds.map((k) => (
							<KindRow key={k.id} g={g} k={k} to={to} kind={kind} />
						))}
					</ul>
				) : (
					<p className="mt-3 text-sm text-gray-400">
						{g.place.label} is one kind all the way through.{" "}
						<Link
							to={genreTo(to, kind, g)}
							className="font-semibold text-amber-300 hover:underline"
						>
							See them all ›
						</Link>
					</p>
				)}
			</div>
		</div>
	)
}
