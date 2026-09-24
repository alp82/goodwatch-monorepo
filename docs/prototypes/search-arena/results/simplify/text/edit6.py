p='harness/simp_text.py'
s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, (s.count(a), a[:70])
    s=s.replace(a,b)
rep('''        if cur is None and w in markers:
            cur = []
            negs.append(cur)''','''        if cur is None and w in markers:
            cur = []
            negs.append(cur)
            if pos and pos[-1].strip(",").lower() in CLAUSE_END:
                pos.pop()   # "tense but not bleak" -> "tense"''')
rep('''        elif k == "avoid":
            neg.append(re.sub(r"^Low\\s+", "", t))
        elif k == "excluded":
            neg.append(re.sub(r"^Not\\s+", "", t))''','''        elif k in ("avoid", "excluded"):
            neg.append(t.removeprefix("Low ").removeprefix("Not "))''')
rep('''    "text-v-cons": variant(spell_mode="osa1", neg_mode="tokens", less="marker", avoid_neg="nonen-avoid",''','''    "text-v-cons": variant(spell_mode="osa1", neg_mode="tokens", less="marker", avoid_neg="nonen",''')
i=s.index('EXPLORE5 = {')
j=s.index('\n}\n', i)+3
s=s[:j]+'''EXPLORE6 = {
    "text-u-neg": variant(neg_mode="tokens"),
    "text-u-neg-marker": variant(neg_mode="tokens", less="marker"),
    "text-u-cons": EXPLORE5["text-v-cons"],
}
'''+s[j:]
open(p,'w').write(s)
