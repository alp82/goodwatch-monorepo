import types
import unittest
from unittest import mock
import registration


class RegistrationTests(unittest.TestCase):
    def fixture(self,group='/reader',source_group='/source'):
        keys=('pid','startTicks','parentPid','exeIdentityHash','groupHash','VmLckBytes')
        public=dict(zip(keys,(991,123,88,'e'*64,'r'*64,0)))
        source_public=dict(zip(keys,(992,124,89,'f'*64,'s'*64,0)))
        own={**public,'exeBasename':'node','comm':'node','group':group}
        source={**source_public,'group':source_group}
        life=types.SimpleNamespace(process=lambda pid,proc:own if pid==991 else source,
             public_process=lambda value:{k:value[k] for k in keys},bounded=lambda *args:b'node\0consumer\0')
        return life,{**public,'outsideSourceCgroup':True},{'qdrant':source_public,'wrapper':{'groupHash':'w'*64}}

    def test_source_subtree_refused_even_with_different_hash(self):
        life,birth,source=self.fixture('/source/aux')
        with self.assertRaisesRegex(RuntimeError,'consumer_inside_source_subtree'):
            registration.confirm_birth(life,birth,source,['node','consumer'])

    def test_source_birth_changed_before_executable_read(self):
        life,birth,source=self.fixture();source['qdrant']['startTicks']=999
        with self.assertRaisesRegex(RuntimeError,'consumer_registration_source_changed'):
            registration.confirm_birth(life,birth,source,['node','consumer'])

    def test_exact_argv_required_after_executable_match(self):
        life,birth,source=self.fixture()
        node=types.SimpleNamespace(st_mode=0o100700,st_uid=0,st_nlink=1,st_size=registration.NODE_BYTES,st_dev=1,st_ino=2)
        life.bounded=lambda *args:b'node\0different\0'
        with mock.patch.object(registration.Path,'lstat',return_value=node),mock.patch.object(registration.Path,'stat',return_value=node):
            with self.assertRaisesRegex(RuntimeError,'consumer_argv_changed'):
                registration.confirm_birth(life,birth,source,['node','consumer'])

    def test_readable_pidfd_does_not_claim_zombie_birth_absent(self):
        life=types.SimpleNamespace(birth=lambda pid:123,birth_gone=lambda pid,ticks:False)
        record={'schema':'cpu0-consumer-registration.v6','consumerBirth':{'pid':991,'startTicks':123}}
        raw=registration.canonical(record)
        with mock.patch.object(registration,'read_owned',return_value=(raw,None)),mock.patch.object(registration,'protected',return_value=({},set())),mock.patch.object(registration.os,'pidfd_open',return_value=55),mock.patch.object(registration.os,'close'),mock.patch.object(registration.select,'select',return_value=([55],[],[])),mock.patch.object(registration.signal,'pidfd_send_signal') as send:
            result=registration.cleanup(life,None,registration.sha(raw))
        self.assertTrue(result['exitObserved']);self.assertFalse(result['birthGone']);send.assert_not_called()

    def test_reused_pid_never_signalled(self):
        life=types.SimpleNamespace(birth=lambda pid:999,birth_gone=lambda pid,ticks:True)
        raw=registration.canonical({'schema':'cpu0-consumer-registration.v6','consumerBirth':{'pid':991,'startTicks':123}})
        with mock.patch.object(registration,'read_owned',return_value=(raw,None)),mock.patch.object(registration,'protected',return_value=({},set())),mock.patch.object(registration.os,'pidfd_open',return_value=55),mock.patch.object(registration.os,'close'),mock.patch.object(registration.signal,'pidfd_send_signal') as send:
            result=registration.cleanup(life,None,registration.sha(raw))
        self.assertTrue(result['birthGone']);send.assert_not_called()


if __name__=='__main__':unittest.main()
