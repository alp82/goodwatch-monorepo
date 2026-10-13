import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function verifyConsumedInputs(requiredPaths, bindings, base) {
  if (!Array.isArray(requiredPaths) || !requiredPaths.length || new Set(requiredPaths).size !== requiredPaths.length) throw Error('consumed_input_registry_invalid');
  for (const name of requiredPaths) {
    if (typeof name !== 'string' || !Object.hasOwn(bindings, name)) throw Error('consumed_input_unbound');
    const expected = bindings[name];
    const file = path.isAbsolute(name) ? name : path.join(base, name);
    let bytes;
    try { bytes = fs.readFileSync(file); } catch { throw Error('consumed_input_missing'); }
    if (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw Error('consumed_input_changed');
  }
  return requiredPaths.length;
}
