// The titles a blog post links to, in the order the text names them, as "movie/129" or "show/1399". A remark plugin
// (vite.config.js) exports them from each compiled post as `linkedTitles`, so the post's link-preview card can show
// the first one's backdrop (server/og-image/blog-content.server.ts) without the post's source at run time.
// Plain JavaScript: vite.config.js imports it before anything is compiled.

const TITLE_LINK =
	/^(?:https:\/\/(?:www\.)?goodwatch\.app)?\/(movie|show|tv)\/(\d+)(?:[-/?#]|$)/

/**
 * The title an address of a title page names, such as "movie/129" for "/movie/129-spirited-away", or null.
 * @param {string} url
 * @returns {string | null}
 */
export function linkedTitle(url) {
	const match = TITLE_LINK.exec(url)
	if (!match || Number(match[2]) <= 0) return null
	return `${match[1] === "movie" ? "movie" : "show"}/${Number(match[2])}`
}

/**
 * Every title the tree's links name, first mention first, each once.
 * @param {{ type: string, url?: string, children?: unknown[] }} tree
 * @returns {string[]}
 */
export function linkedTitles(tree) {
	/** @type {string[]} */
	const found = []
	/** @param {any} node */
	const visit = (node) => {
		if (node.type === "link" && typeof node.url === "string") {
			const title = linkedTitle(node.url)
			if (title && !found.includes(title)) found.push(title)
		}
		for (const child of node.children ?? []) visit(child)
	}
	visit(tree)
	return found
}

/** Adds `export const linkedTitles = [...]` to every compiled post. */
export function remarkLinkedTitles() {
	/** @param {any} tree */
	return (tree) => {
		const elements = linkedTitles(tree).map((value) => ({
			type: "Literal",
			value,
			raw: JSON.stringify(value),
		}))
		tree.children.push({
			type: "mdxjsEsm",
			value: "",
			data: {
				estree: {
					type: "Program",
					sourceType: "module",
					comments: [],
					body: [
						{
							type: "ExportNamedDeclaration",
							specifiers: [],
							source: null,
							attributes: [],
							declaration: {
								type: "VariableDeclaration",
								kind: "const",
								declarations: [
									{
										type: "VariableDeclarator",
										id: { type: "Identifier", name: "linkedTitles" },
										init: { type: "ArrayExpression", elements },
									},
								],
							},
						},
					],
				},
			},
		})
	}
}
