"""Native store gallery for the rethink (couches, Taste cards, Tonight, Matches, tiebreak, decided).

The real app on a simulator or emulator talks to the public API (fixtures off). The phone is the host, "Alex";
four disposable peers (Mia, Sam, Priya, Leo) join the couch through the same API, add one idea each, Yep the
titles that should match, say I'm in and pick tiebreak favorites. Nothing here edits app visuals: the output is
native screenshots plus native screen recordings (animation frames are picked from them afterwards).
Cleanup: peers leave, the phone resets its taste profile (Profile, Reset my taste: DELETE /proposal/profile).

  iOS (EAS macOS worker): python3 scripts/capture-store-rethink.py ios --families iphone-medium iphone-large ipad
  Android (local emulator): python3 scripts/capture-store-rethink.py android --device emulator-5578 --app-id dev.yepwatch.e2e
Output: .expo/store-rethink/<family>/ (PNG screenshots, MP4 recordings, capture.json). No credentials are written.
"""
import argparse
import glob
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

API = 'https://yepwatch.com/api/yepwatch/v1/proposal'
PEERS = [('Mia', 'cozy mystery'), ('Sam', 'a twisty heist'), ('Priya', '90s action'), ('Leo', None)]
HOST_IDEA = 'feel-good comedy'
SERVICES = ['Netflix', 'Prime Video', 'Disney\\+', 'Hulu', 'HBO Max']
APOS = '[’\']'


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ——— Peers: disposable participants on the public API ———

def request(path, body=None, cred=None):
    headers = {'Content-Type': 'application/json', 'x-yepwatch-client': 'native'}
    if cred:
        headers.update({'Authorization': 'Bearer ' + cred['token'], 'x-yepwatch-participant': cred['participantId']})
    url = API + path + ('&' if '?' in path else '?') + 'matchesIn=1&candidateReasons=1'
    data = None if body is None else json.dumps(body).encode()
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers, data=data), timeout=45) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504) and attempt < 5:
                time.sleep(3)
                continue
            raise RuntimeError(f'{e.code} on {path.split("?")[0].rsplit("/", 1)[-1]}') from None
        except (TimeoutError, urllib.error.URLError):
            if attempt == 5:
                raise
            time.sleep(2)


class Peer:
    def __init__(self, name, code):
        self.name = name
        self.room = request('/guest/resolve-invite', {'code': code})['roomId']
        admission = request(f'/rooms/{self.room}/join', {'contractVersion': 3, 'commandId': uuid.uuid4().hex,
                            'admissionSecret': secrets.token_urlsafe(32), 'nickname': name, 'inviteCode': code})
        self.cred = admission['credential']
        self.left = False

    def snap(self):
        return request('/rooms/' + self.room, cred=self.cred)

    def cmd(self, command):
        s = self.snap()
        return request(f'/rooms/{self.room}/commands', {'commandId': uuid.uuid4().hex, 'sequence': s['own']['nextSequence'], 'command': command}, self.cred)

    def yep(self, cid):
        s = self.snap()
        old = next((v for v in s['own']['votes'] if v['candidateId'] == cid), None)
        if not old or old.get('value') != 'watch':
            self.cmd({'type': 'vote', 'generation': s['shared']['generation'], 'candidateId': cid, 'expectedVoteRevision': old['revision'] if old else 0, 'value': 'watch'})

    def set_in(self, cid):
        s = self.snap()
        if cid not in s['own']['ins']['candidateIds']:
            self.cmd({'type': 'set_in', 'generation': s['shared']['generation'], 'candidateId': cid, 'in': True, 'expectedOwnInRevision': s['own']['ins']['revision']})

    def favorite(self, cid):
        s = self.snap()
        self.cmd({'type': 'pick_favorite', 'generation': s['shared']['generation'], 'tiebreakVersion': s['shared']['tiebreak']['version'], 'candidateId': cid})

    def leave(self):
        if self.left:
            return
        try:
            self.cmd({'type': 'leave'})
            self.left = True
        except Exception as error:
            log('peer leave failed', self.name, error)


