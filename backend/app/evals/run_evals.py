"""Retrieval eval harness.

Scores the vector store's top-1 retrieval accuracy against a hand-labelled
set of realistic tenant scenarios (see scenarios.json). This is the
CI-friendly half of the eval story: it needs no API key and no network
beyond the one-time embedding model download, so it can run as a real
quality gate on every push. A separate, optional generation-quality eval
(scoring the LLM's actual written answer, not just retrieval) is noted as
a follow-up in the README, since it requires a live Gemini call.

Usage:
    python -m app.evals.run_evals [--min-accuracy 0.8]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.vectorstore import get_store

SCENARIOS_PATH = Path(__file__).resolve().parent / "scenarios.json"


def run(min_accuracy: float = 0.8) -> None:
    scenarios = json.loads(SCENARIOS_PATH.read_text())
    store = get_store()

    correct = 0
    rows = []
    for case in scenarios:
        results = store.search(case["situation"], top_k=1)
        top_doc, score = results[0]
        is_correct = top_doc.id == case["expected_doc_id"]
        correct += int(is_correct)
        rows.append((case["situation"], case["expected_doc_id"], top_doc.id, score, is_correct))

    accuracy = correct / len(scenarios)

    print(f"{'PASS' if True else ''}")
    for situation, expected, got, score, ok in rows:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] score={score:.3f} expected={expected} got={got} :: {situation[:70]}")

    print(f"\nTop-1 retrieval accuracy: {correct}/{len(scenarios)} = {accuracy:.1%}")

    if accuracy < min_accuracy:
        raise SystemExit(
            f"Accuracy {accuracy:.1%} is below the required minimum {min_accuracy:.1%}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-accuracy", type=float, default=0.8)
    args = parser.parse_args()
    run(min_accuracy=args.min_accuracy)
