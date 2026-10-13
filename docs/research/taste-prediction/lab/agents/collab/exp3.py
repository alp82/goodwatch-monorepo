from ev import ev; import lib, stack
ev(lib.make([]), 'base', setref='b')
V = {'ost': ['ost_meanz', 'ost_logn'], 'ostz': ['ost_meanz'], 'cf_uu': ['cf_uu_pos'], 'ost+uu': ['ost_meanz', 'cf_uu_pos'],
     'kg': ['kg_any_res', 'kg_hop2_res'], 'kg_in': ['kg_in_res'],
     'combo': ['ost_meanz', 'cf_uu_pos', 'cf_ii', 'kg_any_res', 'kg_in_res', 'sig_wish', 'sig_fav']}
for al in (100, 400):
    for k, w in V.items(): ev(stack.make(w, alpha=al), f'stack {k} a{al}', ref='b')
