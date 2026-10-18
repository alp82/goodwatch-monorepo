/* Experimental original collector. Selectors are hypotheses, not a verified Netflix contract. */
(() => {
	if (globalThis.__goodwatchWishlistCaptureCommand) return;
	const BOUNDARIES = '.mainView .gallery, [data-uia="my-list-gallery"]';
	const EXCLUDED =
		'[role="dialog"], .bob-card, .previewModal, .recommendations, .billboard-row';
	const ROWS = '.lolomoRow, .rowContainer';
	const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
	const MY_LIST_LABELS = new Set(['My List', 'Meine Liste']);
	const MAX_ROWS = 5000;
	const MAX_TIME = 10 * 60 * 1000;
	let state = "idle";
	let code = "idle";
	let boundary = null;
	let marker = null;
	let initialUrl = "";
	let started = 0;
	let observer = null;
	let interval = null;
	let items = new Map();
	let quarantined = new Set();
	let seenIds = new Set();
	let rejected = new Set();
	let completeness = "unknown";
	const issues = new Map();
	const validText = (value) =>
		typeof value === "string" &&
		value.trim().length > 0 &&
		value.length <= 1000 &&
		![...value].some((c) => c.charCodeAt(0) < 32);
	const nativeId = (value) =>
		typeof value === "string" && /^[1-9]\d{0,19}$/.test(value)
			? value
			: typeof value === "number" && Number.isSafeInteger(value) && value > 0
				? String(value)
				: null;
	function isMyList() {
		return (
			location.origin === "https://www.netflix.com" &&
			/^\/browse\/my-list\/?$/.test(location.pathname)
		);
	}
	function profileMarker() {
		const node = document.querySelector(
			".account-dropdown-button .profile-icon",
		);
		return node
			? JSON.stringify([node.getAttribute("alt"), node.getAttribute("src")])
			: null;
	}
	function headingLabel(heading) {
		const titles = heading.querySelectorAll('.row-header-title');
		if (titles.length > 1) return null;
		return (titles.length === 1 ? titles[0].textContent : heading.getAttribute('aria-label') || heading.textContent)?.trim().replace(/\s+/g, ' ');
	}
	function ownHeadings(row) {
		return [...row.querySelectorAll(HEADINGS)].filter(heading =>
			heading.closest(ROWS) === row && !heading.closest(`${EXCLUDED}, .ptrack-content`));
	}
	function boundaries() {
		const grids = [...document.querySelectorAll(BOUNDARIES)]
			.filter(node => !node.closest(EXCLUDED) && !node.closest(ROWS))
			.filter((node, _, nodes) => !nodes.some(other => other !== node && other.contains(node)));
		// A heading identifies its nearest row only. A wrapper owning multiple headings
		// or independent headed rows may be the entire hub, so refuse it.
		const rows = [...document.querySelectorAll(HEADINGS)]
			.filter(heading => !heading.closest(`${EXCLUDED}, .ptrack-content`) && MY_LIST_LABELS.has(headingLabel(heading)))
			.map(heading => heading.closest(ROWS)).filter(row => row &&
				ownHeadings(row).length === 1 &&
				![...row.querySelectorAll(ROWS)].some(nested => !nested.closest(EXCLUDED) && ownHeadings(nested).length));
		return [...grids, ...rows];
	}
	function excludedCard(card) {
		if (card.closest(EXCLUDED)) return true;
		// A heading-free rowContainer can be the selected row's structural slider
		// wrapper. Independent nested rows remain excluded; grids exclude all rows.
		for (let parent = card.parentElement; parent && parent !== boundary; parent = parent.parentElement) {
			if (parent.matches(ROWS) && (!boundary.matches(ROWS) || parent.matches('.lolomoRow') || ownHeadings(parent).length)) return true;
		}
		return false;
	}
	function disconnect() {
		observer?.disconnect();
		observer = null;
		if (interval !== null) clearInterval(interval);
		interval = null;
	}
	function terminate(reason, discard) {
		disconnect();
		state = "terminated";
		code = reason;
		completeness = "partial";
		if (discard) {
			items.clear();
			quarantined.clear();
			seenIds.clear();
			rejected.clear();
			issues.clear();
		}
	}
	function reject(card, reason) {
		const signature = JSON.stringify([
			reason,
			card.getAttribute("data-ui-tracking-context")?.slice(0, 128),
			card.textContent?.slice(0, 128),
			[...card.querySelectorAll("a[href]")]
				.slice(0, 2)
				.map((a) => a.getAttribute("href")?.slice(0, 128)),
		]);
		if (!rejected.has(signature) && rejected.size < MAX_ROWS) {
			rejected.add(signature);
			issues.set(reason, (issues.get(reason) || 0) + 1);
		}
	}
	function readCard(card) {
		if (excludedCard(card)) return;
		const ids = new Set();
		const tracking = card.getAttribute("data-ui-tracking-context");
		if (tracking !== null && tracking.length > 4096) {
			reject(card, "card_invalid_tracking");
			return;
		}
		if (tracking !== null) {
			let parsed;
			try {
				parsed = JSON.parse(tracking);
			} catch {
				try {
					parsed = JSON.parse(decodeURIComponent(tracking));
				} catch {
					reject(card, "card_invalid_tracking");
					return;
				}
			}
			if (parsed && Object.hasOwn(parsed, "video_id")) {
				const id = nativeId(parsed.video_id);
				if (!id) {
					reject(card, "card_invalid_tracking");
					return;
				}
				ids.add(id);
			}
		}
		let sourceUrl;
		const anchors = card.querySelectorAll("a[href]");
		if (anchors.length > 20) {
			reject(card, "card_invalid_link");
			return;
		}
		for (const anchor of anchors) {
			let url;
			const href = anchor.getAttribute("href");
			if (
				href.length > 2048 ||
				href.includes("\\") ||
				[...href].some((c) => c.charCodeAt(0) < 32)
			) {
				reject(card, "card_invalid_link");
				return;
			}
			try {
				url = new URL(href, location.href);
			} catch {
				reject(card, "card_invalid_link");
				return;
			}
			if (!/^\/title(?:\/|$)/.test(url.pathname)) continue;
			const match = /^\/title\/([1-9]\d{0,19})\/?$/.exec(url.pathname);
			if (
				url.origin !== "https://www.netflix.com" ||
				url.username ||
				url.password ||
				!match
			) {
				reject(card, "card_invalid_link");
				return;
			}
			ids.add(match[1]);
			sourceUrl = `${url.origin}/title/${match[1]}`;
		}
		for (const id of ids) {
			if (!seenIds.has(id) && seenIds.size >= MAX_ROWS) {
				terminate("limit_rows", false);
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
			reject(card, ids.size ? "card_conflicting_ids" : "card_missing_id");
			return;
		}
		const sourceId = [...ids][0];
		if (quarantined.has(sourceId)) return;
		const title =
			card.querySelector(".fallback-text")?.textContent?.trim() ||
			card.querySelector("a[aria-label]")?.getAttribute("aria-label")?.trim();
		if (!validText(title)) {
			reject(card, "card_missing_title");
			return;
		}
		if (items.has(sourceId) && items.get(sourceId).title !== title) {
			quarantined.add(sourceId);
			items.delete(sourceId);
			reject(card, "card_conflicting_title");
			return;
		}
		if (!items.has(sourceId) && items.size >= MAX_ROWS) {
			terminate("limit_rows", false);
			return;
		}
		const previous = items.get(sourceId);
		items.set(sourceId, {
			title,
			mediaType: "unknown",
			sourceId,
			...(sourceUrl || previous?.sourceUrl
				? { sourceUrl: sourceUrl || previous.sourceUrl }
				: {}),
		});
	}
	function scan() {
		if (state !== "capturing") return;
		if (!isMyList() || location.pathname !== initialUrl) {
			terminate("terminated_navigation", true);
			return;
		}
		if (profileMarker() !== marker) {
			terminate("terminated_profile", true);
			return;
		}
		const found = boundaries();
		if (!boundary?.isConnected || found.length !== 1 || found[0] !== boundary) {
			terminate("terminated_boundary", false);
			return;
		}
		if (Date.now() - started >= MAX_TIME) {
			terminate("limit_time", false);
			return;
		}
		const cards = boundary.querySelectorAll(".ptrack-content");
		for (
			let index = 0;
			index < cards.length && state === "capturing";
			index++
		) {
			if (index >= MAX_ROWS) {
				terminate("limit_rows", false);
				break;
			}
			readCard(cards[index]);
		}
	}
	function result() {
		return {
			state,
			code,
			observedCount: items.size,
			rejectedCount: rejected.size,
			profileGuard: marker !== null,
			issues: [...issues].map(([code, count]) => ({ code, count })),
			...(["capturing", "stopped"].includes(state) ||
			(state === "terminated" &&
				!["terminated_navigation", "terminated_profile"].includes(code))
				? {
						envelope: {
							format: "goodwatch-wishlist",
							version: 1,
							source: "netflix",
							exportedAt: new Date().toISOString(),
							completeness,
							items: [...items.values()].map((item) => ({ ...item })),
						},
					}
				: {}),
		};
	}
	globalThis.__goodwatchWishlistCaptureCommand = (command) => {
		if (
			!command ||
			!["start", "status", "stop", "cancel"].includes(command.action)
		)
			return { ...result(), code: "invalid_command" };
		if (command.action === "start") {
			if (state === "capturing") {
				scan();
				return result();
			}
			disconnect();
			items = new Map();
			quarantined = new Set();
			seenIds = new Set();
			rejected = new Set();
			issues.clear();
			marker = null;
			completeness = "unknown";
			state = "idle";
			code = "idle";
			if (!isMyList()) return { ...result(), code: "wrong_page" };
			const found = boundaries();
			if (found.length !== 1)
				return {
					...result(),
					code: found.length ? "boundary_ambiguous" : "boundary_missing",
				};
			boundary = found[0];
			marker = profileMarker();
			initialUrl = location.pathname;
			started = Date.now();
			state = "capturing";
			code = "capturing";
			observer = new MutationObserver(scan);
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			});
			interval = setInterval(scan, 500);
			scan();
			return result();
		}
		if (command.action === "cancel") {
			disconnect();
			items.clear();
			quarantined.clear();
			seenIds.clear();
			rejected.clear();
			issues.clear();
			state = "cancelled";
			code = "cancelled";
			return result();
		}
		if (state === "stopped") {
			if (!isMyList() || location.pathname !== initialUrl)
				terminate("terminated_navigation", true);
			else if (profileMarker() !== marker)
				terminate("terminated_profile", true);
		}
		scan();
		if (command.action === "stop" && state === "capturing") {
			disconnect();
			state = "stopped";
			code = "stopped";
		}
		return result();
	};
})();
