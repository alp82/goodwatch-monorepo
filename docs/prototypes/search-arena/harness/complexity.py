"""Mechanical complexity counts for a ranker: only the harness code that actually runs when it ranks queries.

Usage:
  .venv/bin/python harness/complexity.py                       # r6 (run6.FINAL["r6"], defaults rankers6.DEFAULTS6)
  .venv/bin/python harness/complexity.py --module run7 --name r7 --defaults rankers7.DEFAULTS7
  options: --splits dev,holdout,holdout2,holdout3,holdout4   --json out.json   --verbose (list every item)

Contract for a candidate: `<module>.FINAL[name] = (kw, bk)` and `<module>.run(kw, bk, ctxs)` ranks the contexts.

Method. The query contexts are loaded first (catalog, captures, production hard filters), then `run()` is traced with
sys.monitoring (LINE and PY_START events, each location reported once). Lazy offline indexes built inside the run
(BM25 index, spell vocabulary, person / studio / peer / cut indexes) count, because the ranker needs them. The data
layer (catalog.py, context.py, qemb.py) is reported separately and not counted.

Counts (all over harness files except the data layer):
- loc_functions: non-comment, non-blank, non-docstring lines of every function entered at least once (dead branches
  inside live functions included), plus the module-level definitions the executed code references (transitively).
- loc_executed: the same, but only statements that executed (compound statements count their header lines).
- regexes: module-level re.compile sites referenced by executed code, plus inline re.<fn>(...) call sites that
  executed. `distinct_patterns` dedups by pattern text.
- config: keys of the merged config (defaults + FINAL overrides + blend kwargs); a key is read when an executed
  statement subscripts / .get()s it on a config-like dict (cfg, tr, b, bk, sub_cfg) or reads a same-named parameter.
- constants: module-level names referenced by executed code, split into numeric knobs (numeric leaves counted),
  word lists (collections of >= 3 strings) and other.
- literals: numeric literals in executed statements that can act as tunables. Excluded: 0, 1, -1, |x| < 1e-3,
  plain subscripts (x[0], x[-1], m.group(1)), and anything inside debug.update(...) / round(...). Candidates for the
  hand review in results/simplify/baseline-complexity.md, not a verdict.

proxy_score = config keys read + numeric constant leaves + literal candidates + regex sites + word lists. It needs no
hand review, so it is only a trend check; the official simplicity score is defined and hand-counted in
results/simplify/baseline-complexity.md.

Coverage caveat: a branch the query set never takes is not "executed" even when config enables it. loc_executed is a
lower bound on live code; loc_functions an upper bound.
"""
import argparse, ast, importlib, io, json, os, re, sys, tokenize
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

SELF = os.path.basename(__file__)
DATA_LAYER = {"catalog.py", "context.py", "qemb.py"}
CFG_NAMES = {"cfg", "tr", "b", "bk", "sub_cfg"}
RE_FNS = {"compile", "sub", "subn", "search", "match", "fullmatch", "findall", "finditer", "split"}
CONFIG_DICT = re.compile(r"^(?:DEFAULTS?\d*|LEADER)$")  # module-level config defaults (counted as config keys)


# --- tracing --------------------------------------------------------------------------------------

def trace_run(fn):
    mon = sys.monitoring
    tool = mon.COVERAGE_ID
    mon.use_tool_id(tool, "complexity")
    lines, starts = set(), set()

    def on_line(code, line):
        if code.co_filename.startswith(HERE) and not code.co_filename.endswith(SELF):
            lines.add((os.path.basename(code.co_filename), line))
        return mon.DISABLE

    def on_start(code, offset):
        if code.co_filename.startswith(HERE) and not code.co_filename.endswith(SELF):
            starts.add((os.path.basename(code.co_filename), code.co_firstlineno, code.co_qualname))
        return mon.DISABLE

    mon.register_callback(tool, mon.events.LINE, on_line)
    mon.register_callback(tool, mon.events.PY_START, on_start)
    mon.set_events(tool, mon.events.LINE | mon.events.PY_START)
    try:
        out = fn()
    finally:
        mon.set_events(tool, 0)
        mon.free_tool_id(tool)
    return out, lines, starts


