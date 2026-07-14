import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Users, Mail, Trash2, Send, Upload, Download } from "lucide-react";
import { useAuth } from "../../context/authcontext.jsx";
import organizationService from "../../services/organization.service.js";
import inviteService from "../../services/invite.service.js";
import OrgMembersPanel from "../../components/ui/OrgMembersPanel.jsx";
import { InlineError, InlineSuccess, Spinner } from "../../components/ui/primitive.jsx";

const TABS = [
  { id: "settings", label: "SETTINGS", icon: Building2 },
  { id: "members", label: "MEMBERS", icon: Users },
  { id: "invites", label: "INVITES", icon: Mail },
];

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ org, onOrgUpdated }) {
  const { isOrgOwner, isOrgManager, logout } = useAuth();
  const [name, setName] = useState(org?.name || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ ok: "", err: "" });

  const [confirmText, setConfirmText] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => setName(org?.name || ""), [org]);

  const handleSave = async () => {
    setMsg({ ok: "", err: "" });
    if (name.trim().length < 2) {
      setMsg({ ok: "", err: "Name must be at least 2 characters." });
      return;
    }
    setSaving(true);
    try {
      const data = await organizationService.updateOrg({ name: name.trim() });
      onOrgUpdated(data?.organization);
      setMsg({ ok: "Organization updated.", err: "" });
    } catch (e) {
      setMsg({ ok: "", err: e?.response?.data?.message || "Failed to update." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteErr("");
    setDeleting(true);
    try {
      await organizationService.deleteOrg(confirmPassword);
      // Org + owner account are gone; drop the client session.
      await logout();
    } catch (e) {
      setDeleteErr(e?.response?.data?.message || "Failed to delete organization.");
      setConfirmPassword("");
      setDeleting(false);
    }
  };

  const canDelete =
    confirmText === org?.name && confirmPassword.length > 0 && !deleting;

  return (
    <div style={{ maxWidth: 560, padding: "20px 4px" }}>
      {/* Rename */}
      <div style={S.sectionLabel}>
        <span>WORKSPACE NAME</span>
        <div style={S.rule} />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 32 }}>
        <input
          style={S.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isOrgManager || saving}
          maxLength={100}
        />
        {isOrgManager && (
          <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "SAVING..." : "SAVE"}
          </button>
        )}
      </div>
      {msg.ok && <div style={{ marginBottom: 20 }}><InlineSuccess message={msg.ok} /></div>}
      {msg.err && <div style={{ marginBottom: 20 }}><InlineError message={msg.err} /></div>}

      {/* Billing placeholder */}
      <div style={S.sectionLabel}>
        <span>PLAN &amp; BILLING</span>
        <div style={S.rule} />
      </div>
      <div style={S.placeholderCard}>
        <span style={{ color: "var(--phosphor)", fontSize: 11, letterSpacing: "0.1em" }}>
          FREE PLAN
        </span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>
          Billing &amp; upgrades — coming soon.
        </span>
      </div>

      {/* Danger zone — owner only */}
      {isOrgOwner && (
        <>
          <div style={{ ...S.sectionLabel, color: "var(--red, #e05050)", marginTop: 34 }}>
            <span>DANGER ZONE</span>
            <div style={{ ...S.rule, background: "rgba(224,80,80,0.3)" }} />
          </div>
          <div style={S.dangerCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Trash2 size={13} color="var(--red, #e05050)" />
              <span style={{ color: "var(--red, #e05050)", fontSize: 11, letterSpacing: "0.08em", fontWeight: 700 }}>
                DELETE ORGANIZATION
              </span>
            </div>
            <p style={S.dangerText}>
              This permanently deletes the workspace and your account, and logs you out.
              You must remove all other members and delete all projects first. Type{" "}
              <strong style={{ color: "var(--text)" }}>{org?.name}</strong> and enter your
              password to confirm.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <input
                style={S.input}
                placeholder={org?.name}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  style={S.input}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={deleting}
                />
                <button
                  style={{
                    ...S.btnDanger,
                    opacity: canDelete ? 1 : 0.4,
                    cursor: canDelete ? "pointer" : "not-allowed",
                  }}
                  onClick={handleDelete}
                  disabled={!canDelete}
                >
                  {deleting ? "DELETING..." : "DELETE"}
                </button>
              </div>
            </div>
            {deleteErr && <div style={{ marginTop: 12 }}><InlineError message={deleteErr} /></div>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── INVITES TAB ──────────────────────────────────────────────────────────────
function InvitesTab() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState({});

  // Bulk upload state
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkResult, setBulkResult] = useState(null);

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await inviteService.list();
      setInvites(data?.invites ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load invites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleSend = async () => {
    setSendMsg({ ok: "", err: "" });
    if (!/\S+@\S+\.\S+/.test(email)) {
      setSendMsg({ ok: "", err: "Enter a valid email." });
      return;
    }
    setSending(true);
    try {
      await inviteService.create({ email: email.trim(), role });
      setEmail("");
      setRole("member");
      setSendMsg({ ok: `Invitation sent to ${email.trim()}.`, err: "" });
      await fetchInvites();
    } catch (e) {
      setSendMsg({ ok: "", err: e?.response?.data?.message || "Failed to send invite." });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await inviteService.revoke(id);
      await fetchInvites();
    } catch {
      /* surfaced via reload */
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const handleTemplateDownload = () => {
    const csv = "name,email,role\nJane Doe,jane@example.com,member\nJohn Roe,john@example.com,admin\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invite-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkErr("");
    setBulkResult(null);
    setBulkBusy(true);
    try {
      const data = await inviteService.bulkCreate(bulkFile);
      setBulkResult(data);
      setBulkFile(null);
      await fetchInvites();
    } catch (e) {
      setBulkErr(e?.response?.data?.message || "Bulk upload failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, padding: "20px 4px" }}>
      {/* Send invite */}
      <div style={S.sectionLabel}>
        <span>SEND INVITE</span>
        <div style={S.rule} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end", marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={S.fieldLabel}>EMAIL</label>
          <input
            style={S.input}
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={S.fieldLabel}>ROLE</label>
          <select style={S.select} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button style={{ ...S.btnPrimary, display: "flex", alignItems: "center", gap: 6 }} onClick={handleSend} disabled={sending}>
          <Send size={12} /> {sending ? "SENDING..." : "SEND"}
        </button>
      </div>
      {sendMsg.ok && <div style={{ marginTop: 10 }}><InlineSuccess message={sendMsg.ok} /></div>}
      {sendMsg.err && <div style={{ marginTop: 10 }}><InlineError message={sendMsg.err} /></div>}

      {/* Bulk invite */}
      <div style={{ ...S.sectionLabel, marginTop: 32 }}>
        <span>BULK INVITE (EXCEL / CSV)</span>
        <div style={S.rule} />
      </div>
      <p style={{ ...S.dangerText, marginBottom: 12 }}>
        Upload a sheet with <strong style={{ color: "var(--text)" }}>name</strong>,{" "}
        <strong style={{ color: "var(--text)" }}>email</strong>, and{" "}
        <strong style={{ color: "var(--text)" }}>role</strong> columns (max 200 rows).
        Everyone valid gets an invitation email.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Upload size={12} />
          {bulkFile ? bulkFile.name : "CHOOSE FILE"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              setBulkFile(e.target.files?.[0] || null);
              setBulkResult(null);
              setBulkErr("");
            }}
          />
        </label>
        <button
          style={{ ...S.btnPrimary, display: "flex", alignItems: "center", gap: 6, opacity: bulkFile && !bulkBusy ? 1 : 0.4, cursor: bulkFile && !bulkBusy ? "pointer" : "not-allowed" }}
          onClick={handleBulkUpload}
          disabled={!bulkFile || bulkBusy}
        >
          {bulkBusy ? "UPLOADING..." : "UPLOAD & INVITE"}
        </button>
        <button style={{ ...S.btnGhost, display: "flex", alignItems: "center", gap: 6 }} onClick={handleTemplateDownload}>
          <Download size={12} /> TEMPLATE
        </button>
      </div>
      {bulkErr && <div style={{ marginTop: 10 }}><InlineError message={bulkErr} /></div>}

      {bulkResult && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={S.statChip}><b style={{ color: "var(--phosphor)" }}>{bulkResult.summary.sent}</b> SENT</span>
            <span style={S.statChip}><b>{bulkResult.summary.skipped}</b> SKIPPED</span>
            <span style={S.statChip}><b style={{ color: "var(--red, #e05050)" }}>{bulkResult.summary.failed}</b> FAILED</span>
            {bulkResult.summary.failedEmail > 0 && (
              <span style={S.statChip}><b style={{ color: "var(--red, #e05050)" }}>{bulkResult.summary.failedEmail}</b> EMAIL FAILED</span>
            )}
          </div>
          {[
            ...bulkResult.skipped.map((r) => ({ ...r, kind: "SKIPPED" })),
            ...bulkResult.failed.map((r) => ({ ...r, kind: "FAILED" })),
            ...bulkResult.failedEmail.map((r) => ({ ...r, kind: "EMAIL FAILED" })),
          ].length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>ROW</th>
                    <th style={S.th}>EMAIL</th>
                    <th style={S.th}>STATUS</th>
                    <th style={S.th}>REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...bulkResult.skipped.map((r) => ({ ...r, kind: "SKIPPED" })),
                    ...bulkResult.failed.map((r) => ({ ...r, kind: "FAILED" })),
                    ...bulkResult.failedEmail.map((r) => ({ ...r, kind: "EMAIL FAILED" })),
                  ]
                    .sort((a, b) => a.rowNumber - b.rowNumber)
                    .map((r, i) => (
                      <tr key={`${r.kind}-${r.rowNumber}-${i}`}>
                        <td style={S.td}>{r.rowNumber}</td>
                        <td style={S.td}>{r.email || "—"}</td>
                        <td style={{ ...S.td, color: r.kind === "SKIPPED" ? "var(--muted)" : "var(--red, #e05050)" }}>{r.kind}</td>
                        <td style={S.td}>{r.reason}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pending list */}
      <div style={{ ...S.sectionLabel, marginTop: 32 }}>
        <span>PENDING INVITES {!loading && `(${invites.length})`}</span>
        <div style={S.rule} />
      </div>

      {loading && <div style={S.center}><Spinner size="sm" /></div>}
      {error && <div style={S.center}><span style={{ color: "var(--red, #e05050)", fontFamily: "var(--font-mono)", fontSize: 10 }}>✗ {error}</span></div>}

      {!loading && !error && invites.length === 0 && (
        <div style={S.empty}><span style={{ fontSize: 24, opacity: 0.3 }}>◈</span><span>NO PENDING INVITES</span></div>
      )}

      {!loading && !error && invites.map((inv, i) => (
        <motion.div
          key={inv._id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: i * 0.04 }}
          style={S.inviteRow}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={S.memberName}>{inv.email}</span>
            <span style={S.memberEmail}>
              {(inv.role || "member").toUpperCase()} · invited by{" "}
              {inv.invitedBy?.username || "unknown"}
            </span>
          </div>
          <button
            style={{ ...S.btnRemove, opacity: busy[inv._id] ? 0.5 : 1 }}
            onClick={() => handleRevoke(inv._id)}
            disabled={busy[inv._id]}
          >
            {busy[inv._id] ? "..." : "REVOKE"}
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ─── ORGANIZATION PAGE ────────────────────────────────────────────────────────
export default function OrganizationPage() {
  const [tab, setTab] = useState("settings");
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await organizationService.getMyOrg();
        setOrg(data?.organization ?? null);
      } catch {
        setOrg(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={18} color="var(--phosphor)" />
          <h1 style={S.pageTitle}>{org?.name?.toUpperCase() || "ORGANIZATION"}</h1>
        </div>
        <span style={S.pageSub}>Manage your workspace, members, and invitations</span>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...S.tab, ...(active ? S.tabActive : {}) }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {loading ? (
              <div style={S.center}><Spinner /></div>
            ) : tab === "settings" ? (
              <SettingsTab org={org} onOrgUpdated={(o) => o && setOrg(o)} />
            ) : tab === "members" ? (
              <OrgMembersPanel />
            ) : (
              <InvitesTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 22,
    letterSpacing: "0.04em",
    color: "var(--text-bright, var(--text))",
    margin: 0,
  },
  pageSub: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--ghost)",
    letterSpacing: "0.04em",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid var(--border)",
    marginBottom: 8,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.12em",
    padding: "10px 14px",
    cursor: "pointer",
    marginBottom: -1,
  },
  tabActive: {
    color: "var(--phosphor)",
    borderBottomColor: "var(--phosphor)",
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.16em",
    color: "var(--muted)",
    marginBottom: 14,
  },
  rule: { flex: 1, height: 1, background: "var(--border)" },
  fieldLabel: { fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.14em", color: "var(--muted)" },
  input: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    letterSpacing: "0.04em",
  },
  select: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "9px 12px",
    outline: "none",
    cursor: "pointer",
  },
  btnPrimary: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    background: "var(--phosphor)",
    color: "var(--bg, #0a0a0a)",
    border: "1px solid var(--phosphor)",
    padding: "9px 18px",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  btnDanger: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    background: "var(--red, #e05050)",
    color: "var(--bg, #0a0a0a)",
    border: "1px solid var(--red, #e05050)",
    padding: "9px 18px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  placeholderCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "16px 18px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    fontFamily: "var(--font-mono)",
  },
  dangerCard: {
    padding: "16px 18px",
    border: "1px solid rgba(224,80,80,0.3)",
    background: "rgba(224,80,80,0.04)",
  },
  dangerText: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--muted)",
    lineHeight: 1.7,
    margin: 0,
  },
  inviteRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  memberName: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.06em",
    color: "var(--text)",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  memberEmail: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--muted)",
    letterSpacing: "0.04em",
  },
  btnRemove: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: "0.14em",
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    padding: "5px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnGhost: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "9px 16px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    maxWidth: 240,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statChip: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    color: "var(--muted)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    minWidth: 480,
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: "0.14em",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "6px 10px",
    color: "var(--text)",
    borderBottom: "1px solid var(--border)",
    letterSpacing: "0.03em",
    verticalAlign: "top",
  },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "32px 0" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "40px 20px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.2em",
  },
};
