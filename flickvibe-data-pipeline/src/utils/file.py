from gzip import decompress


def unzip_json(gz_file: bytes) -> str:
    return decompress(gz_file).decode()
