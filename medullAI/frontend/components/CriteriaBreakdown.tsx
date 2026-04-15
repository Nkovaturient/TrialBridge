"use client";

import { useState } from "react";

interface CriteriaBreakdownProps {
  aiScored: string[];
  humanReview: string[];
}

export default function CriteriaBreakdown({ aiScored, humanReview }: CriteriaBreakdownProps) {
  const [showAI, setShowAI] = useState(true);
  const [showHuman, setShowHuman] = useState(true);

  if (aiScored.length === 0 && humanReview.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
        Criteria Classification
      </p>

      {aiScored.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowAI(!showAI)}
            className="flex items-center gap-2 text-xs font-medium w-full text-left mb-2"
            style={{ color: "var(--success)" }}
          >
            <span className="text-[10px]">{showAI ? "▼" : "▶"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            AI Scored ({aiScored.length})
          </button>
          {showAI && (
            <ul className="space-y-1.5 ml-6">
              {aiScored.map((criterion, i) => (
                <li key={i} className="text-xs flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--success)" }}>✓</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {humanReview.length > 0 && (
        <div>
          <button
            onClick={() => setShowHuman(!showHuman)}
            className="flex items-center gap-2 text-xs font-medium w-full text-left mb-2"
            style={{ color: "var(--danger)" }}
          >
            <span className="text-[10px]">{showHuman ? "▼" : "▶"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z"/>
            </svg>
            Requires Human Review ({humanReview.length})
          </button>
          {showHuman && (
            <ul className="space-y-1.5 ml-6">
              {humanReview.map((criterion, i) => (
                <li key={i} className="text-xs flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--danger)" }}>⚠</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
