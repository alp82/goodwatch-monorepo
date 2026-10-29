// Run in the Lighthouse image against an isolated local app. Only loopback GETs leave the browser.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const origin = new URL(process.env.A11Y_BASE_URL);
assert.ok(
	["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname),
	"Use an isolated loopback app",
);
const output =
	process.env.A11Y_OUTPUT_DIR || path.join(homedir(), ".cache/goodwatch-a11y");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, "browser-"));
const require = createRequire(
	"/usr/local/lib/node_modules/lighthouse/package.json",
);
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: true,
	userDataDir: profile,
	env: { ...process.env, TMPDIR: output },
	args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});
try {
	const page = await browser.newPage();
	await page.setRequestInterception(true);
	page.on("request", (request) => {
		const url = request.url();
		if (
			request.method() !== "GET" ||
			(/^https?:/.test(url) && new URL(url).origin !== origin.origin)
		)
			void request.abort();
		else void request.continue();
	});
	const titlePath = process.env.A11Y_TITLE_PATH || "/movie/603-the-matrix";
	const cases = [
		{
			name: "phone-title",
			path: titlePath,
			width: 412,
			selectors: [
				"button[data-own-score]",
				'button[data-replay-tap^="offer:"]',
				"button[data-hub-key]",
			],
		},
		{
			name: "desktop-title",
			path: titlePath,
			width: 1366,
			selectors: ['a[data-discover="true"]'],
		},
		{
			name: "discover",
			path: "/discover",
			width: 412,
			selectors: [
				'main button[aria-label="Discover movies and TV shows. Search"]',
			],
		},
	];
	const results = [];
	for (const check of cases) {
		await page.setViewport({
			width: check.width,
			height: 823,
			isMobile: check.width === 412,
		});
		await page.goto(new URL(check.path, origin).href, {
			waitUntil: "networkidle0",
		});
		for (const selector of check.selectors)
			await page.waitForSelector(selector);
		await page.addScriptTag({ path: require.resolve("axe-core/axe.js") });
		const result = await page.evaluate(async (selectors) => {
			return window.axe.run(
				{ include: selectors.map((selector) => [selector]) },
				{
					runOnly: {
						type: "rule",
						values: ["label-content-name-mismatch", "button-name", "link-name"],
					},
				},
			);
		}, check.selectors);
		results.push({ name: check.name, result });
		console.log(
			`${check.name}: ${result.violations.reduce((n, rule) => n + rule.nodes.length, 0)} violations`,
		);
	}
	await writeFile(
		path.join(output, "control-names.json"),
		JSON.stringify(results, null, 2),
	);
	assert.ok(
		results.every(({ result }) => result.violations.length === 0),
		"Visible control labels must match their accessible names",
	);
} finally {
	await browser.close();
	await rm(profile, { recursive: true, force: true });
}
