import re

non_word = re.compile(r"[^- \w]+")
multi_space = re.compile(r" +")


def to_dashed(title: str) -> str:
    """Convert a title to a dashed-string."""
    if not title:
        return ""

    title_dashed = title.lower()
    title_dashed = (title_dashed
                    .replace(": ", "-")
                    .replace("--", "-")
                    .replace(" – ", "---"))
    title_dashed = non_word.sub("", title_dashed)
    title_dashed = multi_space.sub("-", title_dashed)

    return title_dashed


def to_underscored(title: str) -> str:
    """Convert a text to an underscored_string."""
    return to_dashed(title).replace("-", "_")


def to_pascal_case(text: str) -> str:
    """Convert a text to PascalCase."""
    return re.sub(r"(^\w|-\w)", clear_and_upper, text)


def clear_and_upper(text: str) -> str:
    """Clear dashes and convert to uppercase."""
    return text.replace("-", "").upper()


def main():
    pass
