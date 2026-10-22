"""Actual native host and two ordinary browser participants; explicit serial, no API-created room."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time

if not os.environ.get('YEPWATCH_ANDROID_SERIAL'): raise RuntimeError('Set explicit YEPWATCH_ANDROID_SERIAL')
spec=importlib.util.spec_from_file_location('ui',Path(__file__).with_name('native-android-smoke.py'))
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
ui.OUT=Path(__file__).resolve().parents[1]/'artifacts/hybrid'
checks=[];peer=None
result={'serial':ui.SERIAL,'physicalDevice':not ui.SERIAL.startswith('emulator-'),'package':'dev.yepwatch.hybrid','api':'http://127.0.0.1:15992','gateway':'ws://127.0.0.1:4324','browser':'http://127.0.0.1:8133','checks':checks}
def command(body,expected):
    peer.stdin.write(json.dumps(body)+'\n');peer.stdin.flush()
    reply=json.loads(peer.stdout.readline())
    if reply.get('type')!=expected: raise RuntimeError('Browser action failed: '+str(reply.get('message',expected)))
    return reply
try:
    ui.tap('Choose again')
    ui.tap('Invite friends')
    invite=next(n.get('text') for n in ui.nodes() if n.get('text','').startswith('http://127.0.0.1:8133/r/'))
    ui.tap('Close panel')
    peer=subprocess.Popen(['node',str(Path(__file__).with_name('hybrid-native-peers.cjs'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
    command({'type':'join','invite':invite},'ready')
    ui.tap('Start choosing')
    ui.find('Yep',timeout=60)
    command({'type':'voteTwo'},'voted')
    ui.tap('Yep');ui.tap('Yep')
    ui.tap('Inspect 2 matches')
    propose=next(n.get('content-desc') for n in ui.nodes() if n.get('class')=='android.widget.Button' and n.get('content-desc','').startswith('Propose '))
    ui.tap(propose)
    command({'type':'inspectAndAgreeOne'},'agreed')
    checks.append('Native explicit proposal received independent browser agreement without unilateral Done')
    command({'type':'replaceTwo'},'replaced')
    deadline=time.monotonic()+30
    while time.monotonic()<deadline:
        agree=next((n.get('content-desc') for n in ui.nodes() if n.get('class')=='android.widget.Button' and n.get('content-desc','').startswith('Agree to ')),None)
        if agree: break
        time.sleep(.3)
    else: raise RuntimeError('Native did not receive replacement proposal')
    ui.screenshot('native-mixed-replacement.png')
    ui.tap(agree)
    ui.tap('Take back your agreement')
    agree=next(n.get('content-desc') for n in ui.nodes() if n.get('class')=='android.widget.Button' and n.get('content-desc','').startswith('Agree to '))
    ui.tap(agree)
    checks.append('Browser replacement cleared native approval; native Agree and withdrawal were explicit and live')
    reply=command({'type':'agreeFinal'},'done')
    ui.find('Everyone agrees. Enjoy your watch.',timeout=60)
    ui.screenshot('native-mixed-done.png')
    if reply['errors']:raise RuntimeError('Browser JavaScript error')
    checks.append('All three current identities explicitly agreed to replacement; fresh availability produced confirmed Done on native and browsers')
    result.update(passed=True,sharedFrames=reply['sharedFrames'],activityFrames=reply['activityFrames'],javascriptErrors=reply['errors'])
except Exception as e:
    result.update(passed=False,failure=str(e));raise
finally:
    if peer:
        try:peer.stdin.write(json.dumps({'type':'close'})+'\n');peer.stdin.flush()
        except BrokenPipeError:pass
        try:peer.wait(timeout=20)
        except subprocess.TimeoutExpired:peer.terminate();peer.wait(timeout=10)
    result['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (ui.OUT/'native-mixed.json').write_text(json.dumps(result,indent=2)+'\n')
