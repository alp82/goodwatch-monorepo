// Loads one page as an anonymous first-time mobile visitor and records every request by phase.
// Usage: node capture.cjs <label> <url> [--no-scroll] [--throttle]
const { chromium } = require("playwright-core")
const fs = require("node:fs")

const [label, url, ...flags] = process.argv.slice(2)
const THROTTLE = flags.includes("--throttle")
const UA =
	"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
	const browser = await chromium.launch({
		executablePath: "/usr/bin/google-chrome-stable",
		headless: true,
	})
	const context = await browser.newContext({
		userAgent: UA,
		viewport: { width: 412, height: 823 },
		deviceScaleFactor: 2.625,
		isMobile: true,
		hasTouch: true,
		locale: "en-US",
	})
	const page = await context.newPage()
	const cdp = await context.newCDPSession(page)
	await cdp.send("Network.enable")
	// Same block as the Lighthouse runner: the warm request starts a render on the server.
	await cdp.send("Network.setBlockedURLs", { urls: ["*/api/og-image-warm*"] })
	if (THROTTLE) {
		await cdp.send("Network.emulateNetworkConditions", {
			offline: false,
			latency: 150,
			downloadThroughput: (1.6 * 1024 * 1024) / 8,
			uploadThroughput: (750 * 1024) / 8,
		})
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
	}

	let phase = "load"
	const reqs = new Map()
	const all = []
	cdp.on("Network.requestWillBeSent", (e) => {
		if (e.redirectResponse) {
			const prev = reqs.get(e.requestId)
			if (prev) {
				prev.status = e.redirectResponse.status
				prev.redirectedTo = e.request.url
				prev.bytes = e.redirectResponse.encodedDataLength
				prev.protocol = e.redirectResponse.protocol
			}
		}
		const r = {
			url: e.request.url,
			method: e.request.method,
			type: e.type,
			phase,
			t: e.timestamp,
			initiator: e.initiator?.type,
			initiatorUrl:
				e.initiator?.url ||
				e.initiator?.stack?.callFrames?.[0]?.url ||
				undefined,
			priority: e.request.initialPriority,
			postBytes: e.request.postData?.length,
		}
		reqs.set(e.requestId, r)
		all.push(r)
	})
	cdp.on("Network.responseReceived", (e) => {
		const r = reqs.get(e.requestId)
		if (!r) return
		const h = Object.fromEntries(
			Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]),
		)
		r.status = e.response.status
		r.mime = e.response.mimeType
		r.protocol = e.response.protocol
		r.fromCache = e.response.fromDiskCache || e.response.fromPrefetchCache
		r.cacheControl = h["cache-control"]
		r.encoding = h["content-encoding"]
		r.vary = h.vary
		r.etag = Boolean(h.etag)
		r.server = h.server
		r.age = h.age
		r.ttfb = e.response.timing
			? Math.round(e.response.timing.receiveHeadersEnd)
			: undefined
	})
	cdp.on("Network.loadingFinished", (e) => {
		const r = reqs.get(e.requestId)
		if (r) {
			r.bytes = e.encodedDataLength
			r.done = e.timestamp
		}
	})
	cdp.on("Network.dataReceived", (e) => {
		const r = reqs.get(e.requestId)
		if (r) r.decoded = (r.decoded || 0) + e.dataLength
	})
	cdp.on("Network.loadingFailed", (e) => {
		const r = reqs.get(e.requestId)
		if (r) {
			r.failed = e.blockedReason || e.errorText || "failed"
		}
	})

	await page.addInitScript(() => {
		window.__m = { lcp: [], cls: [], long: [], }
		const sel = (el) => {
			if (!el) return null
			const cls = typeof el.className === "string" ? el.className : ""
			return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls.trim().split(/\s+/).slice(0, 6).join(".")}` : ""}`
		}
		try {
			new PerformanceObserver((l) => {
				for (const e of l.getEntries())
					window.__m.lcp.push({
						t: Math.round(e.startTime),
						renderTime: Math.round(e.renderTime),
						loadTime: Math.round(e.loadTime),
						size: e.size,
						url: e.url,
						el: sel(e.element),
						tag: e.element?.tagName,
						loading: e.element?.getAttribute?.("loading"),
						fetchpriority: e.element?.getAttribute?.("fetchpriority"),
						text: e.element?.textContent?.slice(0, 80),
					})
			}).observe({ type: "largest-contentful-paint", buffered: true })
			new PerformanceObserver((l) => {
				for (const e of l.getEntries())
					window.__m.cls.push({
						t: Math.round(e.startTime),
						v: e.value,
						input: e.hadRecentInput,
						sources: (e.sources || []).slice(0, 4).map((s) => ({
							el: sel(s.node),
							from: [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round),
							to: [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round),
						})),
					})
			}).observe({ type: "layout-shift", buffered: true })
			new PerformanceObserver((l) => {
				for (const e of l.getEntries())
					window.__m.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) })
			}).observe({ type: "longtask", buffered: true })
		} catch {}
	})

	const snapshot = () =>
		page.evaluate(() => {
			const imgs = [...document.images]
			const vh = window.innerHeight
			const dpr = window.devicePixelRatio
			const imgInfo = imgs.map((i) => {
				const r = i.getBoundingClientRect()
				return {
					src: i.currentSrc || i.src,
					lazy: i.loading === "lazy",
					srcset: Boolean(i.srcset),
					sizes: Boolean(i.sizes),
					hasDims: i.hasAttribute("width") && i.hasAttribute("height"),
					decoding: i.decoding,
					nw: i.naturalWidth,
					nh: i.naturalHeight,
					dw: Math.round(r.width),
					dh: Math.round(r.height),
					top: Math.round(r.top + window.scrollY),
					visible: r.width > 0 && r.height > 0,
					inFirstViewport: r.top + window.scrollY < vh && r.width > 0,
					complete: i.complete,
				}
			})
			const scripts = [...document.scripts]
			return {
				dpr,
				vh,
				docHeight: document.documentElement.scrollHeight,
				domNodes: document.getElementsByTagName("*").length,
				imgs: imgInfo,
				inlineScripts: scripts
					.filter((s) => !s.src)
					.map((s) => ({ len: s.textContent.length, head: s.textContent.slice(0, 90) }))
					.sort((a, b) => b.len - a.len)
					.slice(0, 8),
				linkRels: [...document.querySelectorAll("link[rel]")].reduce((m, l) => {
					const k = `${l.rel}${l.as ? `:${l.as}` : ""}`
					m[k] = (m[k] || 0) + 1
					return m
				}, {}),
				prefetchHrefs: [...document.querySelectorAll('link[rel="prefetch"]')].map((l) => l.href).slice(0, 400),
				iframes: [...document.querySelectorAll("iframe")].map((f) => ({ src: f.src.slice(0, 120), lazy: f.loading })),
				anchors: document.querySelectorAll("a[href]").length,
				m: window.__m,
				nav: (() => {
					const n = performance.getEntriesByType("navigation")[0]
					return n && {
						ttfb: Math.round(n.responseStart),
						domInteractive: Math.round(n.domInteractive),
						dcl: Math.round(n.domContentLoadedEventEnd),
						load: Math.round(n.loadEventEnd),
						transfer: n.transferSize,
						encoded: n.encodedBodySize,
						decoded: n.decodedBodySize,
						protocol: n.nextHopProtocol,
					}
				})(),
				fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0),
			}
		})

	const t0 = Date.now()
	await page.goto(url, { waitUntil: "load", timeout: 120000 })
	await sleep(THROTTLE ? 20000 : 10000)
	const afterLoad = await snapshot()
	const loadMs = Date.now() - t0

	let afterScroll = null
	if (!flags.includes("--no-scroll")) {
		phase = "scroll"
		// Scroll one viewport at a time, like a visitor reading down the page.
		for (let i = 0; i < 60; i++) {
			const done = await page.evaluate(() => {
				window.scrollBy(0, window.innerHeight)
				return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
			})
			await sleep(400)
			if (done) break
		}
		await sleep(6000)
		afterScroll = await snapshot()
		phase = "idle"
		await page.evaluate(() => window.scrollTo(0, 0))
		await sleep(15000)
	}

	const out = { label, url, throttle: THROTTLE, loadMs, afterLoad, afterScroll, requests: all }
	fs.writeFileSync(`cap-${label}.json`, JSON.stringify(out))
	console.log(label, "requests", all.length, "load-phase", all.filter((r) => r.phase === "load").length)
	await browser.close()
})().catch((e) => {
	console.error(e)
	process.exit(1)
})
