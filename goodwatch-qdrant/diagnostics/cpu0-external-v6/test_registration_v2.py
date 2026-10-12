"""Local v2 authority/cleanup seams; no remote process actions."""
import copy
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest import mock
import registration_v2 as r


def birth(pid,parent):
    return dict(pid=pid,startTicks=100+pid,parentPid=parent,exeIdentityHash='a'*64,
                groupHash='b'*64,VmLckBytes=0,outsideSourceCgroup=True)


def source_fixture():
    def process(pid,parent):
        return {key:value for key,value in birth(pid,parent).items() if key!='outsideSourceCgroup'}
    return dict(state=dict(containerIdHash='d'*64,configurationHash='e'*64,running=True,
        startedAt='2026-10-12T19:42:29.283685237Z',finishedAt='0001-01-01T00:00:00Z',
        restartCount=0,exitCode=0,OOMKilled=False),wrapper=process(901,900),qdrant=process(902,901),
        scriptSha256='a'*64,wrapperArgvHash='b'*64,RecoveryAllowed=False,
        activeServiceConnections=0,connectionCensusComplete=True,liveMountIdentityHash='f'*64,
        readerOutsideSourceSubtree=True,readerVmLckBytes=0)


def renewal_fixture(historical, successor=True):
    current=copy.deepcopy(historical)
    raw='1'*64; current['state']['containerIdHash']=r.sha(raw.encode())
    historical['state']['containerIdHash']=current['state']['containerIdHash']
    if successor:
        current['wrapper'].update(pid=911,startTicks=1011)
        current['qdrant'].update(pid=912,startTicks=1012,parentPid=911)
    current['activeServiceConnections']=1
    rows=[dict(depth=0,groupIdentitySha256='2'*64,quotaMicros=None,periodMicros=100000,
               nrThrottled=3,throttledMicros=10),
          dict(depth=1,groupIdentitySha256='3'*64,applicability='hierarchy-root-no-bandwidth-controller',
               quotaMicros=None,periodMicros=None,nrThrottled=None,throttledMicros=None,
               usageMicros=100,userMicros=70,systemMicros=30)]
    return dict(schema='clone-cleanup-source-renewal.cpu0.v2',variant=r.VARIANT,
        historicalSource=copy.deepcopy(historical),currentSource=current,
        sourceIdentity=[raw,'sha256:'+'4'*64,current['qdrant']['pid'],current['qdrant']['startTicks']],
        sourceLimits=dict(memoryMaxBytes=6*1024**3,memoryHighBytes=None,memorySwapMaxBytes=0),
        cpuHierarchy=dict(schema='search.clone-cpu-hierarchy.v1',rows=rows,weight=100,
            cpusetCpus='',cpusetMems='',identityUnchangedRequired=True),
        sourceEvents=dict(max=20,oom=1,oom_kill=0),
        lifecycleLineage={key:True for key in ('sameContainer','sameConfiguration','reviewedScript',
            'sameMountIdentity','sameWrapperArgv','recoveryDisallowed')},cleanupOnly=True,admission=False)


def fixture():
    value={key:'c'*64 for key in r.ENROLMENT_KEYS}
    value.update(schema='cpu0-consumer-enrolment.v2',variant=r.VARIANT,
        source=source_fixture(),raiseOwnNofile=True,
        nodeIdentity={'device':1,'inode':2,'size':3,'mtimeNs':'1770000000000000000','ctimeNs':'1770000000000000001'},
        sharedControlIdentity={'device':1,'inode':4},registeredBeforeEntrySample=True,productionAcceptance=False)
    for role,pid,parent in [('consumer',101,102),('transportParent',102,103),('preflight',104,101)]:
        value[role]={'identity':birth(pid,parent),'metrics':{'RssAnonBytes':4096,'VmPTEBytes':4096}}
    value['consumerArgvHash']=r.sha(r.canonical(r.expected_argv(value['sourceFreezeSha256'],
        value['externalManifestSha256'],value['consumerPredecessorSha256'],True)))
    return value


def final(enrolled):
    return dict(schema='cpu0-consumer-registration.v2',variant=r.VARIANT,
        consumerEnrolmentSha256=r.sha(r.canonical(enrolled)+b'\n'),
        **{key:enrolled[key] for key in ('sourceFreezeSha256','externalManifestSha256',
          'consumerPredecessorSha256','adoptionIntentSha256','raiseOwnNofile','consumerArgvHash',
          'source','nodeProvenanceSha256','nodeIdentity','sharedControlIdentity')},
        predecessorSha256='d'*64,consumerBirth=enrolled['consumer']['identity'],
        transportParentBirth=enrolled['transportParent']['identity'],preflightBirth=enrolled['preflight']['identity'],
        preflightExit=dict(observed=True,exitCode=0,signal=None,birthGone=True),registeredBeforeCapture=True)


