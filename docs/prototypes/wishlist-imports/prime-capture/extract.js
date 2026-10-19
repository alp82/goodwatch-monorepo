/*
 * Experimental Prime Video Watchlist extraction. Pure functions shared by the
 * isolated-world collector and the page-world response observer.
 *
 * Every JSON shape here comes from inspected community source (Amazon VOD for
 * Kodi at bfb3940e) or is a hypothesis. None is a documented Amazon contract.
 * Nothing in this file reads cookies, sends requests or keeps raw payloads.
 */
(() => {
	if (globalThis.__goodwatchPrimeExtract) return;

	const MAX_NODES = 200000;
	const MAX_DEPTH = 40;
	const GTI = /^amzn1\.dv\.gti\.[A-Za-z0-9-]{8,64}$/;
	const TOKEN = /^[A-Za-z0-9]{8,40}$/;
	// A collection is Watchlist membership only when its own path names it.
	const WATCHLIST_KEY = /watchlist/i;
	// Other collections the Watchlist page can carry. A match on any key of the
	// path excludes the collection, even under a Watchlist key.
	const EXCLUDED_KEY =
		/library|purchase|rental|recommend|similar|related|morelike|more-like|customersalso|continuewatching|watchnext|history|hero|billboard|^nav|menu|search|profile|cerberus|channel|station|^live|epg|sport|trailer|extras?$|bonus|episodes?$|seasons?$|siblings|children|cast|people/i;
	const ID_LIKE = /^(amzn1\.|[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Z0-9]{10,}$|\d{6,}$)/;

	const isText = (v) =>
		typeof v === "string" &&
		v.trim().length > 0 &&
		v.length <= 1000 &&
		![...v].some((c) => c.charCodeAt(0) < 32);

	// 32-bit FNV-1a. Used only to compare cursors and profile markers in memory.
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
		if (!/(^|\.)(primevideo\.com|amazon\.[a-z.]{2,12})$/.test(url.hostname))
			return null;
		const parts = url.pathname.split("/");
		const at = parts.indexOf("detail");
		if (at < 0 || !TOKEN.test(parts[at + 1] || "")) return null;
		const prefix = parts.slice(0, at + 2).join("/");
		return { token: parts[at + 1], url: `${url.origin}${prefix}` };
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
		if (["show", "tvshow", "series", "tvseries", "tv"].includes(t))
			return { mediaType: "show", season: false };
		return { mediaType: "unknown", season: false, other: t };
	}

	/**
	 * Reads one entity object. Returns null when it has no native identity or
	 * no title. Type and year are taken only from explicit fields.
	 */
	function readEntity(obj, base) {
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
		const ids = [
			pick(obj, ["titleID", "titleId", "gti", "catalogId", "id", "compactGTI"]),
			obj.catalog && pick(obj.catalog, ["id", "titleId"]),
		].filter((v) => typeof v === "string");
		const gti = ids.find((v) => GTI.test(v)) || null;
		const href = pick(obj, ["href", "link.url", "title.url", "detailLink", "link", "url"]);
		const link = detailLink(typeof href === "string" ? href : undefined, base);
		const titleRaw = pick(obj, [
			"title.text",
			"title",
			"displayTitle",
			"heading",
			"catalog.title",
			"image.alternateText",
		]);
		const title = typeof titleRaw === "string" ? titleRaw.trim() : null;
		if ((!gti && !link) || !isText(title)) return null;
		const type = mediaType(
			pick(obj, [
				"titleType",
				"entityType",
				"contentType",
				"catalog.type",
				"watchlistAction.endpoint.query.titleType",
				"watchlistButton.endpoint.query.titleType",
			]),
		);
		const yearRaw = pick(obj, ["releaseYear", "year", "catalog.releaseYear", "releaseDate"]);
		const year =
			typeof yearRaw === "number" ? yearRaw : typeof yearRaw === "string" ? Number(/^\d{4}/.exec(yearRaw)?.[0]) : NaN;
		const parent = pick(obj, ["showId", "seriesId", "parentId", "show.id", "series.id"]);
		return {
			gti,
			token: link?.token || null,
			url: link?.url || null,
			title,
			mediaType: type.mediaType,
			season: type.season,
			otherType: type.other || null,
			hasLive: Boolean(obj.liveInfo || obj.station || type.other === "event"),
			...(Number.isInteger(year) && year >= 1800 && year <= 9999 ? { year } : {}),
			parentKnown: typeof parent === "string",
		};
	}

	/** Pagination evidence next to a collection. Raw cursors never leave here. */
	function pagination(holders) {
		const out = { terminal: null, keys: [], cursor: null, totalItems: null, nextIndex: null };
		for (const h of holders) {
			if (!h || typeof h !== "object" || Array.isArray(h)) continue;
			const has = (k) => Object.prototype.hasOwnProperty.call(h, k);
			if (has("hasMoreItems") && typeof h.hasMoreItems === "boolean") {
				out.keys.push("hasMoreItems");
				out.terminal ??= !h.hasMoreItems;
			}
			if (typeof h.totalItems === "number") {
				out.keys.push("totalItems");
				out.totalItems ??= h.totalItems;
			}
			if (typeof h.nextPageStartIndex === "number") {
				out.keys.push("nextPageStartIndex");
				out.nextIndex ??= h.nextPageStartIndex;
				if (typeof h.totalItems === "number")
					out.terminal ??= h.nextPageStartIndex >= h.totalItems;
			}
			if (has("seeMoreHref")) {
				out.keys.push("seeMoreHref");
				if (typeof h.seeMoreHref === "string" && h.seeMoreHref) out.cursor ??= hash(h.seeMoreHref);
			}
			for (const k of ["paginationTargetId", "paginationServiceToken", "paginationTargetUrl", "nextToken", "continuationToken"]) {
				if (typeof h[k] === "string" && h[k]) {
					out.keys.push(k);
					out.cursor ??= hash(`${k}:${h[k]}`);
					out.terminal ??= false;
				}
			}
			const p = h.pagination;
			if (p && typeof p === "object") {
				out.keys.push("pagination");
				if (Array.isArray(p.paginator)) {
					const next = p.paginator.find(
						(x) =>
							x &&
							(x.type === "NextPage" ||
								x["*className*"] === "atv.wps.PaginatorNext" ||
								String(x.__type || "").includes("PaginatorNext")),
					);
					out.keys.push("pagination.paginator");
					if (next?.href) out.cursor ??= hash(next.href);
					out.terminal ??= !next;
				} else if (p.queryParameters && typeof p.queryParameters === "object") {
					out.keys.push("pagination.queryParameters");
					const token = p.queryParameters.serviceToken || p.queryParameters.startIndex;
					if (token !== undefined) out.cursor ??= hash(`q:${JSON.stringify(token)}`);
					out.terminal ??= false;
				}
			} else if (has("pagination") && p === null) {
				out.keys.push("pagination=null");
				out.terminal ??= true;
			}
		}
		out.keys = [...new Set(out.keys)];
		return out;
	}

	const pathPattern = (path) =>
		path.map((k) => (typeof k === "number" ? "[]" : ID_LIKE.test(k) ? "<id>" : k)).join(".");

	function classify(path) {
		const keys = path.filter((k) => typeof k === "string");
		if (keys.some((k) => EXCLUDED_KEY.test(k))) return "excluded";
		if (keys.some((k) => WATCHLIST_KEY.test(k))) return "watchlist";
		return "unclassified";
	}

	/**
	 * Finds arrays of entities in one JSON document. Each collection carries its
	 * key path, its classification and the pagination evidence of its holders.
	 */
	function findCollections(root, base) {
		const found = [];
		let nodes = 0;
		let truncated = false;
		const walk = (value, path, holders) => {
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
					found.push({
						path: pathPattern(path),
						classification: classify(path),
						items,
						objects,
						pagination: pagination(holders.slice(-3).reverse()),
					});
				}
				value.forEach((v, i) => {
					if (v && typeof v === "object") walk(v, [...path, i], holders);
				});
				return;
			}
			for (const [k, v] of Object.entries(value)) {
				if (v && typeof v === "object") walk(v, [...path, k], [...holders, value]);
			}
		};
		if (root && typeof root === "object") walk(root, [], []);
		return { collections: found, truncated, nodes };
	}

	/** Key tree with values replaced by types. ID-like keys are redacted. */
	function shape(value, depth = 0, budget = { n: 0 }) {
		if (++budget.n > 4000) return "…";
		if (Array.isArray(value)) return value.length ? [`${value.length}×`, shape(value[0], depth + 1, budget)] : [];
		if (!value || typeof value !== "object") return value === null ? "null" : typeof value;
		if (depth >= 7) return "{…}";
		const out = {};
		for (const [k, v] of Object.entries(value).slice(0, 60)) {
			out[ID_LIKE.test(k) ? "<id>" : k] = shape(v, depth + 1, budget);
		}
		return out;
	}

	/** Active profile marker from state, hashed. Null when no state names one. */
	function profileMarker(root) {
		let marker = null;
		let n = 0;
		const walk = (v) => {
			if (marker || !v || typeof v !== "object" || ++n > 50000) return;
			const p = v.activeProfile;
			if (p && typeof p === "object" && typeof p.id === "string") {
				marker = hash(`a:${p.id}`);
				return;
			}
			if (Array.isArray(v.profiles)) {
				const s = v.profiles.find((x) => x && x.isSelected === true && typeof x.id === "string");
				if (s) {
					marker = hash(`s:${s.id}`);
					return;
				}
			}
			for (const c of Object.values(v)) walk(c);
		};
		walk(root);
		return marker;
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
				docs.push({
					type: s.getAttribute("type"),
					id: s.id ? s.id.replace(/[0-9a-f]{6,}|\d{3,}/gi, "<n>") : "",
					size: text.length,
					json: JSON.parse(trimmed),
				});
			} catch {
				docs.push({ type: s.getAttribute("type"), id: s.id ? "<set>" : "", size: text.length, json: null });
			}
		}
		return docs;
	}

	globalThis.__goodwatchPrimeExtract = Object.freeze({
		GTI,
		hash,
		detailLink,
		readEntity,
		findCollections,
		pagination,
		shape,
		profileMarker,
		parseScripts,
		isText,
		mediaType,
	});
})();
