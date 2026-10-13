CONFIGS = {
 'hist': dict(form='hist'),                        # the member's own rating histogram, same for every title
 'thr': dict(form='thr'),                          # round 2: nine one-variable logistic fits on the score
 'po': dict(form='om', use_c=False),               # proportional odds on the score
 'ls': dict(form='om', use_c=True),                # + spread depends on the score
}
SIGNED = ['aud_crit', 'imdb_rest', 'dis', 'logvotes', 'n_missing', 'hype', 'season_decline', 'sequel', 'kind_spectacle', 'kind_sitcom', 'is_show']
SPREAD = ['abs_aud_crit', 'spread', 'abs_imdb_rest', 'abs_dis', 'logvotes', 'n_missing', 'sequel', 'kind_spectacle', 'kind_sitcom', 'is_show', 'hype']
for x in SIGNED:
    CONFIGS[f'L_{x}'] = dict(form='om', L=[x], S=[], T=[], prior='pool', use_c=False)
    CONFIGS[f'T_{x}'] = dict(form='om', L=[], S=[], T=[x], prior='pool', use_c=False)
for x in SPREAD:
    CONFIGS[f'S_{x}'] = dict(form='om', L=[], S=[x], T=[], prior='pool', use_c=False)

for x in ['aud_mean', 'crit_mean', 'mc_user']:
    CONFIGS[f'L_{x}'] = dict(form='om', L=[x], S=[], T=[], prior='pool', use_c=False)
    CONFIGS[f'T_{x}'] = dict(form='om', L=[], S=[], T=[x], prior='pool', use_c=False)
for x in ['crit_over', 'aud_over']:
    CONFIGS[f'T_{x}'] = dict(form='om', L=[], S=[], T=[x], prior='pool', use_c=False)
# no pooling (member's own data only, shrunk to zero) for the inputs with the largest raw gaps
for x in ['sequel', 'hype', 'aud_crit']:
    CONFIGS[f'T0_{x}'] = dict(form='om', L=[], S=[], T=[x], use_c=False)
    CONFIGS[f'L0_{x}'] = dict(form='om', L=[x], S=[], T=[], use_c=False)
# pooled effect only, no personal part
for x in ['sequel', 'hype', 'aud_crit', 'logvotes']:
    CONFIGS[f'LF_{x}'] = dict(form='om', L=[x], S=[], T=[], prior='fixed', use_c=False)
# everything at once (the round-2 mistake, for the record)
ALLS = ['aud_crit', 'imdb_rest', 'dis', 'logvotes', 'n_missing', 'hype', 'season_decline', 'sequel', 'kind_spectacle', 'kind_sitcom']
CONFIGS['all_T'] = dict(form='om', L=[], S=[], T=ALLS, prior='pool', use_c=False)
CONFIGS['all_LST'] = dict(form='om', L=ALLS, S=['abs_aud_crit', 'spread', 'abs_dis', 'logvotes', 'sequel'], T=ALLS, prior='pool', use_c=False)
CONFIGS['all_LST_weak'] = dict(form='om', L=ALLS, S=['abs_aud_crit', 'spread', 'abs_dis', 'logvotes', 'sequel'], T=ALLS, lam=(0.5, 0.5, 0.5), use_c=False)

# shape of the low tail as a function of the score itself (partial proportional odds: thresholds <= 5 get their own slope)
CONFIGS['T_score'] = dict(form='om', L=[], S=[], T=['score'], lam=(5., 5., 0.5), use_c=False)
CONFIGS['T_score_pool'] = dict(form='om', L=[], S=[], T=['score'], lam=(5., 5., 5.), prior='pool', use_c=False)

# positive control: the score is the linear part only; the hidden tree part comes back as an input ('dis' = linear minus trees) and must help
CONFIGS['ctl_lin'] = dict(form='om', use_c=False, src='lin')
CONFIGS['ctl_lin_L_dis'] = dict(form='om', L=['dis'], S=[], T=[], use_c=False, src='lin')
CONFIGS['ctl_lin_T_dis'] = dict(form='om', L=[], S=[], T=['dis'], use_c=False, src='lin')

# POST-HOC (seen in the owner's data after the screen: IMDb 65-70 holds more bad titles than its risk says): points of IMDb score under 7.0
CONFIGS['L_imdb_under70'] = dict(form='om', L=['imdb_under70'], S=[], T=[], prior='pool', use_c=False)
CONFIGS['T_imdb_under70'] = dict(form='om', L=[], S=[], T=['imdb_under70'], prior='pool', use_c=False)
