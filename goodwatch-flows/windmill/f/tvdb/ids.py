"""Source IDs and normalized join IDs have different database contracts."""

INT32_MAX = 2**31 - 1
INT64_MAX = 2**63 - 1


def checked_id(value, maximum=INT64_MAX):
    if type(value) is int:
        return value if 0 < value <= maximum else None
    if (
        isinstance(value, str)
        and value
        and len(value) <= len(str(maximum))
        and value.isascii()
        and value.isdecimal()
    ):
        parsed = int(value)
        return parsed if 0 < parsed <= maximum else None
    return None


def tmdb_id(value):
    return checked_id(value, INT32_MAX)


def main():
    """Importable ID contracts, no standalone work."""
