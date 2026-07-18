// ═══════════════════════════════════════════════════════════════════════════
// Verification panel — AI DoD (plans/ai-dod-plan.md Phase 5.1).
// "The citation is the product": every `met` requirement expands to the
// citations that earned it, each one a deep link to the exact lines on
// GitHub. Nothing here reports a percentage — PRD_v2.md §5.4 is explicit
// that a completion score is a fabricated number; the only honest unit is
// "N of M requirements evidenced."
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, stagger, fadeUp } from "../../motion/tokens";
import { Label, Button, EmptyState, InlineError } from "./primitive.jsx";
import taskService from "../../services/task.service.js";

const STATUS_META = {
  none: { color: "var(--text-dim)", label: "Not yet evaluated" },
  pending: { color: "var(--text-dim)", label: "Verifying…" },
  blocked: { color: "var(--brass)", label: "Blocked" },
  clear: { color: "var(--signal)", label: "Clear" },
};

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : "unknown";
}

function citationUrl(repoFullName, sha, citation) {
  if (!repoFullName || !sha || !citation?.path) return null;
  const lines =
    citation.endLine && citation.endLine !== citation.startLine
      ? `L${citation.startLine}-L${citation.endLine}`
      : `L${citation.startLine ?? 1}`;
  return `https://github.com/${repoFullName}/blob/${sha}/${citation.path}#${lines}`;
}

