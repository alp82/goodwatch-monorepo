import assert from "node:assert/strict"
import { createServer } from "node:http"

// Only the disposable loopback cluster. Device A has deleted the old watch but has not acquired the state;
// device B sees the empty episode and ticks it again before A's original CAS reaches CrateDB.
export async function removalRetryProof({ pageProof, sql, endpoints, setCrateClientForTest, check }) {
	const clusterPort = process.env.CRATE_PORT
	const results = []
	for (const removal of ["unwatch", "unmarkSeason"]) {
		for (const disposition of ["conflict", "reset", "timeout"]) {
			const showId = 200 + results.length
			const id = `removal-${removal}-${disposition}`
			for (const number of [1, 2])
				await sql("INSERT INTO episode (show_id,tmdb_id,season_number,episode_number,name,air_date) VALUES (?,?,1,?,?,?)",
					[showId, showId * 10 + number, number, "Fixture episode", Date.UTC(2020, 0, 1)])
			await sql("REFRESH TABLE episode")
			await pageProof.trackingAction(showId, { type: "watch", season: 1, number: 1 }, `${id}-original`)
			const lookup = () => sql("SELECT state,_seq_no FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = 'show'", ["proof-member", showId])
			let intercepted = false
			let stateWrites = 0
			let replacementVersion
			const errors = []
			const servers = []
			let port = 0
			try {
				for (const [i, endpoint] of endpoints.entries()) {
					const server = createServer(async (req, res) => {
						try {
							let body = ""
							for await (const chunk of req) body += chunk
							const payload = JSON.parse(body)
							const mutation = /^\s*UPDATE user_watch_state\b/i.test(payload.stmt) && payload.args[9] === showId
							if (mutation) stateWrites++
							const first = mutation && !intercepted
							if (first) {
								intercepted = true
								await pageProof.trackingAction(showId, { type: "watch", season: 1, number: 1 }, `${id}-replacement`)
								replacementVersion = (await lookup()).rows[0][1]
							}
							const answer = await fetch(`${endpoint}${req.url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body })
							const text = await answer.text()
							if (first) {
								assert.equal(JSON.parse(text).rowcount, 0, "A's original state CAS must lose to B")
								if (disposition !== "conflict") {
									if (disposition === "reset") req.socket.destroy()
									return
								}
							}
							res.writeHead(answer.status, { "Content-Type": "application/json" })
							res.end(text)
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
				process.env.CRATE_PORT = String(port)
				setCrateClientForTest(null)
				await pageProof.trackingFailure(showId, removal === "unwatch"
					? { type: "unwatch", season: 1, number: 1 } : { type: "unmarkSeason", season: 1 },
					disposition === "conflict" ? 409 : 500)
				await sql("REFRESH TABLE user_watch_log")
				const watches = (await sql("SELECT watch_id FROM user_watch_log WHERE user_id = ? AND media_type = 'show' AND tmdb_id = ?", ["proof-member", showId])).rows.flat()
				check(`${id}: proxy errors`, errors, [])
				check(`${id}: replacement watch survives`, watches, [`${id}-replacement`])
				check(`${id}: replacement state untouched`, (await lookup()).rows, [["watching", replacementVersion]])
				check(`${id}: original CAS and replacement CAS only`, stateWrites, 2)
				results.push({ id, disposition, removal, httpStatus: disposition === "conflict" ? 409 : 500, replacementVersion, watches, stateWrites })
			} finally {
				setCrateClientForTest(null)
				process.env.CRATE_PORT = clusterPort
				await Promise.all(servers.map(async (server) => {
					server.closeAllConnections()
					await new Promise((resolve) => server.close(resolve))
				}))
			}
		}
	}
	return results
}
