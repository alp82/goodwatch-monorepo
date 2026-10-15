import { mediaFieldLanguage } from "~/utils/media-presentation"
import {
	type ExplorerTitle,
	type ExplorerWorld,
	GROUPING_NAMES,
} from "~/domain/explorer"
import { titlePath } from "./ProximityCard"

const TitleLinks = ({ titles }: { titles: ExplorerTitle[] }) => (
	<ul>
		{titles.map((t) => (
			<li key={t.key}>
				<a href={titlePath(t)}>
					<span lang={mediaFieldLanguage(t)}>{t.title}</span>
					{t.year ? <span className="ex-list-year"> ({t.year})</span> : null}
				</a>
			</li>
		))}
	</ul>
)

/**
 * Every grouping's islands as headings with their titles as links, and the groupings as links to their part of the
 * list: what the page shows without JavaScript and to search engines. The map replaces it once the page runs.
 */
export function IslandList({ world }: { world: ExplorerWorld }) {
	return (
		<section className="ex-list" aria-label="Islands">
			<nav className="ex-list-nav" aria-label="Groups of islands">
				{world.maps.map((map) => (
					<a key={map.grouping} href={`#islands-${map.grouping}`}>
						{GROUPING_NAMES[map.grouping]}
					</a>
				))}
			</nav>
			{world.maps.map((map) => (
				<div key={map.grouping} id={`islands-${map.grouping}`}>
					<h2 className="ex-list-group">{GROUPING_NAMES[map.grouping]}</h2>
					<div className="ex-list-islands">
						{map.islands.map((island) => (
							<div key={island.id}>
								<h3>
									<span
										className="ex-dot"
										style={{ background: island.color }}
									/>
									{island.name}
								</h3>
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
				</div>
			))}
		</section>
	)
}
