"""In-memory sliding-window rate limiter (login attempts per client IP, SEG-07).

Per-process memory is enough for the single free-tier instance; account lockout in the database
covers attempts that bypass the IP limit (e.g. spoofed X-Forwarded-For).
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable


class SlidingWindowRateLimiter:
    def __init__(
        self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> int | None:
        """Register an attempt. Returns seconds to wait if the limit is exceeded, else None."""
        now = self._clock()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= self._window:
                hits.popleft()
            if len(hits) >= self._limit:
                return max(1, math.ceil(self._window - (now - hits[0])))
            hits.append(now)
            if len(self._hits) > 10_000:  # bound memory under a flood of distinct keys
                self._hits = {
                    k: v for k, v in self._hits.items() if v and now - v[-1] < self._window
                }
            return None
