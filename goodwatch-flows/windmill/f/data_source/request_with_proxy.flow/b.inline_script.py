import random
import requests


def try_request(proxy_list: list[str], url: str, retry_count=1):
    if not proxy_list:
        return None

    proxy_url = random.choice(proxy_list)
    proxy_list.remove(proxy_url)

    proxies = {"http": proxy_url}
    print(f"try {proxy_url} #{retry_count}")

    try:
        r = requests.get(url, proxies=proxies, timeout=15)
        if r.status_code == 200:
            return r
    except requests.exceptions.RequestException as e:
        print(f"Error with {proxy_url}: {e}")

    return try_request(proxy_list, url, retry_count=retry_count + 1)


def main(proxy_list: list[str], url: str):
    r = try_request(proxy_list, url)
    if not r:
        raise Exception(f"error: rate limit for {url}")
    print(r.text)
    print(r.status_code)
    return r
