from hugchat import hugchat
from hugchat.login import Login
import pandas as pd
import re
import wmill
from typing import List

from f.db.postgres import init_postgres


"""
Goal: Create a comprehensive film genome by identifying the best values for each of the following categories. Aim for the suggested number of values in parentheses, but feel free to include more if applicable:

Sub-Genres: (2-4)
Mood/Attitudes: (5+)
Plot: (10+)
Memorable Moments: (2-4)
Pacing: (1-2)
Time/Period: (2+)
Place: (2+)
Character Archetypes: (1-3)
Dialog Style: (1-2)
Narrative Structure: (1-3)
Humor: (if applicable)
Visual Style: (3+)
Cinematic Techniques: (3+)
Score and Sound Design: (2+)
Costume and Set Design: (2+)
Key Objects/Props: (3+)
Target Audience: (1+)
Flag: (if applicable)

Additional Instructions:
* Plot: Contains both Plot Type (e.g., quest, revenge) as well as Plot Elements (specific plot points or devices). Assign as many quality values as you can find. This category should be the most extensive.
* Pacing: Ensure values are distinct and related to the flow of the story, not the mood.
* Place: Includes Geographical Setting and Environment/Setting Type (urban, rural, futuristic).
* Narrative Structure: Ensure distinctiveness from Plot Types.
* Flag: This is for indicating content unsuitable for certain audiences (e.g., gore violence, explicit language).

Output: Provide the values for each category in a single line per category, without explanations, intro, or outro. Each line starts with the category name, followed by a colon and a comma-separated list of value. If no values are applicable, remove the category from the result completely (avoid using "none", "TBA", etc.).
"""


def get_movie_df():
    pg = init_postgres()
    sql_query = """
    SELECT
        m.tmdb_id,
        title,
        release_year,
		aggregated_overall_score_normalized_percent,
        trope_names
    FROM
        movies m
    INNER JOIN
	    user_scores us ON us.tmdb_id = m.tmdb_id AND us.media_type = 'movie'
	ORDER BY
		us.score DESC
	LIMIT
		5
    """
    df = pd.read_sql_query(sql_query, pg)
    pg.close()
    return df


def get_chatbot():
    huggingface_email = wmill.get_variable("u/Alp/HUGGINGFACE_EMAIL")
    huggingface_pass = wmill.get_variable("u/Alp/HUGGINGFACE_PASS")
    sign = Login(huggingface_email, huggingface_pass)
    cookie_path_dir = "./cookies/"
    cookies = sign.login(cookie_dir_path=cookie_path_dir, save_cookies=True)

    chatbot = hugchat.ChatBot(
        cookies=cookies.get_dict()
    )  # or cookie_path="usercookies/<email>.json"
    chatbot.new_conversation(assistant="66668f5ae0f3efc53bf7e904", switch_to=True)
    return chatbot


def extract_attributes(text) -> dict[str, list[str]]:
    attributes = {}
    lines = text.strip().split("\n")

    for line in lines:
        try:
            key, values = line.split(": ")
            attributes[key.strip()] = [value.strip() for value in values.split(",")]
        except ValueError as e:
            print(line)
            pass

    return attributes


def generate_genome(chatbot, title: str, release_year: str, tropes: List[str]):
    prompt = f"""
The title is: {title} ({release_year})
Analyze the following list of tropes to fill out the genome:
{', '.join(tropes)}
    """

    message_result = chatbot.chat(prompt)

    text: str = message_result.wait_until_done()
    attributes = extract_attributes(text)
    return attributes


def strip_html(html_string):
    clean = re.compile("<.*?>")
    return re.sub(clean, "", html_string)


def main():
    chatbot = get_chatbot()
    movie_df = get_movie_df()

    results = []
    for _, row in movie_df.iterrows():
        title = str(row["title"])
        release_year = str(row["release_year"])
        tropes = [str(trope) for trope in row["trope_names"]]

        genome = generate_genome(chatbot, title, release_year, tropes)
        print(genome)

        result = {
            "title": f"{title} ({release_year})",
            **genome,
        }
        results.append(result)

    return results
