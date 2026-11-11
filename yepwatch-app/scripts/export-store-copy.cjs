/** One canonical listing, with paste-ready files for the two store consoles. */
const fs = require('node:fs');
const path = require('node:path');
const listing = require('../store/en-US.json');
const destination = process.argv[2];
if (!destination) throw new Error('Usage: node scripts/export-store-copy.cjs <output-directory>');
const fields = {
  'app-name': listing.name,
  'apple-subtitle': listing.apple.subtitle,
  'apple-promotional-text': listing.apple.promotionalText,
  'apple-keywords': listing.apple.keywords,
  'apple-copyright': listing.apple.copyright,
  'google-short-description': listing.google.shortDescription,
  'full-description': listing.description,
};
for (const [key, max] of [['app-name', 30], ['apple-subtitle', 30], ['apple-promotional-text', 170], ['apple-keywords', 100], ['google-short-description', 80], ['full-description', 4000]]) {
  if (fields[key].length > max) throw new Error(key + ' exceeds its store limit.');
}
fs.mkdirSync(destination, { recursive: true });
for (const [name, value] of Object.entries(fields)) fs.writeFileSync(path.join(destination, name + '.txt'), value + '\n');
fs.writeFileSync(path.join(destination, 'en-US.json'), JSON.stringify(listing, null, 2) + '\n');
console.log('Exported English listing fields to ' + path.resolve(destination));
