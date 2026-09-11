from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from bson import ObjectId
from bs4 import BeautifulSoup
from mongoengine import get_db
import requests

from f.db.mongodb import init_mongodb, close_mongodb
from f.tmdb_web import country_state
from f.tmdb_web.provider_identity import provider_name_from_url
from f.tmdb_web.models import (
    TmdbStreamingCrawlResult,
    StreamingLink,
    StreamType,
)

HTTP_TIMEOUT_SECONDS = 15
StreamHeaderToType: dict[str, StreamType] = {
    "Stream": "flatrate",
    "Free": "free",
    "Ads": "ads",
    "Rent": "rent",
    "Buy": "buy",
}


def retry_deadline(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.utcnow() + timedelta(seconds=max(0, int(value)))
    except ValueError:
        try:
            return (
                parsedate_to_datetime(value)
                .astimezone(timezone.utc)
                .replace(tzinfo=None)
            )
        except (ValueError, TypeError, OverflowError):
            return None


def crawl_tmdb_watch_page(next_entry: dict) -> TmdbStreamingCrawlResult:
    url = next_entry["tmdb_watch_url"]
    country_code = next_entry["country_code"]
    response = requests.get(
        url,
        headers={
            "Accept-Language": "en-US",
            "User-Agent": "Mozilla/5.0",
        },
        timeout=HTTP_TIMEOUT_SECONDS,
    )
    soup = BeautifulSoup(response.text, "html.parser")
    title = soup.find("title")
    limited = response.status_code in (403, 429) or (
        title is not None and "Request Error (403)" in title.get_text()
    )
    if limited:
        return TmdbStreamingCrawlResult(
            url=url,
            country_code=country_code,
            streaming_links=None,
            rate_limit_reached=True,
            retry_at=retry_deadline(response.headers.get("Retry-After")),
        )
    if response.status_code != 200:
        raise requests.HTTPError(
            f"TMDB watch HTTP {response.status_code}", response=response
        )
    offers = soup.select_one("#ott_offers_window")
    if offers is None:
        raise ValueError("Unrecognized TMDB watch page")
    provider_blocks = offers.select(".ott_provider")
    if not provider_blocks and offers.select_one("p.no_offers") is None:
        raise ValueError(
            "Watch page has neither offers nor verified no-offers message"
        )

    streaming_links = []
    for provider_block in provider_blocks:
        heading = provider_block.select_one("h3")
        if heading is None:
            raise ValueError("Offer block is missing its type")
        header = heading.get_text(strip=True)
        if header not in StreamHeaderToType:
            raise ValueError(f"Unknown offer type: {header}")
        providers = provider_block.select("li.ott_filter_best_price")
        for provider in providers:
            provider_link = provider.select_one("a")
            if provider_link is None:
                raise ValueError("Offer is missing its link")
            stream_url = provider_link.get("href")
            stream_title = provider_link.get("title")
            if not isinstance(stream_url, str) or not isinstance(
                stream_title, str
            ):
                raise ValueError("Offer link or provider title is invalid")
            provider_name = None
            if stream_title.endswith("Demand"):
                parts = stream_title.rsplit(" on ", 2)
                provider_name = (
                    " on ".join(parts[-2:]) if len(parts) > 2 else stream_title
                )
            else:
                parts = stream_title.rsplit(" on ", 1)
                provider_name = parts[-1] if len(parts) > 1 else stream_title

            provider_name = provider_name_from_url(stream_url) or provider_name

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

    if provider_blocks and not streaming_links:
        raise ValueError("Offer blocks did not contain parseable links")
    return TmdbStreamingCrawlResult(
        url=url,
        country_code=country_code,
        streaming_links=streaming_links,
        rate_limit_reached=False,
    )


def main(next_id: dict) -> dict:
    media_type = next_id.get("type")
    if (
        media_type not in ("movie", "tv")
        or not isinstance(next_id.get("id"), str)
        or not ObjectId.is_valid(next_id["id"])
    ):
        raise ValueError("Expected a movie/tv provider document ObjectId")
    init_mongodb()
    try:
        db = get_db()
        collection = db[f"tmdb_{media_type}_providers"]
        identity = ObjectId(next_id["id"])
        document = collection.find_one({"_id": identity})
        outcome = {"id": str(identity), "type": media_type}
        if document is None:
            return {
                **outcome,
                "outcome": "failed",
                "error": "Provider document not found",
            }
        outcome.update(
            tmdb_id=document["tmdb_id"],
            country_code=document.get("country_code"),
        )
        countries, errors = country_state.identity_map(
            list(collection.find({"tmdb_id": document["tmdb_id"]})), media_type
        )
        if identity in errors:
            country_state.record_identity_error(
                collection, document, errors[identity]
            )
            return {**outcome, "outcome": "failed", "error": errors[identity]}
        country = country_state.country_from_url(
            document["tmdb_watch_url"], document["tmdb_id"], media_type
        )
        outcome["country_code"] = country
        country_state.normalize_document(collection, document, country)
        claimed = country_state.claim(db, collection, identity)
        if claimed is None:
            current = collection.find_one({"_id": identity})
            now = datetime.utcnow()
            fresh = bool(
                current.get("updated_at")
                and current["updated_at"] > now - country_state.FRESHNESS
                and current.get("next_fetch_at")
                and current["next_fetch_at"] > now
                and not current.get("consecutive_failures")
            )
            return {
                **outcome,
                "outcome": "fresh" if fresh else "deferred",
                "next_fetch_at": current.get("next_fetch_at"),
                "upstream_retry_at": country_state.upstream_deadline(db),
            }
        try:
            result = crawl_tmdb_watch_page(claimed)
        except Exception as error:
            response = (
                error.response
                if isinstance(error, requests.HTTPError)
                else None
            )
            retry_at = (
                retry_deadline(response.headers.get("Retry-After"))
                if response is not None
                else None
            )
            saved = country_state.save_failure(
                db, collection, claimed, error, retry_at=retry_at
            )
            return {
                **outcome,
                "outcome": "failed" if saved else "deferred",
                "retry_saved": saved,
                "error": str(error),
            }
        if result.rate_limit_reached:
            saved = country_state.save_failure(
                db,
                collection,
                claimed,
                "TMDB upstream rate limit",
                rate_limited=True,
                retry_at=result.retry_at,
            )
            return {
                **outcome,
                "outcome": "failed" if saved else "deferred",
                "retry_saved": saved,
                "rate_limit_reached": True,
            }
        if result.streaming_links is None:
            raise ValueError(
                "Successful crawl must supply verified streaming links"
            )
        saved = country_state.save_success(
            collection,
            claimed,
            [link.model_dump() for link in result.streaming_links],
        )
        return {
            **outcome,
            "outcome": "fetched" if saved else "deferred",
            "providers": result.model_dump() if saved else None,
        }
    finally:
        close_mongodb()
