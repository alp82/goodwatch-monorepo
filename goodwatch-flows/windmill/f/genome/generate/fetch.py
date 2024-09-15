from datetime import datetime
import re
from typing import Union

from hugchat import hugchat
from hugchat.login import Login
import wmill

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.genome.models import GenomeMovie, GenomeTv

HUGCHAT_ASSISTANT_GENOME = "66668f5ae0f3efc53bf7e904"


def get_chatbot():
    huggingface_email = wmill.get_variable("u/Alp/HUGGINGFACE_EMAIL")
    huggingface_pass = wmill.get_variable("u/Alp/HUGGINGFACE_PASS")
    sign = Login(huggingface_email, huggingface_pass)
    cookie_path_dir = "./cookies/"
    cookies = sign.login(cookie_dir_path=cookie_path_dir, save_cookies=True)

    chatbot = hugchat.ChatBot(
        cookies=cookies.get_dict()
    )  # or cookie_path="usercookies/<email>.json"
    chatbot.delete_all_conversations()
    chatbot.new_conversation(assistant=HUGCHAT_ASSISTANT_GENOME, switch_to=True)
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


def generate_genome(chatbot, title: str, release_year: str, trope_names: list[str]):
    prompt = f"""
The title is: {title} ({release_year})
Analyze the following list of tropes to fill out the genome:
{', '.join(trope_names)}
    """
    print(prompt)

    message_result = chatbot.chat(prompt)

    text: str = message_result.wait_until_done()
    print(text)

    attributes = extract_attributes(text)
    return attributes


def strip_html(html_string):
    clean = re.compile("<.*?>")
    return re.sub(clean, "", html_string)


def store_result(next_entry: Union[GenomeMovie, GenomeTv], dna: dict):
    print(f"saving DNA for {next_entry.original_title} ({next_entry.release_year})")

    next_entry.dna = dna
    next_entry.updated_at = datetime.utcnow()
    next_entry.is_selected = False
    next_entry.save()


def hugchat_generate_dna(next_entry: Union[GenomeMovie, GenomeTv]):
    print("Generate DNA from Hugchat")

    if not next_entry:
        print(f"warning: no entries to fetch for genomes")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    chatbot = get_chatbot()

    title = str(next_entry.original_title)
    release_year = str(next_entry.release_year)
    trope_names = next_entry.trope_names

    genome = generate_genome(chatbot, title, release_year, trope_names)
    print(genome)

    # TODO rate limit handling
    if False:
        raise Exception(
            f"Rate limit reached for {next_entry.original_title}, retrying."
        )

    result = {
        "title": f"{title} ({release_year})",
        **genome,
    }
    store_result(next_entry=next_entry, dna=genome)

    return result


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=GenomeMovie,
        tv_model=GenomeTv,
    )
    result = hugchat_generate_dna(next_entry)
    close_mongodb()
    return result
