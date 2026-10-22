"""Isolated standalone preview APK, with a dedicated private local signing identity."""
from pathlib import Path
import hashlib, json, os, secrets, shutil, subprocess

APP = Path(__file__).resolve().parent.parent
BUILD = int(os.environ.get('APP_BUILD_NUMBER', '3'))
assert BUILD >= 1, 'Positive APP_BUILD_NUMBER required.'
RUN = APP / f'.expo/release/preview-r{BUILD}'
PROJECT = RUN / 'yepwatch-app'
SIGNING = APP / '.expo/signing/preview'
JAVA = APP / '.expo/native-toolchain/jdk-21.0.12.1+1'
SDK = Path(os.environ.get('ANDROID_HOME', '/home/alp/Android/Sdk'))
assert not PROJECT.exists(), 'Use a new isolated output; never overwrite an existing build.'
assert (JAVA / 'bin/jlink').exists(), 'Full JDK21 required.'
SIGNING.mkdir(parents=True, exist_ok=True, mode=0o700)
private = SIGNING / 'credentials.json'
if BUILD > 1:
    assert private.exists() and (SIGNING/'preview.jks').exists(), 'Preview upgrades require the original private preview signing identity.'
if not private.exists():
    private.write_text(json.dumps({'storePassword': secrets.token_urlsafe(32), 'keyPassword': secrets.token_urlsafe(32)}))
    private.chmod(0o600)
credentials = json.loads(private.read_text())
env = dict(os.environ, APP_VARIANT='preview', APP_BUILD_NUMBER=str(BUILD), EXPO_NO_DOTENV='1', CI='1',
    EXPO_PUBLIC_API_ORIGIN='https://yepwatch.com', EXPO_PUBLIC_APP_ORIGIN='https://yepwatch.com',
    EXPO_PUBLIC_WS_ORIGIN='wss://yepwatch.com', EXPO_PUBLIC_ENABLE_FIXTURES='false', EXPO_PUBLIC_GUEST_ONLY='true',
    YEPWATCH_LOCAL_PREVIEW_SIGNING='1', YEPWATCH_PREVIEW_KEYSTORE=str(SIGNING/'preview.jks'),
    YEPWATCH_PREVIEW_STORE_PASSWORD=credentials['storePassword'], YEPWATCH_PREVIEW_KEY_PASSWORD=credentials['keyPassword'],
    JAVA_HOME=str(JAVA), ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK),
    GRADLE_USER_HOME=str(APP/'.expo/native-toolchain/gradle-cache-21'), CMAKE_BUILD_PARALLEL_LEVEL='2')
env['PATH'] = str(JAVA/'bin') + os.pathsep + env['PATH']
env.pop('EXPO_PUBLIC_DEVELOPMENT_NOTICE', None)
if not (SIGNING/'preview.jks').exists():
    # PKCS12 uses one password for key/store. Neither value appears in process arguments/output.
    credentials['keyPassword'] = credentials['storePassword']
    private.write_text(json.dumps(credentials)); private.chmod(0o600)
    env['YEPWATCH_PREVIEW_KEY_PASSWORD'] = credentials['keyPassword']
    subprocess.run([str(JAVA/'bin/keytool'), '-genkeypair', '-keystore', str(SIGNING/'preview.jks'),
        '-alias', 'yepwatch-preview', '-storepass:env', 'YEPWATCH_PREVIEW_STORE_PASSWORD',
        '-keypass:env', 'YEPWATCH_PREVIEW_KEY_PASSWORD', '-keyalg', 'RSA', '-keysize', '3072',
        '-validity', '3650', '-dname', 'CN=YepWatch local preview'], env=env, check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    (SIGNING/'preview.jks').chmod(0o600)
# Copy source only; generated native projects, private signing and historical exports stay outside.
shutil.copytree(APP, PROJECT, ignore=shutil.ignore_patterns('.expo', 'node_modules', 'android', 'ios', 'dist*', 'artifacts', 'test-results', '.git', '.env*'))
contracts = APP.parent/'goodwatch-webapp/packages/yepwatch-contracts'
shutil.copytree(contracts, RUN/'goodwatch-webapp/packages/yepwatch-contracts')
with (RUN/'build.log').open('w') as log:
    for command, cwd in [(['npm', 'ci', '--install-links', '--no-audit', '--no-fund'], PROJECT),
        (['node', 'node_modules/.bin/expo', 'prebuild', '--platform', 'android', '--no-install'], PROJECT),
        (['./gradlew', ':app:assembleRelease', '--no-daemon', '--console=plain', '--max-workers=2',
          '-Dorg.gradle.parallel=false', '-PreactNativeArchitectures=arm64-v8a,x86_64'], PROJECT/'android')]:
        subprocess.run(command, cwd=cwd, env=env, check=True, stdout=log, stderr=subprocess.STDOUT)
apk = PROJECT/'android/app/build/outputs/apk/release/app-release.apk'
result = {'apk': str(apk), 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
    'package': 'com.yepwatch.preview', 'version': '0.1.0', 'versionCode': BUILD,
    'signing': 'Dedicated private local preview key; NOT production/store ownership',
    'bundledJavascript': True, 'metroRequired': False, 'publicBackendDeployed': False,
    'api': 'https://yepwatch.com', 'websocket': 'wss://yepwatch.com', 'physicalDeviceInstalled': False}
(RUN/'build-result.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
