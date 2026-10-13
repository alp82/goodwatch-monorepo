// Runs the product's taste formula on a case from a JSON file and prints the taste vector and the pool cosines.
// Used by test_ladder.py to compare rung B2 with formula.server.ts and pool.server.ts themselves.
//   bun formula_check.ts <webapp folder> <case.json>
const [webapp, casePath] = process.argv.slice(2)
const { tasteVector } = await import(`${webapp}/app/server/taste/formula.server.ts`)
const { tastePool, poolCosines } = await import(`${webapp}/app/server/taste/pool.server.ts`)
const c = JSON.parse(await Bun.file(casePath).text())
const rows: Uint8Array[] = c.fingerprints.map((f: number[]) => Uint8Array.from(f))
const has: boolean[] = c.hasFingerprint
const snapshot = {
	version: "test",
	fingerprint: (key: number) => (has[key] ? rows[key] : null),
	fingerprintAt: (row: number) => rows[row],
	factsAt: (_row: number) => ({ votes: 5000, hasPoster: true }),
	forEach: (fn: (key: number, row: number) => void) => rows.forEach((_r, i) => fn(i, i)),
}
const out = c.members.map((m: any) => {
	const t = tasteVector(snapshot as any, m)
	if (!t.vector) return { vector: null, liked: t.liked, wantToSee: t.wantToSee }
	const cos = poolCosines(tastePool(snapshot as any), t.vector)
	return { vector: Array.from(t.vector), cosines: Array.from(cos), liked: t.liked, wantToSee: t.wantToSee }
})
console.log(JSON.stringify(out))
