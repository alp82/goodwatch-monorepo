/** Stage genuine native screenshots in the existing draft; never submits review. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const easRoot = process.env.YEPWATCH_EAS_CLI_ROOT;
if (!easRoot) throw new Error('Set YEPWATCH_EAS_CLI_ROOT to the installed eas-cli package directory.');
const base = path.join(easRoot, 'build');
const Status = require(path.join(base, 'commands/submit/status')).default;
const { resolveTestFlightAppAsync } = require(path.join(base, 'testflight/app'));
const config = require('../eas.json');
const apply = process.argv.includes('--apply');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;

class Gallery extends Status {
  async runAsync() {
    const { loggedIn: { actor, graphqlClient }, privateProjectConfig: { exp, projectId, projectDir }, analytics, vcsClient } = await this.getContextAsync(Status, { nonInteractive: true, withServerSideEnvironment: null });
    const app = await resolveTestFlightAppAsync({ actor, graphqlClient, exp, projectId, projectDir, analytics, vcsClient, nonInteractive: true, profileName: 'production' });
    if (app.id !== config.submit.production.ios.ascAppId || app.attributes.bundleId !== config.submit.production.ios.bundleIdentifier) throw new Error('Wrong Apple app.');
    const version = (await app.getAppStoreVersionsAsync()).find(v => v.attributes.versionString === config.build.production.env.APP_VERSION && v.attributes.platform === 'IOS');
    if (version?.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') throw new Error('The intended public draft is not editable.');
    const loc = (await version.getLocalizationsAsync()).find(l => l.attributes.locale === 'en-US');
    if (!loc) throw new Error('English version localization missing.');
    const sets = await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
    const results = [];
    const orders = [];
    const plans = [
      ['ios-iphone-medium', 'APP_IPHONE_61', [1206, 2622]],
      ['ios-iphone', 'APP_IPHONE_67', [1320, 2868]],
      ['ios-ipad', 'APP_IPAD_PRO_3GEN_129', [2064, 2752]],
    ];
    const outcomes = await Promise.allSettled(plans.map(async ([folder, type, dimensions]) => {
      const dir = path.resolve(__dirname, '../store/assets', folder);
      const names = fs.readdirSync(dir).filter(n => /^gallery-\d\d-.*\.png$/.test(n)).sort();
      if (!names.length) throw new Error('Missing native gallery: ' + folder);
      let set = sets.find(s => s.attributes.screenshotDisplayType === type);
      let existing = set?.attributes.appScreenshots ?? [];
      const newNames = names.filter(n => !existing.some(s => s.attributes.fileName === n));
      if (existing.length + newNames.length > 10) throw new Error('Preserve existing screenshots: the set would exceed 10.');
      if (!set && apply) set = await loc.createAppScreenshotSetAsync({ screenshotDisplayType: type });
      const ordered = [];
      for (const name of names) {
        const filePath = path.join(dir, name);
        const bytes = fs.readFileSync(filePath);
        if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== dimensions[0] || bytes.readUInt32BE(20) !== dimensions[1]) throw new Error('Wrong native screenshot dimensions: ' + name);
        const checksum = crypto.createHash('md5').update(bytes).digest('hex');
        let shot = existing.find(s => s.attributes.fileName === name);
        if (shot && shot.attributes.sourceFileChecksum !== checksum) throw new Error('Preserve differing existing screenshot: ' + name);
        if (!shot && apply) shot = await set.uploadScreenshot({ filePath, waitForProcessing: false });
        if (shot?.isFailed()) throw new Error('Screenshot processing failed: ' + name + ': ' + shot.getErrorMessages().join('; '));
        if (shot) ordered.push(shot.id);
        results.push({ type, name, id: shot?.id ?? null, complete: shot?.isComplete() ?? false, md5: checksum });
        console.log(type + ': ' + name + (shot ? (shot.isComplete() ? ' processed' : ' uploaded; processing') : ' ready'));
      }
      // Keep earlier/user uploads at the end. Never delete a screenshot implicitly.
      ordered.push(...existing.filter(s => !ordered.includes(s.id)).map(s => s.id));
      if (apply) orders.push({ set, ordered });
    }));
    let fresh = await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
    const deadline = Date.now() + 10 * 60 * 1000;
    while (apply && Date.now() < deadline) {
      const shots = fresh.flatMap(s => s.attributes.appScreenshots ?? []);
      const selected = results.map(r => shots.find(s => s.id === r.id));
      if (selected.some(s => s?.isFailed())) break;
      if (selected.every(s => s?.isComplete())) break;
      console.log('Waiting for Apple to process the committed gallery images...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      fresh = await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
    }
    for (const { set, ordered } of orders) {
      try {
        await set.reorderScreenshotsAsync({ appScreenshots: ordered });
      } catch (error) {
        // Apple can commit a relationship PATCH with an empty success body,
        // which this SDK rejects. Accept it only after proving the exact order.
        if (!String(error.message).startsWith('Unexpected OK response:')) throw error;
        const reread = (await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } })).find(s => s.id === set.id);
        const actual = (reread?.attributes.appScreenshots ?? []).map(s => s.id);
        if (JSON.stringify(actual) !== JSON.stringify(ordered)) throw error;
        console.log('Screenshot order verified after an empty Apple success response.');
      }
    }
    fresh = await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
    for (const result of results) result.complete = fresh.some(s => (s.attributes.appScreenshots ?? []).some(p => p.id === result.id && p.isComplete()));
    const failures = outcomes.filter(r => r.status === 'rejected').map(r => r.reason?.message ?? String(r.reason));
    const state = { checkedAt: new Date().toISOString(), appId: app.id, version: version.attributes.versionString, applied: apply, screenshots: results.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)), sets: fresh.map(s => ({ type: s.attributes.screenshotDisplayType, screenshots: (s.attributes.appScreenshots ?? []).map(p => ({ id: p.id, name: p.attributes.fileName, complete: p.isComplete() })) })), failures, submittedForReview: false };
    if (output) fs.writeFileSync(output, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(state, null, 2));
    if (failures.length) throw new Error(failures.join('; '));
    if (apply && results.some(r => !r.complete)) throw new Error('Gallery uploads are retained; some images have not finished Apple processing.');
  }
}
Gallery.run(['--profile', 'production', '--platform', 'ios', '--non-interactive'], { root: easRoot }).catch(error => { console.error(error.message); process.exit(1); });
