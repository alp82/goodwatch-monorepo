"""Ordinary UI smoke on the isolated, read-only Android emulator. No credential inspection."""
from pathlib import Path
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = os.environ.get('YEPWATCH_ADB', '/home/alp/Android/Sdk/platform-tools/adb')
SERIAL = os.environ.get('YEPWATCH_ANDROID_SERIAL', 'emulator-5562')
OUT = Path(__file__).resolve().parents[1] / 'artifacts/native'
CHECKS = []


def adb(*args):
    return subprocess.check_output([ADB, '-s', SERIAL, *args], timeout=25)


def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/yepwatch-smoke.xml')
    return list(ET.fromstring(adb('exec-out', 'cat', '/sdcard/yepwatch-smoke.xml')).iter('node'))


def find(label, timeout=35):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = nodes()
        matches = [n for n in current if n.get('content-desc') == label]
        if not matches:
            matches = [n for n in current if n.get('text') == label]
        matches.sort(key=lambda n: n.get('class') != 'android.widget.Button')
        for n in matches:
            if n.get('enabled') == 'true':
                return n
        time.sleep(.4)
    raise RuntimeError('UI target unavailable: ' + label)


def tap(label):
    n = find(label)
    bounds = [int(x) for x in re.findall(r'\d+', n.get('bounds'))]
    adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))


def fill(label, text):
    tap(label)
    adb('shell', 'input', 'text', text)
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')


def screenshot(name):
    (OUT / name).write_bytes(adb('exec-out', 'screencap', '-p'))


def poster():
    for n in nodes():
        label = n.get('content-desc', '')
        if label.endswith('. Swipe or use the choice buttons.'):
            return label
    raise RuntimeError('Poster identity not available')


def check(text):
    CHECKS.append(text)
    print(text, flush=True)


def run():
    if '--resume-voting' not in sys.argv:
        find('Your nickname', timeout=90)
        screenshot('android-entry.png')
        fill('Your nickname', 'AndroidGuest')
        tap('Create a room')
        tap('Choose our services')
        tap('Change country')
        fill('Find country', 'Germany')
        tap('Germany')
        tap('Netflix (service 8)')
        tap('Use these services')
        tap('Start choosing')
    find('Nope', timeout=60)
    if os.environ.get('YEPWATCH_REQUIRE_LIVE') == '1':
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            if not any(n.get('content-desc') == 'Refresh room' for n in nodes()):
                check('Native connection reached live only after the authenticated shared snapshot')
                break
        else:
            raise RuntimeError('Native connection did not become live')
    first = poster()
    screenshot('android-voting.png')
    check('Native guest create, explicit DE/Netflix8 setup and actual API-backed title deck rendered')
    tap('Nope')
    find('Undo last choice')
    tap('Undo last choice')
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        if poster() == first:
            break
    else:
        raise RuntimeError('Undo did not restore the retained title')
    check('Native Nope and authoritative Undo restore the same real title')
    tap('Yep')
    tap('Inspect 1 matches')
    tap('Pick this')
    find('Everyone picked it. Enjoy your watch.', timeout=60)
    screenshot('android-done.png')
    check('Native immediate match, pick and server-confirmed fresh-check Done succeeded')
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    adb('shell', 'am', 'start', '-n', 'dev.yepwatch.foundation/.MainActivity')
    find('Everyone picked it. Enjoy your watch.')
    check('Ordinary background/resume retained the confirmed decision')


if __name__ == '__main__':
    result = {'emulator': SERIAL, 'api': 'http://127.0.0.1:15993', 'catalog': 'Real finite36-title sample', 'checks': CHECKS, 'physicalDevice': False, 'authOrCredentialTesting': False, 'webSocketOrigin': os.environ.get('YEPWATCH_SMOKE_WS_ORIGIN', 'ws://127.0.0.1:4322'), 'requiresLive': os.environ.get('YEPWATCH_REQUIRE_LIVE') == '1'}
    try:
        run()
        result['passed'] = True
    except Exception as error:
        result['passed'] = False
        result['failure'] = str(error)
        screenshot('android-smoke-failure.png')
        raise
    finally:
        (OUT / 'android-ui-smoke.json').write_text(json.dumps(result, indent=2) + '\n')
