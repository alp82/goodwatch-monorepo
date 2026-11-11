"""Run the actual simulator build on iPhone and iPad. Does not edit screen images."""
import glob
import json
from pathlib import Path
import shutil
import subprocess


def run(*args):
    return subprocess.check_output(args, text=True)


types = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '--json'))['devicetypes']
runtimes = [r for r in json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '--json'))['runtimes'] if r['isAvailable'] and r['name'].startswith('iOS')]
runtime = sorted(runtimes, key=lambda r: tuple(int(x) for x in r['version'].split('.')))[-1]
apps = glob.glob('ios/build/Build/Products/*simulator/*.app') + glob.glob('ios/build/*.app')
if not apps:
    apps = [str(p) for p in Path('ios').rglob('*.app') if '/Products/' in str(p)]
if not apps:
    raise RuntimeError('The build did not leave a simulator .app')
maestro = shutil.which('maestro') or str(Path.home() / '.maestro/bin/maestro')
output = Path('.expo/store-captures')
output.mkdir(parents=True, exist_ok=True)
for family, preferred, fallback in [('iphone', 'iPhone 17 Pro Max', 'iPhone 16 Pro Max'), ('ipad', 'iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)')]:
    device = next((d for name in [preferred, fallback] for d in types if d['name'] == name), None)
    if not device:
        raise RuntimeError('Required store display device is unavailable: ' + family)
    udid = run('xcrun', 'simctl', 'create', 'YepWatch store ' + family, device['identifier'], runtime['identifier']).strip()
    try:
        run('xcrun', 'simctl', 'boot', udid)
        run('xcrun', 'simctl', 'bootstatus', udid, '-b')
        run('xcrun', 'simctl', 'status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100')
        run('xcrun', 'simctl', 'install', udid, apps[0])
        subprocess.run([maestro, '--device', udid, 'test', '--test-output-dir', str(output / family), '.maestro/store-screenshots.yml'], check=True)
    finally:
        subprocess.run(['xcrun', 'simctl', 'shutdown', udid], check=False)
