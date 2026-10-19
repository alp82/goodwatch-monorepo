/*
 * Experimental Prime Video Watchlist collector (isolated world).
 *
 * Version 0.3.0 reads two things only, both already in the page:
 *  - page data: Watchlist collections in the page's inert hydration scripts;
 *  - cards: title cards in one Watchlist grid, accumulated while scrolling.
 * It reads no network responses and wraps nothing in the page.
 *
 * The file holds page-data Watchlist entries only. Cards are a check: every
 * page-data entry must appear as a card and every card in the grid must be in
 * the page data. The file says "complete" only when the page data holds the
 * whole list on one page that ends explicitly, both channels agree exactly,
 * the All view is shown beside the Watchlist, and the profile is confirmed.
 * A list longer than the page data's first page is "partial": the rest of
 * the list was never read.
 */
(() => {
	if (globalThis.__goodwatchPrimeCommand) return;
	const X = globalThis.__goodwatchPrimeExtract;
	const VERSION = "0.3.1";
	const MAX_ITEMS = 5000;
	const MAX_TIME = 15 * 60 * 1000;
	const CARD_LINK = 'a[href*="/detail/"]';
	const CARD_ROOT = '[data-card-title], [data-testid="card"], article, li';
	const GROUP = 'ul, ol, [role="list"], [role="grid"], [role="rowgroup"], section';
	const OUTSIDE = 'header, nav, footer, [role="dialog"], [aria-modal="true"], [role="banner"], [role="navigation"]';
	const PROFILE = '[data-testid*="profile" i], [aria-label*="profile" i], [aria-label*="profil" i]';
	const SCRIPTS = 'script[type="text/template"], script[type="application/json"]';
	// A selected control showing a type filter anywhere on the page counts
	// against the All view. Nothing on the page counts for it: only page data
	// beside the Watchlist can confirm All.
	const SELECTED = '[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], [aria-current="true"], [aria-current="page"], option:checked';
	const FILTER_WORDS = /^(movies?|films?|filme|tv|tv shows?|shows?|series|serien|séries|películas|serie tv|tv-serien|tv-sendungen|filmes)$/i;
	const DATA_ATTRS = new Set(["data-card-title", "data-card-entity-type", "data-testid", "data-card-id", "data-asin", "data-gti", "data-automation-id", "data-card-type"]);

	const REASONS = new Set([
		"terminated_navigation", "terminated_profile", "limit_items", "limit_time", "collector_error",
		"no_structured_watchlist", "no_terminal_evidence", "continuation_pending", "pagination_contradiction", "several_chain_starts",
		"several_watchlist_chains", "cursor_repeated", "total_changed", "total_mismatch", "visible_not_in_structured",
		"structured_not_seen_visible", "no_visible_cards", "visible_group_guessed", "visible_group_contested", "visible_group_unconfirmed",
		"conflicting_identity", "channel_title_disagreement", "channel_type_disagreement", "filter_changed", "filtered_view",
		"all_view_unconfirmed", "state_truncated", "collection_overflow", "profile_unconfirmed", "profile_ambiguous", "no_reported_total",
	]);

	let s = fresh();

	function fresh() {
		return {
			state: "idle",
			code: "idle",
			origin: "",
			lang: "",
			filter: "",
			pathPattern: "",
			started: 0,
			stoppedAt: 0,
			observer: null,
			interval: null,
			pending: null,
			marker: null,
			markerSource: "none",
			stateMarkers: 0,
			lateMarker: false,
			profileAmbiguous: false,
			domMarker: null,
			entries: new Map(), // key -> entry
			aliases: new Map(), // gti -> key
			quarantined: new Set(),
			structuredKeys: new Set(),
			domKeys: new Set(),
			domSightings: 0,
			structuredSightings: 0,
			domRejected: new Map(),
			titleDisagreements: 0,
			typeDisagreements: 0,
			liveExcluded: 0,
			groupIds: new WeakMap(), // element -> id
			groups: new Map(), // id -> { el, tokens, tag, role, labeled }
			nextGroup: 1,
			primary: null,
			primaryBy: null,
			primaryContested: false,
			docs: new Map(), // script element -> { hash, filters, scopes }
			dirty: new Set(),
			scripts: { count: 0, parsed: 0, template: 0, json: 0, bytes: 0, changed: 0 },
			pages: [],
			otherCollections: [],
			pageSignatures: new Set(),
			duplicatePages: 0,
			cursors: new Set(),
			cursorRepeats: 0,
			domFiltered: 0,
			filterChanged: false,
			truncated: false,
			overflow: false,
			cardAttributes: new Set(),
			otherDataAttributes: 0,
			discarded: false,
		};
	}

	const isWatchlist = () => /(^|\.)(primevideo\.com|amazon\.[a-z.]{2,12})$/.test(location.hostname) && /\/watchlist(\/|$)/i.test(location.pathname);

	function filterKey() {
		const after = location.pathname.replace(/^.*?\/watchlist/i, "").replace(/\/$/, "");
		const params = [...new URLSearchParams(location.search)]
			.filter(([k]) => /filter|type|sort|view|offer|category/i.test(k))
			.map(([k, v]) => `${X.vocabKey(k)}=${/^[a-z_-]{1,20}$/i.test(v) ? v : "<value>"}`)
			.sort();
		return X.redactPath(after) + (params.length ? `?${params.join("&")}` : "");
	}

	function domMarker() {
		const nodes = [...document.querySelectorAll(PROFILE)].filter((n) => n.closest(OUTSIDE));
		if (!nodes.length) return null;
		// Labels only: an avatar URL can change while lazy loading or cache-busting.
		const label = `${nodes[0].getAttribute("aria-label") || ""}|${nodes[0].querySelector("img")?.getAttribute("alt") || ""}`;
		return label === "|" ? null : X.hash(`d:${label}`);
	}

	function bump(map, code) {
		map.set(code, (map.get(code) || 0) + 1);
	}

	function keyFor(e) {
		if (e.token) return e.token;
		if (e.gti && s.aliases.has(e.gti)) return s.aliases.get(e.gti);
		return e.gti ? `gti:${e.gti}` : null;
	}

	function quarantine(key) {
		s.quarantined.add(key);
		s.entries.delete(key);
		s.structuredKeys.delete(key);
		s.domKeys.delete(key);
	}

	function upsert(e, channel) {
		if (e.hasLive) {
			s.liveExcluded++;
			return;
		}
		const key = keyFor(e);
		if (!key || s.quarantined.has(key)) return;
		if (e.gti) s.aliases.set(e.gti, key);
		let entry = s.entries.get(key);
		if (!entry) {
			if (s.entries.size >= MAX_ITEMS) return terminate("limit_items", false);
			entry = { key, gti: null, url: null, title: null, domTitle: null, mediaType: "unknown", domType: "unknown", season: false };
			s.entries.set(key, entry);
		}
		if (e.gti && entry.gti && entry.gti !== e.gti) return quarantine(key);
		entry.gti ||= e.gti;
		entry.url ||= e.url;
		if (channel === "dom") {
			if (entry.domTitle && X.normTitle(entry.domTitle) !== X.normTitle(e.title)) return quarantine(key);
			entry.domTitle = e.title;
			if (e.mediaType !== "unknown") entry.domType = e.mediaType;
			s.domKeys.add(key);
		} else {
			if (entry.title && X.normTitle(entry.title) !== X.normTitle(e.title)) return quarantine(key);
			entry.title = e.title;
			if (e.mediaType !== "unknown") {
				if (entry.mediaType !== "unknown" && entry.mediaType !== e.mediaType) return quarantine(key);
				entry.mediaType = e.mediaType;
			}
			entry.season ||= e.season;
			entry.parentKnown ||= e.parentKnown;
			if (e.year) entry.year = e.year;
			s.structuredSightings++;
			s.structuredKeys.add(key);
		}
	}

	function noteProfiles(markers) {
		if (!markers.length) return;
		if (s.state === "idle") {
			s.stateMarkers += markers.length;
			s.marker ??= markers[0];
			if (markers.some((m) => m !== s.marker)) s.profileAmbiguous = true;
			return;
		}
		if (!s.marker) s.lateMarker = true;
		else if (markers.some((m) => m !== s.marker)) terminate("terminated_profile", true);
	}

	function acceptCollections(collections) {
		const scopes = [];
		for (const c of collections) {
			if (c.overflow) s.overflow = true;
			if (c.classification !== "watchlist") {
				if (s.otherCollections.length < 200)
					s.otherCollections.push({ path: c.path, classification: c.classification, count: c.items.length, objects: c.objects, paginationKeys: c.pagination.keys, tokens: new Set(c.items.map((i) => i.token).filter(Boolean)) });
				continue;
			}
			scopes.push(c.scope);
			const p = c.pagination;
			// The same page can be embedded twice, or a script re-read after a change.
			// Pagination evidence is part of the fingerprint: a page whose end flag
			// or total changed is a different page, and two pages in one chain
			// withhold complete.
			const sig = X.hash(JSON.stringify([c.chain, p.cursor, p.terminal, p.totalItems, p.nextIndex, c.items.map((i) => i.token || i.gti)]));
			if (s.pageSignatures.has(sig)) {
				s.duplicatePages++;
				continue;
			}
			s.pageSignatures.add(sig);
			if (p.cursor) {
				if (s.cursors.has(p.cursor)) s.cursorRepeats++;
				s.cursors.add(p.cursor);
			}
			s.pages.push({ chain: c.chain, path: c.path, count: c.items.length, terminal: p.terminal, totalItems: p.totalItems, nextIndex: p.nextIndex, paginationKeys: p.keys, at: Date.now() - s.started });
			for (const e of c.items) upsert(e, "structured");
		}
		return scopes;
	}

	/** Filter groups that sit beside a Watchlist collection of the same document. */
	function scopedFilters(groups, scopes) {
		return groups
			.filter((g) => !X.excludedPath(g.path) && scopes.some((scope) => scope.length > 0 && scope.every((k, i) => g.path[i] === k)))
			.map((g) => g.value);
	}

	/** Reads new scripts and scripts whose content changed since last read. */
	function readScripts(all) {
		const elements = all ? [...document.querySelectorAll(SCRIPTS)] : [...document.querySelectorAll(SCRIPTS)].filter((el) => !s.docs.has(el) || s.dirty.has(el));
		s.dirty.clear();
		for (const el of elements) {
			const text = el.textContent || "";
			const hash = X.hash(text);
			const known = s.docs.get(el);
			if (known && known.hash === hash) continue;
			if (known) {
				s.scripts.changed++;
				if (s.state === "capturing") s.stateChanged = true;
			} else {
				s.scripts.count++;
				s.scripts.bytes += text.length;
				if (el.getAttribute("type") === "text/template") s.scripts.template++;
				else s.scripts.json++;
			}
			const holder = document.createElement("div");
			holder.appendChild(el.cloneNode(true));
			const [doc] = X.parseScripts(holder);
			const record = { hash, filters: [] };
			s.docs.set(el, record);
			if (!doc?.json) continue;
			if (!known) s.scripts.parsed++;
			noteProfiles(X.profileMarkers(doc.json));
			if (s.state === "terminated") return;
			const found = X.findCollections(doc.json, location.href);
			s.truncated ||= found.truncated;
			const scopes = acceptCollections(found.collections);
			record.filters = scopedFilters(X.filterEvidence(doc.json), scopes);
			if (known && JSON.stringify(known.filters) !== JSON.stringify(record.filters)) s.filterChanged = true;
		}
	}

	function groupId(el) {
		if (!el) return 0;
		if (!s.groupIds.has(el)) {
			const id = s.nextGroup++;
			s.groupIds.set(el, id);
			const role = el.getAttribute("role");
			s.groups.set(id, {
				el,
				tokens: new Set(),
				tag: ["ul", "ol", "section", "div"].includes(el.tagName.toLowerCase()) ? el.tagName.toLowerCase() : "other",
				role: ["list", "grid", "rowgroup"].includes(role) ? role : role ? "other" : "none",
				labeled: el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby"),
			});
		}
		return s.groupIds.get(el);
	}

	const overlapOf = (tokens) => [...tokens].filter((t) => s.structuredKeys.has(t)).length;

	function readFilterControls() {
		for (const el of document.querySelectorAll(SELECTED)) {
			if (el.closest(OUTSIDE)) continue;
			if (FILTER_WORDS.test((el.textContent || "").trim().replace(/\s+/g, " "))) s.domFiltered++;
		}
	}

	function readCards() {
		// A card can hold several detail links (poster, title, play). Read each
		// card once; links to two different titles make the card unusable.
		const roots = new Map();
		for (const a of document.querySelectorAll(CARD_LINK)) {
			if (a.closest(OUTSIDE)) continue;
			const root = a.closest(CARD_ROOT) || a;
			if (!roots.has(root)) roots.set(root, []);
			roots.get(root).push(a);
		}
		const seen = new Map(); // group id -> cards in this pass, in page order
		for (const [root, links] of roots) {
			const parsed = links.map((a) => X.detailLink(a.getAttribute("href"), location.href));
			if (parsed.some((l) => !l)) {
				bump(s.domRejected, "card_invalid_link");
				if (parsed.every((l) => !l)) continue;
			}
			const tokens = new Set(parsed.filter(Boolean).map((l) => l.token));
			if (tokens.size !== 1) {
				bump(s.domRejected, "card_conflicting_links");
				continue;
			}
			for (const attr of root.getAttributeNames()) if (attr.startsWith("data-")) DATA_ATTRS.has(attr) ? s.cardAttributes.add(attr) : s.otherDataAttributes++;
			const id = groupId(root.parentElement?.closest(GROUP) || null);
			if (!seen.has(id)) seen.set(id, []);
			seen.get(id).push({ links, root, link: parsed.find(Boolean) });
		}
		for (const [id, cards] of seen) {
			const g = s.groups.get(id);
			if (g) for (const c of cards) g.tokens.add(c.link.token);
		}
		const primaryGone = s.primary !== null && !s.groups.get(s.primary)?.el.isConnected;
		if ((s.primary === null || primaryGone) && seen.size) {
			const order = [...seen.keys()];
			const score = (id) => overlapOf(seen.get(id).map((c) => c.link.token));
			const best = order.reduce((b, id) => (score(id) > score(b) ? id : b), order[0]);
			if (s.primary === null) {
				s.primary = best;
				s.primaryBy = score(best) ? "structured_overlap" : order.length > 1 ? "first_of_several_guess" : "only_group";
			} else if (score(best)) {
				s.primary = best;
				s.primaryReplacements = (s.primaryReplacements || 0) + 1;
			}
		}
		const mine = overlapOf(s.groups.get(s.primary)?.tokens || []);
		for (const [id, g] of s.groups) if (id !== s.primary && overlapOf(g.tokens) > mine) s.primaryContested = true;
		for (const { links, root, link } of seen.get(s.primary) || []) {
			s.domSightings++;
			const labels = [...new Set(links.map((a) => a.getAttribute("aria-label")?.trim()).filter(Boolean))];
			// Card-level names first; a link label can be an action ("Play …").
			const title = (
				root.getAttribute("data-card-title") ||
				root.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt") ||
				root.querySelector("h2, h3, h4, [data-testid*='title' i]")?.textContent ||
				(labels.length === 1 ? labels[0] : "") ||
				(links.length === 1 ? links[0].textContent : "") ||
				""
			)
				.trim()
				.replace(/\s+/g, " ");
			if (!X.isText(title)) {
				bump(s.domRejected, "card_missing_title");
				continue;
			}
			const type = X.mediaType(root.getAttribute("data-card-entity-type") || undefined);
			upsert({ gti: null, token: link.token, url: link.url, title, mediaType: type.mediaType, season: type.season, hasLive: false }, "dom");
			if (s.state !== "capturing") return;
		}
	}

	function disconnect() {
		s.observer?.disconnect();
		s.observer = null;
		if (s.interval !== null) clearInterval(s.interval);
		s.interval = null;
		if (s.pending) clearTimeout(s.pending);
		s.pending = null;
	}

	function terminate(code, discard) {
		disconnect();
		s.state = "terminated";
		s.code = code;
		s.stoppedAt = Date.now();
		if (discard) {
			s.entries.clear();
			s.structuredKeys.clear();
			s.domKeys.clear();
			s.discarded = true;
		}
	}

	function scan(all = false) {
		if (s.state !== "capturing") return;
		if (location.origin !== s.origin || !isWatchlist()) return terminate("terminated_navigation", false);
		if (s.domMarker !== null && domMarker() !== s.domMarker) return terminate("terminated_profile", true);
		if (filterKey() !== s.filter) s.filterChanged = true;
		if (Date.now() - s.started >= MAX_TIME) return terminate("limit_time", false);
		readScripts(all);
		if (s.state !== "capturing") return;
		readFilterControls();
		readCards();
	}

	// A collector error must end the capture visibly, never leave it "capturing".
	function safeScan(all = false) {
		try {
			scan(all);
		} catch {
			if (s.state === "capturing") terminate("collector_error", false);
		}
	}

	/** The in-extension gate. Reasons are fixed codes; no titles or IDs. */
	function evaluate() {
		const partial = [];
		const unknown = [];
		if (s.state === "terminated") partial.push(s.code);
		if (!s.pages.length) unknown.push("no_structured_watchlist");
		const chains = new Map();
		for (const p of s.pages) chains.set(p.chain, [...(chains.get(p.chain) || []), p]);
		if (chains.size > 1) unknown.push("several_watchlist_chains");
		for (const pages of chains.values()) {
			// Without network responses, a chain is one page from the page data.
			if (pages.length > 1) partial.push("several_chain_starts");
			const last = pages[pages.length - 1];
			if (last.terminal === "conflict") partial.push("pagination_contradiction");
			else if (last.terminal === false) partial.push("continuation_pending");
			else if (last.terminal === null) unknown.push("no_terminal_evidence");
			// An explicit end without a reported total can't show the count is whole.
			else if (last.totalItems === null) unknown.push("no_reported_total");
		}
		if (s.cursorRepeats) partial.push("cursor_repeated");
		const totals = [...new Set(s.pages.map((p) => p.totalItems).filter((t) => t !== null))];
		if (totals.length > 1) partial.push("total_changed");
		// Live entries count toward a reported total but stay out of the file.
		if (totals.length === 1 && totals[0] !== s.structuredKeys.size + s.liveExcluded) partial.push("total_mismatch");
		const domOnly = [...s.domKeys].filter((k) => !s.structuredKeys.has(k)).length;
		const structuredOnly = [...s.structuredKeys].filter((k) => !s.domKeys.has(k)).length;
		if (s.pages.length && domOnly) partial.push("visible_not_in_structured");
		if (structuredOnly) partial.push("structured_not_seen_visible");
		if (!s.domKeys.size) unknown.push("no_visible_cards");
		if (s.primaryBy === "first_of_several_guess") unknown.push("visible_group_guessed");
		if (s.primaryContested) partial.push("visible_group_contested");
		if (s.primary !== null && !overlapOf(s.groups.get(s.primary)?.tokens || [])) unknown.push("visible_group_unconfirmed");
		if (s.quarantined.size) partial.push("conflicting_identity");
		let titles = 0;
		let types = 0;
		for (const e of s.entries.values()) {
			if (e.title && e.domTitle && X.normTitle(e.title) !== X.normTitle(e.domTitle)) titles++;
			if (e.mediaType !== "unknown" && e.domType !== "unknown" && e.mediaType !== e.domType) types++;
		}
		s.titleDisagreements = titles;
		s.typeDisagreements = types;
		if (titles) partial.push("channel_title_disagreement");
		if (types) partial.push("channel_type_disagreement");
		if (s.filterChanged) partial.push("filter_changed");
		const filters = [...s.docs.values()].flatMap((d) => d.filters);
		if (s.filter !== "" || s.domFiltered || filters.some((f) => f !== "all")) partial.push("filtered_view");
		else if (!filters.includes("all")) unknown.push("all_view_unconfirmed");
		if (s.truncated) partial.push("state_truncated");
		if (s.overflow) partial.push("collection_overflow");
		if (s.profileAmbiguous) unknown.push("profile_ambiguous");
		if (s.markerSource === "none") unknown.push("profile_unconfirmed");
		const p = [...new Set(partial)];
		const u = [...new Set(unknown)];
		return { completeness: p.length ? "partial" : u.length ? "unknown" : "complete", partial: p, unknown: u, domOnly, structuredOnly, totals, filters };
	}

	/** The file holds page-data Watchlist entries only. */
	const member = (e) => s.structuredKeys.has(e.key) && !s.quarantined.has(e.key);

	function items() {
		const out = [];
		for (const e of s.entries.values()) {
			if (!member(e) || !X.isText(e.title)) continue;
			const mediaType = e.mediaType !== "unknown" ? e.mediaType : e.domType;
			out.push({ title: e.title, mediaType, ...(e.year ? { year: e.year } : {}), sourceId: e.gti || e.key, ...(e.url ? { sourceUrl: e.url } : {}) });
		}
		return out;
	}

	/*
	 * The report is assembled from fixed field names, numbers, booleans,
	 * fixed codes and report-vocabulary words only. A final pass replaces any
	 * other string, so nothing from the page can reach it by accident.
	 */
	const FIXED = new Set([
		...REASONS, "goodwatch-prime-capture-report", "complete", "partial", "unknown", "capturing", "stopped", "cancelled", "terminated", "idle",
		"state", "dom", "state+dom", "none", "all", "filtered", "conflict", "watchlist", "excluded", "unclassified",
		"structured_overlap", "first_of_several_guess", "only_group", "ul", "ol", "section", "div", "other", "list", "grid", "rowgroup",
		"<key>", "<seg>", "<value>", "<other>", ...DATA_ATTRS,
		"Counts, fixed codes and report-vocabulary words only. No titles, IDs, cursors or profile values.",
	]);
	const PIECES = new Set([...X.KEYS, "[]", "<key>", "<seg>", "<value>", "", "region", "eu", "na", "fe", "gp", "video", "mystuff", "my-stuff", "api", "detail", "storefront", "movie", "movies", "tv", "all", "v1", "v2", "v3", "web", "lib"]);
	const REPORT_KEYS = new Set(
		(
			"format collectorVersion note browser host lang pathPattern filter filterChanged stateChanged filterEvidence watchlistFilters domFilteredControls elapsedSeconds stop " +
			"profileGuard profileMarkersInState profileMarkerLate completeness partialReasons unknownReasons counts fileItems structuredUnique visibleUnique inBoth " +
			"visibleOnly structuredOnly visibleSightings structuredSightings quarantined titleDisagreements typeDisagreements typeFromCards " +
			"sameTitleDistinctIds liveExcluded withGti withDetailToken withoutDetailLink tokenAsinLike movies shows seasons seasonsWithParent unknownType withYear " +
			"rejectedCardSightings pagination chains pages chain path count terminal totalItems nextIndex paginationKeys atSeconds reportedTotals " +
			"distinctCursors cursorRepeats duplicatePages otherCollections classification objects overlapWithVisible primaryGroupChosenBy primaryReplacements " +
			"cardGroups index tag role labeled cards overlap primary cardAttributes otherDataAttributes scripts parsed template json bytes changed responsesRead"
		).split(" "),
	);
	const allowedString = (v, field) => {
		if (FIXED.has(v)) return true;
		if (field === "host") return /^www\.(primevideo\.com|amazon\.[a-z]{2,3}(\.[a-z]{2})?)$/.test(v);
		if (field === "lang") return /^[a-z]{2}(-[a-z]{2})?$/i.test(v);
		if (field === "browser") return /^(Chrome|Edg|Firefox) \d{1,3}$/.test(v);
		if (field === "collectorVersion") return v === VERSION;
		return v.split(/[./?=&]/).every((piece) => PIECES.has(piece));
	};
	function sanitize(value, field = "") {
		if (typeof value === "string") return allowedString(value, field) ? value : "<other>";
		if (typeof value === "number") return Number.isFinite(value) ? value : 0;
		if (typeof value === "boolean" || value === null) return value;
		if (Array.isArray(value)) return value.slice(0, 500).map((v) => sanitize(v, field));
		if (value && typeof value === "object") {
			const out = {};
			for (const [k, v] of Object.entries(value)) out[REPORT_KEYS.has(k) || PIECES.has(k) || REASONS.has(k) || /^card_(invalid_link|conflicting_links|missing_title)$/.test(k) ? k : "<key>"] = sanitize(v, k);
			return out;
		}
		return null;
	}

	function report(gate) {
		const list = [...s.entries.values()];
		const fileItems = items();
		const titles = new Map();
		for (const i of fileItems) titles.set(X.normTitle(i.title).toLowerCase(), (titles.get(X.normTitle(i.title).toLowerCase()) || 0) + 1);
		const domTokens = new Set(s.domKeys);
		return sanitize({
			format: "goodwatch-prime-capture-report",
			collectorVersion: VERSION,
			note: "Counts, fixed codes and report-vocabulary words only. No titles, IDs, cursors or profile values.",
			browser: (navigator.userAgent.match(/(Chrome|Edg|Firefox)\/(\d+)/) || []).slice(1).join(" ") || "other",
			host: s.origin.replace(/^https:\/\//, ""),
			lang: s.lang || "none",
			pathPattern: s.pathPattern,
			filter: s.filter,
			filterChanged: s.filterChanged,
			stateChanged: Boolean(s.stateChanged),
			watchlistFilters: gate.filters,
			domFilteredControls: s.domFiltered,
			responsesRead: 0,
			elapsedSeconds: Math.round(((s.stoppedAt || Date.now()) - s.started) / 1000),
			stop: REASONS.has(s.code) || FIXED.has(s.code) ? s.code : "other",
			profileGuard: s.markerSource,
			profileMarkersInState: s.stateMarkers,
			profileMarkerLate: s.lateMarker,
			completeness: gate.completeness,
			partialReasons: gate.partial,
			unknownReasons: gate.unknown,
			counts: {
				fileItems: fileItems.length,
				structuredUnique: s.structuredKeys.size,
				visibleUnique: s.domKeys.size,
				inBoth: [...s.domKeys].filter((k) => s.structuredKeys.has(k)).length,
				visibleOnly: gate.domOnly,
				structuredOnly: gate.structuredOnly,
				visibleSightings: s.domSightings,
				structuredSightings: s.structuredSightings,
				quarantined: s.quarantined.size,
				titleDisagreements: s.titleDisagreements,
				typeDisagreements: s.typeDisagreements,
				typeFromCards: list.filter((e) => member(e) && e.mediaType === "unknown" && e.domType !== "unknown").length,
				sameTitleDistinctIds: [...titles.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
				liveExcluded: s.liveExcluded,
				withGti: list.filter((e) => e.gti && member(e)).length,
				withDetailToken: list.filter((e) => !e.key.startsWith("gti:") && member(e)).length,
				withoutDetailLink: list.filter((e) => !e.url && member(e)).length,
				tokenAsinLike: list.filter((e) => /^B0[A-Z0-9]{8}$/.test(e.key) && member(e)).length,
				movies: fileItems.filter((i) => i.mediaType === "movie").length,
				shows: fileItems.filter((i) => i.mediaType === "show").length,
				seasons: list.filter((e) => e.season && member(e)).length,
				seasonsWithParent: list.filter((e) => e.season && e.parentKnown && member(e)).length,
				unknownType: fileItems.filter((i) => i.mediaType === "unknown").length,
				withYear: fileItems.filter((i) => i.year).length,
				rejectedCardSightings: Object.fromEntries(s.domRejected),
			},
			pagination: {
				chains: new Set(s.pages.map((p) => p.chain)).size,
				pages: s.pages.map((p) => ({ chain: p.chain, path: p.path, count: p.count, terminal: p.terminal, totalItems: p.totalItems, nextIndex: p.nextIndex, paginationKeys: p.paginationKeys, atSeconds: Math.round(p.at / 1000) })),
				reportedTotals: gate.totals,
				distinctCursors: s.cursors.size,
				cursorRepeats: s.cursorRepeats,
				duplicatePages: s.duplicatePages,
			},
			otherCollections: s.otherCollections.map(({ tokens, ...c }) => ({ ...c, overlapWithVisible: [...tokens].filter((t) => domTokens.has(t)).length })),
			primaryGroupChosenBy: s.primaryBy || "none",
			primaryReplacements: s.primaryReplacements || 0,
			cardGroups: [...s.groups]
				.slice(0, 30)
				.map(([id, g], index) => ({ index, tag: g.tag, role: g.role, labeled: g.labeled, cards: g.tokens.size, overlap: overlapOf(g.tokens), primary: id === s.primary })),
			cardAttributes: [...s.cardAttributes].sort(),
			otherDataAttributes: s.otherDataAttributes,
			scripts: { ...s.scripts, bytes: Math.round(s.scripts.bytes / 1024) },
		});
	}

	const KEEP = new Set(["capturing", "stopped", "terminated"]);

	function result(withReport) {
		const gate = evaluate();
		const keep = KEEP.has(s.state) && !s.discarded;
		const fileItems = keep ? items() : [];
		return {
			state: s.state,
			code: s.code,
			version: VERSION,
			profileGuard: s.markerSource,
			counts: { items: fileItems.length, structured: s.structuredKeys.size, visible: s.domKeys.size, inBoth: [...s.domKeys].filter((k) => s.structuredKeys.has(k)).length, pages: s.pages.length },
			completeness: gate.completeness,
			reasons: [...gate.partial, ...gate.unknown],
			...(keep ? { envelope: { format: "goodwatch-wishlist", version: 1, source: "prime-video", exportedAt: new Date().toISOString(), completeness: gate.completeness, items: fileItems } } : {}),
			...(withReport && s.state !== "idle" && s.state !== "cancelled" ? { report: report(gate) } : {}),
		};
	}

	globalThis.__goodwatchPrimeCommand = (command) => {
		const action = command?.action;
		if (!["start", "status", "stop", "cancel"].includes(action)) return { ...result(false), code: "invalid_command" };
		if (action === "start") {
			if (s.state === "capturing") {
				safeScan();
				return result(false);
			}
			disconnect();
			s = fresh();
			// Validate before installing anything.
			if (!isWatchlist()) return { ...result(false), code: "wrong_page" };
			s.origin = location.origin;
			s.lang = (document.documentElement.getAttribute("lang") || "").slice(0, 20);
			s.filter = filterKey();
			s.pathPattern = X.redactPath(location.pathname);
			s.started = Date.now();
			readScripts(true);
			s.domMarker = domMarker();
			s.markerSource = s.marker && !s.profileAmbiguous ? (s.domMarker ? "state+dom" : "state") : s.domMarker ? "dom" : "none";
			s.state = "capturing";
			s.code = "capturing";
			// Mutations come in bursts while the grid renders; scan at most every
			// 100 ms. A change inside a state script marks it for re-reading.
			s.observer = new MutationObserver((records) => {
				for (const r of records) {
					const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
					const script = node?.closest?.(SCRIPTS);
					if (script) s.dirty.add(script);
				}
				if (s.pending) return;
				s.pending = setTimeout(() => {
					s.pending = null;
					safeScan();
				}, 100);
			});
			s.observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: ["href", "aria-label", "data-card-title", "alt", "aria-selected", "aria-pressed", "aria-checked", "aria-current", "selected"],
			});
			s.interval = setInterval(safeScan, 500);
			safeScan();
			return result(false);
		}
		if (action === "cancel") {
			disconnect();
			s = fresh();
			s.state = "cancelled";
			s.code = "cancelled";
			return result(false);
		}
		// Stop re-reads every script in full, in case a change was missed.
		safeScan(action === "stop");
		if (action === "stop" && s.state === "capturing") {
			disconnect();
			s.state = "stopped";
			s.code = "stopped";
			s.stoppedAt = Date.now();
		}
		return result(action === "stop" || command.report === true);
	};
})();
