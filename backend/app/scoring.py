BASE_POINTS = 100
MAX_SPEED_BONUS = 50
MAX_POINTS_PER_QUESTION = BASE_POINTS + MAX_SPEED_BONUS


def points_for(seconds: int, ms_taken: int):
    s = max(1, int(seconds))
    ms_taken = max(0, int(ms_taken))
    total_ms = s * 1000
    remaining = max(0, total_ms - ms_taken)
    bonus = round((remaining / total_ms) * MAX_SPEED_BONUS)
    return BASE_POINTS + bonus


def clamp_points(points: int):
    p = int(points)
    return max(0, min(MAX_POINTS_PER_QUESTION, p))


def server_points(seconds: int, ms_taken: int | None, claimed: int):
    if ms_taken is not None:
        return points_for(seconds, ms_taken)
    return clamp_points(claimed)
