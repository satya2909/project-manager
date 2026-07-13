import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/authcontext.jsx";
import projectService from "../../services/project.service.js";
import organizationService from "../../services/organization.service.js";

// ── constants ──────────────────────────────────────────────────────────────
const ASSIGNABLE_ROLES = ["member", "project_admin"];

const ROLE_CFG = {
  admin: { label: "ADMIN", color: "var(--phosphor)" },
  project_admin: { label: "PROJ ADMIN", color: "var(--amber, #f0a500)" },
  member: { label: "MEMBER", color: "var(--muted)" },
};

// ── tiny sub-components ────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.member;
  return (
    <span style={{ ...S.badge, color: cfg.color, borderColor: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function Avatar({ name, email }) {
  const letter = (name || email || "?")[0].toUpperCase();
  return <div style={S.avatar}>{letter}</div>;
}

function Spinner() {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--muted)",
        letterSpacing: 2,
      }}
    >
      LOADING...
    </span>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function MembersPanel({ projectId }) {
  const { user } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ msg: "", ok: true });

  // add-member form — picks from existing org members (project add no longer
  // resolves arbitrary emails; new accounts come only from org invites)
  const [orgMembers, setOrgMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [role, setRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  // per-row state
  const [editRole, setEditRole] = useState({}); // { [userId]: newRole }
  const [saving, setSaving] = useState({}); // { [userId]: bool }
  const [removing, setRemoving] = useState({}); // { [userId]: bool }

  // ── derive my role ───────────────────────────────────────────────────
  const myRole =
    members.find((m) => (m.user?._id ?? m.user) === user?._id)?.role ?? null;
  const isAdmin = myRole === "admin";

  // ── fetch ────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await projectService.listMembers(projectId);
      setMembers(data?.members ?? []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Load org members so admins can pick from people already in the org.
  useEffect(() => {
    (async () => {
      try {
        const data = await organizationService.listMembers();
        setOrgMembers(data?.members ?? []);
      } catch {
        setOrgMembers([]);
      }
    })();
  }, []);

  // Active org members not already on this project — the add-member candidates.
  const memberIds = new Set(members.map((m) => (m.user?._id ?? m.user)?.toString()));
  const candidates = orgMembers.filter(
    (om) => om.status === "active" && !memberIds.has(om._id?.toString()),
  );

  // ── toast helper ─────────────────────────────────────────────────────
  const flash = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3000);
  };
    

  // ── add member ───────────────────────────────────────────────────────
  const handleAdd = async () => {
    const picked = candidates.find((c) => c._id === selectedUserId);
    if (!picked) {
      setAddErr("Select a member to add.");
      return;
    }
    setAddErr("");
    setAdding(true);
    try {
      await projectService.addMember(projectId, { email: picked.email, role });
      setSelectedUserId("");
      setRole("member");
      flash(`✓ ${picked.fullName || picked.username} added as ${role}`);
      await fetchMembers();
    } catch (e) {
      setAddErr(e?.response?.data?.message || "Failed to add member.");
    } finally {
      setAdding(false);
    }
  };

  // ── update role ──────────────────────────────────────────────────────
  const handleSaveRole = async (userId) => {
    const newRole = editRole[userId];
    if (!newRole) return;
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      await projectService.updateMemberRole(projectId, userId, {
        role: newRole,
      });
      flash(`✓ Role updated to ${newRole}`);
      setEditRole((e) => {
        const n = { ...e };
        delete n[userId];
        return n;
      });
      await fetchMembers();
    } catch (e) {
      flash(
        `✗ ${e?.response?.data?.message || "Failed to update role."}`,
        false,
      );
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  };

  // ── remove member ────────────────────────────────────────────────────
  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    setRemoving((r) => ({ ...r, [userId]: true }));
    try {
      await projectService.removeMember(projectId, userId);
      flash(`✓ ${name} removed`);
      await fetchMembers();
    } catch (e) {
      flash(`✗ ${e?.response?.data?.message || "Failed to remove."}`, false);
    } finally {
      setRemoving((r) => ({ ...r, [userId]: false }));
    }
  };
  // ── render ────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* ADD MEMBER — admin only */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={S.addSection}
        >
          <div style={S.sectionLabel}>
            <span>ADD MEMBER</span>
            <div style={S.rule} />
          </div>

          {candidates.length === 0 ? (
            <div style={S.hint}>
              All active org members are already on this project. Invite new
              people from the Organization → Invites page.
            </div>
          ) : (
            <div style={S.addRow}>
              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>ORG MEMBER</label>
                <select
                  style={{
                    ...S.select,
                    width: "100%",
                    borderColor: addErr ? "var(--red, #e05050)" : "var(--border)",
                  }}
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setAddErr("");
                  }}
                >
                  <option value="">select a member…</option>
                  {candidates.map((c) => (
                    <option key={c._id} value={c._id}>
                      {(c.fullName || c.username)} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>ROLE</label>
                <select
                  style={S.select}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <button
                style={{ ...S.btnAdd, opacity: adding ? 0.6 : 1 }}
                onClick={handleAdd}
                disabled={adding}
              >
                {adding ? "ADDING..." : "+ ADD"}
              </button>
            </div>
          )}

          {addErr && <div style={S.addError}>✗ {addErr}</div>}
        </motion.div>
      )}

      {/* MEMBER LIST */}
      <div style={S.sectionLabel}>
        <span>MEMBERS {!loading && `(${members.length})`}</span>
        <div style={S.rule} />
      </div>

      {loading && (
        <div style={S.center}>
          <Spinner />
        </div>
      )}

      {error && (
        <div style={S.center}>
          <span
            style={{
              color: "var(--red, #e05050)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
            }}
          >
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
              const uid = m.user?._id ?? m.user;
              const name = m.user?.fullName || m.user?.username || "";
              const email = m.user?.email || "";
              const isMe = uid === user?._id;
              const isOwner = m.role === "admin";
              const pending = editRole[uid];
              const changed = pending && pending !== m.role;

              return (
                <motion.div
                  key={uid}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.18, delay: i * 0.05 }}
                  style={S.memberRow}
                >
                  <Avatar name={name} email={email} />

                  <div style={S.memberInfo}>
                    <span style={S.memberName}>
                      {(name || email).toUpperCase()}
                      {isMe && <span style={S.youTag}> (YOU)</span>}
                    </span>
                    <span style={S.memberEmail}>{email}</span>
                  </div>

                  {/* role — editable dropdown for admin on non-owner non-self rows */}
                  {isAdmin && !isMe && !isOwner ? (
                    <select
                      style={S.roleSelect}
                      value={pending ?? m.role}
                      onChange={(e) =>
                        setEditRole((prev) => ({
                          ...prev,
                          [uid]: e.target.value,
                        }))
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
                  )}

                  {/* save role — only appears when value changed */}
                  {isAdmin && !isMe && !isOwner && changed && (
                    <button
                      style={{ ...S.btnSave, opacity: saving[uid] ? 0.6 : 1 }}
                      onClick={() => handleSaveRole(uid)}
                      disabled={saving[uid]}
                    >
                      {saving[uid] ? "..." : "SAVE"}
                    </button>
                  )}

                  {/* remove */}
                  {isAdmin && !isMe && !isOwner && (
                    <button
                      style={{
                        ...S.btnRemove,
                        opacity: removing[uid] ? 0.5 : 1,
                      }}
                      onClick={() => handleRemove(uid, name || email)}
                      disabled={removing[uid]}
                    >
                      {removing[uid] ? "..." : "REMOVE"}
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      )}

      {/* TOAST */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              ...S.toast,
              borderLeftColor: toast.ok
                ? "var(--phosphor)"
                : "var(--red, #e05050)",
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
  wrap: {
    padding: "20px 4px",
    position: "relative",
    maxWidth: 720,
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
  rule: {
    flex: 1,
    height: 1,
    background: "var(--border)",
  },
  // add form
  addSection: {
    marginBottom: 32,
  },
  addRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 10,
    alignItems: "end",
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  fieldLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    letterSpacing: "0.14em",
    color: "var(--muted)",
  },
  input: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    padding: "8px 12px",
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
    padding: "8px 12px",
    outline: "none",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  btnAdd: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.14em",
    background: "var(--phosphor)",
    color: "var(--bg, #0a0a0a)",
    border: "1px solid var(--phosphor)",
    padding: "8px 18px",
    cursor: "pointer",
    fontWeight: 600,
    whiteSpace: "nowrap",
    alignSelf: "end",
  },
  addError: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    color: "var(--red, #e05050)",
    letterSpacing: "0.06em",
    marginTop: 6,
  },
  hint: {
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    color: "var(--muted)",
    letterSpacing: "0.04em",
    lineHeight: 1.6,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
  },
  // member rows
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
  memberInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  },
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
  youTag: {
    color: "var(--muted)",
    fontSize: 8,
    letterSpacing: "0.1em",
  },
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
  // misc
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "32px 0",
  },
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
