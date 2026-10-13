from exp9 import *
which = sys.argv[1]
if which == 'own':
    V = {'S+tfidf16': np.c_[XG, S, tf[:, :16]], 'S+tfidf8': np.c_[XG, S, tf[:, :8]], 'S+tfidf32': np.c_[XG, S, tf[:, :32]], 'S+tfidf16+tag16': np.c_[XG, S, tf[:, :16], ts[:, :16]],
         'S+en16+tfidf16': np.c_[XG, S, pe[:, :16], tf[:, :16]], 'S+en16+tag16+tfidf16': np.c_[XG, S, pe[:, :16], ts[:, :16], tf[:, :16]],
         'S+en12+tag12+tfidf12': np.c_[XG, S, pe[:, :12], ts[:, :12], tf[:, :12]], 'S+en24+tag24+tfidf24': np.c_[XG, S, pe[:, :24], ts[:, :24], tf[:, :24]]}
    for k, X in V.items(): show(k, run(X, [D.owner]))
else:
    us = D.users()
    V = {'base': XG, 'S+en16+tag16': np.c_[XG, S, pe[:, :16], ts[:, :16]], 'S+tfidf16': np.c_[XG, S, tf[:, :16]], 'S+en16+tag16+tfidf16': np.c_[XG, S, pe[:, :16], ts[:, :16], tf[:, :16]],
         'S+en16+tag16+tfidf16+multi16': np.c_[XG, S, pe[:, :16], ts[:, :16], tf[:, :16], pm[:, :16]]}
    for k, X in V.items(): show(k, run(X, us, seeds=(0, 1)))
