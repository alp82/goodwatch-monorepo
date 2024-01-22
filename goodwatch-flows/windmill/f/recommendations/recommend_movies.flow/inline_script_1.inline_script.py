import pandas as pd


def main(movie_tropes):
    movie_tropes_df = pd.DataFrame(movie_tropes['data'], columns=movie_tropes['columns'], index=movie_tropes['index'])
    print(movie_tropes_df)
    return movie_tropes_df
