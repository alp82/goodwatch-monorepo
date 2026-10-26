// Opt-in local proof instrumentation. No SQL parameters or row values are recorded.
import { crateEvent, redactedSqlShape, sqlShapeId } from '../../app/utils/crate-diagnostics.ts'
export function traceClient(client) {
 const prototype = Object.getPrototypeOf(client)
 const original = prototype.executeOnHost
 let sequence = 0
 prototype.executeOnHost = async function(driver, sql, params, timeoutMs, signal) {
  const sqlShape = redactedSqlShape(sql)
  const details = { traceId: ++sequence, host: this.hosts.find(h => h.driver === driver)?.address,
   sqlShapeId: sqlShapeId(sqlShape), sqlShape, timeoutMs }
  const start = performance.now()
  crateEvent('proof.sql_started', details)
  try {
   const result = await original.call(this, driver, sql, params, timeoutMs, signal)
   crateEvent('proof.sql_finished', { ...details, durationMs: performance.now()-start, serverDurationMs: result.duration, outcome: 'succeeded' })
   return result
  } catch(error) {
   crateEvent('proof.sql_finished', { ...details, durationMs: performance.now()-start, errorClass: error.name, outcome: 'failed' })
   throw error
  }
 }
}
