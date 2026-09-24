import re


def title_to_dashed(title: str) -> str:
    """Port of titleToDashed in app/utils/helpers.ts. Both must produce the same slug."""
    slug = re.sub(r"[^A-Za-z0-9_\- ]+", "", title.lower())
    return re.sub(r" +", "-", slug)
