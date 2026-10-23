import assert from "node:assert/strict"
import { test } from "node:test"
import { type AuthNote, AuthSync } from "./auth-sync.ts"

// Tabs of one browser: one localStorage, one channel. Storage events and channel messages reach the other tabs only.
function browser({ channel = true, storage = true } = {}) {
	let stored: string | null = null
	// Who the shared session cookie names: what a root reload answers.
	let cookie: string | null = null
	const tabs: Tab[] = []
	interface Tab {
		sync: AuthSync
		member: string | null
		changes: number
		heard: (note: AuthNote | string | null) => void
	}
	let ids = 0
	function open(member: string | null): Tab {
		const tab: Tab = {
			member,
			changes: 0,
			heard: (note) => tab.sync.receive(note),
		} as Tab
		tab.sync = new AuthSync(
			{
				read: () => {
					if (!storage) throw new Error("blocked")
					return stored
				},
				write: (value) => {
					if (!storage) throw new Error("blocked")
					stored = value
					for (const other of tabs) if (other !== tab) other.heard(value)
				},
				post: channel
					? (note) => {
							for (const other of tabs) if (other !== tab) other.heard(note)
						}
					: null,
				newId: () => `n${++ids}`,
			},
			() => tab.member,
			(confirm) => {
				tab.changes++
				if (cookie !== null) tab.member = cookie
				confirm?.()
			},
		)
		tabs.push(tab)
		return tab
	}
	return {
		open,
		stored: () => stored,
		tabs,
		setCookie: (member: string) => {
			cookie = member
		},
	}
}

test("a sign-in answered in one tab makes the other tabs reload their root, once each", () => {
	const site = browser()
	const one = site.open("member:a")
	const two = site.open("member:a")
	one.sync.start()
	two.sync.start()
	one.sync.announce()
	assert.equal(two.changes, 1)
	assert.equal(one.changes, 0)
})

test("without BroadcastChannel, the storage event carries the note", () => {
	const site = browser({ channel: false })
	const one = site.open("member:a")
	const two = site.open("member:a")
	one.sync.start()
	two.sync.start()
	one.sync.announce()
	assert.equal(two.changes, 1)
})

test("a tab that already shows the named member ignores the note", () => {
	const site = browser()
	const three = site.open("member:a")
	three.sync.start()
	const one = site.open("member:b")
	const two = site.open("member:b")
	site.setCookie("member:b")
	one.sync.start()
	two.sync.start()
	// Starting as B after a note naming A reconciles once; what counts is what follows.
	one.changes = 0
	two.changes = 0
	three.member = "member:b"
	one.sync.memberChanged("member:b")
	three.sync.announce("member:b")
	assert.equal(two.changes, 0)
	assert.equal(one.changes, 0)
})

test("a note missed while asleep is acted on when the tab shows again, and only once", () => {
	const site = browser()
	const one = site.open("member:a")
	const two = site.open("member:a")
	one.sync.start()
	two.sync.start()
	two.heard = () => {} // Hidden or in the back/forward cache.
	one.sync.announce()
	assert.equal(two.changes, 0)
	two.sync.check()
	assert.equal(two.changes, 1)
	two.sync.check()
	assert.equal(two.changes, 1)
})

test("nothing new on show costs nothing", () => {
	const site = browser()
	const one = site.open("member:a")
	one.sync.start()
	one.sync.check()
	assert.equal(one.changes, 0)
})

test("a page loaded as another member than the last note tells the other tabs once the server confirms it", () => {
	const site = browser()
	site.setCookie("member:a")
	const old = site.open("member:a")
	old.sync.start()
	site.setCookie("member:b") // An OAuth callback: a full page load as the new member.
	const fresh = site.open("member:b")
	fresh.sync.start()
	assert.equal(fresh.changes, 1)
	assert.equal(old.changes, 1)
	assert.equal(old.member, "member:b")
	const again = site.open("member:b")
	again.sync.start()
	assert.equal(old.changes, 1)
})

test("blocked storage still reaches tabs over the channel and never throws", () => {
	const site = browser({ storage: false })
	const one = site.open("member:a")
	const two = site.open("member:a")
	one.sync.start()
	two.sync.start()
	one.sync.announce()
	assert.equal(two.changes, 1)
	two.sync.check()
	assert.equal(two.changes, 1)
})

test("garbage in storage is ignored", () => {
	const site = browser()
	const one = site.open("member:a")
	one.sync.receive("{not json")
	one.sync.receive('{"member":"x"}')
	assert.equal(one.changes, 0)
})

test("a page that loaded before another tab signed in reconciles instead of announcing its stale member", () => {
	const site = browser()
	site.setCookie("member:a")
	const other = site.open("member:a")
	other.sync.start()
	// This tab's document rendered as A, then the other tab signed in as B before this one started.
	const late = site.open("member:a")
	site.setCookie("member:b")
	other.member = "member:b"
	other.sync.memberChanged("member:b")
	late.sync.start()
	assert.equal(late.changes, 1)
	assert.equal(late.member, "member:b")
	assert.equal(JSON.parse(site.stored() ?? "null")?.member, "member:b")
	assert.equal(other.changes, 0)
})

test("a note heard over both paths, interleaved with another, acts once per note", () => {
	const site = browser()
	const tab = site.open("member:a")
	tab.sync.start()
	const one = JSON.stringify({ id: "x1" })
	const two = JSON.stringify({ id: "x2" })
	for (const note of [one, two, one, two]) tab.sync.receive(note)
	assert.equal(tab.changes, 2)
})
