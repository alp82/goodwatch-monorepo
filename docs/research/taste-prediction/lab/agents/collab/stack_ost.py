"""Baseline + ridge correction from other members' ratings of the same title (mean rater-centred z, rater count)."""
import stack
predict = stack.make(['ost_meanz', 'ost_logn'], alpha=100)
