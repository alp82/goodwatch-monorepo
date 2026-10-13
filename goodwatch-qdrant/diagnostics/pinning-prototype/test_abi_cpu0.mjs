import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {admission} from './cpu0_consumer_fixture.mjs';import {admissionEvidence} from './compare-contract-cpu0.mjs';
test('consumer accepts actual immutable runtime emitted identity expression, rejects invented fifth field',()=>{
 // Evaluate only the actual producer's Return(Source(...)).identity expression with public scalar inputs.
 // No inspect_source invocation, Docker, proc reads, query, or private input is performed.
 const producer=fileURLToPath(new URL('./runtime_cpu0.py',import.meta.url));
 const result=spawnSync('/usr/bin/python3',['-I','-B','-c',`import ast,json,sys
source=ast.parse(open(sys.argv[1]).read())
function=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='inspect_source')
result=next(n for n in ast.walk(function) if isinstance(n,ast.Return))
assert isinstance(result.value,ast.Call) and result.value.func.id=='Source'
expression=ast.Expression(result.value.args[0])
x={'Id':'c'*64,'Image':'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'}
print(json.dumps(eval(compile(expression,'public-source-expression','eval'),{'__builtins__':{}},{'x':x,'pid':101,'start_ticks':99})))`,producer],{encoding:'utf8'});
 assert.equal(result.status,0);const a=admission();a.sourceIdentity=JSON.parse(result.stdout);assert.equal(a.sourceIdentity.length,4);admissionEvidence(a);
 a.sourceIdentity.push('/invented-group');assert.throws(()=>admissionEvidence(a));
});

test('static consumer reason enum equals actual frozen producer scalar CONTROL_REASONS union',async()=>{
 const {CONTROL_REASONS}=await import('./compare-contract-cpu0.mjs');const folder=fileURLToPath(new URL('.',import.meta.url));
 const result=spawnSync('/usr/bin/python3',['-I','-B','-c',`from pathlib import Path
import ast,json,sys
base=Path(sys.argv[1])
def literal(node,env):
 if isinstance(node,ast.Constant) and isinstance(node.value,str):return node.value
 if isinstance(node,(ast.Tuple,ast.List,ast.Set)):return tuple(literal(n,env) for n in node.elts)
 if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='frozenset' and len(node.args)==1 and not node.keywords:return frozenset(literal(node.args[0],env))
 if isinstance(node,ast.BinOp) and isinstance(node.op,ast.BitOr):return literal(node.left,env)|literal(node.right,env)
 if isinstance(node,ast.Attribute) and isinstance(node.value,ast.Name):return env[(node.value.id,node.attr)]
 raise ValueError('non-scalar expression')
def named(name,file):
 tree=ast.parse((base/file).read_text());return literal(next(n.value for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets)),{})
env={('pin','SAFE_REASONS'):named('SAFE_REASONS','pin_cpu0.py'),('cpu0_guards','REASONS'):named('REASONS','cpu0_guards.py')};reasons=set()
for node in ast.parse((base/'controller_cpu0.py').read_text()).body:
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CONTROL_REASONS' for t in node.targets):reasons=set(literal(node.value,env))
 if isinstance(node,ast.AugAssign) and isinstance(node.target,ast.Name) and node.target.id=='CONTROL_REASONS':reasons|=literal(node.value,env)
print(json.dumps(sorted(reasons)))`,folder],{encoding:'utf8'});assert.equal(result.status,0);assert.deepEqual([...CONTROL_REASONS].sort(),JSON.parse(result.stdout));
});
