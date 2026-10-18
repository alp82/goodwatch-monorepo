// `/sitemap.xml` is where crawlers and people look for a sitemap first. The sitemap index that Search Console knows is
// `/sitemaps/sitemap.xml` (robots.txt names it too), so the root address points there for good.
import { redirect } from "@remix-run/node"

export const SITEMAP_INDEX_PATH = "/sitemaps/sitemap.xml"

export const loader = () =>
	redirect(SITEMAP_INDEX_PATH, {
		status: 301,
		headers: { "Cache-Control": "public, max-age=86400" },
	})
