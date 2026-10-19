/*
 * Experimental Prime Video Watchlist collector (isolated world).
 *
 * Two independent membership channels:
 *  - page data: Watchlist collections in the page's inert hydration scripts,
 *    plus validated, reduced copies of the page's own list responses posted
 *    by observer.js;
 *  - cards: continuous accumulation of title cards in one Watchlist grid,
 *    identified by element, not by attributes.
 * The file says "complete" only when every Watchlist page chain is connected
 * and ends explicitly, both channels agree exactly, the All view and the
 * profile are positively confirmed, and nothing conflicts. Cards that can't
 * be tied to the Watchlist never enter the file.
 */
(() => {
	if (globalThis.__goodwatchPrimeCommand) return;
	const X = globalThis.__goodwatchPrimeExtract;
	const VERSION = "0.2.0";
	const MAX_ITEMS = 5000;
	const MAX_TIME = 15 * 60 * 1000;
	const MAX_MESSAGES = 1000;
	const MAX_LOGGED_RESPONSES = 100;
	const CARD_LINK = 'a[href*="/detail/"]';
	const CARD_ROOT = '[data-card-title], [data-testid="card"], article, li';
	const GROUP = 'ul, ol, [role="list"], [role="grid"], [role="rowgroup"], section';
	const OUTSIDE = 'header, nav, footer, [role="dialog"], [aria-modal="true"], [role="banner"], [role="navigation"]';
	const PROFILE = '[data-testid*="profile" i], [aria-label*="profile" i], [aria-label*="profil" i]';
	const SELECTED = '[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], [aria-current="true"], [aria-current="page"]';
	// Filter control words, for the DOM evidence of the All view.
	const ALL_WORDS = /^(all|alle|alles|tout|tous|todo|todos|tutti|tudo|allemaal)$/i;
	const FILTER_WORDS = /^(movies?|films?|filme|tv|tv shows?|shows?|series|serien|séries|películas|serie tv|tv-serien|tv-sendungen|filmes)$/i;
	const DATA_ATTRS = new Set(["data-card-title", "data-card-entity-type", "data-testid", "data-card-id", "data-asin", "data-gti", "data-automation-id", "data-card-type"]);

	const REASONS = new Set([
		"terminated_navigation", "terminated_profile", "limit_items", "limit_time", "collector_error",
		"no_structured_watchlist", "no_terminal_evidence", "continuation_pending", "continuation_after_end", "pagination_contradiction",
		"chain_gap", "chain_start_unobserved", "several_chain_starts", "several_watchlist_chains", "index_mismatch", "cursor_repeated",
		"total_changed", "total_mismatch", "visible_not_in_structured", "structured_not_seen_visible", "no_visible_cards",
		"visible_group_guessed", "visible_group_contested", "visible_group_unconfirmed", "conflicting_identity",
		"channel_title_disagreement", "channel_type_disagreement", "unknown_response_schema", "filter_changed", "filtered_view",
		"all_view_unconfirmed", "state_truncated", "collection_overflow", "profile_unconfirmed", "profile_ambiguous", "messages_dropped",
	]);

	let s = fresh();

	function fresh() {
		return {
			state: "idle",
			code: "idle",
			nonce: null,
			origin: "",
			lang: "",
			filter: "",
			pathPattern: "",
			started: 0,
			stoppedAt: 0,
			observer: null,
			interval: null,
			pending: null,
			listener: null,
			marker: null,
			markerSource: "none",
			stateMarkers: 0,
			lateMarker: false,
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
			typeFromCards: 0,
			liveExcluded: 0,
			groupIds: new WeakMap(), // element -> id
			groups: new Map(), // id -> { el, tokens, tag, role, labeled }
			nextGroup: 1,
			primary: null,
			primaryBy: null,
			primaryReplacements: 0,
			confirmedGroups: new Set(),
			primaryContested: false,
			seenScripts: new WeakSet(),
			scripts: { count: 0, parsed: 0, template: 0, json: 0, bytes: 0 },
			pages: [],
			otherCollections: [],
			pageSignatures: new Set(),
			duplicatePages: 0,
			cursors: new Map(), // cursor -> page signature
			cursorRepeats: 0,
			responses: [],
			messages: 0,
			droppedMessages: 0,
			unparsedListResponses: 0,
			filterEvidence: { all: 0, filtered: 0, none: 0, domAll: 0, domFiltered: 0 },
			filterChanged: false,
			truncated: false,
			overflow: false,
			cardAttributes: new Set(),
			otherDataAttributes: 0,
			discarded: false,
		};
	}

	const isWatchlist = () =>
		/(^|\.)(primevideo\.com|amazon\.[a-z.]{2,12})$/.test(location.hostname) && /\/watchlist(\/|$)/i.test(location.pathname);

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

	function upsert(e, channel, groupId) {
		if (e.hasLive) {
			s.liveExcluded++;
			return;
		}
		const key = keyFor(e);
		if (!key || s.quarantined.has(key)) return;
		// A structured entity can name the GTI of an earlier link-less one.
		if (e.gti && e.token && s.entries.has(`gti:${e.gti}`) && !s.entries.has(e.token)) {
			const moved = s.entries.get(`gti:${e.gti}`);
			s.entries.delete(`gti:${e.gti}`);
			moved.key = e.token;
			s.entries.set(e.token, moved);
			for (const set of [s.structuredKeys, s.domKeys]) if (set.delete(`gti:${e.gti}`)) set.add(e.token);
		}
		if (e.gti) s.aliases.set(e.gti, key);
		let entry = s.entries.get(key);
		if (!entry) {
			if (s.entries.size >= MAX_ITEMS) return terminate("limit_items", false);
			entry = { key, gti: null, url: null, title: null, domTitle: null, mediaType: "unknown", domType: "unknown", season: false, groupIds: new Set() };
			s.entries.set(key, entry);
		}
		if (e.gti && entry.gti && entry.gti !== e.gti) return quarantine(key);
		entry.gti ||= e.gti;
		entry.url ||= e.url;
		if (channel === "dom") {
			if (entry.domTitle && X.normTitle(entry.domTitle) !== X.normTitle(e.title)) return quarantine(key);
			entry.domTitle = e.title;
			if (e.mediaType !== "unknown") entry.domType = e.mediaType;
			entry.groupIds.add(groupId);
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

	function noteFilters(groups) {
		for (const g of groups) if (g in s.filterEvidence) s.filterEvidence[g]++;
	}

	function noteProfiles(markers, origin) {
		if (!markers.length) return;
		if (s.state === "idle") {
			// Start: the hydration state names the profile.
			s.stateMarkers += markers.length;
			s.marker ??= markers[0];
			if (markers.some((m) => m !== s.marker)) s.profileAmbiguous = true;
			return;
		}
		if (!s.marker) {
			s.lateMarker = true;
			return;
		}
		if (markers.some((m) => m !== s.marker)) terminate("terminated_profile", true);
		void origin;
	}

	function acceptCollections(collections, origin, requestKeys) {
		for (const c of collections) {
			if (s.state !== "capturing" && s.state !== "idle") return;
			if (c.overflow) s.overflow = true;
			if (c.classification !== "watchlist") {
				if (s.otherCollections.length < 200)
					s.otherCollections.push({
						origin,
						path: c.path,
						classification: c.classification,
						count: c.items.length,
						objects: c.objects,
						paginationKeys: c.pagination.keys,
						tokens: new Set(c.items.map((i) => i.token).filter(Boolean)),
					});
				continue;
			}
			const p = c.pagination;
			// A retried request returns the same page again; that isn't a loop.
			const sig = X.hash(JSON.stringify([c.chain, p.cursor, c.items.map((i) => i.token || i.gti)]));
			if (s.pageSignatures.has(sig)) {
				s.duplicatePages++;
				continue;
			}
			s.pageSignatures.add(sig);
			if (p.cursor) {
				if (s.cursors.has(p.cursor)) s.cursorRepeats++;
				s.cursors.set(p.cursor, sig);
			}
			s.pages.push({
				origin,
				chain: c.chain,
				path: c.path,
				count: c.items.length,
				terminal: p.terminal,
				totalItems: p.totalItems,
				nextIndex: p.nextIndex,
				strong: p.strong,
				requestKeys: requestKeys || [],
				paginationKeys: p.keys,
				at: Date.now() - s.started,
			});
			for (const e of c.items) upsert(e, "structured");
		}
	}

	function readScripts() {
		for (const el of document.querySelectorAll('script[type="text/template"], script[type="application/json"]')) {
			if (s.seenScripts.has(el)) continue;
			s.seenScripts.add(el);
			const holder = document.createElement("div");
			holder.appendChild(el.cloneNode(true));
			const [doc] = X.parseScripts(holder);
			if (!doc) continue;
			s.scripts.count++;
			s.scripts.bytes += doc.size;
			if (doc.type === "text/template") s.scripts.template++;
			else s.scripts.json++;
			if (!doc.json) continue;
			s.scripts.parsed++;
			noteProfiles(X.profileMarkers(doc.json), "state");
			if (s.state === "terminated") return;
			noteFilters(X.filterEvidence(doc.json));
			const found = X.findCollections(doc.json, location.href);
			s.truncated ||= found.truncated;
			acceptCollections(found.collections, "state", null);
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
			const text = (el.textContent || "").trim().replace(/\s+/g, " ");
			if (ALL_WORDS.test(text)) s.filterEvidence.domAll++;
			else if (FILTER_WORDS.test(text)) s.filterEvidence.domFiltered++;
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
			for (const attr of root.getAttributeNames())
				if (attr.startsWith("data-")) DATA_ATTRS.has(attr) ? s.cardAttributes.add(attr) : s.otherDataAttributes++;
			const id = groupId(root.parentElement?.closest(GROUP) || null);
			if (!seen.has(id)) seen.set(id, []);
			seen.get(id).push({ links, root, link: parsed.find(Boolean) });
		}
		for (const [id, cards] of seen) {
			const g = s.groups.get(id);
			if (g) for (const c of cards) g.tokens.add(c.link.token);
		}
		for (const [id, g] of s.groups) if (overlapOf(g.tokens)) s.confirmedGroups.add(id);
		const primaryGone = s.primary !== null && !s.groups.get(s.primary)?.el.isConnected;
		if ((s.primary === null || primaryGone) && seen.size) {
			const order = [...seen.keys()];
			const best = order.reduce((b, id) => (overlapOf(seen.get(id).map((c) => c.link.token)) > overlapOf(seen.get(b).map((c) => c.link.token)) ? id : b), order[0]);
			const confirmed = overlapOf(seen.get(best).map((c) => c.link.token)) > 0;
			if (s.primary === null) {
				s.primary = best;
				s.primaryBy = confirmed ? "structured_overlap" : order.length > 1 ? "first_of_several_guess" : "only_group";
			} else if (confirmed) {
				// The grid element was replaced; take its successor only when the
				// successor is tied to the page data too.
				s.primary = best;
				s.primaryReplacements++;
			}
		}
		const mine = overlapOf(s.groups.get(s.primary)?.tokens || []);
		for (const [id, g] of s.groups) if (id !== s.primary && overlapOf(g.tokens) > mine) s.primaryContested = true;
		const cards = seen.get(s.primary) || [];
		for (const { links, root, link } of cards) {
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
			upsert({ gti: null, token: link.token, url: link.url, title, mediaType: type.mediaType, season: type.season, hasLive: false }, "dom", s.primary);
			if (s.state !== "capturing") return;
		}
	}

	function validMessage(m) {
		if (!m || typeof m !== "object" || m.kind !== "response") return null;
		return {
			path: X.redactPath(m.path),
			status: X.int(m.status, 999),
			parsed: m.parsed === true,
			tooLarge: m.tooLarge === true,
			truncated: m.truncated === true,
			requestKeys: X.hexList(m.requestKeys),
			collections: Array.isArray(m.collections) ? m.collections.slice(0, 50).map((c) => X.validCollection(c, location.href)).filter(Boolean) : [],
			profiles: X.hexList(m.profiles, 5),
			filters: Array.isArray(m.filters) ? m.filters.filter((f) => ["all", "filtered", "none"].includes(f)).slice(0, 20) : [],
			shape: m.shape === undefined ? null : X.validShape(m.shape),
		};
	}

	function onMessage(event) {
		// Only this origin, only with the per-capture code. The page can still
		// forge messages, so every field is validated and bounded.
		if (event.origin !== location.origin || !event.data || event.data.goodwatchPrime !== s.nonce || s.state !== "capturing") return;
		if (++s.messages > MAX_MESSAGES) {
			s.droppedMessages++;
			return;
		}
		const m = validMessage(event.data.message);
		if (!m) return;
		const watch = m.collections.filter((c) => c.classification === "watchlist");
		if (s.responses.length < MAX_LOGGED_RESPONSES)
			s.responses.push({ path: m.path, status: m.status, parsed: m.parsed, tooLarge: m.tooLarge, collections: m.collections.length, watchlist: watch.length, shape: m.shape });
		if (/watchlist/i.test(m.path) && (!m.parsed || !m.collections.length)) s.unparsedListResponses++;
		s.truncated ||= m.truncated;
		try {
			noteProfiles(m.profiles, "response");
			if (s.state !== "capturing") return;
			noteFilters(m.filters);
			acceptCollections(m.collections, "response", m.requestKeys);
		} catch {
			terminate("collector_error", false);
			return;
		}
		safeScan();
	}

	function disconnect() {
		s.observer?.disconnect();
		s.observer = null;
		if (s.interval !== null) clearInterval(s.interval);
		s.interval = null;
		if (s.pending) clearTimeout(s.pending);
		s.pending = null;
		if (s.listener) window.removeEventListener("message", s.listener);
		s.listener = null;
		// Ends page-world observation on every exit path.
		if (s.nonce) window.postMessage({ goodwatchPrimeControl: s.nonce, action: "deactivate" }, location.origin);
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

	function scan() {
		if (s.state !== "capturing") return;
		if (location.origin !== s.origin || !isWatchlist()) return terminate("terminated_navigation", false);
		if (s.domMarker !== null && domMarker() !== s.domMarker) return terminate("terminated_profile", true);
		if (filterKey() !== s.filter) s.filterChanged = true;
		if (Date.now() - s.started >= MAX_TIME) return terminate("limit_time", false);
		readScripts();
		if (s.state !== "capturing") return;
		readFilterControls();
		readCards();
	}

	// A collector error must end the capture visibly, never leave it "capturing".
	function safeScan() {
		try {
			scan();
		} catch {
			if (s.state === "capturing") terminate("collector_error", false);
		}
	}

	/** Pagination chains: connected, ending explicitly, counts consistent. */
	function chainReasons(partial, unknown) {
		const chains = new Map();
		for (const p of s.pages) chains.set(p.chain, [...(chains.get(p.chain) || []), p]);
		if (chains.size > 1) unknown.push("several_watchlist_chains");
		for (const pages of chains.values()) {
			let cumulative = 0;
			pages.forEach((p, i) => {
				if (i === 0) {
					p.link = "start";
					if (p.origin !== "state") unknown.push("chain_start_unobserved");
				} else {
					const prev = pages[i - 1];
					if (p.origin === "state") {
						p.link = "none";
						partial.push("several_chain_starts");
					} else if (prev.strong.some((k) => p.requestKeys.includes(k))) p.link = "cursor";
					else if (prev.nextIndex !== null && cumulative === prev.nextIndex && p.requestKeys.includes(X.hash(`v:${prev.nextIndex}`))) p.link = "index";
					else {
						p.link = "none";
						partial.push("chain_gap");
					}
					if (prev.terminal === true) partial.push("continuation_after_end");
					if (prev.terminal === "conflict") partial.push("pagination_contradiction");
				}
				cumulative += p.count;
				if (p.nextIndex !== null && p.terminal !== true && cumulative !== p.nextIndex) partial.push("index_mismatch");
			});
			const last = pages[pages.length - 1];
			if (last.terminal === "conflict") partial.push("pagination_contradiction");
			else if (last.terminal === false) partial.push("continuation_pending");
			else if (last.terminal === null) unknown.push("no_terminal_evidence");
		}
	}

	/** The in-extension gate. Reasons are fixed codes; no titles or IDs. */
	function evaluate() {
		const partial = [];
		const unknown = [];
		if (s.state === "terminated") partial.push(s.code);
		if (!s.pages.length) unknown.push("no_structured_watchlist");
		else chainReasons(partial, unknown);
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
		if (s.primary !== null && !s.confirmedGroups.has(s.primary)) unknown.push("visible_group_unconfirmed");
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
		if (s.unparsedListResponses) unknown.push("unknown_response_schema");
		if (s.filterChanged) partial.push("filter_changed");
		const f = s.filterEvidence;
		if (s.filter !== "" || f.filtered || f.domFiltered) partial.push("filtered_view");
		else if (!f.all && !f.domAll) unknown.push("all_view_unconfirmed");
		if (s.truncated) partial.push("state_truncated");
		if (s.overflow) partial.push("collection_overflow");
		if (s.droppedMessages) partial.push("messages_dropped");
		if (s.profileAmbiguous) unknown.push("profile_ambiguous");
		if (s.markerSource === "none") unknown.push("profile_unconfirmed");
		const uniq = (a) => [...new Set(a)];
		const p = uniq(partial);
		const u = uniq(unknown);
		return { completeness: p.length ? "partial" : u.length ? "unknown" : "complete", partial: p, unknown: u, domOnly, structuredOnly, totals };
	}

	/** Members only: page-data Watchlist items, or cards in a grid tied to it. */
	function member(e) {
		if (s.quarantined.has(e.key)) return false;
		if (s.structuredKeys.has(e.key)) return true;
		return s.domKeys.has(e.key) && [...e.groupIds].some((id) => s.confirmedGroups.has(id));
	}

	function items() {
		const out = [];
		for (const e of s.entries.values()) {
			if (!member(e)) continue;
			const title = e.title || e.domTitle;
			if (!X.isText(title)) continue;
			const mediaType = e.mediaType !== "unknown" ? e.mediaType : e.domType;
			out.push({
				title,
				mediaType,
				...(e.year ? { year: e.year } : {}),
				sourceId: e.gti || e.key,
				...(e.url ? { sourceUrl: e.url } : {}),
			});
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
		"state", "dom", "state+dom", "none", "response", "start", "cursor", "index", "conflict", "watchlist", "excluded", "unclassified",
		"structured_overlap", "first_of_several_guess", "only_group", "ul", "ol", "section", "div", "other", "list", "grid", "rowgroup",
		"string", "number", "boolean", "null", "{…}", "…", "<key>", "<seg>", "<value>", "<other>",
		...DATA_ATTRS, "Counts, fixed codes and report-vocabulary words only. No titles, IDs, cursors or profile values.",
	]);
	const PIECES = new Set([...X.KEYS, "[]", "<key>", "<seg>", "<value>", "", "region", "eu", "na", "fe", "gp", "video", "mystuff", "my-stuff", "api", "detail", "storefront", "movie", "movies", "tv", "all", "getDataByTransform", "paginateCollection", "getLandingPage", "getPage", "v1", "v2", "v3", "web", "lib"]);
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
	// Every field name the report itself uses. Shape keys come from the vocabulary.
	const REPORT_KEYS = new Set(
		(
			"format collectorVersion note browser host lang pathPattern filter filterChanged filterEvidence all filtered none domAll domFiltered elapsedSeconds stop " +
			"profileGuard profileMarkersInState profileMarkerLate completeness partialReasons unknownReasons counts fileItems structuredUnique visibleUnique inBoth " +
			"visibleOnly structuredOnly visibleUnresolved visibleSightings structuredSightings quarantined titleDisagreements typeDisagreements typeFromCards " +
			"sameTitleDistinctIds liveExcluded withGti withDetailToken withoutDetailLink tokenAsinLike movies shows seasons seasonsWithParent unknownType withYear " +
			"rejectedCardSightings pagination chains pages origin chain path count terminal link totalItems nextIndex paginationKeys atSeconds reportedTotals " +
			"distinctCursors cursorRepeats duplicatePages responses status parsed tooLarge collections watchlist shape responseMessages droppedMessages " +
			"otherCollections classification objects overlapWithVisible primaryGroupChosenBy primaryReplacements cardGroups index tag role labeled cards overlap " +
			"primary confirmed cardAttributes otherDataAttributes scripts parsed template json bytes"
		).split(" "),
	);

	function report(gate) {
		const list = [...s.entries.values()];
		const fileItems = items();
		const titles = new Map();
		for (const i of fileItems) titles.set(X.normTitle(i.title).toLowerCase(), (titles.get(X.normTitle(i.title).toLowerCase()) || 0) + 1);
		const domTokens = new Set(s.domKeys);
		const host = s.origin.replace(/^https:\/\//, "");
		return sanitize({
			format: "goodwatch-prime-capture-report",
			collectorVersion: VERSION,
			note: "Counts, fixed codes and report-vocabulary words only. No titles, IDs, cursors or profile values.",
			browser: (navigator.userAgent.match(/(Chrome|Edg|Firefox)\/(\d+)/) || []).slice(1).join(" ") || "other",
			host,
			lang: s.lang || "none",
			pathPattern: s.pathPattern,
			filter: s.filter,
			filterChanged: s.filterChanged,
			filterEvidence: { ...s.filterEvidence },
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
				visibleUnresolved: list.filter((e) => s.domKeys.has(e.key) && !member(e)).length,
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
				pages: s.pages.map((p) => ({
					origin: p.origin,
					chain: p.chain,
					path: p.path,
					count: p.count,
					terminal: p.terminal,
					link: p.link || "none",
					totalItems: p.totalItems,
					nextIndex: p.nextIndex,
					paginationKeys: p.paginationKeys,
					atSeconds: Math.round(p.at / 1000),
				})),
				reportedTotals: gate.totals,
				distinctCursors: s.cursors.size,
				cursorRepeats: s.cursorRepeats,
				duplicatePages: s.duplicatePages,
			},
			responses: s.responses,
			responseMessages: Math.min(s.messages, MAX_MESSAGES),
			droppedMessages: s.droppedMessages,
			otherCollections: s.otherCollections.map(({ tokens, ...c }) => ({ ...c, overlapWithVisible: [...tokens].filter((t) => domTokens.has(t)).length })),
			primaryGroupChosenBy: s.primaryBy || "none",
			primaryReplacements: s.primaryReplacements,
			cardGroups: [...s.groups]
				.slice(0, 30)
				.map(([id, g], index) => ({ index, tag: g.tag, role: g.role, labeled: g.labeled, cards: g.tokens.size, overlap: overlapOf(g.tokens), primary: id === s.primary, confirmed: s.confirmedGroups.has(id) })),
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
			counts: {
				items: fileItems.length,
				structured: s.structuredKeys.size,
				visible: s.domKeys.size,
				inBoth: [...s.domKeys].filter((k) => s.structuredKeys.has(k)).length,
				pages: s.pages.length,
			},
			completeness: gate.completeness,
			reasons: [...gate.partial, ...gate.unknown],
			...(keep
				? { envelope: { format: "goodwatch-wishlist", version: 1, source: "prime-video", exportedAt: new Date().toISOString(), completeness: gate.completeness, items: fileItems } }
				: {}),
			...(withReport && s.state !== "idle" && s.state !== "cancelled" ? { report: report(gate) } : {}),
		};
	}

	globalThis.__goodwatchPrimeCommand = (command) => {
		const action = command?.action;
		if (!["start", "status", "stop", "cancel"].includes(action)) return { ...result(false), code: "invalid_command" };
		if (action === "start") {
			if (s.state === "capturing") {
				// Start re-injects observer.js, which adopts the new code.
				if (typeof command.nonce === "string") s.nonce = command.nonce;
				safeScan();
				return result(false);
			}
			disconnect();
			s = fresh();
			if (!isWatchlist()) return { ...result(false), code: "wrong_page" };
			s.nonce = typeof command.nonce === "string" ? command.nonce : null;
			s.origin = location.origin;
			s.lang = (document.documentElement.getAttribute("lang") || "").slice(0, 20);
			s.filter = filterKey();
			s.pathPattern = X.redactPath(location.pathname);
			s.started = Date.now();
			readScripts();
			s.domMarker = domMarker();
			s.markerSource = s.marker && !s.profileAmbiguous ? (s.domMarker ? "state+dom" : "state") : s.domMarker ? "dom" : "none";
			s.state = "capturing";
			s.code = "capturing";
			if (s.nonce) {
				s.listener = onMessage;
				window.addEventListener("message", s.listener);
			}
			// Mutations come in bursts while the grid renders; scan at most every 100 ms.
			s.observer = new MutationObserver(() => {
				if (s.pending) return;
				s.pending = setTimeout(() => {
					s.pending = null;
					safeScan();
				}, 100);
			});
			s.observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["href", "aria-label", "data-card-title", "alt", "aria-selected", "aria-pressed", "aria-checked", "aria-current"],
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
		safeScan();
		if (action === "stop" && s.state === "capturing") {
			disconnect();
			s.state = "stopped";
			s.code = "stopped";
			s.stoppedAt = Date.now();
		}
		return result(action === "stop" || command.report === true);
	};
})();
