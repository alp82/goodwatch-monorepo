// Run inside the pinned Lighthouse image, with --network host and this directory mounted at /cwv.
import puppeteer from "/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { writeFile } from "node:fs/promises";

const origin = process.env.CWV_ORIGIN || "https://127.0.0.1:3412";
const output = process.env.CWV_OUTPUT || "/out/room-resources.json";
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-dev-shm-usage",
		"--disable-background-networking",
		"--ignore-certificate-errors",
		"--hide-scrollbars",
	],
});
const results = [];
try {
	for (const viewport of [
		{ width: 800, height: 360, deviceScaleFactor: 1 },
		{ width: 1365, height: 900, deviceScaleFactor: 1 },
		{ width: 1365, height: 900, deviceScaleFactor: 2 },
		{ width: 1920, height: 1080, deviceScaleFactor: 1 },
		{
			width: 390,
			height: 844,
			deviceScaleFactor: 1,
			isMobile: true,
			hasTouch: true,
		},
		{
			width: 390,
			height: 844,
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
		},
		{
			width: 844,
			height: 390,
			deviceScaleFactor: 1,
			isMobile: true,
			hasTouch: true,
		},
	]) {
		const page = await browser.newPage();
		await page.setViewport(viewport);
		const cdp = await page.createCDPSession();
		await cdp.send("Network.enable");
		await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
		const requests = [],
			errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		cdp.on("Network.requestWillBeSent", (event) => {
			if (/\/start-room-[^/]+\.(avif|webp)/.test(event.request.url))
				requests.push({
					url: event.request.url,
					initiator: event.initiator.type,
					priority: event.request.initialPriority,
				});
		});
		await page.setRequestInterception(true);
		page.on("request", (request) => {
			const u = new URL(request.url());
			if (
				request.method() !== "GET" ||
				!(
					u.hostname === "127.0.0.1" ||
					u.hostname === "image.tmdb.org" ||
					u.protocol === "data:"
				)
			)
				void request.abort();
			else void request.continue();
		});
		await page.goto(origin, { waitUntil: "networkidle0", timeout: 60000 });
		const state = await page.evaluate(() => ({
			pictures: [...document.querySelectorAll(".start-room-picture img")].map(
				(img) => ({
					src: img.currentSrc,
					width: img.getBoundingClientRect().width,
					visible: img.getBoundingClientRect().width > 0,
				}),
			),
			preloads: [
				...document.querySelectorAll('link[rel="preload"][as="image"]'),
			]
				.filter((link) => link.imageSrcset.includes("start-room-"))
				.map((link) => ({
					srcset: link.imageSrcset,
					sizes: link.imageSizes,
					media: link.media,
					matches: matchMedia(link.media).matches,
					crossOrigin: link.crossOrigin,
				})),
			resources: performance
				.getEntriesByType("resource")
				.filter((entry) => /\/start-room-[^/]+\.(avif|webp)/.test(entry.name))
				.map((entry) => ({
					url: entry.name,
					initiator: entry.initiatorType,
					bodyBytes: entry.encodedBodySize,
					transferBytes: entry.transferSize,
				})),
		}));
		const visible = state.pictures.filter((picture) => picture.visible);
		const matching = state.preloads.filter((link) => link.matches);
		const pass =
			requests.length === 1 &&
			visible.length === 1 &&
			visible[0].src === requests[0]?.url &&
			matching.length === 1 &&
			state.resources.length === 1 &&
			state.resources[0].initiator === "link";
		results.push({ viewport, pass, requests, errors, ...state });
		console.log(JSON.stringify({ viewport, pass, requests, errors }));
		await page.close();
	}
	await writeFile(
		output,
		JSON.stringify(
			{
				origin,
				recordedAt: new Date().toISOString(),
				browser: await browser.version(),
				results,
			},
			null,
			2,
		) + "\n",
	);
	if (results.some((result) => !result.pass || result.errors.length))
		process.exitCode = 1;
} finally {
	await browser.close();
}
