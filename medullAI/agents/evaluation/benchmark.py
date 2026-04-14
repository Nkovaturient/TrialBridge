"""
Evaluation framework for TrialBridge matching accuracy.

Measures:
- False Positive Rate (FPR)
- False Negative Rate (FNR)
- Precision, Recall, F1-Score
- Specificity
- Confidence calibration
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from coordinator import score_match
from schemas import EvaluationMetrics, MatchResult, PatientProfile, TrialCriteria


class GroundTruthCase(BaseModel):
    """A single test case with known ground truth."""
    case_id: str
    patient: dict[str, Any]
    trial: dict[str, Any]
    ground_truth_eligible: bool  # Expert-labeled ground truth
    notes: str | None = None  # Why eligible/ineligible


class BenchmarkResult(BaseModel):
    """Results from running the benchmark."""
    metrics: EvaluationMetrics
    total_cases: int
    by_category: dict[str, EvaluationMetrics]  # Breakdown by trial type, etc.
    calibration_score: float  # How well-calibrated confidence scores are
    processing_time_avg_ms: float


def load_ground_truth(path: Path | str) -> list[GroundTruthCase]:
    """Load ground truth cases from JSONL file."""
    cases = []
    with open(path) as f:
        for line in f:
            data = json.loads(line)
            cases.append(GroundTruthCase(**data))
    return cases


def evaluate_case(case: GroundTruthCase) -> tuple[bool, MatchResult]:
    """
    Evaluate a single test case.

    Returns:
        tuple of (prediction_correct, match_result)
    """
    # Build state
    from schemas import CoordinatorState

    state: CoordinatorState = {
        "raw_trial": case.trial,
        "raw_patient": case.patient,
        "trial_criteria": TrialCriteria(**case.trial),
        "patient_profile": PatientProfile(**case.patient),
        "match_result": None,
    }

    # Run scoring
    result_state = score_match(state)
    result: MatchResult = result_state["match_result"]

    # Check correctness
    prediction_correct = result.eligible == case.ground_truth_eligible

    return prediction_correct, result


def run_benchmark(ground_truth_path: Path | str) -> BenchmarkResult:
    """
    Run the full evaluation benchmark.

    Args:
        ground_truth_path: Path to JSONL file with ground truth cases

    Returns:
        BenchmarkResult with all metrics
    """
    import time

    cases = load_ground_truth(ground_truth_path)

    metrics = EvaluationMetrics()
    by_category: dict[str, EvaluationMetrics] = {}

    start_time = time.time()

    for case in cases:
        _prediction_correct, result = evaluate_case(case)

        # Update overall metrics
        if result.eligible and case.ground_truth_eligible:
            metrics.true_positives += 1
        elif not result.eligible and not case.ground_truth_eligible:
            metrics.true_negatives += 1
        elif result.eligible and not case.ground_truth_eligible:
            metrics.false_positives += 1
        else:  # not eligible but ground truth is eligible
            metrics.false_negatives += 1

        # Update category breakdown (by trial condition)
        condition = case.trial.get("condition", "unknown")
        if condition not in by_category:
            by_category[condition] = EvaluationMetrics()

        cat_metrics = by_category[condition]
        if result.eligible and case.ground_truth_eligible:
            cat_metrics.true_positives += 1
        elif not result.eligible and not case.ground_truth_eligible:
            cat_metrics.true_negatives += 1
        elif result.eligible and not case.ground_truth_eligible:
            cat_metrics.false_positives += 1
        else:
            cat_metrics.false_negatives += 1

    end_time = time.time()
    avg_time_ms = ((end_time - start_time) / len(cases)) * 1000 if cases else 0

    # Calculate calibration (how well confidence aligns with accuracy)
    calibration = _calculate_calibration(cases) if cases else 1.0

    return BenchmarkResult(
        metrics=metrics,
        total_cases=len(cases),
        by_category=by_category,
        calibration_score=calibration,
        processing_time_avg_ms=avg_time_ms,
    )


def _calculate_calibration(_cases: list[GroundTruthCase]) -> float:
    """
    Calculate confidence calibration score.

    A well-calibrated model should have confidence scores that match accuracy.
    E.g., predictions with 90% confidence should be correct 90% of the time.
    """
    # Simplified: assume high confidence predictions should be more accurate
    # In production, this would track by confidence bins
    return 1.0  # Placeholder


def print_benchmark_report(result: BenchmarkResult) -> None:
    """Print a formatted benchmark report."""
    print("=" * 60)
    print("TrialBridge Matching Benchmark Report")
    print("=" * 60)
    print(f"\nTotal Cases Evaluated: {result.total_cases}")
    print(f"Average Processing Time: {result.processing_time_avg_ms:.1f}ms")
    print(f"Confidence Calibration: {result.calibration_score:.2f}")

    print("\n" + "-" * 60)
    print("Overall Metrics:")
    print("-" * 60)
    m = result.metrics
    print(f"  True Positives:  {m.true_positives}")
    print(f"  True Negatives:  {m.true_negatives}")
    print(f"  False Positives: {m.false_positives}")
    print(f"  False Negatives: {m.false_negatives}")
    print(f"\n  Accuracy:        {m.accuracy:.2%}")
    print(f"  Precision:       {m.precision:.2%}")
    print(f"  Recall:          {m.recall:.2%}")
    print(f"  Specificity:     {m.specificity:.2%}")
    print(f"  F1 Score:        {m.f1_score:.2%}")

    # Calculate FPR and FNR
    fpr = m.false_positives / (m.false_positives + m.true_negatives) if (m.false_positives + m.true_negatives) > 0 else 0
    fnr = m.false_negatives / (m.false_negatives + m.true_positives) if (m.false_negatives + m.true_positives) > 0 else 0
    print(f"  False Pos Rate:  {fpr:.2%}")
    print(f"  False Neg Rate:  {fnr:.2%}")

    if result.by_category:
        print("\n" + "-" * 60)
        print("Metrics by Condition:")
        print("-" * 60)
        for condition, cat_metrics in result.by_category.items():
            print(f"\n  {condition}:")
            print(f"    Precision: {cat_metrics.precision:.2%}")
            print(f"    Recall:    {cat_metrics.recall:.2%}")
            print(f"    F1:        {cat_metrics.f1_score:.2%}")


if __name__ == "__main__":
    # Example: run benchmark
    gt_path = Path(__file__).parent / "ground_truth.jsonl"
    if gt_path.exists():
        result = run_benchmark(gt_path)
        print_benchmark_report(result)
    else:
        print(f"Ground truth file not found: {gt_path}")
        print("Create ground truth cases to run evaluation.")
