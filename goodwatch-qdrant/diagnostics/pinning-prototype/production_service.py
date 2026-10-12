"""Prepared durable wrapper. Default opens no journal and performs no inspection."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import argparse
import contextlib
import hashlib
import json
import production
from production_journal import Journal


def service_hash():
    digest = hashlib.sha256()
    for name in ('production_service.py','production_journal.py'):
        digest.update(name.encode()+b'\0'+(Path(__file__).parent/name).read_bytes()+b'\0')
    return digest.hexdigest()


def main(argv=None):
    class Parser(argparse.ArgumentParser):
        def error(self,message): raise ValueError('invalid_cli')
    parser = Parser(description=__doc__)
    parser.add_argument('--execute-reviewed',action='store_true'); parser.add_argument('--config')
    parser.add_argument('--code-sha256'); parser.add_argument('--policy-sha256'); parser.add_argument('--service-sha256')
    parser.add_argument('--journal'); parser.add_argument('--raise-own-memlock',action='store_true'); parser.add_argument('--raise-own-nofile',action='store_true')
    journal = None
    try:
        args = parser.parse_args(argv)
        if not args.execute_reviewed:
            print(json.dumps({'event':'qdrant.pin-service.prepared.v1','execution':False})); return 0
        if args.service_sha256 != service_hash() or args.code_sha256 != production.code_hash(): raise ValueError('service_source_changed')
        production.load_policy(args.config,args.policy_sha256)
        journal = Journal(args.journal,args.code_sha256,args.policy_sha256,args.service_sha256)
        forwarded = ['--execute-reviewed','--config',args.config,'--policy-sha256',args.policy_sha256,'--code-sha256',args.code_sha256]
        if args.raise_own_memlock: forwarded.append('--raise-own-memlock')
        if args.raise_own_nofile: forwarded.append('--raise-own-nofile')
        with contextlib.redirect_stdout(journal): result = production.main(forwarded)
        return result
    except BaseException:
        if journal is not None:
            try: journal.append('helper.collector-problem',{'reason':'service_or_frame_failed'})
            except BaseException: pass
        # No raw exception, private arguments, paths or source data.
        sys.stderr.write('Helper service failed; coverage incomplete.\n'); return 1
    finally:
        if journal is not None:
            try: journal.close()
            except BaseException:
                sys.stderr.write('Helper journal close failed; coverage incomplete.\n'); return 1


if __name__ == '__main__': raise SystemExit(main())
