// Run against the development harness. Optional: PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE_PATH, HARNESS, SHOTS.
const { chromium } = await import(
	process.env.PLAYWRIGHT_MODULE ?? "playwright-core"
);
import assert from "node:assert/strict";
const browser = await chromium.launch({
	headless: true,
	executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
let checks = 0;
try {
	for (const width of [390, 1280])
		for (const guest of [true, false]) {
			const context = await browser.newContext({
				viewport: { width, height: 900 },
			});
			const page = await context.newPage();
			const errors = [];
			const trackingRequests = [];
			page.on("request", (request) => {
				if (new URL(request.url()).pathname.startsWith("/api/tracking/"))
					trackingRequests.push(request.method());
			});
			page.on("pageerror", (e) => errors.push(e.message));
			await page.goto(
				`${process.env.HARNESS ?? "http://127.0.0.1:3098"}/prototype/episode-tracking-real?show=supernatural&scenario=watching&today=2026-10-18${guest ? "&guest=1" : ""}`,
				{ timeout: 90000, waitUntil: "domcontentloaded" },
			);
			await page.locator("[data-harness]").waitFor({ timeout: 60000 });
			const section = page.locator(
				guest ? "#episode-ratings" : "[data-episode-list]",
			);
			await section.scrollIntoViewIfNeeded();
			await section
				.locator("[data-morph-cell]")
				.first()
				.waitFor({ timeout: 30000 });
			await page.waitForTimeout(800);
			assert.equal(await page.locator("[data-grid-layout]").count(), 0);
			checks++;
			const tiles = section.locator("[data-morph-cell]");
			const count = await tiles.count();
			assert.equal(count, 327);
			checks++;
			assert.ok((await tiles.first().innerText()).match(/\d\.\d/));
			checks++;
			await section
				.getByRole("radio", { name: "Consistency", exact: true })
				.click();
			await page.waitForTimeout(600);
			assert.equal(
				await section.locator("[data-morph]").getAttribute("data-morph"),
				"chart",
			);
			checks++;
			await section.getByRole("radio", { name: "Grid", exact: true }).click();
			await page.waitForTimeout(600);
			assert.equal(await tiles.count(), count);
			checks++;
			await tiles.first().click();
			await section.locator("[data-open-season]").first().waitFor();
			checks++;
			assert.equal(
				await section.locator("[data-season-panel]").count(),
				guest ? 0 : 1,
			);
			checks++;
			assert.equal(
				(await section.locator("[data-watched]").count()) > 0,
				!guest,
			);
			checks++;
			const overflow = await section.evaluate(
				(e) => e.scrollWidth - e.clientWidth,
			);
			assert.ok(overflow <= 1, `overflow ${width} guest=${guest}: ${overflow}`);
			checks++;
			assert.deepEqual(errors, []);
			checks++;
			if (guest) {
				assert.deepEqual(trackingRequests, []);
				checks++;
			}
			await tiles.first().focus();
			await page.keyboard.press("ArrowRight");
			assert.equal(
				await tiles.nth(1).getAttribute("data-morph-cell"),
				await page.evaluate(() =>
					document.activeElement?.getAttribute("data-morph-cell"),
				),
			);
			checks++;
			await page.screenshot({
				path: `${process.env.SHOTS ?? "/tmp"}/grid-${width}-${guest ? "guest" : "member"}.png`,
				fullPage: false,
			});
			console.log(
				`${width}px ${guest ? "guest" : "member"} passed (${count} tiles)`,
			);
			await context.close();
		}
	console.log(`${checks} browser assertions passed`);
} finally {
	await browser.close();
}
