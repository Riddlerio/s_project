"""아동 게임의 별·격려. 치료사가 확정한 임상 결과나 진단으로 해석하지 않는다."""


def round_reward(successes: int, evaluated: int) -> dict:
    # evaluated에는 success·retry만 들어간다. uncertain·no_speech는 분모에서 제외한다.
    ratio = successes / evaluated if evaluated > 0 else None
    if ratio is not None and ratio >= 0.7:
        stars, praise = 3, "역시 최고야!"
    elif ratio is not None and ratio >= 0.5:
        stars, praise = 2, "정말 잘했어!"
    else:
        stars, praise = 1, "조금만 더 노력해보자!"
    return {"stars": stars, "praise": praise, "successRate": ratio}
