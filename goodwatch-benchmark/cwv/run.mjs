#!/usr/bin/env node
// A repeatable homepage lab check. The host launches the pinned browser image; all browser traffic is read-only.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const IMAGE = "gw-bench-lighthouse:13.5.0-6dd25f05";
export const SCENARIOS = [
	"mobile-fresh-early",
	"mobile-returning-early",
	"mobile-fresh-settled",
	"mobile-returning-settled",
	"desktop-fresh-loading",
	"desktop-returning-loading",
];
export const LIMITED_NETWORK = {
	offline: false,
	latency: 150,
	downloadThroughput: (1.6 * 1024 * 1024) / 8,
	uploadThroughput: (750 * 1024) / 8,
};
const SEARCH = "#start-search-input";
const MOOD = ".start-moods button[aria-expanded]";
const PANEL = '[role="dialog"][aria-label="Picks"]';
const TEXT = "funny sci-fi";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeUrl = (value) => {
	try {
		const url = new URL(value);
		return url.origin + url.pathname;
	} catch {
		return String(value).slice(0, 160);
	}
};

export function parseOptions(args, now = new Date()) {
	const options = {
		baseUrl: "",
		runs: 3,
		mobileCpu: 6,
		scenarios: [...SCENARIOS],
		trace: false,
		variant: "candidate",
		out: path.resolve(
			"results",
			`${now.toISOString().replace(/[:.]/g, "-")}-cwv`,
		),
	};
	for (let i = 0; i < args.length; i++) {
		const key = args[i];
		if (key === "--trace") {
			options.trace = true;
			continue;
		}
		if (key === "--help" || key === "-h") return { help: true };
		if (!args[i + 1]) throw new Error(`Missing value for ${key}`);
		const value = args[++i];
		if (key === "--base-url") options.baseUrl = value;
		else if (key === "--runs") options.runs = Number(value);
		else if (key === "--mobile-cpu") options.mobileCpu = Number(value);
		else if (key === "--scenarios") options.scenarios = value.split(",");
		else if (key === "--out") options.out = path.resolve(value);
		else if (key === "--variant") options.variant = value;
		else throw new Error(`Unknown option ${key}`);
	}
	if (!options.baseUrl)
		throw new Error(
			"An explicit --base-url is required; use the isolated localhost fixture origin",
		);
	const url = new URL(options.baseUrl);
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.pathname !== "/" ||
		url.search ||
		url.hash ||
		url.username ||
		url.password
	)
		throw new Error("--base-url must be a plain HTTP(S) origin");
	options.baseUrl = url.origin;
	if (!Number.isFinite(options.mobileCpu) || options.mobileCpu < 1 || options.mobileCpu > 20)
		throw new Error("--mobile-cpu must be a number from 1 to 20");
	if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 20)
		throw new Error("--runs must be an integer from 1 to 20");
	if (
		!options.scenarios.length ||
		options.scenarios.some((name) => !SCENARIOS.includes(name)) ||
		new Set(options.scenarios).size !== options.scenarios.length
	)
		throw new Error(
			`--scenarios must select unique names from ${SCENARIOS.join(",")}`,
		);
	if (!/^[a-z0-9-]+$/.test(options.variant))
		throw new Error(
			"--variant must use lower-case letters, digits and hyphens",
		);
	return options;
}

/** CPU emulation is relative to this host; explicit fractional rates allow a matched model on another generator. */
export function scenarioCpuSlowdown(scenario, options) {
	return scenario.startsWith("mobile-") ? (options.mobileCpu ?? 6) : 1;
}

/** All methods other than GET/HEAD are blocked, even on localhost. Analytics GET beacons are blocked too. */
export function requestBlockReason(method, address, resourceType = "") {
	if (method !== "GET" && method !== "HEAD") return "write-method";
	let url;
	try {
		url = new URL(address);
	} catch {
		return "invalid-url";
	}
	if (!["http:", "https:", "data:", "blob:"].includes(url.protocol))
		return "unsupported-protocol";
	if (/\/api\/(?:update-|poster-impressions|og-image-warm)/.test(url.pathname))
		return "mutating-endpoint";
	if (/\/(?:i\/v0\/e|e|capture|batch|track|ingest)(?:\/|$)/.test(url.pathname))
		return "telemetry-endpoint";
	if (
		/(?:^|\.)(?:sentry\.io|faststats\.dev|faststats\.app)$/.test(
			url.hostname,
		) &&
		resourceType !== "script"
	)
		return "telemetry-host";
	if (
		url.hostname === "a.goodwatch.app" &&
		!url.pathname.startsWith("/static/")
	)
		return "telemetry-host";
	return null;
}