// ── requirement row (met/unmet/unverified + citations) ────────────────────────
function RequirementRow({ requirement, finding, repoFullName, headSha, index }) {
  const [expanded, setExpanded] = useState(false);
  const status = finding?.status ?? "unverified";
  const dotColor =
    status === "met" ? "var(--signal)" : status === "unmet" ? "var(--danger)" : "var(--text-dim)";
  const canExpand = status === "met" && finding?.citations?.length > 0;

  return (
    <motion.div variants={fadeUp} style={V.reqRow}>
      <button
        type="button"
        onClick={() => canExpand && setExpanded((e) => !e)}
        aria-expanded={canExpand ? expanded : undefined}
        style={{ ...V.reqButton, cursor: canExpand ? "pointer" : "default" }}
      >
        <span style={{ ...V.reqDot, background: dotColor }} />
        <span
          style={{
            flex: 1,
            fontSize: "0.83rem",
            color: requirement.active ? "var(--text)" : "var(--text-dim)",
            textDecoration: requirement.active ? "none" : "line-through",
            lineHeight: 1.5,
          }}
        >
          {requirement.text}
        </span>
        {canExpand && (
          <span style={V.citeCount}>
            {finding.citations.length} cite{finding.citations.length > 1 ? "s" : ""}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <ul
              role="list"
              aria-label={`Citations for requirement ${index + 1}`}
              style={V.citeList}
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const items = Array.from(e.currentTarget.querySelectorAll("a,button,span[tabindex]"));
                const i = items.indexOf(document.activeElement);
                const next = e.key === "ArrowDown" ? i + 1 : i - 1;
                items[(next + items.length) % items.length]?.focus();
              }}
            >
              {finding.citations.map((c, i) => {
                const url = citationUrl(repoFullName, headSha, c);
                const label = `${c.path}${c.startLine ? `:${c.startLine}${c.endLine && c.endLine !== c.startLine ? `-${c.endLine}` : ""}` : ""}`;
                return (
                  <li key={i} role="listitem">
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" style={V.citeLink}>
                        <span style={V.citePath}>{label}</span>
                        {!c.verified && <span style={V.citeUnverified}>unverified</span>}
                      </a>
                    ) : (
                      <span tabIndex={0} style={{ ...V.citeLink, cursor: "default" }}>
                        <span style={V.citePath}>{label}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "unmet" && finding?.rationale && (
        <p style={V.rationale}>{finding.rationale}</p>
      )}
    </motion.div>
  );
}

// ── one history row ────────────────────────────────────────────────────────────
function HistoryRow({ log }) {
  const meta = STATUS_META[log.status === "COMPLETED" ? (log.evaluation === "APPROVED" ? "clear" : "blocked") : "none"];
  return (
    <div style={V.historyRow}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: log.status === "PASSED_BY_SYSTEM_ERROR" ? "var(--text-dim)" : meta.color,
          flexShrink: 0,
        }}
      />
      <span style={V.historyMeta}>
        {log.requirementsMet}/{log.requirementsTotal} · {shortSha(log.headSha)} · {log.trigger}
      </span>
      <span style={V.historyDate}>
        {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ""}
      </span>
    </div>
  );
}

// ── requirements editor (project admins) ───────────────────────────────────────
function RequirementsEditor({ projectId, taskId, requirements, onSaved }) {
  const [draft, setDraft] = useState(requirements);
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setDraft(requirements), [requirements]);

  const dirty =
    draft.length !== requirements.length ||
    draft.some((r, i) => r.text !== requirements[i]?.text || r.active !== requirements[i]?.active);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { task } = await taskService.updateRequirements(projectId, taskId, {
        requirements: draft.map((r) => ({ _id: r._id, text: r.text, active: r.active })),
      });
      onSaved(task);
    } catch (e) {
      setError(e?.response?.data?.message || "Couldn't save requirements");
    } finally {
      setSaving(false);
    }
  };

  const addRequirement = () => {
    const text = adding.trim();
    if (!text) return;
    setDraft((d) => [...d, { text, active: true }]);
    setAdding("");
  };

  return (
    <div className="requirements-editor" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {draft.map((r, i) => (
        <div key={r._id ?? `new-${i}`} style={V.editRow}>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => d.map((x, xi) => (xi === i ? { ...x, active: !x.active } : x)))
            }
            aria-label={r.active ? "Deactivate requirement" : "Activate requirement"}
            style={{ ...V.editCheck, borderColor: r.active ? "var(--signal)" : "var(--border-hi)", background: r.active ? "var(--signal-soft)" : "transparent" }}
          >
            {r.active && <span style={{ color: "var(--signal)", fontSize: 10 }}>✓</span>}
          </button>
          <textarea
            value={r.text}
            onChange={(e) =>
              setDraft((d) => d.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)))
            }
            className="input-field"
            rows={1}
            style={{
              resize: "none",
              flex: 1,
              fontSize: "0.8rem",
              opacity: r.active ? 1 : 0.5,
              textDecoration: r.active ? "none" : "line-through",
            }}
          />
        </div>
      ))}

      <div style={V.editRow}>
        <span style={{ ...V.editCheck, borderStyle: "dashed", flexShrink: 0 }} />
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRequirement();
            }
          }}
          placeholder="Add a requirement…"
          className="input-field"
          style={{ flex: 1, fontSize: "0.8rem" }}
          maxLength={500}
        />
      </div>

      <InlineError message={error} />

      {dirty && (
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            onClick={save}
            disabled={saving || draft.every((r) => !r.text.trim())}
            style={{ fontSize: "0.76rem", padding: "6px 12px" }}
          >
            {saving ? "Saving…" : "Save requirements"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDraft(requirements)}
            disabled={saving}
            style={{ fontSize: "0.76rem", padding: "6px 12px" }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── main panel ─────────────────────────────────────────────────────────────────
export default function VerificationPanel({ task, projectId, repoFullName, canManage }) {
  const [logs, setLogs] = useState(null); // null = loading
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [editingRequirements, setEditingRequirements] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => setLocalTask(task), [task]);

  const loadLatest = useCallback(async () => {
    try {
      const res = await taskService.getAiLogs(projectId, localTask._id, { limit: 1 });
      setLogs(res.logs ?? []);
    } catch {
      setLogs([]);
    }
  }, [projectId, localTask._id]);

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTask._id, localTask.aiLockStatus, localTask.evaluationSeq]);

  const loadHistory = async (page) => {
    const res = await taskService.getAiLogs(projectId, localTask._id, { page, limit: 10 });
    setHistoryLogs((prev) => (page === 1 ? res.logs : [...prev, ...res.logs]));
    setHistoryHasMore(res.hasMore);
    setHistoryPage(page);
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && historyLogs.length === 0) loadHistory(1);
  };

  const handleVerifyNow = async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      await taskService.requestAiEvaluate(projectId, localTask._id, {
        branch: localTask.githubBranch || undefined,
      });
      setLocalTask((t) => ({ ...t, aiLockStatus: "pending" }));
    } catch (e) {
      setVerifyError(
        e?.response?.status === 429
          ? "Already verifying — try again in a minute."
          : e?.response?.data?.message || "Couldn't start verification",
      );
    } finally {
      setVerifying(false);
    }
  };

  const activeRequirements = (localTask.requirements ?? []).filter((r) => r.active);
  const hasAnyRequirements = (localTask.requirements ?? []).length > 0;
  const latest = logs?.[0] ?? null;
  const findingsByReqId = new Map((latest?.findings ?? []).map((f) => [String(f.requirementId), f]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Label>Verification</Label>
        {canManage && !editingRequirements && hasAnyRequirements && (
          <button onClick={() => setEditingRequirements(true)} style={V.linkBtn}>
            Edit requirements
          </button>
        )}
      </div>

      {/* Not yet evaluated — no requirements exist yet */}
      {!hasAnyRequirements && !editingRequirements && (
        <EmptyState
          title="Not yet evaluated"
          description={
            canManage
              ? "Requirements generate on the first push, or click Verify now."
              : "Requirements generate on the first push to this task's branch."
          }
          action={
            canManage && (
              <Button
                variant="primary"
                onClick={handleVerifyNow}
                disabled={verifying}
                style={{ fontSize: "0.76rem", padding: "6px 12px" }}
              >
                {verifying ? "Starting…" : "Verify now"}
              </Button>
            )
          }
        />
      )}

      {editingRequirements && (
        <RequirementsEditor
          projectId={projectId}
          taskId={localTask._id}
          requirements={localTask.requirements ?? []}
          onSaved={(updatedTask) => {
            setLocalTask(updatedTask);
            setEditingRequirements(false);
          }}
        />
      )}

      {hasAnyRequirements && !editingRequirements && (
        <>
          {/* Header count — never a percentage */}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.76rem", color: STATUS_META[localTask.aiLockStatus]?.color ?? "var(--text-dim)" }}>
            {activeRequirements.length > 0
              ? `${latest?.requirementsMet ?? 0} of ${activeRequirements.length} requirements evidenced`
              : "No active requirements"}
            {localTask.aiLockStatus === "pending" && " — verifying…"}
          </div>

          {/* Requirement list */}
          <motion.div variants={stagger(0.04)} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column" }}>
            {(localTask.requirements ?? []).map((r, i) => (
              <RequirementRow
                key={r._id ?? i}
                index={i}
                requirement={r}
                finding={findingsByReqId.get(String(r._id))}
                repoFullName={repoFullName}
                headSha={latest?.headSha}
              />
            ))}
          </motion.div>

          {/* Critique + honest system-error messaging */}
          {latest?.status === "PASSED_BY_SYSTEM_ERROR" && (
            <InlineError
              message={`Couldn't verify: the AI provider ${latest.errorCode === "GITHUB_UNAVAILABLE" ? "or GitHub" : ""} timed out. Not blocking.`}
            />
          )}
          {latest?.critique && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", lineHeight: 1.6 }}>{latest.critique}</p>
          )}

          {canManage && (
            <div>
              <Button
                variant="ghost"
                onClick={handleVerifyNow}
                disabled={verifying || localTask.aiLockStatus === "pending"}
                style={{ fontSize: "0.76rem", padding: "6px 12px" }}
              >
                {verifying ? "Starting…" : "Verify now"}
              </Button>
              <InlineError message={verifyError} />
            </div>
          )}

          {/* Collapsed run metadata */}
          {latest && (
            <div style={V.metaRow}>
              {shortSha(latest.headSha)} · {latest.model} · {(latest.durationMs / 1000).toFixed(1)}s · {latest.promptVersion}
              {latest.strippedPaths?.length > 0 && ` · ${latest.strippedPaths.length} paths stripped`}
            </div>
          )}
        </>
      )}

      {/* History */}
      <div className="divider" />
      <button onClick={toggleHistory} style={V.linkBtn}>
        {historyOpen ? "Hide history" : "Show history"}
      </button>
      <AnimatePresence initial={false}>
        {historyOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            {historyLogs.length === 0 ? (
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No evaluations yet.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {historyLogs.map((log) => (
                  <HistoryRow key={log._id} log={log} />
                ))}
                {historyHasMore && (
                  <button onClick={() => loadHistory(historyPage + 1)} style={{ ...V.linkBtn, marginTop: 6 }}>
                    Load more
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const V = {
  reqRow: { borderBottom: "1px solid var(--border)", padding: "8px 0" },
  reqButton: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    background: "none",
    border: "none",
    textAlign: "left",
    padding: 0,
  },
  reqDot: { width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  citeCount: { fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-dim)", flexShrink: 0 },
  citeList: { display: "flex", flexDirection: "column", gap: 4, marginLeft: 15, marginTop: 6, listStyle: "none", padding: 0 },
  citeLink: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-mono)",
    fontSize: "0.68rem",
    color: "var(--text-soft)",
    padding: "8px 8px",
    minHeight: 44,
    background: "var(--surface-2)",
    borderRadius: "var(--r-sm)",
    textDecoration: "none",
  },
  citePath: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  citeUnverified: { color: "var(--danger)", flexShrink: 0 },
  rationale: { marginLeft: 15, marginTop: 4, fontSize: "0.76rem", color: "var(--text-dim)", lineHeight: 1.5 },
  metaRow: { fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-dim)", letterSpacing: "0.01em" },
  historyRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  historyMeta: { fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-soft)", flex: 1 },
  historyDate: { fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--text-dim)" },
  linkBtn: {
    background: "none",
    border: "none",
    color: "var(--signal)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.76rem",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  editRow: { display: "flex", alignItems: "flex-start", gap: 8 },
  editCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: "1.5px solid var(--border-hi)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
    background: "none",
    cursor: "pointer",
  },
};
