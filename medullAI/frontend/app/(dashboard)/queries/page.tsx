"use client";

import { useState, useEffect, useCallback } from "react";

interface DmQuery {
  query_id: string;
  subject_id: string;
  field_id: string;
  visit_id: string | null;
  form_id: string | null;
  reason_code: string;
  description: string;
  raised_by: string;
  status: "open" | "answered" | "closed" | "void";
  created_at: number;
  updated_at: number;
  answer: string | null;
  answered_by: string | null;
  closed_at: number | null;
}

const STATUS_COLOR: Record<DmQuery["status"], string> = {
  open: "var(--warning)",
  answered: "var(--success)",
  closed: "var(--text-secondary)",
  void: "var(--danger)",
};

const REASON_CODES = [
  "MISSING_VALUE",
  "INCONSISTENT_VALUE",
  "OUT_OF_RANGE",
  "PROTOCOL_DEVIATION",
  "DATA_ENTRY_ERROR",
  "ILLEGIBLE",
  "UNVERIFIABLE",
  "OTHER",
];

export default function QueriesPage() {
  const [queries, setQueries] = useState<DmQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selected, setSelected] = useState<DmQuery | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueries = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/queries${qs}`);
      const data = await res.json();
      setQueries(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load queries");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadQueries(); }, [loadQueries]);

  async function handleAction(queryId: string, action: "answer" | "close" | "void") {
    setSubmitting(true);
    try {
      const body = action === "answer" ? JSON.stringify({ answer: answerText, answered_by: "dm_reviewer" }) : undefined;
      const res = await fetch(`/api/queries/${queryId}?action=${action}`, {
        method: "POST",
        ...(body ? { headers: { "content-type": "application/json" }, body } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAnswerText("");
      setSelected(null);
      await loadQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Query Workflow
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Data clarification queries raised against subject records — linked to field, visit, and form.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--background)" }}
        >
          + Raise Query
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["open", "answered", "closed", "void", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: statusFilter === s ? "var(--accent-dim)" : "var(--surface)",
              color: statusFilter === s ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${statusFilter === s ? "var(--accent-border)" : "var(--border)"}`,
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Query list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
        </div>
      ) : queries.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center text-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          No {statusFilter !== "all" ? statusFilter : ""} queries found.
        </div>
      ) : (
        <div className="space-y-2">
          {queries.map((q) => (
            <button
              key={q.query_id}
              onClick={() => setSelected(selected?.query_id === q.query_id ? null : q)}
              className="w-full text-left rounded-xl p-4 transition-all"
              style={{
                background: "var(--surface)",
                border: `1px solid ${selected?.query_id === q.query_id ? "var(--accent-border)" : "var(--border)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: `${STATUS_COLOR[q.status]}20`, color: STATUS_COLOR[q.status] }}
                    >
                      {q.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {q.subject_id}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>·</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{q.field_id}</span>
                    {q.visit_id && (
                      <>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>·</span>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{q.visit_id}</span>
                      </>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      {q.reason_code}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{q.description}</p>
                  {q.answer && (
                    <p className="text-xs mt-1" style={{ color: "var(--success)" }}>
                      Answer: {q.answer}
                    </p>
                  )}
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-secondary)" }}>
                  {new Date(q.created_at * 1000).toLocaleDateString()}
                </span>
              </div>

              {/* Expanded actions */}
              {selected?.query_id === q.query_id && q.status === "open" && (
                <div
                  className="mt-3 pt-3 space-y-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Enter answer / clarification…"
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!answerText.trim() || submitting}
                      onClick={() => handleAction(q.query_id, "answer")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ background: "var(--success)", color: "var(--background)" }}
                    >
                      Answer
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => handleAction(q.query_id, "close")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      Close
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => handleAction(q.query_id, "void")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" }}
                    >
                      Void
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create query modal */}
      {showCreate && (
        <CreateQueryModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadQueries(); }}
        />
      )}
    </div>
  );
}

function CreateQueryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    subject_id: "",
    field_id: "",
    visit_id: "",
    form_id: "",
    reason_code: "MISSING_VALUE",
    description: "",
    raised_by: "dm_reviewer",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    if (!form.subject_id || !form.field_id || !form.description) {
      setErr("Subject ID, field ID, and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        visit_id: form.visit_id || null,
        form_id: form.form_id || null,
      };
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create query");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="rounded-2xl p-6 w-full max-w-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Raise Data Query</h2>
          <button onClick={onClose} className="text-xs" style={{ color: "var(--text-secondary)" }}>✕</button>
        </div>

        {err && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{err}</p>}

        <div className="space-y-3">
          {[
            { label: "Subject ID *", key: "subject_id", placeholder: "e.g. SUBJ-001" },
            { label: "Field ID *", key: "field_id", placeholder: "e.g. lab.hemoglobin" },
            { label: "Visit ID", key: "visit_id", placeholder: "e.g. SCREEN" },
            { label: "Form ID", key: "form_id", placeholder: "e.g. LB" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
              <input
                value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Reason Code *</label>
            <select
              value={form.reason_code}
              onChange={(e) => set("reason_code", e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {REASON_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Describe the discrepancy…"
              className="w-full rounded-lg px-3 py-2 text-xs resize-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--background)" }}
          >
            {submitting ? "Raising…" : "Raise Query"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