/** Classify intentional guard aborts separately; only explicit search-driven fetch cancellations are expected. */
export function createRequestGuard(result) {
	const blocked = new WeakSet()
	return {
		request(request) {
			const entry = { method: request.method(), url: safeUrl(request.url()), type: request.resourceType() }
			const reason = requestBlockReason(entry.method, request.url(), entry.type)
			if (reason) {
				blocked.add(request)
				result.blocked.push({ ...entry, reason })
				void request.abort().catch(() => {})
			} else {
				result.requests.push(entry)
				void request.continue().catch(() => {})
			}
		},
		failed(request) {
			if (blocked.has(request)) return
			const error = request.failure()?.errorText || "unknown"
			if (error === "net::ERR_ABORTED" && ["fetch", "xhr"].includes(request.resourceType()) && ["search-clear", "search-type"].includes(result.activeAction)) {
				result.expectedCancellations.push({ url: safeUrl(request.url()), type: request.resourceType(), error, action: result.activeAction })
				return
			}
			result.errors.push(`requestfailed: ${request.method()} ${safeUrl(request.url())} ${error}`)
		},
	}
}

/** A successful HTTP response and a historical LCP do not prove the route survived its client updates. */
export function homePageFailures(snapshot) {
	const failures = []
	if (!snapshot || snapshot.pathname !== "/") failures.push("Final route is not the homepage")
	if (snapshot?.heading !== "Find something to watch") failures.push("Final homepage heading is missing or replaced")
	if (!snapshot?.hasStartStage || !snapshot?.hasSearchInput) failures.push("Final homepage controls were replaced or removed")
	if (snapshot?.errorDocumentTitle) failures.push("Final document shows the root ErrorBoundary")
	return failures
}

/** Deliberately aborted network-resource messages are handled by the request guard, not blanket console rejection. */
export function consoleRuntimeFailure(type, text) {
	return type === "error" && /hydration|hydrat|Minified React error|Warning:.*(?:match|server HTML|hydrating)|\b(?:TypeError|ReferenceError|RangeError|SyntaxError)\b|(?:above )?error occurred in/i.test(text)
}

export function summarizeAction(action, events, trusted) {
	const measured = events.filter(
		(event) => event.start >= action.start && event.start <= action.end,
	);
	const inputs = trusted.filter((event) => event.action === action.name);
	return {
		...action,
		events: measured,
		trustedInputCount: inputs.length,
		maxEventDurationMs: Math.max(0, ...measured.map((event) => event.duration)),
		eventTimingFloorMs: 16,
	};
}