class RegistrationV2Tests(unittest.TestCase):
    def test_closed_enrolment_legacy_and_extra_refused(self):
        value=fixture();self.assertIs(r.validate_enrolment(value),value)
        for change in ({'schema':'cpu0-consumer-enrolment.v1'},{'extra':True},
                       {'productionAcceptance':True},{'raiseOwnNofile':1}):
            with self.subTest(change=change),self.assertRaises(RuntimeError):r.validate_enrolment({**value,**change})

    def test_numeric_identity_and_decimal_nanoseconds_exact(self):
        for key,bad in [('pid',True),('startTicks',2**53),('parentPid',0),('VmLckBytes',4096),('outsideSourceCgroup',False)]:
            value=fixture();value['consumer']['identity'][key]=bad
            with self.subTest(key=key),self.assertRaises(RuntimeError):r.validate_enrolment(value)
        for bad in (1770000000000000000,'0177','1e18','-1','1'*21):
            value=fixture();value['nodeIdentity']['mtimeNs']=bad
            with self.subTest(bad=bad),self.assertRaises(RuntimeError):r.validate_enrolment(value)

    def test_parent_relations_are_required(self):
        for role in ('consumer','preflight'):
            value=fixture();value[role]['identity']['parentPid']=999
            with self.subTest(role=role),self.assertRaises(RuntimeError):r.validate_enrolment(value)

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(RuntimeError):r.decoded(b'{"schema":"good","schema":"bad"}')

    def test_exact_v2_selector_flag_order(self):
        argv=r.expected_argv('a'*64,'b'*64,'c'*64,True)
        self.assertEqual(argv[2],'--execute-reviewed-fixed-capacity-v2')
        self.assertEqual(argv[3:5],['--handoff-sha256','c'*64]);self.assertEqual(argv[-1],'--raise-own-nofile')
        self.assertNotIn('--execute-reviewed',argv)
        self.assertNotIn('--raise-own-nofile',r.expected_argv('a'*64,'b'*64,'c'*64,False))

    def test_close_zero_not_birth_absence(self):
        for change in ({'birthGone':False},{'birthGone':None},{'observed':False},{'exitCode':True},{'signal':'SIGTERM'}):
            value=dict(observed=True,exitCode=0,signal=None,birthGone=True);value.update(change)
            with self.subTest(change=change),self.assertRaises(RuntimeError):r.preflight_exit(value)

    def test_public_read_mode_links_and_bounds(self):
        # Local user owns tempfile; only root UID is an explicit stat seam.
        real_lstat=Path.lstat;real_fstat=os.fstat
        def root_stat(value):
            names=('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_mode','st_nlink')
            return types.SimpleNamespace(**{key:getattr(value,key) for key in names},st_uid=0)
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(r.Path,'lstat',lambda path:root_stat(real_lstat(path))), \
             mock.patch.object(r.os,'fstat',lambda fd:root_stat(real_fstat(fd))):
            path=Path(directory)/'proof';path.write_bytes(b'{}');path.chmod(0o600)
            self.assertEqual(r.read_public(path)[0],b'{}')
            with self.assertRaises(RuntimeError):r.read_public(path,1)
            path.chmod(0o644)
            with self.assertRaises(RuntimeError):r.read_public(path)
            path.chmod(0o600);alias=Path(directory)/'alias';os.link(path,alias)
            with self.assertRaises(RuntimeError):r.read_public(path)
            alias.unlink();alias.symlink_to(path)
            with self.assertRaises(RuntimeError):r.read_public(alias)

    def cleanup(self,enrolled,life,record=None):
        def read(path,*args):return r.canonical(record if path==r.RECORD else enrolled)+b'\n',None
        with mock.patch.object(r.os.path,'lexists',side_effect=lambda p:p==r.ENROLMENT or record is not None), \
             mock.patch.object(r,'read_public',side_effect=read), \
             mock.patch.object(r,'cleanup_birth',return_value={'birthGone':True,'exitObserved':True,'signalSent':False}) as cleanup:
            try:
                result=r.cleanup_from_receipts(life,None,expected_source_sha=enrolled['sourceFreezeSha256'],
                    expected_external_sha=enrolled['externalManifestSha256'],expected_node_receipt_sha=enrolled['nodeProvenanceSha256'])
                return result,cleanup.call_count,None
            except BaseException as error:return None,cleanup.call_count,error

    def test_preliminary_cleanup_before_sha_emission(self):
        result,count,error=self.cleanup(fixture(),types.SimpleNamespace(birth_gone=lambda *a:True))
        self.assertIsNone(error);self.assertEqual(count,1);self.assertFalse(result['finalRegistrationObserved'])
        self.assertFalse(result['unknownUnregisteredChildrenAbsentProven']);self.assertFalse(result['preflightSignalSent'])

    def test_bad_final_does_not_suppress_preliminary_cleanup(self):
        value=fixture()
        for key,bad in [('raiseOwnNofile',False),('consumerArgvHash','e'*64),('adoptionIntentSha256','e'*64),
                        ('source',{}),('sharedControlIdentity',{'device':1,'inode':99})]:
            record=copy.deepcopy(final(value));record[key]=bad
            result,count,error=self.cleanup(value,types.SimpleNamespace(birth_gone=lambda *a:True),record)
            with self.subTest(key=key):
                self.assertEqual(count,1);self.assertIsInstance(error,RuntimeError)
                self.assertTrue(error.consumerCleanupEvidence['birthGone']);self.assertFalse(error.consumerCleanupEvidence['finalRegistrationObserved'])

    def test_orphan_preflight_observe_only_unknown(self):
        result,count,error=self.cleanup(fixture(),types.SimpleNamespace(birth_gone=lambda *a:False))
        self.assertIsNone(error);self.assertEqual(count,1);self.assertTrue(result['unknownRetained'])
        self.assertFalse(result['preflightSignalSent']);self.assertEqual(result['preflightCleanupPolicy'],'observe-only')

    def test_preflight_census_failure_still_cleans_eligible_node(self):
        original=RuntimeError('closed_census_failure')
        def fail(*args):raise original
        result,count,error=self.cleanup(fixture(),types.SimpleNamespace(birth_gone=fail))
        self.assertIs(error,original);self.assertEqual(count,1)
        self.assertIsNone(error.consumerCleanupEvidence['preflightBirthGone']);self.assertTrue(error.consumerCleanupEvidence['unknownRetained'])

    def test_zombie_and_reuse_never_signal(self):
        for ticks,gone,ready in ((201,False,True),(999,True,False)):
            life=types.SimpleNamespace(birth=lambda *a:ticks,birth_gone=lambda *a:gone)
            with mock.patch.object(r,'protected',return_value=({},set())),mock.patch.object(r.os,'pidfd_open',return_value=55), \
                 mock.patch.object(r.os,'close'),mock.patch.object(r.select,'select',return_value=([55] if ready else [],[],[])), \
                 mock.patch.object(r.signal,'pidfd_send_signal') as send:
                result=r.cleanup_birth(life,None,fixture(),scope='test')
            self.assertEqual(result['birthGone'],gone);self.assertEqual(result['exitObserved'],ready);send.assert_not_called()

    def test_owned_real_local_child_term_and_reap(self):
        # Recipe checks explicitly stubbed; only this owned local child receives TERM.
        child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'])
        try:
            ticks=int(Path(f'/proc/{child.pid}/stat').read_text().rsplit(')',1)[1].split()[19])
            value=fixture();value['consumer']['identity'].update(pid=child.pid,startTicks=ticks)
            def gone(pid,start):
                try:return int(Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()[19])!=start
                except FileNotFoundError:return True
            life=types.SimpleNamespace(birth=lambda *a:ticks,birth_gone=gone,attest=lambda *a:{})
            evidence=renewal_fixture(value['source'])
            controller=types.SimpleNamespace(renew_cleanup=lambda *a:copy.deepcopy(evidence))
            with mock.patch.object(r,'cleanup_context',return_value=({},None,None)), \
                 mock.patch.object(r,'current_node',return_value=value['nodeIdentity']), \
                 mock.patch.object(r,'confirm_birth',return_value={'parentPid':os.getpid()}):
                result=r.cleanup_birth(life,None,value,scope='owned-local-fixture',controller=controller)
            self.assertTrue(result['signalSent']);self.assertTrue(result['exitObserved']);self.assertFalse(result['birthGone'])
            self.assertEqual(child.wait(timeout=2),-15);self.assertTrue(gone(child.pid,ticks))
        finally:
            if child.poll() is None:child.kill();child.wait(timeout=2)

    def test_register_caller_projection_is_only_equality_not_authority(self):
        value=fixture();raw=r.canonical(value)+b'\n';changed=copy.deepcopy(value)
        changed['consumer']['identity']['pid']=777
        with mock.patch.object(r,'acquire_control',return_value=55),mock.patch.object(r.os,'close'), \
             mock.patch.object(r,'read_public',return_value=(raw,None)),mock.patch.object(r,'installed') as installed, \
             mock.patch.object(r,'write_registration') as write:
            with self.assertRaisesRegex(RuntimeError,'consumer_enrolment_changed'):
                r.register(None,None,'d'*64,changed['consumer']['identity'],value['sourceFreezeSha256'],
                    value['externalManifestSha256'],value['consumerPredecessorSha256'],True,
                    enrolment_sha=r.sha(raw),enrolment_projection=changed,
                    preflight_exit_evidence=dict(observed=True,exitCode=0,signal=None,birthGone=True),
                    node_receipt_sha=value['nodeProvenanceSha256'])
            installed.assert_not_called();write.assert_not_called()

    def test_final_registration_publication_exclusive_and_canonical(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(r,'ROOT',Path(folder)), \
             mock.patch.object(r,'RECORD',Path(folder)/'record'),mock.patch.object(r,'directory'):
            value=final(fixture());digest=r.write_registration(value)
            raw=(Path(folder)/'record').read_bytes()
            self.assertEqual(raw,r.canonical(value)+b'\n');self.assertEqual(digest,r.sha(raw))
            with self.assertRaises(FileExistsError):r.write_registration(value)
            self.assertEqual((Path(folder)/'record').read_bytes(),raw)

    def test_predecessor_intent_and_role_closed(self):
        value=fixture();handoff=dict(schema='clone-lifecycle-handoff.cpu0.v2',owner='preflight',
            previousSha256=value['consumerPredecessorSha256'],snapshot={},adoptionIntentSha256=value['adoptionIntentSha256'])
        r.handoff_enrolment(handoff,value)
        for change in ({'owner':'adoption'},{'previousSha256':'e'*64},{'adoptionIntentSha256':'e'*64},{'extra':True}):
            with self.subTest(change=change),self.assertRaises(RuntimeError):r.handoff_enrolment({**handoff,**change},value)

    def test_original_refusal_preserved_if_pidfd_close_fails(self):
        original=RuntimeError('consumer_birth_changed')
        life=types.SimpleNamespace(birth=lambda *a:201,birth_gone=lambda *a:False)
        with mock.patch.object(r.os,'pidfd_open',return_value=55), \
             mock.patch.object(r.select,'select',return_value=([],[],[])),mock.patch.object(r,'cleanup_context',side_effect=original), \
             mock.patch.object(r.os,'close',side_effect=OSError(9,'ignored')):
            with self.assertRaises(RuntimeError) as caught:r.cleanup_birth(life,None,fixture(),scope='test',controller=object())
        self.assertIs(caught.exception,original)
        self.assertEqual(original.registrationCleanupFailure,['consumer_registration_fd_close_failed'])

    def stage_fixture(self,folder):
        value=fixture();files={name:b'fixture-public-bytes' for name in r.FULL_NAMES}
        helper=b'{"fixture":true}';value['helperPolicySha256']=r.sha(helper)
        control=r.canonical(dict(helperCodeSha256=value['helperCodeSha256'],helperPolicySha256=value['helperPolicySha256']))
        value['controllerPolicySha256']=r.sha(control)
        files['prepared-helper-policy-cpu0.json']=files['helper-config.json']=helper
        files['prepared-control-policy-cpu0.json']=files['controller-config.json']=control
        source=r.canonical(dict(schema='search.clone-cpu0-fixed-source-freeze.v2',variant=r.VARIANT,
            preparedOnly=True,files={name:r.sha(files[name]) for name in r.SOURCE_NAMES}))
        files['cpu0-source-freeze.json']=source;value['sourceFreezeSha256']=r.sha(source)
        full=r.canonical(dict(schema='cpu0-full-public-packet.v7',variant=r.VARIANT,
            sourceFreezeSha256=value['sourceFreezeSha256'],files={name:r.sha(raw) for name,raw in files.items()}))
        value['externalManifestSha256']=r.sha(full)
        for name,raw in {**files,'cpu0-external-manifest.json':full,'node':b'node','node-provenance.json':b'{}'}.items():
            path=folder/name;path.write_bytes(raw);path.chmod(0o600)
        return value

    def test_closed_installed_recipe_and_current_runtime_envelope(self):
        real_lstat=Path.lstat;real_fstat=os.fstat
        def root_stat(value):
            names=('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_mode','st_nlink')
            return types.SimpleNamespace(**{key:getattr(value,key) for key in names},st_uid=0)
        with tempfile.TemporaryDirectory() as temp, mock.patch.object(r,'STAGE',Path(temp)), \
             mock.patch.object(r,'directory'),mock.patch.object(r.Path,'lstat',lambda p:root_stat(real_lstat(p))), \
             mock.patch.object(r.os,'fstat',lambda fd:root_stat(real_fstat(fd))):
            folder=Path(temp);value=self.stage_fixture(folder)
            with mock.patch.object(r,'current_node',return_value=value['nodeIdentity']):
                expected=r.sha((folder/'lifecycle_cpu0.py').read_bytes())
                self.assertEqual(r.installed(value,initial=True),expected)
                hostile=folder/'shutil.py';hostile.write_text('raise AssertionError()');hostile.chmod(0o600)
                with self.assertRaisesRegex(RuntimeError,'staged_extra_entry'):r.installed(value,initial=True)
                hostile.unlink()
                for i in range(18):(folder/f'reclaim-writer-{i}.json').write_text('{}')
                self.assertEqual(r.installed(value,initial=False),expected)
                with self.assertRaisesRegex(RuntimeError,'staged_extra_entry'):r.installed(value,initial=True)
                extra=folder/'reclaim-writer-18.json';extra.write_text('{}')
                with self.assertRaisesRegex(RuntimeError,'staged_extra_entry'):r.installed(value,initial=False)
                extra.unlink()
                (folder/'lifecycle_cpu0.py').write_bytes(b'changed')
                with self.assertRaisesRegex(RuntimeError,'staged_source_changed'):r.installed(value,initial=False)

    def test_node_receipt_binds_ctime_after_same_size_mtime_preserved_change(self):
        real_lstat=Path.lstat;real_fstat=os.fstat
        def root_stat(value):
            names=('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_mode','st_nlink')
            return types.SimpleNamespace(**{key:getattr(value,key) for key in names},st_uid=0)
        with tempfile.TemporaryDirectory() as temp,mock.patch.object(r,'STAGE',Path(temp)), \
             mock.patch.object(r,'NODE_BYTES',4),mock.patch.object(r.Path,'lstat',lambda p:root_stat(real_lstat(p))), \
             mock.patch.object(r.os,'fstat',lambda fd:root_stat(real_fstat(fd))):
            node=Path(temp)/'node';node.write_bytes(b'ELF0');node.chmod(0o700);before=real_lstat(node)
            receipt=dict(schema='clone-node-copy-receipt.v2',nodeSha256=r.NODE_SHA,nodeBytes=4,
                sourceReceiptSha256=r.NODE_RECEIPT_SHA,targetDevice=before.st_dev,targetInode=before.st_ino,
                targetMode=0o700,sourceStable=True,sourceHostWrites=0,cloneFilesCreated=2,
                targetMtimeNs=before.st_mtime_ns,targetCtimeNs=before.st_ctime_ns)
            raw=r.canonical(receipt);proof=Path(temp)/'node-provenance.json';proof.write_bytes(raw);proof.chmod(0o600)
            self.assertEqual(r.current_node(r.sha(raw))['ctimeNs'],str(before.st_ctime_ns))
            time.sleep(0.02)  # Cross the real filesystem timestamp tick.
            node.write_bytes(b'ELF1');os.utime(node,ns=(before.st_atime_ns,before.st_mtime_ns))
            self.assertNotEqual(real_lstat(node).st_ctime_ns,before.st_ctime_ns)
            with self.assertRaisesRegex(RuntimeError,'consumer_executable_changed'):r.current_node(r.sha(raw))

    def test_register_composed_closed_preliminary_before_independent_births(self):
        value=fixture();raw=r.canonical(value)+b'\n';events=[]
        handoff=dict(schema='clone-lifecycle-handoff.cpu0.v2',owner='preflight',
            previousSha256=value['consumerPredecessorSha256'],snapshot={},adoptionIntentSha256=value['adoptionIntentSha256'])
        life=types.SimpleNamespace(_AUTHENTICATED_SOURCE_SHA256='a'*64,read_handoff=lambda *a:handoff,
            attest=lambda *a:value['source'],birth_gone=lambda *a:True)
        def opened(pid,flags):events.append(('pidfd',pid));return pid+1000
        def confirmed(*args,**kwargs):
            self.assertEqual(events[:2],[('pidfd',101),('pidfd',102)])
            events.append(('confirmed',101));return value['consumer']['identity']
        with mock.patch.object(r,'acquire_control',return_value=55),mock.patch.object(r.os,'close'), \
             mock.patch.object(r,'read_public',return_value=(raw,None)),mock.patch.object(r,'installed',return_value='a'*64), \
             mock.patch.object(r,'protected',return_value=(value['source'],set())), \
             mock.patch.object(r,'control_identity',return_value=value['sharedControlIdentity']), \
             mock.patch.object(r.os,'pidfd_open',side_effect=opened),mock.patch.object(r.select,'select',return_value=([],[],[])), \
             mock.patch.object(r,'confirm_birth',side_effect=confirmed), \
             mock.patch.object(r,'confirm_process',return_value=value['transportParent']['identity']), \
             mock.patch.object(r.Path,'lstat'),mock.patch.object(r,'signature',return_value=None), \
             mock.patch.object(r,'current_node',return_value=value['nodeIdentity']), \
             mock.patch.object(r,'write_registration',return_value='f'*64) as written:
            result=r.register(life,None,'d'*64,value['consumer']['identity'],value['sourceFreezeSha256'],
                value['externalManifestSha256'],value['consumerPredecessorSha256'],True,
                enrolment_sha=r.sha(raw),enrolment_projection=value,
                preflight_exit_evidence=dict(observed=True,exitCode=0,signal=None,birthGone=True),
                node_receipt_sha=value['nodeProvenanceSha256'])
        self.assertEqual(result['registrationSha256'],'f'*64)
        self.assertTrue(result['registeredBeforeCapture']);r.validated_registration(written.call_args.args[0])
        self.assertEqual(events.count(('confirmed',101)),2)

    def process_fixture(self,group='/session'):
        value=fixture();consumer=value['consumer']['identity']
        def public(pid,parent,group):
            return dict(pid=pid,startTicks=100+pid,parentPid=parent,exeIdentityHash='a'*64,
                groupHash='b'*64,VmLckBytes=0,group=group,exeBasename='node',comm='node')
        rows={101:public(101,102,group),901:public(901,900,'/source'),902:public(902,901,'/source')}
        keys=r.BIRTH_KEYS-{'outsideSourceCgroup'}
        source={role:{key:rows[pid][key] for key in keys} for role,pid in [('wrapper',901),('qdrant',902)]}
        life=types.SimpleNamespace(process=lambda pid,proc:rows[pid],
            public_process=lambda row:{key:row[key] for key in keys},
            bounded=lambda *a:b'node\0consumer\0')
        return life,consumer,source,rows

    def test_actual_source_subtree_refused_even_hash_is_different(self):
        life,birth,source,rows=self.process_fixture('/source/aux')
        with self.assertRaisesRegex(RuntimeError,'consumer_inside_source_subtree'):
            r.confirm_process(life,birth,source)
        rows[101]['group']='/session';source['qdrant']['startTicks']+=1
        with self.assertRaisesRegex(RuntimeError,'consumer_registration_source_changed'):
            r.confirm_process(life,birth,source)

    def test_same_birth_reparenting_only_cleanup_and_exact_argv_exe(self):
        life,birth,source,rows=self.process_fixture();rows[101]['parentPid']=1
        info=types.SimpleNamespace(st_dev=1,st_ino=2,st_size=3)
        with mock.patch.object(r.Path,'stat',return_value=info):
            with self.assertRaisesRegex(RuntimeError,'consumer_birth_changed'):
                r.confirm_birth(life,birth,source,['node','consumer'],node_identity=fixture()['nodeIdentity'])
            actual=r.confirm_birth(life,birth,source,['node','consumer'],allow_reparent=True,node_identity=fixture()['nodeIdentity'])
            self.assertEqual(actual['parentPid'],1)
            life.bounded=lambda *a:b'node\0wrong\0'
            with self.assertRaisesRegex(RuntimeError,'consumer_argv_changed'):
                r.confirm_birth(life,birth,source,['node','consumer'],allow_reparent=True,node_identity=fixture()['nodeIdentity'])

    def test_protected_source_birth_observed_but_never_signalled(self):
        value=fixture();value['consumer']['identity'].update(pid=os.getpid(),startTicks=201)
        life=types.SimpleNamespace(birth=lambda *a:201,birth_gone=lambda *a:False)
        with mock.patch.object(r.os,'pidfd_open',return_value=55) as opened, \
             mock.patch.object(r.os,'close'),mock.patch.object(r.select,'select',return_value=([],[],[])), \
             mock.patch.object(r.signal,'pidfd_send_signal') as send:
            with self.assertRaisesRegex(RuntimeError,'consumer_target_protected'):
                r.cleanup_birth(life,None,value,scope='test')
            opened.assert_called_once();send.assert_not_called()

    def renewal_run(self, value=None, renew_error=None, second_change=None):
        value=fixture() if value is None else value
        first=renewal_fixture(value['source']); second=copy.deepcopy(first)
        if second_change: second_change(second)
        calls=[]
        def renew(*args):
            calls.append('renew')
            if renew_error: raise renew_error
            return copy.deepcopy(first if len(calls)==1 else second)
        controller=types.SimpleNamespace(renew_cleanup=renew)
        life=types.SimpleNamespace(birth=lambda *a:value['consumer']['identity']['startTicks'],
                                  birth_gone=lambda *a:False)
        with mock.patch.object(r.os,'pidfd_open',return_value=55),mock.patch.object(r.os,'close'), \
             mock.patch.object(r.select,'select',return_value=([],[],[])), \
             mock.patch.object(r,'cleanup_context',return_value=({},None,None)), \
             mock.patch.object(r,'current_node',return_value=value['nodeIdentity']), \
             mock.patch.object(r,'confirm_birth',return_value={'parentPid':1}), \
             mock.patch.object(r.signal,'pidfd_send_signal') as send, \
             mock.patch.object(r.os,'kill') as kill, mock.patch.object(r,'acquire_control') as lock:
            try:
                output=r.cleanup_birth(life,None,value,scope='explicit-authentication-seams',controller=controller)
                error=None
            except RuntimeError as caught:
                error=caught;output=caught.consumerCleanupEvidence
            kill.assert_not_called();lock.assert_not_called()
            return output,error,send.call_count,calls

    def test_successor_source_active_socket_and_absolute_events_are_evidence(self):
        value=fixture();first=renewal_fixture(value['source']);historical=copy.deepcopy(value['source'])
        output,error,sends,calls=self.renewal_run(value)
        self.assertIsNone(error);self.assertEqual(sends,1);self.assertEqual(calls,['renew','renew'])
        self.assertEqual(output['sourceBirthRelation'],'successor');self.assertEqual(value['source'],historical)
        self.assertEqual(output['currentSource']['activeServiceConnections'],1)
        self.assertEqual(output['sourceRenewalBefore']['sourceEvents']['oom'],1)
        self.assertFalse(output['handoffRequired']);self.assertTrue(output['unknownRetained'])

    def test_state_event_counter_and_client_growth_do_not_form_clean_gate(self):
        def changes(value):
            value['currentSource']['state']['OOMKilled']=True
            value['currentSource']['activeServiceConnections']=3
            value['sourceEvents']['oom']=2
            value['cpuHierarchy']['rows'][0]['nrThrottled']=4
        output,error,sends,_=self.renewal_run(second_change=changes)
        self.assertIsNone(error);self.assertEqual(sends,1)
        self.assertTrue(output['sourceRenewalAfter']['currentSource']['state']['OOMKilled'])

    def test_current_birth_config_mount_and_cpu_changes_refuse_before_term(self):
        mutations=[lambda v:v['currentSource']['qdrant'].update(startTicks=1234),
            lambda v:v['currentSource']['state'].update(configurationHash='8'*64),
            lambda v:v['currentSource'].update(liveMountIdentityHash='9'*64),
            lambda v:v['cpuHierarchy']['rows'][0].update(groupIdentitySha256='8'*64),
            lambda v:v['sourceLimits'].update(memorySwapMaxBytes=1)]
        for change in mutations:
            with self.subTest(change=change):
                output,error,sends,_=self.renewal_run(second_change=change)
                self.assertIsInstance(error,RuntimeError);self.assertEqual(sends,0)
                self.assertFalse(output['birthGone']);self.assertTrue(output['unknownRetained'])

    def test_stopped_or_extra_holder_refusal_retains_node_facts_without_signal(self):
        for reason in ('lifecycle_clean_receipt_missing','lifecycle_membership_changed'):
            with self.subTest(reason=reason):
                original=RuntimeError(reason)
                output,error,sends,calls=self.renewal_run(renew_error=original)
                self.assertIs(error,original);self.assertEqual(sends,0);self.assertEqual(calls,['renew'])
                self.assertFalse(output['birthGone']);self.assertFalse(output['exitObserved'])
                self.assertEqual(output['sourceBranch'],'uncertain');self.assertIsNone(output['currentSource'])

    def test_already_gone_and_reused_births_do_not_require_running_source(self):
        for ticks in (None,999):
            life=types.SimpleNamespace(birth=lambda *a:ticks,birth_gone=lambda *a:True)
            with mock.patch.object(r.os,'pidfd_open',return_value=55),mock.patch.object(r.os,'close'), \
                 mock.patch.object(r.select,'select',return_value=([],[],[])), \
                 mock.patch.object(r,'cleanup_context') as context, \
                 mock.patch.object(r.signal,'pidfd_send_signal') as send:
                output=r.cleanup_birth(life,None,fixture(),scope='already-gone')
                self.assertTrue(output['birthGone']);self.assertEqual(output['sourceBranch'],'unobserved')
                self.assertFalse(output['unknownRetained']);context.assert_not_called();send.assert_not_called()

    def test_malformed_historical_source_and_hierarchy_are_typed_refusals(self):
        value=fixture();value['source']['wrapper']['pid']=True
        output,error,sends,_=self.renewal_run(value)
        self.assertIsInstance(error,RuntimeError);self.assertEqual(sends,0)
        for change in (lambda v:v['rows'][0].update(nrThrottled=True),
                       lambda v:v['rows'][0].update(quotaMicros=1),
                       lambda v:v['rows'][-1].update(groupIdentitySha256=v['rows'][0]['groupIdentitySha256']),
                       lambda v:v.update(extra=True)):
            hierarchy=renewal_fixture(source_fixture())['cpuHierarchy'];change(hierarchy)
            with self.subTest(change=change),self.assertRaises(RuntimeError):r.hierarchy_evidence(hierarchy)

    def test_loaded_module_marker_drift_refuses_before_loader(self):
        value=fixture();names=('lifecycle_cpu0.py','controller_cpu0.py','pin_cpu0.py',
                              'runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py')
        source={'schema':'search.clone-cpu0-fixed-source-freeze.v2','variant':r.VARIANT,
                'preparedOnly':True,'files':{name:'a'*64 for name in r.SOURCE_NAMES}}
        value['sourceFreezeSha256']=r.sha(r.canonical(source))
        modules={name:types.SimpleNamespace(_AUTHENTICATED_SOURCE_SHA256='a'*64) for name in names}
        controller=modules['controller_cpu0.py']
        for name,attribute in [('pin_cpu0.py','pin'),('runtime_cpu0.py','runtime'),
                               ('daemon_cpu0.py','daemon'),('cpu0_guards.py','cpu0_guards')]:
            setattr(controller,attribute,modules[name])
        controller.daemon.load_config=mock.Mock()
        modules['runtime_cpu0.py']._AUTHENTICATED_SOURCE_SHA256='b'*64
        with mock.patch.object(r,'installed',return_value='a'*64), \
             mock.patch.object(r,'read_public',return_value=(r.canonical(source),None)):
            with self.assertRaisesRegex(RuntimeError,'cleanup_module_freeze_changed'):
                r.cleanup_context(modules['lifecycle_cpu0.py'],controller,value)
        controller.daemon.load_config.assert_not_called()

    def test_late_node_receipt_identity_drift_refuses_term(self):
        value=fixture();evidence=renewal_fixture(value['source'])
        life=types.SimpleNamespace(birth=lambda *a:201,birth_gone=lambda *a:False)
        controller=types.SimpleNamespace(renew_cleanup=lambda *a:copy.deepcopy(evidence))
        with mock.patch.object(r.os,'pidfd_open',return_value=55),mock.patch.object(r.os,'close'), \
             mock.patch.object(r.select,'select',return_value=([],[],[])), \
             mock.patch.object(r,'cleanup_context',return_value=({},None,None)), \
             mock.patch.object(r,'confirm_birth',return_value={'parentPid':1}), \
             mock.patch.object(r,'current_node',return_value={**value['nodeIdentity'],'ctimeNs':'9'}), \
             mock.patch.object(r.signal,'pidfd_send_signal') as send:
            with self.assertRaisesRegex(RuntimeError,'consumer_executable_changed') as caught:
                r.cleanup_birth(life,None,value,scope='late-drift',controller=controller)
            send.assert_not_called();self.assertFalse(caught.exception.consumerCleanupEvidence['birthGone'])

    def test_cleanup_refusal_retains_preflight_census_without_other_primary(self):
        value=fixture();original=RuntimeError('lifecycle_membership_changed')
        original.consumerCleanupEvidence={'birthGone':False,'exitObserved':False,'signalSent':False}
        with mock.patch.object(r.os.path,'lexists',side_effect=lambda p:p==r.ENROLMENT), \
             mock.patch.object(r,'read_public',return_value=(r.canonical(value)+b'\n',None)), \
             mock.patch.object(r,'cleanup_birth',side_effect=original):
            with self.assertRaises(RuntimeError) as caught:
                r.cleanup_from_receipts(types.SimpleNamespace(birth_gone=lambda *a:True),None,
                    expected_source_sha=value['sourceFreezeSha256'],expected_external_sha=value['externalManifestSha256'],
                    expected_node_receipt_sha=value['nodeProvenanceSha256'])
        self.assertIs(caught.exception,original)
        self.assertTrue(original.consumerCleanupEvidence['preflightBirthGone'])
        self.assertTrue(original.consumerCleanupEvidence['unknownRetained'])
        self.assertFalse(original.consumerCleanupEvidence['finalRegistrationObserved'])
        self.assertFalse(original.consumerCleanupEvidence['unknownUnregisteredChildrenAbsentProven'])

    def test_changed_second_freeze_read_cannot_authorize_drifted_module_markers(self):
        # Real installed() consumes the authenticated physical full/source recipe.
        # Only the second freeze read is replaced: the exact review reproduction.
        real_lstat=Path.lstat;real_fstat=os.fstat;real_read=r.read_public
        def root_stat(value):
            names=('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns','st_mode','st_nlink')
            return types.SimpleNamespace(**{key:getattr(value,key) for key in names},st_uid=0)
        with tempfile.TemporaryDirectory() as temp, mock.patch.object(r,'STAGE',Path(temp)), \
             mock.patch.object(r,'directory'),mock.patch.object(r.Path,'lstat',lambda p:root_stat(real_lstat(p))), \
             mock.patch.object(r.os,'fstat',lambda fd:root_stat(real_fstat(fd))):
            folder=Path(temp);value=self.stage_fixture(folder)
            source=r.decoded((folder/'cpu0-source-freeze.json').read_bytes())
            changed=copy.deepcopy(source)
            for name in ('controller_cpu0.py','pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'):
                changed['files'][name]='b'*64
            modules={name:types.SimpleNamespace(_AUTHENTICATED_SOURCE_SHA256=changed['files'][name])
                     for name in changed['files']}
            control=modules['controller_cpu0.py']
            for name,attribute in [('pin_cpu0.py','pin'),('runtime_cpu0.py','runtime'),
                                   ('daemon_cpu0.py','daemon'),('cpu0_guards.py','cpu0_guards')]:
                setattr(control,attribute,modules[name])
            control.daemon.load_config=mock.Mock(return_value=({},None,None))
            reads=[]
            def read(path,*args):
                if path==folder/'cpu0-source-freeze.json':
                    reads.append(path)
                    if len(reads)==2:return r.canonical(changed),None
                return real_read(path,*args)
            with mock.patch.object(r,'current_node',return_value=value['nodeIdentity']), \
                 mock.patch.object(r,'read_public',side_effect=read):
                with self.assertRaisesRegex(RuntimeError,'source_freeze_changed'):
                    r.cleanup_context(modules['lifecycle_cpu0.py'],control,value)
            self.assertEqual(len(reads),2);control.daemon.load_config.assert_not_called()

    def test_birth_read_disappearance_retains_actual_gone_without_source(self):
        life=types.SimpleNamespace(birth=mock.Mock(side_effect=ProcessLookupError()),birth_gone=lambda *a:True)
        with mock.patch.object(r.os,'pidfd_open',return_value=55),mock.patch.object(r.os,'close'), \
             mock.patch.object(r.select,'select',return_value=([],[],[])), \
             mock.patch.object(r,'cleanup_context') as context,mock.patch.object(r.signal,'pidfd_send_signal') as send:
            value=r.cleanup_birth(life,None,fixture(),scope='disappeared')
            self.assertTrue(value['birthGone']);self.assertFalse(value['unknownRetained'])
            context.assert_not_called();send.assert_not_called()

    def test_late_refusal_does_not_label_completed_running_renewal(self):
        value,error,sends,_=self.renewal_run(second_change=lambda v:v['cpuHierarchy']['rows'][0].update(groupIdentitySha256='8'*64))
        self.assertIsInstance(error,RuntimeError);self.assertEqual(sends,0)
        self.assertEqual(value['sourceBranch'],'uncertain')
        self.assertIsNotNone(value['sourceRenewalBefore']);self.assertIsNotNone(value['sourceRenewalAfter'])

    def test_malformed_second_freeze_read_is_closed_typed_refusal(self):
        value=fixture();raw=r.canonical({'files':None});value['sourceFreezeSha256']=r.sha(raw)
        with mock.patch.object(r,'installed',return_value='a'*64), \
             mock.patch.object(r,'read_public',return_value=(raw,None)):
            with self.assertRaisesRegex(RuntimeError,'source_freeze_changed'):
                r.cleanup_context(object(),object(),value)

    def test_nonfinite_json_refused_before_schema(self):
        for raw in (b'{"x":NaN}',b'{"x":Infinity}',b'{"x":-Infinity}'):
            with self.subTest(raw=raw),self.assertRaises(RuntimeError):r.decoded(raw)


if __name__=='__main__':unittest.main()
