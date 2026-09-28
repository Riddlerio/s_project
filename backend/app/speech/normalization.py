import re
import unicodedata


def normalize(text: str | None) -> str | None:
    value = re.sub(r"[^가-힣]", "", unicodedata.normalize("NFC", text or ""))
    return value or None
