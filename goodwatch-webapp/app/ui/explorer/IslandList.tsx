import {
	DEFAULT_GROUPING,
	type ExplorerMap,
	type ExplorerTitle,
	GROUPING_NAMES,
} from "~/domain/explorer"
import { titlePath } from "./ProximityCard"

const TitleLinks = ({ titles }: { titles: ExplorerTitle[] }) => (
	<ul>
		{titles.map((t) => (
			<li key={t.key}>
				<a href={titlePath(t)}>
					{t.title}
					{t.year ? <span className="ex-list-year"> ({t.year})</span> : null}
				</a>
			</li>
		))}
	</ul>
)

/**
 * The grouping's islands as headings with their titles as links, and the groupings as links: what the page shows
 * without JavaScript and to search engines. The map replaces it once the page runs.
 */
export function IslandList({ map }: { map: ExplorerMap }) {
	return (
		<section
			className="ex-list"
			aria-label={`Islands by ${GROUPING_NAMES[map.grouping].toLowerCase()}`}
		>
			<nav className="ex-list-nav" aria-label="Lay the islands out by">
				{map.groupings.map((g) => (
					<a
						key={g}
						href={
							g === DEFAULT_GROUPING ? "/explorer" : `/explorer?grouping=${g}`
						}
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
						<TitleLinks titles={island.titles.slice(0, 12)} />
					</div>
				))}
			</div>
		</section>
	)
}
