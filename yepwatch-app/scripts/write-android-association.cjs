/** Only actual installed signing certificates; no debug/store placeholders. */
const fs = require('node:fs');
const path = require('node:path');
const [root, packageName, fingerprint] = process.argv.slice(2);
if (!root || !['com.yepwatch.preview', 'com.yepwatch.app'].includes(packageName) || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint ?? ''))
  throw new Error('Usage: node scripts/write-android-association.cjs EXPORT_DIR PACKAGE ACTUAL_SHA256_FINGERPRINT');
const directory = path.resolve(root, '.well-known');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'assetlinks.json'), JSON.stringify([{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: [fingerprint] },
}], null, 2) + '\n');
// AASA is deliberately absent until the actual Apple team/application ID is available.
