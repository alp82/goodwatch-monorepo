from ev import ev; import lib
ev(lib.make([]), 'base', setref='b')
for k in (2, 4, 8):
    ev(lib.make_axes_ridge(k), f'ridge on axes{k} only', ref='b')
    ev(lib.make([f'axes{k}']), f'gbm+axes{k}', ref='b')
    ev(lib.blend(lib.make([]), lib.make_axes_ridge(k), 0.6), f'0.6 gbm + 0.4 axes{k} ridge', ref='b')
