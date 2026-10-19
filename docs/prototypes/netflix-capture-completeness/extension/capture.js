/* Experimental My List collector, version 0.0.5 (ticket #706).
 * Builds on 0.0.4. Adds:
 * - A narrowly scoped page-state reference: Netflix's own reported total for
 *   the selected row, read from the inline page-state script text.
 * - A stable-read check, so a recycled card is accepted only after the same
 *   link and label are seen on two consecutive scans.
 * - A completeness verdict that never relies on silence or a click count.
 * - An optional bounded assisted traversal that clicks only the selected
 *   row's next-arrow button.
 * Selectors come from one saved de-DE page; they remain hypotheses. */
(() => {
	if (globalThis.__goodwatchWishlistCaptureCommand) return;
	const VERSION = '0.0.5';
	const BOUNDARIES = '.mainView .gallery, [data-uia="my-list-gallery"]';
	const EXCLUDED =
		'[role="dialog"], .bob-card, .previewModal, .recommendations, .billboard-row';
	const ROWS = '.lolomoRow, .rowContainer, section.carousel-row';
	const MODERN_ROW = 'section.carousel-row';
	const MODERN_CARD = 'a[data-uia="standard-card"]';
	const NEXT_BUTTON = 'button[data-uia="carousel-hawkins-right-button"]';
	const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
	const MY_LIST_LABELS = new Set(['My List', 'Meine Liste']);
	const STATE_MARKER = "netflix.reactContext.models.graphql = JSON.parse('";
	const MAX_STATE_CHARS = 8 * 1024 * 1024;
	const MAX_ROWS = 5000;
	const MAX_TIME = 10 * 60 * 1000;
	// A card is accepted only after its link and label stay unchanged this long.
	const STABLE_MS = 400;
	// Assisted traversal bounds (gate G12).
	const ASSIST_SETTLE_MS = 600;
	// Lazy-loaded cards can take seconds; wait up to this long after a click.
	const ASSIST_MAX_WAIT_MS = 8000;
	const MAX_REBINDS = 20;
	const ASSIST_STALL_LIMIT = 3;
	const ASSIST_EXTRA_ADVANCES = 3;
	const ASSIST_MAX_TIME = 3 * 60 * 1000;

	let state = 'idle';
	let code = 'idle';
	let boundary = null;
	let rowLabel = null;
	let marker = null;
	let initialUrl = '';
	let started = 0;
	let ended = 0;
	let observer = null;
	let interval = null;
	let items = new Map();
	let quarantined = new Set();
	let seenIds = new Set();
	let rejected = new Set();
	let pending = new WeakMap();
	let reference = null;
	let referenceReason = 'not_read';
	let assist = null;
	let lastMutation = 0;
	// Lap tracking: the row's first title leaves view and comes back, or the
	// next arrow disappears after the row has moved.
	let firstId = null;
	let leftStart = false;
	let lapSeen = false;
	let startOrder = [];
	let rebinds = 0;
	const issues = new Map();

	const validText = (value) =>
		typeof value === 'string' &&
		value.trim().length > 0 &&
		value.length <= 1000 &&
		![...value].some((c) => c.charCodeAt(0) < 32);
	const nativeId = (value) =>
		typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
			? value
			: typeof value === 'number' && Number.isSafeInteger(value) && value > 0
				? String(value)
				: null;

	function isMyList() {
		return (
			location.origin === 'https://www.netflix.com' &&
			/^\/browse\/my-list\/?$/.test(location.pathname)
		);
	}
	function profileMarker() {
		// Only the active trigger owns this marker. No marker values leave this closure.
		const triggers = document.querySelectorAll('button[data-uia="navigation+profile-menu+trigger"]');
		if (triggers.length) {
			if (triggers.length !== 1) return null;
			const avatars = triggers[0].querySelectorAll('img[data-uia="navigation+profile-menu+Avatar"]');
			return avatars.length === 1
				? JSON.stringify(['modern', avatars[0].getAttribute('alt'), avatars[0].getAttribute('src')])
				: null;
		}
		const nodes = document.querySelectorAll('.account-dropdown-button .profile-icon');
		return nodes.length === 1
			? JSON.stringify(['legacy', nodes[0].getAttribute('alt'), nodes[0].getAttribute('src')])
			: null;
	}
	function headingLabel(heading) {
		const titles = heading.querySelectorAll('.row-header-title');
		if (titles.length > 1) return null;
		return (titles.length === 1 ? titles[0].textContent : heading.getAttribute('aria-label') || heading.textContent)?.trim().replace(/\s+/g, ' ');
	}
	function ownHeadings(row) {
		return [...row.querySelectorAll(HEADINGS)].filter(heading =>
			heading.closest(ROWS) === row && !heading.closest(`${EXCLUDED}, .ptrack-content, ${MODERN_CARD}`));
	}
	function boundaries() {
		const grids = [...document.querySelectorAll(BOUNDARIES)]
			.filter(node => !node.closest(EXCLUDED) && !node.closest(ROWS))
			.filter((node, _, nodes) => !nodes.some(other => other !== node && other.contains(node)));
		const rows = [...document.querySelectorAll(HEADINGS)]
			.filter(heading => !heading.closest(`${EXCLUDED}, .ptrack-content, ${MODERN_CARD}`) && MY_LIST_LABELS.has(headingLabel(heading)))
			.map(heading => heading.closest(ROWS)).filter(row => row &&
				ownHeadings(row).length === 1 &&
				![...row.querySelectorAll(ROWS)].some(nested => !nested.closest(EXCLUDED) && ownHeadings(nested).length));
		return [...grids, ...rows];
	}

	// ---- Page-state reference -------------------------------------------
	// Decodes one JavaScript single-quoted string literal starting at `from`.
	// Returns null on any malformed escape. No eval: MV3 forbids it.
	function decodeLiteral(text, from) {
		let out = '';
		for (let i = from; i < text.length; i++) {
			const c = text[i];
			if (c === "'") return out;
			if (c !== '\\') { out += c; continue; }
			const n = text[++i];
			if (n === undefined) return null;
			if (n === 'x') {
				const hex = text.slice(i + 1, i + 3);
				if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null;
				out += String.fromCharCode(parseInt(hex, 16)); i += 2;
			} else if (n === 'u') {
				if (text[i + 1] === '{') {
					const close = text.indexOf('}', i);
					const hex = text.slice(i + 2, close);
					if (close < 0 || !/^[0-9a-fA-F]{1,6}$/.test(hex)) return null;
					out += String.fromCodePoint(parseInt(hex, 16)); i = close;
				} else {
					const hex = text.slice(i + 1, i + 5);
					if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
					out += String.fromCharCode(parseInt(hex, 16)); i += 4;
				}
			} else if (n === '\n') {
				// Line continuation.
			} else {
				out += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[n] ?? n;
			}
		}
		return null;
	}
	function cursorPosition(cursor) {
		if (typeof cursor !== 'string' || cursor.length > 64) return null;
		try {
			const text = atob(cursor);
			return /^(0|[1-9]\d{0,5})$/.test(text) ? Number(text) : null;
		} catch {
			return null;
		}
	}
	// Reads only the section whose label equals the selected row's heading.
	// Keeps its reported total and its loaded edges' IDs and positions.
	function readReference(label) {
		if (!label) return { reference: null, reason: 'reference_no_label' };
		const scripts = [...document.querySelectorAll('script:not([src])')]
			.filter(script => (script.textContent || '').includes(STATE_MARKER));
		if (scripts.length !== 1) return { reference: null, reason: scripts.length ? 'reference_ambiguous' : 'reference_missing' };
		const text = scripts[0].textContent;
		if (text.length > MAX_STATE_CHARS) return { reference: null, reason: 'reference_too_large' };
		const literal = decodeLiteral(text, text.indexOf(STATE_MARKER) + STATE_MARKER.length);
		let data;
		try {
			data = JSON.parse(literal)?.data;
		} catch {
			return { reference: null, reason: 'reference_unreadable' };
		}
		if (!data || typeof data !== 'object') return { reference: null, reason: 'reference_unreadable' };
		const sections = Object.values(data).filter(entity =>
			entity && entity.__typename === 'PinotCarouselSection' && entity.displayString === label);
		if (sections.length !== 1) return { reference: null, reason: sections.length ? 'reference_ambiguous' : 'reference_missing' };
		const connections = Object.entries(sections[0])
			.filter(([key, value]) => /^entities(\(|$)/.test(key) && value && typeof value === 'object');
		if (connections.length !== 1) return { reference: null, reason: 'reference_ambiguous' };
		const connection = connections[0][1];
		const total = connection.totalCount;
		if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ROWS) return { reference: null, reason: 'reference_no_total' };
		const edges = Array.isArray(connection.edges) ? connection.edges : [];
		const loaded = [];
		const positions = new Set();
		for (const edge of edges) {
			const treatment = data[edge?.node?.__ref];
			const entity = data[treatment?.unifiedEntity?.__ref];
			const id = nativeId(entity?.videoId);
			const position = cursorPosition(edge?.cursor);
			if (!id || position === null || positions.has(position) || position >= total) {
				return { reference: null, reason: 'reference_bad_edge' };
			}
			positions.add(position);
			loaded.push({ id, position });
		}
		const hasNextPage = connection.pageInfo?.hasNextPage === true;
		return { reference: { total, loaded, hasNextPage }, reason: 'reference_found' };
	}

	// ---- Card reading ---------------------------------------------------
	function excludedCard(card) {
		if (card.closest(EXCLUDED)) return true;
		for (let parent = card.parentElement; parent && parent !== boundary; parent = parent.parentElement) {
			if (parent.matches(ROWS) && (!boundary.matches(ROWS) || parent.matches('.lolomoRow, section.carousel-row') || ownHeadings(parent).length)) return true;
		}
		return false;
	}
	function disconnect() {
		observer?.disconnect();
		observer = null;
		if (interval !== null) clearInterval(interval);
		interval = null;
		if (assist?.timer != null) clearTimeout(assist.timer);
		if (assist) assist.timer = null;
	}
	function clearAll() {
		items.clear();
		quarantined.clear();
		seenIds.clear();
		rejected.clear();
		issues.clear();
		pending = new WeakMap();
	}
	function terminate(reason, discard) {
		disconnect();
		state = 'terminated';
		code = reason;
		ended = Date.now();
		if (discard) clearAll();
	}
	function reject(card, reason) {
		const signature = JSON.stringify([
			reason,
			card.getAttribute('data-ui-tracking-context')?.slice(0, 128),
			card.textContent?.slice(0, 128),
			[...card.querySelectorAll('a[href]')].slice(0, 2).map((a) => a.getAttribute('href')?.slice(0, 128)),
		]);
		if (!rejected.has(signature) && rejected.size < MAX_ROWS) {
			rejected.add(signature);
			issues.set(reason, (issues.get(reason) || 0) + 1);
		}
	}
	// Returns {ids, sourceUrl} or a rejection reason string.
	function cardEvidence(card) {
		const ids = new Set();
		const tracking = card.getAttribute('data-ui-tracking-context');
		if (tracking !== null && tracking.length > 4096) return 'card_invalid_tracking';
		if (tracking !== null) {
			let parsed;
			try {
				parsed = JSON.parse(tracking);
			} catch {
				try {
					parsed = JSON.parse(decodeURIComponent(tracking));
				} catch {
					return 'card_invalid_tracking';
				}
			}
			if (parsed && Object.hasOwn(parsed, 'video_id')) {
				const id = nativeId(parsed.video_id);
				if (!id) return 'card_invalid_tracking';
				ids.add(id);
			}
		}
		let sourceUrl;
		const modern = card.matches(MODERN_CARD);
		if (modern && !card.hasAttribute('href')) return 'card_invalid_link';
		const anchors = [...(card.matches('a[href]') ? [card] : []), ...card.querySelectorAll('a[href]')];
		if (anchors.length > 20) return 'card_invalid_link';
		for (const anchor of anchors) {
			let url;
			const href = anchor.getAttribute('href');
			if (href.length > 2048 || href.includes('\\') || [...href].some((c) => c.charCodeAt(0) < 32)) return 'card_invalid_link';
			try {
				url = new URL(href, location.href);
			} catch {
				return 'card_invalid_link';
			}
			if (modern) {
				const entries = [...url.searchParams];
				const id = entries.length === 1 && entries[0][0] === 'jbv' && nativeId(entries[0][1]);
				if (url.origin !== 'https://www.netflix.com' || url.username || url.password || url.pathname !== '/browse' || !id) return 'card_invalid_link';
				ids.add(id);
				continue;
			}
			if (!/^\/title(?:\/|$)/.test(url.pathname)) continue;
			const match = /^\/title\/([1-9]\d{0,19})\/?$/.exec(url.pathname);
			if (url.origin !== 'https://www.netflix.com' || url.username || url.password || !match) return 'card_invalid_link';
			ids.add(match[1]);
			sourceUrl = `${url.origin}/title/${match[1]}`;
		}
		const title = modern ? card.getAttribute('aria-label')?.trim() :
			card.querySelector('.fallback-text')?.textContent?.trim() ||
			card.querySelector('a[aria-label]')?.getAttribute('aria-label')?.trim();
		return { ids, sourceUrl, title, modern };
	}
	function readCard(card) {
		if (excludedCard(card)) return;
		const evidence = cardEvidence(card);
		// Stable-read check: accept a card only after the same evidence has been
		// seen for STABLE_MS. A recycled card whose link and label change in
		// separate tasks is never accepted in its half-updated state.
		const signature = typeof evidence === 'string' ? evidence :
			JSON.stringify([[...evidence.ids], evidence.title ?? null, evidence.sourceUrl ?? null]);
		const seen = pending.get(card);
		if (!seen || seen.signature !== signature) {
			pending.set(card, { signature, since: Date.now() });
			return;
		}
		if (Date.now() - seen.since < STABLE_MS) return;
		if (typeof evidence === 'string') {
			reject(card, evidence);
			return;
		}
		const { ids, sourceUrl, title } = evidence;
		for (const id of ids) {
			if (!seenIds.has(id) && seenIds.size >= MAX_ROWS) {
				terminate('limit_rows', false);
				return;
			}
			seenIds.add(id);
		}
		if (ids.size !== 1) {
			if (ids.size > 1)
				for (const id of ids) {
					quarantined.add(id);
					items.delete(id);
				}
			reject(card, ids.size ? 'card_conflicting_ids' : 'card_missing_id');
			return;
		}
		const sourceId = [...ids][0];
		if (quarantined.has(sourceId)) return;
		if (!validText(title)) {
			reject(card, 'card_missing_title');
			return;
		}
		if (items.has(sourceId) && items.get(sourceId).title !== title) {
			quarantined.add(sourceId);
			items.delete(sourceId);
			reject(card, 'card_conflicting_title');
			return;
		}
		if (!items.has(sourceId) && items.size >= MAX_ROWS) {
			terminate('limit_rows', false);
			return;
		}
		const previous = items.get(sourceId);
		items.set(sourceId, {
			title,
			mediaType: 'unknown',
			sourceId,
			...(sourceUrl || previous?.sourceUrl ? { sourceUrl: sourceUrl || previous.sourceUrl } : {}),
		});
	}
	function mountedIds() {
		if (!boundary?.matches(MODERN_ROW)) return [];
		return [...boundary.querySelectorAll(MODERN_CARD)].filter(card => !excludedCard(card)).map(card => {
			try {
				const url = new URL(card.getAttribute('href') || '', location.href);
				return nativeId(url.searchParams.get('jbv') || '');
			} catch {
				return null;
			}
		}).filter(Boolean);
	}
	function trackLap() {
		if (!firstId || lapSeen) return;
		const ids = mountedIds();
		if (!ids.includes(firstId)) leftStart = true;
		else if (leftStart) lapSeen = true;
		if (leftStart && !lapSeen && !nextButton()) lapSeen = true;
	}
	function guard() {
		if (!isMyList() || location.pathname !== initialUrl) {
			terminate('terminated_navigation', true);
			return false;
		}
		if (profileMarker() !== marker) {
			terminate('terminated_profile', true);
			return false;
		}
		const found = boundaries();
		if (!boundary?.isConnected || found.length !== 1 || found[0] !== boundary) {
			// Netflix may re-render the same row. Rebind only to exactly one row
			// with the same heading on the same page and profile.
			const same = found.length === 1 && found[0].matches(MODERN_ROW) && rowLabel &&
				headingLabel(ownHeadings(found[0])[0]) === rowLabel;
			if (!same || ++rebinds > MAX_REBINDS) {
				terminate('terminated_boundary', false);
				return false;
			}
			boundary = found[0];
		}
		if (Date.now() - started >= MAX_TIME) {
			terminate('limit_time', false);
			return false;
		}
		return true;
	}
	function scan() {
		if (state !== 'capturing') return;
		if (!guard()) return;
		const cards = boundary.querySelectorAll(boundary.matches(MODERN_ROW) ? MODERN_CARD : '.ptrack-content');
		for (let index = 0; index < cards.length && state === 'capturing'; index++) {
			if (index >= MAX_ROWS) {
				terminate('limit_rows', false);
				break;
			}
			readCard(cards[index]);
		}
		if (state === 'capturing') trackLap();
	}

	// ---- Completeness verdict -------------------------------------------
	function verdict() {
		const captured = items.size;
		const base = { reportedTotal: reference?.total ?? null, captured };
		if (!reference) return { completeness: 'unknown', reason: referenceReason, ...base };
		const missingLoaded = reference.loaded.filter(edge => !items.has(edge.id)).length;
		const result = (completeness, reason) => ({ completeness, reason, missingLoaded, ...base });
		if (state === 'terminated') return result('partial', `ended_${code}`);
		if (marker === null) return result('partial', 'no_profile_guard');
		if (quarantined.size) return result('partial', 'conflicting_cards');
		if (rejected.size) return result('partial', 'unreadable_cards');
		if (captured > reference.total) return result('partial', 'above_total');
		if (missingLoaded) return result('partial', 'loaded_title_missing');
		if (orderMismatch()) return result('partial', 'order_mismatch');
		// When Netflix listed every member up front, require the exact set.
		const fullListing = reference.loaded.length === reference.total;
		if (fullListing && [...items.keys()].some(id => !reference.loaded.some(edge => edge.id === id))) return result('partial', 'not_in_listing');
		if (captured < reference.total) return result('partial', 'below_total');
		if (!fullListing && !lapSeen) return result('partial', 'lap_not_finished');
		if (state === 'capturing') return result('partial', 'total_reached_still_capturing');
		return result('complete', 'reached_total');
	}

	// The cards shown at Start must follow Netflix's loaded positions when the
	// row starts at its first title. A foreign card among them is caught here.
	function orderCheck() {
		if (!reference) return 'not_applicable';
		const loaded = [...reference.loaded].sort((a, b) => a.position - b.position);
		if (!loaded.length || loaded[0].position !== 0 || startOrder[0] !== loaded[0].id) return 'not_applicable';
		const n = Math.min(startOrder.length, loaded.length);
		for (let k = 0; k < n; k++) if (loaded[k].position !== k || startOrder[k] !== loaded[k].id) return 'mismatch';
		return 'match';
	}
	const orderMismatch = () => orderCheck() === 'mismatch';

	// ---- Bounded assisted traversal -------------------------------------
	function nextButton() {
		const buttons = [...boundary.querySelectorAll(NEXT_BUTTON)]
			.filter(button => button.closest(MODERN_ROW) === boundary);
		return buttons.length === 1 && !buttons[0].disabled ? buttons[0] : null;
	}
	function finishAssist(reason) {
		assist.outcome = reason;
		assist.timer = null;
		if (state !== 'capturing') return;
		disconnect();
		state = 'stopped';
		code = 'stopped';
		ended = Date.now();
	}
	function assistStep() {
		if (!assist || state !== 'capturing') return;
		assist.timer = null;
		scan();
		if (state !== 'capturing') {
			assist.outcome = `ended_${code}`;
			return;
		}
		if (assist.advances === 0) {
			assist.countAtStart = items.size;
			assist.fullCount = mountedIds().length;
			assist.windows = new Set([[...mountedIds()].sort().join(',')]);
		} else {
			// Assisted mode only clicks next, so a settled window of cards seen
			// before means the row has cycled: a full lap.
			const window = [...mountedIds()].sort().join(',');
			if (assist.windows.has(window)) lapSeen = true;
			assist.windows.add(window);
			const gained = items.size - assist.countAtAdvance;
			if (gained > 0) {
				assist.stalls = 0;
				if (assist.firstGain === null) {
					assist.firstGain = gained;
					assist.maxAdvances = Math.ceil(Math.max(0, reference.total - assist.countAtStart) / gained) + ASSIST_EXTRA_ADVANCES;
				}
			} else {
				assist.stalls++;
			}
		}
		// Stop at the end of one lap, not when the count first reaches the total:
		// a title added elsewhere during capture could otherwise fill the gap.
		const fullListing = reference.loaded.length === reference.total;
		if (fullListing && items.size >= reference.total) return finishAssist('listing_captured');
		if (lapSeen && items.size < reference.total && !assist.finalWait) {
			// The row's end is in view but titles are missing: give the last lazy
			// cards one more full wait before finishing the lap.
			assist.finalWait = true;
			assist.clickedAt = Date.now();
			assist.timer = setTimeout(assistWait, ASSIST_SETTLE_MS);
			return;
		}
		if (lapSeen) return finishAssist('lap_complete');
		if (assist.stalls >= ASSIST_STALL_LIMIT) return finishAssist('stalled');
		if (assist.maxAdvances !== null && assist.advances >= assist.maxAdvances + ASSIST_STALL_LIMIT) return finishAssist('advance_limit');
		if (Date.now() - started >= ASSIST_MAX_TIME) return finishAssist('assist_time_limit');
		const button = nextButton();
		if (!button) return finishAssist(assist.advances ? 'row_end' : 'next_button_missing');
		assist.countAtAdvance = items.size;
		assist.before = mountedIds().join(',');
		assist.advances++;
		assist.clickedAt = Date.now();
		button.click();
		assist.timer = setTimeout(assistWait, ASSIST_SETTLE_MS);
	}
	// Waits until the row has moved, is quiet, and is as full of cards as at
	// Start (lazy pages have loaded), or until the maximum wait.
	function assistWait() {
		if (!assist || state !== 'capturing') return;
		const now = Date.now();
		const ids = mountedIds();
		if (assist.finalWait) {
			// Final wait: until the total is reached or the maximum wait passes.
			scan();
			if (items.size >= reference.total || now - assist.clickedAt >= ASSIST_MAX_WAIT_MS) {
				assist.timer = setTimeout(assistStep, STABLE_MS + 50);
			} else {
				assist.timer = setTimeout(assistWait, 150);
			}
			return;
		}
		const moved = ids.join(',') !== assist.before;
		const quiet = now - lastMutation >= ASSIST_SETTLE_MS;
		const filled = ids.length >= assist.fullCount;
		// "Full" is the most cards the row has shown at once once it settled.
		if (moved && quiet && filled) assist.fullCount = Math.max(assist.fullCount, ids.length);
		if ((moved && quiet && filled) || now - assist.clickedAt >= ASSIST_MAX_WAIT_MS) {
			// Wait out the stable-read time so new cards can be confirmed.
			scan();
			assist.timer = setTimeout(assistStep, STABLE_MS + 50);
		} else {
			assist.timer = setTimeout(assistWait, 150);
		}
	}

	function result() {
		const keep = ['capturing', 'stopped'].includes(state) ||
			(state === 'terminated' && !['terminated_navigation', 'terminated_profile'].includes(code));
		const v = verdict();
		return {
			version: VERSION,
			state,
			code,
			observedCount: items.size,
			rejectedCount: rejected.size,
			profileGuard: marker !== null,
			issues: [...issues].map(([code, count]) => ({ code, count })),
			verdict: v,
			reference: reference ? { found: true, total: reference.total, loaded: reference.loaded.length } : { found: false, reason: referenceReason },
			traversal: assist ? {
				mode: 'assisted', advances: assist.advances, stalls: assist.stalls,
				maxAdvances: assist.maxAdvances, outcome: assist.outcome,
			} : { mode: 'manual' },
			lapSeen,
			rebinds,
			orderCheck: orderCheck(),
			elapsedMs: started ? (ended || Date.now()) - started : 0,
			...(keep ? {
				envelope: {
					format: 'goodwatch-wishlist',
					version: 1,
					source: 'netflix',
					exportedAt: new Date(Date.now()).toISOString(),
					completeness: v.completeness,
					items: [...items.values()].map((item) => ({ ...item })),
				},
			} : {}),
		};
	}
	function emptyListResult() {
		// No My List row, but Netflix reports a My List section with zero titles.
		for (const label of MY_LIST_LABELS) {
			const read = readReference(label);
			if (read.reference && read.reference.total === 0) return read.reference;
		}
		return null;
	}

	globalThis.__goodwatchWishlistCaptureCommand = (command) => {
		if (!command || !['start', 'status', 'stop', 'cancel'].includes(command.action))
			return { ...result(), code: 'invalid_command' };
		if (command.action === 'start') {
			if (state === 'capturing') {
				scan();
				return result();
			}
			disconnect();
			items = new Map();
			quarantined = new Set();
			seenIds = new Set();
			rejected = new Set();
			pending = new WeakMap();
			issues.clear();
			marker = null;
			reference = null;
			referenceReason = 'not_read';
			assist = null;
			firstId = null;
			leftStart = false;
			lapSeen = false;
			startOrder = [];
			rebinds = 0;
			started = 0;
			ended = 0;
			state = 'idle';
			code = 'idle';
			if (!isMyList()) return { ...result(), code: 'wrong_page' };
			const found = boundaries();
			if (found.length !== 1) {
				if (!found.length) {
					const empty = emptyListResult();
					if (empty) {
						reference = empty;
						referenceReason = 'reference_found';
						marker = profileMarker();
						state = 'stopped';
						code = 'list_empty';
						started = ended = Date.now();
						return result();
					}
				}
				return { ...result(), code: found.length ? 'boundary_ambiguous' : 'boundary_missing' };
			}
			boundary = found[0];
			rowLabel = boundary.matches(ROWS) ? headingLabel(ownHeadings(boundary)[0]) : null;
			({ reference, reason: referenceReason } = rowLabel ? readReference(rowLabel) : { reference: null, reason: 'reference_grid_layout' });
			marker = profileMarker();
			initialUrl = location.pathname;
			startOrder = mountedIds();
			firstId = reference?.loaded.find(edge => edge.position === 0)?.id ?? startOrder[0] ?? null;
			started = Date.now();
			state = 'capturing';
			code = 'capturing';
			observer = new MutationObserver(() => {
				lastMutation = Date.now();
				scan();
			});
			observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
			interval = setInterval(scan, 500);
			scan();
			if (command.mode === 'assisted') {
				if (!reference || !boundary.matches(MODERN_ROW)) {
					// Without a reported total the traversal has no safe bound. The
					// capture continues as a manual capture.
					assist = { advances: 0, stalls: 0, maxAdvances: null, outcome: 'needs_reference', timer: null };
				} else {
					assist = {
						advances: 0, stalls: 0, firstGain: null, maxAdvances: null, outcome: null,
						countAtStart: 0, countAtAdvance: 0, clickedAt: 0, timer: null,
					};
					// Let the stable-read check confirm the cards already shown.
					assist.timer = setTimeout(assistStep, STABLE_MS + 200);
				}
			}
			return result();
		}
		if (command.action === 'cancel') {
			disconnect();
			clearAll();
			state = 'cancelled';
			code = 'cancelled';
			return result();
		}
		if (state === 'stopped' && code !== 'list_empty') {
			if (!isMyList() || location.pathname !== initialUrl) terminate('terminated_navigation', true);
			else if (profileMarker() !== marker) terminate('terminated_profile', true);
		}
		scan();
		if (command.action === 'stop' && state === 'capturing') {
			if (assist && assist.outcome === null) assist.outcome = 'member_stopped';
			disconnect();
			state = 'stopped';
			code = 'stopped';
			ended = Date.now();
		}
		return result();
	};
})();
