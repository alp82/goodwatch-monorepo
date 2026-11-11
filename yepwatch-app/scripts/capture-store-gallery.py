"""Genuine native screens and video frames. Does not change app visuals or enable fixtures."""
import base64
import glob
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

spec = importlib.util.spec_from_file_location('gallery_room', Path(__file__).with_name('store-gallery-room.py'))
rooms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rooms)


def run(*args):
    return subprocess.check_output(args, text=True)


def export_images(folder, destination):
    """Export a bounded image archive; full recordings/debug logs stay on the worker."""
    destination.mkdir(parents=True, exist_ok=True)
    thumbs = folder / 'analysis-thumbnails'
    thumbs.mkdir(exist_ok=True)
    for prefix, video in [('vote', 'voting-effects.mp4'), ('match', 'match-effect.mp4')]:
        run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(folder / video), '-vf', 'fps=6,scale=360:-2', '-q:v', '3', str(thumbs / (prefix + '-%04d.jpg')))
    run('python3', 'scripts/find-store-reactions.py', str(thumbs), '--output', str(folder / 'reaction-hits.json'))
    hits = json.loads((folder / 'reaction-hits.json').read_text())
    rows = []
    hashes = {}
    for video in ['voting-effects.mp4', 'match-effect.mp4']:
        digest = hashlib.sha256()
        with (folder / video).open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        hashes[video] = digest.hexdigest()
    for label in ['YEP', 'NOPE', 'MATCH']:
        prefix = 'match' if label == 'MATCH' else 'vote'
        selected = []
        for hit in sorted([h for h in hits if h['label'] == label and Path(h['file']).stem.startswith(prefix + '-')], key=lambda h: (h['height'], h['confidence']), reverse=True):
            if all(abs(hit['frame'] - old['frame']) >= 12 for old in selected):
                selected.append(hit)
            if len(selected) == (1 if label == 'MATCH' else 3):
                break
        for index, hit in enumerate(selected, 1):
            video = 'match-effect.mp4' if label == 'MATCH' else 'voting-effects.mp4'
            at = (hit['frame'] - 1) / 6
            name = 'candidate-' + label.lower() + '-' + str(index) + '.png'
            target = destination / name
            run('ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(at), '-i', str(folder / video), '-frames:v', '1', '-compression_level', '9', '-update', '1', str(target))
            shutil.copy2(hit['file'], destination / (Path(name).stem + '-analysis.jpg'))
            rows.append({'file': name, 'label': label, 'source': video, 'sourceSha256': hashes[video], 'timeSeconds': at, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    for name in ['01-voting.png', '06-shared-matches.png', '07-tonights-pick.png']:
        shutil.copy2(folder / name, destination / name)
        rows.append({'file': name, 'source': name, 'sha256': hashlib.sha256((destination / name).read_bytes()).hexdigest()})
    (destination / 'candidate-manifest.json').write_text(json.dumps(rows, indent=2))
    # Never upload the native recordings or Maestro diagnostics as a build artifact.
    print('Exported native image candidates: ' + str(len(rows)), flush=True)


def main():
    admissions = json.loads(base64.b64decode(os.environ['YEPWATCH_GALLERY_ROOMS']))
    selected = os.environ.get('YEPWATCH_GALLERY_FAMILIES', 'iphone-medium,iphone-large,ipad').split(',')
    types = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '--json'))['devicetypes']
    runtimes = [r for r in json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '--json'))['runtimes'] if r['isAvailable'] and r['name'].startswith('iOS')]
    apps = glob.glob('ios/build/Build/Products/*simulator/*.app') + [str(p) for p in Path('.expo/store-simulator').rglob('*.app')]
    if not apps:
        raise RuntimeError('Native simulator artifact missing')
    maestro = shutil.which('maestro') or str(Path.home() / '.maestro/bin/maestro')
    output = Path('.expo/store-gallery').resolve()
    output.mkdir(parents=True, exist_ok=True)
    exported = Path('.expo/store-gallery-export').resolve()
    exported.mkdir(parents=True, exist_ok=True)
    devices = {'iphone-medium': ['iPhone 17 Pro', 'iPhone 16 Pro'], 'iphone-large': ['iPhone 17 Pro Max', 'iPhone 16 Pro Max'], 'ipad': ['iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)']}
    results = []
    for family_index, family in enumerate(selected):
        print('Preparing native gallery: ' + family, flush=True)
        folder = output / family
        folder.mkdir(parents=True, exist_ok=True)
        udid = None
        choices = [d for name in devices[family] for d in types if d['name'] == name]
        for runtime in reversed(runtimes):
            for device in choices:
                p = subprocess.run(['xcrun', 'simctl', 'create', 'YepWatch gallery ' + family, device['identifier'], runtime['identifier']], capture_output=True, text=True)
                if p.returncode == 0:
                    udid = p.stdout.strip()
                    break
            if udid:
                break
        if not udid:
            raise RuntimeError('Required display simulator unavailable')
        peer = rooms.GalleryRoom(admissions[family])
        reuse = any(admissions[next_family]['credential']['roomId'] == peer.credential['roomId'] for next_family in selected[family_index + 1:])
        recording = None
        command = [maestro, '--device', udid, 'test', '--test-output-dir', str(folder / 'maestro'), '--debug-output', str(folder / 'debug')]

        def flow(name, env=None, required=True):
            args = [*command]
            for key, value in (env or {}).items():
                args += ['-e', key + '=' + value]
            return subprocess.run([*args, '.maestro/store-gallery-' + name + '.yml'], check=required)

        def screenshot(name):
            run('xcrun', 'simctl', 'io', udid, 'screenshot', str(folder / name))

        def start_video(name):
            log = open(folder / (name + '.log'), 'w')
            p = subprocess.Popen(['xcrun', 'simctl', 'io', udid, 'recordVideo', '--codec=h264', str(folder / (name + '.mp4'))], stdout=log, stderr=log)
            time.sleep(2)
            return p, log

        def stop_video(value):
            p, log = value
            p.send_signal(signal.SIGINT)
            p.wait(timeout=30)
            log.close()

        try:
            run('xcrun', 'simctl', 'boot', udid)
            run('xcrun', 'simctl', 'bootstatus', udid, '-b')
            run('xcrun', 'simctl', 'status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100')
            run('xcrun', 'simctl', 'install', udid, apps[0])
            peer.follow()
            flow('join', {'ROOM_URL': 'yepwatch://r/' + peer.invite})
            time.sleep(3)
            screenshot('01-voting.png')
            recording = start_video('voting-effects')
            flow('vote')
            stop_video(recording)
            recording = None
            peer.matching.set()
            if not peer.matching_ready.wait(timeout=120):
                raise RuntimeError('The disposable peer did not confirm its votes')
            recording = start_video('match-effect')
            flow('match')
            time.sleep(2)
            stop_video(recording)
            recording = None
            flow('matches')
            time.sleep(3)
            screenshot('06-shared-matches.png')
            flow('finish')
            time.sleep(4)
            screenshot('07-tonights-pick.png')
            export_images(folder, exported / family)
            if reuse:
                # Start the next owned capture round before the current guest leaves.
                # This keeps retired guest votes from the previous generation out of a reset.
                peer.close(leave=False)
                snapshot = peer.snapshot()
                peer.command({'type': 'restart', 'expectedRevision': snapshot['shared']['revision']})
                peer.configure()
            results.append({'family': family, 'device': device['name'], 'runtime': runtime['name'], 'passed': True, 'fixturesEnabled': False})
        except Exception as error:
            print('Native gallery failed: ' + str(error), flush=True)
            screenshot('failure.png')
            results.append({'family': family, 'passed': False, 'errorType': type(error).__name__})
        finally:
            if recording:
                stop_video(recording)
            flow('leave', {'ROOM_SETTINGS_URL': 'yepwatch://room/' + peer.credential['roomId'] + '/room'}, required=False)
            peer.close(leave=not reuse)
            run('xcrun', 'simctl', 'shutdown', udid)
            (output / 'capture-result.json').write_text(json.dumps(results, indent=2))
            (exported / 'capture-result.json').write_text(json.dumps(results, indent=2))
    # Keep the image-only export small, dropping just third-choice alternatives if needed.
    if sum(p.stat().st_size for p in exported.rglob('*') if p.is_file()) > 80 * 1024 * 1024:
        for candidate in exported.glob('*/candidate-*-3.png'):
            candidate.unlink()
            candidate.with_name(candidate.stem + '-analysis.jpg').unlink(missing_ok=True)
        for manifest in exported.glob('*/candidate-manifest.json'):
            rows = json.loads(manifest.read_text())
            manifest.write_text(json.dumps([row for row in rows if (manifest.parent / row['file']).exists()], indent=2))
    if sum(p.stat().st_size for p in exported.rglob('*') if p.is_file()) > 90 * 1024 * 1024:
        raise RuntimeError('Native image export exceeds its bounded archive size')
    if any(not r['passed'] for r in results):
        raise RuntimeError('Inspect private native gallery diagnostics')


if __name__ == '__main__':
    main()
