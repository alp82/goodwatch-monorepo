import { pathToFileURL } from 'node:url'
import { readOnlyCrate } from './read-only.ts'
export interface ReplayVote { room_id: string; generation: number; participant_id: string; candidate_id: string; choice: 'watch' | 'pass' | null; revision: number }
/** Immutable/superseded vote records are deduplicated BEFORE aggregation. No private identifiers leave this function. */
export function replayBaseline(votes: ReplayVote[], rounds: { id: string; generation: number; seen_keys: string[]; people: number }[]) {
  const latest = new Map<string, ReplayVote>()
  for (const vote of votes) {
    const key = JSON.stringify([vote.room_id, vote.generation, vote.participant_id, vote.candidate_id]), old = latest.get(key)
    if (!old || old.revision < vote.revision) latest.set(key, vote)
    else if (old.revision === vote.revision && old.choice !== vote.choice) throw new Error('Ambiguous vote revision; use outcome logs for this baseline')
  }
  const positions = new Map<number, { yep: number; nope: number }>()
  let matched = 0, firstTotal = 0, roundsWithFirst = 0
  for (const room of rounds) {
    const counts = new Map<string, { yep: number; nope: number }>()
    for (const v of latest.values()) if (v.room_id === room.id && v.generation === room.generation && v.choice) {
      const c = counts.get(v.candidate_id) ?? { yep: 0, nope: 0 }; c[v.choice === 'watch' ? 'yep' : 'nope']++; counts.set(v.candidate_id, c)
    }
    let first = Infinity
    for (const [id, count] of counts) {
      // Candidate ids include episodes: join to the title's seen key prefix, not lexical candidate order.
      const match = /^(movie|show_start|show_continue)[:_]([0-9]+)/.exec(id)
      const position = match ? room.seen_keys.indexOf(`${match[1] === 'movie' ? 'movie' : 'show'}_${match[2]}`) : -1
      if (position < 0) continue
      const total = positions.get(position) ?? { yep: 0, nope: 0 }; total.yep += count.yep; total.nope += count.nope; positions.set(position, total)
      if (room.people > 0 && count.yep === room.people) first = Math.min(first, position + 1)
    }
    if (Number.isFinite(first)) { matched++; firstTotal += first; roundsWithFirst++ }
  }
  return { rounds: rounds.length, matchRate: matched / Math.max(1, rounds.length), cardsToFirstMatch: roundsWithFirst ? firstTotal / roundsWithFirst : null,
    positions: [...positions].sort((a, b) => a[0] - b[0]).map(([position, c]) => ({ position, answers: c.yep + c.nope, yepRate: c.yep / (c.yep + c.nope) })) }
}
async function main() {
  const sql = readOnlyCrate()
  const [count] = await sql<{ n: number }>('SELECT count(*) AS n FROM doc.yepwatch_vote')
  // First count raw retained records, then compare with the current heads' referenced vote records.
  const heads = await sql<{ id: string; generation: number; seen_keys: string[]; participant_records: string[] }>('SELECT id,generation,seen_keys,participant_records FROM doc.yepwatch_room ORDER BY id LIMIT 10000')
  if (heads.length === 10000) throw new Error('Baseline head limit reached; narrow the copy before evaluating')
  const participantIds = heads.flatMap(h => h.participant_records)
  const participants = participantIds.length ? await sql<{ record_id: string; vote_records: string[]; left_at: number | null }>('SELECT record_id,vote_records,left_at FROM doc.yepwatch_participant WHERE record_id=ANY(?)', [participantIds]) : []
  const referenced = new Set(participants.flatMap(p => p.vote_records))
  console.info(JSON.stringify({ event: 'yepwatch_baseline_retention', rawVoteRecords: count.n, currentlyReferenced: referenced.size,
    supersededOrRetiredSurvive: Number(count.n) > referenced.size, note: 'Superseded rows also contribute; only a controlled retired-card audit proves retirement coverage. Outcomes are authoritative.' }))
  const votes = await sql<ReplayVote & Record<string, unknown>>('SELECT room_id,generation,participant_id,candidate_id,choice,revision FROM doc.yepwatch_vote ORDER BY room_id,generation,participant_id,candidate_id,revision LIMIT 1000000')
  if (votes.length === 1000000) throw new Error('Baseline vote limit reached; narrow the copy before evaluating')
  console.info(JSON.stringify({ event: 'yepwatch_baseline_replay', ...replayBaseline(votes, heads.map(h => ({ ...h, people: participants.filter(p => h.participant_records.includes(p.record_id) && p.left_at == null).length }))),
    limitation: 'Retired/departed/previous-generation roster histories can be incomplete; collect the aggregate outcome baseline before claiming a comparison.' }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Baseline replay failed; no private rows logged'); process.exitCode = 1 })
