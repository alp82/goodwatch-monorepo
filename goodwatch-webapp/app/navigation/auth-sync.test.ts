import assert from "node:assert/strict"
import { test } from "node:test"
import { type AuthNote, AuthSync } from "./auth-sync.ts"

// Tabs of one browser: one localStorage, one channel. Storage events and channel messages reach the other tabs only.
function browser({ channel = true, storage = true } = {}) {
	let stored: string | null = null
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
			() => {
				tab.changes++
			},
		)
		tabs.push(tab)
		return tab
	}
	return { open, stored: () => stored, tabs }
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
	one.sync.start()
	two.sync.start()
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

test("a page loaded as another member than the last note tells the other tabs", () => {
	const site = browser()
	const old = site.open("member:a")
	old.sync.start()
	const fresh = site.open("member:b")
	fresh.sync.start()
	assert.equal(old.changes, 1)
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
