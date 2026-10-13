"""Consensus + 5 taste axes learned from the other members (reduced rank), member coefficients by posterior mean. No personal weights."""
import pool
predict = pool.make(k=5, als=1)
