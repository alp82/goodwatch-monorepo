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

    # Remove all non-alphanumeric characters
    clean_text = re.sub(r'[^a-zA-Z0-9\s]', '', text)

    # Split by spaces and capitalize each word
    words = clean_text.split()
    capitalized_words = [word.capitalize() for word in words]

    # Join the words back together
    pascal_case_text = ''.join(capitalized_words)

    return pascal_case_text


def remove_prefix(text, prefix):
    # Remove prefix wrapped in HTML tags
    # text = re.sub(f'<.*?>{prefix}<.*?>:', '', text)
    text = re.sub(f'<.*?>{re.escape(prefix)}<.*?>:', '', text)

    # Remove prefix with colon
    if text.startswith(f"{prefix}:"):
        return text.replace(f"{prefix}:", "", 1).lstrip()

    # Remove prefix without colon
    elif text.startswith(prefix):
        return text.replace(prefix, "", 1).lstrip()

    return text.strip()


def main():
    pass
