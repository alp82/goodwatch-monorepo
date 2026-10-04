// page-assets.mjs <base-url> <page-path> ...: prints the same-origin static files that a page's HTML references
// (scripts, module preloads, stylesheets, icons, the manifest, images, fonts in inline styles), one path per line.
// Files that scripts request later (lazy chunks, fonts named in stylesheets) aren't in the HTML and aren't listed.
const [base, ...pages] = process.argv.slice(2)
const found = new Set()
for (const page of pages) {
	const response = await fetch(`${base}${page}`, {
		headers: {
			Cookie: "gw_browser=1",
			"Accept-Language": "en-US,en;q=0.9",
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
		},
	})
	const html = await response.text()
	const pattern = /(?:href|src|content)="(\/[^"?#/][^"?#]*\.[a-z0-9]{2,11})"|["'(](\/assets\/[^"'()?#\s]+\.[a-z0-9]{2,5})["')]/g
	for (const match of html.matchAll(pattern)) {
		const path = match[1] ?? match[2]
		if (/\.(js|css|png|jpe?g|webp|avif|svg|ico|woff2?|ttf|webmanifest|json|txt|xml)$/.test(path)) found.add(path)
	}
}
console.log([...found].join("\n"))
