import assert from "node:assert/strict"
import { createServer } from "node:http"

// Only the disposable loopback cluster; each scenario calls the real show-tracking or movie watch-log HTTP action.
export async function firstInsertProof({
	pageProof,
	sql,
	endpoints,
	setCrateClientForTest,
	check,
}) {
	const results = []
	for (const mediaType of ["show", "movie"]) {
		for (const disposition of [
			"unwatch",
			"unchanged",
			"unwatch-and-rewatch",
			"not-applied",
			"pending-after-readback",
		]) {
			for (const timeout of [false, true]) {
				const showId = 100 + results.length
				const id = `${mediaType}-first-insert-${disposition}-${timeout ? "timeout" : "reset"}`
				if (mediaType === "show") for (const number of [1, 2, 3])
					await sql(
						"INSERT INTO episode (show_id,tmdb_id,season_number,episode_number,name,air_date) VALUES (?,?,1,?,?,?)",
						[
							showId,
							showId * 10 + number,
							number,
							`Fixture episode ${number}`,
							Date.UTC(2020, 0, 1),
						],
					)
				await sql("REFRESH TABLE episode")
				const key = ["proof-member", showId, mediaType]
				const action = (event, watchId) => mediaType === "show"
					? pageProof.trackingAction(showId, event, watchId)
					: pageProof.movieAction(showId, event.type === "watch"
						? { type: "watch", watchId } : { type: "delete", watchId: `${id}-first` })
				const lookup = () =>
					sql(
						"SELECT state,insert_token,_seq_no FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
						key,
					)
				let writes = 0
				let dropped = false
				let pending
				let appliedToken
				let finalActionVersion
				const errors = []
				const laterActions = async () => {
					if (
						![
							"unwatch",
							"unwatch-and-rewatch",
							"pending-after-readback",
						].includes(disposition)
					)
						return
					await action({
						type: "unwatch",
						season: 1,
						number: 1,
					})
					if (disposition === "unwatch-and-rewatch")
						await action(
							{ type: "watch", season: 1, number: 2 },
							`${id}-later`,
						)
					finalActionVersion = (await lookup()).rows[0]?.[2]
				}
				const servers = []
				let port = 0
				try {
					for (const [i, endpoint] of endpoints.entries()) {
						const server = createServer(async (req, res) => {
							try {
								let body = ""
								for await (const chunk of req) body += chunk
								const payload = JSON.parse(body)
								const mutation =
									/^\s*INSERT INTO user_watch_state\b/i.test(payload.stmt) &&
									payload.args[1] === showId
								if (mutation) writes++
								const forward = () =>
									fetch(`${endpoint}${req.url}`, {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body,
									})
								if (mutation && !dropped) {
									dropped = true
									if (disposition === "pending-after-readback") pending = payload
									else if (disposition !== "not-applied") {
										const answer = await forward()
										assert.equal((await answer.json()).rowcount, 1)
										appliedToken = (await lookup()).rows[0]?.[1]
										await laterActions()
									}
									if (!timeout) req.socket.destroy()
									return // Acknowledged response dropped, or deliberately unlanded first request.
								}
								if (mutation && pending) {
									// The first readback has already returned absent. The original now lands, then unwatch
									// runs, and only afterwards does the client's resend reach CrateDB.
									assert.equal(
										(await sql(pending.stmt, pending.args)).rowcount,
										1,
									)
									appliedToken = (await lookup()).rows[0]?.[1]
									pending = undefined
									await laterActions()
								}
								const answer = await forward()
								res.writeHead(answer.status, {
									"Content-Type": "application/json",
								})
								res.end(await answer.text())
							} catch (error) {
								errors.push(error.message)
								req.socket.destroy()
							}
						})
						await new Promise((resolve, reject) => {
							server.once("error", reject)
							server.listen(port, `127.0.0.${i + 1}`, resolve)
						})
						port = server.address().port
						servers.push(server)
					}
					Object.assign(process.env, {
						CRATE_PORT: String(port),
						CRATE_TIMEOUT_MS: "10000",
					})
					setCrateClientForTest(null)
					const answer = await action(
						{ type: "watch", season: 1, number: 1 },
						`${id}-first`,
					)
					const laterRemoved = ["unwatch", "pending-after-readback"].includes(
						disposition,
					)
					const [[state, token, version]] = (await lookup()).rows
					await sql("REFRESH TABLE user_watch_log, user_watch_state")
					const watchIds = (
						await sql(
							"SELECT watch_id FROM user_watch_log WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
							key,
						)
					).rows.flat()
					check(`${id}: proxy errors`, errors, [])
					check(`${id}: route outcome`, answer.status, "applied")
					check(
						`${id}: returned logical state`,
						mediaType === "show" ? answer.state?.state ?? null : answer.watches.length ? "seen" : null,
						laterRemoved ? null : mediaType === "show" ? "watching" : "seen",
					)
					check(
						`${id}: physical state`,
						state,
						laterRemoved ? "not_started" : mediaType === "show" ? "watching" : "seen",
					)
					check(
						`${id}: stored watches`,
						watchIds,
						laterRemoved
							? []
							: [
									disposition === "unwatch-and-rewatch"
										? `${id}-later`
										: `${id}-first`,
								],
					)
					check(
						`${id}: dispatched INSERT count`,
						writes,
						["not-applied", "pending-after-readback"].includes(disposition)
							? 2
							: 1,
					)
					assert.equal(typeof token, "string")
					if (appliedToken) check(`${id}: immutable receipt`, token, appliedToken)
					if (finalActionVersion !== undefined)
						check(
							`${id}: no write after the next action`,
							version,
							finalActionVersion,
						)
					// Logical deletion must stay invisible to list reads too.
					if (laterRemoved)
						check(
							`${id}: absent from member lists`,
							(
								await sql(
									"SELECT count(*) FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND state <> 'not_started'",
									key.slice(0, 2),
								)
							).rows,
							[[0]],
						)
					results.push({
						id,
						timeout,
						disposition,
						writes,
						state,
						watches: watchIds.length,
						version,
						finalActionVersion,
						receiptConfirmed: true,
					})
				} finally {
					setCrateClientForTest(null)
					Object.assign(process.env, {
						CRATE_PORT: "17430",
						CRATE_TIMEOUT_MS: "10000",
					})
					await Promise.all(
						servers.map(async (server) => {
							server.closeAllConnections()
							await new Promise((resolve) => server.close(resolve))
						}),
					)
				}
			}
		}
	}
	return results
}
