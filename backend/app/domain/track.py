"""Track simplification and statistics for the route history (RF-24). Pure Python, no I/O.

Simplification is Ramer-Douglas-Peucker (RDP) with an automatic tolerance: instead of guessing an
epsilon, one RDP pass ranks every point by the tolerance at which RDP would drop it, and the result
is exactly what RDP returns with the smallest epsilon whose output fits `max_points`. First and last
points are always kept. The split loop uses an explicit stack (no recursion limit on long tracks).

Distances for RDP use a local equirectangular projection in metres (accurate at city scale) and
point-to-segment distance, which behaves well when a vehicle comes back near where it started.
Statistics use the great-circle (haversine) distance over the raw points, before simplifying.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise

from app.domain.fleet import TrackPoint

EARTH_RADIUS_M = 6_371_008.8  # mean Earth radius (IUGG)


def haversine_km(a: TrackPoint, b: TrackPoint) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    d_lat = lat2 - lat1
    d_lon = math.radians(b.longitude - a.longitude)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h))) / 1000


def _project(points: Sequence[TrackPoint]) -> tuple[list[float], list[float]]:
    mean_lat = math.radians(sum(p.latitude for p in points) / len(points))
    scale = EARTH_RADIUS_M * math.pi / 180
    x_scale = scale * math.cos(mean_lat)
    return [p.longitude * x_scale for p in points], [p.latitude * scale for p in points]


def _farthest(xs: list[float], ys: list[float], first: int, last: int) -> tuple[int, float]:
    """Interior point farthest from segment first-last, and that distance (metres)."""
    ax, ay = xs[first], ys[first]
    dx, dy = xs[last] - ax, ys[last] - ay
    length2 = dx * dx + dy * dy
    best_index, best_d2 = first + 1, -1.0
    for i in range(first + 1, last):
        px, py = xs[i] - ax, ys[i] - ay
        if length2 > 0:
            t = (px * dx + py * dy) / length2
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            px, py = px - t * dx, py - t * dy
        d2 = px * px + py * py
        if d2 > best_d2:
            best_index, best_d2 = i, d2
    return best_index, math.sqrt(best_d2)


def rdp_importance(points: Sequence[TrackPoint]) -> list[float]:
    """For each point, the largest RDP tolerance (metres) that would still keep it.

    A split point survives tolerance `eps` only if its distance and the distances of every
    ancestor split exceed `eps`, hence importance = min(own distance, parent importance).
    """
    n = len(points)
    importance = [math.inf] * n
    if n <= 2:
        return importance
    xs, ys = _project(points)
    stack = [(0, n - 1, math.inf)]
    while stack:
        first, last, parent = stack.pop()
        if last - first < 2:
            continue
        index, distance = _farthest(xs, ys, first, last)
        importance[index] = min(distance, parent)
        stack.append((first, index, importance[index]))
        stack.append((index, last, importance[index]))
    return importance


def simplify(points: Sequence[TrackPoint], max_points: int) -> tuple[TrackPoint, ...]:
    """RDP with the smallest tolerance whose result has at most `max_points` points."""
    if max_points < 2:
        raise ValueError("max_points must be at least 2")
    n = len(points)
    if n <= max_points:
        return tuple(points)
    importance = rdp_importance(points)
    # The (max_points - 1)-th most important interior point is the first that does not fit: its
    # importance is the tolerance, and RDP keeps the points strictly above it.
    tolerance = sorted(importance[1:-1], reverse=True)[max_points - 2]
    keep = [i for i in range(1, n - 1) if importance[i] > tolerance]
    return (points[0], *(points[i] for i in keep), points[-1])


@dataclass(frozen=True, slots=True)
class TrackStats:
    total_points: int
    returned_points: int
    simplified: bool
    truncated: bool
    distance_km: float
    max_speed_kmh: float | None
    avg_speed_kmh: float | None
    duration_s: int


def track_stats(
    points: Sequence[TrackPoint], *, returned_points: int, truncated: bool
) -> TrackStats:
    """Computed on the raw points. `avg_speed_kmh` is the mean of the speeds the device reported
    (consistent with `max_speed_kmh`); `distance_km` sums haversine distances between fixes."""
    distance = sum(haversine_km(a, b) for a, b in pairwise(points))
    speeds = [p.speed_kmh for p in points if p.speed_kmh is not None]
    duration = (
        int((points[-1].recorded_at - points[0].recorded_at).total_seconds())
        if len(points) > 1
        else 0
    )
    return TrackStats(
        total_points=len(points),
        returned_points=returned_points,
        simplified=returned_points < len(points),
        truncated=truncated,
        distance_km=round(distance, 3),
        max_speed_kmh=round(max(speeds), 1) if speeds else None,
        avg_speed_kmh=round(sum(speeds) / len(speeds), 1) if speeds else None,
        duration_s=max(0, duration),
    )
