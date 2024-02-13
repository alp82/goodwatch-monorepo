import requests


def main():
    # https://docs.proxyscrape.com/
    url = "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=elite,anonymous"
    r = requests.get(url, timeout=15)
    return r.text.strip().replace("\r", "").split("\n")
    