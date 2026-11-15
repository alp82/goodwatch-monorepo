/**
 * The taste profile's device secret (x-yepwatch-profile): 32 random bytes as unpadded base64url, made once per
 * device and kept in its secure storage. The server stores only its keyed hash. Never log or show it.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const PROFILE_SECRET_BYTES = 32;
/** 32 bytes in unpadded base64url are 43 characters. */
export const PROFILE_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function encodeProfileSecret(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 1 >= bytes.length ? 2 : i + 2 >= bytes.length ? 3 : 4;
    for (let k = 0; k < chars; k++) out += ALPHABET[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/** A stored value is a secret this app made (anything else is replaced). */
export const validProfileSecret = (value: string | null | undefined): value is string => typeof value === 'string' && PROFILE_SECRET_PATTERN.test(value);
