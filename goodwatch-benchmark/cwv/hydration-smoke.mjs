// Functional check only. Run before timing/budget measurements in the pinned Chromium image.
import puppeteer from "/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { writeFile } from "node:fs/promises";
import { HYDRATION_PAGES, hydrationFailures } from "./hydration-assertions.mjs";

const origins = (
	process.env.CWV_ORIGINS || "https://127.0.0.1:3411,https://127.0.0.1:3412"
).split(",");
const output = process.env.CWV_OUTPUT || "/out/hydration-smoke.json";
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
	for (const origin of origins)
		for (const expected of HYDRATION_PAGES) {
			const page = await browser.newPage();
			await page.setViewport({
				width: 412,
				height: 823,
				deviceScaleFactor: 1,
				isMobile: true,
				hasTouch: true,
			});
			const cdp = await page.createCDPSession();
			await cdp.send("Network.enable");
			await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
			const pageErrors = [],
				consoleErrors = [],
				failedApiResponses = [],
				blocked = [];
			page.on("pageerror", (error) => pageErrors.push(error.message));
			page.on("console", (message) => {
				if (
					message.type() === "error" &&
					/TypeError|ReferenceError|Minified React error|Hydration failed|hydrating|error occurred in the/.test(
						message.text(),
					)
				)
					consoleErrors.push(message.text());
			});
			page.on("response", (response) => {
				const url = new URL(response.url());
				if (url.pathname.startsWith("/api/") && response.status() >= 400)
					failedApiResponses.push({
						path: url.pathname + url.search,
						status: response.status(),
					});
			});
			await page.setRequestInterception(true);
			page.on("request", (request) => {
				const url = new URL(request.url());
				if (
					!["GET", "HEAD"].includes(request.method()) ||
					(!["127.0.0.1", "image.tmdb.org", "artworks.thetvdb.com"].includes(
						url.hostname,
					) &&
						url.protocol !== "data:")
				) {
					blocked.push({
						method: request.method(),
						path: url.origin + url.pathname,
					});
					void request.abort();
				} else void request.continue();
			});
			const response = await page.goto(origin + expected.path, {
				waitUntil: "networkidle0",
				timeout: 60000,
			});
			await page
				.waitForFunction(
					() =>
						[...document.querySelectorAll("h1")].some((element) =>
							Object.keys(element).some(
								(key) =>
									key.startsWith("__reactFiber$") ||
									key.startsWith("__reactProps$"),
							),
						),
					{ timeout: 15000 },
				)
				.catch(() => {});
			await new Promise((resolve) => setTimeout(resolve, 1500));
			const dom = await page.evaluate(() => ({
				headings: [...document.querySelectorAll("h1")].map((element) =>
					element.textContent.trim(),
				),
				hydrated: [...document.querySelectorAll("h1")].some((element) =>
					Object.keys(element).some(
						(key) =>
							key.startsWith("__reactFiber$") ||
							key.startsWith("__reactProps$"),
					),
				),
				resultCards: document.querySelectorAll("[data-result-position]").length,
			}));
			const result = {
				origin,
				page: expected.name,
				path: expected.path,
				status: response.status(),
				...dom,
				pageErrors,
				consoleErrors,
				failedApiResponses,
				blocked,
			};
			result.failures = hydrationFailures(expected, result);
			result.pass = result.failures.length === 0;
			results.push(result);
			console.log(JSON.stringify(result));
			await page.close();
		}
	await writeFile(
		output,
		JSON.stringify(
			{
				browser: await browser.version(),
				recordedAt: new Date().toISOString(),
				pass: results.every((result) => result.pass),
				results,
			},
			null,
			2,
		) + "\n",
	);
	if (results.some((result) => !result.pass)) process.exitCode = 1;
} finally {
	await browser.close();
}