function instrumentation(returning) {
	if (window !== window.top) return;
	if (returning) sessionStorage.setItem("gw-start-boot-seen", "1");
	else sessionStorage.removeItem("gw-start-boot-seen");
	const state = (window.__cwv = {
		lcp: [],
		events: [],
		trusted: [],
		longTasks: [],
		action: null,
		supported: PerformanceObserver.supportedEntryTypes,
		observers: [],
	});
	const category = (target) =>
		target?.closest?.(".start-bar")
			? "search"
			: target?.closest?.(".start-moods")
				? "moods"
				: target?.closest?.('[role="dialog"][aria-label="Picks"]')
					? "mood-panel"
					: "other";
	const observe = (type, consume, extra = {}) => {
		if (!state.supported.includes(type)) return;
		const observer = new PerformanceObserver((list) =>
			consume(list.getEntries()),
		);
		observer.observe({ type, buffered: true, ...extra });
		state.observers.push({ observer, consume });
	};
	observe("largest-contentful-paint", (entries) =>
		state.lcp.push(
			...entries.map((entry) => ({
				time: entry.startTime,
				renderTime: entry.renderTime,
				loadTime: entry.loadTime,
				size: entry.size,
				target: entry.element?.closest?.(".start-room-picture")
					? "room"
					: entry.element?.tagName?.toLowerCase() || "unknown",
				url: entry.url
					? new URL(entry.url).origin + new URL(entry.url).pathname
					: "",
			})),
		),
	);
	observe(
		"event",
		(entries) =>
			state.events.push(
				...entries
					.filter((entry) => entry.interactionId)
					.map((entry) => ({
						name: entry.name,
						start: entry.startTime,
						duration: entry.duration,
						processingStart: entry.processingStart,
						processingEnd: entry.processingEnd,
						inputDelay: entry.processingStart - entry.startTime,
						processing: entry.processingEnd - entry.processingStart,
						presentationEstimate: Math.max(
							0,
							entry.startTime + entry.duration - entry.processingEnd,
						),
						interactionId: entry.interactionId,
						target: category(entry.target),
					})),
			),
		{ durationThreshold: 16 },
	);
	observe("longtask", (entries) =>
		state.longTasks.push(
			...entries.map((entry) => ({
				start: entry.startTime,
				duration: entry.duration,
			})),
		),
	);
	for (const name of ["pointerdown", "click", "keydown", "input"])
		document.addEventListener(
			name,
			(event) => {
				if (state.action && event.isTrusted)
					state.trusted.push({
						action: state.action,
						name,
						time: performance.now(),
						target: category(event.target),
					});
			},
			{ capture: true, passive: true },
		);
	state.flush = () => {
		for (const item of state.observers)
			item.consume(item.observer.takeRecords());
	};
}