# --- source analysis ------------------------------------------------------------------------------

class Src:
    def __init__(self, name):
        self.name = name
        self.text = open(os.path.join(HERE, name), encoding="utf-8").read()
        self.tree = ast.parse(self.text)
        self.code_lines = self._code_lines()
        self.parent = {}
        for node in ast.walk(self.tree):
            for ch in ast.iter_child_nodes(node):
                self.parent[ch] = node
        self.funcs = {n.lineno: n for n in ast.walk(self.tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda))}
        self.module_defs = {}
        for st in self.tree.body:
            for t in _targets(st):
                self.module_defs.setdefault(t, []).append(st)

    def _code_lines(self):
        doc = set()
        for node in ast.walk(self.tree):
            if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body:
                s = node.body[0]
                if isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and isinstance(s.value.value, str):
                    doc.update(range(s.lineno, s.end_lineno + 1))
        code = set()
        for tok in tokenize.generate_tokens(io.StringIO(self.text).readline):
            if tok.type in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT,
                            tokenize.ENDMARKER):
                continue
            for ln in range(tok.start[0], tok.end[0] + 1):
                if ln not in doc:
                    code.add(ln)
        return code

    def ncnb(self, lo, hi):
        return {ln for ln in range(lo, hi + 1) if ln in self.code_lines}

    def statements(self):
        for node in ast.walk(self.tree):
            if isinstance(node, ast.stmt):
                yield node


def _targets(st):
    if isinstance(st, ast.Assign):
        out = []
        for t in st.targets:
            out += [t.id] if isinstance(t, ast.Name) else [e.id for e in getattr(t, "elts", []) if isinstance(e, ast.Name)]
        return out
    if isinstance(st, (ast.AnnAssign, ast.AugAssign)) and isinstance(st.target, ast.Name):
        return [st.target.id]
    if isinstance(st, (ast.FunctionDef, ast.ClassDef)):
        return [st.name]
    return []


def header_range(st):
    """Lines of a statement that belong to it alone (compound statements: the header)."""
    body = getattr(st, "body", None)
    if isinstance(st, (ast.If, ast.For, ast.While, ast.With, ast.Try, ast.FunctionDef, ast.ClassDef)) and body:
        return st.lineno, body[0].lineno - 1 if body[0].lineno > st.lineno else st.lineno
    return st.lineno, st.end_lineno


def header_nodes(st):
    """AST parts of a statement evaluated in its own line range (not the nested body)."""
    if isinstance(st, (ast.If, ast.While)):
        return [st.test]
    if isinstance(st, ast.For):
        return [st.target, st.iter]
    if isinstance(st, ast.With):
        return list(st.items)
    if isinstance(st, (ast.FunctionDef, ast.ClassDef, ast.Try)):
        return []
    return [st]


def walk_no_nested(nodes):
    for n in nodes:
        yield from ast.walk(n)


# --- main -----------------------------------------------------------------------------------------

