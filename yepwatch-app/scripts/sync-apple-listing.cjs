/** Sync complete marketing records: apple-utils turns omitted localized fields into null. */
const fs = require('node:fs');
const path = require('node:path');
const easRoot = process.env.YEPWATCH_EAS_CLI_ROOT;
if (!easRoot) throw new Error('Set YEPWATCH_EAS_CLI_ROOT to an installed eas-cli package directory.');
const base = path.join(easRoot, 'build');
const Status = require(path.join(base, 'commands/submit/status')).default;
const { resolveTestFlightAppAsync } = require(path.join(base, 'testflight/app'));
const listing = require('../store/en-US.json');
const config = require('../eas.json');
const apply = process.argv.includes('--apply');
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;

class SyncListing extends Status {
  async runAsync() {
    const { loggedIn: { actor, graphqlClient }, privateProjectConfig: { exp, projectId, projectDir }, analytics, vcsClient } = await this.getContextAsync(Status, { nonInteractive: true, withServerSideEnvironment: null });
    const app = await resolveTestFlightAppAsync({ actor, graphqlClient, exp, projectId, projectDir, analytics, vcsClient, nonInteractive: true, profileName: 'production' });
    if (app.id !== config.submit.production.ios.ascAppId || app.attributes.bundleId !== config.submit.production.ios.bundleIdentifier) throw new Error('Apple app identity differs from the production submission profile.');
    const versionString = config.build.production.env.APP_VERSION;
    const version = (await app.getAppStoreVersionsAsync()).find(v => v.attributes.versionString === versionString && v.attributes.platform === 'IOS');
    if (!version || version.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') throw new Error('The intended public draft is not editable.');
    const locale = app.attributes.primaryLocale;
    if (locale !== 'en-US') throw new Error('This copy is English (US); preserve other primary locales.');
    const loc = (await version.getLocalizationsAsync()).find(l => l.attributes.locale === locale);
    const infos = await app.getAppInfoAsync();
    if (!loc || infos.length !== 1) throw new Error('Expected one editable app info and an existing English version localization.');
    const info = infos[0];
    const infoLoc = (await info.getLocalizationsAsync()).find(l => l.attributes.locale === locale);
    if (!infoLoc) throw new Error('English app information is missing.');
    const versionFields = {
      description: listing.description,
      keywords: listing.apple.keywords,
      promotionalText: listing.apple.promotionalText,
      marketingUrl: listing.apple.marketingUrl,
      supportUrl: listing.apple.supportUrl,
      whatsNew: loc.attributes.whatsNew ?? undefined,
    };
    const infoFields = {
      name: listing.name, subtitle: listing.apple.subtitle,
      privacyPolicyUrl: listing.apple.privacyPolicyUrl,
      privacyChoicesUrl: listing.apple.privacyChoicesUrl,
      privacyPolicyText: infoLoc.attributes.privacyPolicyText ?? null,
    };
    if (versionFields.description.length > 4000 || versionFields.promotionalText.length > 170 || versionFields.keywords.length > 100 || infoFields.name.length > 30 || infoFields.subtitle.length > 30) throw new Error('Store text exceeds an Apple field limit.');
    if (apply) {
      await loc.updateAsync(versionFields);
      await infoLoc.updateAsync(infoFields);
      await version.updateAsync({ ...Object.fromEntries(['versionString', 'releaseType', 'earliestReleaseDate', 'downloadable', 'reviewType'].filter(k => version.attributes[k] !== undefined).map(k => [k, version.attributes[k]])), copyright: listing.apple.copyright });
    }
    const freshVersion = (await app.getAppStoreVersionsAsync()).find(v => v.id === version.id);
    const freshLoc = (await freshVersion.getLocalizationsAsync()).find(l => l.attributes.locale === locale);
    const freshInfo = (await (await app.getAppInfoAsync()).find(i => i.id === info.id).getLocalizationsAsync()).find(l => l.attributes.locale === locale);
    const attachedBuild = await freshVersion.getBuildAsync();
    const matches = Object.entries(versionFields).filter(([, v]) => v !== undefined).every(([k, v]) => freshLoc.attributes[k] === v)
      && Object.entries(infoFields).every(([k, v]) => freshInfo.attributes[k] === v)
      && freshVersion.attributes.copyright === listing.apple.copyright;
    if (apply && !matches) throw new Error('Fresh Apple readback differs from the complete listing.');
    const result = { checkedAt: new Date().toISOString(), appId: app.id, version: versionString, locale, applied: apply, matches, versionFields: freshLoc.attributes, appInfoFields: freshInfo.attributes, copyright: freshVersion.attributes.copyright, attachedBuild: attachedBuild ? { id: attachedBuild.id, version: attachedBuild.attributes.version, processingState: attachedBuild.attributes.processingState } : null, submittedForReview: false };
    if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  }
}
SyncListing.run(['--profile', 'production', '--platform', 'ios', '--non-interactive'], { root: easRoot }).catch(error => { console.error(error.message); process.exit(1); });