async function measure(browser, options, name, run) {
	const mobile = name.startsWith("mobile-");
	const returning = name.includes("-returning-");
	const early = name.endsWith("-early");
	const id = `${options.variant}-${name}-${run}`;
	const context = await browser.createBrowserContext();
	const page = await context.newPage();
	const result = {
		id,
		scenario: name,
		run,
		variant: options.variant,
		recordedAt: new Date().toISOString(),
		baseUrl: options.baseUrl,
		viewport: mobile
			? {
					width: 390,
					height: 844,
					deviceScaleFactor: 1,
					isMobile: true,
					hasTouch: true,
				}
			: { width: 1365, height: 900, deviceScaleFactor: 1 },
		cpuSlowdown: scenarioCpuSlowdown(name, options),
		network: mobile
			? null
			: { label: "custom-150ms-209715.2-bytes-per-second", ...LIMITED_NETWORK },
		bootState: returning ? "returning" : "fresh",
		cache: "disabled; new isolated browser context",
		actions: [],
		errors: [],
		blocked: [],
		expectedCancellations: [],
		activeAction: null,
		requests: [],
		responses: [],
		failures: [],
	};
	let tracing = false;
	try {
		if (mobile)
			await page.emulate({
				viewport: result.viewport,
				userAgent: `Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${(await browser.version()).split("/").at(-1)} Mobile Safari/537.36`,
			});
		else await page.setViewport(result.viewport);
		await page.setBypassServiceWorker(true);
		await page.setCacheEnabled(false);
		await page.setRequestInterception(true);
		const guard = createRequestGuard(result)
		page.on("request", guard.request)
		page.on("requestfailed", guard.failed)
		page.on("response", (response) => {
			const entry = {
				url: safeUrl(response.url()),
				status: response.status(),
				type: response.request().resourceType(),
			};
			result.responses.push(entry);
			if (
				entry.status >= 400 &&
				["document", "script", "stylesheet", "font", "image"].includes(
					entry.type,
				)
			)
				result.errors.push(`HTTP ${entry.status} ${entry.type} ${entry.url}`);
		});
		page.on("pageerror", (error) =>
			result.errors.push(`pageerror: ${error.message}`),
		);
		page.on("console", (message) => {
			if (consoleRuntimeFailure(message.type(), message.text()))
				result.errors.push(`console: ${message.text().slice(0, 400)}`);
		});
		const cdp = await page.createCDPSession();
		await cdp.send("Network.enable");
		await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
		await cdp.send("Emulation.setCPUThrottlingRate", {
			rate: result.cpuSlowdown,
		});
		if (!mobile)
			await cdp.send("Network.emulateNetworkConditions", LIMITED_NETWORK);
		await page.evaluateOnNewDocument(instrumentation, returning);
		if (options.trace) {
			await page.tracing.start({
				path: `/out/${id}.trace.json`,
				categories: [
					"devtools.timeline",
					"v8.execute",
					"blink.user_timing",
					"loading",
					"disabled-by-default-v8.cpu_profiler",
				],
			});
			tracing = true;
		}
		const response = await page.goto(options.baseUrl + "/", {
			waitUntil: "domcontentloaded",
			timeout: 90000,
		});
		result.status = response?.status();
		if (result.status !== 200)
			throw new Error(`Homepage returned ${result.status}`);
		await page.waitForFunction(
			() =>
				document.querySelector(".start-room-picture img") &&
				window.__cwv?.supported.includes("largest-contentful-paint"),
			{ timeout: 60000 },
		);
		if (mobile) {
			await page.waitForFunction(
				(selector) => {
					const input = document.querySelector(selector);
					return (
						input &&
						Object.keys(input).some(
							(key) =>
								key.startsWith("__reactProps$") ||
								key.startsWith("__reactFiber$"),
						)
					);
				},
				{ timeout: 60000, polling: 25 },
				SEARCH,
			);
			result.hydratedAt = await page.evaluate(() => performance.now());
			const checked = await page.$eval(
				"#start-boot-gate",
				(gate) => gate.checked,
			);
			if (checked !== returning)
				throw new Error(
					`Boot gate ${checked} does not match ${result.bootState} session`,
				);
			if (!early) await sleep(3000);
			const tap = async (selector) => {
				const element = await page.waitForSelector(selector, {
					visible: true,
					timeout: 15000,
				});
				let box = await element.boundingBox();
				if (!box) throw new Error(`No visible box for ${selector}`);
				if (box.y < 0 || box.y + box.height > result.viewport.height) {
					await element.evaluate((el) =>
						el.scrollIntoView({ block: "center", behavior: "instant" }),
					);
					box = await element.boundingBox();
				}
				if (!box || box.width <= 0 || box.height <= 0)
					throw new Error(`Cannot tap ${selector}`);
				await page.touchscreen.tap(
					box.x + box.width / 2,
					box.y + box.height / 2,
				);
			};
			const action = async (actionName, perform, assertion, settle = 300) => {
				result.activeAction = actionName
				const item = {
					name: actionName,
					start: await page.evaluate((active) => {
						window.__cwv.action = active;
						return performance.now();
					}, actionName),
					success: false,
				};
				try {
					await perform();
					await page.waitForFunction(assertion, { timeout: 15000 });
					await sleep(settle);
					item.success = true;
				} catch (error) {
					item.error = error.message;
					throw error;
				} finally {
					item.end = await page.evaluate(() => {
						window.__cwv.flush();
						window.__cwv.action = null;
						return performance.now();
					});
					result.actions.push(item);
					result.activeAction = null;
				}
			};
			await action(
				"search-focus",
				() => tap(SEARCH),
				() =>
					document.activeElement ===
					document.querySelector("#start-search-input"),
			);
			await action(
				"search-type",
				() => page.keyboard.type(TEXT, { delay: 100 }),
				() =>
					document.querySelector("#start-search-input")?.value ===
						"funny sci-fi" &&
					new URLSearchParams(location.search).get("q") === "funny sci-fi",
			);
			await action(
				"search-clear",
				() => tap('[aria-label="Clear the search"]'),
				() =>
					document.querySelector("#start-search-input")?.value === "" &&
					!new URLSearchParams(location.search).has("q"),
			);
			await action(
				"mood-open",
				() => tap(MOOD),
				() =>
					document.querySelector('.start-moods button[aria-expanded="true"]') &&
					document.querySelector(
						'[role="dialog"][aria-label="Picks"] [data-choice]',
					),
			);
			await action(
				"mood-escape",
				() => page.keyboard.press("Escape"),
				() =>
					!document.querySelector('[role="dialog"][aria-label="Picks"]') &&
					document.querySelector(
						'.start-moods button[aria-expanded="false"]',
					) === document.activeElement,
			);
			await action(
				"mood-reopen",
				() => tap(MOOD),
				() =>
					document.querySelector(
						'[role="dialog"][aria-label="Picks"] [data-choice]',
					),
			);
			await action(
				"mood-done",
				async () => {
					const done = await page.evaluateHandle(
						(selector) =>
							[...document.querySelectorAll(`${selector} button`)].find(
								(button) => button.textContent.trim() === "Done",
							),
						PANEL,
					);
					const element = done.asElement();
					if (!element) throw new Error("Mood panel has no Done button");
					const box = await element.boundingBox();
					if (!box) throw new Error("Done is invisible");
					await page.touchscreen.tap(
						box.x + box.width / 2,
						box.y + box.height / 2,
					);
					await done.dispose();
				},
				() =>
					!document.querySelector('[role="dialog"][aria-label="Picks"]') &&
					document.querySelector(".start-stage[data-open]"),
				900,
			);
		} else {
			// No interaction stops LCP early. This fixed wait begins after HTML has arrived, under the explicit network.
			await sleep(6000);
			await page.waitForFunction(
				() =>
					[...document.querySelectorAll(".start-room-picture img")].some(
						(img) =>
							img.currentSrc.startsWith("http") &&
							img.complete &&
							img.naturalWidth > 0,
					),
				{ timeout: 60000 },
			);
			await sleep(1000);
		}
	} catch (error) {
		result.errors.push(`measurement: ${error.message}`);
	} finally {
		try {
			result.perf = await page.evaluate(() => {
				window.__cwv?.flush();
				return {
					homePage: {
						pathname: location.pathname,
						heading: document.querySelector("h1")?.textContent?.trim() || null,
						hasStartStage: Boolean(document.querySelector(".start-stage")),
						hasSearchInput: Boolean(document.querySelector("#start-search-input")),
						errorDocumentTitle: /^(Something went wrong|Page not found) \|/.test(document.title),
					},
					lcp: window.__cwv?.lcp || [],
					events: window.__cwv?.events || [],
					trusted: window.__cwv?.trusted || [],
					longTasks: window.__cwv?.longTasks || [],
					supported: window.__cwv?.supported || [],
					navigation: performance
						.getEntriesByType("navigation")
						.map((entry) => entry.toJSON()),
					resources: performance
						.getEntriesByType("resource")
						.map((entry) => ({
							url: new URL(entry.name).origin + new URL(entry.name).pathname,
							initiatorType: entry.initiatorType,
							start: entry.startTime,
							duration: entry.duration,
							encodedBodySize: entry.encodedBodySize,
							transferSize: entry.transferSize,
						})),
				};
			});
			result.finalPage = result.perf.homePage;
			result.failures.push(...homePageFailures(result.finalPage));
			result.actions = result.actions.map((item) =>
				summarizeAction(item, result.perf.events, result.perf.trusted),
			);
			result.maxEventDurationMs = Math.max(
				0,
				...result.actions.map((item) => item.maxEventDurationMs),
			);
			result.lcp = result.perf.lcp.at(-1) || null;
			if (mobile) {
				if (!result.perf.supported.includes("event"))
					result.failures.push("Event Timing unsupported");
				if (
					result.actions.length !== 7 ||
					result.actions.some(
						(item) => !item.success || item.trustedInputCount === 0,
					)
				)
					result.failures.push(
						"A scripted action had no asserted effect or trusted input",
					);
				if (result.maxEventDurationMs > 200)
					result.failures.push(
						`Event Timing interaction proxy ${result.maxEventDurationMs}ms >200ms`,
					);
			} else if (
				!result.lcp ||
				result.lcp.target !== "room" ||
				result.lcp.time > 2500
			)
				result.failures.push(
					`Desktop room LCP ${result.lcp?.time ?? "missing"}ms exceeds 2500ms or wrong target`,
				);
			await page.screenshot({ path: `/out/${id}.png`, fullPage: false });
		} catch (error) {
			result.errors.push(`collection: ${error.message}`);
		}
		if (tracing)
			try {
				await page.tracing.stop();
			} catch (error) {
				result.errors.push(`trace: ${error.message}`);
			}
		// Closing the context deliberately cancels remaining background requests; the measured window ends here.
		page.removeAllListeners("requestfailed");
		page.removeAllListeners("pageerror");
		page.removeAllListeners("console");
		result.pass = result.errors.length === 0 && result.failures.length === 0;
		await writeFile(`/out/${id}.json`, JSON.stringify(result, null, 2) + "\n");
		await context.close();
	}
	return result;
}

