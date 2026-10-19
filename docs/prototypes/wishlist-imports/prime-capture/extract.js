/*
 * Experimental Prime Video Watchlist extraction. Pure functions used by the
 * isolated-world collector. Version 0.3.0 reads no network responses.
 *
 * Every JSON shape here comes from inspected community source (Amazon VOD for
 * Kodi at bfb3940e) or is a hypothesis. None is a documented Amazon contract.
 * Nothing in this file reads cookies, sends requests or keeps raw payloads.
 */
(() => {
	if (globalThis.__goodwatchPrimeExtract) return;

	const MAX_NODES = 200000;
	const MAX_DEPTH = 40;
	const MAX_ITEMS_PER_COLLECTION = 1000;
	const GTI = /^amzn1\.dv\.gti\.[A-Za-z0-9-]{8,64}$/;
	const TOKEN = /^[A-Za-z0-9]{8,40}$/;
	// A collection is Watchlist membership only when its own path names it.
	const WATCHLIST_KEY = /watchlist/i;
	// Other collections the Watchlist page can carry. A match on any key of the
	// path excludes the collection, except a profile container above the
	// Watchlist key (profiles.<id>.watchlist…).
	const EXCLUDED_KEY =
		/library|purchase|rental|recommend|similar|related|morelike|more-like|customersalso|continuewatching|watchnext|history|hero|billboard|^nav|menu|search|profile|cerberus|channel|station|^live|epg|sport|trailer|extras?$|bonus|episodes?$|seasons?$|siblings|children|cast|people/i;
	const PROFILE_KEY = /profile/i;

	/*
	 * Report vocabulary. The report is built only from these words, numbers,
	 * booleans and fixed codes. Anything else becomes "<key>" or "<seg>", so a
	 * name, slug, ID or class can't reach it, whatever its shape.
	 */
	const KEYS = new Set(
		(
			"props state init body page data args viewOutput features legacy-watchlist watchlist view-filter filters filter content items entities containers container " +
			"baseOutput results pagination paginator queryParameters hasMoreItems totalItems nextPageStartIndex startIndex seeMoreHref seeMoreLink paginationTargetId " +
			"paginationServiceToken paginationTargetUrl nextToken continuationToken serviceToken titleID titleId gti catalogId compactGTI id title text displayTitle " +
			"heading href link url image images alternateText watchlistAction watchlistButton endpoint query titleType entityType contentType releaseYear releaseDate " +
			"year liveInfo station profiles activeProfile otherProfiles cerberus isSelected isDefault active applied isCurrentlyApplied selected viewType widgetType " +
			"collections collection facet facetType widgets subNodes nav navigationNodes yourAccount mainMenu links lists library recommendations strings metadata " +
			"catalog type showId seriesId parentId season show sequenceNumber values options label name value key avatarUrl permissions mystuff myStuff sort sortBy " +
			"offer offers OFFER_FILTER entitlement availability badges rating ratings runtime synopsis description genres maturityRating"
		).split(" "),
	);
	const SEGMENTS = new Set(
		"region eu na fe gp video mystuff my-stuff watchlist api detail storefront movie movies tv all library getDataByTransform paginateCollection getLandingPage getPage page v1 v2 v3 web lib".split(" "),
	);
	const KEY_OTHER = "<key>";
	const SEG_OTHER = "<seg>";
	const vocabKey = (k) => (typeof k === "string" && KEYS.has(k) ? k : KEY_OTHER);
	const vocabSegment = (s) => (s === "" || SEGMENTS.has(s) ? s : SEG_OTHER);
	const redactPath = (pathname) =>
		typeof pathname === "string" ? pathname.slice(0, 300).split("/").slice(0, 12).map(vocabSegment).join("/") : SEG_OTHER;
	const vocabPattern = (p) =>
		typeof p === "string" ? p.slice(0, 300).split(".").slice(0, 40).map((k) => (k === "[]" ? k : vocabKey(k))).join(".") : KEY_OTHER;

	const isText = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 1000 && ![...v].some((c) => c.charCodeAt(0) < 32);
	const normTitle = (t) => (typeof t === "string" ? t.normalize("NFKC").replace(/\s+/g, " ").trim() : "");

	// 32-bit FNV-1a. Used only to compare cursors, links and profile markers.
	function hash(text) {
		let h = 0x811c9dc5;
		for (let i = 0; i < text.length; i++) {
			h ^= text.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return (h >>> 0).toString(16);
	}

	/** Reads a detail link. Returns the native token and a credential-free URL. */
	function detailLink(href, base) {
		if (typeof href !== "string" || href.length > 2048) return null;
		let url;
		try {
			url = new URL(href, base);
		} catch {
			return null;
		}
		if (url.protocol !== "https:" || url.username || url.password) return null;
		if (!/(^|\.)(primevideo\.com|amazon\.[a-z.]{2,12})$/.test(url.hostname)) return null;
		const parts = url.pathname.split("/");
		const at = parts.indexOf("detail");
		if (at < 0 || !TOKEN.test(parts[at + 1] || "")) return null;
		return { token: parts[at + 1], url: `${url.origin}${parts.slice(0, at + 2).join("/")}` };
	}

	function pick(obj, keys) {
		for (const key of keys) {
			const v = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
			if (v !== undefined && v !== null && v !== "") return v;
		}
		return undefined;
	}

	function mediaType(raw) {
		if (typeof raw !== "string") return { mediaType: "unknown", season: false };
		const t = raw.toLowerCase().replace(/[\s_-]/g, "");
		if (t === "movie" || t === "film") return { mediaType: "movie", season: false };
		if (t === "season") return { mediaType: "show", season: true };
		if (["show", "tvshow", "series", "tvseries", "tv"].includes(t)) return { mediaType: "show", season: false };
		return { mediaType: "unknown", season: false, other: t };
	}

	/**
	 * Reads one entity object. Returns null when it has no native identity or
	 * no title. Type and year are taken only from explicit fields.
	 */
	function readEntity(obj, base) {
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
		const ids = [pick(obj, ["titleID", "titleId", "gti", "catalogId", "id", "compactGTI"]), obj.catalog && pick(obj.catalog, ["id", "titleId"])].filter(
			(v) => typeof v === "string",
		);
		const gti = ids.find((v) => GTI.test(v)) || null;
		const href = pick(obj, ["href", "link.url", "title.url", "detailLink", "link", "url"]);
		const link = detailLink(typeof href === "string" ? href : undefined, base);
		const titleRaw = pick(obj, ["title.text", "title", "displayTitle", "heading", "catalog.title", "image.alternateText"]);
		const title = typeof titleRaw === "string" ? titleRaw.trim() : null;
		if ((!gti && !link) || !isText(title)) return null;
		const type = mediaType(
			pick(obj, ["titleType", "entityType", "contentType", "catalog.type", "watchlistAction.endpoint.query.titleType", "watchlistButton.endpoint.query.titleType"]),
		);
		const yearRaw = pick(obj, ["releaseYear", "year", "catalog.releaseYear", "releaseDate"]);
		const year = typeof yearRaw === "number" ? yearRaw : typeof yearRaw === "string" ? Number(/^\d{4}/.exec(yearRaw)?.[0]) : NaN;
		const parent = pick(obj, ["showId", "seriesId", "parentId", "show.id", "series.id"]);
		return {
			gti,
			token: link?.token || null,
			url: link?.url || null,
			title,
			mediaType: type.mediaType,
			season: type.season,
			hasLive: Boolean(obj.liveInfo || obj.station || type.other === "event"),
			...(Number.isInteger(year) && year >= 1800 && year <= 9999 ? { year } : {}),
			parentKnown: typeof parent === "string",
		};
	}

	/**
	 * Pagination evidence of one page, from the object that holds its items
	 * only. Ancestors are ignored: an outer flag can belong to another list.
	 * End and continuation signals together make the page "conflict".
	 * `cursor` is a hash used only to spot the same page twice.
	 */
	function pagination(holder) {
		const out = { terminal: null, keys: [], cursor: null, nextIndex: null, totalItems: null };
		if (!holder || typeof holder !== "object" || Array.isArray(holder)) return out;
		let end = 0;
		let more = 0;
		const cursor = (v) => (out.cursor ??= hash(`c:${v}`));
		if (typeof holder.hasMoreItems === "boolean") {
			out.keys.push("hasMoreItems");
			holder.hasMoreItems ? more++ : end++;
		}
		if (Number.isSafeInteger(holder.totalItems) && holder.totalItems >= 0) {
			out.keys.push("totalItems");
			out.totalItems = holder.totalItems;
		}
		if (Number.isSafeInteger(holder.nextPageStartIndex) && holder.nextPageStartIndex >= 0) {
			out.keys.push("nextPageStartIndex");
			out.nextIndex = holder.nextPageStartIndex;
			if (out.totalItems !== null) holder.nextPageStartIndex >= out.totalItems ? end++ : more++;
		}
		if (typeof holder.seeMoreHref === "string" && holder.seeMoreHref) {
			out.keys.push("seeMoreHref");
			more++;
			cursor(holder.seeMoreHref);
		}
		for (const k of ["paginationTargetId", "paginationServiceToken", "paginationTargetUrl", "nextToken", "continuationToken"]) {
			if (typeof holder[k] === "string" && holder[k]) {
				out.keys.push(k);
				more++;
				cursor(holder[k]);
			}
		}
		const p = holder.pagination;
		if (p && typeof p === "object") {
			out.keys.push("pagination");
			if (Array.isArray(p.paginator)) {
				out.keys.push("paginator");
				const next = p.paginator.find(
					(x) => x && (x.type === "NextPage" || x["*className*"] === "atv.wps.PaginatorNext" || String(x.__type || "").includes("PaginatorNext")),
				);
				if (next?.href) {
					more++;
					cursor(next.href);
				} else end++;
			} else if (p.queryParameters && typeof p.queryParameters === "object") {
				out.keys.push("queryParameters");
				more++;
				cursor(JSON.stringify(p.queryParameters).slice(0, 2000));
			}
		}
		out.terminal = end && more ? "conflict" : end ? true : more ? false : null;
		return out;
	}

	const pathPattern = (path) => path.map((k) => (typeof k === "number" ? "[]" : vocabKey(k))).join(".");

	function classify(path) {
		const keys = path.filter((k) => typeof k === "string");
		const w = keys.findLastIndex((k) => WATCHLIST_KEY.test(k));
		if (keys.some((k, i) => EXCLUDED_KEY.test(k) && !(PROFILE_KEY.test(k) && i < w))) return "excluded";
		return w >= 0 ? "watchlist" : "unclassified";
	}

	/**
	 * Finds arrays of entities in one JSON document. Each collection carries its
	 * key pattern, its chain name (from the Watchlist key on), its
	 * classification and the pagination evidence of its own holder.
	 */
	function findCollections(root, base) {
		const found = [];
		let nodes = 0;
		let truncated = false;
		const walk = (value, path, holder) => {
			if (++nodes > MAX_NODES || path.length > MAX_DEPTH) {
				truncated = true;
				return;
			}
			if (Array.isArray(value)) {
				const items = [];
				let objects = 0;
				for (const v of value) {
					if (v && typeof v === "object" && !Array.isArray(v)) {
						objects++;
						const e = readEntity(v, base);
						if (e) items.push(e);
					}
				}
				if (items.length && items.length * 2 >= objects) {
					const w = path.findLastIndex((k) => typeof k === "string" && WATCHLIST_KEY.test(k));
					found.push({
						path: pathPattern(path),
						chain: pathPattern(path.slice(Math.max(0, w))),
						classification: classify(path),
						items: items.slice(0, MAX_ITEMS_PER_COLLECTION),
						overflow: items.length > MAX_ITEMS_PER_COLLECTION,
						objects,
						// Raw keys stay in memory only, to scope filter evidence.
						scope: path.slice(0, Math.max(0, w)).filter((k) => typeof k === "string"),
						pagination: pagination(holder),
					});
				}
				value.forEach((v, i) => {
					if (v && typeof v === "object") walk(v, [...path, i], null);
				});
				return;
			}
			for (const [k, v] of Object.entries(value)) if (v && typeof v === "object") walk(v, [...path, k], value);
		};
		if (root && typeof root === "object") walk(root, [], null);
		return { collections: found, truncated, nodes };
	}

	/** Key tree in report vocabulary; values are replaced by their JSON type. */
	function shape(value, depth = 0, budget = { n: 0 }) {
		if (++budget.n > 1500) return "…";
		if (Array.isArray(value)) return value.length ? [Math.min(value.length, 100000), shape(value[0], depth + 1, budget)] : [];
		if (!value || typeof value !== "object") return value === null ? "null" : ["string", "number", "boolean"].includes(typeof value) ? typeof value : "other";
		if (depth >= 6) return "{…}";
		const out = {};
		let other = 0;
		for (const [k, v] of Object.entries(value).slice(0, 80)) {
			const key = vocabKey(k);
			if (key === KEY_OTHER) other++;
			else if (!(key in out)) out[key] = shape(v, depth + 1, budget);
		}
		if (other) out[KEY_OTHER] = other;
		return out;
	}

	/** Active profile markers in a document, hashed. Empty when none is named. */
	function profileMarkers(root) {
		const markers = new Set();
		let n = 0;
		const walk = (v) => {
			if (!v || typeof v !== "object" || ++n > 50000 || markers.size > 4) return;
			const p = v.activeProfile;
			if (p && typeof p === "object" && typeof p.id === "string") markers.add(hash(`p:${p.id}`));
			if (Array.isArray(v.profiles)) for (const x of v.profiles) if (x && x.isSelected === true && typeof x.id === "string") markers.add(hash(`p:${x.id}`));
			for (const c of Object.values(v)) walk(c);
		};
		walk(root);
		return [...markers];
	}

	const VIEW_FILTER_KEY = /^(view-?filters?|viewfilters?|watchlist-?view-?filters?)$/i;
	const ALL_VALUE = /^(all|everything|alle|tout|tous|todo|todos|tutti|tudo|alles)$/i;
	const FLAG_KEYS = ["active", "applied", "isCurrentlyApplied", "selected", "isSelected"];

	/**
	 * Filter evidence: groups of two or more options of the Watchlist view
	 * filter, each with an on/off flag. One entry per group with its raw key
	 * path (kept in memory only): "all" (exactly one option on, and it is
	 * All), "filtered" or "none". The collector counts a group only when it
	 * sits beside the Watchlist collection it belongs to.
	 */
	function filterEvidence(root) {
		const groups = [];
		let n = 0;
		const walk = (v, path, underFilter) => {
			if (!v || typeof v !== "object" || ++n > 50000 || groups.length > 20) return;
			if (Array.isArray(v)) {
				const options = v.filter((o) => o && typeof o === "object" && FLAG_KEYS.some((k) => typeof o[k] === "boolean"));
				// Only the Watchlist view filter counts: a group under a view-filter
				// key, or whose options all name a viewType. Other filters (audio
				// language, offers, genres) are ignored, never taken as the view.
				const viewFilter = path.some((k) => VIEW_FILTER_KEY.test(k)) || (options.length > 0 && options.every((o) => typeof o.viewType === "string"));
				if (underFilter && options.length >= 2 && viewFilter) {
					const on = options.filter((o) => FLAG_KEYS.some((k) => o[k] === true));
					const value = (o) => String(o.viewType ?? o.id ?? o.value ?? o.key ?? o.type ?? "").replace(/^.*[-_:]/, "");
					groups.push({ value: on.length === 0 ? "none" : on.length === 1 && ALL_VALUE.test(value(on[0])) ? "all" : "filtered", path });
					return;
				}
				for (const c of v) walk(c, path, underFilter);
				return;
			}
			for (const [k, c] of Object.entries(v)) walk(c, [...path, k], underFilter || /filter/i.test(k));
		};
		walk(root, [], false);
		return groups;
	}

	/** Parses inert hydration scripts. Never evaluates page code. */
	function parseScripts(doc) {
		const docs = [];
		for (const s of doc.querySelectorAll('script[type="text/template"], script[type="application/json"]')) {
			const text = s.textContent || "";
			if (text.length > 20 * 1024 * 1024) continue;
			const trimmed = text.trim();
			if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
			try {
				docs.push({ type: s.getAttribute("type"), size: text.length, json: JSON.parse(trimmed) });
			} catch {
				docs.push({ type: s.getAttribute("type"), size: text.length, json: null });
			}
		}
		return docs;
	}

	/** True when a raw key path passes through an excluded collection key. */
	const excludedPath = (path) => path.some((k) => typeof k === "string" && EXCLUDED_KEY.test(k) && !PROFILE_KEY.test(k));

	globalThis.__goodwatchPrimeExtract = Object.freeze({
		GTI,
		TOKEN,
		KEYS,
		KEY_OTHER,
		hash,
		detailLink,
		readEntity,
		findCollections,
		pagination,
		shape,
		profileMarkers,
		filterEvidence,
		parseScripts,
		isText,
		normTitle,
		mediaType,
		redactPath,
		vocabKey,
		vocabPattern,
		excludedPath,
	});
})();
