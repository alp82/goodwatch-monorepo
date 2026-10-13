from ev import ev; import lib, stack
ev(lib.make([]), 'base', setref='b')
V = {'ost': ['ost_meanz', 'ost_logn'], 'sig': ['sig_wish', 'sig_skip', 'sig_fav'], 'cf_uu': ['cf_uu_pos'], 'cf_all': ['cf_uu_pos', 'cf_uu_signed', 'cf_ii'],
     'kg': ['kg_any_res', 'kg_hop2_res'], 'kg_all': ['kg_rec_res', 'kg_sim_res', 'kg_in_res', 'kg_any_res', 'kg_hop2_res'],
     'combo': ['ost_meanz', 'ost_logn', 'cf_uu_pos', 'cf_ii', 'kg_any_res', 'kg_hop2_res', 'sig_wish', 'sig_fav']}
for k, w in V.items(): ev(stack.make(w), 'stack ' + k, ref='b')
