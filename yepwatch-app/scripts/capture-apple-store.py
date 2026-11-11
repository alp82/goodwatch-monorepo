"""Run the actual simulator build on iPhone and iPad. Does not edit screen images."""
import glob
import json
from pathlib import Path
import shutil
import subprocess
import time


def run(*args):
    return subprocess.check_output(args, text=True)


types = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '--json'))['devicetypes']
runtimes = [r for r in json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '--json'))['runtimes'] if r['isAvailable'] and r['name'].startswith('iOS')]
apps = glob.glob('ios/build/Build/Products/*simulator/*.app') + glob.glob('ios/build/*.app') + [str(p) for p in Path('.expo/store-simulator').rglob('*.app')]
if not apps:
    apps = [str(p) for p in Path('ios').rglob('*.app') if '/Products/' in str(p)]
if not apps:
    raise RuntimeError('The build did not leave a simulator .app')
maestro = shutil.which('maestro') or str(Path.home() / '.maestro/bin/maestro')
output = Path('.expo/store-captures')
output.mkdir(parents=True, exist_ok=True)
results = []
for family, preferred, fallback in [('iphone', 'iPhone 17 Pro Max', 'iPhone 16 Pro Max'), ('ipad', 'iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)')]:
    choices = [d for name in [preferred, fallback] for d in types if d['name'] == name]
    if family == 'iphone':
        choices += [d for d in reversed(types) if 'iPhone' in d['name'] and 'Pro Max' in d['name']]
    else:
        choices += [d for d in reversed(types) if 'iPad Pro 13-inch' in d['name']]
    udid = None
    for runtime in reversed(runtimes):
        for device in choices:
            result = subprocess.run(['xcrun', 'simctl', 'create', 'YepWatch store ' + family, device['identifier'], runtime['identifier']], text=True, capture_output=True)
            if result.returncode == 0:
                udid = result.stdout.strip()
                break
        if udid:
            break
    if not udid:
        (output / 'simulator-availability.json').write_text(json.dumps({'runtimes': runtimes, 'devices': types}, indent=2))
        raise RuntimeError('No compatible store display simulator is available: ' + family)
    print('Capturing ' + device['name'] + ' on ' + runtime['name'], flush=True)
    try:
        run('xcrun', 'simctl', 'boot', udid)
        run('xcrun', 'simctl', 'bootstatus', udid, '-b')
        run('xcrun', 'simctl', 'status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100')
        run('xcrun', 'simctl', 'install', udid, apps[0])
        folder = (output / family).resolve()
        folder.mkdir(parents=True, exist_ok=True)
        command = [maestro, '--device', udid, 'test', '--test-output-dir', str(folder), '--debug-output', str(folder / 'debug')]
        subprocess.run([*command, '.maestro/store-home.yml'], check=True)
        # The native intro WebView paints after the main controls become accessible.
        time.sleep(8)
        subprocess.run(['xcrun', 'simctl', 'io', udid, 'screenshot', str(folder / '01-choose-together.png')], check=True)
        results.append({'family': family, 'device': device['name'], 'runtime': runtime['name'], 'passed': True, 'scope': 'native home only'})
        (output / 'capture-result.json').write_text(json.dumps(results, indent=2))
    finally:
        subprocess.run(['xcrun', 'simctl', 'shutdown', udid], check=False)
