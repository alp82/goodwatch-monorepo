"""Prepared local O_EXCL journal recorder for the reviewed stdin-only window launcher."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

LAUNCHER_SHA='fc52ee8b85c1dae616726bc5b6c6be2ef8c1ea43c61ec5888685b17da9e21490'
LAUNCHER=Path(__file__).with_name('launch_window_v1.py')


def exclusive_journal(path):
    path=Path(path)
    parent=path.parent
    if not path.is_absolute()or parent.resolve()!=parent or '/'in path.name or path.name in('', '.', '..'):
        raise ValueError('journal_scope')
    info=parent.stat()
    if not stat.S_ISDIR(info.st_mode)or info.st_uid!=os.geteuid()or stat.S_IMODE(info.st_mode)!=0o700:
        raise ValueError('journal_scope')
    parent_fd=os.open(parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        opened=os.fstat(parent_fd)
        if (opened.st_dev,opened.st_ino)!=(info.st_dev,info.st_ino):raise ValueError('journal_scope')
        fd=os.open(path.name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent_fd)
    finally:os.close(parent_fd)
    info=os.fstat(fd)
    if info.st_uid!=os.geteuid()or stat.S_IMODE(info.st_mode)!=0o600 or info.st_nlink!=1 or not stat.S_ISREG(info.st_mode):
        os.close(fd);raise ValueError('journal_scope')
    return fd


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute-window',action='store_true');parser.add_argument('--journal');parser.add_argument('--start-utc');parser.add_argument('--end-utc');parser.add_argument('--expected-source-sha256');parser.add_argument('--backup-path-sha256');args=parser.parse_args()
    if not args.execute_window:
        print(json.dumps({'event':'resource-window.recorder-prepared.v1','hostOperations':0,'localFilesCreated':0}));return 0
    source=LAUNCHER.read_bytes()
    if hashlib.sha256(source).hexdigest()!=LAUNCHER_SHA:raise ValueError('launcher_hash')
    argv=['reviewed-window-launcher','--execute-window','--start-utc',args.start_utc,'--end-utc',args.end_utc,'--expected-source-sha256',args.expected_source_sha256,'--backup-path-sha256',args.backup_path_sha256]
    code='import sys;sys.argv='+repr(argv)+';exec(compile('+repr(source)+",'<reviewed-window-launcher>','exec'))"
    fd=exclusive_journal(args.journal)
    try:
        result=subprocess.run(['/usr/bin/python3','-I','-B','-c',code],stdout=fd,stderr=subprocess.DEVNULL)
        os.fsync(fd)
        print(json.dumps({'event':'resource-window.recorder-exit.v1','exitCode':result.returncode,'journalRetained':True,'localFilesCreated':1,'remoteStateRequiresRetainedReceipt':True}));return result.returncode
    finally:os.close(fd)

if __name__=='__main__':sys.exit(main())
