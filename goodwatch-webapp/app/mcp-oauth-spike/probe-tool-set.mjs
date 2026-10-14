// #535: exercise the real MCP boundary with a caller supplied by the OAuth probe.
import assert from "node:assert/strict"

export async function readRpcResponse(response) {
	if (response.headers.get("Content-Type")?.includes("application/json"))
		return response.json()
	const frames = (await response.text())
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => JSON.parse(line.slice(6)))
	const result = frames.find(
		(frame) => frame.result !== undefined || frame.error !== undefined,
	)
	assert.ok(result, "Missing JSON-RPC result in SSE response")
	return result
}

export async function verifyToolSet(rpc, expectTaste = false) {
	const list = await rpc("tools/list", {})
	assert.equal(list.tools.length, expectTaste ? 14 : 13)
	assert.equal(
		list.tools.some((tool) => tool.name === "get_taste"),
		expectTaste,
	)
	for (const tool of list.tools) {
		assert.ok(tool.title)
		assert.equal(typeof tool.annotations.readOnlyHint, "boolean")
		assert.equal(typeof tool.annotations.destructiveHint, "boolean")
		assert.equal(
			tool.annotations.readOnlyHint,
			![
				"log_watch",
				"rate_title",
				"set_want_to_see",
				"set_not_interested",
				"set_show_status",
				"undo_watch",
				"set_my_services",
			].includes(tool.name),
		)
	}
	assert.equal(
		list.tools.find((tool) => tool.name === "undo_watch").annotations
			.destructiveHint,
		true,
	)
	const call = async (name, args) => {
		const result = await rpc("tools/call", { name, arguments: args })
		assert.ok(result.structuredContent, JSON.stringify(result))
		assert.equal(result.structuredContent.fixture, true)
		assert.ok(result.structuredContent.member_id)
		return result.structuredContent
	}
	const before = await call("get_library", {})
	const first = await call("search_titles", { query: "" })
	assert.equal(first.items.length, 20)
	assert.equal(first.total, 25)
	const second = await call("search_titles", {
		query: "",
		cursor: first.next_cursor,
	})
	assert.equal(second.items.length, 5)
	assert.equal(second.next_cursor, null)
	assert.equal(
		new Set([...first.items, ...second.items].map((title) => title.id)).size,
		25,
	)
	assert.equal(second.search_budget.remaining, first.search_budget.remaining)
	const ambiguous = await call("set_want_to_see", {
		title_name: "Harbor",
		want_to_see: true,
	})
	assert.equal(ambiguous.status, "ambiguous_title")
	assert.equal(ambiguous.choices.length, 2)
	assert.deepEqual(await call("get_library", {}), before)
	assert.equal(
		(
			await call("log_watch", {
				title_name: "Orbit Garden",
				season: 1,
				episode: 99,
				action_id: "bad-episode",
			})
		).status,
		"invalid_episode",
	)
	const invalidSelector = await rpc("tools/call", {
		name: "rate_title",
		arguments: { title_id: "movie:603", title_name: "Harbor", score: 1 },
	})
	assert.equal(invalidSelector.isError, true)
	assert.deepEqual(await call("get_library", {}), before)
	const logged = await call("log_watch", {
		title_name: "Orbit Garden",
		season: 1,
		episode: 3,
		action_id: "probe-episode-3",
	})
	assert.equal(logged.watch.date, null)
	assert.equal(logged.watch.date_precision, "unknown")
	assert.equal(logged.presentation_version, "fixture-v1")
	assert.equal(logged.title.progress.next_episode.episode, 4)
	const retry = await call("log_watch", {
		title_id: "show:1399",
		season: 1,
		episode: 3,
		action_id: "probe-episode-3",
	})
	assert.equal(retry.status, "already_applied")
	assert.equal(retry.watch.watch_id, logged.watch.watch_id)
	assert.equal(
		(
			await call("log_watch", {
				title_id: "show:1399",
				season: 1,
				episode: 4,
				action_id: "probe-episode-3",
			})
		).status,
		"action_id_conflict",
	)
	const dated = await call("log_watch", {
		title_id: "show:1399",
		season: 1,
		episode: 4,
		date: "2026-10-13",
		action_id: "probe-dated",
	})
	assert.equal(dated.watch.date, "2026-10-13")
	assert.equal(dated.watch.date_precision, "day")
	assert.equal((await call("get_tonight", {})).next_episode.episode, 5)
	const preview = await call("undo_watch", { title_name: "Orbit Garden" })
	assert.equal(preview.status, "confirmation_required")
	assert.equal(
		(await call("get_show_progress", { title_id: "show:1399" })).next_episode
			.episode,
		5,
	)
	await call("rate_title", { title_name: "Lighthouse", score: 8 })
	assert.equal(
		(
			await call("undo_watch", {
				title_id: "show:1399",
				confirmation_id: preview.confirmation_id,
			})
		).status,
		"confirmation_invalid",
	)
	const fresh = await call("undo_watch", {
		title_name: "Orbit Garden",
		watch_id: dated.watch.watch_id,
	})
	const removed = await call("undo_watch", {
		title_id: "show:1399",
		watch_id: dated.watch.watch_id,
		confirmation_id: fresh.confirmation_id,
	})
	assert.equal(removed.status, "removed")
	assert.equal(removed.title.progress.next_episode.episode, 4)
	assert.equal(
		(
			await call("undo_watch", {
				title_id: "show:1399",
				watch_id: dated.watch.watch_id,
				confirmation_id: fresh.confirmation_id,
			})
		).status,
		"watch_not_found",
	)
	const rating = await call("get_title", { title_name: "Lighthouse" })
	assert.equal(rating.member.score, 8)
	assert.equal(rating.member.seen, true)
	assert.equal(rating.member.watch_count, 1)
	const clear = await call("rate_title", {
		title_name: "Lighthouse",
		score: null,
	})
	assert.equal(clear.status, "confirmation_required")
	assert.equal(
		(await call("get_title", { title_id: "movie:603" })).member.score,
		8,
	)
	const cleared = await call("rate_title", {
		title_id: "movie:603",
		score: null,
		confirmation_id: clear.confirmation_id,
	})
	assert.equal(cleared.title.watch_count, 0)
	await call("rate_title", { title_id: "show:1399", score: 9 })
	assert.equal(
		(await call("get_show_progress", { title_id: "show:1399" })).watches.total,
		3,
	)
	await call("set_want_to_see", {
		title_name: "Harbor",
		year: 2019,
		want_to_see: true,
	})
	const removeWishlist = await call("set_want_to_see", {
		title_id: "movie:1001",
		want_to_see: false,
	})
	assert.equal(removeWishlist.status, "confirmation_required")
	await call("set_want_to_see", {
		title_id: "movie:1001",
		want_to_see: false,
		confirmation_id: removeWishlist.confirmation_id,
	})
	await call("set_not_interested", {
		title_name: "Harbor",
		year: 2019,
		not_interested: true,
	})
	assert.equal(
		(await call("get_title", { title_id: "movie:1001" })).member.not_interested,
		true,
	)
	await call("set_want_to_see", { title_id: "movie:1001", want_to_see: true })
	assert.equal(
		(await call("get_title", { title_id: "movie:1001" })).member.not_interested,
		false,
	)
	const decline = await call("set_not_interested", {
		title_id: "movie:1001",
		not_interested: true,
	})
	assert.equal(decline.status, "confirmation_required")
	assert.equal(decline.preview.remove_from_wishlist, true)
	await call("set_not_interested", {
		title_id: "movie:1001",
		not_interested: true,
		confirmation_id: decline.confirmation_id,
	})
	await call("set_not_interested", {
		title_id: "movie:1001",
		not_interested: false,
	})
	assert.equal(
		(
			await call("set_not_interested", {
				title_id: "show:1399",
				not_interested: true,
			})
		).status,
		"invalid_transition",
	)
	assert.equal(
		(
			await call("set_show_status", {
				title_id: "show:1399",
				status: "Not started",
			})
		).status,
		"invalid_transition",
	)
	await call("set_show_status", {
		title_name: "Orbit Garden",
		status: "On hold",
	})
	assert.equal(
		(await call("get_my_shows", {})).items.find(
			(title) => title.id === "show:1399",
		).progress.status,
		"On hold",
	)
	assert.equal((await call("get_tonight", {})).pick, null)
	await call("set_show_status", { title_id: "show:1399", status: "Watching" })
	const drop = await call("set_show_status", {
		title_name: "Small Town Detectives",
		status: "Dropped",
	})
	assert.equal(drop.status, "confirmation_required")
	await call("set_show_status", {
		title_id: "show:1400",
		status: "Dropped",
		confirmation_id: drop.confirmation_id,
	})
	await call("set_show_status", { title_id: "show:1400", status: "Watching" })
	const seen = await call("set_show_status", {
		title_id: "show:1400",
		status: "Seen",
	})
	assert.equal(seen.status, "confirmation_required")
	await call("set_show_status", {
		title_id: "show:1400",
		status: "Seen",
		confirmation_id: seen.confirmation_id,
	})
	const seenProgress = await call("get_show_progress", {
		title_id: "show:1400",
	})
	assert.equal(seenProgress.watched_episodes, 6)
	assert.equal(seenProgress.next_episode, null)
	assert.ok(seenProgress.watches.items.every((watch) => watch.date === null))
	assert.equal(
		(
			await call("set_show_status", {
				title_id: "show:1400",
				status: "Dropped",
			})
		).status,
		"invalid_transition",
	)
	const services = await call("set_my_services", {
		country: "DE",
		services: ["disney_plus"],
	})
	assert.equal(services.status, "confirmation_required")
	assert.equal((await call("get_tonight", {})).pick.id, "show:1399")
	await call("set_my_services", {
		country: "DE",
		services: ["disney_plus"],
		confirmation_id: services.confirmation_id,
	})
	assert.equal((await call("get_tonight", {})).pick, null)
	await call("set_my_services", {
		country: "DE",
		services: ["disney_plus", "netflix"],
	})
	assert.equal((await call("get_tonight", {})).pick.id, "show:1399")
	for (let i = 0; i < 19; i++)
		await call("search_titles", { query: `quota probe ${i}` })
	assert.equal(
		(await call("search_titles", { query: "quota probe blocked" })).status,
		"search_quota_exceeded",
	)
	assert.equal(
		(await call("rate_title", { title_name: "Lighthouse", score: 7 })).status,
		"updated",
	)
	assert.equal((await call("search_titles", { query: "" })).items.length, 20)
	if (expectTaste) assert.equal((await call("get_taste", {})).rated_titles, 2)
	else
		assert.equal(
			(await rpc("tools/call", { name: "get_taste", arguments: {} })).error
				.code,
			-32602,
		)
	console.log(
		JSON.stringify({
			toolSetProbe: "PASS",
			exposedTools: list.tools.length,
			member: before.member_id,
			mutableReads: true,
			ambiguousNamesNoWrite: true,
			replaySafeWatch: true,
			unknownAndExplicitDates: true,
			confirmationPreviewsAndStaleRejection: true,
			paging: [20, 5],
			searchQuota: 20,
			hiddenTaste: !expectTaste,
		}),
	)
}
