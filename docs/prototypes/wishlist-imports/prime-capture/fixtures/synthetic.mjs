// Invented Prime Video Watchlist pages. Field names follow shapes seen in the
// Amazon VOD for Kodi source (bfb3940e); titles, IDs and cursors are made up.
// None of this is copied from a real account or a saved Amazon page.

export const gti = (n) => `amzn1.dv.gti.00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const token = (n) => `0SYNTH${String(n).padStart(6, "0")}X`;

export const titles = {
	1: ["Synthetic Movie", "movie", 2001],
	2: ["Synthetic Show", "tv_show", 2015],
	3: ["Synthetic Show – Season 2", "season", 2017],
	4: ["Remake Title", "movie", 1984],
	5: ["Remake Title", "movie", 2024],
	6: ["Unavailable Synthetic Film", "movie", 1999],
	50: ["Library Purchase", "movie", 2010],
	60: ["Recommended For You", "movie", 2020],
	61: ["Also Recommended", "tv_show", 2021],
	62: ["Third Recommendation", "movie", 2022],
	70: ["Synthetic Live Event", "event", 2026],
};

export function entity(n, { prefix = "/region/eu", link = true, type = true } = {}) {
	const [title, titleType, releaseYear] = titles[n];
	return {
		titleID: gti(n),
		title,
		...(link ? { href: `${prefix}/detail/${token(n)}/ref=atv_wl_hom_c_${n}?autoplay=0&jic=private` } : {}),
		...(type ? { watchlistAction: { endpoint: { query: { titleType } } } } : {}),
		releaseYear,
		...(titleType === "event" ? { liveInfo: { status: "UPCOMING" } } : {}),
	};
}

/** One Watchlist page in the viewOutput layout. */
export function viewOutputPage(ids, { next, total, cursor, opts } = {}) {
	return {
		viewOutput: {
			features: {
				"legacy-watchlist": {
					content: {
						items: ids.map((n) => entity(n, opts)),
						...(next !== undefined ? { nextPageStartIndex: next } : {}),
						...(total !== undefined ? { totalItems: total } : {}),
						...(cursor ? { seeMoreHref: `/region/eu/api/watchlist?startIndex=${next}&token=${cursor}` } : {}),
					},
				},
				"view-filter": { filters: [{ viewType: "all", text: "All", active: true }] },
			},
		},
	};
}

export function hydration({ page, profile = "synthetic-profile-a", extra = {} } = {}) {
	return {
		props: {
			...page,
			profiles: { activeProfile: { id: profile, name: "Invented" } },
			library: { items: [entity(50)] },
			recommendations: { items: [entity(60), entity(61), entity(62)] },
			...extra,
		},
	};
}

export function card(n, { prefix = "/region/eu", attrs = true } = {}) {
	const [title, type] = titles[n];
	const entityType = type === "movie" ? "Movie" : type === "event" ? "Event" : "TV Show";
	return `<li><article ${attrs ? `data-card-title="${title}" data-card-entity-type="${entityType}"` : ""}><a href="${prefix}/detail/${token(n)}/ref=atv_wl_${n}?jic=private" aria-label="${title}"><img alt="${title}"></a></article></li>`;
}

/** A full Watchlist page: header with profile, the grid, a recommendation row. */
export function page({ state, grid = [], recs = [60, 61, 62], lang = "en-gb", prefix, script = "" } = {}) {
	return `<!doctype html><html lang="${lang}"><head><title>Synthetic Watchlist</title></head><body>
<header><nav><button data-testid="pv-nav-profile-button" aria-label="Profile: Invented"><img alt="Invented" src="/avatar-a.png"></button>
<a href="${prefix || "/region/eu"}/detail/0SYNTHNAV0001/">Featured in navigation</a></nav></header>
<main>
<h1>Watchlist</h1>
<ul role="list" data-testid="watchlist-grid" id="grid">${grid.map((n) => card(n, { prefix })).join("")}</ul>
<section aria-label="Customers also watched" id="recs"><ul class="carousel">${recs.map((n) => card(n, { prefix })).join("")}</ul></section>
</main>
${state ? `<script type="text/template">${JSON.stringify(state).replace(/</g, "\\u003c")}</script>` : ""}
${script}
</body></html>`;
}
