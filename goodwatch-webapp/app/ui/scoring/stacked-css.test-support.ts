import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { compile, optimize } from "@tailwindcss/node"
import { transform } from "esbuild"

export const PACKAGE_ROOT = fileURLToPath(new URL("../../../", import.meta.url))

/** The original matching contract, kept only for offline browser equivalence checks. */
export const ORIGINAL_STACKED_VARIANT = `@custom-variant stacked {
	@container seen (width < 21rem) {
		&:is([data-seen-score]:has([data-status-face]), [data-seen-score]:has([data-status-face]) *) { @slot; }
	}
	@media (width >= 64rem) {
		@container seen (width < 24rem) {
			&:is([data-seen-score][data-big]:has([data-status-face]), [data-seen-score][data-big]:has([data-status-face]) *) { @slot; }
		}
	}
}`

export function currentStackedVariant(): string {
	const sheet = readFileSync(
		new URL("../../tailwind.css", import.meta.url),
		"utf8",
	)
	const start = sheet.indexOf("@custom-variant stacked {")
	if (start < 0) throw new Error("Missing stacked variant")
	let depth = 0
	for (let i = sheet.indexOf("{", start); i < sheet.length; i++) {
		if (sheet[i] === "{") depth++
		if (sheet[i] === "}" && --depth === 0) return sheet.slice(start, i + 1)
	}
	throw new Error("Unclosed stacked variant")
}

/** Match @tailwindcss/vite's production optimizer and Vite's final esbuild CSS minifier. */
export async function compiledStackedCSS(
	variant: string,
	candidates: string[],
) {
	const compiler = await compile(
		`@import "tailwindcss" source(none);\n${variant}`,
		{
			base: PACKAGE_ROOT,
			onDependency: () => {},
		},
	)
	const css = optimize(compiler.build(candidates), { minify: true })
	return (
		await transform(css, {
			loader: "css",
			minify: true,
			target: ["chrome87", "edge88", "firefox78", "safari14"],
		})
	).code
}

export function stackedCandidates(): string[] {
	const faces = readFileSync(
		new URL("../details/hero/seen-score-faces.tsx", import.meta.url),
		"utf8",
	)
	return [
		...new Set(
			[...faces.matchAll(/\bstacked:[\w./-]+/g)].map((match) => match[0]),
		),
	]
}