def analyse(module, name, defaults, splits, verbose=False):
    import run5
    ctxs = run5.contexts(tuple(splits))
    mod = importlib.import_module(module)
    kw, bk = mod.FINAL[name]
    dflt = {}
    if defaults:
        m, attr = defaults.rsplit(".", 1)
        dflt = dict(getattr(importlib.import_module(m), attr))
    _, lines, starts = trace_run(lambda: mod.run(kw, bk, ctxs))

    files = sorted({f for f, _ in lines} | {f for f, _, _ in starts})
    srcs = {f: Src(f) for f in files}
    # module aliases in each file: alias -> file name
    aliases = {}
    for f, s in srcs.items():
        al = {}
        for st in s.tree.body:
            if isinstance(st, ast.Import):
                for a in st.names:
                    if os.path.exists(os.path.join(HERE, a.name + ".py")):
                        al[a.asname or a.name] = a.name + ".py"
            elif isinstance(st, ast.ImportFrom) and st.module and os.path.exists(os.path.join(HERE, st.module + ".py")):
                for a in st.names:
                    al[("from", a.asname or a.name)] = (st.module + ".py", a.name)
        aliases[f] = al

    exec_lines = defaultdict(set)
    for f, ln in lines:
        exec_lines[f].add(ln)

    # executed statements
    executed = defaultdict(list)
    for f, s in srcs.items():
        for st in s.statements():
            lo, hi = header_range(st)
            if any(ln in exec_lines[f] for ln in range(lo, hi + 1)):
                executed[f].append(st)

    # function-level lines
    fn_lines = defaultdict(set)
    entered = []
    for f, first, qual in starts:
        node = srcs[f].funcs.get(first)
        if node is None or isinstance(node, ast.Lambda):
            continue
        entered.append((f, first, qual))
        fn_lines[f] |= srcs[f].ncnb(node.lineno, node.end_lineno)
    ex_lines = defaultdict(set)
    for f, sts in executed.items():
        for st in sts:
            lo, hi = header_range(st)
            ex_lines[f] |= srcs[f].ncnb(lo, hi)
    for f, first, qual in entered:  # the signature of an entered function ran
        node = srcs[f].funcs[first]
        ex_lines[f] |= srcs[f].ncnb(node.lineno, max(node.lineno, node.body[0].lineno - 1))
    for f in fn_lines:  # bare `else:` / `try:` / `finally:` lines ran when the next code line ran
        src_lines = srcs[f].text.splitlines()
        for ln in sorted(fn_lines[f] - ex_lines[f]):
            if src_lines[ln - 1].strip() in ("else:", "try:", "finally:"):
                nxt = min((x for x in srcs[f].code_lines if x > ln), default=None)
                if nxt in ex_lines[f]:
                    ex_lines[f].add(ln)

    # module-level references (transitive)
    def refs_in(f, nodes):
        out = set()
        for n in walk_no_nested(nodes):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                if n.id in srcs[f].module_defs:
                    out.add((f, n.id))
                elif ("from", n.id) in aliases[f]:
                    tf, tn = aliases[f][("from", n.id)]
                    out.add((tf, tn))
            elif isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id in aliases[f]:
                out.add((aliases[f][n.value.id], n.attr))
        return out

    todo = set()
    for f, sts in executed.items():
        for st in sts:
            todo |= refs_in(f, header_nodes(st))
    for f, first, qual in entered:  # module constants used as default arguments (k1=K1)
        node = srcs[f].funcs[first]
        todo |= refs_in(f, [d for d in node.args.defaults + node.args.kw_defaults if d is not None])
    seen = set()
    while todo:
        f, nm = todo.pop()
        if (f, nm) in seen:
            continue
        seen.add((f, nm))
        if f not in srcs:
            if not os.path.exists(os.path.join(HERE, f)):
                continue
            srcs[f] = Src(f)
            aliases[f] = {}
        for st in srcs[f].module_defs.get(nm, []):
            if isinstance(st, ast.FunctionDef):
                continue  # functions count when entered
            todo |= refs_in(f, [st])
    mod_lines = defaultdict(set)
    constants, done_st = [], set()
    for f, nm in sorted(seen):
        for st in srcs[f].module_defs.get(nm, []):
            if isinstance(st, ast.FunctionDef) or (f, st.lineno) in done_st:
                continue
            done_st.add((f, st.lineno))
            mod_lines[f] |= srcs[f].ncnb(st.lineno, st.end_lineno)
            constants.append((f, ", ".join(_targets(st)) or nm, st))

    # regexes
    regex_sites = []
    for f, nm, st in constants:
        for n in ast.walk(st):
            if _is_re_call(n):
                regex_sites.append(dict(file=f, line=n.lineno, name=nm, kind="compiled", pattern=_pattern(n)))
    for f, sts in executed.items():
        for st in sts:
            for n in walk_no_nested(header_nodes(st)):
                if _is_re_call(n):
                    regex_sites.append(dict(file=f, line=n.lineno, name=None, kind="inline", pattern=_pattern(n)))
    regex_sites = [dict(t) for t in {tuple(sorted(r.items())) for r in regex_sites}]
    regex_sites.sort(key=lambda r: (r["file"], r["line"]))

    # constants: numeric knobs, word lists, other
    knobs, wordlists, other = [], [], []
    for f, nm, st in constants:
        if isinstance(st, ast.ClassDef):
            other.append((f, nm, "class"))
            continue
        if CONFIG_DICT.match(nm):
            other.append((f, nm, "config defaults"))
            continue
        value = st.value if hasattr(st, "value") else None
        strs = [n for n in ast.walk(st) if isinstance(n, ast.Constant) and isinstance(n.value, str)]
        nums = [n for n in ast.walk(st) if isinstance(n, ast.Constant) and isinstance(n.value, (int, float))
                and not isinstance(n.value, bool)]
        if any(_is_re_call(n) for n in ast.walk(st)):
            other.append((f, nm, "regex"))
        elif _is_wordlist(value, strs):
            wordlists.append((f, nm, _wordlist_size(value, strs)))
        elif nums and not strs or (nums and isinstance(value, ast.Dict)):
            knobs.append((f, nm, len(nums)))
        else:
            other.append((f, nm, type(value).__name__ if value is not None else "?"))

    # config keys
    universe = dict(dflt)
    universe.update(kw)
    blend_keys = dict(bk)
    read = set()
    reads_at = defaultdict(set)
    for f, sts in executed.items():
        for st in sts:
            for n in walk_no_nested(header_nodes(st)):
                k = None
                if isinstance(n, ast.Subscript) and isinstance(n.value, ast.Name) and n.value.id in CFG_NAMES and \
                        isinstance(n.slice, ast.Constant) and isinstance(n.slice.value, str) and isinstance(n.ctx, ast.Load):
                    k = n.slice.value
                elif isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "get" and \
                        isinstance(n.func.value, ast.Name) and n.func.value.id in CFG_NAMES and n.args and \
                        isinstance(n.args[0], ast.Constant) and isinstance(n.args[0].value, str):
                    k = n.args[0].value
                if k:
                    read.add(k)
                    reads_at[k].add(f"{f}:{n.lineno}")
    # blend kwargs: parameters of an entered function named like a blend key and read there
    for f, first, qual in entered:
        node = srcs[f].funcs[first]
        params = {a.arg for a in node.args.args + node.args.kwonlyargs}
        for p in params & set(blend_keys):
            for st in executed[f]:
                if node.lineno <= st.lineno <= node.end_lineno:
                    if any(isinstance(n, ast.Name) and n.id == p and isinstance(n.ctx, ast.Load)
                           for n in walk_no_nested(header_nodes(st))):
                        read.add(p)
                        reads_at[p].add(f"{f}:{st.lineno}")
                        break
    trunc = universe.get("trunc") or {}
    cfg_rows = []
    for k, v in sorted(universe.items()):
        cfg_rows.append(dict(key=k, value=v, source="final" if k in kw else "default", read=k in read,
                             at=sorted(reads_at.get(k, ()))))
    for k, v in sorted(trunc.items()):
        cfg_rows.append(dict(key=f"trunc.{k}", value=v, source="final", read=k in read, at=sorted(reads_at.get(k, ()))))
    for k, v in sorted(blend_keys.items()):
        cfg_rows.append(dict(key=f"blend.{k}", value=v, source="final", read=k in read, at=sorted(reads_at.get(k, ()))))

    # numeric literals in executed statements
    literals = []
    for f, sts in executed.items():
        for st in sts:
            for top_ in header_nodes(st):
                for n in _literal_nodes(top_, srcs[f].parent):
                    literals.append(dict(file=f, line=n.lineno, value=n.value))
    literals = [dict(t) for t in {tuple(sorted(x.items())) for x in literals}]
    literals.sort(key=lambda x: (x["file"], x["line"], str(x["value"])))
    # default-argument literals of entered functions
    defaults_lit = []
    for f, first, qual in entered:
        node = srcs[f].funcs[first]
        args = node.args.args[len(node.args.args) - len(node.args.defaults):]
        for a, d in list(zip(args, node.args.defaults)) + list(zip(node.args.kwonlyargs, node.args.kw_defaults)):
            if isinstance(d, ast.Constant) and isinstance(d.value, (int, float)) and not isinstance(d.value, bool) \
                    and d.value not in (0, 1, -1):
                defaults_lit.append(dict(file=f, line=node.lineno, func=qual, arg=a.arg, value=d.value))

    missed = {f: sorted(fn_lines[f] - ex_lines[f]) for f in fn_lines if f not in DATA_LAYER and fn_lines[f] - ex_lines[f]}
    counted = [f for f in srcs if f not in DATA_LAYER]
    per_file = {}
    for f in sorted(set(fn_lines) | set(mod_lines) | set(ex_lines)):
        per_file[f] = dict(functions=len(fn_lines[f] | mod_lines[f]), executed=len(ex_lines[f] | mod_lines[f]),
                           module_defs=len(mod_lines[f]), data_layer=f in DATA_LAYER)
    loc_fn = sum(v["functions"] for f, v in per_file.items() if f in counted)
    loc_ex = sum(v["executed"] for f, v in per_file.items() if f in counted)
    counted_regex = [r for r in regex_sites if r["file"] not in DATA_LAYER]
    counted_lit = [x for x in literals if x["file"] not in DATA_LAYER]
    out = dict(
        ranker=f"{module}.FINAL[{name!r}]", splits=list(splits), queries=len(ctxs),
        loc_functions=loc_fn, loc_executed=loc_ex, per_file=per_file,
        functions_entered=sorted(f"{f}:{q}" for f, _, q in entered),
        regexes=len(counted_regex), distinct_patterns=len({r["pattern"] for r in counted_regex}), regex_sites=counted_regex,
        config_total=len(cfg_rows), config_read=sum(r["read"] for r in cfg_rows), config=cfg_rows,
        numeric_constants=[dict(file=f, name=n, leaves=k) for f, n, k in knobs if f not in DATA_LAYER],
        numeric_constant_leaves=sum(k for f, n, k in knobs if f not in DATA_LAYER),
        wordlists=[dict(file=f, name=n, size=k) for f, n, k in wordlists if f not in DATA_LAYER],
        literals=len(counted_lit), literal_sites=counted_lit,
        default_arg_literals=[d for d in defaults_lit if d["file"] not in DATA_LAYER],
        missed_lines=missed,
    )
    # Mechanical proxy: no hand review, same bias for every candidate. The official score is the hand-reviewed one.
    out["proxy_score"] = (out["config_read"] + out["numeric_constant_leaves"] + out["literals"] + out["regexes"]
                          + len(out["wordlists"]))
    return out


