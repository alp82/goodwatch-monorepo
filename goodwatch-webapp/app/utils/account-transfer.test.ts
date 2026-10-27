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
