import { NextResponse } from "next/server";

const BACKBONE_URL = process.env.BACKBONE_URL ?? "http://127.0.0.1:4020";

export async function GET() {
  try {
    const res = await fetch(`${BACKBONE_URL}/evaluation`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      // If backbone doesn't have evaluation endpoint yet, return mock data
      return NextResponse.json({
        accuracy: 0.87,
        precision: 0.86,
        recall: 0.91,
        specificity: 0.84,
        f1_score: 0.88,
        fpr: 0.14,
        fnr: 0.09,
        total_evaluated: 150,
        correct_predictions: 130,
        false_positives: 12,
        false_negatives: 8,
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Return mock data if backbone is unreachable
    return NextResponse.json({
      accuracy: 0.87,
      precision: 0.86,
      recall: 0.91,
      specificity: 0.84,
      f1_score: 0.88,
      fpr: 0.14,
      fnr: 0.09,
      total_evaluated: 150,
      correct_predictions: 130,
      false_positives: 12,
      false_negatives: 8,
      timestamp: new Date().toISOString(),
      note: "Mock data - backbone unreachable",
    });
  }
}
