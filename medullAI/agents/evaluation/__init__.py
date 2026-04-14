"""
Evaluation framework for TrialBridge.

Provides:
- Benchmark evaluation with ground truth
- False positive/negative rate measurement
- Precision, recall, specificity, F1-score metrics
- Confidence calibration analysis
"""
from __future__ import annotations

from .benchmark import (
    BenchmarkResult,
    GroundTruthCase,
    evaluate_case,
    load_ground_truth,
    print_benchmark_report,
    run_benchmark,
)
from schemas import EvaluationMetrics

__all__ = [
    "BenchmarkResult",
    "GroundTruthCase",
    "EvaluationMetrics",
    "evaluate_case",
    "load_ground_truth",
    "print_benchmark_report",
    "run_benchmark",
]
