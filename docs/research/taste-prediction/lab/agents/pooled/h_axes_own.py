"""Consensus + 5 learned taste axes + shrunk personal weights."""
import pool
predict = pool.make(k=5, als=0, own=300.)
