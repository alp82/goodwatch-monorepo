import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto'
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const random = () => randomBytes(32).toString('base64url')
export function equal(a: string, b: string): boolean { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb) }
export function keyed(key: string, purpose: string, value: string): string { return createHmac('sha256', key).update(`${purpose}\0${value}`).digest('base64url') }
export function sign(key: string, payload: unknown): string { const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${encoded}.${keyed(key, 'lease', encoded)}` }
export function verify<T>(key: string, token: string): T | null {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra || !equal(signature, keyed(key, 'lease', payload))) return null
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T } catch { return null }
}
/** Random-nonce envelope encryption keeps private votes/credential verifiers out of SQL parameter logs. Key backup/rotation is an operational prerequisite. */
export function codec(secret: string) {
  const key = createHash('sha256').update(`yepwatch-storage\0${secret}`).digest()
  return {
    encode(value: unknown, roomId: string): string { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(roomId)); const ciphertext = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]); return [iv, c.getAuthTag(), ciphertext].map(b => b.toString('base64url')).join('.') },
    decode<T>(value: string, roomId: string): T { const [iv, tag, body] = value.split('.').map(s => Buffer.from(s, 'base64url')); const d = createDecipheriv('aes-256-gcm', key, iv); d.setAAD(Buffer.from(roomId)); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8')) as T },
  }
}
