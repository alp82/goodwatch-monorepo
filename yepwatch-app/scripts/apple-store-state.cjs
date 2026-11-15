/** Read-only: App Store version states, attached build, editability of the English listing and gallery. */
const fs = require('node:fs');
const path = require('node:path');
const easRoot = process.env.YEPWATCH_EAS_CLI_ROOT;
if (!easRoot) throw new Error('Set YEPWATCH_EAS_CLI_ROOT to the installed eas-cli package directory.');
const base = path.join(easRoot, 'build');
const Status = require(path.join(base, 'commands/submit/status')).default;
const { resolveTestFlightAppAsync } = require(path.join(base, 'testflight/app'));
const config = require('../eas.json');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
// States in which Apple accepts edits to version metadata and screenshots.
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];

class State extends Status {
  async runAsync() {
    const { loggedIn: { actor, graphqlClient }, privateProjectConfig: { exp, projectId, projectDir }, analytics, vcsClient } = await this.getContextAsync(Status, { nonInteractive: true, withServerSideEnvironment: null });
    const app = await resolveTestFlightAppAsync({ actor, graphqlClient, exp, projectId, projectDir, analytics, vcsClient, nonInteractive: true, profileName: 'production' });
    if (app.id !== config.submit.production.ios.ascAppId) throw new Error('Wrong Apple app.');
    const versions = [];
    for (const v of await app.getAppStoreVersionsAsync()) {
      const build = await v.getBuildAsync().catch(() => null);
      const row = { id: v.id, version: v.attributes.versionString, platform: v.attributes.platform, state: v.attributes.appStoreState, appVersionState: v.attributes.appVersionState ?? null, releaseType: v.attributes.releaseType ?? null, build: build ? { id: build.id, version: build.attributes.version, processingState: build.attributes.processingState } : null, editable: EDITABLE.includes(v.attributes.appStoreState) };
      if (v.attributes.platform === 'IOS') {
        const loc = (await v.getLocalizationsAsync()).find(l => l.attributes.locale === 'en-US');
        if (loc) {
          row.whatsNew = loc.attributes.whatsNew ?? null;
          row.promotionalText = loc.attributes.promotionalText ?? null;
          const sets = await loc.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
          row.screenshotSets = sets.map(s => ({ type: s.attributes.screenshotDisplayType, count: (s.attributes.appScreenshots ?? []).length }));
        }
      }
      versions.push(row);
    }
    const info = (await app.getAppInfoAsync()).map(i => ({ id: i.id, state: i.attributes.appStoreState ?? i.attributes.state ?? null }));
    const state = { checkedAt: new Date().toISOString(), appId: app.id, versions, appInfos: info };
    if (output) fs.writeFileSync(output, JSON.stringify(state, null, 2) + '\n');
    console.log(JSON.stringify(state, null, 2));
  }
}
State.run(['--profile', 'production', '--platform', 'ios', '--non-interactive'], { root: easRoot }).catch(error => { console.error(error.message); process.exit(1); });
