import secrets
import string

DISPLAY_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"


def new_id() -> str:
    return "c" + secrets.token_hex(12)


def generate_display_id() -> str:
    return "".join(secrets.choice(DISPLAY_ID_CHARS) for _ in range(8))


def random_hex_token() -> str:
    return secrets.token_bytes(32).hex()


def content_id_from_str(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(value[-6:], 36) or 0
    except ValueError:
        return 0
