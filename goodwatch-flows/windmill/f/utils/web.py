import requests


def url_exists(url: str):
    r = requests.head(url)
    return r.status_code == requests.codes.ok


def fetch_file_from_url(url: str):
    return requests.get(url, timeout=30, stream=True).content
