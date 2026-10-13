from lib import *
import shape, warnings; warnings.filterwarnings('ignore')
from sklearn.linear_model import LogisticRegression
D = Data(); X = features(D); idx, y = D.of(D.owner)
cols = ['everyone', 'imdb', 'metacritic', 'rt_critics', 'rt_audience', 'tmdb', 'year']
genres = sorted({g for x in D.info for g in (x['genres'] or [])})
names = list(D.fp_keys) + cols + ['is_show', 'lang_en', 'lang_ja', 'log_votes'] + ['genre:' + g for g in genres]
med = np.nanmedian(X, 0); Xf = np.where(np.isnan(X), med, X); Xs = (Xf - Xf.mean(0)) / (Xf.std(0) + 1e-9)
for nm, t in (('rated 5 or less', y <= 5), ('rated 8 or more', y >= 8)):
    c = LogisticRegression(C=0.02, max_iter=500).fit(Xs[idx], t).coef_[0]; o = np.argsort(c)
    print(nm, '| pushes toward:', ', '.join('%s %+.2f' % (names[i], c[i]) for i in o[::-1][:10])); print('   pushes away:', ', '.join('%s %+.2f' % (names[i], c[i]) for i in o[:10]))
# spread of the outcome by predicted level: where is the uncertainty?
