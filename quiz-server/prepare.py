"""把 v1 的测试数据加工成数据版的种子：calibrate + rarity 与 model.py 同算法。

用法：python prepare.py
"""
from __future__ import annotations

import itertools
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
V1 = HERE.parent / "quiz_factory"
OUT = HERE / "data"

RESULT_KEYS = ["".join(bits) for bits in itertools.product("01", repeat=3)]


def all_scores(quiz: dict) -> list[tuple[dict, dict]]:
    axes = [a["key"] for a in quiz["axes"]]
    qs = quiz["questions"]
    out = []
    for combo in itertools.product(range(3), repeat=len(qs)):
        scores = {k: 0 for k in axes}
        last_delta = {k: 0 for k in axes}
        for q, choice in zip(qs, combo):
            for k, v in (q["options"][choice].get("scores") or {}).items():
                if k in scores:
                    v = int(v)
                    scores[k] += v
                    if v:
                        last_delta[k] = v
        out.append((scores, last_delta))
    return out


def calibrate(quiz: dict) -> dict:
    """与 model.calibrate 同算法：每条轴找"最接近对半分"的阈值。"""
    combos = all_scores(quiz)
    total = len(combos)
    thresholds = {}
    for axis in [a["key"] for a in quiz["axes"]]:
        values = sorted({s[axis] for s, _ in combos})
        candidates = values + [values[0] - 1, values[-1]]
        best, best_gap = 0, total + 1
        for t in candidates:
            ones = sum(
                1 for s, ld in combos
                if s[axis] > t or (s[axis] == t and ld[axis] > 0)
            )
            gap = abs(ones - total / 2)
            if gap < best_gap:
                best, best_gap = t, gap
        thresholds[axis] = best
    quiz["thresholds"] = thresholds
    return quiz


def rarity(quiz: dict) -> dict:
    combos = all_scores(quiz)
    total = len(combos)
    thresholds = quiz.get("thresholds") or {}
    hits = {k: 0 for k in RESULT_KEYS if k in quiz["results"]}
    for scores, last_delta in combos:
        key = "".join(
            "1" if (scores[a] > thresholds.get(a, -0.5)
                    or (scores[a] == thresholds.get(a, -0.5) and last_delta[a] > 0))
            else "0"
            for a in (ax["key"] for ax in quiz["axes"])
        )
        if key in hits:
            hits[key] += 1
    return {k: round(v / total * 100, 1) for k, v in hits.items()}


def main() -> int:
    OUT.mkdir(exist_ok=True)
    sources = sorted((V1 / "presets").glob("*.json")) + sorted(
        p for p in (V1 / "quizzes").glob("*.json") if not p.stem.endswith(".report")
    )
    count = 0
    for path in sources:
        quiz = json.loads(path.read_text(encoding="utf-8"))
        if "questions" not in quiz or "axes" not in quiz:
            continue
        calibrate(quiz)
        quiz["rarity"] = rarity(quiz)
        target = OUT / f"{quiz['slug']}.json"
        target.write_text(json.dumps(quiz, ensure_ascii=False, indent=2), encoding="utf-8")
        spread = f"{min(quiz['rarity'].values())}%-{max(quiz['rarity'].values())}%"
        print(f"  ✓ {quiz['slug']:14s} {quiz['title']}（分布 {spread}）")
        count += 1
    print(f"✓ {count} 个测试已种子化 → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