def _is_re_call(n):
    return isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and isinstance(n.func.value, ast.Name) and \
        n.func.value.id == "re" and n.func.attr in RE_FNS


def _pattern(n):
    a = n.args[0] if n.args else None
    try:
        return ast.unparse(a)[:90] if a is not None else "?"
    except Exception:
        return "?"


def _is_wordlist(value, strs):
    if value is None:
        return False
    if isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id == "set":
        return bool(strs)  # set("a b c".split())
    if isinstance(value, (ast.Set, ast.List, ast.Tuple, ast.Dict)):
        return len(strs) >= 3
    if isinstance(value, ast.DictComp) or isinstance(value, ast.Call):
        return len(strs) >= 3
    return False


def _wordlist_size(value, strs):
    n = 0
    for s in strs:
        n += len(s.value.split()) if " " in s.value and len(s.value) > 40 else 1
    return n


def _literal_nodes(root, parent):
    for n in ast.walk(root):
        if not (isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool)):
            continue
        v = n.value
        if v in (0, 1, -1) or (v != 0 and abs(v) < 1e-3):
            continue
        p = parent.get(n)
        if isinstance(p, ast.UnaryOp):
            p = parent.get(p)
        if isinstance(p, ast.Subscript) and p.slice is n or isinstance(p, ast.Slice):
            continue
        if isinstance(p, ast.Call) and isinstance(p.func, ast.Attribute) and p.func.attr == "group":
            continue
        skip, q = False, n
        while q in parent:
            q = parent[q]
            if isinstance(q, ast.Call) and (
                    (isinstance(q.func, ast.Attribute) and q.func.attr == "update" and isinstance(q.func.value, ast.Name)
                     and q.func.value.id == "debug") or (isinstance(q.func, ast.Name) and q.func.id == "round")):
                skip = True
                break
            if isinstance(q, ast.stmt):
                break
        if not skip:
            yield n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--module", default="run6")
    ap.add_argument("--name", default="r6")
    ap.add_argument("--defaults", default=None)
    ap.add_argument("--splits", default="dev,holdout,holdout2,holdout3,holdout4")
    ap.add_argument("--json")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    defaults = a.defaults or ("rankers6.DEFAULTS6" if a.module == "run6" else None)
    r = analyse(a.module, a.name, defaults, a.splits.split(","), a.verbose)
    if a.json:
        json.dump(r, open(a.json, "w"), indent=1, default=str)
    print(f"{r['ranker']} over {r['queries']} queries ({', '.join(r['splits'])})")
    print(f"LOC (non-comment, non-blank, no docstrings; data layer excluded): functions entered {r['loc_functions']}, "
          f"executed statements {r['loc_executed']}")
    for f, v in r["per_file"].items():
        print(f"  {f:18s} functions {v['functions']:4d}  executed {v['executed']:4d}  module defs {v['module_defs']:3d}"
              + ("  (data layer, not counted)" if v["data_layer"] else ""))
    print(f"regexes: {r['regexes']} sites, {r['distinct_patterns']} distinct patterns")
    print(f"config keys: {r['config_read']} read of {r['config_total']}")
    print(f"numeric module constants: {len(r['numeric_constants'])} names, {r['numeric_constant_leaves']} numeric leaves")
    print(f"word lists: {len(r['wordlists'])} ({sum(w['size'] for w in r['wordlists'])} entries)")
    print(f"numeric literals in executed statements (candidates): {r['literals']}; "
          f"default-argument literals of entered functions: {len(r['default_arg_literals'])}")
    print(f"proxy score (config read + constant leaves + literals + regex sites + word lists): {r['proxy_score']}")
    if a.verbose:
        print("\nregex sites:")
        for x in r["regex_sites"]:
            print(f"  {x['file']}:{x['line']} {x['kind']} {x['name'] or ''} {x['pattern']}")
        print("\nconfig:")
        for x in r["config"]:
            print(f"  {'READ' if x['read'] else 'unread':6s} {x['key']:18s} = {x['value']!s:24s} {x['source']:7s} {' '.join(x['at'][:4])}")
        print("\nnumeric constants:", ", ".join(f"{x['file']}:{x['name']}({x['leaves']})" for x in r["numeric_constants"]))
        print("word lists:", ", ".join(f"{x['file']}:{x['name']}({x['size']})" for x in r["wordlists"]))
        print("\nliterals:")
        for x in r["literal_sites"]:
            print(f"  {x['file']}:{x['line']} {x['value']}")
        print("\ndefault-arg literals:")
        for x in r["default_arg_literals"]:
            print(f"  {x['file']}:{x['line']} {x['func']}({x['arg']}={x['value']})")
        print("\nfunctions entered:", ", ".join(r["functions_entered"]))
        print("\nlines of entered functions that never ran (config-dead or not exercised by the query set):")
        for f, ls in r["missed_lines"].items():
            print(f"  {f}: {_ranges(ls)}")


def _ranges(ls):
    out, start, prev = [], None, None
    for x in ls:
        if start is None:
            start = prev = x
        elif x == prev + 1:
            prev = x
        else:
            out.append(f"{start}-{prev}" if prev > start else str(start))
            start = prev = x
    if start is not None:
        out.append(f"{start}-{prev}" if prev > start else str(start))
    return ", ".join(out)


if __name__ == "__main__":
    main()
