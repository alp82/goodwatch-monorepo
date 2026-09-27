import { GROUPING_NAMES, type ExplorerMap } from "~/domain/explorer"
import { titlePath } from "./ProximityCard"

/**
 * The grouping's islands as headings with their top titles as links, and the groupings as links: what the page shows
 * without JavaScript and what search engines read. The map replaces it once the page runs.
 */
export function IslandList({
	map,
	className = "",
}: { map: ExplorerMap; className?: string }) {
	return (
		<section
			className={`ex-list ${className}`}
			aria-label={`Islands by ${GROUPING_NAMES[map.grouping].toLowerCase()}`}
		>
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
			<div className="ex-list-islands">
				{map.islands.map((island) => (
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
						<ul>
							{island.titles.slice(0, 12).map((t) => (
								<li key={t.key}>
									<a href={titlePath(t)}>
										{t.title}
										{t.year ? (
											<span className="ex-list-year"> ({t.year})</span>
										) : null}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</section>
	)
}