# ——— Phone: Maestro for every UI action (same flows on Android and iOS), platform tools for pixels ———

class Phone:
    def __init__(self, platform, device, app_id, folder):
        self.platform, self.device, self.app_id, self.folder = platform, device, app_id, folder
        self.maestro = shutil.which('maestro') or str(Path.home() / '.maestro/bin/maestro')
        self.adb = str(Path(os.environ.get('ANDROID_HOME', Path.home() / 'Android/Sdk')) / 'platform-tools/adb')
        self.work = Path(tempfile.mkdtemp(prefix='yw-flow-'))
        self.apk = None

    def flow(self, steps, required=True):
        path = self.work / 'step.yml'
        path.write_text('appId: ' + self.app_id + '\n---\n' + json.dumps(steps))
        p = subprocess.run([self.maestro, '--device', self.device, 'test', str(path)], capture_output=True, text=True)
        if p.returncode and required:
            raise RuntimeError('Maestro step failed: ' + json.dumps(steps)[:300] + '\n' + p.stdout[-1500:])
        return p.returncode == 0

    def tap(self, text, required=True, index=None, wait=True):
        step = {'text': text, 'waitToSettleTimeoutMs': 600 if wait else 1}
        if index is not None:
            step['index'] = index
        return self.flow([{'tapOn': step}], required)

    def wait(self, text, timeout=60000):
        self.flow([{'extendedWaitUntil': {'visible': text, 'timeout': timeout}}])

    def labels(self):
        p = subprocess.run([self.maestro, '--device', self.device, 'hierarchy'], capture_output=True, text=True)
        out = []

        def walk(node):
            a = node.get('attributes', {})
            for key in ('accessibilityText', 'text', 'title', 'value'):
                if a.get(key):
                    out.append((a[key], a.get('bounds', '')))
            for child in node.get('children', []):
                walk(child)
        try:
            walk(json.loads(p.stdout[p.stdout.index('{'):]))
        except ValueError:
            pass
        return out

    def tap_visible(self, pattern):
        """Tap the largest on-screen element whose label fully matches (wide layouts keep hidden copies of some buttons)."""
        rx = re.compile(pattern)
        best = None
        for label, bounds in self.labels():
            b = [int(float(x)) for x in re.findall(r'-?[0-9.]+', bounds)]
            if not rx.fullmatch(label) or len(b) != 4 or b[2] <= b[0] or b[3] <= b[1] or b[0] < 0 or b[1] < 0:
                continue
            area = (b[2] - b[0]) * (b[3] - b[1])
            if not best or area > best[0]:
                best = (area, (b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
        if not best:
            return self.tap(pattern, wait=False)
        return self.flow([{'tapOn': {'point': f'{best[1]},{best[2]}', 'waitToSettleTimeoutMs': 1}}])

    def find(self, pattern):
        rx = re.compile(pattern)
        return next((label for label, _ in self.labels() if rx.search(label)), None)

    def screenshot(self, name):
        target = self.folder / (name + '.png')
        if self.platform == 'ios':
            subprocess.run(['xcrun', 'simctl', 'io', self.device, 'screenshot', str(target)], check=True, capture_output=True)
        else:
            target.write_bytes(subprocess.check_output([self.adb, '-s', self.device, 'exec-out', 'screencap', '-p']))
        log('screenshot', name)

    def record(self, name, action, after):
        """Native recording around one action (kept running `after` seconds past it); frames are chosen afterwards."""
        target = self.folder / (name + '.mp4')
        if self.platform == 'ios':
            p = subprocess.Popen(['xcrun', 'simctl', 'io', self.device, 'recordVideo', '--codec=h264', '--force', str(target)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(2)
            action()
            time.sleep(after)
            p.send_signal(signal.SIGINT)
            p.wait(timeout=60)
        else:
            subprocess.run([self.adb, '-s', self.device, 'shell', 'rm', '-f', '/sdcard/yw-rec.mp4'])
            p = subprocess.Popen([self.adb, '-s', self.device, 'shell', 'screenrecord', '--bit-rate', '60000000', '--time-limit', '60', '/sdcard/yw-rec.mp4'])
            time.sleep(1)
            action()
            time.sleep(after)
            subprocess.run([self.adb, '-s', self.device, 'shell', 'pkill', '-INT', 'screenrecord'])
            p.wait(timeout=60)
            time.sleep(1)
            target.write_bytes(subprocess.check_output([self.adb, '-s', self.device, 'exec-out', 'cat', '/sdcard/yw-rec.mp4'], timeout=120))
        log('recorded', name)


CARD = '. Swipe or use the choice buttons.'


def scenario(phone, notes):
    peers = []
    try:
        if phone.apk:
            # Relaunches of the repacked store APK can leave the system splash on top (seen on the emulator), so
            # Android starts from a fresh install instead of clearing state.
            subprocess.run([phone.adb, '-s', phone.device, 'uninstall', phone.app_id], capture_output=True)
            subprocess.run([phone.adb, '-s', phone.device, 'install', phone.apk], check=True, capture_output=True)
            # Maestro's launchApp restarts the activity on Android and the system splash then stays on top.
            subprocess.run([phone.adb, '-s', phone.device, 'shell', 'monkey', '-p', phone.app_id, '1'], check=True, capture_output=True)
            phone.flow([{'extendedWaitUntil': {'visible': 'Continue with GoodWatch', 'timeout': 90000}}])
        else:
            phone.flow([{'launchApp': {'clearState': True}}, {'extendedWaitUntil': {'visible': 'Continue with GoodWatch', 'timeout': 90000}}])
        # The boot mark fades out after the controls exist; the intro film starts after it.
        time.sleep(10)
        phone.screenshot('01-start-first')
        phone.tap('Start with you', index=0)
        phone.wait('What should we call you.*')
        phone.flow([{'tapOn': {'text': 'Your name'}}, {'inputText': 'Alex'}, 'hideKeyboard', {'tapOn': {'text': 'Continue', 'waitToSettleTimeoutMs': 1500}}])
        phone.wait('Seen it. Did you like it.')
        time.sleep(2)
        phone.screenshot('02-taste-card')
        for answer in ['Loved it', 'Not for me', 'Loved it']:
            phone.tap(answer)
            time.sleep(1)
        time.sleep(2)
        # A slow drag to the right: the card leans into Loved it on the way out.
        phone.record('03-taste-swipe', lambda: phone.flow([{'swipe': {'start': '50%, 45%', 'end': '96%, 47%', 'duration': 2600}}], required=False), 2)
        for answer in ['Haven' + APOS + 't seen', 'Loved it', 'Not for me', 'Loved it', 'Haven' + APOS + 't seen', 'Loved it', 'Loved it']:
            if phone.find('^New couch$'):
                break
            phone.tap(answer, required=False)
            time.sleep(1)
        phone.wait('New couch', 60000)
        time.sleep(4)
        phone.screenshot('04-start-setup')

        phone.tap('New couch')
        phone.wait('Who' + APOS + 's here')
        # Android's hideKeyboard presses Back when no keyboard is up, which would leave the couch.
        phone.flow([{'tapOn': {'text': 'Describe what you want to watch'}}, {'inputText': HOST_IDEA}, {'tapOn': {'text': 'Add', 'index': 0, 'waitToSettleTimeoutMs': 1500}}]
                   + (['hideKeyboard'] if phone.platform == 'ios' else []))
        phone.tap('Invite friends, show QR code and link')
        qr = None
        for _ in range(10):
            qr = phone.find('QR code for yepwatch.com/r/')
            if qr:
                break
            time.sleep(1)
        if not qr:
            raise RuntimeError('Invite code not shown')
        code = qr.rsplit('/', 1)[-1].strip()
        for name, idea in PEERS:
            peer = Peer(name, code)
            peers.append(peer)
            if idea:
                peer.cmd({'type': 'add_idea', 'text': idea})
            time.sleep(1.5)
        time.sleep(3)
        phone.screenshot('05-invite')
        phone.tap('Close')
        phone.tap('Movies and shows')
        phone.tap('Streaming services, add')
        for service in SERVICES:
            phone.tap('^' + service + '$', required=False, index=0)
        phone.tap('Done')
        time.sleep(6)
        phone.screenshot('06-couch-setup')

        phone.tap('Start with 5')
        phone.tap('Skip the how-to', required=False)
        phone.wait('Would you watch this tonight.')
        time.sleep(3)
        phone.screenshot('07-tonight')
        candidates = {c['title']: c['id'] for c in peers[0].snap()['shared']['candidates']}
        matches = []
        plan = ['yep', 'match', 'nope', 'match', 'yep', 'nope', 'match', 'yep', 'match', 'nope', 'yep', 'match']
        last, index, attempts = None, 0, 0
        while index < len(plan) and attempts < len(plan) + 4:
            attempts += 1
            kind = plan[index]
            label = None
            for _ in range(3):
                # The card that just left can stay in the tree for a moment: prefer a card label that isn't it.
                cards = [l for l, _ in phone.labels() if l.endswith(CARD)]
                fresh = [l for l in cards if l != last]
                label = fresh[0] if fresh else None
                if label:
                    break
                time.sleep(1.5)
            if not label:
                if last and last in cards:
                    # The vote didn't land (the first tap after a new screen can be swallowed): vote this card again.
                    label = last
                    index -= 1 if index else 0
                    kind = plan[index]
                    notes['votes'].append({'index': index, 'retry': True})
                else:
                    break
            last = label
            title = label[:-len(CARD)]
            cid = candidates.get(title)
            if kind == 'match' and cid:
                for peer in peers:
                    peer.yep(cid)
                if cid not in matches:
                    matches.append(cid)
            button = 'Nope' if kind == 'nope' else 'Yep'
            phone.record(f'v{attempts:02d}-{kind}', lambda: phone.tap_visible(button), 4 if kind == 'match' else 2.5)
            notes['votes'].append({'index': index, 'kind': kind, 'title': title})
            index += 1
            time.sleep(1.5)

        phone.tap('[0-9]+ matches')
        phone.wait('What are we watching now.')
        titles = {v: k for k, v in candidates.items()}
        first, second = matches[0], matches[1]
        others = matches[2:]
        plan_ins = {first: ['Mia', 'Sam', 'Priya', 'Leo'], second: ['Mia', 'Sam', 'Priya', 'Leo']}
        for i, cid in enumerate(others):
            plan_ins[cid] = [['Sam', 'Priya'], ['Mia'], ['Leo', 'Mia'], ['Sam']][i % 4]
        byname = {p.name: p for p in peers}
        for cid, names in plan_ins.items():
            for name in names:
                byname[name].set_in(cid)
        time.sleep(2)
        phone.tap('I' + APOS + 'm in for ' + re.escape(titles[first]) + '.*')
        time.sleep(3)
        phone.screenshot('08-matches')
        phone.tap('I' + APOS + 'm in for ' + re.escape(titles[second]) + '.*')
        time.sleep(3)
        phone.screenshot('09-matches-two')
        # Four people left: picks can tie, so the spin decides.
        byname['Leo'].leave()
        time.sleep(3)
        phone.tap('Pick one of 2')
        phone.wait('Which one first.')
        byname['Mia'].favorite(first)
        byname['Sam'].favorite(second)
        byname['Priya'].favorite(second)
        time.sleep(2)
        phone.screenshot('10-tiebreak')
        phone.record('11-spin', lambda: phone.tap(re.escape(titles[first]) + ', my favorite', wait=False), 10)
        phone.wait('Start again', 60000)
        time.sleep(3)
        phone.screenshot('12-decided')
        notes['matches'] = [titles[c] for c in matches]
    finally:
        for peer in peers:
            peer.leave()
        try:
            phone.tap('Profile', required=False)
            phone.tap('Reset my taste', required=False)
            notes['tasteReset'] = phone.tap('^Reset$', required=False)
        except Exception as error:
            log('taste reset failed', type(error).__name__)


def ios(families, app_glob):
    types = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devicetypes', '--json']))['devicetypes']
    runtimes = [r for r in json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'runtimes', '--json']))['runtimes'] if r['isAvailable'] and r['name'].startswith('iOS')]
    apps = [a for pattern in app_glob for a in glob.glob(pattern, recursive=True)]
    if not apps:
        raise RuntimeError('Native simulator artifact missing')
    devices = {'iphone-medium': ['iPhone 17 Pro', 'iPhone 16 Pro'], 'iphone-large': ['iPhone 17 Pro Max', 'iPhone 16 Pro Max'], 'ipad': ['iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)']}
    results = []
    for family in families:
        folder = OUTPUT / family
        folder.mkdir(parents=True, exist_ok=True)
        udid, chosen = None, None
        for runtime in reversed(runtimes):
            for device in [d for name in devices[family] for d in types if d['name'] == name]:
                p = subprocess.run(['xcrun', 'simctl', 'create', 'YepWatch rethink ' + family, device['identifier'], runtime['identifier']], capture_output=True, text=True)
                if p.returncode == 0:
                    udid, chosen = p.stdout.strip(), (device['name'], runtime['name'])
                    break
            if udid:
                break
        if not udid:
            raise RuntimeError('Required display simulator unavailable: ' + family)
        notes = {'family': family, 'device': chosen[0], 'runtime': chosen[1], 'votes': []}
        try:
            subprocess.run(['xcrun', 'simctl', 'boot', udid], check=True)
            subprocess.run(['xcrun', 'simctl', 'bootstatus', udid, '-b'], check=True, capture_output=True)
            subprocess.run(['xcrun', 'simctl', 'status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100'], check=True)
            subprocess.run(['xcrun', 'simctl', 'install', udid, apps[0]], check=True)
            scenario(Phone('ios', udid, 'com.yepwatch.app', folder), notes)
            notes['passed'] = True
        except Exception as error:
            log('capture failed', family, str(error)[:2000])
            notes['passed'] = False
            notes['error'] = str(error)[:2000]
            subprocess.run(['xcrun', 'simctl', 'io', udid, 'screenshot', str(folder / 'failure.png')])
        finally:
            subprocess.run(['xcrun', 'simctl', 'shutdown', udid])
            (folder / 'capture.json').write_text(json.dumps(notes, indent=2))
            results.append(notes)
    return results


OUTPUT = Path('.expo/store-rethink').resolve()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('platform', choices=['ios', 'android'])
    parser.add_argument('--families', nargs='+', default=['iphone-medium', 'iphone-large', 'ipad'])
    parser.add_argument('--device', default='emulator-5578')
    parser.add_argument('--app-id', default='com.yepwatch.app')
    parser.add_argument('--apk', help='Android: install this APK fresh before the run')
    parser.add_argument('--output', default=str(OUTPUT))
    options = parser.parse_args()
    OUTPUT = Path(options.output).resolve()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if options.platform == 'ios':
        results = ios(options.families, ['ios/build/Build/Products/*simulator/*.app', '.expo/store-simulator/**/*.app', 'ios/build/*.app'])
    else:
        folder = OUTPUT / 'android'
        folder.mkdir(parents=True, exist_ok=True)
        notes = {'family': 'android', 'device': options.device, 'votes': []}
        try:
            phone = Phone('android', options.device, options.app_id, folder)
            phone.apk = options.apk
            scenario(phone, notes)
            notes['passed'] = True
        finally:
            (folder / 'capture.json').write_text(json.dumps(notes, indent=2))
        results = [notes]
    (OUTPUT / 'capture-result.json').write_text(json.dumps(results, indent=2))
    if any(not r.get('passed') for r in results):
        raise SystemExit('Inspect the capture notes')
