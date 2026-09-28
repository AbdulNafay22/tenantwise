"""Wires the retrieval eval into the normal pytest run as a quality gate.

If this test fails, it means a corpus or embedding change regressed
retrieval accuracy on the labelled scenario set -- exactly the kind of
signal that's supposed to show up in CI, not get discovered after deploy.
"""

from app.evals.run_evals import run


def test_retrieval_accuracy_meets_minimum_bar():
    run(min_accuracy=0.8)
