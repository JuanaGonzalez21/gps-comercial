"""Unit tests of the track domain module: RDP simplification, haversine and statistics."""

import math
import random
import time
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.fleet import TrackPoint
from app.domain.track import haversine_km, rdp_importance, simplify, track_stats

T0 = datetime(2026, 11, 9, 12, 0, tzinfo=UTC)


def track(coords: list[tuple[float, float]], speeds: list[float | None] | None = None):
    speeds = speeds or [None] * len(coords)
    return [
        TrackPoint(
            recorded_at=T0 + timedelta(seconds=30 * i),
            latitude=lat,
            longitude=lon,
            speed_kmh=speed,
        )
        for i, ((lat, lon), speed) in enumerate(zip(coords, speeds, strict=True))
    ]


def random_walk(n: int, seed: int = 7) -> list[TrackPoint]:
    rng = random.Random(seed)  # noqa: S311 - deterministic test data, not security
    lat, lon, coords = 4.65, -74.08, []
    for _ in range(n):
        lat += rng.uniform(-0.0005, 0.0005)
        lon += rng.uniform(-0.0005, 0.0005)
        coords.append((lat, lon))
    return track(coords)


def reference_rdp(points: list[TrackPoint], epsilon_m: float) -> list[TrackPoint]:
    """Textbook recursive RDP (same local projection and segment distance), for comparison."""
    mean_lat = math.radians(sum(p.latitude for p in points) / len(points))
    scale = 6_371_008.8 * math.pi / 180
    xy = [(p.longitude * scale * math.cos(mean_lat), p.latitude * scale) for p in points]

    def distance(i: int, a: int, b: int) -> float:
        (px, py), (ax, ay), (bx, by) = xy[i], xy[a], xy[b]
        dx, dy = bx - ax, by - ay
        if dx == dy == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(px - ax - t * dx, py - ay - t * dy)

    def keep(a: int, b: int) -> list[int]:
        if b - a < 2:
            return []
        index = max(range(a + 1, b), key=lambda i: distance(i, a, b))
        if distance(index, a, b) <= epsilon_m:
            return []
        return [*keep(a, index), index, *keep(index, b)]

    return [points[0], *(points[i] for i in keep(0, len(points) - 1)), points[-1]]


def test_short_tracks_are_returned_unchanged() -> None:
    points = random_walk(50)
    assert simplify(points, 50) == tuple(points)
    assert simplify(points[:1], 100) == tuple(points[:1])
    assert simplify([], 100) == ()


def test_corner_is_kept_and_collinear_points_dropped() -> None:
    # Straight east, then straight north: the corner is the only point that matters.
    coords = [(4.6, -74.1 + 0.001 * i) for i in range(50)]
    coords += [(4.6 + 0.001 * i, -74.1 + 0.049) for i in range(1, 50)]
    points = track(coords)
    result = simplify(points, 3)
    assert result == (points[0], points[49], points[-1])


@pytest.mark.parametrize("epsilon_m", [3.0, 10.0, 40.0])
def test_matches_textbook_rdp_with_the_tolerance_that_fits(epsilon_m: float) -> None:
    points = random_walk(400)
    expected = reference_rdp(points, epsilon_m)
    assert 2 < len(expected) < len(points)
    assert simplify(points, len(expected)) == tuple(expected)


@pytest.mark.parametrize("max_points", [2, 100, 1000])
def test_result_fits_and_preserves_order_and_ends(max_points: int) -> None:
    points = random_walk(5000)
    result = simplify(points, max_points)
    assert 2 <= len(result) <= max_points
    assert result[0] == points[0] and result[-1] == points[-1]
    times = [p.recorded_at for p in result]
    assert times == sorted(times)


def test_outlier_spike_survives_simplification() -> None:
    coords = [(4.6, -74.1 + 0.0001 * i) for i in range(1000)]
    coords[500] = (4.65, coords[500][1])  # 5.5 km detour
    points = track(coords)
    assert points[500] in simplify(points, 10)


def test_endpoints_are_always_kept_and_importance_is_non_negative() -> None:
    importance = rdp_importance(random_walk(300))
    assert importance[0] == importance[-1] == math.inf
    assert all(value >= 0 for value in importance)


def test_long_tracks_without_recursion_limits_in_reasonable_time() -> None:
    points = random_walk(20_000, seed=3)
    started = time.perf_counter()
    result = simplify(points, 2000)
    assert len(result) <= 2000
    assert time.perf_counter() - started < 10


def test_rejects_impossible_budget() -> None:
    with pytest.raises(ValueError):
        simplify(random_walk(10), 1)


def test_haversine_one_degree_of_latitude() -> None:
    a, b = track([(0.0, -74.0), (1.0, -74.0)])
    assert haversine_km(a, b) == pytest.approx(111.195, abs=0.01)
    assert haversine_km(a, a) == 0


def test_stats_on_raw_points() -> None:
    points = track([(4.6, -74.1), (4.61, -74.1), (4.62, -74.1)], speeds=[10.0, None, 30.0])
    stats = track_stats(points, returned_points=2, truncated=True)
    assert stats.total_points == 3 and stats.returned_points == 2
    assert stats.simplified is True and stats.truncated is True
    assert stats.distance_km == pytest.approx(2.224, abs=0.001)
    assert stats.max_speed_kmh == 30.0 and stats.avg_speed_kmh == 20.0
    assert stats.duration_s == 60


def test_stats_of_empty_and_single_point_tracks() -> None:
    empty = track_stats([], returned_points=0, truncated=False)
    assert (empty.distance_km, empty.duration_s, empty.max_speed_kmh) == (0, 0, None)
    single = track_stats(track([(4.6, -74.1)], [0.0]), returned_points=1, truncated=False)
    assert single.duration_s == 0 and single.max_speed_kmh == 0.0 and single.simplified is False
