p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''    if cfg["neg_mode"] == "tokens":
        return split_negation_tokens(text, NEG_WORDS | {"less", "fewer"} if less else NEG_WORDS)''','''    if cfg["neg_mode"] == "tokens":
        less = less or cfg["less"] == "global"
        return split_negation_tokens(text, NEG_WORDS | {"less", "fewer"} if less else NEG_WORDS)''')
i=s.index('EXPLORE7 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''EXPLORE8 = {
    "text-s-nocol": Variant({**CONS, "collocations": False}),
    "text-s-nogate": Variant({**CONS, "cov_max_tokens": None}),
    "text-s-lessglobal": Variant({**CONS, "less": "global"}),
    "text-s-avoidnone": Variant({**CONS, "avoid_neg": "none"}),
    "text-s-all4": Variant({**CONS, "collocations": False, "cov_max_tokens": None, "less": "global",
                            "avoid_neg": "none"}),
}
'''+s[j:]
open(p,'w').write(s)
