// Runs inside the existing Lighthouse Docker image. It supplies Lighthouse's own Puppeteer page.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { installGuard, redactCredentials } from "./guard.mjs";
const { default: lighthouse } =
  await import("/usr/local/lib/node_modules/lighthouse/core/index.js");
const { default: desktopConfig } =
  await import("/usr/local/lib/node_modules/lighthouse/core/config/desktop-config.js");
const { default: puppeteer } =
  await import("/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js");
const options = JSON.parse(await readFile("/out/job.json", "utf8"));
const cookie = options.member
  ? (await readFile("/run/member-cookie", "utf8")).trim()
  : null;
await mkdir("/out/tmp", { recursive: true });
const browser = await puppeteer.launch({
  userDataDir: "/out/browser-profile",
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--no-first-run",
  ],
});
try {
  const page = await browser.newPage();
  const guard = await installGuard(page, {
    origin: new URL(options.url).origin,
    cookie: cookie || "gw_browser=1",
    blockAnalytics: options.blockAnalytics,
  });
  const flags = {
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    logLevel: "error",
    disableStorageReset: !!cookie,
  };
  if (options.device === "mobile")
    flags.throttling = { cpuSlowdownMultiplier: 2.7 };
  const { lhr } = await lighthouse(
    options.url,
    flags,
    options.device === "desktop" ? desktopConfig : undefined,
    page,
  );
  // Credentials must never appear in raw reports or stdout.
  const raw = JSON.stringify(cookie ? redactCredentials(lhr, cookie) : lhr);
  await writeFile("/out/report.json.gz", gzipSync(raw));
  await writeFile("/out/guard.json", JSON.stringify(guard));
} finally {
  await browser.close();
  await rm("/out/browser-profile", { recursive: true, force: true });
}
