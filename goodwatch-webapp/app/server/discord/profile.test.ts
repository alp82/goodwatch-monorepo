import assert from "node:assert/strict"
import { test } from "node:test"
import { routeInteraction, type Dependencies } from "./router.server.ts"
import { commands } from "./commands.ts"
import { EPHEMERAL, type Component } from "./cards.ts"
import { parseListId } from "./custom-id.ts"
import {
	PROFILE_CARDS,
	type MemberProfile,
	type ProfileCardChoice,
} from "./profile-cards.ts"
import { DEFAULT_VISIBILITY } from "../../domain/profile.ts"
import { PROFILE_CARD_TABS } from "../../ui/og-image/profile-card-model.ts"

type Body = { flags: number; components: Component[] }
const flatten = (cs: Component[]): Component[] =>
	cs.flatMap((c) => [
		c,
		...flatten(c.components ?? []),
		...(c.accessory ? flatten([c.accessory]) : []),
	])
const buttons = (b: Body) => flatten(b.components).filter((c) => c.type === 2)
const text = (b: Body) =>
	flatten(b.components)
		.filter((c) => c.type === 10)
		.map((c) => c.content)
		.join("\n")
const image = (b: Body) =>
	(
		flatten(b.components).find((c) => c.type === 12)?.items as
			| { media: { url: string } }[]
			| undefined
	)?.[0]?.media.url

function fixture(
	linked: string | null,
	profile: MemberProfile = {
		handle: "film_fan",
		visibility: DEFAULT_VISIBILITY,
	},
	overrides: Partial<Dependencies> = {},
) {
	const lookups: string[] = []
	const deps: Partial<Dependencies> = {
		linkedUser: async () => linked,
		memberProfile: async (id) => {
			lookups.push(id)
			return profile
		},
		take: async () => ({ allowed: true, store: "memory" }),
		log: () => {},
		...overrides,
	}
	async function command(card?: string) {
		let done!: (body: Body) => void
		const edited = new Promise<Body>((resolve) => {
			done = resolve
		})
		const response = await routeInteraction(
			{
				type: 2,
				id: "interaction",
				application_id: "app",
				token: "token",
				guild_id: "guild",
				user: { id: "discord" },
				data: {
					name: "profile",
					options: card ? [{ name: "card", value: card }] : [],
				},
			},
			{ ...deps, edit: async (_app, _token, body) => done(body as Body) },
		)
		if (response.type !== 5) return { response, body: response.data as Body }
		return { response, body: await edited }
	}
	async function share(customId: string) {
		return (await routeInteraction(
			{
				type: 3,
				id: "press",
				application_id: "app",
				token: "token",
				guild_id: "guild",
				user: { id: "discord" },
				message: { flags: EPHEMERAL, components: [] },
				data: { custom_id: customId },
			},
			{
				...deps,
				edit: async () => assert.fail("a share answers at once"),
			},
		)) as { type: number; data: Body }
	}
	return { command, share, lookups }
}

test("/profile registers a card option with readable choices for both installs", () => {
	const profile = commands.find((c) => c.name === "profile")!
	assert.deepEqual(profile.integration_types, [0, 1])
	assert.deepEqual(profile.contexts, [0, 1, 2])
	assert.equal(profile.options.length, 1)
	const option = profile.options[0] as {
		name: string
		required?: boolean
		choices: { name: string; value: string }[]
	}
	assert.equal(option.name, "card")
	assert.ok(!option.required)
	assert.deepEqual(
		option.choices.map((c) => c.name),
		[
			"Profile",
			"Taste",
			"Different from the crowd",
			"Sides",
			"Top scores",
			"Seen",
			"Wishlist",
			"Shows",
			"Lists",
		],
	)
	for (const c of option.choices) assert.doesNotMatch(c.name, /_/)
})

test("every card choice uses a real profile card tab", () => {
	for (const card of Object.values(PROFILE_CARDS))
		if (card.image) assert.ok(PROFILE_CARD_TABS.includes(card.image))
})

