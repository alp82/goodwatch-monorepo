from exp4 import *
if __name__ == '__main__':
    for seed in (0, 1):
        print('seed', seed)
        evaluate(lambda u, a, b, c, d: d['pte'], 'gbm', seed=seed)
        for comps in [['facts'], ['en', 'tagsvd'], ['facts', 'en', 'tagsvd'], ['facts', ('en', 'tagsvd')], ['facts', ('en', 'multi', 'tagsvd', 'alltags')]]:
            f = stack(comps); evaluate(f, f'stack {comps}', seed=seed)
