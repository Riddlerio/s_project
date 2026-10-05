import pytest

from app.games.round_rewards import round_reward


@pytest.mark.parametrize("successes,evaluated,stars,praise,ratio", [
    (7, 10, 3, "역시 최고야!", 0.7),
    (6, 10, 2, "정말 잘했어!", 0.6),
    (5, 10, 2, "정말 잘했어!", 0.5),
    (4, 10, 1, "조금만 더 노력해보자!", 0.4),
    (0, 0, 1, "조금만 더 노력해보자!", None),
])
def test_round_stars_use_game_attempt_ratio(successes, evaluated, stars, praise, ratio):
    assert round_reward(successes, evaluated) == {"stars": stars, "praise": praise, "successRate": ratio}
