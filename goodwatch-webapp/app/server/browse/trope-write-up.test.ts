import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { firstPoint } = await import("./trope-write-up.ts")
const { clean, segments, strongest, twistBand, visible } = await import("~/domain/tropes/pages")

const hidden = (p: { text: string; spoilers: [number, number][] }) =>
	p.spoilers.map(([a, b]) => p.text.slice(a, b))

test("an HTML spoiler span becomes a range over its words", () => {
	const p = firstPoint(
		'<ul><li>Ripley is the last one left, <span class="spoiler">along with the cat</span>.</li></ul>',
	)
	assert.equal(p.text, "Ripley is the last one left, along with the cat.")
	assert.deepEqual(hidden(p), ["along with the cat"])
})

test("the wiki form is a spoiler too, also when its closing marks are cut off", () => {
	const p = firstPoint(
		"<li>Sidney survives. [[spoiler:Her mother's killer is Billy.]] Then more.</li>",
	)
	assert.deepEqual(hidden(p), ["Her mother's killer is Billy."])
	const cut = firstPoint("<li>It looks like a win. [[spoiler:Until the last scene")
	assert.deepEqual(hidden(cut), ["Until the last scene"])
})

test("only the first point is read, without nested lists or indents", () => {
	const p = firstPoint(
		'<ul><li>First point.<ul><li>Nested reply.</li></ul></li><li>Second point.</li></ul><div class="indent">x</div>',
	)
	assert.equal(p.text, "First point.")
})

test("entities and tags flatten to plain text", () => {
	const p = firstPoint("<li><em>Jaws</em> &amp; its shark &#8212; never seen early.</li>")
	assert.equal(p.text, "Jaws & its shark — never seen early.")
	assert.deepEqual(p.spoilers, [])
})

test("a long write-up ends on its last whole sentence", () => {
	const sentence = "This sentence is exactly long enough to count. "
	const p = firstPoint(`<li>${sentence.repeat(10)}</li>`)
	assert.ok(p.text.length <= 320)
	assert.ok(p.text.endsWith("."))
	assert.ok(!p.text.endsWith("…"))
})

test("a spoiler that runs past the cut keeps the words that are left hidden", () => {
	const words = "word ".repeat(80)
	const p = firstPoint(`<li>Open. <span class="spoiler">${words}</span></li>`)
	assert.equal(p.spoilers.length, 1)
	assert.equal(p.spoilers[0][0], "Open. ".length)
	assert.ok(p.spoilers[0][1] <= p.text.length)
})

test("segments split a write-up into plain and hidden runs that cover it exactly", () => {
	const e = { text: "Before. Hidden part. After.", spoilers: [[8, 20]] as [number, number][] }
	const segs = segments(e)
	assert.deepEqual(
		segs.map((s) => [s.text, s.spoiler]),
		[
			["Before. ", false],
			["Hidden part.", true],
			[" After.", false],
		],
	)
	assert.equal(segs.map((s) => s.text).join(""), e.text)
	assert.equal(visible(e), e.text.length - 12)
})

test("a leading twist word goes when the tag says it, and the spoiler moves with the text", () => {
	const e = {
		play: "subverted" as const,
		text: "Subverted. The hero seems to die, but returns at the end of the film.",
		spoilers: [[33, 69]] as [number, number][],
	}
	const c = clean(e)
	assert.ok(c.text.startsWith("The hero"))
	assert.equal(c.text.slice(c.spoilers[0][0], c.spoilers[0][1]), e.text.slice(33, 69))
	const straight = { ...e, play: "straight" as const }
	assert.equal(clean(straight), straight)
})

test("the twist band reads the share of twisted write-ups", () => {
	assert.equal(twistBand(0.05), "rare")
	assert.equal(twistBand(0.126), "sometimes")
	assert.equal(twistBand(0.3), "often")
	assert.equal(twistBand(0.5), "half")
})

