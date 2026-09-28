from dataclasses import dataclass

from .g2p import Phone


SIMILAR = {frozenset(p) for p in [("ㅅ", "ㅆ"), ("ㅈ", "ㅉ"), ("ㄱ", "ㄲ"), ("ㄷ", "ㄸ"), ("ㅂ", "ㅃ")]}


@dataclass
class Operation:
    kind: str
    target_index: int | None
    observed_index: int | None
    cost: float


def align(target: list[Phone], observed: list[Phone]) -> list[Operation]:
    n, m = len(target), len(observed)
    dp = [[float("inf")] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if i and dp[i - 1][j] + 1 < dp[i][j]:
                dp[i][j], back[i][j] = dp[i - 1][j] + 1, Operation("del", i - 1, None, 1)
            if j and dp[i][j - 1] + 1 < dp[i][j]:
                dp[i][j], back[i][j] = dp[i][j - 1] + 1, Operation("ins", None, j - 1, 1)
            if i and j and target[i - 1].slot == observed[j - 1].slot:
                a, b = target[i - 1].symbol, observed[j - 1].symbol
                cost = 0 if a == b else 0.5 if frozenset((a, b)) in SIMILAR else 1
                if dp[i - 1][j - 1] + cost <= dp[i][j]:
                    dp[i][j], back[i][j] = dp[i - 1][j - 1] + cost, Operation("match" if cost == 0 else "sub", i - 1, j - 1, cost)
    ops = []
    i, j = n, m
    while i or j:
        op = back[i][j]
        if op is None:
            raise ValueError("alignment failed")
        ops.append(op)
        i -= op.target_index is not None
        j -= op.observed_index is not None
    return list(reversed(ops))
