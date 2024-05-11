import asyncio
from datetime import datetime
from ssl import SSLError
from typing import Union
from urllib.parse import urlparse, parse_qs

from bs4 import BeautifulSoup
import requests

from f.data_source.common import get_document_for_id
from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web.models import (
    TmdbStreamingCrawlResult,
    TmdbMovieProviders,
    TmdbTvProviders,
    StreamingLinkDoc,
    StreamingLink,
)


BROWSER_TIMEOUT = 180000


# example with all types: https://www.themoviedb.org/movie/45054-there-be-dragons/watch?translate=false&locale=US
StreamHeaderToType = {
    "Stream": "flatrate",
    "Free": "free",
    "Ads": "ads",
    "Rent": "rent",
    "Buy": "buy",
}


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
        "Accept-Language": "en-US",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537",
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

    title_tag = soup.find('title')
    if title_tag:
        title_text = title_tag.get_text()
        if "Request Error (403)" in title_text:
            return TmdbStreamingCrawlResult(
                url=url,
                country_code=country_code,
                streaming_links=None,
                rate_limit_reached=True,
            )

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
                provider_name = (
                    " on ".join(parts[-2:]) if len(parts) > 2 else stream_title
                )
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

    next_entry.is_selected = False
    next_entry.save()


async def tmdb_crawl_streaming_providers(
    next_entry: Union[TmdbMovieProviders, TmdbTvProviders],
):
    print("Fetch streaming providers from TMDB page")

    if not next_entry:
        print(f"warning: no entries to fetch in TMDB streaming providers")
        return

    print(
        f"next entry is: {next_entry.original_title} (popularity: {next_entry.popularity})"
    )

    (crawl_result, _) = await crawl_data(next_entry)

    if crawl_result.rate_limit_reached:
        raise Exception(
            f"Rate limit reached for {next_entry.original_title}, retrying."
        )

    return {
        "tmdb_id": next_entry.tmdb_id,
        "original_title": next_entry.original_title,
        "popularity": next_entry.popularity,
        "providers": crawl_result.model_dump() if crawl_result else None,
    }


def main(next_id: dict):
    init_mongodb()
    next_entry = get_document_for_id(
        next_id=next_id,
        movie_model=TmdbMovieProviders,
        tv_model=TmdbTvProviders,
    )
    result = asyncio.run(tmdb_crawl_streaming_providers(next_entry))
    close_mongodb()
    return result
