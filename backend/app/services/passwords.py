"""Password hashing (Argon2id) and password policy."""

import secrets
import string
import threading

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.domain.errors import FieldError

MIN_LENGTH = 12
MAX_LENGTH = 128
_SYMBOLS = "!#$%&*+-.:;=?@_~"

# Argon2id with OWASP's minimum profile (19 MiB, t=2, p=1): the library default uses 64 MiB per
# hash, and a burst of logins would exceed the 512 MB of the free hosting instance.
_hasher = PasswordHasher(time_cost=2, memory_cost=19_456, parallelism=1)
# At most two hashes at a time: bounds memory and CPU under a login burst.
_slots = threading.BoundedSemaphore(2)
# Checked when the e-mail does not exist, so both paths cost the same (no user enumeration).
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    with _slots:
        return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        with _slots:
            return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def burn_verification_time(password: str) -> None:
    verify_password(_DUMMY_HASH, password)


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def policy_errors(
    password: str, email: str | None = None, field: str = "password"
) -> list[FieldError]:
    """Return every unmet rule, in Spanish, so the UI can show them all at once."""
    problems: list[str] = []
    if not MIN_LENGTH <= len(password) <= MAX_LENGTH:
        problems.append(f"Debe tener entre {MIN_LENGTH} y {MAX_LENGTH} caracteres.")
    if not any(c.islower() for c in password):
        problems.append("Debe incluir al menos una letra minúscula.")
    if not any(c.isupper() for c in password):
        problems.append("Debe incluir al menos una letra mayúscula.")
    if not any(c.isdigit() for c in password):
        problems.append("Debe incluir al menos un número.")
    if not any(not c.isalnum() and not c.isspace() for c in password):
        problems.append("Debe incluir al menos un símbolo.")
    local_part = (email or "").split("@")[0].lower()
    if len(local_part) >= 3 and local_part in password.lower():
        problems.append("No puede contener tu correo.")
    return [FieldError(field=field, message=message) for message in problems]


def generate_temporary_password(length: int = 16) -> str:
    """Random password that satisfies the policy; shown once to the admin, never stored in clear."""
    pools = [string.ascii_lowercase, string.ascii_uppercase, string.digits, _SYMBOLS]
    chars = [secrets.choice(pool) for pool in pools]
    alphabet = "".join(pools)
    chars += [secrets.choice(alphabet) for _ in range(length - len(chars))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)
