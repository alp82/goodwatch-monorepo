// Where to start: the start page's browse section under the stage. Top 10, New on streaming, the moods, the services,
// and the genre cloud, then the other ways to browse. It is where a crawler that reads only the start page's server
// HTML finds title pages and every hub, so every title, tile, chip, and hub is a plain `<a href>` with its name as
// text (start-browse.test.ts). A rail without titles is left out; the hub links are always there.
//
// The styles are start.css's `.sb-*`: short class names, since the guest's HTML has a byte budget.
import { Link } from "@remix-run/react"
import { MORE_HUBS, type StartBrowseData } from "./browse-data"
import { GenreCloud } from "./GenreCloud"
import { ArrivalsRail, MoodRail, ServiceRail } from "./Rails"
import { TopTen } from "./TopTen"

export function StartBrowse({ data }: { data: StartBrowseData }) {
	return (
		<section aria-labelledby="sb-title" className="sb">
			<p className="sb-eye">Browse</p>
			<h2 id="sb-title">Where to start</h2>
			<div className="sb-rails">
				<TopTen top={data.top} />
				<ArrivalsRail titles={data.arrivals} />
				<MoodRail moods={data.moods} />
				<ServiceRail services={data.services} />
				<GenreCloud genres={data.genres} />
			</div>
			<nav aria-labelledby="sb-more" className="sb-more">
				<h3 id="sb-more">More ways to browse</h3>
				<ul>
					{MORE_HUBS.map((hub) => (
						<li key={hub.href}>
							<Link to={hub.href} discover="none">
								{hub.label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</section>
	)
}
