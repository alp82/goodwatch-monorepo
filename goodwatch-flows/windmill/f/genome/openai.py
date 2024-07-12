import openai
import pandas as pd
import re
import wmill
from typing import List

from f.db.postgres import init_postgres

OpenAI = wmill.get_resource("u/Alp/openai_windmill_codegen")

example_output = {
    "Mood": [
        "Tense",
        "Dramatic",
        "Dark",
        "Intense",
        "Melancholic",
        "Hopeful",
        "Optimistic",
        "Thought-provoking",
    ],
    "Plot": [
        "Revenge",
        "Crime investigation",
        "Mystery solving",
        "Survival",
        "Social Misfits",
        "Losing-it Hero",
    ],
    "Time/Period": ["Modern era", "Contemporary", "90s", "Future"],
    "Place": ["Urban", "Suburban", "Space", "Woods", "London"],
}


def get_movie_df():
    pg = init_postgres()
    sql_query = """
    SELECT
        title,
        release_year,
        genres,
        trope_names,
        tropes
    FROM
        movies
    WHERE
        tmdb_id = 37094;
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


# Generate description using OpenAI API
def generate_genome(title: str, release_year: str, tropes: List[str]):
    prompt = f"To create a film genome, find the best values for each of the following attributes:\n\n\
    Mood:\n\
    Plot:\n\
    Time/Period:\n\
    Place:\n\n\
    As a response ONLY fill out the above without any explanations, intro or outro.\n\n\
    The title is: {title} ({release_year})\n\
    Analyze the following list of tropes to fill out the attributes above with as many concise values as possible: {', '.join(tropes)}"

    client = openai.OpenAI(
        api_key=OpenAI.get("api_key"),
    )

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="gpt-4o",
        # model="gpt-3.5-turbo-0125",
    )
    return chat_completion.choices[0].message.content


def strip_html(html_string):
    clean = re.compile("<.*?>")
    return re.sub(clean, "", html_string)


def main():
    movie_df = get_movie_df()
    title = movie_df["title"].iloc[0]
    release_year = str(movie_df["release_year"].iloc[0])
    tropes = [
        f"{trope['name']}: {strip_html(trope['html'])}"
        for trope in movie_df["tropes"].iloc[0]
    ]
    print(tropes)
    genome = generate_genome(title, release_year, tropes)
    print(genome)
    return genome
