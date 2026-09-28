import {
	type ExplorerMap,
	type ExplorerPair,
	type ExplorerTitle,
	GROUPING_NAMES,
} from "~/domain/explorer"
import { sharedNote } from "./CombineBar"
import { titlePath } from "./ProximityCard"
import { pairKey } from "./api"

/** The list view's part in combining: the same islands, titles, and combine action as the map. */
export interface ListCombining {
	/** Whether a title passes On my services and Not seen yet (the rest are left out, as on the map). */
	visible: (title: ExplorerTitle) => boolean
	/** What every pair of islands shares, by pairKey; null while it loads. */
	pairs: ReadonlyMap<string, ExplorerPair> | null
	/** The bridge that's up, with its titles. */
	bridge: {
		name: string
		line: string
		color: string
		titles: ExplorerTitle[]
	} | null
	/** Islands being combined while their bridge loads. */
	forming: boolean
	onCombine: (a: string, b: string) => void
	onSeparate: () => void
}

const TitleLinks = ({
	titles,
	match,
}: { titles: ExplorerTitle[]; match: boolean }) => (
	<ul>
		{titles.map((t) => (
			<li key={t.key}>
				<a href={titlePath(t)}>
					{t.title}
					{t.year ? <span className="ex-list-year"> ({t.year})</span> : null}
					{match && t.match != null ? (
						<span className="ex-list-year">, {t.match}% taste match</span>
					) : null}
				</a>
			</li>
		))}
	</ul>
)

/**
 * The grouping's islands as headings with their titles as links. Without JavaScript (and for search engines) it's
 * what the page shows, with the groupings as links; with the map running it's the list view: the same islands and
 * titles, and "Combine with…" on each island, for screen-reader users and anyone who prefers a list.
 */
export function IslandList({
	map,
	className = "",
	combining,
}: {
	map: ExplorerMap
	className?: string
	combining?: ListCombining
}) {
	const shown = (titles: ExplorerTitle[]) =>
		combining ? titles.filter(combining.visible) : titles.slice(0, 12)
	return (
		<section
			className={`ex-list ${className}`}
			aria-label={`Islands by ${GROUPING_NAMES[map.grouping].toLowerCase()}`}
		>
			{!combining && (
				<nav className="ex-list-nav" aria-label="Lay the islands out by">
					{map.groupings.map((g) => (
						<a
							key={g}
							href={g === "genre" ? "/explorer" : `/explorer?grouping=${g}`}
							aria-current={g === map.grouping ? "page" : undefined}
						>
							{GROUPING_NAMES[g]}
						</a>
					))}
				</nav>
			)}
			{combining?.bridge && (
				<div
					className="ex-list-bridge"
					style={{ "--c": combining.bridge.color } as React.CSSProperties}
				>
					<div className="ex-list-bridge-head">
						<div>
							<h2>{combining.bridge.name}</h2>
							<p className="ex-list-count">{combining.bridge.line}</p>
						</div>
						<button
							type="button"
							className="ex-list-sep"
							onClick={combining.onSeparate}
						>
							Separate
						</button>
					</div>
					<TitleLinks titles={shown(combining.bridge.titles)} match />
				</div>
			)}
			<div className="ex-list-islands">
				{map.islands.map((island) => {
					const others = combining
						? map.islands
								.filter((o) => o.id !== island.id)
								.map((o) => ({
									o,
									p: combining.pairs?.get(pairKey(island.id, o.id)) ?? null,
								}))
								.filter((x) => !x.p || x.p.count > 0)
								.sort((x, y) => (y.p?.count ?? 0) - (x.p?.count ?? 0))
						: []
					return (
						<div key={island.id}>
							<h2>
								<span className="ex-dot" style={{ background: island.color }} />
								{island.name}
							</h2>
							<p className="ex-list-count">
								{island.count.toLocaleString("en")} titles
								{island.medianMatch != null
									? `, ${island.medianMatch}% your taste`
									: ""}
								.{island.apart ? ` ${island.apart}` : ""}
							</p>
							{combining && others.length > 0 && (
								<label className="ex-list-combine">
									<span className="sr-only">Combine {island.name} with</span>
									<select
										value=""
										disabled={combining.forming}
										onChange={(e) => {
											const to = e.target.value
											if (to) combining.onCombine(island.id, to)
										}}
									>
										<option value="">Combine with…</option>
										{others.map(({ o, p }) => (
											<option key={o.id} value={o.id}>
												{o.name}
												{p ? ` (${sharedNote(p.count, p.kind)})` : ""}
											</option>
										))}
									</select>
								</label>
							)}
							<TitleLinks titles={shown(island.titles)} match={!!combining} />
						</div>
					)
				})}
			</div>
		</section>
	)
}
