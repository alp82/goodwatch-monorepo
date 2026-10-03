import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function build(args = process.argv.slice(2)) {
  const options = {
    sitemaps: fileURLToPath(new URL("../../goodwatch-webapp/public/sitemaps/", import.meta.url)),
    out: fileURLToPath(new URL("../urls/longtail.json", import.meta.url)),
    limit: Infinity,
    seed: "1",
    "og-share": 0.1,
  };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    if (!(key in options) || args[i + 1] === undefined) throw new Error(`Unknown or incomplete option: ${args[i]}`);
    options[key] = args[i + 1];
  }
  const limit = Number(options.limit),
    share = Number(options["og-share"]);
  if (!(limit > 0 && (limit === Infinity || Number.isInteger(limit))) || !(share >= 0 && share <= 1))
    throw new Error("Invalid limit or OG share");
  let seed = 2166136261;
  for (const char of String(options.seed)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const paths = new Set();
  const decode = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  for (const file of (await readdir(options.sitemaps)).filter((f) => /^sitemap_.*\.xml$/.test(f)).sort()) {
    const xml = await readFile(resolve(options.sitemaps, file), "utf8");
    // Sitemap indexes contain document locations, not request targets.
    if (!/<(?:\w+:)?urlset\b/.test(xml)) continue;
    for (const match of xml.matchAll(/<(?:\w+:)?loc>\s*([^<]+)\s*<\/(?:\w+:)?loc>/g)) {
      const url = new URL(decode(match[1].trim()));
      paths.add(url.pathname + url.search);
    }
  }
  const shuffled = [...paths];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const route = (path) =>
    path.startsWith("/movie/")
      ? "title_movie"
      : path.startsWith("/show/")
        ? "title_show"
        : path === "/"
          ? "home"
          : path.split("?")[0] === "/discover"
            ? "discover"
            : "other";
  const entries = shuffled
    .slice(0, limit)
    .map((path) => ({ route: route(path), path, weight: 1, client: "browser", expect: [200] }));
  const titles = entries.filter((e) => ["title_movie", "title_show"].includes(e.route));
  for (const entry of titles.slice(0, Math.floor(titles.length * share)))
    entries.push({
      route: "og_title",
      path: `/og${entry.path.split("?")[0]}.png`,
      weight: 1,
      client: "bot",
      expect: [200],
    });
  await mkdir(dirname(resolve(options.out)), { recursive: true });
  await writeFile(
    options.out,
    JSON.stringify(
      {
        name: "longtail",
        description: `Seed ${options.seed}; ${entries.length} entries from checked-in sitemaps.`,
        entries,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${entries.length} entries (${titles.length} titles) to ${options.out}`);
  return entries;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  build().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
