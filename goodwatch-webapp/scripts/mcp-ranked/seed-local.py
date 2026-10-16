"""Seed real search budget/catalog tables only on the guarded local MCP cluster."""
import runpy
from pathlib import Path
base = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'mcp-read/seed-local.py'))
sql = base['sql']
for table in ['search_interpretations', 'search_spending', 'search_history', 'search_control']:
    sql(f'DELETE FROM {table}')
sql("INSERT INTO search_control (id, halted) VALUES ('paid', false)")
sql("UPDATE movie SET essence_text = 'quiet local movies with kind friends', goodwatch_overall_score_voting_count = 12000 WHERE tmdb_id BETWEEN 2000 AND 2024")
for table in ['movie', 'search_interpretations', 'search_spending', 'search_history', 'search_control']:
    sql(f'REFRESH TABLE {table}')
print('Reset dedicated local search budget; populated eligible test titles')
