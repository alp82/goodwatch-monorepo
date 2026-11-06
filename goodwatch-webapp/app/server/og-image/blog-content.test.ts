// A blog post's link-preview card: its own kind, headline and preview line from posts.json, and the backdrop of the
// first title it links to that has one.
import "react"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { BlogPost } from "../../utils/blog-structured-data.ts"

const { blogCardContent, previewLine } = await import(
	"./blog-content.server.ts"
)
const { SUBTEXT_MAX_LENGTH } = await import("../../ui/og-image/copy.ts")
const { default: posts } = (await import("../../content/blog/posts.json", {
	with: { type: "json" },
})) as { default: BlogPost[] }

const POST: BlogPost = {
	slug: "letterboxd-vs-imdb",
	title: "Letterboxd loves it. IMDb doesn't.",
	description:
		"Where the two crowds split hardest, from 4,000 movies both rate, and what each one sees that the other misses.",
	kind: "Data study",
	published: "2026-11-01",
	updated: "2026-11-01",
	card: { preview_line: "Where the two crowds split." },
}

function deps({
	linked = ["movie/550", "show/1399"] as readonly string[] | null,
	backdrops = { "movie/550": "fight-club.jpg" } as Record<string, string>,
} = {}) {
	const asked: string[] = []
	return {
		asked,
		deps: {
			post: (slug: string) => (slug === POST.slug ? POST : undefined),
			linkedTitles: (slug: string) => (slug === POST.slug ? linked : null),
			backdrop: async (type: "movie" | "show", id: number) => {
				asked.push(`${type}/${id}`)
				return backdrops[`${type}/${id}`] ?? null
			},
			fallbackBackdrop: async () => "top-scored.jpg",
		},
	}
}

test("a post's card is its kind, headline, preview line and first linked title's backdrop", async () => {
	const { deps: d, asked } = deps()
	assert.deepEqual(await blogCardContent(`/blog/${POST.slug}`, d), {
		kind: "collection",
		tag: "Data study",
		title: "Letterboxd loves it. IMDb doesn't.",
		subtitle: "Where the two crowds split.",
		backdrop: "fight-club.jpg",
		providerId: null,
	})
	assert.deepEqual(asked, ["movie/550"])
})

test("a linked title without a backdrop hands over to the next, and a post with none to the fallback", async () => {
	const next = deps({ backdrops: { "show/1399": "got.jpg" } })
	assert.equal(
		(await blogCardContent(`/blog/${POST.slug}`, next.deps))?.backdrop,
		"got.jpg",
	)
	assert.deepEqual(next.asked, ["movie/550", "show/1399"])
	const none = deps({ linked: [] })
	assert.equal(
		(await blogCardContent(`/blog/${POST.slug}`, none.deps))?.backdrop,
		"top-scored.jpg",
	)
	assert.deepEqual(none.asked, [])
})

test("an unknown post, or one without text, has no card", async () => {
	assert.equal(await blogCardContent("/blog/nope", deps().deps), null)
	assert.equal(
		await blogCardContent(`/blog/${POST.slug}`, deps({ linked: null }).deps),
		null,
	)
})

test("without a preview line the card shows a short description, and a long one not at all", () => {
	const { card: _, ...plain } = POST
	assert.equal(previewLine(plain), "")
	assert.equal(
		previewLine({ ...plain, description: "Four sources, one number." }),
		"Four sources, one number.",
	)
})

test("every post's preview line fits on its card", () => {
	for (const post of posts)
		assert.ok(
			previewLine(post).length <= SUBTEXT_MAX_LENGTH,
			`${post.slug}: ${previewLine(post)}`,
		)
})