async function inside(options) {
	const require = createRequire("/usr/local/lib/node_modules/lighthouse/");
	const puppeteer = require("puppeteer-core");
	const browser = await puppeteer.launch({
		executablePath: "/usr/bin/chromium",
		headless: true,
		acceptInsecureCerts: true,
		args: [
			"--no-sandbox",
			"--disable-dev-shm-usage",
			"--disable-background-networking",
			"--ignore-certificate-errors",
		],
	});
	const summary = {
		schemaVersion: 1,
		variant: options.variant,
		baseUrl: options.baseUrl,
		browser: await browser.version(),
		image: IMAGE,
		runs: options.runs,
		cpuSlowdown: { mobile: options.mobileCpu ?? 6, desktop: 1 },
		thresholds: { maxObservedEventDurationMs: 200, desktopLcpMs: 2500 },
		interpretation:
			"Event Timing action maximum is a lab interaction proxy, not field INP or its p75. Entries below 16ms may be absent; trusted input and DOM assertions separately prove each action ran. Presentation estimates inherit Event Timing 8ms rounding.",
		measurements: [],
	};
	try {
		for (let run = 1; run <= options.runs; run++)
			for (const name of options.scenarios) {
				console.error(
					`CWV ${options.variant} ${name} run${run}/${options.runs}`,
				);
				const result = await measure(browser, options, name, run);
				const line = {
					id: result.id,
					scenario: name,
					run,
					pass: result.pass,
					cpuSlowdown: result.cpuSlowdown,
					maxEventDurationMs: result.maxEventDurationMs ?? null,
					lcpMs: result.lcp?.time ?? null,
					errors: result.errors,
					failures: result.failures,
					actions: result.actions.map(
						({ name, success, trustedInputCount, maxEventDurationMs }) => ({
							name,
							success,
							trustedInputCount,
							maxEventDurationMs,
						}),
					),
				};
				summary.measurements.push(line);
				console.log(JSON.stringify(line));
			}
	} finally {
		summary.pass =
			summary.measurements.length === options.runs * options.scenarios.length &&
			summary.measurements.every((result) => result.pass);
		await writeFile(
			"/out/summary.json",
			JSON.stringify(summary, null, 2) + "\n",
		);
		await browser.close();
	}
	return summary.pass ? 0 : 1;
}

