"""Ordinary visible native guest flow. Explicit serial; no uninstall/reset or credential inspection."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

spec = importlib.util.spec_from_file_location('android_ui', Path(__file__).with_name('native-android-smoke.py'))
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
if not os.environ.get('YEPWATCH_ANDROID_SERIAL'):
    raise RuntimeError('Set YEPWATCH_ANDROID_SERIAL explicitly')
ui.OUT = Path(__file__).resolve().parents[1] / 'artifacts/hybrid'
ui.OUT.mkdir(exist_ok=True)
checks = []
result = {'serial': ui.SERIAL, 'physicalDevice': not ui.SERIAL.startswith('emulator-'), 'package': 'dev.yepwatch.hybrid', 'api': 'http://127.0.0.1:15992', 'gateway': 'ws://127.0.0.1:4324', 'metro': 8141, 'catalog': 'Finite real catalog sample; actual durable API', 'checks': checks}
try:
    ui.find('Your nickname', timeout=90)
    ui.screenshot('android-entry.png')
    ui.fill('Your nickname', 'AndroidHybrid')
    ui.tap('Create a room')
    ui.tap('Choose our services')
    ui.tap('Change country')
    ui.fill('Find country', 'Germany')
    ui.tap('Germany')
    ui.tap('Netflix (service 8)')
    ui.tap('Use these services')
    ui.tap('Start choosing')
    ui.find('Yep', timeout=60)
    deadline = time.monotonic()+30
    while time.monotonic()<deadline:
        if not any(n.get('content-desc')=='Refresh room' for n in ui.nodes()): break
        time.sleep(.4)
    else: raise RuntimeError('Native authenticated connection did not become live')
    checks.append('Native guest create, explicit DE/Netflix8 and authenticated WebSocket choosing')
    first = ui.poster()
    ui.tap('Nope')
    ui.tap('Undo last choice')
    if ui.poster()!=first: raise RuntimeError('Undo did not restore same retained card')
    ui.tap('Yep')
    ui.tap('Inspect 1 matches')
    ui.screenshot('android-wall.png')
    ui.tap('Shortest: Movie runtime · shows per episode, not ranked against movies')
    ui.tap('Quickest: Average active time the whole room took to say Yep')
    if any(n.get('content-desc')=='Watch trailer' for n in ui.nodes()): raise RuntimeError('Decision wall exposed a trailer')
    proposal = next(n.get('content-desc') for n in ui.nodes() if n.get('class')=='android.widget.Button' and n.get('content-desc','').startswith('Propose '))
    ui.tap(proposal)
    ui.find('Everyone agrees. Enjoy your watch.', timeout=60)
    ui.screenshot('android-done.png')
    checks.append('Native Yep, immediate match, honest lenses, explicit proposal and fresh-check Done')
    ui.adb('shell','input','keyevent','KEYCODE_HOME')
    ui.adb('shell','am','start','-n','dev.yepwatch.hybrid/.MainActivity')
    ui.find('Everyone agrees. Enjoy your watch.')
    checks.append('Native background/resume preserves confirmed decision')
    result['passed']=True
except Exception as e:
    result['passed']=False
    result['failure']=str(e)
    # Do not capture a failed screen that could be an invitation drawer.
    raise
finally:
    result['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (ui.OUT/'android-solo.json').write_text(json.dumps(result,indent=2)+'\n')
