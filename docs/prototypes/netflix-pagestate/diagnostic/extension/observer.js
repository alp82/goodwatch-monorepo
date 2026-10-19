/* GoodWatch Netflix diagnostic: page-world observer (ticket #730, DESIGN.md revision 3).
 * Runs in the page's own world, injected only after the member starts a capture.
 * Pass-through wrappers on fetch and XMLHttpRequest: it sends no request of its
 * own, never changes a request or response, never reads cookies, storage,
 * tokens or headers. It keeps only the My List row's CarouselPage entries
 * (positions, IDs, entity type names, titles) plus counters and fixed codes.
 * The isolated collector talks to it over a per-session DOM event channel. */
(() => {
	if (typeof window.__gwDiagObserverInstall === 'function') return;
	// Native references, captured before anything else can change them.
	const W = window;
	const origFetch = W.fetch;
	const XHRProto = XMLHttpRequest.prototype;
	const origOpen = XHRProto.open;
	const origSend = XHRProto.send;
	const getter = (proto, name) => Object.getOwnPropertyDescriptor(proto, name).get;
	const requestUrl = getter(Request.prototype, 'url');
	const requestMethod = getter(Request.prototype, 'method');
	const requestBody = getter(Request.prototype, 'body');
	const urlHref = getter(URL.prototype, 'href');
	const responseStatus = getter(Response.prototype, 'status');
	const responseBodyUsed = getter(Response.prototype, 'bodyUsed');
	const responseBody = getter(Response.prototype, 'body');
	const responseClone = Response.prototype.clone;
	const getReader = ReadableStream.prototype.getReader;
	const readerRead = ReadableStreamDefaultReader.prototype.read;
	const readerCancel = ReadableStreamDefaultReader.prototype.cancel;
	const xhrStatus = getter(XHRProto, 'status');
	const xhrResponseType = getter(XHRProto, 'responseType');
	const xhrResponseText = getter(XHRProto, 'responseText');
	const xhrResponse = getter(XHRProto, 'response');
	const addListener = EventTarget.prototype.addEventListener;
	const removeListener = EventTarget.prototype.removeEventListener;
	const dispatch = EventTarget.prototype.dispatchEvent;
	const nativeThen = Promise.prototype.then;
	const parseJson = JSON.parse;
	const stringify = JSON.stringify;
	const decodeB64 = W.atob.bind(W);
	const getProto = Object.getPrototypeOf;
	const getDesc = Object.getOwnPropertyDescriptor;
	const hasOwn = Object.prototype.hasOwnProperty;
	const NativeURL = URL;
	const NativeCustomEvent = CustomEvent;
	const decoder = new TextDecoder();
	const decode = (bytes, stream) => decoder.decode(bytes, { stream });
	const querySelector = Document.prototype.querySelector;
	const getAttribute = Element.prototype.getAttribute;

	const LIMITS = {
		urlChars: 16 * 1024, bodyChars: 64 * 1024, variablesChars: 16 * 1024,
		responseBytes: 2 * 1024 * 1024, readers: 4, budgetBytes: 8 * 1024 * 1024,
		entries: 5000, titleChars: 1000, jsonDepth: 64, jsonNodes: 200000,
		totalMax: 5000, cursorMax: 4999, pageSizeMax: 200,
	};
	const TREATMENTS = new Set(['PinotStandardBoxshotEntityTreatment', 'PinotUnentitledBoxshotEntityTreatment']);

	W.__gwDiagObserverInstall = function install(cfg) {
		delete W.__gwDiagObserverInstall;
		let generation = 1;
		let bindingOpen = true;
		let inert = false;
		let nextBinding = 1;
		const pending = new Map(); // bindingId -> binding
		const outbox = [];
		const sticky = new Set();
		const readers = new Set();
		const xhrState = new WeakMap(); // xhr -> { openGen, method, url }
		const xhrListeners = new Set(); // [xhr, handler]
		let budget = 0;
		let budgetPeak = 0;
		let entriesKept = 0;
		const counters = {
			myListBindings: 0, ignoredBindings: 0, afterCutoff: 0, lateDropped: 0, accepted: 0,
			sizeDrops: 0, requestTooLarge: 0, responseUnreadable: 0, xhrReused: 0, endpointOther: 0,
			transportFetch: 0, transportXhr: 0, bodyFormGet: 0, bodyFormString: 0, unsupportedBody: 0,
			unsupportedInput: 0, networkErrors: 0, unentitledEntries: 0, rejected: {},
		};
		const installedAtMsAfterLoad = Math.round(performance.now());
		const flag = code => { sticky.add(code); };
		const reject = code => { counters.rejected[code] = (counters.rejected[code] || 0) + 1; flag(code); };
		const charge = n => {
			budget += n;
			if (budget > budgetPeak) budgetPeak = budget;
			if (budget > LIMITS.budgetBytes) { flag('observer_overloaded'); return false; }
			return true;
		};
		const release = n => { budget = Math.max(0, budget - n); };
		const safeInt = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
		const validTitle = t => typeof t === 'string' && t.length > 0 && t.length <= LIMITS.titleChars && ![...t].some(c => c.charCodeAt(0) < 32);
		const cursorPos = c => {
			if (typeof c !== 'string' || c.length > 32) return null;
			try {
				const t = decodeB64(c);
				return /^(0|[1-9]\d{0,5})$/.test(t) ? Number(t) : null;
			} catch { return null; }
		};
		const currentProfile = () => {
			try {
				const img = querySelector.call(document, 'button[data-uia="navigation+profile-menu+trigger"] img[data-uia="navigation+profile-menu+Avatar"]');
				return img ? stringify([(getAttribute.call(img, 'alt') || '').trim(), (getAttribute.call(img, 'src') || '').trim()]) : null;
			} catch { return null; }
		};

		// ---- Request classification (no getters beyond the native call) -----
		function urlOf(input) {
			if (typeof input === 'string') return input;
			if (input !== null && typeof input === 'object') {
				const proto = getProto(input);
				if (proto === Request.prototype && !hasOwn.call(input, 'url')) return requestUrl.call(input);
				if (proto === NativeURL.prototype && !hasOwn.call(input, 'href')) return urlHref.call(input);
			}
			return null;
		}
		function endpointOf(urlString) {
			if (typeof urlString !== 'string') return { kind: 'unknown' };
			if (urlString.length > LIMITS.urlChars) return { kind: 'too_large' };
			let u;
			try { u = new NativeURL(urlString, W.location.href); } catch { return { kind: 'unknown' }; }
			const exact = `${u.origin}${u.pathname}`;
			if (cfg.endpoints.includes(exact)) return { kind: 'pinned', url: u };
			if (u.pathname === '/graphql' && cfg.otherGraphqlOrigins.includes(u.origin)) return { kind: 'other' };
			return { kind: 'unrelated' };
		}
		function ownString(obj, key) {
			// Plain objects only; descriptors, never property reads.
			if (obj === null || obj === undefined) return { absent: true };
			if (typeof obj !== 'object' || getProto(obj) !== Object.prototype) return { unsupported: true };
			const d = getDesc(obj, key);
			if (!d) return { absent: true };
			if (!('value' in d)) return { unsupported: true };
			if (d.value === undefined || d.value === null) return { absent: true };
			return typeof d.value === 'string' ? { value: d.value } : { unsupported: true };
		}
		// Returns { op, variables } or a classification code.
		function parseOperation(method, url, body) {
			if (method === 'GET' || method === undefined) {
				const op = url.searchParams.get('operationName');
				const vars = url.searchParams.get('variables');
				counters.bodyFormGet++;
				if (vars !== null && vars.length > LIMITS.variablesChars) return 'request_too_large';
				let variables = null;
				try { variables = vars === null ? null : parseJson(vars); } catch { return 'unparseable'; }
				return { op, variables };
			}
			if (typeof body !== 'string') return 'unsupported_body';
			if (body.length > LIMITS.bodyChars) return 'request_too_large';
			counters.bodyFormString++;
			let parsed;
			try { parsed = parseJson(body); } catch { return 'unparseable'; }
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'unparseable';
			return { op: parsed.operationName, variables: parsed.variables };
		}
		// Creates a binding when the request is a My List CarouselPage request.
		function classify(transport, method, urlString, body) {
			const ep = endpointOf(urlString);
			if (ep.kind === 'unrelated') return null;
			if (ep.kind === 'other') { counters.endpointOther++; return null; }
			if (ep.kind === 'too_large') { counters.requestTooLarge++; flag('request_too_large'); return null; }
			if (ep.kind === 'unknown') return null;
			if (transport === 'fetch') counters.transportFetch++; else counters.transportXhr++;
			const parsed = parseOperation(method, ep.url, body);
			if (parsed === 'request_too_large') { counters.requestTooLarge++; flag('request_too_large'); return null; }
			if (parsed === 'unsupported_body') { counters.unsupportedBody++; flag('unsupported_body'); return null; }
			if (parsed === 'unparseable') { counters.ignoredBindings++; return null; }
			const v = parsed.variables;
			if (parsed.op !== 'CarouselPage' || !v || typeof v !== 'object' || v.rowId !== cfg.rowId) { counters.ignoredBindings++; return null; }
			if (!bindingOpen) { counters.afterCutoff++; return null; }
			if (currentProfile() !== cfg.profileMarker) flag('profile_changed');
			const afterPos = v.carouselAfterCursor === null || v.carouselAfterCursor === undefined ? -1 : cursorPos(v.carouselAfterCursor);
			const binding = {
				id: nextBinding++, gen: generation, transport,
				afterPosition: afterPos, pageSize: v.carouselPageSize, versionSent: v.carouselVersion,
			};
			counters.myListBindings++;
			pending.set(binding.id, binding);
			return binding;
		}
		const resolveBinding = b => { pending.delete(b.id); };

		// ---- Response validation ---------------------------------------------
		function validate(json, b) {
			if (!json || typeof json !== 'object') return 'response_rejected_json';
			if (Array.isArray(json.errors) && json.errors.length) return 'response_rejected_errors';
			const node = json.data && json.data.node;
			if (!node || node.__typename !== 'PinotCarouselSection') return 'response_rejected_node';
			if (node._id !== cfg.rowId) return 'response_rejected_row_id';
			if (node.displayString !== cfg.label) return 'response_rejected_label';
			if (node.version !== b.versionSent || node.version !== cfg.version) return 'response_rejected_version';
			const keys = Object.keys(node).filter(k => /^entities(\(|$)/.test(k));
			if (keys.length !== 1 || !node[keys[0]] || typeof node[keys[0]] !== 'object') return 'response_rejected_connection';
			const conn = node[keys[0]];
			if (!safeInt(conn.totalCount, 0, LIMITS.totalMax) || conn.totalCount !== cfg.total) return 'response_rejected_total';
			const total = conn.totalCount;
			if (b.afterPosition === null || !safeInt(b.afterPosition, -1, total - 2) || !safeInt(b.pageSize, 1, LIMITS.pageSizeMax)) return 'response_rejected_positions';
			const edges = Array.isArray(conn.edges) ? conn.edges : null;
			if (!edges || edges.length === 0 || edges.length > b.pageSize) return 'response_rejected_positions';
			const entries = [];
			for (let k = 0; k < edges.length; k++) {
				const e = edges[k];
				const pos = cursorPos(e && e.cursor);
				if (pos === null || pos > LIMITS.cursorMax || pos >= total || pos !== b.afterPosition + 1 + k) return 'response_rejected_positions';
				const n = e.node;
				if (!n || !TREATMENTS.has(n.__typename)) return 'response_rejected_entity';
				const ent = n.unifiedEntity;
				const id = ent && (typeof ent.videoId === 'number' ? ent.videoId : null);
				if (!ent || typeof ent.__typename !== 'string' || !safeInt(id, 1, Number.MAX_SAFE_INTEGER)) return 'response_rejected_entity';
				if (!validTitle(n.displayString)) return 'entry_malformed';
				entries.push({ position: pos, id: String(id), title: n.displayString, entityType: ent.__typename, treatment: n.__typename === 'PinotUnentitledBoxshotEntityTreatment' ? 'unentitled' : 'standard' });
			}
			const last = entries[entries.length - 1].position;
			if (typeof conn.pageInfo !== 'object' || conn.pageInfo === null || conn.pageInfo.hasNextPage !== (last < total - 1)) return 'response_rejected_has_next';
			return { total, version: node.version, entries };
		}
		function accept(json, b) {
			if (b.gen !== generation) { counters.lateDropped++; return; }
			const r = validate(json, b);
			if (typeof r === 'string') {
				if (r === 'entry_malformed') flag(r); else reject(r);
				resolveBinding(b);
				return;
			}
			if (entriesKept + r.entries.length > LIMITS.entries) { flag('entries_limit'); resolveBinding(b); return; }
			let cost = 0;
			for (const e of r.entries) cost += 64 + 2 * e.title.length;
			if (!charge(cost)) { resolveBinding(b); return; }
			entriesKept += r.entries.length;
			counters.unentitledEntries += r.entries.filter(e => e.treatment === 'unentitled').length;
			counters.accepted++;
			// The binding stays pending until the collector pulls this page.
			outbox.push({ bindingId: b.id, afterPosition: b.afterPosition, pageSize: b.pageSize, total: r.total, version: r.version, entries: r.entries, cost });
		}
		function countNodes(value, depth, budgetLeft) {
			if (depth > LIMITS.jsonDepth) return Infinity;
			if (value === null || typeof value !== 'object') return 1;
			let n = 1;
			for (const k in value) {
				n += countNodes(value[k], depth + 1, budgetLeft - n);
				if (n > budgetLeft) return Infinity;
			}
			return n;
		}

		// ---- fetch -------------------------------------------------------------
		async function readFetchResponse(response, b) {
			try {
				if (b.gen !== generation) { counters.lateDropped++; return; }
				if (responseStatus.call(response) !== 200) { reject('response_rejected_status'); resolveBinding(b); return; }
				if (responseBodyUsed.call(response)) { counters.responseUnreadable++; flag('response_unreadable'); resolveBinding(b); return; }
				let copy;
				try { copy = responseClone.call(response); } catch { counters.responseUnreadable++; flag('response_unreadable'); resolveBinding(b); return; }
				if (readers.size >= LIMITS.readers) { flag('observer_overloaded'); resolveBinding(b); return; }
				const body = responseBody.call(copy);
				if (!body) { reject('response_rejected_json'); resolveBinding(b); return; }
				const reader = getReader.call(body);
				readers.add(reader);
				let text = '';
				let bytes = 0;
				let charged = 0;
				try {
					for (;;) {
						const { done, value } = await readerRead.call(reader);
						if (b.gen !== generation) { counters.lateDropped++; try { await readerCancel.call(reader); } catch {} return; }
						if (done) break;
						bytes += value.byteLength;
						if (bytes > LIMITS.responseBytes) {
							counters.sizeDrops++; flag('response_too_large');
							try { await readerCancel.call(reader); } catch {}
							resolveBinding(b); return;
						}
						const chunk = decode(value, true);
						if (!charge(value.byteLength + 2 * chunk.length)) { try { await readerCancel.call(reader); } catch {} resolveBinding(b); return; }
						charged += value.byteLength + 2 * chunk.length;
						text += chunk;
					}
					text += decode(new Uint8Array(0), false);
				} finally {
					readers.delete(reader);
				}
				let json;
				try { json = parseJson(text); } catch { release(charged); reject('response_rejected_json'); resolveBinding(b); return; }
				release(charged);
				accept(json, b);
			} catch {
				if (b.gen === generation) { flag('observer_error'); resolveBinding(b); }
			}
		}
		function wrappedFetch(input, init) {
			if (inert) return origFetch.apply(this, arguments);
			let binding = null;
			try {
				const urlString = urlOf(input);
				if (urlString === null) {
					counters.unsupportedInput++; flag('unsupported_input');
				} else {
					let method;
					let body;
					let unsupported = false;
					if (typeof input === 'object') {
						method = requestMethod.call(input);
						if (requestBody.call(input) !== null) unsupported = true;
					}
					const m = ownString(init, 'method');
					const bd = ownString(init, 'body');
					if (m.unsupported || bd.unsupported) unsupported = true;
					if (m.value !== undefined) method = m.value.toUpperCase();
					if (bd.value !== undefined) body = bd.value;
					if (unsupported) {
						const ep = endpointOf(urlString);
						if (ep.kind === 'pinned') { counters.unsupportedBody++; flag('unsupported_body'); }
						else if (ep.kind === 'other') counters.endpointOther++;
					} else {
						binding = classify('fetch', method || 'GET', urlString, body);
					}
				}
			} catch { flag('observer_error'); binding = null; }
			let promise;
			try {
				promise = origFetch.apply(this, arguments);
			} catch (error) {
				if (binding) { pending.delete(binding.id); counters.myListBindings--; }
				throw error;
			}
			if (binding) {
				try {
					const b = binding;
					nativeThen.call(promise, response => { readFetchResponse(response, b); }, () => {
						if (b.gen === generation) { counters.networkErrors++; reject('response_rejected_status'); resolveBinding(b); }
					});
				} catch { flag('observer_error'); }
			}
			return promise;
		}

		// ---- XMLHttpRequest ----------------------------------------------------
		function wrappedOpen(method, url) {
			if (inert) return origOpen.apply(this, arguments);
			const result = origOpen.apply(this, arguments);
			try {
				const prev = xhrState.get(this);
				xhrState.set(this, { openGen: (prev ? prev.openGen : 0) + 1, method: typeof method === 'string' ? method.toUpperCase() : null, url: typeof url === 'string' ? url : urlOf(url) });
			} catch { flag('observer_error'); }
			return result;
		}
		function wrappedSend(body) {
			if (inert) return origSend.apply(this, arguments);
			const xhr = this;
			let binding = null;
			let handler = null;
			try {
				const st = xhrState.get(xhr);
				if (st && st.method) {
					if (body !== undefined && body !== null && typeof body !== 'string') {
						if (endpointOf(st.url).kind === 'pinned') { counters.transportXhr++; counters.unsupportedBody++; flag('unsupported_body'); }
					} else {
						binding = classify('xhr', st.method, st.url, body === null ? undefined : body);
					}
					if (binding) {
						const b = binding;
						const openGen = st.openGen;
						handler = () => {
							try {
								removeListener.call(xhr, 'loadend', handler);
								xhrListeners.forEach(pair => { if (pair[1] === handler) xhrListeners.delete(pair); });
								if (b.gen !== generation) { counters.lateDropped++; return; }
								const now = xhrState.get(xhr);
								if (!now || now.openGen !== openGen) { counters.xhrReused++; flag('xhr_reused'); flag('pending_unresolved'); resolveBinding(b); return; }
								if (xhrStatus.call(xhr) !== 200) { reject('response_rejected_status'); resolveBinding(b); return; }
								const type = xhrResponseType.call(xhr);
								let json;
								if (type === '' || type === 'text') {
									const text = xhrResponseText.call(xhr);
									if (text.length * 2 > LIMITS.responseBytes * 2 || text.length > LIMITS.responseBytes) { counters.sizeDrops++; flag('response_too_large'); resolveBinding(b); return; }
									if (!charge(2 * text.length)) { resolveBinding(b); return; }
									try { json = parseJson(text); } catch { release(2 * text.length); reject('response_rejected_json'); resolveBinding(b); return; }
									release(2 * text.length);
								} else if (type === 'json') {
									json = xhrResponse.call(xhr);
									if (countNodes(json, 0, LIMITS.jsonNodes) > LIMITS.jsonNodes) { counters.sizeDrops++; flag('response_too_large'); resolveBinding(b); return; }
								} else {
									flag('unsupported_response_type'); resolveBinding(b); return;
								}
								accept(json, b);
							} catch {
								if (b.gen === generation) { flag('observer_error'); resolveBinding(b); }
							}
						};
						addListener.call(xhr, 'loadend', handler);
						xhrListeners.add([xhr, handler]);
					}
				}
			} catch { flag('observer_error'); }
			try {
				return origSend.apply(xhr, arguments);
			} catch (error) {
				if (binding) { pending.delete(binding.id); counters.myListBindings--; }
				if (handler) {
					removeListener.call(xhr, 'loadend', handler);
					xhrListeners.forEach(pair => { if (pair[1] === handler) xhrListeners.delete(pair); });
				}
				throw error;
			}
		}

		// ---- Install -----------------------------------------------------------
		W.fetch = wrappedFetch;
		XHRProto.open = wrappedOpen;
		XHRProto.send = wrappedSend;

		// ---- Channel to the isolated collector -----------------------------------
		const integrity = () => ({ fetch: W.fetch === wrappedFetch, open: XHRProto.open === wrappedOpen, send: XHRProto.send === wrappedSend });
		const snapshot = () => ({
			generation, pending: pending.size, sticky: [...sticky], counters: { ...counters, rejected: { ...counters.rejected }, budgetPeakBytes: budgetPeak }, integrity: integrity(), installedAtMsAfterLoad,
		});
		function seal() {
			for (const b of pending.values()) { void b; flag('pending_unresolved'); }
			pending.clear();
			outbox.length = 0;
			generation++;
			for (const r of readers) { try { readerCancel.call(r); } catch {} }
			readers.clear();
		}
		function cleanup() {
			let failed = false;
			let displaced = false;
			const restore = (owner, key, wrapper, original) => {
				if (owner[key] === wrapper) {
					try { owner[key] = original; } catch {}
					if (owner[key] !== original) failed = true;
				} else {
					displaced = true;
				}
			};
			restore(W, 'fetch', wrappedFetch, origFetch);
			restore(XHRProto, 'open', wrappedOpen, origOpen);
			restore(XHRProto, 'send', wrappedSend, origSend);
			if (failed || displaced) inert = true;
			for (const [xhr, h] of xhrListeners) { try { removeListener.call(xhr, 'loadend', h); } catch {} }
			xhrListeners.clear();
			if (generation === snapshotGen) seal();
			for (const r of readers) { try { readerCancel.call(r); } catch {} }
			readers.clear();
			return failed ? 'failed' : displaced ? 'inert' : 'restored';
		}
		let snapshotGen = generation;
		function onRequest(event) {
			let msg;
			try { msg = parseJson(event.detail); } catch { return; }
			if (!msg || msg.token !== cfg.token) return;
			let reply;
			if (msg.op === 'pull') {
				const pages = outbox.splice(0, outbox.length);
				for (const p of pages) { pending.delete(p.bindingId); release(p.cost); }
				reply = { ...snapshot(), outbox: pages.map(p => ({ afterPosition: p.afterPosition, pageSize: p.pageSize, total: p.total, version: p.version, entries: p.entries })) };
			} else if (msg.op === 'cutoff') {
				bindingOpen = false;
				reply = snapshot();
			} else if (msg.op === 'seal') {
				bindingOpen = false;
				seal();
				snapshotGen = generation;
				reply = snapshot();
			} else if (msg.op === 'cleanup') {
				bindingOpen = false;
				const cleanupResult = cleanup();
				reply = { ...snapshot(), cleanupResult };
				removeListener.call(document, `${cfg.channel}:req`, onRequest);
			} else {
				reply = snapshot();
			}
			dispatch.call(document, new NativeCustomEvent(`${cfg.channel}:res`, { detail: stringify(reply) }));
		}
		addListener.call(document, `${cfg.channel}:req`, onRequest);
		return { ok: true, installedAtMsAfterLoad };
	};
})();
