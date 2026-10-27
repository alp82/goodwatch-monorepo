import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { PendingTransfer } from "./account-transfer.ts"
const { saveTransfer, pendingTransfer } = await import("./account-transfer.ts")

test("pending transfers retain skips, including an immutable confirmed retry", () => {
	const storage = new Map<string,string>()
	const globals = globalThis as unknown as {localStorage:unknown; window:unknown}
	const priorStorage = globals.localStorage, priorWindow = globals.window
	globals.localStorage = {getItem:(k:string) => storage.get(k) ?? null, setItem:(k:string,v:string) => storage.set(k,v)}
	globals.window = {dispatchEvent:() => true}
	try {
		const transfer: PendingTransfer = {
			id:"transfer",accountId:"member",automatic:true,returnTo:"/taste/quiz",
			snapshot:{interactions:[{type:"skip",tmdb_id:42,media_type:"movie",timestamp:1}],country:null,services:null,discovery:null,taste:null,search:null},
			changes:[{id:"movie-42",kind:"skip",tmdb_id:42,media_type:"movie",value:"add",before:null,title:"A title",accountLabel:"Not added",browserLabel:"Haven't seen it",fresh:true}],
			selected:["movie-42"],
		}
		saveTransfer(transfer)
		assert.deepEqual(pendingTransfer("member"),transfer)
		const confirmed = {...transfer,confirmed:transfer.changes}
		saveTransfer(confirmed)
		assert.deepEqual(pendingTransfer("member"),confirmed)
	} finally {globals.localStorage = priorStorage; globals.window = priorWindow}
})

test("sign-up returns to the page the person came from: a page of this site, never an auth page", async () => {
	const { referrerReturnTo, safeReturnTo } = await import("./account-transfer.ts")
	const origin = "https://goodwatch.app"
	assert.equal(referrerReturnTo("https://goodwatch.app/taste/quiz?view=taste", origin), "/taste/quiz?view=taste")
	assert.equal(referrerReturnTo("https://goodwatch.app/movie/603-the-matrix#cast", origin), "/movie/603-the-matrix#cast")
	assert.equal(referrerReturnTo("https://elsewhere.example/taste", origin), undefined)
	assert.equal(referrerReturnTo("https://goodwatch.app/sign-in?redirectTo=%2F", origin), undefined)
	assert.equal(referrerReturnTo("", origin), undefined)
	assert.equal(referrerReturnTo("not a url", origin), undefined)
	// The rating flow's taste view, where Save your taste sends people back after sign-up, is a safe return page.
	assert.equal(safeReturnTo("/taste/quiz?view=taste"), "/taste/quiz?view=taste")
})
