import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authcontext.jsx";
import organizationService from "../../services/organization.service.js";

// ── constants ──────────────────────────────────────────────────────────────
const ASSIGNABLE_ROLES = ["member", "admin"]; // owner is never assignable here
const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

const ROLE_CFG = {
  owner: { label: "OWNER", color: "var(--amber, #f0a500)" },
  admin: { label: "ORG ADMIN", color: "var(--ice, #4db8ff)" },
  member: { label: "MEMBER", color: "var(--muted)" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return (
    <span style={{ ...S.badge, color: cfg.color, borderColor: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function Avatar({ name, email, dim }) {
  const letter = (name || email || "?")[0].toUpperCase();
  return <div style={{ ...S.avatar, opacity: dim ? 0.4 : 1 }}>{letter}</div>;
}

// ── main component ─────────────────────────────────────────────────────────
export default function OrgMembersPanel() {
  const { user, isOrgOwner, isOrgManager } = useAuth();
  const myRank = ROLE_RANK[user?.role] ?? 0;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ msg: "", ok: true });

  const [editRole, setEditRole] = useState({}); // { [userId]: newRole }
  const [saving, setSaving] = useState({});
  const [busy, setBusy] = useState({}); // deactivate in-flight

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await organizationService.listMembers();
      setMembers(data?.members ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const flash = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3000);
  };

  const handleSaveRole = async (userId) => {
    const newRole = editRole[userId];
    if (!newRole) return;
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      await organizationService.updateMemberRole(userId, { role: newRole });
      flash(`✓ Role updated to ${newRole}`);
      setEditRole((e) => {
        const n = { ...e };
        delete n[userId];
        return n;
      });
      await fetchMembers();
    } catch (e) {
      flash(`✗ ${e?.response?.data?.message || "Failed to update role."}`, false);
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  };

  const handleDeactivate = async (userId, name) => {
    if (!window.confirm(`Deactivate ${name}? They will be logged out and unable to sign in.`))
      return;
    setBusy((b) => ({ ...b, [userId]: true }));
    try {
      await organizationService.deactivateMember(userId);
      flash(`✓ ${name} deactivated`);
      await fetchMembers();
    } catch (e) {
      flash(`✗ ${e?.response?.data?.message || "Failed to deactivate."}`, false);
    } finally {
      setBusy((b) => ({ ...b, [userId]: false }));
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.sectionLabel}>
        <span>MEMBERS {!loading && `(${members.length})`}</span>
        <div style={S.rule} />
      </div>

      {loading && (
        <div style={S.center}>
          <span style={S.loadingText}>LOADING...</span>
        </div>
      )}

      {error && (
        <div style={S.center}>
          <span style={{ color: "var(--red, #e05050)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
            ✗ {error}
          </span>
          <button style={S.retryBtn} onClick={fetchMembers}>
            ↻ RETRY
          </button>
        </div>
      )}

      {!loading && !error && (
        <AnimatePresence>
          {members.length === 0 ? (
            <div style={S.empty}>
              <span style={{ fontSize: 24, opacity: 0.3 }}>◈</span>
              <span>NO MEMBERS FOUND</span>
            </div>
          ) : (
            members.map((m, i) => {
              const uid = m._id;
              const name = m.fullName || m.username || "";
              const email = m.email || "";
              const isMe = uid === user?._id;
              const isDeactivated = m.status === "deactivated";
              const targetRank = ROLE_RANK[m.role] ?? 0;

              // owner may change roles of non-owner, non-self, active members
              const canEditRole =
                isOrgOwner && !isMe && m.role !== "owner" && !isDeactivated;
              // owner/admin may deactivate active members strictly below their rank
              const canDeactivate =
                isOrgManager && !isMe && !isDeactivated && myRank > targetRank;

              const pending = editRole[uid];
              const changed = pending && pending !== m.role;

              return (
                <motion.div
                  key={uid}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18, delay: i * 0.04 }}
                  style={{ ...S.memberRow, opacity: isDeactivated ? 0.55 : 1 }}
                >
                  <Avatar name={name} email={email} dim={isDeactivated} />

                  <div style={S.memberInfo}>
                    <span style={S.memberName}>
                      {(name || email).toUpperCase()}
                      {isMe && <span style={S.youTag}> (YOU)</span>}
                    </span>
                    <span style={S.memberEmail}>{email}</span>
                  </div>

                  {isDeactivated && (
                    <span style={{ ...S.badge, color: "var(--muted)", borderColor: "var(--border)" }}>
                      DEACTIVATED
                    </span>
                  )}

                  {!isDeactivated &&
                    (canEditRole ? (
                      <select
                        style={S.roleSelect}
                        value={pending ?? m.role}
                        onChange={(e) =>
                          setEditRole((prev) => ({ ...prev, [uid]: e.target.value }))
                        }
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    ))}

                  {canEditRole && changed && (
                    <button
                      style={{ ...S.btnSave, opacity: saving[uid] ? 0.6 : 1 }}
                      onClick={() => handleSaveRole(uid)}
                      disabled={saving[uid]}
                    >
                      {saving[uid] ? "..." : "SAVE"}
                    </button>
                  )}

                  {canDeactivate && (
                    <button
                      style={{ ...S.btnRemove, opacity: busy[uid] ? 0.5 : 1 }}
                      onClick={() => handleDeactivate(uid, name || email)}
                      disabled={busy[uid]}
                    >
                      {busy[uid] ? "..." : "DEACTIVATE"}
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {toast.msg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              ...S.toast,
              borderLeftColor: toast.ok ? "var(--phosphor)" : "var(--red, #e05050)",
              color: toast.ok ? "var(--phosphor)" : "var(--red, #e05050)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────
const S = {
  wrap: { padding: "20px 4px", position: "relative", maxWidth: 720 },
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
  memberRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  avatar: {
    width: 36,
    height: 36,
    background: "rgba(0,255,65,0.08)",
    border: "1px solid var(--phosphor)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--phosphor)",
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    fontWeight: "bold",
    flexShrink: 0,
  },
  memberInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  memberName: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.1em",
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  youTag: { color: "var(--muted)", fontSize: 8, letterSpacing: "0.1em" },
  badge: {
    fontFamily: "var(--font-mono)",
    fontSize: 7,
    letterSpacing: "0.14em",
    border: "1px solid",
    padding: "2px 7px",
    whiteSpace: "nowrap",
  },
  roleSelect: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "4px 8px",
    cursor: "pointer",
    outline: "none",
    letterSpacing: "0.06em",
  },
  btnSave: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: "0.14em",
    background: "transparent",
    color: "var(--phosphor)",
    border: "1px solid var(--phosphor)",
    padding: "4px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnRemove: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: "0.14em",
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    padding: "4px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "32px 0" },
  loadingText: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: 2 },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "48px 20px",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.2em",
  },
  retryBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    padding: "6px 14px",
    cursor: "pointer",
  },
  toast: {
    position: "fixed",
    bottom: 28,
    right: 28,
    background: "var(--surface)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.06em",
    padding: "10px 18px",
    border: "1px solid",
    borderLeft: "3px solid",
    zIndex: 999,
    pointerEvents: "none",
  },
};