test("an unlinked Discord user gets the link prompt and no profile lookup", async () => {
	const f = fixture(null)
	const { response, body } = await f.command("taste")
	assert.equal(response.type, 5)
	assert.ok(body.flags & EPHEMERAL)
	assert.match(
		text(body),
		/Link your account to share your profile with \/profile\./,
	)
	assert.match(text(body), /## Link GoodWatch/)
	assert.ok(
		buttons(body).some(
			(b) =>
				b.label === "Link GoodWatch" && /\/discord\/link$/.test(String(b.url)),
		),
	)
	assert.deepEqual(f.lookups, [])
})

test("a linked member without a handle is pointed to Edit profile, privately", async () => {
	const f = fixture("member", { handle: null, visibility: DEFAULT_VISIBILITY })
	const { body } = await f.command()
	assert.ok(body.flags & EPHEMERAL)
	assert.equal(
		text(body),
		"### You don't have a profile yet\nPick a handle on GoodWatch to get your profile, then run /profile again.",
	)
	const [button] = buttons(body)
	assert.equal(button.label, "Pick a handle")
	assert.match(String(button.url), /\/settings\/profile$/)
	assert.equal(image(body), undefined)
})

test("a part hidden from everyone is refused privately with no image", async () => {
	for (const [audience, who] of [
		["me", "Only you can see your Taste"],
		["members", "Only GoodWatch members can see your Taste"],
	] as const)
		for (const card of ["taste", "crowd", "sides"]) {
			const f = fixture("member", {
				handle: "film_fan",
				visibility: { ...DEFAULT_VISIBILITY, taste: audience },
			})
			const { body } = await f.command(card)
			assert.ok(body.flags & EPHEMERAL)
			assert.equal(image(body), undefined)
			assert.equal(
				text(body),
				`### This part of your profile isn't public\n${who}, so its card can't be shared. To share it, set Taste to Everyone in Who sees what.`,
			)
			const [button] = buttons(body)
			assert.equal(button.label, "Edit profile")
			assert.match(String(button.url), /\/settings\/profile#who-sees-what$/)
			assert.ok(!buttons(body).some((b) => b.label === "Share to channel"))
		}
	// The main card needs no part: it draws only what everyone may see.
	const f = fixture("member", {
		handle: "film_fan",
		visibility: { ...DEFAULT_VISIBILITY, taste: "me", scores: "me" },
	})
	assert.ok(image((await f.command()).body))
	const scores = fixture("member", {
		handle: "film_fan",
		visibility: { ...DEFAULT_VISIBILITY, scores: "members" },
	})
	assert.match(text((await scores.command("scores")).body), /your Scores/)
})

const EXPECTED: Record<ProfileCardChoice, { image: string; link: string }> = {
	profile: { image: "/og/u/film_fan.jpg", link: "/u/film_fan" },
	taste: { image: "/og/u/film_fan/taste.jpg", link: "/u/film_fan/taste" },
	crowd: { image: "/og/u/film_fan/taste.jpg", link: "/u/film_fan/taste#crowd" },
	sides: { image: "/og/u/film_fan/taste.jpg", link: "/u/film_fan/taste#sides" },
	scores: { image: "/og/u/film_fan/scores.jpg", link: "/u/film_fan/scores" },
	seen: { image: "/og/u/film_fan/seen.jpg", link: "/u/film_fan/seen" },
	wishlist: {
		image: "/og/u/film_fan/wishlist.jpg",
		link: "/u/film_fan/wishlist",
	},
	shows: { image: "/og/u/film_fan/shows.jpg", link: "/u/film_fan/shows" },
	lists: { image: "/og/u/film_fan/lists.jpg", link: "/u/film_fan/lists" },
}

test("each card choice shows its card image and links to its place on the profile, with Share to channel", async () => {
	for (const [choice, expected] of Object.entries(EXPECTED)) {
		const f = fixture("member")
		const { response, body } = await f.command(
			choice === "profile" ? undefined : choice,
		)
		assert.equal(response.type, 5)
		assert.ok(body.flags & EPHEMERAL)
		assert.deepEqual(f.lookups, ["member"])
		const url = new URL(image(body)!)
		assert.equal(
			url.origin + url.pathname,
			`https://goodwatch.app${expected.image}`,
		)
		assert.ok(url.searchParams.get("brand"))
		assert.match(url.searchParams.get("v") ?? "", /^[0-9a-z]+$/)
		const open = buttons(body).find((b) => b.label === "Open on GoodWatch")!
		assert.equal(open.url, `https://goodwatch.app${expected.link}`)
		const shareButton = buttons(body).find(
			(b) => b.label === "Share to channel",
		)!
		assert.equal(shareButton.custom_id, `gw1:profile-share:${choice}`)
		assert.match(text(body), /^## @film fan on GoodWatch/)
		if (choice !== "profile")
			assert.match(
				text(body),
				new RegExp(
					`\\n-# ${PROFILE_CARDS[choice as ProfileCardChoice].name}$`,
					"m",
				),
			)
		for (const b of buttons(body)) assert.doesNotMatch(String(b.label), /_/)
	}
})

test("Share to channel posts the public card at once, without a share button", async () => {
	const f = fixture("member")
	const { type, data } = await f.share("gw1:profile-share:crowd")
	assert.equal(type, 4)
	assert.equal(data.flags & EPHEMERAL, 0)
	assert.match(image(data)!, /\/og\/u\/film_fan\/taste\.jpg\?/)
	assert.ok(!buttons(data).some((b) => b.label === "Share to channel"))
	assert.equal(
		buttons(data).find((b) => b.label === "Open on GoodWatch")!.url,
		"https://goodwatch.app/u/film_fan/taste#crowd",
	)
})

test("Share to channel checks again and refuses privately once the part is hidden", async () => {
	const hidden = fixture("member", {
		handle: "film_fan",
		visibility: { ...DEFAULT_VISIBILITY, wishlist: "me" },
	})
	const refused = await hidden.share("gw1:profile-share:wishlist")
	assert.equal(refused.type, 4)
	assert.ok(refused.data.flags & EPHEMERAL)
	assert.equal(image(refused.data), undefined)
	const unlinked = await fixture(null).share("gw1:profile-share:taste")
	assert.ok(unlinked.data.flags & EPHEMERAL)
	assert.match(text(unlinked.data), /## Link GoodWatch/)
	const slow = fixture("member", undefined, {
		memberProfile: () => new Promise(() => {}),
	})
	const timedOut = await slow.share("gw1:profile-share:taste")
	assert.ok(timedOut.data.flags & EPHEMERAL)
	assert.equal(
		text(timedOut.data),
		"Could not load your profile. Please press Share to channel again.",
	)
})

test("an unknown card value is refused", async () => {
	assert.equal(parseListId("gw1:profile-share:Taste"), null)
	const { type, data } = await fixture("member").share(
		"gw1:profile-share:other",
	)
	assert.equal(type, 4)
	assert.equal(text(data), "Choose a card from /profile.")
	const { body } = await fixture("member").command("other")
	assert.equal(text(body), "Choose a card from /profile.")
})
