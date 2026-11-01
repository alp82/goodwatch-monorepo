import assert from 'node:assert/strict'
import test from 'node:test'
import { providerCatalog, type ProviderCatalogRow } from './provider-catalog.ts'
const row = (id: number, name: string, ranks: Record<string, number> | null): ProviderCatalogRow =>
	({ tmdb_id: id, name, logo_path: null, order_by_country: ranks, order_default: 0 })
test('Montenegro excludes foreign and unknown services and uses country rank, including zero', () => {
	const rows = [row(8, 'Netflix', { ME: 0, DE: 1 }), row(2211, '3sat', { DE: 0 }),
		row(337, 'Disney+', { ME: 2 }), row(11, 'MUBI', { ME: 1 }), row(999, 'Unknown', null)]
	assert.deepEqual(providerCatalog(rows, 'ME').services.map(s => s.id), [8, 11, 337])
	assert.deepEqual(providerCatalog(rows, 'DE').services.map(s => s.id), [2211, 8])
	assert.deepEqual(providerCatalog(rows, null).services, [])
	assert.deepEqual(providerCatalog(rows, 'ZZ').services, [])
})
test('country filtering precedes duplicate grouping: no foreign aliases become selectable', () => {
	const rows = [row(9, 'Amazon Prime Video', { DE: 0 }), row(119, 'Amazon Prime Video', { ME: 1 }),
		row(10, 'Amazon Video', { US: 0 }), row(119, 'Amazon Prime Video', { ME: 3 })]
	const result = providerCatalog(rows, 'ME')
	assert.equal(result.services.length, 1)
	assert.deepEqual(result.providerGroups.map(g => g.selectionIds), [[119]])
})

test("big subscriptions rank first once, use subscription names, and expose minor stores and channels", () => {
 const names=["Apple TV Store","Google Play Movies","Netflix","Amazon Prime Video","Disney Plus","HBO Max","Paramount+","Paramount+ Premium","Apple TV","Rakuten TV","Peacock","Netflix Kids"]
 const rows=names.map((name,i)=>({tmdb_id:([2,3,8,9,337,1899,531,2303,350,35,386,175] as number[])[i],name,logo_path:null,order_default:i,order_by_country:{US:i}}))
 const {providerGroups}=providerCatalog(rows,"US")
 const main=providerGroups.filter(g=>!g.minor)
 assert.equal(main[0].name,"Netflix")
 assert.equal(main[1].name,"Prime Video")
 assert.equal(main[2].name,"Disney+")
 assert.equal(providerGroups.find(g=>g.selectionIds.includes(2))?.name,"Apple TV")
 assert.equal(providerGroups.find(g=>g.selectionIds.includes(3))?.minor,true)
 assert.equal(providerGroups.find(g=>g.selectionIds.includes(35))?.minor,true)
})
