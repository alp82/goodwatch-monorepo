"""TV Tropes URL candidates; kept separate from shared application slug rules."""

import re
import unicodedata


def number_words(number: int) -> str:
    """The English, no-'and' spelling used by TV Tropes page names."""
    small = "Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split()
    tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ]
    if number < 20:
        return small[number]
    if number < 100:
        return tens[number // 10] + (small[number % 10] if number % 10 else "")
    for size, name in [(1000000, "Million"), (1000, "Thousand"), (100, "Hundred")]:
        if number >= size:
            return (
                number_words(number // size)
                + name
                + (number_words(number % size) if number % size else "")
            )


def slug(title: str) -> str:
    title = unicodedata.normalize(
        "NFKD", title.replace("&", " And ").replace("+", " Plus ")
    )
    title = "".join(c for c in title if not unicodedata.combining(c))
    # Preserve acronyms such as S.H.I.E.L.D. and existing camel-case source slugs.
    return "".join(
        word[:1].upper() + word[1:]
        for word in re.sub(r"[^a-zA-Z0-9\s]", "", title).split()
    )


def title_variations(titles: list[str]) -> list[str]:
    result = []
    for title in titles:
        if not title:
            continue
        without_prefix = re.sub(
            r"^(?:Marvel['’]s|DC['’]s|Tom Clancy['’]s)\s+", "", title, flags=re.I
        )
        variants = [title, without_prefix]
        for text in list(variants):
            variants.append(re.split(r"\s+or\s*:|:", text, maxsplit=1, flags=re.I)[0])
        for text in variants:
            candidate = slug(text)
            if candidate and candidate not in result:
                result.append(candidate)
            match = re.match(r"^(\d{1,7})(?!\d)(.*)$", candidate)
            if match:
                spelled = number_words(int(match[1])) + match[2]
                if spelled not in result:
                    result.append(spelled)
    return result


def main():
    pass
