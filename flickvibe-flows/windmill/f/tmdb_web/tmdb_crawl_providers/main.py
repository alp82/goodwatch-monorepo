import asyncio
from datetime import datetime
from ssl import SSLError
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup
from pydantic import BaseModel
import requests
from typing import Union, Optional, Literal

from f.data_source.common import prepare_next_entries
from f.db.mongodb import init_mongodb
from f.tmdb_web.models import TmdbMovieProviders, TmdbTvProviders, StreamingLinkDoc

BATCH_SIZE = 50
BUFFER_SELECTED_AT_MINUTES = 30
BROWSER_TIMEOUT = 180000


StreamType = (
    Literal["flatrate"]
    | Literal["free"]
    | Literal["ads"]
    | Literal["rent"]
    | Literal["buy"]
)

# example with all types: https://www.themoviedb.org/movie/45054-there-be-dragons/watch?translate=false&locale=US
StreamHeaderToType = {
    "Stream": "flatrate",
    "Free": "free",
    "Ads": "ads",
    "Rent": "rent",
    "Buy": "buy",
}


class StreamingLink(BaseModel):
    stream_url: Optional[str]
    stream_type: Optional[StreamType]
    provider_name: Optional[str]
    price_dollar: Optional[float]
    quality: Optional[str]


class TmdbStreamingCrawlResult(BaseModel):
    url: Optional[str]
    country_code: Optional[str]
    streaming_links: Optional[list[StreamingLink]]
    rate_limit_reached: bool


def retrieve_next_entries(
    count: int,
) -> Union[TmdbMovieProviders, TmdbTvProviders]:
    next_entries = prepare_next_entries(
        movie_model=TmdbMovieProviders,
        tv_model=TmdbTvProviders,
        count=count,
        buffer_minutes=BUFFER_SELECTED_AT_MINUTES,
    )
    return next_entries


async def crawl_data(
    next_entry: Union[TmdbMovieProviders, TmdbTvProviders],
) -> tuple[TmdbStreamingCrawlResult, Union[TmdbMovieProviders, TmdbTvProviders]]:
    result = crawl_tmdb_watch_page(next_entry=next_entry)
    store_result(next_entry=next_entry, result=result)
    return result, next_entry


def crawl_tmdb_watch_page(
    next_entry: Union[TmdbMovieProviders, TmdbTvProviders],
) -> TmdbStreamingCrawlResult:
    url = next_entry.tmdb_watch_url

    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)
    country_code = query_params.get("locale", [None])[0]

    print(f"opening url: {url} (country code: {country_code})")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537"
    }
    try:
        response = requests.get(url, headers=headers)
    except SSLError as error:
        # TODO error handling
        raise error

    if response.status_code == 429:
        return TmdbStreamingCrawlResult(
            url=url,
            country_code=country_code,
            streaming_links=None,
            rate_limit_reached=True,
        )

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    provider_blocks = soup.select(".ott_provider")

    streaming_links = []
    for provider_block in provider_blocks:
        header = provider_block.select_one("h3").string
        providers = provider_block.select("li.ott_filter_best_price")
        for provider in providers:
            provider_link = provider.select_one("a")
            stream_url = provider_link.get("href")

            stream_title = provider_link.get("title")
            provider_name = None
            if stream_title.endswith("Demand"):
                parts = stream_title.rsplit(" on ", 2)
                provider_name = " on ".join(parts[-2:]) if len(parts) > 2 else stream_title
            else:
                parts = stream_title.rsplit(" on ", 1)
                provider_name = parts[-1] if len(parts) > 1 else stream_title

            price = None
            try:
                price_element = provider.select_one(".price")
                if price_element:
                    price_string = price_element.string
                    if price_string:
                        price = float(price_string.replace("$", ""))
            except (AttributeError, ValueError) as e:
                pass

            quality = None
            try:
                quality_element = provider.select_one(".presentation_type")
                if quality_element:
                    quality = quality_element.string
            except (AttributeError, ValueError) as e:
                pass

            streaming_links.append(
                StreamingLink(
                    stream_url=stream_url,
                    stream_type=StreamHeaderToType.get(header),
                    provider_name=provider_name,
                    price_dollar=price,
                    quality=quality,
                )
            )

    return TmdbStreamingCrawlResult(
        url=url,
        country_code=country_code,
        streaming_links=streaming_links,
        rate_limit_reached=False,
    )


def store_result(
    next_entry: Union[TmdbMovieProviders, TmdbTvProviders],
    result: TmdbStreamingCrawlResult,
):
    if type(result.country_code) in [str]:
        next_entry.country_code = result.country_code

    if type(result.streaming_links) in [list]:
        streaming_link_docs = []
        for streaming_link in result.streaming_links:
            streaming_link_doc = StreamingLinkDoc(
                stream_url=streaming_link.stream_url,
                stream_type=streaming_link.stream_type,
                provider_name=streaming_link.provider_name,
                price_dollar=streaming_link.price_dollar,
                quality=streaming_link.quality,
            )
            streaming_link_docs.append(streaming_link_doc)
        next_entry.streaming_links = streaming_link_docs

    if result.rate_limit_reached:
        next_entry.error_message = "Rate Limit reached"
        next_entry.failed_at = datetime.utcnow()
        print(
            f"could not fetch rating for {next_entry.original_title}: {next_entry.error_message}"
        )

    else:
        next_entry.error_message = None
        next_entry.updated_at = datetime.utcnow()
        print(
            f"saving streaming provider for {next_entry.original_title} in {result.country_code}: {len(result.streaming_links)} links"
        )

    next_entry.save()


async def tmdb_crawl_streaming_providers():
    print("Fetch streaming providers from TMDB pages")
    init_mongodb()

    next_entries = retrieve_next_entries(count=BATCH_SIZE)
    if not next_entries:
        print(f"warning: no entries to fetch in TMDB streaming providers")
        return

    for next_entry in next_entries:
        print(
            f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
        )

    list_of_crawl_results = await asyncio.gather(
        *[crawl_data(next_entry) for next_entry in next_entries]
    )

    return {
        "count_new_ratings": len(next_entries),
        "entries": [
            {
                "tmdb_id": next_entry.tmdb_id,
                "original_title": next_entry.original_title,
                "popularity": next_entry.popularity,
                "providers": crawl_result.model_dump() if crawl_result else None,
            }
            for crawl_result, next_entry in list_of_crawl_results
        ],
    }


def main():
    return asyncio.run(tmdb_crawl_streaming_providers())


if __name__ == "__main__":
    main()
