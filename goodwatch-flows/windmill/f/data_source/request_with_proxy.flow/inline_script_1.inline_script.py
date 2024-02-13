import requests


def main():
    proxy = {"http":"http://49.13.88.203", "https":"https://49.13.88.203"}
    url = "https://icanhazip.com"
    r = requests.get(url, proxies=proxy, timeout=5)
    print(r.text)
    return r.text