test("tie-in write-ups rank below ones about the film itself", () => {
	const title = (votes: number, key: number) =>
		({ card: { key, goodwatch_overall_score_voting_count: votes }, to: "/" }) as never
	const ex = (key: number, votes: number, text: string) => ({
		title: title(votes, key),
		as: null,
		play: "straight" as const,
		text,
		spoilers: [] as [number, number][],
	})
	const ranked = strongest([
		ex(
			1,
			2_000_000,
			"Done retroactively in the Expanded Universe, where a pilot is the sole survivor.",
		),
		ex(
			2,
			900_000,
			"Ripley is the lone survivor of the film, and she fights the creature alone at the end.",
		),
	])
	assert.equal((ranked[0].title.card as { key: number }).key, 2)
})

test("Ending and Death tropes hide their whole write-ups; ordinary tropes rely on the marks", async () => {
	const { tropeById } = await import("~/domain/tropes/catalog")
	assert.equal(tropeById("DownerEnding")?.spoilersOff, true)
	assert.equal(tropeById("HeroicSacrifice")?.spoilersOff, true)
	assert.equal(tropeById("ChekhovsGun")?.spoilersOff, false)
	assert.equal(tropeById("FinalGirl")?.spoilersOff, false)
})

const lead = (text: string) => {
	const { playOf } = playMod
	return clean({ play: playOf(text), text, spoilers: [] as [number, number][] }).text
}
const playMod = await import("~/domain/tropes/play")

test("real twist lead-ins leave a clean start", () => {
	assert.equal(
		lead(
			"Subverted. In the end, it seems like Paris is the only one who made it, but then Timmy shows up.",
		),
		"In the end, it seems like Paris is the only one who made it, but then Timmy shows up.",
	)
	assert.equal(
		lead("Averted when Sherry tries to sacrifice herself to the mangler to stop it."),
		"When Sherry tries to sacrifice herself to the mangler to stop it.",
	)
	assert.equal(
		lead(
			"Subverted with the final astronaut in the Action Prologue, who seems to be the Hero of Another Story.",
		),
		"The final astronaut in the Action Prologue, who seems to be the Hero of Another Story.",
	)
	assert.equal(
		lead(
			"Averted with an actual gun. Getting fired from his job causes Sergei to take a long look at the gun.",
		),
		"Getting fired from his job causes Sergei to take a long look at the gun.",
	)
	assert.equal(
		lead(
			"Played with and ultimately averted, although it does serve a purpose, as Alexander threatens suicide.",
		),
		"Although it does serve a purpose, as Alexander threatens suicide.",
	)
	assert.equal(
		lead("Averted brutally: Allison manages to escape and fatally wound Sutter."),
		"Allison manages to escape and fatally wound Sutter.",
	)
	assert.equal(
		lead("Downplayed but we see up close the serious physical toll even an average match takes."),
		"We see up close the serious physical toll even an average match takes.",
	)
	assert.equal(
		lead(
			"Discussed when, at Jason and Sarah's wedding, Ben complains that he hasn't had a meet-cute.",
		),
		"When, at Jason and Sarah's wedding, Ben complains that he hasn't had a meet-cute.",
	)
})

test("an opening that would leave a fragment stays as it is", () => {
	for (const text of [
		"Played with as nicely as possible because this is a kid's film. When Joy and Sadness's dog costume splits.",
		"Subverted in the remake. Rita tries to rescue Jeff and brings along the case.",
		"Subverted in the first film, but played completely straight in the second and third.",
		"Lampshaded, then the ditz turns out to be the smartest one in the room.",
		"Played with, as Josh mentions the flare gun on his boat when quizzing Gabe.",
		"Subverted with the digital recorder.",
	])
		assert.equal(lead(text), text)
})

test("a space before punctuation left by a link closes up", () => {
	const p = firstPoint(
		'<li>Subverted with the final astronaut in the <a href="#">Action Prologue</a> , Dr. Kerry Adkins ( a pilot ) .</li>',
	)
	assert.equal(
		p.text,
		"Subverted with the final astronaut in the Action Prologue, Dr. Kerry Adkins (a pilot).",
	)
})
