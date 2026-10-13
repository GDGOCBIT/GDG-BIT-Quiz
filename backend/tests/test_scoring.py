from app.scoring import MAX_POINTS_PER_QUESTION, clamp_points, points_for, server_points


def test_full_speed_bonus():
    assert points_for(20, 0) == 150


def test_no_bonus_at_deadline():
    assert points_for(20, 20_000) == 100


def test_half_time_half_bonus():
    assert points_for(20, 10_000) == 125


def test_negative_clamped():
    assert points_for(20, -500) == 150


def test_overtime_floors_at_base():
    assert points_for(10, 999_999) == 100


def test_clamp_range():
    assert clamp_points(999) == MAX_POINTS_PER_QUESTION
    assert clamp_points(-5) == 0
    assert clamp_points(120) == 120


def test_server_recomputes_when_ms_taken_present():
    assert server_points(20, 0, 100) == 150
    assert server_points(20, 20_000, 150) == 100


def test_server_clamps_claim_without_timing():
    assert server_points(20, None, 999) == 150
    assert server_points(20, None, 120) == 120