const usage = `Usage: ./bench.sh cwv --base-url https://127.0.0.1:PORT [--runs 3] [--mobile-cpu 6] [--variant baseline|candidate]\n  [--scenarios ${SCENARIOS.join(",")}] [--out DIR] [--trace]\nRequires existing Docker image ${IMAGE}. No writes are forwarded, including to localhost.\nSix scenarios run sequentially; default 3 repetitions. Failing baseline measurements exit 1 intentionally.\n`;
async function main() {
	if (process.argv[2] === "--inside-container")
		return inside(JSON.parse(process.env.CWV_CONFIG_JSON));
	const options = parseOptions(process.argv.slice(2));
	if (options.help) {
		console.log(usage);
		return 0;
	}
	await mkdir(options.out, { recursive: true });
	const args = [
		"run",
		"--rm",
		"--init",
		"--network",
		"host",
		"--shm-size=1g",
		"--entrypoint",
		"node",
		"--user",
		`${process.getuid()}:${process.getgid()}`,
		"-e",
		"HOME=/tmp",
		"-e",
		`CWV_CONFIG_JSON=${JSON.stringify(options)}`,
		"-v",
		`${options.out}:/out`,
		"-v",
		`${path.dirname(fileURLToPath(import.meta.url))}:/cwv:ro`,
		IMAGE,
		"/cwv/run.mjs",
		"--inside-container",
	];
	await writeFile(
		path.join(options.out, "config.json"),
		JSON.stringify({ ...options, image: IMAGE }, null, 2) + "\n",
	);
	const exitCode = await new Promise((resolve, reject) => {
		const child = spawn("docker", args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code, signal) => resolve(signal ? 2 : (code ?? 2)));
	});
	console.error(`Run directory: ${options.out}`);
	return exitCode;
}
if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(error.message);
			process.exitCode = 2;
		});
